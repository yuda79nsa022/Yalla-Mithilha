import { ALL_PROMPTS, promptsByGame, roomCoverage, validateContent } from '../src/content';
import { ALL_MINI_GAMES, MINI_GAMES, ROOMS } from '../src/engine/config';
import { filterPrompts } from '../src/engine/selector';

describe('content library', () => {
  it('ships at least 120 usable bilingual prompts', () => {
    const usable = ALL_PROMPTS.filter((p) => p.enabled);
    expect(usable.length).toBeGreaterThanOrEqual(120);
  });

  it('passes the authoring rules', () => {
    expect(validateContent()).toEqual([]);
  });

  it('has content for every mini-game', () => {
    const grouped = promptsByGame();
    for (const game of ALL_MINI_GAMES) {
      expect(grouped[game]?.length ?? 0).toBeGreaterThanOrEqual(MINI_GAMES[game].cardsPerRound);
    }
  });

  it('gives every room enough cards to fill a round of some mini-game', () => {
    const coverage = roomCoverage();
    for (const room of ROOMS) {
      if (room === 'mixed') continue;
      expect(coverage[room] ?? 0).toBeGreaterThan(10);
    }
  });

  it('keeps a kids session free of higher-level cards', () => {
    for (const game of ALL_MINI_GAMES) {
      const pool = filterPrompts({ game, room: 'mixed', level: 'kids' });
      expect(pool.every((p) => p.level === 'kids')).toBe(true);
    }
  });

  it('translates every prompt into both languages', () => {
    for (const p of ALL_PROMPTS) {
      expect(p.ar.trim().length).toBeGreaterThan(2);
      expect(p.en.trim().length).toBeGreaterThan(2);
      // A card whose Arabic and English are identical is almost certainly a
      // forgotten translation.
      expect(p.ar.trim()).not.toEqual(p.en.trim());
    }
  });

  it('gives taboo cards forbidden words in both languages', () => {
    const taboo = ALL_PROMPTS.filter((p) => p.game === 'taboo');
    expect(taboo.length).toBeGreaterThan(20);
    for (const p of taboo) {
      expect(p.forbiddenAr?.length).toBeGreaterThanOrEqual(3);
      expect(p.forbiddenEn?.length).toBeGreaterThanOrEqual(3);
    }
  });
});
