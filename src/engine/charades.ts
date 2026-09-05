/**
 * The paid game: silent charades. A team picks a deck (a themed pool of
 * titles an admin imported — movies, series, plays, songs), pays for a
 * session, and the server deals 20 titles from it. One player privately
 * reads a title, acts it out with no words or sounds, their team guesses,
 * then the phone moves to "show answer" (re-confirming the same title) to
 * award the round before the next one deals. Unlike a trivia question,
 * there is no separate written prompt/answer pair — the title itself is
 * both.
 */

export interface CharadesTitle {
  id: string;
  text: string;
}

export type CharadesLock = 'locked' | 'unlocked';

export interface CharadesState {
  /** Client-generated, becomes the server's game_sessions row id — the idempotency key for "start game". */
  id: string;
  deckId: string;
  teamAName: string;
  teamBName: string;
  /** Empty until `unlockCharades` deals them from the server. */
  titles: CharadesTitle[];
  /** Which title is next/current, 0-based. */
  index: number;
  scores: [number, number];
  /** `locked` = drafted (deck + team names chosen) but not yet paid; `unlocked` = paid, titles dealt. */
  lock: CharadesLock;
}

export function makeCharadesId(): string {
  return `charades-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function draftCharades(
  deckId: string,
  teamAName: string,
  teamBName: string,
  id: string = makeCharadesId()
): CharadesState {
  return { id, deckId, teamAName, teamBName, titles: [], index: 0, scores: [0, 0], lock: 'locked' };
}

export function unlockCharades(state: CharadesState, titles: CharadesTitle[]): CharadesState {
  return { ...state, titles, lock: 'unlocked' };
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
