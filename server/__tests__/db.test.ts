import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-${Date.now()}-${Math.random()}.sqlite`);

import {
  CategoryNotFoundError,
  DuplicateCategoryError,
  createCategory,
  deleteCategory,
  getCategory,
  importTitlesIntoCategory,
  listCategories,
  listCompleteCategories,
  resetDbForTests,
  updateCategory,
  updateTile,
} from '../src/db';

beforeEach(() => resetDbForTests());

const sample = {
  id: 'test-cat',
  nameAr: 'فئة',
  nameEn: 'Test Category',
  tier: 'free' as const,
  level: 'family' as const,
  region: 'global' as const,
};

describe('createCategory', () => {
  it('creates a category with six empty, needs-content tile slots', () => {
    const cat = createCategory(sample);
    expect(cat.tiles).toHaveLength(6);
    expect(cat.tiles.map((t) => t.points)).toEqual([100, 200, 300, 400, 500, 600]);
    expect(cat.tiles.every((t) => t.needsContent)).toBe(true);
  });

  it('rejects a duplicate id', () => {
    createCategory(sample);
    expect(() => createCategory(sample)).toThrow(DuplicateCategoryError);
  });
});

describe('updateCategory', () => {
  it('updates metadata without touching tiles', () => {
    createCategory(sample);
    const updated = updateCategory(sample.id, { nameEn: 'Renamed' });
    expect(updated.nameEn).toBe('Renamed');
    expect(updated.tiles).toHaveLength(6);
  });

  it('throws for an unknown category', () => {
    expect(() => updateCategory('nope', { nameEn: 'x' })).toThrow(CategoryNotFoundError);
  });
});

describe('deleteCategory', () => {
  it('removes the category and its tiles', () => {
    createCategory(sample);
    deleteCategory(sample.id);
    expect(getCategory(sample.id)).toBeNull();
  });

  it('throws for an unknown category', () => {
    expect(() => deleteCategory('nope')).toThrow(CategoryNotFoundError);
  });
});

describe('updateTile', () => {
  it('fills a tile and clears needsContent once all four fields are set', () => {
    createCategory(sample);
    const tile = updateTile(sample.id, 0, {
      promptAr: 'سؤال',
      promptEn: 'question',
      answerAr: 'جواب',
      answerEn: 'answer',
    });
    expect(tile.needsContent).toBe(false);
  });

  it('leaves needsContent true if any field is still empty', () => {
    createCategory(sample);
    const tile = updateTile(sample.id, 0, { promptAr: 'سؤال', promptEn: 'question' });
    expect(tile.needsContent).toBe(true);
  });
});

describe('importTitlesIntoCategory', () => {
  it('fills only empty slots, up to how many titles are given', () => {
    createCategory(sample);
    const { filled, skipped } = importTitlesIntoCategory(sample.id, ['a', 'b', 'c']);
    expect(filled).toBe(3);
    expect(skipped).toBe(0);
    const cat = getCategory(sample.id)!;
    expect(cat.tiles.filter((t) => t.promptAr === 'a' || t.promptAr === 'b' || t.promptAr === 'c')).toHaveLength(3);
    expect(cat.tiles.every((t) => t.needsContent)).toBe(true); // titles alone are not complete content
  });

  it('never overwrites a slot that already has content', () => {
    createCategory(sample);
    updateTile(sample.id, 0, {
      promptAr: 'موجود',
      promptEn: 'existing',
      answerAr: 'ج',
      answerEn: 'a',
    });
    importTitlesIntoCategory(sample.id, ['new title']);
    const cat = getCategory(sample.id)!;
    expect(cat.tiles[0].promptAr).toBe('موجود');
    expect(cat.tiles[1].promptAr).toBe('new title');
  });

  it('reports skipped titles once every slot is full', () => {
    createCategory(sample);
    const { filled, skipped } = importTitlesIntoCategory(sample.id, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(filled).toBe(6);
    expect(skipped).toBe(1);
  });
});

describe('listCompleteCategories', () => {
  it('excludes a category with any empty tile', () => {
    createCategory(sample);
    expect(listCompleteCategories()).toEqual([]);
  });

  it('includes a category once every tile has real content', () => {
    createCategory(sample);
    for (let i = 0; i < 6; i++) {
      updateTile(sample.id, i, {
        promptAr: `س${i}`,
        promptEn: `q${i}`,
        answerAr: `ج${i}`,
        answerEn: `a${i}`,
      });
    }
    const complete = listCompleteCategories();
    expect(complete).toHaveLength(1);
    expect(complete[0].id).toBe(sample.id);
  });
});

describe('listCategories', () => {
  it('returns every category regardless of completeness', () => {
    createCategory(sample);
    createCategory({ ...sample, id: 'test-cat-2' });
    expect(listCategories()).toHaveLength(2);
  });
});
