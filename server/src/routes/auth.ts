import { Router } from 'express';
import { getAdminUserByUsernameWithHash } from '../db';
import { signSessionToken, verifyPassword } from '../auth';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { username, password } = body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const user = getAdminUserByUsernameWithHash(username);
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    // Same message either way — don't reveal whether the username exists.
    res.status(401).json({ error: 'invalid username or password' });
    return;
  }

  const token = signSessionToken({ sub: user.id, username: user.username });
  res.json({ token, user: { id: user.id, username: user.username } });
});
