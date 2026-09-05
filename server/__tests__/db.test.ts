import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-${Date.now()}-${Math.random()}.sqlite`);

import {
  AdminUserNotFoundError,
  DeckNotFoundError,
  DuplicateDeckError,
  DuplicatePlayerUsernameError,
  DuplicateUsernameError,
  LastAdminError,
  PlayerNotFoundError,
  addTitlesToDeck,
  createAdminUser,
  createDeck,
  createPlayer,
  creditBalance,
  deleteAdminUser,
  deleteDeck,
  deletePlayer,
  deleteTitle,
  getAdminUserById,
  getDeck,
  getGamePriceFils,
  getPlayerById,
  grantCredits,
  listAdminUsers,
  listDecks,
  listPlayableDecks,
  listPlayers,
  resetDbForTests,
  setGamePriceFils,
  updateAdminUser,
  updateDeck,
  updatePlayer,
} from '../src/db';

beforeEach(() => resetDbForTests());

const sample = {
  id: 'test-deck',
  nameAr: 'مجموعة',
  nameEn: 'Test Deck',
};

describe('createDeck', () => {
  it('creates a deck with no titles yet', () => {
    const deck = createDeck(sample);
    expect(deck.titles).toEqual([]);
  });

  it('rejects a duplicate id', () => {
    createDeck(sample);
    expect(() => createDeck(sample)).toThrow(DuplicateDeckError);
  });
});

describe('updateDeck', () => {
  it('updates metadata without touching titles', () => {
    createDeck(sample);
    addTitlesToDeck(sample.id, ['a']);
    const updated = updateDeck(sample.id, { nameEn: 'Renamed' });
    expect(updated.nameEn).toBe('Renamed');
    expect(updated.titles).toHaveLength(1);
  });

  it('throws for an unknown deck', () => {
    expect(() => updateDeck('nope', { nameEn: 'x' })).toThrow(DeckNotFoundError);
  });
});

describe('deleteDeck', () => {
  it('removes the deck and its titles', () => {
    createDeck(sample);
    deleteDeck(sample.id);
    expect(getDeck(sample.id)).toBeNull();
  });

  it('throws for an unknown deck', () => {
    expect(() => deleteDeck('nope')).toThrow(DeckNotFoundError);
  });
});

describe('addTitlesToDeck', () => {
  it('adds every non-empty title — no fixed slot count, unlike the old board-game import', () => {
    createDeck(sample);
    const { added, skipped } = addTitlesToDeck(sample.id, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(added).toBe(7);
    expect(skipped).toBe(0);
    expect(getDeck(sample.id)!.titles).toHaveLength(7);
  });

  it('skips exact duplicates already in the deck, including across two calls', () => {
    createDeck(sample);
    addTitlesToDeck(sample.id, ['a', 'b']);
    const { added, skipped } = addTitlesToDeck(sample.id, ['b', 'c']);
    expect(added).toBe(1);
    expect(skipped).toBe(1);
    expect(getDeck(sample.id)!.titles.map((t) => t.text).sort()).toEqual(['a', 'b', 'c']);
  });

  it('skips blank lines', () => {
    createDeck(sample);
    const { added, skipped } = addTitlesToDeck(sample.id, ['a', '  ', '']);
    expect(added).toBe(1);
    expect(skipped).toBe(2);
  });

  it('throws for an unknown deck', () => {
    expect(() => addTitlesToDeck('nope', ['a'])).toThrow(DeckNotFoundError);
  });
});

describe('deleteTitle', () => {
  it('removes one title, leaving the rest', () => {
    createDeck(sample);
    addTitlesToDeck(sample.id, ['a', 'b']);
    const titleId = getDeck(sample.id)!.titles[0].id;
    deleteTitle(sample.id, titleId);
    expect(getDeck(sample.id)!.titles).toHaveLength(1);
  });

  it('throws for an unknown title', () => {
    createDeck(sample);
    expect(() => deleteTitle(sample.id, 'nope')).toThrow();
  });
});

describe('listPlayableDecks', () => {
  it('excludes a deck with no titles', () => {
    createDeck(sample);
    expect(listPlayableDecks()).toEqual([]);
  });

  it('includes a deck once it has at least one title', () => {
    createDeck(sample);
    addTitlesToDeck(sample.id, ['a']);
    expect(listPlayableDecks().map((d) => d.id)).toEqual([sample.id]);
  });
});

describe('listDecks', () => {
  it('returns every deck regardless of title count', () => {
    createDeck(sample);
    createDeck({ ...sample, id: 'test-deck-2' });
    expect(listDecks()).toHaveLength(2);
  });
});

describe('game price setting', () => {
  it('has a sane default', () => {
    expect(getGamePriceFils()).toBeGreaterThan(0);
  });

  it('is admin-editable and persists', () => {
    setGamePriceFils(2000);
    expect(getGamePriceFils()).toBe(2000);
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

describe('grantCredits', () => {
  it('adds to the balance with no payment behind it', () => {
    const player = createPlayer({ username: 'jane', passwordHash: 'hashed' });
    expect(creditBalance(player.id)).toBe(0);
    grantCredits(player.id, 3);
    expect(creditBalance(player.id)).toBe(3);
  });

  it('is additive across repeated calls, same as topping up an existing test player', () => {
    const player = createPlayer({ username: 'jane', passwordHash: 'hashed' });
    grantCredits(player.id, 2);
    grantCredits(player.id, 5);
    expect(creditBalance(player.id)).toBe(7);
  });
});
