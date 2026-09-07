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

/** The app's own UI language — also which deck pool a session deals from (see `DeckRow.language`). */
export type Lang = 'ar' | 'en';

/**
 * A charades deck: a named, unlimited-size pool of titles (movies, series,
 * plays, songs — whatever an admin imports). Unlike the old board-game
 * category, a deck has no fixed slot count and no per-tile prompt/answer
 * pair — a title is acted out silently, so the title itself is both what
 * the actor privately reads and what confirms the answer once guessed.
 *
 * `language` is the deck's *content* language (Kuwaiti/Khaleeji/Egyptian
 * titles vs. Hollywood/American titles) — separate from `nameAr`/`nameEn`,
 * which are just the deck's bilingual display name and exist regardless of
 * which language the deck's actual titles are in. A session only ever
 * deals from decks matching the player's current app language.
 */
export interface DeckRow {
  id: string;
  nameAr: string;
  nameEn: string;
  language: Lang;
  createdAt: number;
  updatedAt: number;
}

export interface TitleRow {
  id: string;
  deckId: string;
  text: string;
  /** A servable path (e.g. `/title-images/<uuid>.png`), or null when this title has no picture. Optional — most titles never need one. */
  imagePath: string | null;
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
 * One title as dealt into a session — carries its deck's display name
 * alongside the title itself, since the reveal page is a standalone page
 * with no API access of its own: everything it shows has to already be in
 * the link a session's QR code encodes.
 */
export interface DealtTitle {
  id: string;
  text: string;
  deckId: string;
  deckNameAr: string;
  deckNameEn: string;
  /** A servable path (e.g. `/title-images/<uuid>.png`), relative to the API origin — absent when this title has no picture. */
  imageUrl?: string;
}

/**
 * One purchased charades session: 20 titles dealt at random across every
 * playable deck (never chosen by the player — see `startGameSession`) the
 * moment a wallet credit was spent. Its id is client-generated (the same
 * pattern the old board game used) so resuming after an app restart replays
 * the same id and never spends a second credit.
 */
export interface GameSessionRow {
  id: string;
  playerId: string;
  titles: DealtTitle[];
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
