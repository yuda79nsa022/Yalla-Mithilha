import {
  LENGTH_TARGET_MINUTES,
  MINI_GAMES,
  ROUND_OVERHEAD_SECONDS,
  ROTATABLE_MINI_GAMES,
} from './config';
import { shuffle, type Rng } from './rng';
import type {
  GameMode,
  MiniGameId,
  Player,
  SessionLength,
  Team,
} from './types';

/**
 * Free-for-all is modelled as "every player is a one-person team". Scoring,
 * turn order and the final challenge then have a single code path.
 */
export function buildTeams(players: Player[], mode: GameMode, rng: Rng): Team[] {
  if (mode === 'ffa') {
    return players.map((p) => ({
      id: `team-${p.id}`,
      name: p.name,
      playerIds: [p.id],
      performerCursor: 0,
    }));
  }

  // Shuffle then deal alternately so team sizes differ by at most one and the
  // split is not simply the order names were typed in.
  const dealt = shuffle(players, rng);
  const teams: Team[] = [
    { id: 'team-a', name: 'team.a', playerIds: [], performerCursor: 0 },
    { id: 'team-b', name: 'team.b', playerIds: [], performerCursor: 0 },
  ];
  dealt.forEach((p, i) => teams[i % 2].playerIds.push(p.id));
  return teams;
}

export function isBalanced(teams: Team[]): boolean {
  const sizes = teams.map((t) => t.playerIds.length);
  return Math.max(...sizes) - Math.min(...sizes) <= 1;
}

/** Average seconds a round of `game` costs, clock plus hand-over overhead. */
export function estimatedRoundSeconds(game: MiniGameId): number {
  return MINI_GAMES[game].roundSeconds + ROUND_OVERHEAD_SECONDS;
}

/**
 * How many non-final rounds fit in the requested session length, rounded to a
 * whole number of turns so every team performs the same number of times.
 */
export function roundCountFor(
  length: SessionLength,
  teamCount: number,
  eligible: MiniGameId[]
): number {
  const budget = LENGTH_TARGET_MINUTES[length] * 60;
  const avg =
    eligible.reduce((sum, g) => sum + estimatedRoundSeconds(g), 0) / Math.max(1, eligible.length);
  // One final round per team is appended later; reserve its budget here.
  const reserved = teamCount * estimatedRoundSeconds('final');
  const raw = Math.max(teamCount, Math.round((budget - reserved) / avg));
  return Math.max(teamCount, Math.round(raw / teamCount) * teamCount);
}

/**
 * Builds the mini-game order for the body of a session.
 *
 * Rules: never the same mini-game twice in a row, every eligible mini-game
 * appears before any repeats, and higher-weight games come round more often.
 */
export function buildGameOrder(
  eligible: MiniGameId[],
  rounds: number,
  rng: Rng
): MiniGameId[] {
  if (!eligible.length) return [];
  if (eligible.length === 1) return Array(rounds).fill(eligible[0]);

  const order: MiniGameId[] = [];
  let bag: MiniGameId[] = [];

  const refill = () => {
    const next: MiniGameId[] = [];
    for (const g of eligible) {
      for (let i = 0; i < MINI_GAMES[g].weight; i++) next.push(g);
    }
    bag = shuffle(next, rng);
  };

  while (order.length < rounds) {
    if (!bag.length) refill();
    const last = order[order.length - 1];
    // Prefer a card that is not a repeat of the previous round. If the bag has
    // nothing else left, refill early rather than schedule the same mini-game
    // twice in a row.
    let idx = bag.findIndex((g) => g !== last);
    if (idx === -1) {
      const leftovers = bag;
      refill();
      bag = [...bag, ...leftovers];
      idx = bag.findIndex((g) => g !== last);
      if (idx === -1) idx = 0;
    }
    order.push(bag.splice(idx, 1)[0]);
  }

  return order;
}

/** Round `index` belongs to this team — plain round robin. */
export function teamForRound(teams: Team[], index: number): Team {
  return teams[index % teams.length];
}

/**
 * Advances a team's own performer cursor so each member performs before
 * anybody performs twice, independent of how often the team's turn comes up.
 */
export function nextPerformer(team: Team): { performerId: string; team: Team } {
  const performerId = team.playerIds[team.performerCursor % team.playerIds.length];
  return {
    performerId,
    team: { ...team, performerCursor: (team.performerCursor + 1) % team.playerIds.length },
  };
}

export const DEFAULT_ROTATABLE = ROTATABLE_MINI_GAMES;
