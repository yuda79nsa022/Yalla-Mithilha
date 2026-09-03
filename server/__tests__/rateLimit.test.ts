import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-ratelimit-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { resetDbForTests } from '../src/db';

const app = createApp();

beforeEach(() => resetDbForTests());

// The limiter is skipped under NODE_ENV=test (see src/rateLimit.ts) so the
// rest of the suite isn't at the mercy of a shared request budget. These
// tests flip that off for their own duration to prove the limiter actually
// engages, then restore it.
function withRateLimitingEnabled<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  return fn().finally(() => {
    process.env.NODE_ENV = original;
  });
}

describe('rate limiting', () => {
  it('blocks repeated /players/register attempts past the limit', async () => {
    await withRateLimitingEnabled(async () => {
      const body = { username: 'ratelimited', password: 'password1234' };
      let sawTooMany = false;
      for (let i = 0; i < 11; i++) {
        const res = await request(app).post('/players/register').send(body);
        if (res.status === 429) {
          sawTooMany = true;
          break;
        }
      }
      expect(sawTooMany).toBe(true);
    });
  });

  it('blocks repeated /players/login attempts past the limit', async () => {
    await withRateLimitingEnabled(async () => {
      const body = { username: 'nobody', password: 'wrong-password' };
      let sawTooMany = false;
      for (let i = 0; i < 21; i++) {
        const res = await request(app).post('/players/login').send(body);
        if (res.status === 429) {
          sawTooMany = true;
          break;
        }
      }
      expect(sawTooMany).toBe(true);
    });
  });

  it('blocks repeated /admin/auth/login attempts past the limit', async () => {
    await withRateLimitingEnabled(async () => {
      const body = { username: 'nobody', password: 'wrong-password' };
      let sawTooMany = false;
      for (let i = 0; i < 21; i++) {
        const res = await request(app).post('/admin/auth/login').send(body);
        if (res.status === 429) {
          sawTooMany = true;
          break;
        }
      }
      expect(sawTooMany).toBe(true);
    });
  });
});
