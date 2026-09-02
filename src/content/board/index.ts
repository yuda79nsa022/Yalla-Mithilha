import type { CategoryDeck } from '../../engine/board/types';
import { KUWAITI_SERIES } from './categories/kuwaiti-series';
import { KHALEEJI_SERIES } from './categories/khaleeji-series';
import { EGYPTIAN_SERIES } from './categories/egyptian-series';
import { EGYPTIAN_MOVIES } from './categories/egyptian-movies';
import { EGYPTIAN_PLAYS } from './categories/egyptian-plays';
import { KUWAITI_PLAYS } from './categories/kuwaiti-plays';
import { KHALEEJI_PLAYS } from './categories/khaleeji-plays';

/**
 * The whole shipped board catalogue. A future admin dashboard would produce
 * files with exactly this shape and drop them in `categories/`, then add one
 * import here — nothing else downstream needs to change.
 *
 * Content confidence varies by category — see each category file's header
 * comment. kuwaiti-plays and khaleeji-plays in particular are draft-quality
 * pending review by someone who actually knows this content.
 */
export const BOARD_CATALOGUE: CategoryDeck[] = [
  KUWAITI_SERIES,
  KHALEEJI_SERIES,
  EGYPTIAN_SERIES,
  EGYPTIAN_MOVIES,
  EGYPTIAN_PLAYS,
  KUWAITI_PLAYS,
  KHALEEJI_PLAYS,
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
