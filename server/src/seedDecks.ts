/**
 * Loads the bundled starter decks (server/seed-data/decks/*.json) into the
 * database. Safe to re-run: a deck that already exists is left as-is and
 * `addTitlesToDeck` itself skips titles already present, so a repeat run
 * only tops up whatever is missing rather than duplicating anything.
 *
 *   npm run seed-decks
 */
import './loadEnv';
import fs from 'fs';
import path from 'path';
import { createDeck, getDeck, addTitlesToDeck } from './db';

interface DeckSeed {
  id: string;
  nameAr: string;
  nameEn: string;
  titles: string[];
}

function main() {
  const dir = path.join(__dirname, '..', 'seed-data', 'decks');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const seed = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as DeckSeed;

    if (!getDeck(seed.id)) {
      createDeck({ id: seed.id, nameAr: seed.nameAr, nameEn: seed.nameEn });
      console.log(`Created deck "${seed.id}" (${seed.nameEn}).`);
    }

    const { added, skipped } = addTitlesToDeck(seed.id, seed.titles);
    console.log(`  ${seed.id}: added ${added} title(s), skipped ${skipped} already present.`);
  }
}

main();
