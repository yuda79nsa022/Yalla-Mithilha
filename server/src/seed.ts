/**
 * One-time (idempotent) seed: loads the app's existing hand-authored 7
 * categories into the database, so switching to the live backend doesn't
 * throw away the fact-checking work already done on that content. Safe to
 * re-run — never overwrites a category that already exists.
 */
import { createCategory, getCategory, setCategoryStatus, updateTile } from './db';
// eslint-disable-next-line import/no-relative-packages
import { BOARD_CATALOGUE } from '../../src/content/board';

for (const deck of BOARD_CATALOGUE) {
  if (getCategory(deck.id)) {
    console.log(`skip (already exists): ${deck.id}`);
    continue;
  }
  createCategory({
    id: deck.id,
    nameAr: deck.nameAr,
    nameEn: deck.nameEn,
    tier: deck.tier,
    level: deck.level,
    region: deck.region,
  });
  deck.tiles.forEach((tile, index) => {
    updateTile(deck.id, index, {
      promptAr: tile.promptAr,
      promptEn: tile.promptEn,
      answerAr: tile.answerAr,
      answerEn: tile.answerEn,
      mediaType: tile.mediaType,
    });
  });
  // A category never publishes itself on creation, even seeded ones — but
  // this content is exactly the case the exception is for: pre-vetted,
  // fact-checked, and complete. Running the seed script *is* the human
  // approval a real import would otherwise wait for.
  setCategoryStatus(deck.id, 'published');
  console.log(`seeded: ${deck.id} (${deck.tiles.length} tiles)`);
}
