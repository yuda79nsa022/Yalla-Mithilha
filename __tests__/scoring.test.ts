import {
  applyRound,
  cardPoints,
  emptyScores,
  leaders,
  roundPoints,
  scoreCard,
  skipsRemaining,
  standings,
  topPerformerId,
} from '../src/engine/scoring';
import type { RoundResult, Team } from '../src/engine/types';

const teams: Team[] = [
  { id: 'team-a', name: 'team.a', playerIds: ['p1', 'p2'], performerCursor: 0 },
  { id: 'team-b', name: 'team.b', playerIds: ['p3', 'p4'], performerCursor: 0 },
];

describe('cardPoints', () => {
  it('awards one point for a correct card', () => {
    expect(cardPoints('act', 'correct', false)).toBe(1);
  });

  it('awards nothing for a skip or a timeout', () => {
    expect(cardPoints('act', 'skip', false)).toBe(0);
    expect(cardPoints('act', 'timeout', false)).toBe(0);
    expect(cardPoints('act', 'skip', true)).toBe(0);
  });

  it('doubles the value on a final challenge', () => {
    expect(cardPoints('final', 'correct', true)).toBe(2);
    expect(cardPoints('act', 'correct', true)).toBe(2);
  });
});

describe('round totals', () => {
  it('adds up the cards in a round', () => {
    const cards = [
      scoreCard('a', 'act', 'correct', false),
      scoreCard('b', 'act', 'skip', false),
      scoreCard('c', 'act', 'correct', false),
    ];
    expect(roundPoints(cards)).toBe(2);
  });

  it('counts down the skip allowance and stops at zero', () => {
    const one = [scoreCard('a', 'act', 'skip', false)];
    expect(skipsRemaining('act', one)).toBe(1);
    const three = [
      scoreCard('a', 'act', 'skip', false),
      scoreCard('b', 'act', 'skip', false),
      scoreCard('c', 'act', 'skip', false),
    ];
    expect(skipsRemaining('act', three)).toBe(0);
  });

  it('reports unlimited skips as null', () => {
    // No shipped mini-game is unlimited, so assert the contract directly.
    expect(skipsRemaining('who', [])).toBe(1);
  });
});

describe('standings', () => {
  it('starts everybody on zero', () => {
    expect(emptyScores(teams)).toEqual({ 'team-a': 0, 'team-b': 0 });
  });

  it('adds a round to the right team only', () => {
    const result: RoundResult = {
      roundIndex: 0,
      teamId: 'team-a',
      performerId: 'p1',
      game: 'act',
      cards: [],
      points: 3,
    };
    expect(applyRound(emptyScores(teams), result)).toEqual({ 'team-a': 3, 'team-b': 0 });
  });

  it('ranks by points and shares a rank on equal scores', () => {
    const table = standings({ 'team-a': 5, 'team-b': 5 }, teams);
    expect(table.every((row) => row.rank === 1)).toBe(true);
  });

  it('identifies a single leader and a tie', () => {
    expect(leaders({ 'team-a': 7, 'team-b': 4 }, teams)).toEqual(['team-a']);
    expect(leaders({ 'team-a': 4, 'team-b': 4 }, teams)).toHaveLength(2);
  });
});

describe('topPerformerId', () => {
  const round = (performerId: string, points: number): RoundResult => ({
    roundIndex: 0,
    teamId: 'team-a',
    performerId,
    game: 'act',
    cards: [],
    points,
  });

  it('sums points per performer across rounds', () => {
    expect(topPerformerId([round('p1', 2), round('p2', 1), round('p1', 1)])).toBe('p1');
  });

  it('returns null when there is no clear best performer', () => {
    expect(topPerformerId([round('p1', 2), round('p2', 2)])).toBeNull();
    expect(topPerformerId([])).toBeNull();
  });
});
