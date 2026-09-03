import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-playerauth-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { resetDbForTests } from '../src/db';

const app = createApp();

beforeEach(() => resetDbForTests());

describe('POST /players/register', () => {
  it('creates a player account and returns a token', async () => {
    const res = await request(app)
      .post('/players/register')
      .send({ username: 'newplayer', password: 'password1234' });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.player).toMatchObject({ username: 'newplayer' });
    expect(res.body.player.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate username with 409', async () => {
    await request(app).post('/players/register').send({ username: 'dup', password: 'password1234' });
    const res = await request(app).post('/players/register').send({ username: 'dup', password: 'password1234' });
    expect(res.status).toBe(409);
  });

  it('rejects a password shorter than 8 characters with 400', async () => {
    const res = await request(app)
      .post('/players/register')
      .send({ username: 'shortpw', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('a player token does not work as an admin session', async () => {
    const register = await request(app)
      .post('/players/register')
      .send({ username: 'notanadmin', password: 'password1234' });

    const res = await request(app)
      .get('/admin/categories')
      .set('Authorization', `Bearer ${register.body.token}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /players/login', () => {
  it('logs in with the correct username and password', async () => {
    await request(app).post('/players/register').send({ username: 'jane', password: 'correct-horse' });

    const res = await request(app).post('/players/login').send({ username: 'jane', password: 'correct-horse' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.player).toMatchObject({ username: 'jane' });
    expect(res.body.player.passwordHash).toBeUndefined();
  });

  it('rejects the wrong password', async () => {
    await request(app).post('/players/register').send({ username: 'jane', password: 'correct-horse' });

    const res = await request(app).post('/players/login').send({ username: 'jane', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown username', async () => {
    const res = await request(app).post('/players/login').send({ username: 'nobody', password: 'whatever123' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing username or password with 400', async () => {
    const res = await request(app).post('/players/login').send({ username: 'jane' });
    expect(res.status).toBe(400);
  });
});
