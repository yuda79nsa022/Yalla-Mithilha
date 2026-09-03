import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-${Date.now()}-${Math.random()}.sqlite`);

import {
  AdminUserNotFoundError,
  CategoryNotFoundError,
  DuplicateCategoryError,
  DuplicatePlayerUsernameError,
  DuplicateUsernameError,
  LastAdminError,
  PlayerNotFoundError,
  createAdminUser,
  createCategory,
  createPlayer,
  deleteAdminUser,
  deleteCategory,
  deletePlayer,
  getAdminUserById,
  getCategory,
  getPlayerById,
  importTitlesIntoCategory,
  listAdminUsers,
  listCategories,
  listCompleteCategories,
  listPlayers,
  resetDbForTests,
  updateAdminUser,
  updateCategory,
  updatePlayer,
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

describe('admin users', () => {
  it('creates a user and never exposes the password hash from a getter', () => {
    const user = createAdminUser({ username: 'jane', passwordHash: 'hashed' });
    expect((user as any).passwordHash).toBeUndefined();
    expect(getAdminUserById(user.id)).toMatchObject({ username: 'jane' });
  });

  it('rejects a duplicate username', () => {
    createAdminUser({ username: 'jane', passwordHash: 'hashed' });
    expect(() => createAdminUser({ username: 'jane', passwordHash: 'other' })).toThrow(
      DuplicateUsernameError
    );
  });

  it('updates a username, rejecting a collision with another user', () => {
    createAdminUser({ username: 'jane', passwordHash: 'hashed' });
    const bob = createAdminUser({ username: 'bob', passwordHash: 'hashed' });
    expect(() => updateAdminUser(bob.id, { username: 'jane' })).toThrow(DuplicateUsernameError);
    expect(updateAdminUser(bob.id, { username: 'bobby' }).username).toBe('bobby');
  });

  it('throws for an unknown user id', () => {
    expect(() => updateAdminUser('nope', { username: 'x' })).toThrow(AdminUserNotFoundError);
    expect(() => deleteAdminUser('nope')).toThrow(AdminUserNotFoundError);
  });

  it('refuses to delete the last remaining admin', () => {
    const only = createAdminUser({ username: 'solo', passwordHash: 'hashed' });
    expect(() => deleteAdminUser(only.id)).toThrow(LastAdminError);
  });

  it('allows deleting an admin once a second one exists', () => {
    const a = createAdminUser({ username: 'a', passwordHash: 'hashed' });
    createAdminUser({ username: 'b', passwordHash: 'hashed' });
    expect(() => deleteAdminUser(a.id)).not.toThrow();
    expect(listAdminUsers()).toHaveLength(1);
  });
});

describe('players', () => {
  it('creates a player and never exposes the password hash from a getter', () => {
    const player = createPlayer({ username: 'jane', passwordHash: 'hashed' });
    expect((player as any).passwordHash).toBeUndefined();
    expect(getPlayerById(player.id)).toMatchObject({ username: 'jane' });
  });

  it('rejects a duplicate username', () => {
    createPlayer({ username: 'jane', passwordHash: 'hashed' });
    expect(() => createPlayer({ username: 'jane', passwordHash: 'other' })).toThrow(
      DuplicatePlayerUsernameError
    );
  });

  it('updates a username, rejecting a collision with another player', () => {
    createPlayer({ username: 'jane', passwordHash: 'hashed' });
    const bob = createPlayer({ username: 'bob', passwordHash: 'hashed' });
    expect(() => updatePlayer(bob.id, { username: 'jane' })).toThrow(DuplicatePlayerUsernameError);
    expect(updatePlayer(bob.id, { username: 'bobby' }).username).toBe('bobby');
  });

  it('throws for an unknown player id', () => {
    expect(() => updatePlayer('nope', { username: 'x' })).toThrow(PlayerNotFoundError);
    expect(() => deletePlayer('nope')).toThrow(PlayerNotFoundError);
  });

  it('allows deleting the only player — unlike admins, there is no lockout risk', () => {
    const only = createPlayer({ username: 'solo', passwordHash: 'hashed' });
    expect(() => deletePlayer(only.id)).not.toThrow();
    expect(listPlayers()).toHaveLength(0);
  });
});
