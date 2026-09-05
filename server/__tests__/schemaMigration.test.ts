import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';

// A real bug, found by hand: `CREATE TABLE IF NOT EXISTS` only creates a
// table from scratch — it never adds a column to a table that already
// exists from an older schema version. `game_session_id` on
// `credit_transactions` was added when charades sessions started recording
// which session consumed a credit; a database created before that change
// crashed every "start game" with "table credit_transactions has no
// column named game_session_id" the moment it hit a real, previously-used
// local database instead of a freshly created test one. This test builds
// exactly that pre-existing, old-shaped table by hand *before* importing
// `../src/db` (whose migration runs once, at import time), so it actually
// exercises the upgrade path rather than always starting from a fresh file.
const dbPath = path.join(os.tmpdir(), `yalla-test-migration-${Date.now()}-${Math.random()}.sqlite`);
process.env.DB_PATH = dbPath;

const raw = new Database(dbPath);
raw.exec(`
  CREATE TABLE players (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE credit_transactions (
    id TEXT PRIMARY KEY, player_id TEXT NOT NULL, kind TEXT NOT NULL,
    amount INTEGER NOT NULL, payment_id TEXT, created_at INTEGER NOT NULL
  );
`);
const now = Date.now();
raw.prepare('INSERT INTO players (id, username, password_hash, created_at, updated_at) VALUES (?,?,?,?,?)').run(
  'old-player',
  'oldschemauser',
  'hash',
  now,
  now
);
raw.prepare('INSERT INTO credit_transactions (id, player_id, kind, amount, created_at) VALUES (?,?,?,?,?)').run(
  't1',
  'old-player',
  'grant',
  5,
  now
);
raw.close();

import { addTitlesToDeck, createDeck, creditBalance, startGameSession } from '../src/db';

describe('upgrading a pre-existing database missing a newer column', () => {
  it('adds the missing column instead of leaving the old table shape in place', () => {
    const balance = creditBalance('old-player');
    expect(balance).toBe(5); // the pre-existing grant, from before the column existed, still counts
  });

  it('lets a player who predates the schema change actually start a game', () => {
    createDeck({ id: 'old-schema-deck', nameAr: 'قديم', nameEn: 'Old' });
    addTitlesToDeck('old-schema-deck', ['A', 'B', 'C']);

    const { session, balance } = startGameSession('old-player', 'sess-1');
    expect(session.titles).toHaveLength(3);
    expect(balance).toBe(4); // spent one of the five pre-existing credits
  });
});
