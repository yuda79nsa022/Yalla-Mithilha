import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { POINTS_BY_INDEX, PRODUCTS } from './types';
import type {
  AdminUserRow,
  AuditLogRow,
  BoardGameRow,
  CategoryRow,
  CategoryStatus,
  CategoryWithTiles,
  ContentLevel,
  PaymentRow,
  PlayerRow,
  ProductId,
  ProposedImportFill,
  RegionTag,
  Tier,
  TileRow,
  TitleMatch,
} from './types';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, 'catalogue.sqlite');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('free','paid')),
    level TEXT NOT NULL CHECK (level IN ('kids','family','friends','adults')),
    region TEXT NOT NULL CHECK (region IN ('kw','gulf','egypt','global')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tiles (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    points INTEGER NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'text' CHECK (media_type IN ('text','image','audio','reorder','dotless')),
    prompt_ar TEXT NOT NULL DEFAULT '',
    prompt_en TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    reorder_items TEXT,
    answer_ar TEXT NOT NULL DEFAULT '',
    answer_en TEXT NOT NULL DEFAULT '',
    needs_content INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    UNIQUE (category_id, idx)
  );

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

  -- A paid board-game credit is only ever real once it is owned by an
  -- account, not a device — these three tables are the server-authoritative
  -- source of truth. AsyncStorage never stores a credit balance again.

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    product TEXT NOT NULL CHECK (product IN ('single','bundle2')),
    credits INTEGER NOT NULL,
    amount_fils INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KWD',
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','paid','failed','cancelled')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- One row per drafted board that actually got paid for. Its id is the
  -- client's own local BoardState.id, generated once at draft time — that
  -- shared identity is what makes "consume a credit" idempotent: resuming an
  -- interrupted game replays the same id and never spends a second credit.
  CREATE TABLE IF NOT EXISTS board_games (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
    created_at INTEGER NOT NULL,
    completed_at INTEGER
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
    board_game_id TEXT REFERENCES board_games(id),
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

// Lightweight migration: SQLite has no "ADD COLUMN IF NOT EXISTS" that works
// across the versions this might run against, so just swallow "duplicate
// column" when this has already run once.
try {
  db.exec('ALTER TABLE categories ADD COLUMN image_url TEXT');
} catch {
  // already migrated
}

try {
  db.exec("ALTER TABLE categories ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'");
  // One-time backfill, inside the same try block so it only ever runs the
  // moment this migration first applies: a category that was already
  // complete (and therefore already public under the old completeness-only
  // rule) stays public, rather than silently vanishing from the catalogue
  // until an admin manually republishes everything that already existed.
  // Content created after this point always starts 'draft' regardless of
  // completeness — this backfill is a one-time grandfather clause, not an
  // ongoing rule, and a later admin choice to draft/archive something is
  // never overwritten on a subsequent server start.
  db.exec(`
    UPDATE categories SET status = 'published'
    WHERE id NOT IN (SELECT DISTINCT category_id FROM tiles WHERE needs_content = 1)
  `);
} catch {
  // already migrated
}

function rowToCategory(r: any): CategoryRow {
  return {
    id: r.id,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    tier: r.tier as Tier,
    level: r.level as ContentLevel,
    region: r.region as RegionTag,
    status: r.status as CategoryStatus,
    imageUrl: r.image_url ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToTile(r: any): TileRow {
  return {
    id: r.id,
    categoryId: r.category_id,
    index: r.idx,
    points: r.points,
    mediaType: r.media_type,
    promptAr: r.prompt_ar,
    promptEn: r.prompt_en,
    mediaUrl: r.media_url,
    reorderItems: r.reorder_items ? JSON.parse(r.reorder_items) : null,
    answerAr: r.answer_ar,
    answerEn: r.answer_en,
    needsContent: Boolean(r.needs_content),
    updatedAt: r.updated_at,
  };
}

export function listCategories(): CategoryWithTiles[] {
  const cats = db.prepare('SELECT * FROM categories ORDER BY id').all().map(rowToCategory);
  return cats.map((c) => ({ ...c, tiles: listTiles(c.id) }));
}

export function getCategory(id: string): CategoryWithTiles | null {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!row) return null;
  const c = rowToCategory(row);
  return { ...c, tiles: listTiles(c.id) };
}

export function listTiles(categoryId: string): TileRow[] {
  return db
    .prepare('SELECT * FROM tiles WHERE category_id = ? ORDER BY idx')
    .all(categoryId)
    .map(rowToTile);
}

export class DuplicateCategoryError extends Error {}
export class CategoryNotFoundError extends Error {}
export class InvalidTileIndexError extends Error {}

export interface CreateCategoryInput {
  id: string;
  nameAr: string;
  nameEn: string;
  tier: Tier;
  level: ContentLevel;
  region: RegionTag;
}

/** Creates a category with six empty, `needsContent` tile slots. */
export function createCategory(input: CreateCategoryInput): CategoryWithTiles {
  if (getCategory(input.id)) throw new DuplicateCategoryError(`category "${input.id}" already exists`);
  const now = Date.now();
  const insertCategory = db.prepare(
    `INSERT INTO categories (id, name_ar, name_en, tier, level, region, created_at, updated_at)
     VALUES (@id, @nameAr, @nameEn, @tier, @level, @region, @now, @now)`
  );
  const insertTile = db.prepare(
    `INSERT INTO tiles (id, category_id, idx, points, media_type, needs_content, updated_at)
     VALUES (@id, @categoryId, @idx, @points, 'text', 1, @now)`
  );

  const tx = db.transaction(() => {
    insertCategory.run({ ...input, now });
    for (let idx = 0; idx < 6; idx++) {
      insertTile.run({
        id: `${input.id}-${idx + 1}`,
        categoryId: input.id,
        idx,
        points: POINTS_BY_INDEX[idx],
        now,
      });
    }
  });
  tx();

  return getCategory(input.id)!;
}

export interface UpdateCategoryInput {
  nameAr?: string;
  nameEn?: string;
  tier?: Tier;
  level?: ContentLevel;
  region?: RegionTag;
}

export function updateCategory(id: string, input: UpdateCategoryInput): CategoryWithTiles {
  const existing = getCategory(id);
  if (!existing) throw new CategoryNotFoundError(`category "${id}" not found`);
  const next = { ...existing, ...input, updatedAt: Date.now() };
  db.prepare(
    `UPDATE categories SET name_ar=@nameAr, name_en=@nameEn, tier=@tier, level=@level, region=@region, updated_at=@updatedAt
     WHERE id=@id`
  ).run(next);
  return getCategory(id)!;
}

/** `imageUrl` is the relative /uploads path; `null` clears it. Caller owns the actual file on disk. */
export function setCategoryImage(id: string, imageUrl: string | null): CategoryWithTiles {
  if (!getCategory(id)) throw new CategoryNotFoundError(`category "${id}" not found`);
  db.prepare('UPDATE categories SET image_url=@imageUrl, updated_at=@updatedAt WHERE id=@id').run({
    id,
    imageUrl,
    updatedAt: Date.now(),
  });
  return getCategory(id)!;
}

export function deleteCategory(id: string): void {
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  if (result.changes === 0) throw new CategoryNotFoundError(`category "${id}" not found`);
}

/**
 * Independent of completeness — see `listCompleteCategories`, which is the
 * function that actually decides what `GET /catalogue` returns. Publishing
 * an incomplete category is allowed here; it still won't reach the app.
 */
export function setCategoryStatus(id: string, status: CategoryStatus): CategoryWithTiles {
  if (!getCategory(id)) throw new CategoryNotFoundError(`category "${id}" not found`);
  db.prepare('UPDATE categories SET status=@status, updated_at=@updatedAt WHERE id=@id').run({
    id,
    status,
    updatedAt: Date.now(),
  });
  return getCategory(id)!;
}

export interface UpdateTileInput {
  promptAr?: string;
  promptEn?: string;
  answerAr?: string;
  answerEn?: string;
  mediaType?: TileRow['mediaType'];
  mediaUrl?: string | null;
  reorderItems?: string[] | null;
}

function tileNeedsContent(t: {
  promptAr: string;
  promptEn: string;
  answerAr: string;
  answerEn: string;
}): boolean {
  return !t.promptAr.trim() || !t.promptEn.trim() || !t.answerAr.trim() || !t.answerEn.trim();
}

/** Tile index is 0-5, addressed within its category. */
export function updateTile(categoryId: string, index: number, input: UpdateTileInput): TileRow {
  const category = getCategory(categoryId);
  if (!category) throw new CategoryNotFoundError(`category "${categoryId}" not found`);
  const existing = category.tiles.find((t) => t.index === index);
  if (!existing) throw new InvalidTileIndexError(`tile index ${index} not found in "${categoryId}"`);

  const next = { ...existing, ...input };
  const needsContent = tileNeedsContent(next);
  db.prepare(
    `UPDATE tiles SET prompt_ar=@promptAr, prompt_en=@promptEn, answer_ar=@answerAr, answer_en=@answerEn,
       media_type=@mediaType, media_url=@mediaUrl, reorder_items=@reorderItemsJson, needs_content=@needsContent,
       updated_at=@updatedAt
     WHERE id=@id`
  ).run({
    id: next.id,
    promptAr: next.promptAr,
    promptEn: next.promptEn,
    answerAr: next.answerAr,
    answerEn: next.answerEn,
    mediaType: next.mediaType,
    mediaUrl: next.mediaUrl,
    reorderItemsJson: next.reorderItems ? JSON.stringify(next.reorderItems) : null,
    needsContent: needsContent ? 1 : 0,
    updatedAt: Date.now(),
  });

  return listTiles(categoryId)[index];
}

/** Only fills empty (needsContent) slots, in order, up to how many titles are given. */
export function importTitlesIntoCategory(
  categoryId: string,
  titles: string[]
): { filled: number; skipped: number } {
  const category = getCategory(categoryId);
  if (!category) throw new CategoryNotFoundError(`category "${categoryId}" not found`);

  const emptySlots = category.tiles.filter((t) => t.needsContent);
  const toFill = titles.slice(0, emptySlots.length);

  // Imported lists have been Arabic titles in every case seen so far; the
  // title lands in promptAr, leaving promptEn (and both answers) for the
  // admin to fill in — needs_content stays true either way.
  const stmt = db.prepare(
    `UPDATE tiles SET prompt_ar=@title, needs_content=1, updated_at=@now WHERE id=@id`
  );
  const tx = db.transaction(() => {
    toFill.forEach((title, i) => {
      const slot = emptySlots[i];
      stmt.run({ id: slot.id, title, now: Date.now() });
    });
  });
  tx();

  return { filled: toFill.length, skipped: titles.length - toFill.length };
}

/**
 * Exact-match (trimmed) search across every existing tile's Arabic prompt —
 * used to flag likely duplicates before an import commits. Never used to
 * delete or skip anything automatically; the caller decides what to do with
 * a match.
 */
export function findTitleMatches(titles: string[]): Record<string, TitleMatch[]> {
  const trimmed = Array.from(new Set(titles.map((t) => t.trim()).filter(Boolean)));
  const out: Record<string, TitleMatch[]> = {};
  if (!trimmed.length) return out;

  const placeholders = trimmed.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT t.prompt_ar as promptAr, t.idx as tileIndex, c.id as categoryId, c.name_en as categoryNameEn
       FROM tiles t JOIN categories c ON c.id = t.category_id
       WHERE t.prompt_ar IN (${placeholders})`
    )
    .all(...trimmed) as Array<{ promptAr: string; tileIndex: number; categoryId: string; categoryNameEn: string }>;

  for (const r of rows) {
    (out[r.promptAr] ??= []).push({
      categoryId: r.categoryId,
      categoryNameEn: r.categoryNameEn,
      tileIndex: r.tileIndex,
    });
  }
  return out;
}

/**
 * Computes what `importTitlesIntoCategory` *would* do, without writing
 * anything — the "preview" half of upload → preview → confirm → commit.
 * Slots are recomputed again at commit time rather than trusted from this
 * preview, since another admin could fill one in between the two calls.
 */
export function previewImportForCategory(
  categoryId: string,
  titles: string[]
): { proposed: ProposedImportFill[]; skipped: number } {
  const category = getCategory(categoryId);
  if (!category) throw new CategoryNotFoundError(`category "${categoryId}" not found`);

  const emptySlots = category.tiles.filter((t) => t.needsContent);
  const toFill = titles.slice(0, emptySlots.length);
  const matches = findTitleMatches(toFill);

  const proposed: ProposedImportFill[] = toFill.map((title, i) => ({
    tileId: emptySlots[i].id,
    index: emptySlots[i].index,
    title,
    duplicates: matches[title.trim()] ?? [],
  }));

  return { proposed, skipped: titles.length - toFill.length };
}

/** Categories where every tile has real content AND the admin has explicitly published them — the only ones the app ever sees. */
export function listCompleteCategories(): CategoryWithTiles[] {
  return listCategories().filter(
    (c) => c.status === 'published' && c.tiles.length === 6 && c.tiles.every((t) => !t.needsContent)
  );
}

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

export class PaymentNotFoundError extends Error {}
export class BoardGameNotFoundError extends Error {}
export class InsufficientCreditsError extends Error {}

function rowToPayment(r: any): PaymentRow {
  return {
    id: r.id,
    playerId: r.player_id,
    product: r.product,
    credits: r.credits,
    amountFils: r.amount_fils,
    currency: r.currency,
    provider: r.provider,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToBoardGame(r: any): BoardGameRow {
  return {
    id: r.id,
    playerId: r.player_id,
    status: r.status,
    createdAt: r.created_at,
    completedAt: r.completed_at,
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

export function getBoardGame(id: string): BoardGameRow | null {
  const row = db.prepare('SELECT * FROM board_games WHERE id = ?').get(id);
  return row ? rowToBoardGame(row) : null;
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
  product: ProductId;
  provider: string;
}

/** Starts a checkout. No credits exist yet — those are only ever created by `confirmPayment`. */
export function createPayment(input: CreatePaymentInput): PaymentRow {
  const spec = PRODUCTS[input.product];
  const now = Date.now();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO payments (id, player_id, product, credits, amount_fils, currency, provider, status, created_at, updated_at)
     VALUES (@id, @playerId, @product, @credits, @amountFils, 'KWD', @provider, 'initiated', @now, @now)`
  ).run({
    id,
    playerId: input.playerId,
    product: input.product,
    credits: spec.credits,
    amountFils: spec.amountFils,
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

/**
 * Spends one credit to activate `boardGameId` — the client's own local
 * BoardState.id. Idempotent by construction: `board_games.id` is a primary
 * key, so calling this again with the same id (e.g. resuming an interrupted
 * game after an app restart) returns the existing row and spends nothing
 * further, rather than erroring or charging twice.
 */
export function consumeCreditForBoardGame(
  playerId: string,
  boardGameId: string
): { boardGame: BoardGameRow; balance: number } {
  const existing = getBoardGame(boardGameId);
  if (existing) {
    if (existing.playerId !== playerId) throw new BoardGameNotFoundError(`board game "${boardGameId}" not found`);
    return { boardGame: existing, balance: creditBalance(playerId) };
  }

  const tx = db.transaction(() => {
    if (creditBalance(playerId) < 1) {
      throw new InsufficientCreditsError('not enough credits to start a paid board game');
    }
    const now = Date.now();
    db.prepare('INSERT INTO board_games (id, player_id, status, created_at) VALUES (@id, @playerId, \'active\', @now)').run(
      { id: boardGameId, playerId, now }
    );
    db.prepare(
      `INSERT INTO credit_transactions (id, player_id, kind, amount, board_game_id, created_at)
       VALUES (@id, @playerId, 'consume', 1, @boardGameId, @now)`
    ).run({ id: crypto.randomUUID(), playerId, boardGameId, now });
  });
  tx();

  return { boardGame: getBoardGame(boardGameId)!, balance: creditBalance(playerId) };
}

export function completeBoardGame(playerId: string, boardGameId: string): BoardGameRow {
  const existing = getBoardGame(boardGameId);
  if (!existing || existing.playerId !== playerId) {
    throw new BoardGameNotFoundError(`board game "${boardGameId}" not found`);
  }
  db.prepare("UPDATE board_games SET status = 'completed', completed_at = @now WHERE id = @id").run({
    id: boardGameId,
    now: Date.now(),
  });
  return getBoardGame(boardGameId)!;
}

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
    `DELETE FROM audit_log; DELETE FROM credit_transactions; DELETE FROM board_games; DELETE FROM payments;
     DELETE FROM tiles; DELETE FROM categories; DELETE FROM admin_users; DELETE FROM players;`
  );
}
