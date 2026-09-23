import { Router } from 'express';
import { getAdminUserByUsernameWithHash } from '../db';
import { signSessionToken, verifyPassword } from '../auth';
import { loginLimiter } from '../rateLimit';

export const authRouter = Router();

// CORS-open on this one route only (not the rest of `/admin/*`, which stays
// same-origin-only): the player app's own sign-in form (`app/account.tsx`)
// now tries this as a fallback after a player login fails, so an admin
// never needs a separate "Admin sign-in" link — that can call this
// cross-origin in local dev, where the player app and this API run on
// different ports. Opening this up changes nothing about its actual attack
// surface (it's already public, rate-limited, and gives the same generic
// error either way) — CORS only gates whether a browser script can *read*
// the response, not whether the request reaches the server at all.
authRouter.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

authRouter.post('/login', loginLimiter, async (req, res) => {
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
