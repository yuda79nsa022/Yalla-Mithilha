import type { Team } from '../types';
import type { BoardCategory, BoardState, BoardTile, CategoryDeck } from './types';

export class InvalidDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDraftError';
  }
}

function deckById(catalogue: CategoryDeck[], id: string): CategoryDeck {
  const deck = catalogue.find((d) => d.id === id);
  if (!deck) throw new InvalidDraftError(`unknown category "${id}"`);
  if (deck.tiles.length !== 6) {
    throw new InvalidDraftError(`category "${id}" does not have exactly six tiles`);
  }
  return deck;
}

/**
 * Builds a fresh, unpaid board from each team's three picks. Pure — the
 * caller decides when this runs relative to payment; `draftBoard` itself
 * always returns a `pendingPayment` board.
 */
export function draftBoard(
  teamA: Team,
  teamB: Team,
  teamAPicks: readonly [string, string, string],
  teamBPicks: readonly [string, string, string],
  catalogue: CategoryDeck[]
): BoardState {
  const pickedIds = [...teamAPicks, ...teamBPicks];
  if (new Set(pickedIds).size !== pickedIds.length) {
    throw new InvalidDraftError('a category was picked more than once');
  }

  const decks = pickedIds.map((id) => deckById(catalogue, id));

  const categories: BoardCategory[] = decks.map((d) => ({
    id: d.id,
    nameAr: d.nameAr,
    nameEn: d.nameEn,
  }));

  const tiles: BoardTile[] = decks.flatMap((deck) =>
    deck.tiles.map((tile) => ({
      ...tile,
      categoryId: deck.id,
      revealed: false,
      wonByTeamId: null,
    }))
  );

  return {
    lock: 'pendingPayment',
    teams: [teamA, teamB],
    categories,
    tiles,
    activeTeamId: teamA.id,
    scores: { [teamA.id]: 0, [teamB.id]: 0 },
    currentTile: null,
  };
}

function otherTeamId(state: BoardState, teamId: string): string {
  return state.teams[0].id === teamId ? state.teams[1].id : state.teams[0].id;
}

/**
 * Flips a tile face-up and puts it on screen. Once revealed a tile can never
 * be picked again, whether it ends up awarded or skipped — matching the
 * shared-screen board where a question, once read aloud, cannot be replayed.
 */
export function revealTile(state: BoardState, categoryId: string, index: number): BoardState {
  if (state.lock !== 'unlocked' || state.currentTile) return state;
  const tile = state.tiles.find((t) => t.categoryId === categoryId && t.index === index);
  if (!tile || tile.revealed) return state;

  const tiles = state.tiles.map((t) => (t === tile ? { ...t, revealed: true } : t));
  return { ...state, tiles, currentTile: { categoryId, index } };
}

/** The host judged the on-screen tile for `teamId`. Turn passes either way. */
export function awardTile(state: BoardState, teamId: string): BoardState {
  const current = state.currentTile;
  if (!current) return state;
  if (!state.teams.some((t) => t.id === teamId)) return state;

  const tile = state.tiles.find(
    (t) => t.categoryId === current.categoryId && t.index === current.index
  );
  if (!tile) return state;

  const tiles = state.tiles.map((t) => (t === tile ? { ...t, wonByTeamId: teamId } : t));
  const scores = { ...state.scores, [teamId]: (state.scores[teamId] ?? 0) + tile.points };
  return { ...state, tiles, scores, currentTile: null, activeTeamId: otherTeamId(state, teamId) };
}

/** Nobody scored the on-screen tile. Turn still passes to the other team. */
export function skipTile(state: BoardState): BoardState {
  if (!state.currentTile) return state;
  return { ...state, currentTile: null, activeTeamId: otherTeamId(state, state.activeTeamId) };
}

export function isBoardComplete(state: BoardState): boolean {
  return state.tiles.every((t) => t.revealed);
}

/**
 * Flips a paid-for board to `unlocked`. Spending the credit itself is the
 * caller's job (`services/entitlements.ts::spendCredit`) — this function only
 * ever sees the outcome, so the engine never touches storage directly.
 */
export function unlockBoard(state: BoardState): BoardState {
  if (state.lock !== 'pendingPayment') return state;
  return { ...state, lock: 'unlocked' };
}

/** A stale, never-paid draft. A board already in play is never expired. */
export function expireBoard(state: BoardState): BoardState {
  if (state.lock !== 'pendingPayment') return state;
  return { ...state, lock: 'expired' };
}
