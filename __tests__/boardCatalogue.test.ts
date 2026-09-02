import { BOARD_CATALOGUE } from '../src/content/board/catalogue';

describe('BOARD_CATALOGUE', () => {
  it('has unique category ids', () => {
    const ids = BOARD_CATALOGUE.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every category exactly six tiles with ascending point values', () => {
    for (const deck of BOARD_CATALOGUE) {
      expect(deck.tiles).toHaveLength(6);
      expect(deck.tiles.map((t) => t.points)).toEqual([100, 200, 300, 400, 500, 600]);
      expect(deck.tiles.map((t) => t.index)).toEqual([0, 1, 2, 3, 4, 5]);
    }
  });

  it('has bilingual, non-empty prompt and answer text on every tile', () => {
    for (const deck of BOARD_CATALOGUE) {
      for (const tile of deck.tiles) {
        expect(tile.promptAr.trim()).not.toBe('');
        expect(tile.promptEn.trim()).not.toBe('');
        expect(tile.answerAr.trim()).not.toBe('');
        expect(tile.answerEn.trim()).not.toBe('');
      }
    }
  });

  it('offers at least six categories, enough for both teams to draft from', () => {
    expect(BOARD_CATALOGUE.length).toBeGreaterThanOrEqual(6);
  });
});
