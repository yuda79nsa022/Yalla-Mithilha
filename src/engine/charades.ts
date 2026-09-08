/**
 * The paid game: silent charades. A team names their two sides, pays for a
 * session, and the server deals 20 titles at random across every playable
 * deck combined — the player never picks a category. One player privately
 * reads a title, acts it out with no words or sounds, their team guesses,
 * then the phone moves to "show answer" (re-confirming the same title) to
 * award the round before the next one deals. Unlike a trivia question,
 * there is no separate written prompt/answer pair — the title itself is
 * both.
 */

export interface CharadesTitle {
  id: string;
  text: string;
  deckNameAr: string;
  deckNameEn: string;
  /** A path relative to CATALOGUE_API_URL (e.g. `/title-images/<uuid>.png`) — absent when this title has no picture. */
  imageUrl?: string;
}

export type CharadesLock = 'locked' | 'unlocked';

export interface CharadesState {
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
}

export function makeCharadesId(): string {
  return `charades-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function draftCharades(
  teamAName: string,
  teamBName: string,
  id: string = makeCharadesId(),
  playerId: string | null = null
): CharadesState {
  return { id, teamAName, teamBName, titles: [], index: 0, scores: [0, 0], lock: 'locked', playerId };
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

export function awardRound(state: CharadesState, team: 0 | 1): CharadesState {
  const scores: [number, number] = [...state.scores];
  scores[team] += 1;
  return { ...state, scores, index: state.index + 1 };
}

export function skipRound(state: CharadesState): CharadesState {
  return { ...state, index: state.index + 1 };
}

export function isCharadesComplete(state: CharadesState): boolean {
  return state.lock === 'unlocked' && state.index >= state.titles.length;
}
