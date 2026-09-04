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

/**
 * A charades deck: a named, unlimited-size pool of titles (movies, series,
 * plays, songs — whatever an admin imports). Unlike the old board-game
 * category, a deck has no fixed slot count and no per-tile prompt/answer
 * pair — a title is acted out silently, so the title itself is both what
 * the actor privately reads and what confirms the answer once guessed.
 */
export interface DeckRow {
  id: string;
  nameAr: string;
  nameEn: string;
  createdAt: number;
  updatedAt: number;
}

export interface TitleRow {
  id: string;
  deckId: string;
  text: string;
  createdAt: number;
}

export interface DeckWithTitles extends DeckRow {
  titles: TitleRow[];
}

/** The shape the client app needs to draft/play a session — no admin-only fields. */
export interface PublicDeck {
  id: string;
  nameAr: string;
  nameEn: string;
  titleCount: number;
}

export type PaymentStatus = 'initiated' | 'paid' | 'failed' | 'cancelled';

/**
 * A wallet top-up. Always exactly one game's worth of credit, at whatever
 * `game_price_fils` was set to at the moment of checkout — the price can
 * change later without altering the record of what was actually charged.
 */
export interface PaymentRow {
  id: string;
  playerId: string;
  credits: number;
  amountFils: number;
  currency: string;
  provider: string;
  status: PaymentStatus;
  createdAt: number;
  updatedAt: number;
}

/**
 * One purchased charades session: 10 titles dealt from a single deck at the
 * moment a wallet credit was spent. Its id is client-generated (the same
 * pattern the old board game used) so resuming after an app restart replays
 * the same id and never spends a second credit — see `startGameSession`.
 */
export interface GameSessionRow {
  id: string;
  playerId: string;
  deckId: string;
  titles: TitleRow[];
  createdAt: number;
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
