import { MINI_GAMES } from '../engine/config';
import { scoreCard, skipsRemaining } from '../engine/scoring';
import type { CardResult, MiniGameId, Prompt } from '../engine/types';

/**
 * The rules of a single round, with no timers, no components and no side
 * effects. The screen owns the clock and calls `tick`; everything else about
 * what a card is worth and when the round is over lives here so it can be
 * tested and so the seven mini-games cannot drift apart.
 */
export interface RoundController {
  game: MiniGameId;
  isFinal: boolean;
  cards: Prompt[];
  cursor: number;
  results: CardResult[];
  secondsLeft: number;
  paused: boolean;
  finished: boolean;
}

export function startRound(
  game: MiniGameId,
  cards: Prompt[],
  isFinal: boolean
): RoundController {
  return {
    game,
    isFinal,
    cards,
    cursor: 0,
    results: [],
    secondsLeft: MINI_GAMES[game].roundSeconds,
    paused: false,
    finished: cards.length === 0,
  };
}

export function currentCard(state: RoundController): Prompt | undefined {
  return state.cards[state.cursor];
}

export function skipsLeft(state: RoundController): number | null {
  return skipsRemaining(state.game, state.results);
}

export function canSkip(state: RoundController): boolean {
  const left = skipsLeft(state);
  return left === null || left > 0;
}

function record(state: RoundController, outcome: 'correct' | 'skip'): RoundController {
  const card = currentCard(state);
  if (!card || state.finished) return state;

  const results = [...state.results, scoreCard(card.id, state.game, outcome, state.isFinal)];
  const cursor = state.cursor + 1;
  return {
    ...state,
    results,
    cursor,
    // A round ends when the cards run out, even with time on the clock.
    finished: cursor >= state.cards.length,
  };
}

export function markCorrect(state: RoundController): RoundController {
  return record(state, 'correct');
}

/** A skip past the allowance is ignored rather than silently costing a card. */
export function skipCard(state: RoundController): RoundController {
  if (!canSkip(state)) return state;
  return record(state, 'skip');
}

export function tick(state: RoundController): RoundController {
  if (state.paused || state.finished) return state;
  const secondsLeft = state.secondsLeft - 1;
  if (secondsLeft > 0) return { ...state, secondsLeft };

  // Time up: whatever card was on screen counts as unanswered, not as a skip,
  // so it does not eat the performer's skip allowance in the stats.
  const card = currentCard(state);
  const results = card
    ? [...state.results, scoreCard(card.id, state.game, 'timeout', state.isFinal)]
    : state.results;
  return { ...state, secondsLeft: 0, results, finished: true };
}

export function togglePause(state: RoundController): RoundController {
  if (state.finished) return state;
  return { ...state, paused: !state.paused };
}

/** The host stops the round early — remaining cards are simply not played. */
export function endEarly(state: RoundController): RoundController {
  return { ...state, finished: true, secondsLeft: 0 };
}

export function summary(state: RoundController): {
  correct: number;
  skipped: number;
  points: number;
} {
  return {
    correct: state.results.filter((r) => r.outcome === 'correct').length,
    skipped: state.results.filter((r) => r.outcome === 'skip').length,
    points: state.results.reduce((sum, r) => sum + r.points, 0),
  };
}
