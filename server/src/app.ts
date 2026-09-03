import express from 'express';
import path from 'path';
import { UPLOADS_DIR } from './db';
import { requireAdminSession } from './auth';
import { adminRouter } from './routes/admin';
import { adminPlayersRouter } from './routes/adminPlayers';
import { adminUsersRouter } from './routes/adminUsers';
import { authRouter } from './routes/auth';
import { catalogueRouter } from './routes/catalogue';
import { playerAuthRouter } from './routes/playerAuth';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/catalogue', catalogueRouter);
  app.use('/players', playerAuthRouter);
  app.use('/admin/auth', authRouter);
  app.use('/admin/users', requireAdminSession, adminUsersRouter);
  app.use('/admin/players', requireAdminSession, adminPlayersRouter);
  app.use('/admin', requireAdminSession, adminRouter);

  // Category thumbnails — public, same as the catalogue itself.
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      next();
    },
    express.static(UPLOADS_DIR)
  );

  // The admin UI logs in at runtime and holds the session token in the
  // browser — the static page has no secrets baked into it.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}
