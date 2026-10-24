import crypto from 'crypto';
import { Router } from 'express';
import {
  createPasswordReset,
  createPlayer,
  getActivePasswordReset,
  getPlayerById,
  getPlayerByUsernameWithHash,
  grantSignupBonus,
  incrementPasswordResetAttempts,
  recordAudit,
  updatePlayer,
  claimPasswordReset,
} from '../db';
import { hashPassword, requirePlayerSession, signPlayerSessionToken, verifyPassword } from '../auth';
import { handleError } from '../errors';
import { resetCodeProvider } from '../notifications/resetCodeProvider';
import { loginLimiter, passwordResetConfirmLimiter, passwordResetRequestLimiter, registerLimiter } from '../rateLimit';
import {
  parseChangePasswordBody,
  parseConfirmPasswordResetBody,
  parseRegisterPlayerBody,
  parseRequestPasswordResetBody,
} from '../validate';

const RESET_CODE_TTL_MS = 10 * 60 * 1000;
/** Once a code has racked up this many wrong guesses, it's dead even if it hasn't expired yet — the player has to request a fresh one. */
const MAX_RESET_ATTEMPTS = 5;

function generateResetCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Never store the raw code — same reasoning as a password hash, just a faster hash since a 6-digit code is already rate-limited and short-lived, not a long-term secret. */
function hashResetCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export const playerAuthRouter = Router();

// Public, called directly by the app running as a web page on a different
// origin — same reasoning as the catalogue route. Unlike that GET-only
// route, a JSON POST body triggers a CORS preflight, so OPTIONS needs an
// explicit response here. Deliberately not applied to /admin, which stays
// same-origin-only on top of requiring a session.
playerAuthRouter.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  // Authorization for /session/refresh, the one route here that needs a session.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

/** Optional — guest play never touches this route. Only players who choose to create an account do. */
playerAuthRouter.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, password, email } = parseRegisterPlayerBody(req.body);
    const passwordHash = await hashPassword(password);
    const player = createPlayer({ username, passwordHash, email });
    // One-time new-account bonus: two free games of either mode, spent before
    // any paid credit (see startGameSession) — only this route grants it,
    // so a brand new account gets it exactly once and a login or an
    // admin-side change never does. Re-fetched so the response reflects the
    // grant, not the pre-bonus row `createPlayer` returned.
    grantSignupBonus(player.id);
    const token = signPlayerSessionToken({ sub: player.id, username: player.username });
    res.status(201).json({ token, player: getPlayerById(player.id) });
  } catch (err) {
    handleError(err, res);
  }
});

playerAuthRouter.post('/login', loginLimiter, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { username, password } = body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const player = getPlayerByUsernameWithHash(username);
  const ok = player ? await verifyPassword(password, player.passwordHash) : false;
  if (!player || !ok) {
    res.status(401).json({ error: 'invalid username or password' });
    return;
  }

  const token = signPlayerSessionToken({ sub: player.id, username: player.username });
  res.json({ token, player: { id: player.id, username: player.username } });
});

/**
 * Always the same response whether or not `username` matches an account, or
 * that account has an email on file — a distinguishable response here would
 * let anyone enumerate registered usernames. The code itself only ever
 * leaves the server via `resetCodeProvider` (an email/SMS in a real
 * deployment, the server console for now — see resetCodeProvider.ts), never
 * in this response.
 */
playerAuthRouter.post('/password-reset/request', passwordResetRequestLimiter, async (req, res) => {
  try {
    const { username } = parseRequestPasswordResetBody(req.body);
    const player = getPlayerByUsernameWithHash(username);
    if (player?.email) {
      const code = generateResetCode();
      createPasswordReset({
        playerId: player.id,
        codeHash: hashResetCode(code),
        expiresAt: Date.now() + RESET_CODE_TTL_MS,
      });
      await resetCodeProvider.sendResetCode({ to: player.email, username: player.username, code });
    }
    res.json({ message: 'if an account with that username has an email on file, a reset code was sent to it' });
  } catch (err) {
    handleError(err, res);
  }
});

playerAuthRouter.post('/password-reset/confirm', passwordResetConfirmLimiter, async (req, res) => {
  try {
    const { username, code, newPassword } = parseConfirmPasswordResetBody(req.body);
    const player = getPlayerByUsernameWithHash(username);
    const reset = player ? getActivePasswordReset(player.id) : null;

    // Same generic error whether the username doesn't exist, no code was
    // ever requested, the code expired, or too many wrong guesses already
    // used it up — nothing here should tell an attacker which case it was.
    if (!player || !reset || reset.attempts >= MAX_RESET_ATTEMPTS) {
      res.status(400).json({ error: 'invalid or expired reset code' });
      return;
    }
    if (hashResetCode(code) !== reset.codeHash) {
      incrementPasswordResetAttempts(reset.id);
      res.status(400).json({ error: 'invalid or expired reset code' });
      return;
    }

    // Claim the code before the await below, not after: otherwise two
    // requests racing with the same valid code would both pass the checks
    // above while the first one was still hashing, and both reset.
    if (!claimPasswordReset(reset.id)) {
      res.status(400).json({ error: 'invalid or expired reset code' });
      return;
    }
    const passwordHash = await hashPassword(newPassword);
    updatePlayer(player.id, { passwordHash });
    recordAudit({
      actorId: player.id,
      actorUsername: player.username,
      action: 'player.password_reset_self',
      target: player.id,
    });
    res.json({ ok: true });
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * Swaps a still-valid session token for a fresh one with a new expiry — the
 * app calls this while it's in use, so an active player is never signed out
 * mid-game by the token's fixed 12-hour lifetime, while an abandoned device
 * still needs a real sign-in once its token lapses. `requirePlayerSession`
 * does the real check (signature, expiry, and the account's session
 * version), so an expired, signed-out-everywhere or deleted account's token
 * gets a 401 here like anywhere else and can't be revived.
 */
playerAuthRouter.post('/session/refresh', requirePlayerSession, (req, res) => {
  try {
    const player = getPlayerById(req.player!.sub);
    if (!player) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const token = signPlayerSessionToken({ sub: player.id, username: player.username });
    res.json({ token, player: { id: player.id, username: player.username } });
  } catch (err) {
    handleError(err, res);
  }
});

/** The signed-in player's own profile — what the Profile page shows. Never includes the password hash. */
playerAuthRouter.get('/me', requirePlayerSession, (req, res) => {
  const player = getPlayerById(req.player!.sub);
  if (!player) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  res.json({
    id: player.id,
    username: player.username,
    email: player.email,
    freeGameCredits: player.freeGameCredits,
    createdAt: player.createdAt,
  });
});

/**
 * A signed-in player changing their own password: the current one must be
 * right (a borrowed, unlocked device can't silently take over the account).
 * Changing it bumps the account's session version, which signs out every
 * other device — so the response carries a fresh token for this one, the
 * same shape as login, and the app swaps to it without a re-sign-in.
 */
playerAuthRouter.post('/password/change', loginLimiter, requirePlayerSession, async (req, res) => {
  try {
    const { currentPassword, newPassword } = parseChangePasswordBody(req.body);
    const player = getPlayerByUsernameWithHash(req.player!.username);
    const ok = player && player.id === req.player!.sub ? await verifyPassword(currentPassword, player.passwordHash) : false;
    if (!player || !ok) {
      res.status(401).json({ error: 'current password is incorrect' });
      return;
    }
    const updated = updatePlayer(player.id, { passwordHash: await hashPassword(newPassword) });
    recordAudit({
      actorId: player.id,
      actorUsername: player.username,
      action: 'player.password_change_self',
      target: player.id,
    });
    const token = signPlayerSessionToken({ sub: updated.id, username: updated.username });
    res.json({ token, player: { id: updated.id, username: updated.username } });
  } catch (err) {
    handleError(err, res);
  }
});
