import Database from 'better-sqlite3';
import path from 'path';

/**
 * Read-only consistency check of a live database: SQLite's own integrity and
 * foreign key checks, plus this app's money invariants. Safe to run against
 * production while the server is up — it opens the file read-only and never
 * writes. Exits 1 if anything is wrong, so it can gate a deploy or a cron.
 *
 *   npm run check-db                     # the server's own data/catalogue.sqlite
 *   DB_PATH=/path/to/file.sqlite npm run check-db
 */

export interface CheckResult {
  name: string;
  /** Offending rows (capped), empty when the check passes. */
  problems: unknown[];
}

const MAX_ROWS = 20;

/** Each query returns one row per problem; no rows means the check passes. */
const LEDGER_CHECKS: { name: string; sql: string }[] = [
  {
    name: 'no player has a negative paid balance',
    sql: `SELECT player_id,
            SUM(CASE WHEN kind = 'grant' THEN amount ELSE -amount END) AS balance
          FROM credit_transactions GROUP BY player_id HAVING balance < 0`,
  },
  {
    name: 'free signup games stay within 0..2',
    sql: `SELECT id, username, free_game_credits FROM players
          WHERE free_game_credits < 0 OR free_game_credits > 2`,
  },
  {
    name: 'every paid payment granted credit exactly once',
    sql: `SELECT p.id, p.player_id, COUNT(ct.id) AS grants FROM payments p
          LEFT JOIN credit_transactions ct ON ct.payment_id = p.id AND ct.kind = 'grant'
          WHERE p.status = 'paid' GROUP BY p.id HAVING grants <> 1`,
  },
  {
    name: 'no unpaid payment granted credit',
    sql: `SELECT p.id, p.status FROM payments p
          JOIN credit_transactions ct ON ct.payment_id = p.id AND ct.kind = 'grant'
          WHERE p.status <> 'paid'`,
  },
  {
    name: 'a granted amount matches its payment',
    sql: `SELECT ct.id, ct.amount, p.credits FROM credit_transactions ct
          JOIN payments p ON p.id = ct.payment_id
          WHERE ct.kind = 'grant' AND (ct.amount <> p.credits OR ct.player_id <> p.player_id)`,
  },
  {
    name: 'no game session was charged more than once',
    sql: `SELECT game_session_id, COUNT(*) AS charges FROM credit_transactions
          WHERE kind = 'consume' AND game_session_id IS NOT NULL
          GROUP BY game_session_id HAVING charges > 1`,
  },
  {
    name: 'a session is charged to the player who owns it',
    sql: `SELECT ct.id, ct.player_id, gs.player_id AS session_player FROM credit_transactions ct
          JOIN game_sessions gs ON gs.id = ct.game_session_id
          WHERE ct.kind = 'consume' AND ct.player_id <> gs.player_id`,
  },
  {
    name: 'every charge is tied to a game session',
    sql: `SELECT id, player_id FROM credit_transactions WHERE kind = 'consume' AND game_session_id IS NULL`,
  },
];

export function runConsistencyChecks(db: Database.Database): CheckResult[] {
  const results: CheckResult[] = [];

  const integrity = db.pragma('integrity_check') as { integrity_check: string }[];
  results.push({
    name: 'SQLite integrity_check',
    problems: integrity.filter((r) => r.integrity_check !== 'ok').slice(0, MAX_ROWS),
  });
  results.push({
    name: 'SQLite foreign_key_check',
    problems: (db.pragma('foreign_key_check') as unknown[]).slice(0, MAX_ROWS),
  });

  for (const check of LEDGER_CHECKS) {
    results.push({ name: check.name, problems: db.prepare(`${check.sql} LIMIT ${MAX_ROWS}`).all() });
  }
  return results;
}

function main(): void {
  const dataDir = process.env.DATA_DIR ?? path.join(__dirname, '..', 'data');
  const dbPath = process.env.DB_PATH ?? path.join(dataDir, 'catalogue.sqlite');
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    // eslint-disable-next-line no-console
    console.log(`Checking ${dbPath} (journal_mode=${db.pragma('journal_mode', { simple: true })})\n`);
    const results = runConsistencyChecks(db);
    for (const r of results) {
      // eslint-disable-next-line no-console
      console.log(`${r.problems.length === 0 ? 'PASS' : 'FAIL'}  ${r.name}`);
      // eslint-disable-next-line no-console
      for (const row of r.problems) console.log(`        ${JSON.stringify(row)}`);
    }
    const failed = results.filter((r) => r.problems.length > 0).length;
    // eslint-disable-next-line no-console
    console.log(`\n${failed === 0 ? 'All checks passed.' : `${failed} check(s) failed.`}`);
    process.exitCode = failed === 0 ? 0 : 1;
  } finally {
    db.close();
  }
}

if (require.main === module) main();
