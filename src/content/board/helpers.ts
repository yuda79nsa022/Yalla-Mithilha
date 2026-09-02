import type { TileContent } from '../../engine/board/types';

const POINTS = [100, 200, 300, 400, 500, 600];

/** Builds the six tiles of a category from `[ar, en, answerAr, answerEn]` rows. */
export function makeTiles(
  categoryId: string,
  rows: readonly [ar: string, en: string, answerAr: string, answerEn: string][]
): TileContent[] {
  return rows.map(([ar, en, answerAr, answerEn], i) => ({
    id: `${categoryId}-${i + 1}`,
    index: i,
    points: POINTS[i],
    mediaType: 'text',
    promptAr: ar,
    promptEn: en,
    answerAr,
    answerEn,
  }));
}
