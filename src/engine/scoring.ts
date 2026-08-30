import { MINI_GAMES } from './config';
import type {
  CardOutcome,
  CardResult,
  MiniGameId,
  RoundResult,
  SessionState,
  Team,
} from './types';

/**
 * Points for one card.
 * correct → the mini-game's value, doubled on a final challenge.
 * skip / timeout → nothing. There is no negative scoring in the MVP: losing
 * points in a party game kills the mood faster than it adds tension.
 */
export function cardPoints(game: MiniGameId, outcome: CardOutcome, isFinal: boolean): number {
  if (outcome !== 'correct') return 0;
  const config = MINI_GAMES[game];
  const base = config.pointsPerCorrect;
  return isFinal ? base * MINI_GAMES.final.finalMultiplier : base;
}

export function scoreCard(
  promptId: string,
  game: MiniGameId,
  outcome: CardOutcome,
  isFinal: boolean
): CardResult {
  return { promptId, outcome, points: cardPoints(game, outcome, isFinal) };
}

export function roundPoints(cards: CardResult[]): number {
  return cards.reduce((sum, c) => sum + c.points, 0);
}

export function skipsUsed(cards: CardResult[]): number {
  return cards.filter((c) => c.outcome === 'skip').length;
}

export function skipsRemaining(game: MiniGameId, cards: CardResult[]): number | null {
  const limit = MINI_GAMES[game].skipLimit;
  if (limit === null) return null;
  return Math.max(0, limit - skipsUsed(cards));
}

export function emptyScores(teams: Team[]): Record<string, number> {
  return Object.fromEntries(teams.map((t) => [t.id, 0]));
}

export function applyRound(
  scores: Record<string, number>,
  result: RoundResult
): Record<string, number> {
  return { ...scores, [result.teamId]: (scores[result.teamId] ?? 0) + result.points };
}

export interface Standing {
  teamId: string;
  points: number;
  rank: number;
}

export function standings(scores: Record<string, number>, teams: Team[]): Standing[] {
  const rows = teams
    .map((t) => ({ teamId: t.id, points: scores[t.id] ?? 0, rank: 0 }))
    .sort((a, b) => b.points - a.points);

  let rank = 0;
  let lastPoints = Number.NaN;
  rows.forEach((row, i) => {
    if (row.points !== lastPoints) {
      rank = i + 1;
      lastPoints = row.points;
    }
    row.rank = rank;
  });
  return rows;
}

/** Team ids tied for first. Length > 1 means sudden death is required. */
export function leaders(scores: Record<string, number>, teams: Team[]): string[] {
  const table = standings(scores, teams);
  if (!table.length) return [];
  const top = table[0].points;
  return table.filter((r) => r.points === top).map((r) => r.teamId);
}

export function isTied(state: SessionState): boolean {
  return leaders(state.scores, state.setup.teams).length > 1;
}

export function winnerTeamId(state: SessionState): string | null {
  const top = leaders(state.scores, state.setup.teams);
  return top.length === 1 ? top[0] : null;
}

/** Per-player contribution, for the "best performer" line on the winner screen. */
export function performerTotals(results: RoundResult[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of results) out[r.performerId] = (out[r.performerId] ?? 0) + r.points;
  return out;
}

export function topPerformerId(results: RoundResult[]): string | null {
  const totals = performerTotals(results);
  const entries = Object.entries(totals);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return null;
  return entries[0][0];
}
