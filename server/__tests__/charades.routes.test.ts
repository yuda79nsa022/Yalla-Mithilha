import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-charades-${Date.now()}-${Math.random()}.sqlite`);
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

const deckId = 'test-deck';

function seedDeck(titleCount = 12) {
  createDeck({ id: deckId, nameAr: 'مجموعة', nameEn: 'Test Deck' });
  addTitlesToDeck(
    deckId,
    Array.from({ length: titleCount }, (_, i) => `Title ${i}`)
  );
}

async function buyOneCredit(auth: { Authorization: string }) {
  const checkout = await request(app).post('/charades/checkout').set(auth);
  await request(app).post(`/charades/checkout/${checkout.body.id}/confirm`).set(auth);
}

describe('GET /charades/decks and /charades/price', () => {
  it('are public — no auth required', async () => {
    seedDeck();
    const decks = await request(app).get('/charades/decks');
    expect(decks.status).toBe(200);
    expect(decks.body).toEqual([{ id: deckId, nameAr: 'مجموعة', nameEn: 'Test Deck', titleCount: 12 }]);

    const price = await request(app).get('/charades/price');
    expect(price.body).toEqual({ fils: 1500, currency: 'KWD' });
  });

  it('excludes a deck with no titles', async () => {
    createDeck({ id: 'empty-deck', nameAr: 'فارغة', nameEn: 'Empty' });
    const decks = await request(app).get('/charades/decks');
    expect(decks.body).toEqual([]);
  });
});

describe('wallet', () => {
  it('requires a player session', async () => {
    expect((await request(app).get('/charades/wallet')).status).toBe(401);
  });

  it('starts at zero and increases once a checkout is confirmed', async () => {
    const { auth } = await makePlayerSession();
    expect((await request(app).get('/charades/wallet').set(auth)).body.balance).toBe(0);

    await buyOneCredit(auth);
    expect((await request(app).get('/charades/wallet').set(auth)).body.balance).toBe(1);
  });

  it('charges the price in effect at checkout time, not later', async () => {
    const { auth } = await makePlayerSession();
    const checkout = await request(app).post('/charades/checkout').set(auth);
    expect(checkout.body.amountFils).toBe(1500);

    setGamePriceFils(3000); // admin changes the price after checkout started
    await request(app).post(`/charades/checkout/${checkout.body.id}/confirm`).set(auth);
    expect((await request(app).get('/charades/wallet').set(auth)).body.balance).toBe(1);
  });

  it('a failed checkout never grants a credit', async () => {
    const { auth } = await makePlayerSession();
    const checkout = await request(app).post('/charades/checkout').set(auth);
    await request(app).post(`/charades/checkout/${checkout.body.id}/fail`).set(auth);
    expect((await request(app).get('/charades/wallet').set(auth)).body.balance).toBe(0);
  });

  it('confirming twice never double-grants (idempotent)', async () => {
    const { auth } = await makePlayerSession();
    const checkout = await request(app).post('/charades/checkout').set(auth);
    await request(app).post(`/charades/checkout/${checkout.body.id}/confirm`).set(auth);
    await request(app).post(`/charades/checkout/${checkout.body.id}/confirm`).set(auth);
    expect((await request(app).get('/charades/wallet').set(auth)).body.balance).toBe(1);
  });

  it('one player can never confirm or fail another player\'s payment', async () => {
    const a = await makePlayerSession();
    const b = await makePlayerSession();
    const checkout = await request(app).post('/charades/checkout').set(a.auth);

    const confirmAsB = await request(app).post(`/charades/checkout/${checkout.body.id}/confirm`).set(b.auth);
    expect(confirmAsB.status).toBe(404);
    const failAsB = await request(app).post(`/charades/checkout/${checkout.body.id}/fail`).set(b.auth);
    expect(failAsB.status).toBe(404);
  });
});

describe('POST /charades/sessions', () => {
  it('requires enough balance', async () => {
    seedDeck();
    const { auth } = await makePlayerSession();
    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', deckId });
    expect(res.status).toBe(402);
  });

  it('spends exactly one credit and deals up to 20 titles', async () => {
    seedDeck(25);
    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);

    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', deckId });
    expect(res.status).toBe(201);
    expect(res.body.session.titles).toHaveLength(20);
    expect(res.body.balance).toBe(0);
  });

  it('deals every title if the deck has fewer than 20', async () => {
    seedDeck(4);
    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);
    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', deckId });
    expect(res.body.session.titles).toHaveLength(4);
  });

  it('is idempotent on the same sessionId — resuming never spends a second credit', async () => {
    seedDeck();
    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);
    await buyOneCredit(auth); // 2 credits available

    const first = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', deckId });
    const second = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', deckId });
    expect(second.body.session.titles).toEqual(first.body.session.titles);
    expect(second.body.balance).toBe(1); // only the first call spent a credit
  });

  it('refuses to deal from an empty deck', async () => {
    createDeck({ id: 'empty-deck', nameAr: 'فارغة', nameEn: 'Empty' });
    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);
    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', deckId: 'empty-deck' });
    expect(res.status).toBe(409);
  });

  it('a second player can never fetch someone else\'s session', async () => {
    seedDeck();
    const a = await makePlayerSession();
    const b = await makePlayerSession();
    await buyOneCredit(a.auth);
    await request(app).post('/charades/sessions').set(a.auth).send({ sessionId: 'shared-id', deckId });

    const asB = await request(app).post('/charades/sessions').set(b.auth).send({ sessionId: 'shared-id', deckId });
    expect(asB.status).toBe(404);
  });
});

describe('GET /charades/sessions/:id', () => {
  it('returns a previously dealt session, owner only', async () => {
    seedDeck();
    const a = await makePlayerSession();
    const b = await makePlayerSession();
    await buyOneCredit(a.auth);
    const started = await request(app).post('/charades/sessions').set(a.auth).send({ sessionId: 's1', deckId });

    const fetched = await request(app).get('/charades/sessions/s1').set(a.auth);
    expect(fetched.body.titles).toEqual(started.body.session.titles);

    const asB = await request(app).get('/charades/sessions/s1').set(b.auth);
    expect(asB.status).toBe(404);
  });
});
