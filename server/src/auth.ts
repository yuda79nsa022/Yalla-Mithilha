import type { RequestHandler } from 'express';

/** Single shared admin token via env var — appropriate for a small content team, not multi-role auth. */
export const requireAdminToken: RequestHandler = (req, res, next) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'ADMIN_TOKEN is not configured on the server' });
    return;
  }
  const header = req.headers.authorization ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (provided !== token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
};
