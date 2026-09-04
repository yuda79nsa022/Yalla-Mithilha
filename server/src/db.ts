import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import type {
  AdminUserRow,
  AuditLogRow,
  ContentReportRow,
  DeckRow,
  DeckWithTitles,
  GameSessionRow,
  PaymentRow,
  PlayerRow,
  ReportStatus,
  SubmitReportInput,
  TitleRow,
} from './types';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, 'catalogue.sqlite');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const DEFAULT_GAME_PRICE_FILS = 1500; // 1.500 KD, the admin's own starting price

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
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
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

  -- One row per purchased charades session — 10 titles dealt from one deck
  -- the moment a wallet credit was spent. Its id is the client's own
  -- locally-generated session id, generated once at "start game" time — that
  -- shared identity is what makes spending idempotent: resuming an
  -- interrupted session replays the same id and never spends a second credit.
  CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    deck_id TEXT NOT NULL REFERENCES decks(id),
    titles_json TEXT NOT NULL,
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

  -- Party Game card reports, synced from the app's on-device offline queue.
  -- id is the client's own report id, so a retried sync of an
  -- already-received report is naturally a no-op (INSERT OR IGNORE) rather
  -- than a duplicate row. No player identity of any kind is stored here —
  -- reporting never requires an account.
  CREATE TABLE IF NOT EXISTS content_reports (
    id TEXT PRIMARY KEY,
    prompt_id TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('unclear','translation','not_funny','inappropriate','too_hard','duplicate')),
    lang TEXT NOT NULL,
    app_version TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
    created_at INTEGER NOT NULL,
    received_at INTEGER NOT NULL
  );
`);

db.prepare('INSERT OR IGNORE INTO settings (id, game_price_fils) VALUES (1, ?)').run(DEFAULT_GAME_PRICE_FILS);

/* --------------------------------------------------------------- settings */

export function getGamePriceFils(): number {
  const row = db.prepare('SELECT game_price_fils FROM settings WHERE id = 1').get() as { game_price_fils: number };
  return row.game_price_fils;
}

export function setGamePriceFils(fils: number): number {
  db.prepare('UPDATE settings SET game_price_fils = ? WHERE id = 1').run(fils);
  return getGamePriceFils();
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
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToTitle(r: any): TitleRow {
  return {
    id: r.id,
    deckId: r.deck_id,
    text: r.text,
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
}

export function createDeck(input: CreateDeckInput): DeckWithTitles {
  if (getDeck(input.id)) throw new DuplicateDeckError(`deck "${input.id}" already exists`);
  const now = Date.now();
  db.prepare(
    `INSERT INTO decks (id, name_ar, name_en, created_at, updated_at) VALUES (@id, @nameAr, @nameEn, @now, @now)`
  ).run({ ...input, now });
  return getDeck(input.id)!;
}

export interface UpdateDeckInput {
  nameAr?: string;
  nameEn?: string;
}

export function updateDeck(id: string, input: UpdateDeckInput): DeckWithTitles {
  const existing = getDeck(id);
  if (!existing) throw new DeckNotFoundError(`deck "${id}" not found`);
  const next = { ...existing, ...input, updatedAt: Date.now() };
  db.prepare('UPDATE decks SET name_ar=@nameAr, name_en=@nameEn, updated_at=@updatedAt WHERE id=@id').run(next);
  return getDeck(id)!;
}

export function deleteDeck(id: string): void {
  const result = db.prepare('DELETE FROM decks WHERE id = ?').run(id);
  if (result.changes === 0) throw new DeckNotFoundError(`deck "${id}" not found`);
}

/**
 * Appends titles to a deck, skipping exact (trimmed) duplicates already in
 * it — no fixed slot count to fill, unlike the old board-game import, so
 * every non-duplicate, non-empty line just gets added.
 */
export function addTitlesToDeck(deckId: string, titles: string[]): { added: number; skipped: number } {
  const deck = getDeck(deckId);
  if (!deck) throw new DeckNotFoundError(`deck "${deckId}" not found`);

  const existing = new Set(deck.titles.map((t) => t.text.trim()));
  const stmt = db.prepare('INSERT INTO titles (id, deck_id, text, created_at) VALUES (@id, @deckId, @text, @now)');
  let added = 0;
  const tx = db.transaction(() => {
    for (const raw of titles) {
      const text = raw.trim();
      if (!text || existing.has(text)) continue;
      existing.add(text);
      stmt.run({ id: crypto.randomUUID(), deckId, text, now: Date.now() });
      added++;
    }
    db.prepare('UPDATE decks SET updated_at = ? WHERE id = ?').run(Date.now(), deckId);
  });
  tx();

  return { added, skipped: titles.length - added };
}

export function deleteTitle(deckId: string, titleId: string): void {
  const result = db.prepare('DELETE FROM titles WHERE id = ? AND deck_id = ?').run(titleId, deckId);
  if (result.changes === 0) throw new TitleNotFoundError(`title "${titleId}" not found in deck "${deckId}"`);
}

/** Decks the app is ever allowed to draft from — nothing to publish/complete separately, a deck with at least one title is playable. */
export function listPlayableDecks(): DeckWithTitles[] {
  return listDecks().filter((d) => d.titles.length > 0);
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
    updatedAt: Date.now(),
  };
  db.prepare(
    'UPDATE admin_users SET username=@username, password_hash=@passwordHash, updated_at=@updatedAt WHERE id=@id'
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
}

export function createPlayer(input: CreatePlayerInput): PlayerRow {
  if (getPlayerByUsernameWithHash(input.username)) {
    throw new DuplicatePlayerUsernameError(`username "${input.username}" is already taken`);
  }
  const now = Date.now();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO players (id, username, password_hash, created_at, updated_at)
     VALUES (@id, @username, @passwordHash, @now, @now)`
  ).run({ id, ...input, now });
  return getPlayerById(id)!;
}

export interface UpdatePlayerInput {
  username?: string;
  passwordHash?: string;
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
    updatedAt: Date.now(),
  };
  db.prepare(
    'UPDATE players SET username=@username, password_hash=@passwordHash, updated_at=@updatedAt WHERE id=@id'
  ).run(next);
  return getPlayerById(id)!;
}

export function deletePlayer(id: string): void {
  if (!getPlayerById(id)) throw new PlayerNotFoundError(`player "${id}" not found`);
  db.prepare('DELETE FROM players WHERE id = ?').run(id);
}

/* ------------------------------------------------------- wallet + sessions */

export class PaymentNotFoundError extends Error {}
export class GameSessionNotFoundError extends Error {}
export class InsufficientCreditsError extends Error {}
export class EmptyDeckError extends Error {}

function rowToPayment(r: any): PaymentRow {
  return {
    id: r.id,
    playerId: r.player_id,
    credits: r.credits,
    amountFils: r.amount_fils,
    currency: r.currency,
    provider: r.provider,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToGameSession(r: any): GameSessionRow {
  return {
    id: r.id,
    playerId: r.player_id,
    deckId: r.deck_id,
    titles: JSON.parse(r.titles_json),
    createdAt: r.created_at,
  };
}

export function getPayment(id: string): PaymentRow | null {
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  return row ? rowToPayment(row) : null;
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

export interface CreatePaymentInput {
  playerId: string;
  provider: string;
}

/** Starts a checkout for exactly one game's worth of credit, at the current price. No credits exist yet — those are only ever created by `confirmPayment`. */
export function createPayment(input: CreatePaymentInput): PaymentRow {
  const now = Date.now();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO payments (id, player_id, credits, amount_fils, currency, provider, status, created_at, updated_at)
     VALUES (@id, @playerId, 1, @amountFils, 'KWD', @provider, 'initiated', @now, @now)`
  ).run({
    id,
    playerId: input.playerId,
    amountFils: getGamePriceFils(),
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
  tx();

  return { payment: getPayment(paymentId)!, balance: creditBalance(payment.playerId) };
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

const TITLES_PER_SESSION = 10;

/**
 * Spends one wallet credit to deal `sessionId` — the client's own locally
 * generated id, created once at "start game" time. Idempotent by
 * construction: `game_sessions.id` is a primary key, so calling this again
 * with the same id (e.g. resuming after an app restart) returns the same
 * dealt titles and spends nothing further, rather than erroring or charging
 * twice. Titles are drawn without replacement from the deck; a deck with
 * fewer than 10 titles just deals all of it.
 */
export function startGameSession(
  playerId: string,
  sessionId: string,
  deckId: string
): { session: GameSessionRow; balance: number } {
  const existing = getGameSession(sessionId);
  if (existing) {
    if (existing.playerId !== playerId) throw new GameSessionNotFoundError(`session "${sessionId}" not found`);
    return { session: existing, balance: creditBalance(playerId) };
  }

  const deck = getDeck(deckId);
  if (!deck) throw new DeckNotFoundError(`deck "${deckId}" not found`);
  if (deck.titles.length === 0) throw new EmptyDeckError(`deck "${deckId}" has no titles yet`);

  const tx = db.transaction(() => {
    if (creditBalance(playerId) < 1) {
      throw new InsufficientCreditsError('not enough credits to start a game — top up your wallet first');
    }
    const dealt = shuffled(deck.titles).slice(0, TITLES_PER_SESSION);
    const now = Date.now();
    db.prepare(
      `INSERT INTO game_sessions (id, player_id, deck_id, titles_json, created_at)
       VALUES (@id, @playerId, @deckId, @titlesJson, @now)`
    ).run({ id: sessionId, playerId, deckId, titlesJson: JSON.stringify(dealt), now });
    db.prepare(
      `INSERT INTO credit_transactions (id, player_id, kind, amount, game_session_id, created_at)
       VALUES (@id, @playerId, 'consume', 1, @sessionId, @now)`
    ).run({ id: crypto.randomUUID(), playerId, sessionId, now });
  });
  tx();

  return { session: getGameSession(sessionId)!, balance: creditBalance(playerId) };
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

function rowToContentReport(r: any): ContentReportRow {
  return {
    id: r.id,
    promptId: r.prompt_id,
    reason: r.reason,
    lang: r.lang,
    appVersion: r.app_version,
    status: r.status,
    createdAt: r.created_at,
    receivedAt: r.received_at,
  };
}

/**
 * Idempotent per report id — a retried sync of the app's offline queue
 * (network drop mid-batch, duplicate call) never creates a second row for
 * the same report. Returns how many of the given reports were newly
 * received, which may be fewer than the batch size on a retry.
 */
export function submitContentReports(reports: SubmitReportInput[]): { received: number } {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO content_reports (id, prompt_id, reason, lang, app_version, status, created_at, received_at)
     VALUES (@id, @promptId, @reason, @lang, @appVersion, 'open', @createdAt, @receivedAt)`
  );
  const tx = db.transaction((items: SubmitReportInput[]) => {
    let received = 0;
    for (const r of items) {
      const result = stmt.run({
        id: r.id,
        promptId: r.promptId,
        reason: r.reason,
        lang: r.lang,
        appVersion: r.appVersion ?? null,
        createdAt: r.createdAt,
        receivedAt: Date.now(),
      });
      if (result.changes > 0) received++;
    }
    return received;
  });
  return { received: tx(reports) };
}

export function listContentReports(): ContentReportRow[] {
  return db
    .prepare('SELECT * FROM content_reports ORDER BY created_at DESC, rowid DESC')
    .all()
    .map(rowToContentReport);
}

/** Bulk action, since an admin reviews and resolves a card's reports together — only ever touches currently-open reports, never re-flips one already resolved/dismissed. */
export function setReportStatusForPrompt(promptId: string, status: ReportStatus): { updated: number } {
  const result = db
    .prepare("UPDATE content_reports SET status = @status WHERE prompt_id = @promptId AND status = 'open'")
    .run({ promptId, status });
  return { updated: result.changes };
}

export function resetDbForTests(): void {
  db.exec(
    `DELETE FROM content_reports; DELETE FROM audit_log; DELETE FROM credit_transactions; DELETE FROM game_sessions;
     DELETE FROM payments; DELETE FROM titles; DELETE FROM decks; DELETE FROM admin_users; DELETE FROM players;
     UPDATE settings SET game_price_fils = ${DEFAULT_GAME_PRICE_FILS} WHERE id = 1;`
  );
}
