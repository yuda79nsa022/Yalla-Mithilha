import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-auditroutes-${Date.now()}-${Math.random()}.sqlite`);
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

const sample = {
  id: 'audit-test-deck',
  nameAr: 'مجموعة',
  nameEn: 'Audit Test Deck',
};

describe('GET /admin/audit-log', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/admin/audit-log');
    expect(res.status).toBe(401);
  });

  it('is empty before anything happens', async () => {
    const res = await request(app).get('/admin/audit-log').set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('deck actions are audited', () => {
  it('logs create, update and delete with the acting admin identified', async () => {
    await request(app).post('/admin/decks').set(auth).send(sample);
    await request(app).put(`/admin/decks/${sample.id}`).set(auth).send({ nameEn: 'Renamed' });
    await request(app).delete(`/admin/decks/${sample.id}`).set(auth);

    const res = await request(app).get('/admin/audit-log').set(auth);
    const actions = res.body.map((e: any) => e.action);
    // Most-recent-first.
    expect(actions).toEqual(['deck.delete', 'deck.update', 'deck.create']);
    expect(res.body[0].target).toBe(sample.id);
    expect(res.body[0].actorUsername).toBeTruthy();
  });

  it('logs a game-price change with before/after', async () => {
    await request(app).put('/admin/settings/game-price').set(auth).send({ fils: 2500 });

    const res = await request(app).get('/admin/audit-log').set(auth);
    const entry = res.body.find((e: any) => e.action === 'settings.game-price.update');
    expect(entry.after.fils).toBe(2500);
  });
});

describe('admin and player account actions are audited, never with a password hash', () => {
  it('logs admin creation, rename/password-change and deletion', async () => {
    const create = await request(app)
      .post('/admin/users')
      .set(auth)
      .send({ username: 'newadmin', password: 'password1234' });
    await request(app)
      .put(`/admin/users/${create.body.id}`)
      .set(auth)
      .send({ username: 'renamedadmin', password: 'newpassword123' });
    await request(app).delete(`/admin/users/${create.body.id}`).set(auth);

    const res = await request(app).get('/admin/audit-log').set(auth);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/password1234|newpassword123|\$2[aby]\$/); // no plaintext or bcrypt hash ever logged

    const actions = res.body.map((e: any) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['admin.create', 'admin.update', 'admin.delete']));
    const update = res.body.find((e: any) => e.action === 'admin.update');
    expect(update.after).toMatchObject({ username: 'renamedadmin', passwordChanged: true });
  });

  it('logs player rename and deletion', async () => {
    await request(app).post('/players/register').send({ username: 'testplayer', password: 'password1234' });
    const list = await request(app).get('/admin/players').set(auth);
    const playerId = list.body[0].id;

    await request(app).put(`/admin/players/${playerId}`).set(auth).send({ username: 'renamedplayer' });
    await request(app).delete(`/admin/players/${playerId}`).set(auth);

    const res = await request(app).get('/admin/audit-log').set(auth);
    const actions = res.body.map((e: any) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['player.update', 'player.delete']));
  });
});
