import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-errors-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { resetDbForTests } from '../src/db';

const app = createApp();

beforeEach(() => resetDbForTests());

describe('malformed request bodies', () => {
  it('replies with clean JSON, not an HTML stack trace, for invalid JSON', async () => {
    const res = await request(app)
      .post('/admin/auth/login')
      .set('Content-Type', 'application/json')
      .send('{not valid json');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ error: 'invalid JSON body' });
    expect(res.text).not.toMatch(/<html/i);
    expect(res.text).not.toMatch(/node_modules/);
  });

  it('replies with clean JSON for an empty body claiming to be JSON', async () => {
    const res = await request(app).post('/players/register').set('Content-Type', 'application/json').send('');

    // An empty body parses to `undefined`, which the route's own validation
    // rejects — this exercises the same "reaches the route handler cleanly"
    // path, not the parser's error branch, but confirms no HTML ever leaks.
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.text).not.toMatch(/<html/i);
  });
});
