export type Tier = 'free' | 'paid';
export type ContentLevel = 'kids' | 'family' | 'friends' | 'adults';
export type RegionTag = 'kw' | 'gulf' | 'egypt' | 'global';
export type MediaType = 'text' | 'image' | 'audio' | 'reorder' | 'dotless';

/**
 * Editorial state, independent of content completeness. A category only
 * ever reaches `GET /catalogue` when it is BOTH `published` AND complete
 * (every tile filled) — the two gates are enforced separately, so an admin
 * publishing an incomplete category by mistake still can't leak it. New
 * categories always start `draft`, imported or not, so nothing publishes
 * itself.
 */
export type CategoryStatus = 'draft' | 'published' | 'archived';

export interface CategoryRow {
  id: string;
  nameAr: string;
  nameEn: string;
  tier: Tier;
  level: ContentLevel;
  region: RegionTag;
  status: CategoryStatus;
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

/** One existing tile whose Arabic prompt exactly matches a title an import is about to add — surfaced so an admin can review it, never deleted automatically. */
export interface TitleMatch {
  categoryId: string;
  categoryNameEn: string;
  tileIndex: number;
}

export interface ProposedImportFill {
  tileId: string;
  index: number;
  title: string;
  duplicates: TitleMatch[];
}

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

export type ReportReason = 'unclear' | 'translation' | 'not_funny' | 'inappropriate' | 'too_hard' | 'duplicate';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

/**
 * A Party Game card report, synced from the app's offline queue. Reporting
 * never requires an account — this table carries only what content
 * moderation needs: which card, why, in what language, from roughly what
 * app version, and when. No player identity of any kind.
 */
export interface ContentReportRow {
  /** The client's own report id — the sync boundary: re-submitting the same id is a no-op, not a duplicate. */
  id: string;
  promptId: string;
  reason: ReportReason;
  lang: string;
  appVersion: string | null;
  status: ReportStatus;
  /** When the report was made on-device. */
  createdAt: number;
  /** When the server first received it — can lag createdAt by however long the device was offline. */
  receivedAt: number;
}

export interface SubmitReportInput {
  id: string;
  promptId: string;
  reason: ReportReason;
  lang: string;
  appVersion?: string;
  createdAt: number;
}

/** One sensitive admin action. `before`/`after` are opaque snapshots — shaped differently per `action`. */
export interface AuditLogRow {
  id: string;
  actorId: string;
  actorUsername: string;
  action: string;
  target: string;
  before: unknown;
  after: unknown;
  createdAt: number;
}
