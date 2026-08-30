import { MINI_GAMES } from '../src/engine/config';
import { createSession, currentPlan, roundPrompts, completeRound, advance } from '../src/engine/engine';
import {
  canSkip,
  currentCard,
  endEarly,
  markCorrect,
  skipCard,
  skipsLeft,
  startRound,
  summary,
  tick,
  togglePause,
} from '../src/state/roundController';
import type { Prompt } from '../src/engine/types';

function cards(n: number): Prompt[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    game: 'act' as const,
    ar: `كرت ${i}`,
    en: `card ${i}`,
    rooms: ['friends' as const],
    difficulty: 'easy' as const,
    level: 'family' as const,
    region: 'kw' as const,
    enabled: true,
  }));
}

describe('a round in progress', () => {
  it('starts on the first card with a full clock', () => {
    const state = startRound('act', cards(6), false);
    expect(currentCard(state)?.id).toBe('c0');
    expect(state.secondsLeft).toBe(MINI_GAMES.act.roundSeconds);
    expect(state.finished).toBe(false);
  });

  it('advances to the next card when one is answered', () => {
    let state = startRound('act', cards(3), false);
    state = markCorrect(state);
    expect(currentCard(state)?.id).toBe('c1');
    expect(summary(state)).toEqual({ correct: 1, skipped: 0, points: 1 });
  });

  it('ends the round when the cards run out, even with time left', () => {
    let state = startRound('act', cards(2), false);
    state = markCorrect(markCorrect(state));
    expect(state.finished).toBe(true);
    expect(state.secondsLeft).toBeGreaterThan(0);
  });

  it('stops accepting skips once the allowance is spent', () => {
    let state = startRound('act', cards(6), false);
    expect(skipsLeft(state)).toBe(MINI_GAMES.act.skipLimit);

    state = skipCard(skipCard(state));
    expect(skipsLeft(state)).toBe(0);
    expect(canSkip(state)).toBe(false);

    const before = state.cursor;
    state = skipCard(state);
    // The card does not move: a blocked skip must not silently burn a card.
    expect(state.cursor).toBe(before);
  });

  it('does not award points for a skip', () => {
    let state = startRound('act', cards(4), false);
    state = skipCard(markCorrect(state));
    expect(summary(state)).toEqual({ correct: 1, skipped: 1, points: 1 });
  });

  it('doubles every card on a final challenge', () => {
    let state = startRound('final', cards(1), true);
    state = markCorrect(state);
    expect(summary(state).points).toBe(2);
  });

  it('ends the round when the clock runs out and records a timeout', () => {
    let state = startRound('who', cards(1), false);
    for (let i = 0; i < MINI_GAMES.who.roundSeconds; i++) state = tick(state);
    expect(state.finished).toBe(true);
    expect(state.secondsLeft).toBe(0);
    expect(state.results[0].outcome).toBe('timeout');
    // A timeout is not a skip, so it never eats the skip allowance.
    expect(summary(state).skipped).toBe(0);
  });

  it('freezes the clock while paused', () => {
    let state = togglePause(startRound('act', cards(4), false));
    const before = state.secondsLeft;
    state = tick(tick(state));
    expect(state.secondsLeft).toBe(before);

    state = tick(togglePause(state));
    expect(state.secondsLeft).toBe(before - 1);
  });

  it('lets the host stop the round early without scoring the rest', () => {
    let state = startRound('act', cards(6), false);
    state = endEarly(markCorrect(state));
    expect(state.finished).toBe(true);
    expect(summary(state).correct).toBe(1);
    expect(state.results).toHaveLength(1);
  });

  it('handles an empty card list instead of hanging', () => {
    expect(startRound('act', [], false).finished).toBe(true);
  });
});

describe('the main game flow, screen by screen', () => {
  const players = [
    { id: 'p1', name: 'Ahmad' },
    { id: 'p2', name: 'Noura' },
    { id: 'p3', name: 'Faisal' },
    { id: 'p4', name: 'Dana' },
  ];

  /** Mirrors what pass → brief → round → result actually call. */
  it('plays two full rounds through the same calls the screens make', () => {
    let session = createSession({
      lang: 'ar',
      room: 'friends',
      mode: 'teams',
      length: 'quick',
      level: 'family',
      players,
      seed: 77,
    });

    for (let i = 0; i < 2; i++) {
      const plan = currentPlan(session)!;
      // pass.tsx shows this name; brief.tsx shows the rule.
      expect(plan.performerId).toBeTruthy();

      // round.tsx builds a controller from the reserved cards.
      let round = startRound(plan.game, roundPrompts(session), plan.isFinal);
      expect(round.cards.length).toBeGreaterThan(0);
      while (!round.finished) round = markCorrect(round);

      session = completeRound(session, {
        roundIndex: plan.index,
        teamId: plan.teamId,
        performerId: plan.performerId,
        game: plan.game,
        cards: round.results,
      });
      expect(session.phase).toBe('roundResult');

      // result.tsx calls advance and routes on the phase it gets back.
      session = advance(session);
      expect(['pass', 'brief', 'finished']).toContain(session.phase);
    }

    expect(session.results).toHaveLength(2);
    expect(Object.values(session.scores).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it('keeps the phone in the right hands for every round', () => {
    const session = createSession({
      lang: 'en',
      room: 'mixed',
      mode: 'ffa',
      length: 'quick',
      level: 'friends',
      players,
      seed: 31,
    });
    for (const plan of session.plan) {
      const team = session.setup.teams.find((t) => t.id === plan.teamId)!;
      expect(team.playerIds).toContain(plan.performerId);
    }
  });
});
