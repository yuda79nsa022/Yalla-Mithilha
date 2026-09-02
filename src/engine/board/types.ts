/**
 * Domain types for the board-game mode (SeenJeem-style): two teams draft six
 * category decks, then take turns revealing and judging 36 tiles on one
 * shared screen. Sibling to `../engine.ts`, not a variant of it — different
 * rules (fixed two teams, host-judged scoring, no performer rotation).
 */

import type { Team } from '../types';

export type TileMediaType = 'text' | 'image' | 'audio' | 'reorder' | 'dotless';

/** Static tile content, as it lives in a category deck before drafting. */
export interface TileContent {
  /** 0-5, ordered by point value within its category. */
  index: number;
  points: number;
  mediaType: TileMediaType;
  promptAr: string;
  promptEn: string;
  mediaUrl?: string;
  /** Only used by `reorder` tiles: the items in their correct order. */
  reorderItems?: string[];
  answerAr: string;
  answerEn: string;
}

export interface CategoryDeck {
  id: string;
  nameAr: string;
  nameEn: string;
  tier: 'free' | 'paid';
  /** Exactly six tiles. */
  tiles: TileContent[];
}

/** A tile once it is on a drafted board — content plus its live state. */
export interface BoardTile extends TileContent {
  categoryId: string;
  revealed: boolean;
  wonByTeamId: string | null;
}

export interface BoardCategory {
  id: string;
  nameAr: string;
  nameEn: string;
}

export type BoardLock = 'pendingPayment' | 'unlocked' | 'expired';

export interface BoardState {
  lock: BoardLock;
  teams: [Team, Team];
  /** The six drafted decks, metadata only — tile content lives in `tiles`. */
  categories: BoardCategory[];
  /** All 36 tiles, flattened, in no particular render order. */
  tiles: BoardTile[];
  activeTeamId: string;
  scores: Record<string, number>;
  /** The tile currently revealed and awaiting a score, if any. */
  currentTile: { categoryId: string; index: number } | null;
}
