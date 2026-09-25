import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-adminplayers-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { createPlayer, resetDbForTests } from '../src/db';
import { hashPassword } from '../src/auth';
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
    await request(app)
      .post('/players/register')
      .send({ username: 'gamer1', password: 'password1234', email: 'gamer1@example.com' });
    await request(app)
      .post('/players/register')
      .send({ username: 'gamer2', password: 'password1234', email: 'gamer2@example.com' });

    const res = await request(app).get('/admin/players').set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((p: any) => p.passwordHash === undefined)).toBe(true);
  });

  it('renames a player and resets their password', async () => {
    const register = await request(app)
      .post('/players/register')
      .send({ username: 'original', password: 'password1234', email: 'original@example.com' });
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
    await request(app)
      .post('/players/register')
      .send({ username: 'taken', password: 'password1234', email: 'taken@example.com' });
    const register = await request(app)
      .post('/players/register')
      .send({ username: 'other', password: 'password1234', email: 'other@example.com' });

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

  it('lets an admin set an email on a player with none, enabling self-service reset', async () => {
    // Registration now requires an email, but a legacy/no-email account can
    // still exist in the DB, so insert one directly rather than via the
    // now-email-requiring public endpoint.
    const player = createPlayer({ username: 'noemailyet', passwordHash: await hashPassword('password1234') });
    const id = player.id;

    const before = await request(app).get('/admin/players').set(auth);
    expect(before.body.find((p: any) => p.id === id).email).toBeNull();

    const update = await request(app).put(`/admin/players/${id}`).set(auth).send({ email: 'backfilled@example.com' });
    expect(update.status).toBe(200);
    expect(update.body.email).toBe('backfilled@example.com');
  });

  it('lets an admin clear a player email by sending null', async () => {
    const register = await request(app)
      .post('/players/register')
      .send({ username: 'clearmail', password: 'password1234', email: 'clearmail@example.com' });
    const id = register.body.player.id;

    const update = await request(app).put(`/admin/players/${id}`).set(auth).send({ email: null });
    expect(update.status).toBe(200);
    expect(update.body.email).toBeNull();
  });

  it('rejects a malformed email on update with 400', async () => {
    const register = await request(app)
      .post('/players/register')
      .send({ username: 'bademailupdate', password: 'password1234', email: 'bademailupdate@example.com' });

    const res = await request(app)
      .put(`/admin/players/${register.body.player.id}`)
      .set(auth)
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('deletes a player — with no last-player guard, unlike admin accounts', async () => {
    const register = await request(app)
      .post('/players/register')
      .send({ username: 'onlyplayer', password: 'password1234', email: 'onlyplayer@example.com' });

    const del = await request(app).delete(`/admin/players/${register.body.player.id}`).set(auth);
    expect(del.status).toBe(204);

    const list = await request(app).get('/admin/players').set(auth);
    expect(list.body).toHaveLength(0);
  });
});
