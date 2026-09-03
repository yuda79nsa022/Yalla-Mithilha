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

/**
 * Placeholder pricing, same status as the checkout screen's existing
 * "$6.99 / $12.99" dev-stub labels — real KWD pricing is a business decision
 * for whoever owns the KNET merchant account, not something to infer here.
 */
export const PRODUCTS = {
  single: { credits: 1, amountFils: 2000 },
  bundle2: { credits: 2, amountFils: 3500 },
} as const;
export type ProductId = keyof typeof PRODUCTS;

export type PaymentStatus = 'initiated' | 'paid' | 'failed' | 'cancelled';

export interface PaymentRow {
  id: string;
  playerId: string;
  product: ProductId;
  credits: number;
  amountFils: number;
  currency: string;
  provider: string;
  status: PaymentStatus;
  createdAt: number;
  updatedAt: number;
}

export type BoardGameStatus = 'active' | 'completed' | 'abandoned';

/**
 * A drafted board that was actually paid for. Its id is the client's own
 * local BoardState.id (generated once at draft time) — reusing that shared
 * identity is what makes credit consumption idempotent: resuming an
 * interrupted game never spends a second credit.
 */
export interface BoardGameRow {
  id: string;
  playerId: string;
  status: BoardGameStatus;
  createdAt: number;
  completedAt: number | null;
}
