import {
  awardTile,
  draftBoard,
  expireBoard,
  InvalidDraftError,
  isBoardComplete,
  revealTile,
  skipTile,
  unlockBoard,
} from '../src/engine/board/board';
import type { BoardState, CategoryDeck, TileContent } from '../src/engine/board/types';
import type { Team } from '../src/engine/types';

const teamA: Team = { id: 'team-a', name: 'team.a', playerIds: ['p1', 'p2'], performerCursor: 0 };
const teamB: Team = { id: 'team-b', name: 'team.b', playerIds: ['p3', 'p4'], performerCursor: 0 };

function makeTiles(prefix: string): TileContent[] {
  return Array.from({ length: 6 }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    index: i,
    points: (i + 1) * 100,
    mediaType: 'text',
    promptAr: `${prefix} سؤال ${i}`,
    promptEn: `${prefix} question ${i}`,
    answerAr: `${prefix} جواب ${i}`,
    answerEn: `${prefix} answer ${i}`,
  }));
}

function makeDeck(id: string, tier: 'free' | 'paid' = 'free'): CategoryDeck {
  return { id, nameAr: id, nameEn: id, tier, level: 'family', region: 'global', tiles: makeTiles(id) };
}

const catalogue: CategoryDeck[] = [
  makeDeck('history'),
  makeDeck('sports'),
  makeDeck('movies'),
  makeDeck('music'),
  makeDeck('geography'),
  makeDeck('food'),
  makeDeck('shortdeck'),
];
// Corrupt one deck on purpose to exercise the "wrong tile count" guard.
catalogue[6] = { ...catalogue[6], tiles: catalogue[6].tiles.slice(0, 4) };

describe('draftBoard', () => {
  const teamAPicks: [string, string, string] = ['history', 'sports', 'movies'];
  const teamBPicks: [string, string, string] = ['music', 'geography', 'food'];

  it('assembles 6 categories and 36 tiles from valid picks', () => {
    const board = draftBoard(teamA, teamB, teamAPicks, teamBPicks, catalogue);
    expect(board.categories).toHaveLength(6);
    expect(board.tiles).toHaveLength(36);
    expect(board.categories.map((c) => c.id).sort()).toEqual(
      [...teamAPicks, ...teamBPicks].sort()
    );
  });

  it('generates a stable, unique id when none is supplied', () => {
    const a = draftBoard(teamA, teamB, teamAPicks, teamBPicks, catalogue);
    const b = draftBoard(teamA, teamB, teamAPicks, teamBPicks, catalogue);
    expect(typeof a.id).toBe('string');
    expect(a.id.length).toBeGreaterThan(0);
    expect(a.id).not.toBe(b.id);
  });

  it('accepts an explicit id for deterministic tests', () => {
    const board = draftBoard(teamA, teamB, teamAPicks, teamBPicks, catalogue, 'board-fixed-id');
    expect(board.id).toBe('board-fixed-id');
  });

  it('starts pending payment, with team A active and both scores at zero', () => {
    const board = draftBoard(teamA, teamB, teamAPicks, teamBPicks, catalogue);
    expect(board.lock).toBe('pendingPayment');
    expect(board.activeTeamId).toBe(teamA.id);
    expect(board.scores).toEqual({ 'team-a': 0, 'team-b': 0 });
    expect(board.currentTile).toBeNull();
  });

  it('marks every tile unrevealed and unowned', () => {
    const board = draftBoard(teamA, teamB, teamAPicks, teamBPicks, catalogue);
    expect(board.tiles.every((t) => !t.revealed && t.wonByTeamId === null)).toBe(true);
  });

  it('stamps each tile with the category it came from', () => {
    const board = draftBoard(teamA, teamB, teamAPicks, teamBPicks, catalogue);
    const historyTiles = board.tiles.filter((t) => t.categoryId === 'history');
    expect(historyTiles).toHaveLength(6);
  });

  it('rejects a category picked by both teams', () => {
    expect(() =>
      draftBoard(teamA, teamB, ['history', 'sports', 'movies'], ['history', 'geography', 'food'], catalogue)
    ).toThrow(InvalidDraftError);
  });

  it('rejects a category picked twice by the same team', () => {
    expect(() =>
      draftBoard(teamA, teamB, ['history', 'history', 'movies'], ['music', 'geography', 'food'], catalogue)
    ).toThrow(InvalidDraftError);
  });

  it('rejects an unknown category id', () => {
    expect(() =>
      draftBoard(teamA, teamB, ['history', 'sports', 'nope'], teamBPicks, catalogue)
    ).toThrow(InvalidDraftError);
  });

  it('rejects a deck that does not have exactly six tiles', () => {
    expect(() =>
      draftBoard(teamA, teamB, ['history', 'sports', 'shortdeck'], teamBPicks, catalogue)
    ).toThrow(InvalidDraftError);
  });
});

function unlockedBoard(): BoardState {
  const board = draftBoard(
    teamA,
    teamB,
    ['history', 'sports', 'movies'],
    ['music', 'geography', 'food'],
    catalogue
  );
  return { ...board, lock: 'unlocked' };
}

describe('revealTile', () => {
  it('flips the tile and puts it on screen', () => {
    const board = revealTile(unlockedBoard(), 'history', 0);
    const tile = board.tiles.find((t) => t.categoryId === 'history' && t.index === 0)!;
    expect(tile.revealed).toBe(true);
    expect(board.currentTile).toEqual({ categoryId: 'history', index: 0 });
  });

  it('does nothing while the board is not unlocked', () => {
    const board = draftBoard(
      teamA,
      teamB,
      ['history', 'sports', 'movies'],
      ['music', 'geography', 'food'],
      catalogue
    );
    const after = revealTile(board, 'history', 0);
    expect(after).toBe(board);
  });

  it('does nothing if a tile is already on screen', () => {
    const board = revealTile(unlockedBoard(), 'history', 0);
    const after = revealTile(board, 'sports', 0);
    expect(after).toBe(board);
  });

  it('does nothing for an already-revealed tile', () => {
    let board = revealTile(unlockedBoard(), 'history', 0);
    board = skipTile(board);
    const after = revealTile(board, 'history', 0);
    expect(after).toBe(board);
  });
});

describe('awardTile', () => {
  it('adds the tile points to the awarded team and passes the turn', () => {
    const board = revealTile(unlockedBoard(), 'history', 2); // points = 300
    const after = awardTile(board, 'team-b');
    expect(after.scores['team-b']).toBe(300);
    expect(after.scores['team-a']).toBe(0);
    expect(after.currentTile).toBeNull();
    expect(after.activeTeamId).toBe('team-a');
    const tile = after.tiles.find((t) => t.categoryId === 'history' && t.index === 2)!;
    expect(tile.wonByTeamId).toBe('team-b');
  });

  it('does nothing when no tile is on screen', () => {
    const board = unlockedBoard();
    expect(awardTile(board, 'team-a')).toBe(board);
  });

  it('does nothing for a team id that is not on the board', () => {
    const board = revealTile(unlockedBoard(), 'history', 0);
    expect(awardTile(board, 'team-z')).toBe(board);
  });
});

describe('skipTile', () => {
  it('passes the turn without scoring or un-revealing the tile', () => {
    const board = revealTile(unlockedBoard(), 'history', 0); // team-a active
    const after = skipTile(board);
    expect(after.scores).toEqual({ 'team-a': 0, 'team-b': 0 });
    expect(after.activeTeamId).toBe('team-b');
    expect(after.currentTile).toBeNull();
    const tile = after.tiles.find((t) => t.categoryId === 'history' && t.index === 0)!;
    expect(tile.revealed).toBe(true);
    expect(tile.wonByTeamId).toBeNull();
  });

  it('does nothing when no tile is on screen', () => {
    const board = unlockedBoard();
    expect(skipTile(board)).toBe(board);
  });
});

describe('unlockBoard', () => {
  it('flips a pending-payment board to unlocked', () => {
    const board = draftBoard(
      teamA,
      teamB,
      ['history', 'sports', 'movies'],
      ['music', 'geography', 'food'],
      catalogue
    );
    expect(unlockBoard(board).lock).toBe('unlocked');
  });

  it('does nothing to a board that is not pending payment', () => {
    const board = unlockedBoard();
    expect(unlockBoard(board)).toBe(board);
    const expired = { ...board, lock: 'expired' as const };
    expect(unlockBoard(expired)).toBe(expired);
  });
});

describe('expireBoard', () => {
  it('flips a pending-payment board to expired', () => {
    const board = draftBoard(
      teamA,
      teamB,
      ['history', 'sports', 'movies'],
      ['music', 'geography', 'food'],
      catalogue
    );
    expect(expireBoard(board).lock).toBe('expired');
  });

  it('never expires a board that is already unlocked', () => {
    const board = unlockedBoard();
    expect(expireBoard(board)).toBe(board);
  });
});

describe('isBoardComplete', () => {
  it('is false on a fresh board and true once every tile is resolved', () => {
    let board = unlockedBoard();
    expect(isBoardComplete(board)).toBe(false);

    for (const cat of board.categories) {
      for (let i = 0; i < 6; i++) {
        board = revealTile(board, cat.id, i);
        board = i % 2 === 0 ? awardTile(board, board.activeTeamId) : skipTile(board);
      }
    }

    expect(isBoardComplete(board)).toBe(true);
  });
});
