import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-adminplayers-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { resetDbForTests } from '../src/db';
import { makeAdminAuthHeader } from './helpers/testAuth';

const app = createApp();
let auth: { Authorization: string };

beforeEach(async () => {
  resetDbForTests();
  auth = await makeAdminAuthHeader();
});

describe('admin player management', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/admin/players');
    expect(res.status).toBe(401);
  });

  it('lists players registered through the public route, without ever including a password hash', async () => {
    await request(app).post('/players/register').send({ username: 'gamer1', password: 'password1234' });
    await request(app).post('/players/register').send({ username: 'gamer2', password: 'password1234' });

    const res = await request(app).get('/admin/players').set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((p: any) => p.passwordHash === undefined)).toBe(true);
  });

  it('renames a player and resets their password', async () => {
    const register = await request(app)
      .post('/players/register')
      .send({ username: 'original', password: 'password1234' });
    const id = register.body.player.id;

    const update = await request(app)
      .put(`/admin/players/${id}`)
      .set(auth)
      .send({ username: 'renamed', password: 'newpassword123' });
    expect(update.status).toBe(200);
    expect(update.body.username).toBe('renamed');

    const oldLogin = await request(app).post('/players/login').send({ username: 'original', password: 'password1234' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/players/login').send({ username: 'renamed', password: 'newpassword123' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects a duplicate username on update with 409', async () => {
    await request(app).post('/players/register').send({ username: 'taken', password: 'password1234' });
    const register = await request(app)
      .post('/players/register')
      .send({ username: 'other', password: 'password1234' });

    const res = await request(app)
      .put(`/admin/players/${register.body.player.id}`)
      .set(auth)
      .send({ username: 'taken' });
    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown player id', async () => {
    const res = await request(app).put('/admin/players/nope').set(auth).send({ username: 'validname' });
    expect(res.status).toBe(404);
  });

  it('deletes a player — with no last-player guard, unlike admin accounts', async () => {
    const register = await request(app)
      .post('/players/register')
      .send({ username: 'onlyplayer', password: 'password1234' });

    const del = await request(app).delete(`/admin/players/${register.body.player.id}`).set(auth);
    expect(del.status).toBe(204);

    const list = await request(app).get('/admin/players').set(auth);
    expect(list.body).toHaveLength(0);
  });
});
