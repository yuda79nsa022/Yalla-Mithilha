import { Router } from 'express';
import { createPlayer, getPlayerByUsernameWithHash } from '../db';
import { hashPassword, signPlayerSessionToken, verifyPassword } from '../auth';
import { handleError } from '../errors';
import { loginLimiter, registerLimiter } from '../rateLimit';
import { parseRegisterPlayerBody } from '../validate';

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
    const { username, password } = parseRegisterPlayerBody(req.body);
    const passwordHash = await hashPassword(password);
    const player = createPlayer({ username, passwordHash });
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
