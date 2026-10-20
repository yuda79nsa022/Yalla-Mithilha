import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-rules-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { addTitlesToDeck, createDeck, grantCredits, grantSignupBonus, resetDbForTests, setGamePriceFils, updatePlayer } from '../src/db';
import { lowBalanceEmail } from '../src/notifications/lowBalance';
import { setEmailProviderForTests, type EmailMessage } from '../src/notifications/email';
import { effectiveDifficulty } from '../src/types';
import { makePlayerSession } from './helpers/testAuth';

const app = createApp();
let sent: EmailMessage[] = [];

beforeEach(() => {
  resetDbForTests();
  setGamePriceFils(1500);
  sent = [];
  setEmailProviderForTests({ name: 'capture', send: async (m) => void sent.push(m) });
});

afterAll(() => setEmailProviderForTests(null));

/** Lets the fire-and-forget email after a response actually run. */
const flush = () => new Promise((r) => setTimeout(r, 20));

describe('effectiveDifficulty', () => {
  it('tiers an untagged title by length on a medium deck', () => {
    expect(effectiveDifficulty('medium', { text: 'Title', difficulty: null })).toBe('easy');
    expect(effectiveDifficulty('medium', { text: 'Two words', difficulty: null })).toBe('medium');
    expect(effectiveDifficulty('medium', { text: 'Three word title', difficulty: null })).toBe('medium');
    expect(effectiveDifficulty('medium', { text: 'A four word title', difficulty: null })).toBe('hard');
  });

  it('shifts by the deck level, clamped at both ends', () => {
    expect(effectiveDifficulty('easy', { text: 'Two words', difficulty: null })).toBe('easy');
    expect(effectiveDifficulty('easy', { text: 'Title', difficulty: null })).toBe('easy');
    expect(effectiveDifficulty('hard', { text: 'Title', difficulty: null })).toBe('medium');
    expect(effectiveDifficulty('hard', { text: 'A four word title', difficulty: null })).toBe('hard');
  });

  it("lets a title's own level win", () => {
    expect(effectiveDifficulty('medium', { text: 'A four word title', difficulty: 'easy' })).toBe('easy');
  });
});

function seedMixedDeck() {
  createDeck({ id: 'mixed', nameAr: 'مجموعة', nameEn: 'Mixed' });
  addTitlesToDeck('mixed', [
    ...Array.from({ length: 10 }, (_, i) => `Easy${i}`),
    ...Array.from({ length: 10 }, (_, i) => `Medium ${i}`),
    ...Array.from({ length: 10 }, (_, i) => `Hard one two ${i}`),
  ]);
}

describe('modified mode', () => {
  it('deals every level from a deck nobody tagged', async () => {
    seedMixedDeck();
    const { auth, player } = await makePlayerSession();
    grantCredits(player.id, 1);
    const res = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 'm1', mode: 'modified' });
    expect(res.status).toBe(201);
    expect(res.body.session.stacks.easy).toHaveLength(10);
    expect(res.body.session.stacks.medium).toHaveLength(10);
    expect(res.body.session.stacks.hard).toHaveLength(10);
  });
});

describe('classic mode difficulty', () => {
  it('deals the chosen level first, topping up from the nearest level', async () => {
    seedMixedDeck();
    const { auth, player } = await makePlayerSession();
    grantCredits(player.id, 1);
    const res = await request(app)
      .post('/charades/sessions')
      .set(auth)
      .send({ sessionId: 'c1', mode: 'classic', difficulty: 'hard' });
    expect(res.status).toBe(201);
    const texts: string[] = res.body.session.titles.map((t: { text: string }) => t.text);
    expect(texts).toHaveLength(20);
    expect(texts.slice(0, 10).every((t) => t.startsWith('Hard'))).toBe(true);
    expect(texts.slice(10).every((t) => t.startsWith('Medium'))).toBe(true);
  });

  it('rejects an unknown difficulty', async () => {
    seedMixedDeck();
    const { auth, player } = await makePlayerSession();
    grantCredits(player.id, 1);
    const res = await request(app)
      .post('/charades/sessions')
      .set(auth)
      .send({ sessionId: 'c1', mode: 'classic', difficulty: 'extreme' });
    expect(res.status).toBe(400);
  });
});

describe('low-balance email', () => {
  it('emails once when games left drop below 2, and again only after a top-up re-arms it', async () => {
    seedMixedDeck();
    const { auth, player } = await makePlayerSession();
    updatePlayer(player.id, { email: 'p@example.com' });
    grantSignupBonus(player.id); // 2 free games

    await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('p@example.com');
    expect(sent[0].text).toContain('1 game left');

    await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's2' });
    await flush();
    expect(sent).toHaveLength(1); // same dip — not emailed again

    grantCredits(player.id, 2); // back to 2 — re-armed
    await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's3' });
    await flush();
    expect(sent).toHaveLength(2);
  });

  it('never emails a player with no email on file', async () => {
    seedMixedDeck();
    const { auth, player } = await makePlayerSession();
    grantCredits(player.id, 1);
    await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });
    await flush();
    expect(sent).toHaveLength(0);
  });

  it('retries on the next game when sending failed', async () => {
    seedMixedDeck();
    const { auth, player } = await makePlayerSession();
    updatePlayer(player.id, { email: 'p@example.com' });
    grantCredits(player.id, 2);
    setEmailProviderForTests({ name: 'down', send: async () => { throw new Error('down'); } });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1' });
    await flush();
    errorSpy.mockRestore();
    setEmailProviderForTests({ name: 'capture', send: async (m) => void sent.push(m) });
    await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's2' });
    await flush();
    expect(sent).toHaveLength(1);
  });

  it('escapes the username in the HTML body', () => {
    const msg = lowBalanceEmail({ to: 'x@example.com', username: '<b>x</b>', gamesLeft: 0, buyUrl: 'https://example.com/buy' });
    expect(msg.html).not.toContain('<b>x</b>');
    expect(msg.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(msg.html).toContain('https://example.com/buy');
  });
});

describe('POST /players/session/refresh', () => {
  it('swaps a valid token for a fresh one', async () => {
    const { auth, player } = await makePlayerSession();
    const res = await request(app).post('/players/session/refresh').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.player).toEqual({ id: player.id, username: player.username });
    const wallet = await request(app).get('/charades/wallet').set({ Authorization: `Bearer ${res.body.token}` });
    expect(wallet.status).toBe(200);
  });

  it('refuses a missing or forged token', async () => {
    expect((await request(app).post('/players/session/refresh')).status).toBe(401);
    expect((await request(app).post('/players/session/refresh').set({ Authorization: 'Bearer nope' })).status).toBe(401);
  });

  it('refuses a token from before a password change', async () => {
    const { auth, player } = await makePlayerSession();
    updatePlayer(player.id, { passwordHash: 'changed' });
    expect((await request(app).post('/players/session/refresh').set(auth)).status).toBe(401);
  });
});
