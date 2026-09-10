import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';

// A real bug, found by hand: `game_sessions.deck_id` used to be
// `NOT NULL REFERENCES decks(id)` with no `ON DELETE` behavior — a schema
// leftover from when a session belonged to one deck, never read back (see
// the comment on the table in db.ts). With `PRAGMA foreign_keys = ON`,
// deleting any deck a session had ever been dealt from failed with a raw
// SQLite foreign key constraint error, silently, since the admin UI's
// delete button had no error handling either. This test builds exactly
// that pre-existing, old-shaped `game_sessions` table by hand *before*
// importing `../src/db` (whose migration runs once, at import time), so it
// actually exercises the table-recreation upgrade path rather than always
// starting from a table already created with the fixed shape.
const dbPath = path.join(os.tmpdir(), `yalla-test-migration-gsdeck-${Date.now()}-${Math.random()}.sqlite`);
process.env.DB_PATH = dbPath;

const raw = new Database(dbPath);
raw.pragma('foreign_keys = ON');
raw.exec(`
  CREATE TABLE players (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE decks (
    id TEXT PRIMARY KEY, name_ar TEXT NOT NULL, name_en TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'ar', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE titles (
    id TEXT PRIMARY KEY, deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    text TEXT NOT NULL, image_path TEXT, created_at INTEGER NOT NULL
  );
  CREATE TABLE game_sessions (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    deck_id TEXT NOT NULL REFERENCES decks(id),
    titles_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);
const now = Date.now();
raw.prepare('INSERT INTO players (id, username, password_hash, created_at, updated_at) VALUES (?,?,?,?,?)').run(
  'old-player',
  'oldschemauser2',
  'hash',
  now,
  now
);
raw.prepare(
  'INSERT INTO decks (id, name_ar, name_en, language, created_at, updated_at) VALUES (?,?,?,?,?,?)'
).run('old-deck', 'قديم', 'Old', 'ar', now, now);
raw.prepare('INSERT INTO titles (id, deck_id, text, created_at) VALUES (?,?,?,?)').run(
  't1',
  'old-deck',
  'Old Title',
  now
);
raw.prepare('INSERT INTO game_sessions (id, player_id, deck_id, titles_json, created_at) VALUES (?,?,?,?,?)').run(
  'old-session',
  'old-player',
  'old-deck',
  JSON.stringify([{ id: 't1', text: 'Old Title', deckId: 'old-deck', deckNameAr: 'قديم', deckNameEn: 'Old' }]),
  now
);
raw.close();

import { db, deleteDeck, getDeck } from '../src/db';

describe('upgrading a pre-existing database with the old strict game_sessions.deck_id', () => {
  it('lets a deck be deleted even though an old session was dealt from it', () => {
    expect(() => deleteDeck('old-deck')).not.toThrow();
    expect(getDeck('old-deck')).toBeNull();
  });

  it('nulls out the old session\'s now-meaningless deck_id rather than deleting the session', () => {
    const row = db.prepare('SELECT deck_id FROM game_sessions WHERE id = ?').get('old-session') as {
      deck_id: string | null;
    };
    expect(row.deck_id).toBeNull();
  });
});
