import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-auth-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { createAdminUser, resetDbForTests } from '../src/db';
import { hashPassword } from '../src/auth';

const app = createApp();

beforeEach(() => resetDbForTests());

describe('POST /admin/auth/login', () => {
  it('logs in with the correct username and password', async () => {
    const passwordHash = await hashPassword('correct-horse-battery');
    createAdminUser({ username: 'jane', passwordHash });

    const res = await request(app)
      .post('/admin/auth/login')
      .send({ username: 'jane', password: 'correct-horse-battery' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ username: 'jane' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects the wrong password', async () => {
    const passwordHash = await hashPassword('correct-horse-battery');
    createAdminUser({ username: 'jane', passwordHash });

    const res = await request(app)
      .post('/admin/auth/login')
      .send({ username: 'jane', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown username', async () => {
    const res = await request(app)
      .post('/admin/auth/login')
      .send({ username: 'nobody', password: 'whatever123' });
    expect(res.status).toBe(401);
  });

  it('returns a token that actually works on a protected route', async () => {
    const passwordHash = await hashPassword('correct-horse-battery');
    createAdminUser({ username: 'jane', passwordHash });
    const login = await request(app)
      .post('/admin/auth/login')
      .send({ username: 'jane', password: 'correct-horse-battery' });

    const res = await request(app)
      .get('/admin/decks')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
  });

  it('rejects a missing username or password with 400', async () => {
    const res = await request(app).post('/admin/auth/login').send({ username: 'jane' });
    expect(res.status).toBe(400);
  });
});
