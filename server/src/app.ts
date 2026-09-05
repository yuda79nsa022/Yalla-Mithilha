import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { requireAdminSession } from './auth';
import { adminDecksRouter } from './routes/adminDecks';
import { adminPlayersRouter } from './routes/adminPlayers';
import { adminUsersRouter } from './routes/adminUsers';
import { auditLogRouter } from './routes/auditLog';
import { authRouter } from './routes/auth';
import { charadesRouter } from './routes/charades';
import { playerAuthRouter } from './routes/playerAuth';

export function createApp(): express.Express {
  const app = express();
  // contentSecurityPolicy is off for now: the admin UI (public/index.html) is
  // a single inline <script>, which a default CSP would block outright.
  // crossOriginResourcePolicy is off because /charades and /players are
  // deliberately fetched from a different origin (the app running as a web
  // page) — helmet's default same-origin CORP would silently block that,
  // separately from and in addition to the CORS headers those routes already
  // set. Everything else helmet sets by default — no-sniff, frame denial, a
  // safe referrer policy, HSTS when served over HTTPS — applies as-is.
  // Moving the admin UI's script to an external file would let CSP turn on.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/players', playerAuthRouter);
  app.use('/charades', charadesRouter);
  app.use('/admin/auth', authRouter);
  app.use('/admin/users', requireAdminSession, adminUsersRouter);
  app.use('/admin/players', requireAdminSession, adminPlayersRouter);
  app.use('/admin', requireAdminSession, auditLogRouter);
  app.use('/admin', requireAdminSession, adminDecksRouter);

  // The admin UI logs in at runtime and holds the session token in the
  // browser — the static page has no secrets baked into it.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Catches anything that reaches Express before a route handler — chiefly
  // express.json() rejecting a malformed body. Without this, Express's own
  // default error handler replies with an HTML page containing the full
  // stack trace and absolute file paths, whenever NODE_ENV isn't exactly
  // "production" (true for local dev and for any deployment that forgets to
  // set it). Route handlers themselves already report errors cleanly via
  // errors.ts#handleError; this is the equivalent floor for everything else.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError && (err as { status?: number }).status === 400 && 'body' in err) {
      res.status(400).json({ error: 'invalid JSON body' });
      return;
    }
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}
