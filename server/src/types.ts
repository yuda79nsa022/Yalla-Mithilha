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

/** The shape the client app's CategoryDeck expects — no admin-only fields. */
export interface PublicCategoryDeck {
  id: string;
  nameAr: string;
  nameEn: string;
  tier: Tier;
  level: ContentLevel;
  region: RegionTag;
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
