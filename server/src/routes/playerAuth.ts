import crypto from 'crypto';
import { Router } from 'express';
import {
  createPasswordReset,
  createPlayer,
  getActivePasswordReset,
  getPlayerByUsernameWithHash,
  grantSignupBonus,
  incrementPasswordResetAttempts,
  recordAudit,
  updatePlayer,
  usePasswordReset,
} from '../db';
import { hashPassword, signPlayerSessionToken, verifyPassword } from '../auth';
import { handleError } from '../errors';
import { resetCodeProvider } from '../notifications/resetCodeProvider';
import { loginLimiter, passwordResetConfirmLimiter, passwordResetRequestLimiter, registerLimiter } from '../rateLimit';
import { parseConfirmPasswordResetBody, parseRegisterPlayerBody, parseRequestPasswordResetBody } from '../validate';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
    // One-time new-account bonus (currently worth 3.00 KD in game credits at
    // today's price) — only this route grants it, so a brand new account
    // gets it exactly once and a login or an admin-side change never does.
    grantSignupBonus(player.id);
    const token = signPlayerSessionToken({ sub: player.id, username: player.username });
    res.status(201).json({ token, player });
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

    const passwordHash = await hashPassword(newPassword);
    updatePlayer(player.id, { passwordHash });
    usePasswordReset(reset.id);
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
