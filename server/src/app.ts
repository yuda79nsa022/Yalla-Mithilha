import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import { requireAdminSession } from './auth';
import { TITLE_IMAGES_DIR } from './db';
import { adminDecksRouter } from './routes/adminDecks';
import { adminPlayersRouter } from './routes/adminPlayers';
import { adminUsersRouter } from './routes/adminUsers';
import { auditLogRouter } from './routes/auditLog';
import { authRouter } from './routes/auth';
import { charadesRouter } from './routes/charades';
import { playerAuthRouter } from './routes/playerAuth';

// Both portals — the admin tool and the player-facing web app — are served
// by this one process, deployed as the single pm2 process "yalla" (see
// installer.sh). Two separate static roots mounted at two separate paths,
// so neither one's files can collide with the other's:
//   /admin-ui/*      -> public         (the admin tool, one inline-script page)
//   everything else  -> public-player  (the player app, an Expo web export)
const ADMIN_UI_DIR = path.join(__dirname, '..', 'public');
const PLAYER_APP_DIR = path.join(__dirname, '..', 'public-player');

export function createApp(): express.Express {
  const app = express();
  // contentSecurityPolicy is off for now: the admin tool (public/index.html)
  // is a single inline <script>, which a default CSP would block outright.
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

  // The admin tool logs in at runtime and holds its session token in the
  // browser — the static page has no secrets baked into it. Deliberately
  // not at the root: the root belongs to the player app below, so the admin
  // tool lives at /admin-ui instead.
  app.use('/admin-ui', express.static(ADMIN_UI_DIR));

  // Title pictures — public and unauthenticated like any other game asset,
  // since both the player app and the reveal page (opened by a plain camera
  // scan, no session at all) need to display them with no auth of their own.
  app.use('/title-images', express.static(TITLE_IMAGES_DIR));

  // The player app is a client-side-routed single-page app: one JS bundle,
  // one index.html, every route (/landing, /home, /account, ...) rendered
  // by expo-router in the browser — see `dist/` after `npx expo export -p
  // web`, which is what installer.sh copies into public-player. Serving it
  // with `express.static` alone would 404 a browser opened directly on
  // /landing (there's no such file on disk); the catch-all below falls back
  // to that same index.html for any of those, giving the client-side router
  // a chance to render it.
  app.use(express.static(PLAYER_APP_DIR));
  app.get('*', (req, res, next) => {
    // Leave the admin tool's own path and non-navigation requests (an XHR
    // expecting JSON, say) alone — only a browser navigating to an unbuilt
    // player-app route should get the SPA shell. Deliberately NOT excluding
    // /charades wholesale: charadesRouter guards its real endpoints with
    // requirePlayerSession per-route rather than as a router-wide `.use()`,
    // so an unmatched GET under /charades (a refresh on this app's own
    // /charades/draft, /charades/checkout or /charades/play screens) already
    // falls through the router unanswered by the time it reaches here — and
    // needs the SPA shell exactly like any other player-app route.
    if (
      req.method !== 'GET' ||
      req.path.startsWith('/admin') ||
      req.path.startsWith('/players') ||
      req.path.startsWith('/title-images') ||
      req.path === '/health' ||
      !req.accepts('html')
    ) {
      next();
      return;
    }
    const indexHtml = path.join(PLAYER_APP_DIR, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      res
        .status(503)
        .send('Player app build not found — run `npx expo export -p web` and copy dist/ to server/public-player (installer.sh does this).');
      return;
    }
    res.sendFile(indexHtml);
  });

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
