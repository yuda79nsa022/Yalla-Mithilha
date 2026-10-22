/**
 * The paid game: silent charades. A team names their two sides, picks which
 * decks to play, pays for a session, and the server deals 20 titles at
 * random across those decks combined — never a title the player picks
 * individually. One player privately reads a title, acts it out with no
 * words or sounds, their team guesses, then the phone moves to "show
 * answer" (re-confirming the same title) to award the round before the next
 * one deals. Unlike a trivia question, there is no separate written
 * prompt/answer pair — the title itself is both.
 */

export interface CharadesTitle {
  id: string;
  text: string;
  deckNameAr: string;
  deckNameEn: string;
  /** A path relative to CATALOGUE_API_URL (e.g. `/title-images/<uuid>.png`) — absent when this title has no picture. */
  imageUrl?: string;
}

import { ROUND_SECONDS, type GameEndReason } from './rules';

export type CharadesLock = 'locked' | 'unlocked';

/**
 * Which titles a classic game deals from, chosen when drafting. `mixed`
 * deals across every level; a single level deals only that level's titles,
 * topped up from the nearest other level if the chosen decks run short, so
 * a game still gets its full 20 rounds.
 */
export type ClassicDifficulty = 'mixed' | 'easy' | 'medium' | 'hard';
export const CLASSIC_DIFFICULTIES: readonly ClassicDifficulty[] = ['mixed', 'easy', 'medium', 'hard'];

export interface CharadesState {
  mode: 'classic';
  /** Client-generated, becomes the server's game_sessions row id — the idempotency key for "start game". */
  id: string;
  teamAName: string;
  teamBName: string;
  /** Empty until `unlockCharades` deals them from the server. */
  titles: CharadesTitle[];
  /** Which title is next/current, 0-based. */
  index: number;
  scores: [number, number];
  /** `locked` = drafted (team names chosen) but not yet paid; `unlocked` = paid, titles dealt. */
  lock: CharadesLock;
  /**
   * Who this game belongs to. `null` while it's an unclaimed guest draft —
   * team names only, nothing spent yet, so anyone on this device (including
   * whoever signs in at checkout) may pick it up. `unlockCharades` always
   * stamps a real player id here, since spending a wallet credit always
   * requires being signed in — see `charadesForPlayer`.
   */
  playerId: string | null;
  /** Chosen when drafting, alongside the team names — which decks `unlockCharades` deals from. */
  deckIds: string[];
  /** Chosen when drafting — which level of titles the server deals. Absent on games saved before it existed, meaning `mixed`. */
  difficulty?: ClassicDifficulty;
  /** Set when the game was ended early (see `endedReason` in `./game`); absent while it is still being played. */
  endedReason?: GameEndReason;
  /** Epoch ms of the last tap on the play screen — how a reopened game knows it sat idle past the limit. */
  lastActivityAt?: number;
}

export function makeCharadesId(): string {
  return `charades-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function draftCharades(
  teamAName: string,
  teamBName: string,
  id: string = makeCharadesId(),
  playerId: string | null = null,
  deckIds: string[] = [],
  difficulty: ClassicDifficulty = 'mixed'
): CharadesState {
  return {
    mode: 'classic',
    id,
    teamAName,
    teamBName,
    titles: [],
    index: 0,
    scores: [0, 0],
    lock: 'locked',
    playerId,
    deckIds,
    difficulty,
  };
}

export function unlockCharades(state: CharadesState, titles: CharadesTitle[], playerId: string): CharadesState {
  return { ...state, titles, lock: 'unlocked', playerId };
}

/**
 * The gate that stops one player's game from being resumed by another.
 * A still-`locked` draft with no player attached yet (`playerId: null`) is
 * fair game for anyone on the device — that's the guest-drafts-then-signs-
 * in-at-checkout flow the app is built around. Anything else — a draft
 * already tied to a specific signed-in player, or any `unlocked` game,
 * which always has a real payer — only that same player may resume.
 * Returns `null` rather than the mismatched state so callers can treat it
 * exactly like "no saved game".
 */
export function charadesForPlayer(
  state: CharadesState | null,
  playerId: string | null
): CharadesState | null {
  if (!state) return null;
  if (state.playerId === null) return state;
  return state.playerId === playerId ? state : null;
}

/** Which team is up for the current round — strictly alternating, A first. */
export function currentTeamIndex(state: CharadesState): 0 | 1 {
  return (state.index % 2) as 0 | 1;
}

/**
 * A correct guess in the round's first minute is worth 2 points, its second
 * minute 1 point. `elapsedSeconds` is how long the actor has actually been
 * acting — measured on its own, never derived from the time left, so it
 * stays right however the clock was changed. A guess only counts while the
 * clock is still running: once the 2 minutes are up the move is over and
 * the acting team scores nothing for it.
 */
export function pointsForElapsed(elapsedSeconds: number): number {
  if (elapsedSeconds >= ROUND_SECONDS) return 0;
  return elapsedSeconds < ROUND_SECONDS / 2 ? 2 : 1;
}

/** `points` defaults to 1 for a plain correct guess; the play screen passes `pointsForElapsed`'s answer. */
export function awardRound(state: CharadesState, team: 0 | 1, points: number = 1): CharadesState {
  const scores: [number, number] = [...state.scores];
  scores[team] += points;
  return { ...state, scores, index: state.index + 1 };
}

export function skipRound(state: CharadesState): CharadesState {
  return { ...state, index: state.index + 1 };
}

/**
 * A manual scoreboard correction, separate from `awardRound` — doesn't
 * advance the round, and never lets a score go negative.
 */
export function adjustScore(state: CharadesState, team: 0 | 1, delta: number): CharadesState {
  const scores: [number, number] = [...state.scores];
  scores[team] = Math.max(0, scores[team] + delta);
  return { ...state, scores };
}

export function isCharadesComplete(state: CharadesState): boolean {
  if (state.lock !== 'unlocked') return false;
  return Boolean(state.endedReason) || state.index >= state.titles.length;
}
