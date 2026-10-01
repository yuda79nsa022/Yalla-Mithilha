import { Router } from 'express';
import { claimRevealToken } from '../db';
import { handleError } from '../errors';

/**
 * The handoff screen's QR code links here, not under /charades — a bare
 * camera scan carries no app, no login, and no session at all, so this has
 * to be reachable with none of those, on its own path rather than one the
 * authenticated API prefix might someday need to gate as a whole.
 */
export const revealRouter = Router();

revealRouter.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

/**
 * Single-use: the first request to claim a token gets the round's answer;
 * every request after that — including a retry of the very same scan, or a
 * teammate/opposing player scanning the same still-visible QR code — gets
 * 410, same as if the link had never existed. This is what actually
 * prevents anyone but the one person who scans first from ever seeing it.
 */
revealRouter.get('/:id', (req, res) => {
  try {
    const payload = claimRevealToken(req.params.id);
    res.json(payload);
  } catch (err) {
    handleError(err, res);
  }
});
