/**
 * Core domain types for Yalla Mithilha.
 *
 * Everything in `src/engine`, `src/content` and `src/i18n` is intentionally
 * free of React Native imports so the rules of the game can be unit-tested in
 * plain Node.
 */

export type Lang = 'ar' | 'en';

/** The seven mini-games shipped in the MVP. */
export type MiniGameId =
  | 'act' // مثّلها  – silent acting
  | 'taboo' // لا تقولها – describe without forbidden words
  | 'who' // منو فينا؟ – vote for a player
  | 'imitate' // قلّدها – imitate a character type (voice allowed)
  | 'lips' // اقرأ شفايفي – lip reading
  | 'sound' // بس صوت – sounds only
  | 'final'; // التحدي الأخير – bonus challenge

export type RoomId =
  | 'friends'
  | 'family'
  | 'diwaniya'
  | 'kuwait'
  | 'ramadan'
  | 'couples'
  | 'kids'
  | 'mixed';

/**
 * Content levels are ordered. A prompt declares the *lowest* audience it is
 * suitable for; a session shows every prompt whose level is at or below the
 * selected level. A `kids` prompt is therefore playable by adults, but an
 * `adults` prompt never reaches a kids session.
 */
export type ContentLevel = 'kids' | 'family' | 'friends' | 'adults';

export const CONTENT_LEVEL_ORDER: Record<ContentLevel, number> = {
  kids: 0,
  family: 1,
  friends: 2,
  adults: 3,
};

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Where the reference is from, so packs can be re-targeted per country. */
export type RegionTag = 'kw' | 'gulf' | 'egypt' | 'global';

export interface Prompt {
  /** Stable unique id, e.g. `act-014`. Never re-use an id for new text. */
  id: string;
  game: MiniGameId;
  ar: string;
  en: string;
  rooms: RoomId[];
  difficulty: Difficulty;
  level: ContentLevel;
  region: RegionTag;
  /** Only used by `taboo`. Words the describer may not say. */
  forbiddenAr?: string[];
  forbiddenEn?: string[];
  /** Authoring switch — disabled prompts never reach a session. */
  enabled: boolean;
  /** Free-form note for content authors. Never shown to players. */
  note?: string;
  /** Pack id for the entitlement layer. `core` ships free. */
  pack?: string;
}

export type GameMode = 'teams' | 'ffa';
export type SessionLength = 'quick' | 'standard' | 'long';

export interface Player {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  /** Localisation key or a literal custom name. */
  name: string;
  playerIds: string[];
  /** Index into `playerIds` — whose turn it is to perform next. */
  performerCursor: number;
}

export interface SessionSetup {
  lang: Lang;
  room: RoomId;
  mode: GameMode;
  length: SessionLength;
  level: ContentLevel;
  players: Player[];
  teams: Team[];
  /** Deterministic seed, kept so a session can be reproduced in a bug report. */
  seed: number;
  /** Host disabled tilt controls in settings. */
  motionEnabled: boolean;
}

export interface RoundPlan {
  index: number;
  game: MiniGameId;
  teamId: string;
  performerId: string;
  /** Prompt ids reserved for this round, in order. */
  promptIds: string[];
  isFinal: boolean;
  /** Sudden-death rounds are appended after a tie. */
  isSuddenDeath?: boolean;
}

export type CardOutcome = 'correct' | 'skip' | 'timeout';

export interface CardResult {
  promptId: string;
  outcome: CardOutcome;
  points: number;
}

export interface RoundResult {
  roundIndex: number;
  teamId: string;
  performerId: string;
  game: MiniGameId;
  cards: CardResult[];
  points: number;
  /** For `who` rounds: the player the group voted for. */
  votedPlayerId?: string;
}

export type SessionPhase =
  | 'setup'
  | 'pass' // pass-the-phone privacy screen
  | 'brief' // "here is the mini-game" screen
  | 'playing'
  | 'roundResult'
  | 'scoreboard'
  | 'finished';

export interface SessionState {
  setup: SessionSetup;
  plan: RoundPlan[];
  currentRound: number;
  phase: SessionPhase;
  results: RoundResult[];
  scores: Record<string, number>;
  /** Prompt ids consumed in this session — never repeated inside it. */
  usedPromptIds: string[];
  startedAt: number;
  updatedAt: number;
  version: number;
}

export interface MiniGameConfig {
  id: MiniGameId;
  /** Seconds on the clock for one round. */
  roundSeconds: number;
  /** How many cards the engine reserves for the round. */
  cardsPerRound: number;
  pointsPerCorrect: number;
  /** `null` means unlimited skips. */
  skipLimit: number | null;
  /** `'all'` or an explicit list. `mixed` always resolves to `'all'`. */
  eligibleRooms: RoomId[] | 'all';
  eligibleLevels: ContentLevel[] | 'all';
  mode: GameMode | 'any';
  /** Multiplier applied on final-challenge rounds. */
  finalMultiplier: number;
  /** The performer must not be seen by the others → pass-the-phone screen. */
  secret: boolean;
  /** Relative frequency when the engine builds a session. */
  weight: number;
  /** Tilt-to-answer is offered for this mini-game. */
  supportsTilt: boolean;
  /** Colour token key in the theme. */
  color: string;
}

export interface PromptReport {
  id: string;
  promptId: string;
  reason:
    | 'unclear'
    | 'translation'
    | 'not_funny'
    | 'inappropriate'
    | 'too_hard'
    | 'duplicate';
  createdAt: number;
  lang: Lang;
}
