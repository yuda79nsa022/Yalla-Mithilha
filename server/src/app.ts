import express from 'express';
import path from 'path';
import { requireAdminToken } from './auth';
import { adminRouter } from './routes/admin';
import { catalogueRouter } from './routes/catalogue';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/catalogue', catalogueRouter);
  app.use('/admin', requireAdminToken, adminRouter);

  // The admin UI itself calls /admin/* from the browser with a token typed
  // in at runtime — the static page has no secrets baked into it.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}
