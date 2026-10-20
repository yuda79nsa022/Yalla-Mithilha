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
  /** Optional — collected at signup so a forgotten password can be reset. `null` for accounts created before this existed, or that never gave one. */
  email: string | null;
  /** Free games left from the one-time signup grant (starts at 2) — spent before any paid credit, on a session of either mode. */
  freeGameCredits: number;
  createdAt: number;
  updatedAt: number;
}

/** The app's own UI language — text direction and which strings are shown. Independent of which decks a session deals from (the player's own choice — see `startGameSession`). */
export type Lang = 'ar' | 'en';

/** Which rule set a session is played under — see `startGameSession` and the client's two engines (`src/engine/charades.ts` and `src/engine/modifiedCharades.ts`). */
export type GameMode = 'classic' | 'modified';
export const GAME_MODES: readonly GameMode[] = ['classic', 'modified'];
export function isGameMode(value: unknown): value is GameMode {
  return value === 'classic' || value === 'modified';
}

/**
 * How hard a title is to act. In modified mode the acting team picks a level
 * each round and it decides the points on offer (see the client's modified
 * engine); in classic mode the player may pick one level for the whole game
 * (see `ClassicDifficulty`). A single title may carry an explicit level;
 * otherwise its level comes from its length — length makes a title hard to
 * act regardless of how famous it is — shifted by its deck's level. See
 * `effectiveDifficulty`. Decks are shared between both modes.
 */
export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
/** A title of at most this many words is easy to act on a medium deck. */
export const SHORT_TITLE_WORDS = 1;
/** A title of more than this many words is hard to act on a medium deck. */
export const LONG_TITLE_WORDS = 3;

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

/**
 * A title's own override wins. Otherwise its length sets its level — one
 * word easy, two or three medium, more than that hard — and the deck's
 * level shifts that one step: an easy deck makes every title one level
 * easier, a hard deck one level harder, a medium deck (every deck's default)
 * leaves it as is.
 *
 * Before, an un-tagged title simply took its deck's level (bumped once if
 * long), so a deck nobody had tagged dealt only medium titles plus a few
 * long hard ones — the easy stack was always empty and players couldn't
 * actually choose a level.
 */
export function effectiveDifficulty(deckDefault: Difficulty, title: { text: string; difficulty: Difficulty | null }): Difficulty {
  if (title.difficulty) return title.difficulty;
  const words = title.text.trim().split(/\s+/).filter(Boolean).length;
  const byLength = words <= SHORT_TITLE_WORDS ? 0 : words <= LONG_TITLE_WORDS ? 1 : 2;
  const shift = deckDefault === 'easy' ? -1 : deckDefault === 'hard' ? 1 : 0;
  return DIFFICULTIES[Math.min(2, Math.max(0, byLength + shift))];
}

/** A classic game's level, chosen when drafting: one level, or `mixed` for every level. */
export type ClassicDifficulty = 'mixed' | Difficulty;
export function isClassicDifficulty(value: unknown): value is ClassicDifficulty {
  return value === 'mixed' || isDifficulty(value);
}

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
 * which language the deck's actual titles are in. Which decks a session
 * deals from is the player's own choice at checkout (see `startGameSession`),
 * not tied to the app's UI language.
 */
export interface DeckRow {
  id: string;
  nameAr: string;
  nameEn: string;
  language: Lang;
  /** The default level of every title in this deck when played in modified mode — see `Difficulty`. Decks created before this existed default to 'medium'. Classic mode ignores it. */
  difficulty: Difficulty;
  /** A servable path (e.g. `/title-images/<uuid>.png`), or null when this deck has no icon/cover picture. Shown next to the deck on the player's deck picker. */
  imagePath: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface TitleRow {
  id: string;
  deckId: string;
  text: string;
  /** A servable path (e.g. `/title-images/<uuid>.png`), or null when this title has no picture. Optional — most titles never need one. */
  imagePath: string | null;
  /** A per-title override of the deck's default level, or null (the usual case) to use the deck's — see `effectiveDifficulty`. Classic mode ignores it. */
  difficulty: Difficulty | null;
  createdAt: number;
}

export interface DeckWithTitles extends DeckRow {
  titles: TitleRow[];
}

/** The shape the client app needs to let a player pick which decks a session deals from — no admin-only fields. */
export interface PublicDeck {
  id: string;
  nameAr: string;
  nameEn: string;
  language: Lang;
  difficulty: Difficulty;
  /** A servable path relative to the API origin — absent when this deck has no icon/cover picture. */
  imageUrl?: string;
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
  /** The gateway's own id for this payment (MyFatoorah's InvoiceId); `null` for the mock provider. */
  providerRef: string | null;
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
  /** The level this title was dealt into — only present for a modified-mode session; see `effectiveDifficulty`. */
  difficulty?: Difficulty;
}

/** One stack per level, each dealt top-first — a modified-mode session's deal; the acting team picks a level each round and takes that stack's next title. */
export type DealtStacks = Record<Difficulty, DealtTitle[]>;

/**
 * One purchased charades session. A classic-mode session deals up to
 * `CLASSIC_ROUNDS_PER_SESSION` titles at random across whichever decks the
 * player chose (`titles`, `rounds` absent). A modified-mode session instead
 * deals three stacks — one per difficulty level — and `rounds` is the most
 * any one stack holds; `titles` is still populated as that same deal
 * flattened, for callers that only need "what was dealt". Its id is
 * client-generated (the same pattern the old board game used) so resuming
 * after an app restart replays the same id and never spends a second
 * credit.
 */
export interface GameSessionRow {
  id: string;
  playerId: string;
  mode: GameMode;
  /** Only set for a modified-mode session — how many rounds the game lasts. */
  rounds?: number;
  /** Only set for a modified-mode session. */
  stacks?: DealtStacks;
  titles: DealtTitle[];
  createdAt: number;
}

/** What the QR code on the handoff screen ultimately shows the actor — title, category in both languages, and an optional picture. */
export interface RevealPayload {
  t: string;
  ca: string;
  ce: string;
  img?: string;
}

/**
 * The admin-editable copy shown on the player app's home screen — a tagline
 * and a longer explanatory paragraph, each in both languages. Single row,
 * same pattern as the game price in `settings`.
 */
export interface HomeContent {
  taglineAr: string;
  taglineEn: string;
  writeupAr: string;
  writeupEn: string;
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
