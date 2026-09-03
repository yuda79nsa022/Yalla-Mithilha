import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { POINTS_BY_INDEX } from './types';
import type { CategoryRow, CategoryWithTiles, ContentLevel, RegionTag, Tier, TileRow } from './types';

const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

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
`);

function rowToCategory(r: any): CategoryRow {
  return {
    id: r.id,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    tier: r.tier as Tier,
    level: r.level as ContentLevel,
    region: r.region as RegionTag,
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

export function deleteCategory(id: string): void {
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  if (result.changes === 0) throw new CategoryNotFoundError(`category "${id}" not found`);
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

/** Categories where every tile has real content — the only ones the app ever sees. */
export function listCompleteCategories(): CategoryWithTiles[] {
  return listCategories().filter((c) => c.tiles.length === 6 && c.tiles.every((t) => !t.needsContent));
}

export function resetDbForTests(): void {
  db.exec('DELETE FROM tiles; DELETE FROM categories;');
}
