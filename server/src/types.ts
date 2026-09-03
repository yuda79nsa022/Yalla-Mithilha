export type Tier = 'free' | 'paid';
export type ContentLevel = 'kids' | 'family' | 'friends' | 'adults';
export type RegionTag = 'kw' | 'gulf' | 'egypt' | 'global';
export type MediaType = 'text' | 'image' | 'audio' | 'reorder' | 'dotless';

export interface CategoryRow {
  id: string;
  nameAr: string;
  nameEn: string;
  tier: Tier;
  level: ContentLevel;
  region: RegionTag;
  /** Relative path under /uploads, or null. Turned into an absolute URL at the API boundary. */
  imageUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface TileRow {
  id: string;
  categoryId: string;
  index: number;
  points: number;
  mediaType: MediaType;
  promptAr: string;
  promptEn: string;
  mediaUrl: string | null;
  reorderItems: string[] | null;
  answerAr: string;
  answerEn: string;
  needsContent: boolean;
  updatedAt: number;
}

export interface CategoryWithTiles extends CategoryRow {
  tiles: TileRow[];
}

/** Never carries the password hash — that stays inside db.ts. */
export interface AdminUserRow {
  id: string;
  username: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * A game player's optional account — separate from AdminUserRow (a
 * different table, a different session token, a different purpose: this is
 * someone who plays the game, not someone who manages its content). Never
 * carries the password hash.
 */
export interface PlayerRow {
  id: string;
  username: string;
  createdAt: number;
  updatedAt: number;
}

/** The shape the client app's CategoryDeck expects — no admin-only fields. */
export interface PublicCategoryDeck {
  id: string;
  nameAr: string;
  nameEn: string;
  tier: Tier;
  level: ContentLevel;
  region: RegionTag;
  imageUrl?: string;
  tiles: Array<{
    id: string;
    index: number;
    points: number;
    mediaType: MediaType;
    promptAr: string;
    promptEn: string;
    mediaUrl?: string;
    reorderItems?: string[];
    answerAr: string;
    answerEn: string;
  }>;
}

export const POINTS_BY_INDEX = [100, 200, 300, 400, 500, 600];
