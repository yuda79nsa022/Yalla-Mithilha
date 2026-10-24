import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-charades-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import {
  addTitlesToDeck,
  createDeck,
  getPlayerById,
  grantSignupBonus,
  resetDbForTests,
  setGamePriceFils,
  setModifiedGamePriceFils,
  updateDeck,
} from '../src/db';
import { makePlayerAuthHeader, makePlayerSession } from './helpers/testAuth';

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

describe('GET /charades/price', () => {
  it('is public — no auth required', async () => {
    const price = await request(app).get('/charades/price');
    expect(price.status).toBe(200);
    expect(price.body).toEqual({ fils: 1500, currency: 'KWD' });
  });
});

describe('GET /charades/home-content', () => {
  it('is public — no auth required — and returns the home screen copy', async () => {
    const res = await request(app).get('/charades/home-content');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      taglineAr: expect.any(String),
      taglineEn: expect.any(String),
      writeupAr: expect.any(String),
      writeupEn: expect.any(String),
    });
  });
});

describe('GET /charades/decks', () => {
  it('is public — no auth required', async () => {
    const res = await request(app).get('/charades/decks');
    expect(res.status).toBe(200);
  });

  it('lists every playable deck without exposing its titles', async () => {
    seedDeck(3);
    const res = await request(app).get('/charades/decks');
    expect(res.body).toEqual([
      { id: deckId, nameAr: 'مجموعة', nameEn: 'Test Deck', language: 'ar', difficulty: 'medium', titleCount: 3 },
    ]);
  });

  it('excludes a deck with no titles yet', async () => {
    createDeck({ id: 'empty-deck', nameAr: 'ج', nameEn: 'C' });
    const res = await request(app).get('/charades/decks');
    expect(res.body).toEqual([]);
  });

  it('includes imageUrl once a deck has a picture', async () => {
    seedDeck(1);
    updateDeck(deckId, { imagePath: '/title-images/cover.png' });
    const res = await request(app).get('/charades/decks');
    expect(res.body).toEqual([expect.objectContaining({ id: deckId, imageUrl: '/title-images/cover.png' })]);
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
    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });
    expect(res.status).toBe(402);
  });

  it('spends exactly one credit and deals up to 20 titles', async () => {
    seedDeck(25);
    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);

    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });
    expect(res.status).toBe(201);
    expect(res.body.session.titles).toHaveLength(20);
    expect(res.body.balance).toBe(0);
  });

  it('deals every title if the total pool has fewer than 20', async () => {
    seedDeck(4);
    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);
    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });
    expect(res.body.session.titles).toHaveLength(4);
  });

  it('pools titles across every playable deck, not just one', async () => {
    createDeck({ id: 'deck-a', nameAr: 'أ', nameEn: 'A' });
    addTitlesToDeck('deck-a', ['Alpha One', 'Alpha Two']);
    createDeck({ id: 'deck-b', nameAr: 'ب', nameEn: 'B' });
    addTitlesToDeck('deck-b', ['Beta One', 'Beta Two']);

    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);
    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });

    expect(res.body.session.titles).toHaveLength(4);
    const deckIds = new Set(res.body.session.titles.map((t: any) => t.deckId));
    expect(deckIds).toEqual(new Set(['deck-a', 'deck-b']));
    const texts = res.body.session.titles.map((t: any) => t.text);
    expect(new Set(texts).size).toBe(4); // no repeats
  });

  it('never deals two consecutive rounds from the same deck, while more than one deck still has titles', async () => {
    createDeck({ id: 'deck-a', nameAr: 'أ', nameEn: 'A' });
    addTitlesToDeck(
      'deck-a',
      Array.from({ length: 10 }, (_, i) => `A${i}`)
    );
    createDeck({ id: 'deck-b', nameAr: 'ب', nameEn: 'B' });
    addTitlesToDeck(
      'deck-b',
      Array.from({ length: 10 }, (_, i) => `B${i}`)
    );

    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);
    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });

    const deckIds = res.body.session.titles.map((t: any) => t.deckId);
    expect(deckIds).toHaveLength(20);
    for (let i = 1; i < deckIds.length; i++) {
      expect(deckIds[i]).not.toBe(deckIds[i - 1]);
    }
  });

  it('never deals the same title text twice, even when two decks share it', async () => {
    createDeck({ id: 'deck-a', nameAr: 'أ', nameEn: 'A' });
    addTitlesToDeck('deck-a', ['Shared Title']);
    createDeck({ id: 'deck-b', nameAr: 'ب', nameEn: 'B' });
    addTitlesToDeck('deck-b', ['Shared Title']);

    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);
    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });

    expect(res.body.session.titles).toHaveLength(1);
    expect(res.body.session.titles[0].text).toBe('Shared Title');
  });

  it('carries each title\'s own deck name, for the reveal screen', async () => {
    createDeck({ id: 'deck-a', nameAr: 'أفلام', nameEn: 'Movies' });
    addTitlesToDeck('deck-a', ['A Title']);

    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);
    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });

    expect(res.body.session.titles[0]).toMatchObject({
      text: 'A Title',
      deckId: 'deck-a',
      deckNameAr: 'أفلام',
      deckNameEn: 'Movies',
    });
  });

  it('is idempotent on the same sessionId — resuming never spends a second credit', async () => {
    seedDeck();
    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);
    await buyOneCredit(auth); // 2 credits available

    const first = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });
    const second = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });
    expect(second.body.session.titles).toEqual(first.body.session.titles);
    expect(second.body.balance).toBe(1); // only the first call spent a credit
  });

  it('refuses to deal when no deck has any titles at all', async () => {
    createDeck({ id: 'empty-deck', nameAr: 'فارغة', nameEn: 'Empty' });
    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);
    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });
    expect(res.status).toBe(409);
  });

  it('a second player can never fetch someone else\'s session', async () => {
    seedDeck();
    const a = await makePlayerSession();
    const b = await makePlayerSession();
    await buyOneCredit(a.auth);
    await request(app).post('/charades/sessions').set(a.auth).send({ sessionId: 'shared-id' });

    const asB = await request(app).post('/charades/sessions').set(b.auth).send({ sessionId: 'shared-id' });
    expect(asB.status).toBe(404);
  });

  describe('player-chosen decks', () => {
    it('defaults to every playable deck when deckIds is omitted', async () => {
      createDeck({ id: 'ar-deck', nameAr: 'أ', nameEn: 'A', language: 'ar' });
      addTitlesToDeck('ar-deck', ['Arabic Title']);
      createDeck({ id: 'en-deck', nameAr: 'ب', nameEn: 'B', language: 'en' });
      addTitlesToDeck('en-deck', ['English Title']);

      const { auth } = await makePlayerSession();
      await buyOneCredit(auth);
      const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });

      const dealtDeckIds = res.body.session.titles.map((t: { deckId: string }) => t.deckId).sort();
      expect(dealtDeckIds).toEqual(['ar-deck', 'en-deck']);
    });

    it('deals only from decks named in deckIds', async () => {
      createDeck({ id: 'ar-deck', nameAr: 'أ', nameEn: 'A', language: 'ar' });
      addTitlesToDeck('ar-deck', ['Arabic Title']);
      createDeck({ id: 'en-deck', nameAr: 'ب', nameEn: 'B', language: 'en' });
      addTitlesToDeck('en-deck', ['English Title']);

      const { auth } = await makePlayerSession();
      await buyOneCredit(auth);
      const res = await request(app)
        .post('/charades/sessions')
        .set(auth)
        .send({ sessionId: 's1', deckIds: ['en-deck'] });

      expect(res.body.session.titles).toEqual([expect.objectContaining({ deckId: 'en-deck' })]);
    });

    it('deals from every deckId named, when more than one is chosen', async () => {
      createDeck({ id: 'ar-deck', nameAr: 'أ', nameEn: 'A', language: 'ar' });
      addTitlesToDeck('ar-deck', ['Arabic Title']);
      createDeck({ id: 'en-deck', nameAr: 'ب', nameEn: 'B', language: 'en' });
      addTitlesToDeck('en-deck', ['English Title']);

      const { auth } = await makePlayerSession();
      await buyOneCredit(auth);
      const res = await request(app)
        .post('/charades/sessions')
        .set(auth)
        .send({ sessionId: 's1', deckIds: ['ar-deck', 'en-deck'] });

      const dealtDeckIds = res.body.session.titles.map((t: { deckId: string }) => t.deckId).sort();
      expect(dealtDeckIds).toEqual(['ar-deck', 'en-deck']);
    });

    it('rejects an empty deckIds array', async () => {
      seedDeck();
      const { auth } = await makePlayerSession();
      await buyOneCredit(auth);
      const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', deckIds: [] });
      expect(res.status).toBe(400);
    });

    it('rejects a deckIds value that is not an array of strings', async () => {
      seedDeck();
      const { auth } = await makePlayerSession();
      await buyOneCredit(auth);
      const res = await request(app)
        .post('/charades/sessions')
        .set(auth)
        .send({ sessionId: 's1', deckIds: 'ar-deck' });
      expect(res.status).toBe(400);
    });

    it('refuses to deal when the chosen deck has no titles', async () => {
      createDeck({ id: 'en-deck', nameAr: 'ب', nameEn: 'B', language: 'en' });
      addTitlesToDeck('en-deck', ['English Title']);
      createDeck({ id: 'empty-deck', nameAr: 'ج', nameEn: 'C', language: 'ar' });

      const { auth } = await makePlayerSession();
      await buyOneCredit(auth);
      const res = await request(app)
        .post('/charades/sessions')
        .set(auth)
        .send({ sessionId: 's1', deckIds: ['empty-deck'] });
      expect(res.status).toBe(409);
    });
  });
});

describe('GET /charades/sessions/:id', () => {
  it('returns a previously dealt session, owner only', async () => {
    seedDeck();
    const a = await makePlayerSession();
    const b = await makePlayerSession();
    await buyOneCredit(a.auth);
    const started = await request(app).post('/charades/sessions').set(a.auth).send({ sessionId: 's1' });

    const fetched = await request(app).get('/charades/sessions/s1').set(a.auth);
    expect(fetched.body.titles).toEqual(started.body.session.titles);

    const asB = await request(app).get('/charades/sessions/s1').set(b.auth);
    expect(asB.status).toBe(404);
  });
});

describe('the modified game mode', () => {
  it('GET /charades/price defaults to classic and switches on ?mode=modified', async () => {
    setModifiedGamePriceFils(2500);
    const classic = await request(app).get('/charades/price');
    expect(classic.body).toEqual({ fils: 1500, currency: 'KWD' });

    const modified = await request(app).get('/charades/price?mode=modified');
    expect(modified.body).toEqual({ fils: 2500, currency: 'KWD' });

    // An unrecognised mode value falls back to classic rather than erroring.
    const bogus = await request(app).get('/charades/price?mode=bogus');
    expect(bogus.body).toEqual({ fils: 1500, currency: 'KWD' });
  });

  it('POST /charades/checkout charges the price of the requested mode', async () => {
    setModifiedGamePriceFils(2500);
    const { auth } = await makePlayerSession();
    const checkout = await request(app).post('/charades/checkout').set(auth).send({ mode: 'modified' });
    expect(checkout.body.amountFils).toBe(2500);
  });

  it('POST /charades/sessions deals three difficulty stacks instead of a flat title list', async () => {
    seedDeck(12);
    const { auth } = await makePlayerSession();
    await buyOneCredit(auth);

    const res = await request(app)
      .post('/charades/sessions')
      .set(auth)
      .send({ sessionId: 'mod-1', mode: 'modified' });
    expect(res.status).toBe(201);
    expect(res.body.session.mode).toBe('modified');
    expect(typeof res.body.session.rounds).toBe('number');
    expect(res.body.session.stacks).toEqual(
      expect.objectContaining({ easy: expect.any(Array), medium: expect.any(Array), hard: expect.any(Array) })
    );
    // Every dealt title carries the difficulty level its own stack represents.
    for (const level of ['easy', 'medium', 'hard'] as const) {
      for (const title of res.body.session.stacks[level]) {
        expect(title.difficulty).toBe(level);
      }
    }
  });

  it('a classic session spends a free signup game before touching the paid wallet', async () => {
    seedDeck(4);
    const { auth, player } = await makePlayerSession();
    grantSignupBonus(player.id);
    expect(getPlayerById(player.id)?.freeGameCredits).toBe(2);

    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', mode: 'classic' });
    expect(res.status).toBe(201);
    expect(res.body.balance).toBe(0); // the paid wallet was never touched
    expect(getPlayerById(player.id)?.freeGameCredits).toBe(1);
  });

  it('a modified session spends a free signup game too, without needing a paid credit', async () => {
    seedDeck(4);
    const { auth, player } = await makePlayerSession();
    grantSignupBonus(player.id);

    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', mode: 'modified' });
    expect(res.status).toBe(201);
    expect(res.body.balance).toBe(0);
    expect(getPlayerById(player.id)?.freeGameCredits).toBe(1);
  });

  it('the two free games can be one classic and one modified, then a paid credit is required', async () => {
    seedDeck(8);
    const { auth, player } = await makePlayerSession();
    grantSignupBonus(player.id);

    const classic = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', mode: 'classic' });
    expect(classic.status).toBe(201);
    const modified = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's2', mode: 'modified' });
    expect(modified.status).toBe(201);
    expect(getPlayerById(player.id)?.freeGameCredits).toBe(0);

    const third = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's3', mode: 'modified' });
    expect(third.status).toBe(402);
    expect(getPlayerById(player.id)?.freeGameCredits).toBe(0); // never goes negative

    await buyOneCredit(auth);
    const paid = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's3', mode: 'modified' });
    expect(paid.status).toBe(201);
    expect(paid.body.balance).toBe(0); // the paid credit paid for it
  });

  it('resuming an already-started session never spends a second free game', async () => {
    seedDeck(4);
    const { auth, player } = await makePlayerSession();
    grantSignupBonus(player.id);

    await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', mode: 'modified' });
    const again = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', mode: 'modified' });
    expect(again.status).toBeLessThan(300);
    expect(getPlayerById(player.id)?.freeGameCredits).toBe(1);
  });

  it('GET /charades/wallet reports the free signup games separately from the paid balance', async () => {
    const { auth, player } = await makePlayerSession();
    grantSignupBonus(player.id);
    const wallet = await request(app).get('/charades/wallet').set(auth);
    expect(wallet.body).toEqual({ balance: 0, freeGameCredits: 2 });
  });
});

describe('GET /charades/usage', () => {
  it('requires a player session', async () => {
    expect((await request(app).get('/charades/usage')).status).toBe(401);
  });

  it('reports games and top-ups for the signed-in player only', async () => {
    seedDeck();
    const auth = await makePlayerAuthHeader();
    const other = await makePlayerAuthHeader();
    await buyOneCredit(auth);
    await buyOneCredit(other);
    await request(app)
      .post('/charades/sessions')
      .set(auth)
      .send({ sessionId: 'usage-lite', deckIds: [deckId], mode: 'classic', difficulty: 'mixed' });

    const res = await request(app).get('/charades/usage').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({ gamesPlayed: 1, liteGames: 1, proGames: 0, gamesBought: 1, spentFils: 1500, currency: 'KWD' });
    expect(res.body.games).toHaveLength(1);
    expect(res.body.games[0]).toMatchObject({ id: 'usage-lite', mode: 'classic' });
    expect(res.body.games[0].titles).toBeUndefined();
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0]).toMatchObject({ credits: 1, amountFils: 1500, status: 'paid' });
  });
});
