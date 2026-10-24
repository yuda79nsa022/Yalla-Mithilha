import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import type {
  AdminUserRow,
  AuditLogRow,
  Branding,
  DealtStacks,
  DealtTitle,
  Difficulty,
  DeckRow,
  DeckWithTitles,
  GameMode,
  GameSessionRow,
  HomeContent,
  Lang,
  PaymentRow,
  PlayerRow,
  PublicDeck,
  RevealPayload,
  TitleRow,
} from './types';
import { DIFFICULTIES, effectiveDifficulty, isDifficulty, type ClassicDifficulty } from './types';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/** Where uploaded title pictures live on disk — served publicly at `/title-images/*` (see app.ts), unauthenticated like any other game asset. */
export const TITLE_IMAGES_DIR = path.join(DATA_DIR, 'title-images');
if (!fs.existsSync(TITLE_IMAGES_DIR)) fs.mkdirSync(TITLE_IMAGES_DIR, { recursive: true });

/** Where the admin-uploaded app logo lives — served publicly at `/branding/*`, since every page (player app and admin tool) shows it. */
export const BRANDING_DIR = path.join(DATA_DIR, 'branding');
if (!fs.existsSync(BRANDING_DIR)) fs.mkdirSync(BRANDING_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, 'catalogue.sqlite');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const DEFAULT_GAME_PRICE_FILS = 1500; // 1.500 KD, the admin's own starting price
const DEFAULT_MODIFIED_GAME_PRICE_FILS = 1500; // 1.500 KD — same starting price as classic; the admin can set them apart independently

// The home screen's own starting copy — what a fresh install shows before
// any admin has edited it. Also what `resetDbForTests` restores between
// tests, same as the game price above.
const DEFAULT_HOME_CONTENT: HomeContent = {
  taglineAr: 'ما تحتاج تعرف الجواب، تحتاج ربعك يفهمونك',
  taglineEn: 'You do not need to know the answer. You need your friends to understand you.',
  writeupAr:
    'بس بدون كلام لعبة تمثيل صامت — فريقين يمثّلون عناوين حقيقية بدون كلام والفريق الثاني يخمّن. وقت الدفع تختار عناوين عربية (مسرحيات ومسلسلات وأفلام كويتية وخليجية ومصرية)، أو عناوين إنجليزية (أفلام هوليوود ومسلسلات أمريكية)، أو مزيج من الاثنين. عشرين جولة، يختارها السيرفر عشوائي كل مرة.',
  writeupEn:
    'Bas Bedoon Kalam is Charades — two teams act out real titles while the other guesses, no words allowed. At checkout, choose Arabic titles (Kuwaiti, Khaleeji and Egyptian plays, series and movies), English titles (Hollywood movies and American series), or a mix of both. Twenty rounds, picked at random by the server every time.',
};

// The app's name, logo and timezone as a fresh install shows them — the
// same name the app ships in its own i18n catalogues (`app.name`).
const DEFAULT_BRANDING: Branding = {
  appNameAr: 'بس بدون كلام',
  appNameEn: 'Bas Bedoon Kalam',
  logoPath: null,
  timezone: 'Asia/Kuwait',
};

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Optional player accounts. Deliberately its own table, not admin_users:
  -- different purpose (someone who plays, not someone who manages content),
  -- different session token, no overlap in privilege.
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    -- Optional, collected at signup — the only channel a forgotten password
    -- can be reset through (see password_resets below). NULL for accounts
    -- that never gave one, including every account created before this
    -- column existed.
    email TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- A single-use, short-lived code emailed to a player who forgot their
  -- password. Its own table rather than columns on players: a player can
  -- have at most one live code (a fresh request invalidates any previous
  -- one — see createPasswordReset), but keeping it separate means the
  -- players table never carries reset state that means nothing outside an
  -- active reset attempt. code_hash, never the raw code, same reasoning as
  -- password_hash. attempts guards against brute-forcing a 6-digit code
  -- within its expiry window (see MAX_RESET_ATTEMPTS in playerAuth routes).
  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL
  );

  -- Single-row settings table. Only ever has id=1. The admin-editable price
  -- of one charades game, in fils (1000 fils = 1 KD) — a wallet top-up is
  -- always exactly one game's worth of credit, at whatever this is set to
  -- the moment checkout starts.
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    game_price_fils INTEGER NOT NULL
  );

  -- A charades deck: a named pool of titles an admin imports (a movie,
  -- series, play or song list). Unlike the old board-game category, a deck
  -- has no fixed size — titles is CASCADE-deleted with it.
  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    -- Content language ('ar'/'en') a session must match to deal from this
    -- deck — separate from name_ar/name_en, the deck's bilingual display
    -- name, which exists regardless of which language its titles are in.
    language TEXT NOT NULL DEFAULT 'ar',
    -- A servable path under /title-images/*, or NULL — the icon/cover shown
    -- next to this deck on the player's own deck picker. Optional, same as
    -- a title's picture.
    image_path TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- One title = one thing to act out. No separate prompt/answer pair: the
  -- title itself is privately shown to the actor, then re-shown as the
  -- "answer" once the team has guessed (or given up), per the actual game
  -- (silent charades, not a written trivia question).
  CREATE TABLE IF NOT EXISTS titles (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    -- A servable path under /title-images/*, or NULL — most titles never
    -- get a picture; it's an optional bonus, not every title needs one.
    image_path TEXT,
    created_at INTEGER NOT NULL
  );

  -- A wallet top-up is only ever real once it is owned by an account, not a
  -- device — these two tables are the server-authoritative source of truth.
  -- AsyncStorage never stores a wallet balance itself.
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    credits INTEGER NOT NULL,
    amount_fils INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KWD',
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','paid','failed','cancelled')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- One row per purchased charades session — 20 titles dealt across every
  -- playable deck the moment a wallet credit was spent. Its id is the
  -- client's own locally-generated session id, generated once at "start
  -- game" time — that shared identity is what makes spending idempotent:
  -- resuming an interrupted session replays the same id and never spends a
  -- second credit. deck_id is nullable with ON DELETE SET NULL, not
  -- NOT NULL/RESTRICT: it's a schema leftover from when a session belonged
  -- to one deck (see startGameSession) that nothing reads back, so a deck
  -- being deleted later must never be blocked by an old session's now-
  -- meaningless reference to it.
  CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    deck_id TEXT REFERENCES decks(id) ON DELETE SET NULL,
    titles_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- A single-use link behind the handoff screen's QR code, minted right
  -- before it's shown and permanently spent the instant anyone opens it
  -- (see claimRevealToken) — without this, the same code stays scannable by
  -- anyone pointed at the shared screen for as long as it's up, including an
  -- opposing player sneaking a peek at the answer before their own turn.
  CREATE TABLE IF NOT EXISTS reveal_tokens (
    id TEXT PRIMARY KEY,
    game_session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    payload_json TEXT NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL
  );

  -- Append-only ledger. A player's balance is derived (sum of grants minus
  -- sum of consumes), never stored as a mutable counter, so the history of
  -- where every credit came from and went is never lost to an update.
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('grant','consume')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    payment_id TEXT REFERENCES payments(id),
    game_session_id TEXT REFERENCES game_sessions(id),
    created_at INTEGER NOT NULL
  );

  -- Sensitive admin actions, append-only and never exposed for edit/delete
  -- from the admin UI. Deliberately no foreign key on actor_id: deleting an
  -- admin account must never cascade-delete (or be blocked by) the record of
  -- what that admin did — actor_username is a snapshot for exactly that
  -- reason, since the live username could later change or disappear.
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    actor_username TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT,
    created_at INTEGER NOT NULL
  );
`);

/**
 * `CREATE TABLE IF NOT EXISTS` above only creates a table from scratch — it
 * never adds a column to a table that already exists from an older schema
 * version. This project has no migration framework, so a column added
 * after a table already shipped (like this one, added when charades
 * sessions started recording which session consumed a credit) needs an
 * explicit, idempotent `ALTER TABLE` here, or a database created before
 * that change stays stuck on the old shape forever and every insert
 * naming the new column fails with "no column named ...".
 */
function ensureColumn(table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

/**
 * `ensureColumn` only adds columns — it can't change an existing column's
 * constraints, and SQLite has no `ALTER TABLE ... ALTER COLUMN` to do that
 * directly either, so loosening one takes recreating the table. This was a
 * real bug found by hand: `game_sessions.deck_id` used to be `NOT NULL
 * REFERENCES decks(id)` with no `ON DELETE` behavior, so deleting any deck
 * a session had ever been dealt from (the `deck_id` is unused bookkeeping —
 * see the comment on the table) failed with a foreign key constraint error,
 * silently, since the admin UI's delete button had no error handling either.
 * Idempotent: does nothing once `deck_id` is already nullable.
 */
function migrateGameSessionsDeckIdNullable(): void {
  const columns = db.prepare(`PRAGMA table_info(game_sessions)`).all() as { name: string; notnull: number }[];
  const deckIdColumn = columns.find((c) => c.name === 'deck_id');
  if (!deckIdColumn || deckIdColumn.notnull === 0) return;
  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE game_sessions_new (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      deck_id TEXT REFERENCES decks(id) ON DELETE SET NULL,
      titles_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    INSERT INTO game_sessions_new (id, player_id, deck_id, titles_json, created_at)
      SELECT id, player_id, deck_id, titles_json, created_at FROM game_sessions;
    DROP TABLE game_sessions;
    ALTER TABLE game_sessions_new RENAME TO game_sessions;
  `);
  db.pragma('foreign_keys = ON');
}
migrateGameSessionsDeckIdNullable();

ensureColumn('credit_transactions', 'game_session_id', 'game_session_id TEXT REFERENCES game_sessions(id)');
// Every deck predating language-gated decks is real Kuwaiti/Khaleeji/Egyptian
// content, so 'ar' is the correct value for existing rows, not just a
// placeholder — new decks pass their own language explicitly (see createDeck).
ensureColumn('decks', 'language', "language TEXT NOT NULL DEFAULT 'ar'");
ensureColumn('decks', 'image_path', 'image_path TEXT');
ensureColumn('titles', 'image_path', 'image_path TEXT');
// The level a team picks each round in modified mode: a per-deck default,
// optionally overridden per title — see `effectiveDifficulty` in types.ts.
// Every deck that predates this is 'medium' until an admin says otherwise;
// classic mode never reads either column.
ensureColumn('decks', 'difficulty', "difficulty TEXT NOT NULL DEFAULT 'medium'");
ensureColumn('titles', 'difficulty', 'difficulty TEXT');
// Which rule set a session was played under — defaults every pre-existing
// row to 'classic', which is correct: they were all dealt before modified
// mode existed, as a flat title list (see rowToGameSession).
ensureColumn('game_sessions', 'mode', "mode TEXT NOT NULL DEFAULT 'classic'");
// The admin-set price of one modified-mode game, separate from
// game_price_fils (classic). NULL until the one-time backfill below sets
// it, so an upgrade never charges 0 fils for a modified game by accident.
ensureColumn('settings', 'modified_game_price_fils', 'modified_game_price_fils INTEGER');
ensureColumn('settings', 'home_tagline_ar', 'home_tagline_ar TEXT');
ensureColumn('settings', 'home_tagline_en', 'home_tagline_en TEXT');
ensureColumn('settings', 'home_writeup_ar', 'home_writeup_ar TEXT');
ensureColumn('settings', 'home_writeup_en', 'home_writeup_en TEXT');
ensureColumn('players', 'email', 'email TEXT');
// Branding — the app's display name in both languages, its logo (a servable
// path under /branding/*, NULL for the built-in cube) and the timezone every
// date in the admin tool and the player's usage report is shown in.
ensureColumn('settings', 'app_name_ar', 'app_name_ar TEXT');
ensureColumn('settings', 'app_name_en', 'app_name_en TEXT');
ensureColumn('settings', 'logo_path', 'logo_path TEXT');
ensureColumn('settings', 'timezone', 'timezone TEXT');
// Bumped on every password change; every session token carries the value it
// was issued with, and requirePlayerSession/requireAdminSession reject a
// token whose value no longer matches (see auth.ts). So a password change or
// reset signs that account out everywhere, at once, instead of leaving any
// already-issued token valid for the rest of its 12 hours.
ensureColumn('players', 'session_version', 'session_version INTEGER NOT NULL DEFAULT 0');
ensureColumn('admin_users', 'session_version', 'session_version INTEGER NOT NULL DEFAULT 0');
// The payment gateway's own id for this payment (MyFatoorah's InvoiceId),
// set once checkout creates it there. A gateway callback or webhook is only
// ever applied to the payment whose provider_ref matches — see
// payments/settle.ts. NULL for the mock provider, which has no such id.
ensureColumn('payments', 'provider_ref', 'provider_ref TEXT');
// Free games left from the one-time signup grant, spendable on either mode —
// see grantSignupBonus. A column, not a ledger entry: this isn't real money,
// just an entitlement counter, and it only ever needs to go down. It was
// `free_classic_credits` while the bonus was classic-only; renamed in place
// so an existing player's unspent free games carry over unchanged.
{
  const playerColumns = (db.prepare('PRAGMA table_info(players)').all() as { name: string }[]).map((c) => c.name);
  if (playerColumns.includes('free_classic_credits') && !playerColumns.includes('free_game_credits')) {
    db.exec('ALTER TABLE players RENAME COLUMN free_classic_credits TO free_game_credits');
  }
}
ensureColumn('players', 'free_game_credits', 'free_game_credits INTEGER NOT NULL DEFAULT 0');
// When the player was last emailed that their games are running low — NULL
// while they have enough, or once a top-up re-arms it. See
// claimLowBalanceNotice.
ensureColumn('players', 'low_balance_notified_at', 'low_balance_notified_at INTEGER');

// Lookup indexes for the hot paths: a wallet's balance is summed from the
// ledger on every wallet fetch and game start, and SQLite doesn't index
// foreign keys on its own, so without these every one of those (and every
// cascading delete of a player, deck or session) is a full table scan.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_credit_transactions_player ON credit_transactions(player_id);
  CREATE INDEX IF NOT EXISTS idx_credit_transactions_payment ON credit_transactions(payment_id);
  CREATE INDEX IF NOT EXISTS idx_credit_transactions_session ON credit_transactions(game_session_id);
  CREATE INDEX IF NOT EXISTS idx_payments_player ON payments(player_id);
  CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON payments(provider_ref);
  CREATE INDEX IF NOT EXISTS idx_game_sessions_player ON game_sessions(player_id);
  CREATE INDEX IF NOT EXISTS idx_game_sessions_deck ON game_sessions(deck_id);
  CREATE INDEX IF NOT EXISTS idx_reveal_tokens_session ON reveal_tokens(game_session_id);
  CREATE INDEX IF NOT EXISTS idx_password_resets_player ON password_resets(player_id);
  CREATE INDEX IF NOT EXISTS idx_titles_deck ON titles(deck_id);
`);

// The ledger's two money invariants, enforced by the database itself rather
// than only by the code paths that write it: a payment grants credit at most
// once, and a game session is charged at most once. The application already
// guarantees both (see confirmPayment and startGameSession), but only while
// the server runs as one process — these keep them true under any future
// multi-process deployment too. Created separately so a pre-existing
// duplicate (which `npm run check-db` would report) can't stop the server
// from starting; the error is logged loudly instead.
for (const [name, sql] of [
  [
    'uniq_credit_grant_per_payment',
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_grant_per_payment
       ON credit_transactions(payment_id) WHERE kind = 'grant' AND payment_id IS NOT NULL`,
  ],
  [
    'uniq_credit_consume_per_session',
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_consume_per_session
       ON credit_transactions(game_session_id) WHERE kind = 'consume' AND game_session_id IS NOT NULL`,
  ],
] as const) {
  try {
    db.exec(sql);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`could not create ${name} — the ledger has duplicates; run \`npm run check-db\``, err);
  }
}

db.prepare('INSERT OR IGNORE INTO settings (id, game_price_fils) VALUES (1, ?)').run(DEFAULT_GAME_PRICE_FILS);
db.prepare('UPDATE settings SET modified_game_price_fils = COALESCE(modified_game_price_fils, ?) WHERE id = 1').run(
  DEFAULT_MODIFIED_GAME_PRICE_FILS
);
// Bound params rather than a literal in the ALTER TABLE's own DEFAULT, so
// the Arabic text and any apostrophes in the English text never need manual
// SQL-escaping — only fills in a column that's still NULL, so this never
// overwrites content an admin already edited.
db.prepare(
  `UPDATE settings SET
     home_tagline_ar = COALESCE(home_tagline_ar, @taglineAr),
     home_tagline_en = COALESCE(home_tagline_en, @taglineEn),
     home_writeup_ar = COALESCE(home_writeup_ar, @writeupAr),
     home_writeup_en = COALESCE(home_writeup_en, @writeupEn)
   WHERE id = 1`
).run(DEFAULT_HOME_CONTENT);
db.prepare(
  `UPDATE settings SET
     app_name_ar = COALESCE(app_name_ar, @appNameAr),
     app_name_en = COALESCE(app_name_en, @appNameEn),
     timezone = COALESCE(timezone, @timezone)
   WHERE id = 1`
).run(DEFAULT_BRANDING);

/* --------------------------------------------------------------- settings */

/** The classic game's price, in fils. Kept under its original name/shape — only modified mode gets a new, separate price below. */
export function getGamePriceFils(): number {
  const row = db.prepare('SELECT game_price_fils FROM settings WHERE id = 1').get() as { game_price_fils: number };
  return row.game_price_fils;
}

export function setGamePriceFils(fils: number): number {
  db.prepare('UPDATE settings SET game_price_fils = ? WHERE id = 1').run(fils);
  return getGamePriceFils();
}

/** The modified game's price, in fils — set independently of the classic price above. */
export function getModifiedGamePriceFils(): number {
  const row = db.prepare('SELECT modified_game_price_fils FROM settings WHERE id = 1').get() as {
    modified_game_price_fils: number;
  };
  return row.modified_game_price_fils;
}

export function setModifiedGamePriceFils(fils: number): number {
  db.prepare('UPDATE settings SET modified_game_price_fils = ? WHERE id = 1').run(fils);
  return getModifiedGamePriceFils();
}

/** Either mode's price, by `mode` — what `createPayment`/`startGameSession` actually charge against. */
export function getGamePriceFilsForMode(mode: GameMode): number {
  return mode === 'modified' ? getModifiedGamePriceFils() : getGamePriceFils();
}

export function getHomeContent(): HomeContent {
  const row = db
    .prepare('SELECT home_tagline_ar, home_tagline_en, home_writeup_ar, home_writeup_en FROM settings WHERE id = 1')
    .get() as { home_tagline_ar: string; home_tagline_en: string; home_writeup_ar: string; home_writeup_en: string };
  return {
    taglineAr: row.home_tagline_ar,
    taglineEn: row.home_tagline_en,
    writeupAr: row.home_writeup_ar,
    writeupEn: row.home_writeup_en,
  };
}

/** Partial update — only the given fields change, same pattern as `updateDeck`. */
export function updateHomeContent(input: Partial<HomeContent>): HomeContent {
  const current = getHomeContent();
  const next: HomeContent = { ...current, ...input };
  db.prepare(
    `UPDATE settings SET
       home_tagline_ar = @taglineAr,
       home_tagline_en = @taglineEn,
       home_writeup_ar = @writeupAr,
       home_writeup_en = @writeupEn
     WHERE id = 1`
  ).run(next);
  return next;
}

export function getBranding(): Branding {
  const row = db.prepare('SELECT app_name_ar, app_name_en, logo_path, timezone FROM settings WHERE id = 1').get() as {
    app_name_ar: string;
    app_name_en: string;
    logo_path: string | null;
    timezone: string;
  };
  return {
    appNameAr: row.app_name_ar,
    appNameEn: row.app_name_en,
    logoPath: row.logo_path ?? null,
    timezone: row.timezone,
  };
}

/** Partial update — only the given fields change, same pattern as `updateHomeContent`. `logoPath: null` goes back to the built-in logo. */
export function updateBranding(input: Partial<Branding>): Branding {
  const next: Branding = { ...getBranding(), ...input };
  db.prepare(
    `UPDATE settings SET
       app_name_ar = @appNameAr,
       app_name_en = @appNameEn,
       logo_path = @logoPath,
       timezone = @timezone
     WHERE id = 1`
  ).run(next);
  return next;
}

/* ---------------------------------------------------------------- listing */

/** One page of a searched, sorted admin list — see `pagedList`. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListQuery {
  /** Free-text search; empty matches everything. */
  q: string;
  /** 1-based. */
  page: number;
  pageSize: number;
  /** A key of the list's own sort map — anything else was already rejected by `parseListQuery`. */
  sort: string;
  dir: 'asc' | 'desc';
}

/**
 * The one search/sort/paginate query every admin list goes through. `source`
 * is a SELECT whose columns the search and sort maps refer to; only those
 * maps' fixed SQL ever reaches the query text — the search term and the
 * paging numbers are bound parameters, and an unknown sort key falls back to
 * the default rather than being interpolated. Ties sort by `_rid` (the
 * source's rowid) so paging is stable.
 */
function pagedList<T>(
  source: string,
  searchColumns: readonly string[],
  sortColumns: Readonly<Record<string, string>>,
  query: ListQuery,
  map: (row: any) => T
): Page<T> {
  const where = query.q
    ? `WHERE ${searchColumns.map((c) => `COALESCE(${c}, '') LIKE @like ESCAPE '\\'`).join(' OR ')}`
    : '';
  const like = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM (${source}) ${where}`).get({ like }) as { n: number }).n;
  const sortSql = sortColumns[query.sort] ?? Object.values(sortColumns)[0];
  const dir = query.dir === 'desc' ? 'DESC' : 'ASC';
  const rows = db
    .prepare(`SELECT * FROM (${source}) ${where} ORDER BY ${sortSql} COLLATE NOCASE ${dir}, _rid ${dir} LIMIT @limit OFFSET @offset`)
    .all({ like, limit: query.pageSize, offset: (query.page - 1) * query.pageSize });
  return { items: rows.map(map), total, page: query.page, pageSize: query.pageSize };
}

/** Sort keys each admin list accepts — `parseListQuery` rejects any other. The first is the default. */
export const DECK_SORTS = { id: 'id', name: 'name_en', language: 'language', difficulty: 'difficulty', titles: 'title_count', created: 'created_at' } as const;
export const PLAYER_SORTS = { username: 'username', email: 'email', created: 'created_at' } as const;
export const ADMIN_SORTS = { username: 'username', created: 'created_at' } as const;
export const AUDIT_SORTS = { created: 'created_at', actor: 'actor_username', action: 'action', target: 'target' } as const;

/** Decks without their titles (a count instead) — the list view never needs every title of every deck. */
export function searchDecks(query: ListQuery): Page<DeckRow & { titleCount: number }> {
  return pagedList(
    'SELECT d.*, d.rowid AS _rid, (SELECT COUNT(*) FROM titles t WHERE t.deck_id = d.id) AS title_count FROM decks d',
    ['id', 'name_en', 'name_ar'],
    DECK_SORTS,
    query,
    (r) => ({ ...rowToDeck(r), titleCount: r.title_count })
  );
}

export function searchPlayers(query: ListQuery): Page<PlayerRow> {
  return pagedList('SELECT *, rowid AS _rid FROM players', ['username', 'email'], PLAYER_SORTS, query, (r) =>
    stripPlayerHash(rowToPlayer(r))
  );
}

export function searchAdminUsers(query: ListQuery): Page<AdminUserRow> {
  return pagedList('SELECT *, rowid AS _rid FROM admin_users', ['username'], ADMIN_SORTS, query, (r) =>
    stripHash(rowToAdminUser(r))
  );
}

/** Searches who, what and which target, plus the before/after snapshots — so a deck's or player's name finds its history too. */
export function searchAuditLog(query: ListQuery): Page<AuditLogRow> {
  return pagedList(
    'SELECT *, rowid AS _rid FROM audit_log',
    ['actor_username', 'action', 'target', 'before_json', 'after_json'],
    AUDIT_SORTS,
    query,
    rowToAuditLog
  );
}

/* ------------------------------------------------------------------ decks */

export class DuplicateDeckError extends Error {}
export class DeckNotFoundError extends Error {}
export class TitleNotFoundError extends Error {}

function rowToDeck(r: any): DeckRow {
  return {
    id: r.id,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    language: r.language as Lang,
    difficulty: isDifficulty(r.difficulty) ? r.difficulty : 'medium',
    imagePath: r.image_path ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToTitle(r: any): TitleRow {
  return {
    id: r.id,
    deckId: r.deck_id,
    text: r.text,
    imagePath: r.image_path ?? null,
    difficulty: isDifficulty(r.difficulty) ? r.difficulty : null,
    createdAt: r.created_at,
  };
}

export function listTitles(deckId: string): TitleRow[] {
  return db
    .prepare('SELECT * FROM titles WHERE deck_id = ? ORDER BY created_at, rowid')
    .all(deckId)
    .map(rowToTitle);
}

export function listDecks(): DeckWithTitles[] {
  const decks = db.prepare('SELECT * FROM decks ORDER BY id').all().map(rowToDeck);
  return decks.map((d) => ({ ...d, titles: listTitles(d.id) }));
}

export function getDeck(id: string): DeckWithTitles | null {
  const row = db.prepare('SELECT * FROM decks WHERE id = ?').get(id);
  if (!row) return null;
  const d = rowToDeck(row);
  return { ...d, titles: listTitles(d.id) };
}

export interface CreateDeckInput {
  id: string;
  nameAr: string;
  nameEn: string;
  /** Which player-language pool this deck's titles belong to. Defaults to 'ar' — every deck that predates this field really is Arabic content. */
  language?: Lang;
  /** The default level of every title in the deck, for modified mode. Defaults to 'medium'. */
  difficulty?: Difficulty;
}

export function createDeck(input: CreateDeckInput): DeckWithTitles {
  if (getDeck(input.id)) throw new DuplicateDeckError(`deck "${input.id}" already exists`);
  const now = Date.now();
  const language: Lang = input.language ?? 'ar';
  const difficulty: Difficulty = input.difficulty ?? 'medium';
  db.prepare(
    `INSERT INTO decks (id, name_ar, name_en, language, difficulty, created_at, updated_at)
     VALUES (@id, @nameAr, @nameEn, @language, @difficulty, @now, @now)`
  ).run({ id: input.id, nameAr: input.nameAr, nameEn: input.nameEn, language, difficulty, now });
  return getDeck(input.id)!;
}

export interface UpdateDeckInput {
  nameAr?: string;
  nameEn?: string;
  language?: Lang;
  difficulty?: Difficulty;
  /** `null` clears the deck's picture; `undefined` (omitted) leaves it untouched — same convention as `updateTitle`. */
  imagePath?: string | null;
}

export function updateDeck(id: string, input: UpdateDeckInput): DeckWithTitles {
  const existing = getDeck(id);
  if (!existing) throw new DeckNotFoundError(`deck "${id}" not found`);
  const next = { ...existing, ...input, updatedAt: Date.now() };
  db.prepare(
    'UPDATE decks SET name_ar=@nameAr, name_en=@nameEn, language=@language, difficulty=@difficulty, image_path=@imagePath, updated_at=@updatedAt WHERE id=@id'
  ).run(next);
  return getDeck(id)!;
}

export function deleteDeck(id: string): void {
  const result = db.prepare('DELETE FROM decks WHERE id = ?').run(id);
  if (result.changes === 0) throw new DeckNotFoundError(`deck "${id}" not found`);
}

/** A title to add, optionally with its own level override — a plain string means "no override, use the deck's default". */
export type NewTitle = string | { text: string; difficulty?: Difficulty | null };

function newTitleParts(raw: NewTitle): { text: string; difficulty: Difficulty | null } {
  return typeof raw === 'string'
    ? { text: raw.trim(), difficulty: null }
    : { text: raw.text.trim(), difficulty: raw.difficulty ?? null };
}

/**
 * Appends titles to a deck, skipping exact (trimmed) duplicates already in
 * it — no fixed slot count to fill, unlike the old board-game import, so
 * every non-duplicate, non-empty line just gets added.
 */
export function addTitlesToDeck(deckId: string, titles: NewTitle[]): { added: number; skipped: number } {
  const deck = getDeck(deckId);
  if (!deck) throw new DeckNotFoundError(`deck "${deckId}" not found`);

  const existing = new Set(deck.titles.map((t) => t.text.trim()));
  const stmt = db.prepare(
    'INSERT INTO titles (id, deck_id, text, difficulty, created_at) VALUES (@id, @deckId, @text, @difficulty, @now)'
  );
  let added = 0;
  const tx = db.transaction(() => {
    for (const raw of titles) {
      const { text, difficulty } = newTitleParts(raw);
      if (!text || existing.has(text)) continue;
      existing.add(text);
      stmt.run({ id: crypto.randomUUID(), deckId, text, difficulty, now: Date.now() });
      added++;
    }
    db.prepare('UPDATE decks SET updated_at = ? WHERE id = ?').run(Date.now(), deckId);
  });
  tx();

  return { added, skipped: titles.length - added };
}

export interface TitleWithImage {
  text: string;
  /** A servable path already written to disk (see routes/adminDecks.ts) — null when this row's image was missing or invalid. */
  imagePath: string | null;
  /** An optional per-title level override from the manifest's third column. */
  difficulty?: Difficulty | null;
}

/**
 * Same dedup-by-trimmed-text rule as `addTitlesToDeck`, plus each row's own
 * picture — used by the bulk "import with images" route (a spreadsheet
 * pairing each title with an image filename, plus a zip of the images
 * themselves). A row whose image didn't resolve still adds its title text;
 * it just has no picture, exactly like any other title.
 */
export function addTitlesToDeckWithImages(
  deckId: string,
  rows: TitleWithImage[]
): { added: number; skipped: number } {
  const deck = getDeck(deckId);
  if (!deck) throw new DeckNotFoundError(`deck "${deckId}" not found`);

  const existing = new Set(deck.titles.map((t) => t.text.trim()));
  const stmt = db.prepare(
    'INSERT INTO titles (id, deck_id, text, image_path, difficulty, created_at) VALUES (@id, @deckId, @text, @imagePath, @difficulty, @now)'
  );
  let added = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const text = row.text.trim();
      if (!text || existing.has(text)) continue;
      existing.add(text);
      stmt.run({
        id: crypto.randomUUID(),
        deckId,
        text,
        imagePath: row.imagePath,
        difficulty: row.difficulty ?? null,
        now: Date.now(),
      });
      added++;
    }
    db.prepare('UPDATE decks SET updated_at = ? WHERE id = ?').run(Date.now(), deckId);
  });
  tx();

  return { added, skipped: rows.length - added };
}

export function getTitle(deckId: string, titleId: string): TitleRow | null {
  const row = db.prepare('SELECT * FROM titles WHERE id = ? AND deck_id = ?').get(titleId, deckId);
  return row ? rowToTitle(row) : null;
}

export interface UpdateTitleInput {
  text?: string;
  /** `null` explicitly clears the picture; `undefined` (the default, when omitted) leaves it as-is. */
  imagePath?: string | null;
  /** `null` clears the override (back to the deck's default); `undefined` leaves it as-is. */
  difficulty?: Difficulty | null;
}

export function updateTitle(deckId: string, titleId: string, input: UpdateTitleInput): TitleRow {
  const existing = getTitle(deckId, titleId);
  if (!existing) throw new TitleNotFoundError(`title "${titleId}" not found in deck "${deckId}"`);
  const next = {
    id: titleId,
    deckId,
    text: input.text !== undefined ? input.text.trim() : existing.text,
    imagePath: input.imagePath !== undefined ? input.imagePath : existing.imagePath,
    difficulty: input.difficulty !== undefined ? input.difficulty : existing.difficulty,
  };
  db.prepare('UPDATE titles SET text=@text, image_path=@imagePath, difficulty=@difficulty WHERE id=@id AND deck_id=@deckId').run(
    next
  );
  db.prepare('UPDATE decks SET updated_at = ? WHERE id = ?').run(Date.now(), deckId);
  return getTitle(deckId, titleId)!;
}

/** Returns the removed title so callers (the route) can delete its image file from disk too — the DB itself doesn't touch the filesystem. */
export function deleteTitle(deckId: string, titleId: string): TitleRow {
  const existing = getTitle(deckId, titleId);
  if (!existing) throw new TitleNotFoundError(`title "${titleId}" not found in deck "${deckId}"`);
  db.prepare('DELETE FROM titles WHERE id = ? AND deck_id = ?').run(titleId, deckId);
  return existing;
}

/**
 * Decks the app is ever allowed to draft from — nothing to publish/complete
 * separately, a deck with at least one title is playable. `deckIds`, when
 * given, additionally restricts to just those decks — the player's own
 * explicit choice made alongside the team names. Omitted, includes every
 * playable deck.
 */
export function listPlayableDecks(deckIds?: string[]): DeckWithTitles[] {
  return listDecks().filter((d) => d.titles.length > 0 && (deckIds === undefined || deckIds.includes(d.id)));
}

/**
 * What a player picks from before checkout — every playable deck, without
 * its titles (a spoiler, and needless payload for a deck of hundreds).
 * Deliberately doesn't go through `listPlayableDecks`/`listDecks`: those
 * load every title row for every deck just to report a count, which a load
 * test showed serializing this unauthenticated, every-page-load endpoint
 * under concurrent traffic (a `SELECT *` over the full titles table on each
 * call). A single grouped `COUNT(*)` gets the same numbers in one query.
 */
export function listPublicDecks(): PublicDeck[] {
  const counts = new Map(
    (db.prepare('SELECT deck_id as deckId, COUNT(*) as count FROM titles GROUP BY deck_id').all() as {
      deckId: string;
      count: number;
    }[]).map((r) => [r.deckId, r.count])
  );
  return db
    .prepare('SELECT * FROM decks ORDER BY id')
    .all()
    .map(rowToDeck)
    .map((d) => ({
      id: d.id,
      nameAr: d.nameAr,
      nameEn: d.nameEn,
      language: d.language,
      difficulty: d.difficulty,
      imageUrl: d.imagePath ?? undefined,
      titleCount: counts.get(d.id) ?? 0,
    }))
    .filter((d) => d.titleCount > 0);
}

/* --------------------------------------------------------------- players */

export class DuplicateUsernameError extends Error {}
export class AdminUserNotFoundError extends Error {}
export class LastAdminError extends Error {}

interface AdminUserRowWithHash extends AdminUserRow {
  passwordHash: string;
}

function rowToAdminUser(r: any): AdminUserRowWithHash {
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function stripHash(u: AdminUserRowWithHash): AdminUserRow {
  const { passwordHash: _passwordHash, ...rest } = u;
  return rest;
}

export function listAdminUsers(): AdminUserRow[] {
  return db
    .prepare('SELECT * FROM admin_users ORDER BY username')
    .all()
    .map(rowToAdminUser)
    .map(stripHash);
}

export function countAdminUsers(): number {
  const row = db.prepare('SELECT COUNT(*) as n FROM admin_users').get() as { n: number };
  return row.n;
}

export function getAdminUserByUsernameWithHash(username: string): AdminUserRowWithHash | null {
  const row = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  return row ? rowToAdminUser(row) : null;
}

export function getAdminUserById(id: string): AdminUserRow | null {
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id);
  return row ? stripHash(rowToAdminUser(row)) : null;
}

export interface CreateAdminUserInput {
  username: string;
  passwordHash: string;
}

export function createAdminUser(input: CreateAdminUserInput): AdminUserRow {
  if (getAdminUserByUsernameWithHash(input.username)) {
    throw new DuplicateUsernameError(`username "${input.username}" is already taken`);
  }
  const now = Date.now();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO admin_users (id, username, password_hash, created_at, updated_at)
     VALUES (@id, @username, @passwordHash, @now, @now)`
  ).run({ id, ...input, now });
  return getAdminUserById(id)!;
}

export interface UpdateAdminUserInput {
  username?: string;
  passwordHash?: string;
}

export function updateAdminUser(id: string, input: UpdateAdminUserInput): AdminUserRow {
  const existing = getAdminUserById(id);
  if (!existing) throw new AdminUserNotFoundError(`admin user "${id}" not found`);
  if (input.username && input.username !== existing.username && getAdminUserByUsernameWithHash(input.username)) {
    throw new DuplicateUsernameError(`username "${input.username}" is already taken`);
  }

  const current = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as any;
  const next = {
    id,
    username: input.username ?? current.username,
    passwordHash: input.passwordHash ?? current.password_hash,
    sessionBump: input.passwordHash !== undefined ? 1 : 0,
    updatedAt: Date.now(),
  };
  db.prepare(
    `UPDATE admin_users SET username=@username, password_hash=@passwordHash,
       session_version = session_version + @sessionBump, updated_at=@updatedAt WHERE id=@id`
  ).run(next);
  return getAdminUserById(id)!;
}

/** Refuses to delete the last remaining admin — that would lock everyone out of the dashboard. */
export function deleteAdminUser(id: string): void {
  if (!getAdminUserById(id)) throw new AdminUserNotFoundError(`admin user "${id}" not found`);
  if (countAdminUsers() <= 1) {
    throw new LastAdminError('cannot delete the last remaining admin account');
  }
  db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
}

export class DuplicatePlayerUsernameError extends Error {}
export class PlayerNotFoundError extends Error {}

interface PlayerRowWithHash extends PlayerRow {
  passwordHash: string;
}

function rowToPlayer(r: any): PlayerRowWithHash {
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    email: r.email ?? null,
    freeGameCredits: r.free_game_credits ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function stripPlayerHash(p: PlayerRowWithHash): PlayerRow {
  const { passwordHash: _passwordHash, ...rest } = p;
  return rest;
}

export function listPlayers(): PlayerRow[] {
  return db.prepare('SELECT * FROM players ORDER BY username').all().map(rowToPlayer).map(stripPlayerHash);
}

export function getPlayerByUsernameWithHash(username: string): PlayerRowWithHash | null {
  const row = db.prepare('SELECT * FROM players WHERE username = ?').get(username);
  return row ? rowToPlayer(row) : null;
}

export function getPlayerById(id: string): PlayerRow | null {
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
  return row ? stripPlayerHash(rowToPlayer(row)) : null;
}

export interface CreatePlayerInput {
  username: string;
  passwordHash: string;
  /** Optional — omitted (or `null`) means this account has no reset channel until one is added. */
  email?: string | null;
}

export function createPlayer(input: CreatePlayerInput): PlayerRow {
  if (getPlayerByUsernameWithHash(input.username)) {
    throw new DuplicatePlayerUsernameError(`username "${input.username}" is already taken`);
  }
  const now = Date.now();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO players (id, username, password_hash, email, created_at, updated_at)
     VALUES (@id, @username, @passwordHash, @email, @now, @now)`
  ).run({ id, username: input.username, passwordHash: input.passwordHash, email: input.email ?? null, now });
  return getPlayerById(id)!;
}

export interface UpdatePlayerInput {
  username?: string;
  passwordHash?: string;
  /** `null` explicitly clears the email; `undefined` (omitted) leaves it as-is — same convention as a title/deck's `imagePath`. */
  email?: string | null;
}

export function updatePlayer(id: string, input: UpdatePlayerInput): PlayerRow {
  const existing = getPlayerById(id);
  if (!existing) throw new PlayerNotFoundError(`player "${id}" not found`);
  if (input.username && input.username !== existing.username && getPlayerByUsernameWithHash(input.username)) {
    throw new DuplicatePlayerUsernameError(`username "${input.username}" is already taken`);
  }

  const current = db.prepare('SELECT * FROM players WHERE id = ?').get(id) as any;
  const next = {
    id,
    username: input.username ?? current.username,
    passwordHash: input.passwordHash ?? current.password_hash,
    email: input.email !== undefined ? input.email : current.email,
    sessionBump: input.passwordHash !== undefined ? 1 : 0,
    updatedAt: Date.now(),
  };
  db.prepare(
    `UPDATE players SET username=@username, password_hash=@passwordHash, email=@email,
       session_version = session_version + @sessionBump, updated_at=@updatedAt WHERE id=@id`
  ).run(next);
  return getPlayerById(id)!;
}

/** The account's current session version (see `session_version`), or `null` if the account no longer exists. */
export function getPlayerSessionVersion(id: string): number | null {
  const row = db.prepare('SELECT session_version FROM players WHERE id = ?').get(id) as
    | { session_version: number }
    | undefined;
  return row ? row.session_version : null;
}

/** Same as `getPlayerSessionVersion`, for admin accounts. */
export function getAdminSessionVersion(id: string): number | null {
  const row = db.prepare('SELECT session_version FROM admin_users WHERE id = ?').get(id) as
    | { session_version: number }
    | undefined;
  return row ? row.session_version : null;
}

export function deletePlayer(id: string): void {
  if (!getPlayerById(id)) throw new PlayerNotFoundError(`player "${id}" not found`);
  db.prepare('DELETE FROM players WHERE id = ?').run(id);
}

/* --------------------------------------------------------- password resets */

export interface PasswordResetRow {
  id: string;
  playerId: string;
  codeHash: string;
  attempts: number;
  expiresAt: number;
  usedAt: number | null;
  createdAt: number;
}

function rowToPasswordReset(r: any): PasswordResetRow {
  return {
    id: r.id,
    playerId: r.player_id,
    codeHash: r.code_hash,
    attempts: r.attempts,
    expiresAt: r.expires_at,
    usedAt: r.used_at ?? null,
    createdAt: r.created_at,
  };
}

export interface CreatePasswordResetInput {
  playerId: string;
  codeHash: string;
  expiresAt: number;
}

/**
 * A fresh request always supersedes any code already outstanding for that
 * player — deleting prior unused rows first means at most one code is ever
 * valid at a time, so an old code a player already saw (or that leaked) is
 * dead the moment they ask for a new one.
 */
export function createPasswordReset(input: CreatePasswordResetInput): PasswordResetRow {
  const id = crypto.randomUUID();
  const now = Date.now();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM password_resets WHERE player_id = ? AND used_at IS NULL').run(input.playerId);
    db.prepare(
      `INSERT INTO password_resets (id, player_id, code_hash, expires_at, created_at)
       VALUES (@id, @playerId, @codeHash, @expiresAt, @now)`
    ).run({ id, ...input, now });
  });
  tx();
  return rowToPasswordReset(db.prepare('SELECT * FROM password_resets WHERE id = ?').get(id));
}

/** The one code a player could still redeem right now — unused and not yet expired. `null` covers "never requested," "already used" and "expired" alike, since a route only ever needs to tell those apart from "still live." */
export function getActivePasswordReset(playerId: string): PasswordResetRow | null {
  const row = db
    .prepare(
      `SELECT * FROM password_resets
       WHERE player_id = ? AND used_at IS NULL AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(playerId, Date.now());
  return row ? rowToPasswordReset(row) : null;
}

export function incrementPasswordResetAttempts(id: string): void {
  db.prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?').run(id);
}

/**
 * Marks a code redeemed so it can never be replayed, even if it hasn't
 * expired yet — and reports whether this caller was the one that redeemed
 * it. The `used_at IS NULL` guard makes the claim atomic: two requests
 * racing with the same valid code both reach this, but only one flips the
 * row, so the route must claim *before* its own `await` (password hashing),
 * not after, or both would get through.
 */
export function claimPasswordReset(id: string): boolean {
  const now = Date.now();
  const result = db
    .prepare('UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?')
    .run(now, id, now);
  return result.changes === 1;
}

/* ------------------------------------------------------- wallet + sessions */

export class PaymentNotFoundError extends Error {}
export class GameSessionNotFoundError extends Error {}
export class InsufficientCreditsError extends Error {}
export class NoTitlesAvailableError extends Error {}

function rowToPayment(r: any): PaymentRow {
  return {
    id: r.id,
    playerId: r.player_id,
    credits: r.credits,
    amountFils: r.amount_fils,
    currency: r.currency,
    provider: r.provider,
    providerRef: r.provider_ref ?? null,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToGameSession(r: any): GameSessionRow {
  const mode: GameMode = r.mode === 'modified' ? 'modified' : 'classic';
  if (mode === 'modified') {
    const { rounds, stacks } = JSON.parse(r.titles_json) as { rounds: number; stacks: DealtStacks };
    return {
      id: r.id,
      playerId: r.player_id,
      mode,
      rounds,
      stacks,
      titles: [...stacks.easy, ...stacks.medium, ...stacks.hard],
      createdAt: r.created_at,
    };
  }
  return {
    id: r.id,
    playerId: r.player_id,
    mode,
    titles: JSON.parse(r.titles_json),
    createdAt: r.created_at,
  };
}

export function getPayment(id: string): PaymentRow | null {
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  return row ? rowToPayment(row) : null;
}

export interface GameSessionSummary {
  id: string;
  mode: GameMode;
  createdAt: number;
}

/** A player's games, newest first — id, mode and start time only (never the dealt titles, which a player must not be able to read back). */
export function listGameSessionsForPlayer(playerId: string, limit = 100): GameSessionSummary[] {
  return (
    db
      .prepare('SELECT id, mode, created_at FROM game_sessions WHERE player_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(playerId, limit) as { id: string; mode: string; created_at: number }[]
  ).map((r) => ({ id: r.id, mode: r.mode === 'modified' ? 'modified' : 'classic', createdAt: r.created_at }));
}

export function listPaymentsForPlayer(playerId: string): PaymentRow[] {
  return db
    .prepare('SELECT * FROM payments WHERE player_id = ? ORDER BY created_at DESC')
    .all(playerId)
    .map(rowToPayment);
}

export function getGameSession(id: string): GameSessionRow | null {
  const row = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(id);
  return row ? rowToGameSession(row) : null;
}

/** Sum of grants minus sum of consumes. Never a stored counter, so it can never drift from its own history. */
export function creditBalance(playerId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN kind = 'grant' THEN amount WHEN kind = 'consume' THEN -amount END), 0) AS balance
       FROM credit_transactions WHERE player_id = ?`
    )
    .get(playerId) as { balance: number };
  return row.balance;
}

/**
 * Grants credits with no backing payment. A real player only ever gets
 * credits by paying (see `confirmPayment`) or via the one-time signup bonus
 * (see `grantSignupBonus`) — this general form exists for the
 * `create-test-player` script, so testing "a player with N games left"
 * doesn't require N manual top-ups through the checkout flow first.
 */
export function grantCredits(playerId: string, amount: number): void {
  db.prepare(
    `INSERT INTO credit_transactions (id, player_id, kind, amount, created_at)
     VALUES (@id, @playerId, 'grant', @amount, @now)`
  ).run({ id: crypto.randomUUID(), playerId, amount, now: Date.now() });
  rearmLowBalanceNotice(playerId);
}

/** Below this many games left (paid plus free), the player is warned and emailed. */
export const LOW_BALANCE_THRESHOLD = 2;

/** Every game the player can still start: paid credits plus unspent free signup games. */
export function gamesLeft(playerId: string): number {
  return creditBalance(playerId) + (getPlayerById(playerId)?.freeGameCredits ?? 0);
}

/**
 * Claims the right to send this player's low-balance email: returns what
 * the email needs when they are under `LOW_BALANCE_THRESHOLD`, have an
 * email on file, and haven't been told yet during this dip — otherwise
 * `null`. The conditional UPDATE is the lock, so two concurrent callers
 * can never both get a non-null answer.
 */
export function claimLowBalanceNotice(playerId: string): { to: string; username: string; gamesLeft: number } | null {
  const player = getPlayerById(playerId);
  if (!player?.email) return null;
  const left = gamesLeft(playerId);
  if (left >= LOW_BALANCE_THRESHOLD) return null;
  const claimed = db
    .prepare('UPDATE players SET low_balance_notified_at = ? WHERE id = ? AND low_balance_notified_at IS NULL')
    .run(Date.now(), playerId);
  return claimed.changes === 1 ? { to: player.email, username: player.username, gamesLeft: left } : null;
}

/** Gives back a claim whose email could not be sent, so the next game tries again. */
export function releaseLowBalanceNotice(playerId: string): void {
  db.prepare('UPDATE players SET low_balance_notified_at = NULL WHERE id = ?').run(playerId);
}

/** Re-arms the low-balance email once a player is back at or over the threshold. */
function rearmLowBalanceNotice(playerId: string): void {
  if (gamesLeft(playerId) >= LOW_BALANCE_THRESHOLD) releaseLowBalanceNotice(playerId);
}

/**
 * One-time new-account bonus: this many games, free, before any paid credit
 * is touched (see `free_game_credits` on the players table and
 * `startGameSession`). Each one covers a game of either mode, so a player
 * can spend them as two classic, two modified, or one of each.
 */
const SIGNUP_FREE_GAMES = 2;

/**
 * Grants the one-time signup bonus. Only ever called once per account, right
 * after `createPlayer` in the `/players/register` route — nothing else
 * calls this, so there's no separate de-duplication to do here beyond that.
 * A plain counter, not a `credit_transactions` grant: it's a free
 * entitlement, kept apart from the paid wallet balance so the payment
 * ledger only ever records real money.
 */
export function grantSignupBonus(playerId: string): number {
  db.prepare('UPDATE players SET free_game_credits = ? WHERE id = ?').run(SIGNUP_FREE_GAMES, playerId);
  return SIGNUP_FREE_GAMES;
}

export interface CreatePaymentInput {
  playerId: string;
  provider: string;
  /** Which mode's price to charge — the resulting credit itself is still usable for either mode once granted (see `confirmPayment`). */
  mode: GameMode;
}

/** Starts a checkout for exactly one game's worth of credit, at the given mode's current price. No credits exist yet — those are only ever created by `confirmPayment`. */
export function createPayment(input: CreatePaymentInput): PaymentRow {
  const now = Date.now();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO payments (id, player_id, credits, amount_fils, currency, provider, status, created_at, updated_at)
     VALUES (@id, @playerId, 1, @amountFils, 'KWD', @provider, 'initiated', @now, @now)`
  ).run({
    id,
    playerId: input.playerId,
    amountFils: getGamePriceFilsForMode(input.mode),
    provider: input.provider,
    now,
  });
  return getPayment(id)!;
}

/**
 * Idempotent: a real payment provider's webhook can fire more than once for
 * the same event, and this must never grant credits twice for it. The
 * conditional `UPDATE ... WHERE status='initiated'` is the lock — it can
 * only ever succeed once per payment, so the credit grant that follows it
 * inside the same transaction only ever runs once too. Confirming an
 * already-paid payment is a harmless no-op, not an error.
 */
export function confirmPayment(paymentId: string): { payment: PaymentRow; balance: number } {
  const payment = getPayment(paymentId);
  if (!payment) throw new PaymentNotFoundError(`payment "${paymentId}" not found`);

  const tx = db.transaction(() => {
    const now = Date.now();
    const result = db
      .prepare(`UPDATE payments SET status = 'paid', updated_at = @now WHERE id = @id AND status = 'initiated'`)
      .run({ id: paymentId, now });

    if (result.changes === 1) {
      db.prepare(
        `INSERT INTO credit_transactions (id, player_id, kind, amount, payment_id, created_at)
         VALUES (@id, @playerId, 'grant', @amount, @paymentId, @now)`
      ).run({ id: crypto.randomUUID(), playerId: payment.playerId, amount: payment.credits, paymentId, now });
    }
  });
  tx.immediate();
  rearmLowBalanceNotice(payment.playerId);

  return { payment: getPayment(paymentId)!, balance: creditBalance(payment.playerId) };
}

/** Records the gateway's own id for a payment once checkout has created it there. Set once; never overwritten. */
export function setPaymentProviderRef(paymentId: string, providerRef: string): void {
  db.prepare('UPDATE payments SET provider_ref = ?, updated_at = ? WHERE id = ? AND provider_ref IS NULL').run(
    providerRef,
    Date.now(),
    paymentId
  );
}

/** Also idempotent, via the same conditional-UPDATE lock — no credits are ever issued for a failed payment. */
export function failPayment(paymentId: string): PaymentRow {
  const payment = getPayment(paymentId);
  if (!payment) throw new PaymentNotFoundError(`payment "${paymentId}" not found`);
  db.prepare(`UPDATE payments SET status = 'failed', updated_at = @now WHERE id = @id AND status = 'initiated'`).run(
    { id: paymentId, now: Date.now() }
  );
  return getPayment(paymentId)!;
}

/** Fisher-Yates, in place on a copy — used to deal a session's titles. */
function shuffled<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const TITLES_PER_SESSION = 20;
/** Rounds per modified-mode game — and so the most titles any one level's stack ever needs, since a team may pick the same level every round. */
const ROUNDS_PER_SESSION = 20;

/**
 * Deals up to `count` titles round-robin across every deck the player chose
 * (`deckIds`), so two consecutive rounds never share a category unless only
 * one deck still has titles left (unavoidable once every other category is
 * exhausted). Deduplicated by trimmed text so the same title text appearing
 * in two different decks still only ever occupies one slot in a session (see
 * "never repeated in the same game" on `startGameSession`). Which deck goes
 * first, and which title comes out of each deck, are both random. Classic
 * mode only.
 *
 * `difficulty` other than `mixed` deals only titles at that level first;
 * if the chosen decks hold fewer than `count` of them, the rest of the
 * game is topped up from the nearest level (medium for easy or hard, then
 * the far one), so a game still gets its full count of rounds rather than
 * ending early.
 */
function dealTitles(count: number, deckIds?: string[], difficulty: ClassicDifficulty = 'mixed'): DealtTitle[] {
  const decks = shuffled(listPlayableDecks(deckIds));
  if (difficulty === 'mixed') return dealRoundRobin(count, decks, () => true, new Set<string>());
  const order =
    difficulty === 'medium'
      ? (['medium', 'easy', 'hard'] as const)
      : difficulty === 'easy'
        ? (['easy', 'medium', 'hard'] as const)
        : (['hard', 'medium', 'easy'] as const);
  const seenText = new Set<string>();
  const dealt: DealtTitle[] = [];
  for (const level of order) {
    if (dealt.length >= count) break;
    dealt.push(
      ...dealRoundRobin(count - dealt.length, decks, (deck, title) => effectiveDifficulty(deck.difficulty, title) === level, seenText)
    );
  }
  return dealt;
}

/** The round-robin core of `dealTitles`: up to `count` titles passing `keep`, one deck at a time, skipping any text already in `seenText` (which it adds to). */
function dealRoundRobin(
  count: number,
  decks: DeckWithTitles[],
  keep: (deck: DeckWithTitles, title: DeckWithTitles['titles'][number]) => boolean,
  seenText: Set<string>
): DealtTitle[] {
  let queues = decks
    .map((deck) => {
      const titles: DealtTitle[] = [];
      for (const title of deck.titles) {
        if (!keep(deck, title)) continue;
        const text = title.text.trim();
        if (seenText.has(text)) continue;
        seenText.add(text);
        titles.push({
          id: title.id,
          text: title.text,
          deckId: deck.id,
          deckNameAr: deck.nameAr,
          deckNameEn: deck.nameEn,
          imageUrl: title.imagePath ?? undefined,
        });
      }
      return shuffled(titles);
    })
    .filter((titles) => titles.length > 0);

  const dealt: DealtTitle[] = [];
  while (dealt.length < count && queues.length > 0) {
    for (const queue of queues) {
      if (dealt.length >= count) break;
      dealt.push(queue.shift()!);
    }
    queues = queues.filter((queue) => queue.length > 0);
  }
  return dealt;
}

/**
 * Deals up to `count` titles into each level's stack, round-robin across
 * every deck the player chose (`deckIds`), so two consecutive picks of the
 * same level never share a category unless only one deck still has titles
 * left at that level. Deduplicated by trimmed text across all three stacks,
 * so the same title text appearing in two different decks (or at two
 * levels) still only ever occupies one slot in a session. Which deck goes
 * first, and which title comes out of each deck, are both random. A level
 * no chosen deck has any titles at simply gets an empty stack — the app
 * greys that choice out. Modified mode only.
 */
function dealStacks(count: number, deckIds?: string[]): DealtStacks {
  const seenText = new Set<string>();
  const decks = shuffled(listPlayableDecks(deckIds));
  const stacks: DealtStacks = { easy: [], medium: [], hard: [] };

  for (const level of DIFFICULTIES) {
    let queues = decks
      .map((deck) => {
        const titles: DealtTitle[] = [];
        for (const title of deck.titles) {
          if (effectiveDifficulty(deck.difficulty, title) !== level) continue;
          const text = title.text.trim();
          if (seenText.has(text)) continue;
          seenText.add(text);
          titles.push({
            id: title.id,
            text: title.text,
            deckId: deck.id,
            deckNameAr: deck.nameAr,
            deckNameEn: deck.nameEn,
            imageUrl: title.imagePath ?? undefined,
            difficulty: level,
          });
        }
        return shuffled(titles);
      })
      .filter((titles) => titles.length > 0);

    const dealt = stacks[level];
    while (dealt.length < count && queues.length > 0) {
      for (const queue of queues) {
        if (dealt.length >= count) break;
        dealt.push(queue.shift()!);
      }
      queues = queues.filter((queue) => queue.length > 0);
    }
  }
  return stacks;
}

/**
 * Spends one credit to deal `sessionId` — the client's own locally
 * generated id, created once at "start game" time. Idempotent by
 * construction: `game_sessions.id` is a primary key, so calling this again
 * with the same id (e.g. resuming after an app restart) returns the same
 * dealt session and spends nothing further, rather than erroring or
 * charging twice.
 *
 * `mode` picks the rule set: classic deals a flat 20 titles via
 * `dealTitles`; modified deals three stacks via `dealStacks`, one per
 * difficulty level, and the acting team picks a level each round. Either
 * way, the player picks which decks to draw from, not individual titles,
 * and nothing repeats within the same session even across decks.
 *
 * Spending is the same for both modes: a session first draws down the
 * account's free signup games (`free_game_credits`, set once at
 * registration — see `grantSignupBonus`) before ever touching the paid
 * wallet balance. Whatever the mode, `deckIds` is the player's own
 * explicit choice made alongside the team names when drafting; omitted
 * entirely (never an empty array — see `parseStartSessionBody`) only for
 * direct callers that predate per-deck selection (tests, scripts), meaning
 * every playable deck.
 */
export function startGameSession(
  playerId: string,
  sessionId: string,
  deckIds: string[] | undefined,
  mode: GameMode,
  difficulty: ClassicDifficulty = 'mixed'
): { session: GameSessionRow; balance: number } {
  const existing = getGameSession(sessionId);
  if (existing) {
    if (existing.playerId !== playerId) throw new GameSessionNotFoundError(`session "${sessionId}" not found`);
    return { session: existing, balance: creditBalance(playerId) };
  }

  let titlesJson: string;
  let firstDeckId: string;
  if (mode === 'modified') {
    const stacks = dealStacks(ROUNDS_PER_SESSION, deckIds);
    const dealtCount = stacks.easy.length + stacks.medium.length + stacks.hard.length;
    if (dealtCount === 0) throw new NoTitlesAvailableError('no titles are available to deal yet');
    const rounds = Math.min(ROUNDS_PER_SESSION, dealtCount);
    const firstDealt = stacks.easy[0] ?? stacks.medium[0] ?? stacks.hard[0];
    titlesJson = JSON.stringify({ rounds, stacks });
    firstDeckId = firstDealt.deckId;
  } else {
    const dealt = dealTitles(TITLES_PER_SESSION, deckIds, difficulty);
    if (dealt.length === 0) throw new NoTitlesAvailableError('no titles are available to deal yet');
    titlesJson = JSON.stringify(dealt);
    firstDeckId = dealt[0].deckId;
  }

  const tx = db.transaction(() => {
    const player = getPlayerById(playerId)!;
    const spendFreeGame = player.freeGameCredits > 0;
    if (spendFreeGame) {
      db.prepare('UPDATE players SET free_game_credits = free_game_credits - 1 WHERE id = ? AND free_game_credits > 0').run(
        playerId
      );
    } else if (creditBalance(playerId) < 1) {
      throw new InsufficientCreditsError('not enough credits to start a game — top up your wallet first');
    }
    const now = Date.now();
    db.prepare(
      `INSERT INTO game_sessions (id, player_id, deck_id, mode, titles_json, created_at)
       VALUES (@id, @playerId, @deckId, @mode, @titlesJson, @now)`
      // `deck_id` is a schema leftover from when a session belonged to one
      // deck — kept NOT NULL, so it's set to whichever deck happened to
      // deal the first title. Never read back; `GameSessionRow` exposes no
      // such field now that a session spans every deck.
    ).run({ id: sessionId, playerId, deckId: firstDeckId, mode, titlesJson, now });
    if (!spendFreeGame) {
      db.prepare(
        `INSERT INTO credit_transactions (id, player_id, kind, amount, game_session_id, created_at)
         VALUES (@id, @playerId, 'consume', 1, @sessionId, @now)`
      ).run({ id: crypto.randomUUID(), playerId, sessionId, now });
    }
  });
  tx.immediate();

  return { session: getGameSession(sessionId)!, balance: creditBalance(playerId) };
}

export class RevealTokenNotFoundError extends Error {}
export class RevealTokenAlreadyUsedError extends Error {}

/** Minted right before the handoff screen's QR code is shown, one per round. */
export function createRevealToken(gameSessionId: string, payload: RevealPayload): { id: string } {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO reveal_tokens (id, game_session_id, payload_json, created_at)
     VALUES (@id, @gameSessionId, @payloadJson, @now)`
  ).run({ id, gameSessionId, payloadJson: JSON.stringify(payload), now: Date.now() });
  return { id };
}

/**
 * Marks a reveal token used and returns the payload it was minted with — but
 * only the first caller ever gets it. The `used_at IS NULL` in the UPDATE's
 * WHERE clause makes the claim atomic: two requests racing for the same
 * token can both run this, but SQLite serializes the writes, so only one of
 * them ever actually flips the row (and sees `changes === 1`) — the other
 * sees 0 and throws, exactly as if it had arrived after the first.
 */
export function claimRevealToken(id: string): RevealPayload {
  const row = db.prepare('SELECT payload_json FROM reveal_tokens WHERE id = ?').get(id) as
    | { payload_json: string }
    | undefined;
  if (!row) throw new RevealTokenNotFoundError(`reveal token "${id}" not found`);
  const result = db.prepare('UPDATE reveal_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL').run(Date.now(), id);
  if (result.changes === 0) throw new RevealTokenAlreadyUsedError(`reveal token "${id}" was already used`);
  return JSON.parse(row.payload_json) as RevealPayload;
}

/* --------------------------------------------------------------- audit log */

export interface RecordAuditInput {
  actorId: string;
  actorUsername: string;
  action: string;
  target: string;
  before?: unknown;
  after?: unknown;
}

function rowToAuditLog(r: any): AuditLogRow {
  return {
    id: r.id,
    actorId: r.actor_id,
    actorUsername: r.actor_username,
    action: r.action,
    target: r.target,
    before: r.before_json ? JSON.parse(r.before_json) : null,
    after: r.after_json ? JSON.parse(r.after_json) : null,
    createdAt: r.created_at,
  };
}

/** Fire-and-forget from a route's point of view — never throws, since a logging failure must never block (or roll back) the action it's logging. */
export function recordAudit(input: RecordAuditInput): void {
  try {
    db.prepare(
      `INSERT INTO audit_log (id, actor_id, actor_username, action, target, before_json, after_json, created_at)
       VALUES (@id, @actorId, @actorUsername, @action, @target, @beforeJson, @afterJson, @now)`
    ).run({
      id: crypto.randomUUID(),
      actorId: input.actorId,
      actorUsername: input.actorUsername,
      action: input.action,
      target: input.target,
      beforeJson: input.before !== undefined ? JSON.stringify(input.before) : null,
      afterJson: input.after !== undefined ? JSON.stringify(input.after) : null,
      now: Date.now(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('recordAudit failed', err);
  }
}

/** `rowid DESC` breaks ties when two entries land in the same millisecond — `created_at` alone isn't fine-grained enough to order those. */
export function listAuditLog(limit = 200): AuditLogRow[] {
  return db
    .prepare('SELECT * FROM audit_log ORDER BY created_at DESC, rowid DESC LIMIT ?')
    .all(limit)
    .map(rowToAuditLog);
}

export function resetDbForTests(): void {
  db.exec(
    `DELETE FROM audit_log; DELETE FROM credit_transactions; DELETE FROM reveal_tokens; DELETE FROM game_sessions;
     DELETE FROM payments; DELETE FROM password_resets; DELETE FROM titles; DELETE FROM decks;
     DELETE FROM admin_users; DELETE FROM players;`
  );
  db.prepare(
    `UPDATE settings SET
       game_price_fils = @gamePriceFils,
       home_tagline_ar = @taglineAr,
       home_tagline_en = @taglineEn,
       home_writeup_ar = @writeupAr,
       home_writeup_en = @writeupEn
     WHERE id = 1`
  ).run({ gamePriceFils: DEFAULT_GAME_PRICE_FILS, ...DEFAULT_HOME_CONTENT });
  updateBranding(DEFAULT_BRANDING);
}
