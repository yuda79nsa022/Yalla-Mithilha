import fs from 'fs';
import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-static-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { resetDbForTests } from '../src/db';

const app = createApp();

// `__dirname` here is `server/src` under ts-jest, same as at runtime, so
// this matches exactly what `server/src/app.ts` resolves PLAYER_APP_DIR to.
const PLAYER_APP_DIR = path.join(__dirname, '..', 'public-player');
const PLAYER_INDEX_HTML = path.join(PLAYER_APP_DIR, 'index.html');

beforeEach(() => resetDbForTests());

describe('the admin tool, at /admin-ui', () => {
  it('serves the admin tool at /admin-ui/ (and redirects /admin-ui to it)', async () => {
    const res = await request(app).get('/admin-ui').redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Yalla Mithilha — Charades Admin/);
  });

  it('does not serve the admin tool at the root', async () => {
    // No player app build is present in this test environment either, so
    // root should hit the "build not found" fallback below, not the admin
    // tool — proving the two are on genuinely separate paths.
    const res = await request(app).get('/');
    expect(res.text).not.toMatch(/Charades Admin/);
  });
});

describe('the player app, served from the root', () => {
  it('reports the build as missing rather than a bare 404, when public-player has not been built', async () => {
    expect(fs.existsSync(PLAYER_INDEX_HTML)).toBe(false);
    const res = await request(app).get('/home');
    expect(res.status).toBe(503);
    expect(res.text).toMatch(/expo export/);
  });

  describe('once the player app has been built', () => {
    beforeAll(() => {
      fs.mkdirSync(PLAYER_APP_DIR, { recursive: true });
      fs.writeFileSync(PLAYER_INDEX_HTML, '<html><body>player app shell</body></html>');
    });

    afterAll(() => {
      fs.rmSync(PLAYER_APP_DIR, { recursive: true, force: true });
    });

    it('serves the SPA shell for a client-side route like /home', async () => {
      const res = await request(app).get('/home');
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/player app shell/);
    });

    it('serves the SPA shell for the root too', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/player app shell/);
    });

    it('still leaves API routes alone rather than swallowing them into the SPA shell', async () => {
      const res = await request(app).get('/players/does-not-exist');
      expect(res.text).not.toMatch(/player app shell/);
    });

    it('a missing title picture 404s rather than falling back to the SPA shell', async () => {
      const res = await request(app).get('/title-images/does-not-exist.png');
      expect(res.text).not.toMatch(/player app shell/);
    });
  });
});
