import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-reveal-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { addTitlesToDeck, createDeck, resetDbForTests, setGamePriceFils } from '../src/db';
import { makePlayerSession } from './helpers/testAuth';

const app = createApp();

beforeEach(() => {
  resetDbForTests();
  setGamePriceFils(1500);
});

async function buyOneCredit(auth: { Authorization: string }) {
  const checkout = await request(app).post('/charades/checkout').set(auth);
  await request(app).post(`/charades/checkout/${checkout.body.id}/confirm`).set(auth);
}

async function startSession(auth: { Authorization: string }, sessionId = 's1') {
  createDeck({ id: 'deck-a', nameAr: 'أ', nameEn: 'A' });
  addTitlesToDeck('deck-a', ['Alpha One', 'Alpha Two']);
  await buyOneCredit(auth);
  const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId });
  return res.body.session as { id: string };
}

describe('POST /charades/reveal-tokens', () => {
  it('requires a player session', async () => {
    const res = await request(app)
      .post('/charades/reveal-tokens')
      .send({ sessionId: 's1', title: 'Spartacus', categoryAr: 'أفلام', categoryEn: 'Movies' });
    expect(res.status).toBe(401);
  });

  it('mints a token for a session the player owns', async () => {
    const { auth } = await makePlayerSession();
    const session = await startSession(auth);

    const res = await request(app)
      .post('/charades/reveal-tokens')
      .set(auth)
      .send({ sessionId: session.id, title: 'Spartacus', categoryAr: 'أفلام', categoryEn: 'Movies' });
    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('string');
  });

  it('rejects a session that belongs to someone else', async () => {
    const { auth: ownerAuth } = await makePlayerSession();
    const session = await startSession(ownerAuth);
    const { auth: otherAuth } = await makePlayerSession();

    const res = await request(app)
      .post('/charades/reveal-tokens')
      .set(otherAuth)
      .send({ sessionId: session.id, title: 'Spartacus', categoryAr: 'أفلام', categoryEn: 'Movies' });
    expect(res.status).toBe(404);
  });

  it('rejects a missing title with 400', async () => {
    const { auth } = await makePlayerSession();
    const session = await startSession(auth);

    const res = await request(app)
      .post('/charades/reveal-tokens')
      .set(auth)
      .send({ sessionId: session.id, categoryAr: 'أفلام', categoryEn: 'Movies' });
    expect(res.status).toBe(400);
  });
});

describe('GET /reveal-tokens/:id', () => {
  async function mintToken(auth: { Authorization: string }) {
    const session = await startSession(auth);
    const mint = await request(app)
      .post('/charades/reveal-tokens')
      .set(auth)
      .send({
        sessionId: session.id,
        title: 'Spartacus',
        categoryAr: 'أفلام',
        categoryEn: 'Movies',
        imageUrl: 'https://example.test/spartacus.png',
      });
    return mint.body.id as string;
  }

  it('is public — no auth required', async () => {
    const { auth } = await makePlayerSession();
    const id = await mintToken(auth);

    const res = await request(app).get(`/reveal-tokens/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ t: 'Spartacus', ca: 'أفلام', ce: 'Movies', img: 'https://example.test/spartacus.png' });
  });

  it('can only ever be claimed once — a second scan of the same link gets 410', async () => {
    const { auth } = await makePlayerSession();
    const id = await mintToken(auth);

    const first = await request(app).get(`/reveal-tokens/${id}`);
    expect(first.status).toBe(200);

    const second = await request(app).get(`/reveal-tokens/${id}`);
    expect(second.status).toBe(410);
  });

  it('rejects an unknown token with 404', async () => {
    const res = await request(app).get('/reveal-tokens/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('sets Access-Control-Allow-Origin, since a phone camera scan is always cross-origin', async () => {
    const { auth } = await makePlayerSession();
    const id = await mintToken(auth);

    const res = await request(app).get(`/reveal-tokens/${id}`);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
