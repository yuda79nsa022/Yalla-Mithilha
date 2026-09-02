import type { CategoryDeck } from '../../engine/board/types';
import { HISTORY } from './categories/history';
import { SPORTS } from './categories/sports';
import { MOVIES } from './categories/movies';
import { MUSIC } from './categories/music';
import { GEOGRAPHY } from './categories/geography';
import { FOOD } from './categories/food';
import { SCIENCE } from './categories/science';
import { KUWAIT_GULF } from './categories/kuwait-gulf';
import { TECHNOLOGY } from './categories/technology';
import { ANIMALS } from './categories/animals';
import { GENERAL_KNOWLEDGE } from './categories/general-knowledge';
import { SPACE } from './categories/space';
import { LANDMARKS } from './categories/landmarks';
import { INVENTIONS } from './categories/inventions';
import { HUMAN_BODY } from './categories/human-body';
import { CAPITALS } from './categories/capitals';

/**
 * The whole shipped board catalogue. A future admin dashboard would produce
 * files with exactly this shape and drop them in `categories/`, then add one
 * import here — nothing else downstream needs to change.
 */
export const BOARD_CATALOGUE: CategoryDeck[] = [
  HISTORY,
  SPORTS,
  MOVIES,
  MUSIC,
  GEOGRAPHY,
  FOOD,
  SCIENCE,
  KUWAIT_GULF,
  TECHNOLOGY,
  ANIMALS,
  GENERAL_KNOWLEDGE,
  SPACE,
  LANDMARKS,
  INVENTIONS,
  HUMAN_BODY,
  CAPITALS,
];

const EXPECTED_POINTS = [100, 200, 300, 400, 500, 600];

export interface BoardContentIssue {
  categoryId: string;
  tileId?: string;
  problem: string;
}

/**
 * Authoring guard rails, mirroring `validateContent()` in `src/content`. Run
 * by `npm test` so a bad content edit fails CI rather than shipping a broken
 * board to a living room full of people.
 */
export function validateBoardCatalogue(
  catalogue: CategoryDeck[] = BOARD_CATALOGUE
): BoardContentIssue[] {
  const issues: BoardContentIssue[] = [];
  const seenCategoryIds = new Set<string>();
  const seenTileIds = new Set<string>();

  for (const deck of catalogue) {
    if (seenCategoryIds.has(deck.id)) {
      issues.push({ categoryId: deck.id, problem: 'duplicate category id' });
    }
    seenCategoryIds.add(deck.id);

    if (deck.tiles.length !== 6) {
      issues.push({ categoryId: deck.id, problem: `expected 6 tiles, got ${deck.tiles.length}` });
    }

    deck.tiles.forEach((tile, i) => {
      const expectedId = `${deck.id}-${i + 1}`;
      if (tile.id !== expectedId) {
        issues.push({ categoryId: deck.id, tileId: tile.id, problem: `expected id "${expectedId}"` });
      }
      if (seenTileIds.has(tile.id)) {
        issues.push({ categoryId: deck.id, tileId: tile.id, problem: 'duplicate tile id' });
      }
      seenTileIds.add(tile.id);

      if (tile.index !== i) {
        issues.push({
          categoryId: deck.id,
          tileId: tile.id,
          problem: `expected index ${i}, got ${tile.index}`,
        });
      }
      if (tile.points !== EXPECTED_POINTS[i]) {
        issues.push({
          categoryId: deck.id,
          tileId: tile.id,
          problem: `expected ${EXPECTED_POINTS[i]} points, got ${tile.points}`,
        });
      }
      if (!tile.promptAr.trim()) {
        issues.push({ categoryId: deck.id, tileId: tile.id, problem: 'empty Arabic prompt' });
      }
      if (!tile.promptEn.trim()) {
        issues.push({ categoryId: deck.id, tileId: tile.id, problem: 'empty English prompt' });
      }
      if (!tile.answerAr.trim()) {
        issues.push({ categoryId: deck.id, tileId: tile.id, problem: 'empty Arabic answer' });
      }
      if (!tile.answerEn.trim()) {
        issues.push({ categoryId: deck.id, tileId: tile.id, problem: 'empty English answer' });
      }
    });
  }

  return issues;
}
