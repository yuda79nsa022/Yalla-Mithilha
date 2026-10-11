import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-difficulty-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import ExcelJS from 'exceljs';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  addTitlesToDeck,
  createDeck,
  getDeck,
  getGameSession,
  grantCredits,
  resetDbForTests,
  startGameSession,
  updateDeck,
  updateTitle,
} from '../src/db';
import { parseDifficultyCell, parseTitleImageManifestXlsx, parseXlsxTitles } from '../src/import/parseTitles';
import { effectiveDifficulty } from '../src/types';
import { makeAdminAuthHeader, makePlayerSession } from './helpers/testAuth';

const app = createApp();

beforeEach(() => {
  resetDbForTests();
});

async function xlsx(rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Titles');
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('effectiveDifficulty', () => {
  it("uses the deck's default for a short title", () => {
    expect(effectiveDifficulty('easy', { text: 'Window', difficulty: null })).toBe('easy');
    expect(effectiveDifficulty('hard', { text: 'الكبير أوي', difficulty: null })).toBe('hard');
  });

  it('bumps a title over four words one level up, but never past hard', () => {
    const long = { text: 'يا حبيبي لا تقول لي ولا أقولك', difficulty: null };
    expect(effectiveDifficulty('easy', long)).toBe('medium');
    expect(effectiveDifficulty('medium', long)).toBe('hard');
    expect(effectiveDifficulty('hard', long)).toBe('hard');
    expect(effectiveDifficulty('easy', { text: 'one two three four', difficulty: null })).toBe('easy');
  });

  it("a title's own override beats both the deck default and the length bump", () => {
    expect(effectiveDifficulty('hard', { text: 'one two three four five six', difficulty: 'easy' })).toBe('easy');
  });
});

describe('deck and title difficulty', () => {
  it('defaults a new deck to medium and a new title to no override', () => {
    const deck = createDeck({ id: 'd', nameAr: 'أ', nameEn: 'A' });
    expect(deck.difficulty).toBe('medium');
    addTitlesToDeck('d', ['Plain']);
    expect(getDeck('d')!.titles[0].difficulty).toBeNull();
  });

  it('stores a deck default, a per-title override on import, and clears an override', () => {
    createDeck({ id: 'd', nameAr: 'أ', nameEn: 'A', difficulty: 'easy' });
    addTitlesToDeck('d', ['Plain', { text: 'Tough', difficulty: 'hard' }]);
    const deck = getDeck('d')!;
    expect(deck.difficulty).toBe('easy');
    const tough = deck.titles.find((t) => t.text === 'Tough')!;
    expect(tough.difficulty).toBe('hard');
    expect(updateTitle('d', tough.id, { difficulty: null }).difficulty).toBeNull();
    expect(updateDeck('d', { difficulty: 'hard' }).difficulty).toBe('hard');
  });
});

describe('dealing into three stacks', () => {
  function seedThreeDecks() {
    createDeck({ id: 'words', nameAr: 'كلمات', nameEn: 'Words', difficulty: 'easy' });
    addTitlesToDeck('words', Array.from({ length: 25 }, (_, i) => `Word ${i}`));
    createDeck({ id: 'series', nameAr: 'مسلسلات', nameEn: 'Series', difficulty: 'medium' });
    addTitlesToDeck('series', Array.from({ length: 5 }, (_, i) => `Series ${i}`));
    createDeck({ id: 'plays', nameAr: 'مسرحيات', nameEn: 'Plays', difficulty: 'hard' });
    addTitlesToDeck('plays', ['Play A', 'Play B']);
  }

  it('fills each stack from the decks at that level, up to the round count', async () => {
    seedThreeDecks();
    const { player } = await makePlayerSession();
    grantCredits(player.id, 1);
    const { session } = startGameSession(player.id, 's1');
    expect(session.rounds).toBe(20);
    expect(session.stacks.easy).toHaveLength(20);
    expect(session.stacks.medium).toHaveLength(5);
    expect(session.stacks.hard).toHaveLength(2);
    expect(session.stacks.easy.every((t) => t.deckId === 'words' && t.difficulty === 'easy')).toBe(true);
    expect(session.stacks.hard.map((t) => t.text).sort()).toEqual(['Play A', 'Play B']);
    expect(session.titles).toHaveLength(27);
  });

  it('routes a long title and an overridden title to their effective level', async () => {
    createDeck({ id: 'words', nameAr: 'كلمات', nameEn: 'Words', difficulty: 'easy' });
    addTitlesToDeck('words', ['Short', 'This title has five words', { text: 'Forced', difficulty: 'hard' }]);
    const { player } = await makePlayerSession();
    grantCredits(player.id, 1);
    const { session } = startGameSession(player.id, 's1');
    expect(session.stacks.easy.map((t) => t.text)).toEqual(['Short']);
    expect(session.stacks.medium.map((t) => t.text)).toEqual(['This title has five words']);
    expect(session.stacks.hard.map((t) => t.text)).toEqual(['Forced']);
  });

  it('shortens the game to what was dealt when every level combined has fewer titles than rounds', async () => {
    createDeck({ id: 'words', nameAr: 'كلمات', nameEn: 'Words', difficulty: 'easy' });
    addTitlesToDeck('words', ['A', 'B', 'C']);
    const { player } = await makePlayerSession();
    grantCredits(player.id, 1);
    const { session } = startGameSession(player.id, 's1');
    expect(session.rounds).toBe(3);
  });

  it('never deals the same text twice even when it sits in decks at two levels', async () => {
    createDeck({ id: 'a', nameAr: 'أ', nameEn: 'A', difficulty: 'easy' });
    addTitlesToDeck('a', ['Shared']);
    createDeck({ id: 'b', nameAr: 'ب', nameEn: 'B', difficulty: 'hard' });
    addTitlesToDeck('b', ['Shared', 'Other']);
    const { player } = await makePlayerSession();
    grantCredits(player.id, 1);
    const { session } = startGameSession(player.id, 's1');
    expect(session.titles.filter((t) => t.text === 'Shared')).toHaveLength(1);
    expect(session.titles).toHaveLength(2);
  });

  it('returns rounds and stacks over the API, and the same deal on replay', async () => {
    seedThreeDecks();
    const { auth } = await makePlayerSession();
    const checkout = await request(app).post('/charades/checkout').set(auth);
    await request(app).post(`/charades/checkout/${checkout.body.id}/confirm`).set(auth);
    const first = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', deckIds: ['words', 'plays'] });
    expect(first.status).toBe(201);
    expect(first.body.session.rounds).toBe(20);
    expect(first.body.session.stacks.medium).toEqual([]);
    expect(first.body.session.stacks.hard).toHaveLength(2);
    const again = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', deckIds: ['series'] });
    expect(again.body.session.stacks).toEqual(first.body.session.stacks);
    const fetched = await request(app).get('/charades/sessions/s1').set(auth);
    expect(fetched.body.stacks).toEqual(first.body.session.stacks);
  });

  it('reads a session dealt before levels existed back as one medium stack', async () => {
    createDeck({ id: 'd', nameAr: 'أ', nameEn: 'A' });
    const { player } = await makePlayerSession();
    const legacy = [
      { id: 't1', text: 'Old One', deckId: 'd', deckNameAr: 'أ', deckNameEn: 'A' },
      { id: 't2', text: 'Old Two', deckId: 'd', deckNameAr: 'أ', deckNameEn: 'A' },
    ];
    // Written straight into the table the way the old code did — a flat array, no rounds/stacks.
    const { db } = await import('../src/db');
    db.prepare(
      'INSERT INTO game_sessions (id, player_id, deck_id, titles_json, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('legacy', player.id, 'd', JSON.stringify(legacy), Date.now());
    const session = getGameSession('legacy')!;
    expect(session.rounds).toBe(2);
    expect(session.stacks.easy).toEqual([]);
    expect(session.stacks.hard).toEqual([]);
    expect(session.stacks.medium.map((t) => t.text)).toEqual(['Old One', 'Old Two']);
    expect(session.stacks.medium[0].difficulty).toBe('medium');
    expect(session.titles).toHaveLength(2);
  });
});

describe('difficulty in import files', () => {
  it('recognises the level words in both languages, any case', () => {
    expect(parseDifficultyCell('Easy')).toBe('easy');
    expect(parseDifficultyCell(' صعب ')).toBe('hard');
    expect(parseDifficultyCell('متوسطة')).toBe('medium');
    expect(parseDifficultyCell('Window')).toBeUndefined();
  });

  it('takes a difficulty column out of a plain title list as the override, never as the title', async () => {
    const buffer = await xlsx([
      ['Window', 'easy'],
      ['The Lord of the Rings', 'hard'],
      ['Plain'],
      ['Lo', 'hard'],
    ]);
    const parsed = await parseXlsxTitles(buffer);
    expect(parsed).toEqual([
      { text: 'Window', difficulty: 'easy' },
      { text: 'The Lord of the Rings', difficulty: 'hard' },
      { text: 'Plain' },
      { text: 'Lo', difficulty: 'hard' },
    ]);
  });

  it('reads an optional third column from the image manifest', async () => {
    const buffer = await xlsx([
      ['title', 'image', 'difficulty'],
      ['Camel', 'camel.png', 'سهل'],
      ['Falcon', 'falcon.png'],
    ]);
    expect(await parseTitleImageManifestXlsx(buffer)).toEqual([
      { text: 'Camel', imageFilename: 'camel.png', difficulty: 'easy' },
      { text: 'Falcon', imageFilename: 'falcon.png' },
    ]);
  });

  it('stores the override from a plain import through the admin route', async () => {
    const auth = await makeAdminAuthHeader();
    createDeck({ id: 'd', nameAr: 'أ', nameEn: 'A', difficulty: 'easy' });
    const buffer = await xlsx([['Window', 'easy'], ['Something Tough', 'hard']]);
    const res = await request(app).post('/admin/decks/d/import').set(auth).attach('file', buffer, 'titles.xlsx');
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(2);
    const titles = getDeck('d')!.titles;
    expect(titles.find((t) => t.text === 'Something Tough')!.difficulty).toBe('hard');
    expect(titles.find((t) => t.text === 'Window')!.difficulty).toBe('easy');
  });
});

describe('admin deck routes', () => {
  it('accepts a difficulty on create and update, and rejects a bad one', async () => {
    const auth = await makeAdminAuthHeader();
    const created = await request(app)
      .post('/admin/decks')
      .set(auth)
      .send({ id: 'd', nameAr: 'أ', nameEn: 'A', difficulty: 'hard' });
    expect(created.status).toBe(201);
    expect(created.body.difficulty).toBe('hard');

    const updated = await request(app).put('/admin/decks/d').set(auth).send({ difficulty: 'easy' });
    expect(updated.body.difficulty).toBe('easy');

    const bad = await request(app).put('/admin/decks/d').set(auth).send({ difficulty: 'brutal' });
    expect(bad.status).toBe(400);
  });

  it('sets and clears a per-title override', async () => {
    const auth = await makeAdminAuthHeader();
    createDeck({ id: 'd', nameAr: 'أ', nameEn: 'A' });
    addTitlesToDeck('d', ['One']);
    const titleId = getDeck('d')!.titles[0].id;
    const set = await request(app).put(`/admin/decks/d/titles/${titleId}`).set(auth).field('difficulty', 'hard');
    expect(set.status).toBe(200);
    expect(set.body.difficulty).toBe('hard');
    const cleared = await request(app).put(`/admin/decks/d/titles/${titleId}`).set(auth).field('difficulty', '');
    expect(cleared.body.difficulty).toBeNull();
    const bad = await request(app).put(`/admin/decks/d/titles/${titleId}`).set(auth).field('difficulty', 'nope');
    expect(bad.status).toBe(400);
  });
});
