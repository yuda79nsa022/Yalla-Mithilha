import { Router } from 'express';
import { createPlayer, getPlayerByUsernameWithHash } from '../db';
import { hashPassword, signPlayerSessionToken, verifyPassword } from '../auth';
import { handleError } from '../errors';
import { parseRegisterPlayerBody } from '../validate';

export const playerAuthRouter = Router();

/** Optional — guest play never touches this route. Only players who choose to create an account do. */
playerAuthRouter.post('/register', async (req, res) => {
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

playerAuthRouter.post('/login', async (req, res) => {
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
