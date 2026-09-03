import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-boardgames-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { resetDbForTests } from '../src/db';
import { makeAdminAuthHeader, makePlayerSession } from './helpers/testAuth';

const app = createApp();

beforeEach(() => resetDbForTests());

describe('board-games auth boundary', () => {
  it('requires a player session', async () => {
    const res = await request(app).get('/board-games/credits');
    expect(res.status).toBe(401);
  });

  it('rejects an admin session — admin and player tokens are not interchangeable', async () => {
    const adminAuth = await makeAdminAuthHeader();
    const res = await request(app).get('/board-games/credits').set(adminAuth);
    expect(res.status).toBe(401);
  });

  it('answers a CORS preflight for a bearer-authenticated GET', async () => {
    const res = await request(app)
      .options('/board-games/credits')
      .set('Origin', 'http://example.test')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
  });
});

describe('GET /board-games/credits', () => {
  it('starts at zero', async () => {
    const { auth } = await makePlayerSession();
    const res = await request(app).get('/board-games/credits').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(0);
  });
});

describe('checkout lifecycle', () => {
  it('confirming a payment grants the right number of credits', async () => {
    const { auth } = await makePlayerSession();
    const checkout = await request(app).post('/board-games/checkout').set(auth).send({ product: 'bundle2' });
    expect(checkout.status).toBe(201);
    expect(checkout.body.status).toBe('initiated');

    const confirm = await request(app)
      .post(`/board-games/checkout/${checkout.body.id}/confirm`)
      .set(auth)
      .send();
    expect(confirm.status).toBe(200);
    expect(confirm.body.balance).toBe(2);

    const credits = await request(app).get('/board-games/credits').set(auth);
    expect(credits.body.balance).toBe(2);
  });

  it('a duplicate confirm call (simulated retried webhook) grants credits only once', async () => {
    const { auth } = await makePlayerSession();
    const checkout = await request(app).post('/board-games/checkout').set(auth).send({ product: 'single' });

    await request(app).post(`/board-games/checkout/${checkout.body.id}/confirm`).set(auth).send();
    const second = await request(app).post(`/board-games/checkout/${checkout.body.id}/confirm`).set(auth).send();

    expect(second.body.balance).toBe(1);
  });

  it('a failed payment grants nothing', async () => {
    const { auth } = await makePlayerSession();
    const checkout = await request(app).post('/board-games/checkout').set(auth).send({ product: 'single' });
    const fail = await request(app).post(`/board-games/checkout/${checkout.body.id}/fail`).set(auth).send();
    expect(fail.body.status).toBe('failed');

    const credits = await request(app).get('/board-games/credits').set(auth);
    expect(credits.body.balance).toBe(0);
  });

  it("refuses to confirm another player's payment", async () => {
    const owner = await makePlayerSession();
    const attacker = await makePlayerSession();
    const checkout = await request(app)
      .post('/board-games/checkout')
      .set(owner.auth)
      .send({ product: 'single' });

    const res = await request(app)
      .post(`/board-games/checkout/${checkout.body.id}/confirm`)
      .set(attacker.auth)
      .send();
    expect(res.status).toBe(404);

    const ownerCredits = await request(app).get('/board-games/credits').set(owner.auth);
    expect(ownerCredits.body.balance).toBe(0);
  });

  it('rejects an unknown product', async () => {
    const { auth } = await makePlayerSession();
    const res = await request(app).post('/board-games/checkout').set(auth).send({ product: 'triple' });
    expect(res.status).toBe(400);
  });
});

describe('POST /board-games/consume', () => {
  async function withOneCredit() {
    const session = await makePlayerSession();
    const checkout = await request(app)
      .post('/board-games/checkout')
      .set(session.auth)
      .send({ product: 'single' });
    await request(app).post(`/board-games/checkout/${checkout.body.id}/confirm`).set(session.auth).send();
    return session;
  }

  it('spends a credit and creates an active board game', async () => {
    const { auth } = await withOneCredit();
    const res = await request(app).post('/board-games/consume').set(auth).send({ boardGameId: 'board-1' });
    expect(res.status).toBe(200);
    expect(res.body.boardGame.status).toBe('active');
    expect(res.body.balance).toBe(0);
  });

  it('refuses with 402 when the balance is empty', async () => {
    const { auth } = await makePlayerSession();
    const res = await request(app).post('/board-games/consume').set(auth).send({ boardGameId: 'board-1' });
    expect(res.status).toBe(402);
  });

  it('is idempotent — replaying the same boardGameId (app restart / resume) spends nothing further', async () => {
    const { auth } = await withOneCredit();
    const first = await request(app).post('/board-games/consume').set(auth).send({ boardGameId: 'board-1' });
    const second = await request(app).post('/board-games/consume').set(auth).send({ boardGameId: 'board-1' });
    expect(first.body.balance).toBe(0);
    expect(second.status).toBe(200);
    expect(second.body.balance).toBe(0);
  });

  it('double-tapping "buy" then "start" still only ever spends one credit for one board', async () => {
    const { auth } = await withOneCredit();
    const [a, b] = await Promise.all([
      request(app).post('/board-games/consume').set(auth).send({ boardGameId: 'board-1' }),
      request(app).post('/board-games/consume').set(auth).send({ boardGameId: 'board-1' }),
    ]);
    // Both requests resolve successfully (idempotent), and the balance never goes negative.
    expect([a.body.balance, b.body.balance]).toEqual([0, 0]);
  });
});

describe('POST /board-games/:id/complete', () => {
  it('marks a board game completed', async () => {
    const session = await makePlayerSession();
    const checkout = await request(app)
      .post('/board-games/checkout')
      .set(session.auth)
      .send({ product: 'single' });
    await request(app).post(`/board-games/checkout/${checkout.body.id}/confirm`).set(session.auth).send();
    await request(app).post('/board-games/consume').set(session.auth).send({ boardGameId: 'board-1' });

    const res = await request(app).post('/board-games/board-1/complete').set(session.auth).send();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('returns 404 for a board game that does not belong to the caller', async () => {
    const owner = await withOneCreditFor();
    const attacker = await makePlayerSession();
    await request(app).post('/board-games/consume').set(owner.auth).send({ boardGameId: 'board-1' });

    const res = await request(app).post('/board-games/board-1/complete').set(attacker.auth).send();
    expect(res.status).toBe(404);
  });
});

async function withOneCreditFor() {
  const session = await makePlayerSession();
  const checkout = await request(app).post('/board-games/checkout').set(session.auth).send({ product: 'single' });
  await request(app).post(`/board-games/checkout/${checkout.body.id}/confirm`).set(session.auth).send();
  return session;
}
