import { createRng } from '../src/engine/rng';
import {
  buildGameOrder,
  buildTeams,
  isBalanced,
  nextPerformer,
  roundCountFor,
  teamForRound,
} from '../src/engine/rotation';
import type { MiniGameId, Player } from '../src/engine/types';

const players: Player[] = ['Ahmad', 'Noura', 'Faisal', 'Dana', 'Yousef'].map((name, i) => ({
  id: `pl-${i}`,
  name,
}));

describe('buildTeams', () => {
  it('splits into two balanced teams', () => {
    const teams = buildTeams(players, 'teams', createRng(5));
    expect(teams).toHaveLength(2);
    expect(isBalanced(teams)).toBe(true);
    const assigned = teams.flatMap((t) => t.playerIds).sort();
    expect(assigned).toEqual(players.map((p) => p.id).sort());
  });

  it('stays balanced for any group size from two to twelve', () => {
    for (let n = 2; n <= 12; n++) {
      const group = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
      expect(isBalanced(buildTeams(group, 'teams', createRng(n)))).toBe(true);
    }
  });

  it('models free-for-all as one-person teams', () => {
    const teams = buildTeams(players, 'ffa', createRng(5));
    expect(teams).toHaveLength(players.length);
    expect(teams.every((t) => t.playerIds.length === 1)).toBe(true);
    expect(teams.map((t) => t.name)).toEqual(players.map((p) => p.name));
  });

  it('does not simply split by entry order', () => {
    // Over several seeds at least one split must differ from the naive
    // alternating assignment of the input order.
    const naive = players.filter((_, i) => i % 2 === 0).map((p) => p.id);
    const differs = [1, 2, 3, 4, 5, 6].some((seed) => {
      const teams = buildTeams(players, 'teams', createRng(seed));
      return JSON.stringify(teams[0].playerIds) !== JSON.stringify(naive);
    });
    expect(differs).toBe(true);
  });
});

describe('buildGameOrder', () => {
  const eligible: MiniGameId[] = ['act', 'taboo', 'who', 'imitate', 'sound'];

  it('never schedules the same mini-game twice in a row', () => {
    for (let seed = 0; seed < 25; seed++) {
      const order = buildGameOrder(eligible, 16, createRng(seed));
      for (let i = 1; i < order.length; i++) {
        expect(order[i]).not.toBe(order[i - 1]);
      }
    }
  });

  it('uses several different mini-games in one session', () => {
    const order = buildGameOrder(eligible, 12, createRng(42));
    expect(new Set(order).size).toBeGreaterThanOrEqual(4);
  });

  it('produces exactly the requested number of rounds', () => {
    expect(buildGameOrder(eligible, 7, createRng(1))).toHaveLength(7);
    expect(buildGameOrder(eligible, 0, createRng(1))).toHaveLength(0);
  });

  it('falls back to repeating the only eligible mini-game', () => {
    expect(buildGameOrder(['act'], 3, createRng(1))).toEqual(['act', 'act', 'act']);
  });
});

describe('roundCountFor', () => {
  it('gives longer sessions more rounds', () => {
    const eligible: MiniGameId[] = ['act', 'taboo', 'who'];
    const quick = roundCountFor('quick', 2, eligible);
    const standard = roundCountFor('standard', 2, eligible);
    const long = roundCountFor('long', 2, eligible);
    expect(quick).toBeLessThan(standard);
    expect(standard).toBeLessThan(long);
  });

  it('always divides evenly between the teams', () => {
    for (const teams of [2, 3, 4, 5]) {
      for (const length of ['quick', 'standard', 'long'] as const) {
        expect(roundCountFor(length, teams, ['act', 'taboo']) % teams).toBe(0);
      }
    }
  });
});

describe('performer rotation', () => {
  it('alternates teams round by round', () => {
    const teams = buildTeams(players, 'teams', createRng(2));
    expect(teamForRound(teams, 0).id).toBe(teams[0].id);
    expect(teamForRound(teams, 1).id).toBe(teams[1].id);
    expect(teamForRound(teams, 2).id).toBe(teams[0].id);
  });

  it('gives everyone a turn before anybody performs twice', () => {
    let team = buildTeams(players, 'teams', createRng(9))[0];
    const size = team.playerIds.length;
    const seen: string[] = [];
    for (let i = 0; i < size; i++) {
      const step = nextPerformer(team);
      seen.push(step.performerId);
      team = step.team;
    }
    expect(new Set(seen).size).toBe(size);
    // And it wraps back round to the first performer.
    expect(nextPerformer(team).performerId).toBe(seen[0]);
  });
});
