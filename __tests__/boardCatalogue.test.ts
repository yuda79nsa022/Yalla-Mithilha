import { BOARD_CATALOGUE, validateBoardCatalogue } from '../src/content/board';
import type { CategoryDeck } from '../src/engine/board/types';

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

  it('passes the authoring rules', () => {
    expect(validateBoardCatalogue()).toEqual([]);
  });
});

describe('validateBoardCatalogue', () => {
  const valid: CategoryDeck = {
    id: 'sample',
    nameAr: 'sample',
    nameEn: 'sample',
    tier: 'free',
    level: 'family',
    region: 'global',
    tiles: [100, 200, 300, 400, 500, 600].map((points, i) => ({
      id: `sample-${i + 1}`,
      index: i,
      points,
      mediaType: 'text',
      promptAr: `س${i}`,
      promptEn: `q${i}`,
      answerAr: `ج${i}`,
      answerEn: `a${i}`,
    })),
  };

  it('accepts a well-formed catalogue', () => {
    expect(validateBoardCatalogue([valid])).toEqual([]);
  });

  it('flags a category without exactly six tiles', () => {
    const broken = { ...valid, tiles: valid.tiles.slice(0, 4) };
    const issues = validateBoardCatalogue([broken]);
    expect(issues.some((i) => i.problem.includes('6 tiles'))).toBe(true);
  });

  it('flags a duplicate category id', () => {
    const issues = validateBoardCatalogue([valid, valid]);
    expect(issues.some((i) => i.problem === 'duplicate category id')).toBe(true);
  });

  it('flags a tile id that does not match the categoryId-index convention', () => {
    const broken = {
      ...valid,
      tiles: valid.tiles.map((t, i) => (i === 0 ? { ...t, id: 'wrong-id' } : t)),
    };
    const issues = validateBoardCatalogue([broken]);
    expect(issues.some((i) => i.problem.includes('expected id'))).toBe(true);
  });

  it('flags points out of the expected progression', () => {
    const broken = {
      ...valid,
      tiles: valid.tiles.map((t, i) => (i === 2 ? { ...t, points: 999 } : t)),
    };
    const issues = validateBoardCatalogue([broken]);
    expect(issues.some((i) => i.problem.includes('999'))).toBe(true);
  });

  it('flags an empty translation', () => {
    const broken = {
      ...valid,
      tiles: valid.tiles.map((t, i) => (i === 0 ? { ...t, answerEn: '' } : t)),
    };
    const issues = validateBoardCatalogue([broken]);
    expect(issues.some((i) => i.problem === 'empty English answer')).toBe(true);
  });
});
