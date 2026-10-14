import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';

// The signup bonus used to be classic-only, held in
// `players.free_classic_credits`. It now covers either mode and lives in
// `free_game_credits`, renamed in place. This builds a pre-existing database
// with the old column (and an existing player partway through their bonus)
// *before* importing `../src/db`, whose migration runs once at import time,
// so the upgrade path itself is exercised: the player's unspent free games
// must carry over, not reset to 0 or back to 2.
const dbPath = path.join(os.tmpdir(), `yalla-test-migration-freegames-${Date.now()}-${Math.random()}.sqlite`);
process.env.DB_PATH = dbPath;

const raw = new Database(dbPath);
raw.exec(`
  CREATE TABLE players (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    free_classic_credits INTEGER NOT NULL DEFAULT 0
  );
`);
const now = Date.now();
raw
  .prepare(
    'INSERT INTO players (id, username, password_hash, created_at, updated_at, free_classic_credits) VALUES (?,?,?,?,?,?)'
  )
  .run('old-player', 'oldfreegamesuser', 'hash', now, now, 1);
raw.close();

import { db, getPlayerById } from '../src/db';

describe('upgrading a database that still has players.free_classic_credits', () => {
  afterAll(() => db.close());

  it('renames the column, keeping each player\'s unspent free games', () => {
    const columns = (db.prepare('PRAGMA table_info(players)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('free_game_credits');
    expect(columns).not.toContain('free_classic_credits');
    expect(getPlayerById('old-player')?.freeGameCredits).toBe(1);
  });
});
