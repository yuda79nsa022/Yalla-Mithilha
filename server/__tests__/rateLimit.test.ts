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
      const body = { username: 'ratelimited', password: 'password1234', email: 'ratelimited@example.com' };
      let sawTooMany = false;
      for (let i = 0; i < 31; i++) {
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

  // Behind nginx (same host), every request arrives from 127.0.0.1 with the
  // real client in X-Forwarded-For. Each player must get their own budget,
  // not share nginx's — otherwise the 21st login across *all* players in a
  // window would be refused.
  it('behind the local nginx proxy, each client IP gets its own login budget', async () => {
    await withRateLimitingEnabled(async () => {
      const body = { username: 'nobody', password: 'wrong-password' };
      const from = (ip: string) => request(app).post('/players/login').set('X-Forwarded-For', ip).send(body);

      let blockedAt = -1;
      for (let i = 0; i < 21; i++) {
        if ((await from('203.0.113.10')).status === 429) {
          blockedAt = i;
          break;
        }
      }
      expect(blockedAt).toBe(20); // exactly the 21st attempt from that player

      // A different player behind the same nginx is unaffected.
      expect((await from('203.0.113.11')).status).toBe(401);
    });
  });
});

describe('trust proxy', () => {
  it('uses X-Forwarded-For only when the connection itself comes from loopback (nginx)', () => {
    const trust = app.get('trust proxy fn') as (addr: string, i: number) => boolean;
    expect(trust('127.0.0.1', 0)).toBe(true);
    expect(trust('::1', 0)).toBe(true);
    // A client hitting the port directly can't spoof its IP via the header.
    expect(trust('198.51.100.7', 0)).toBe(false);
  });
});
