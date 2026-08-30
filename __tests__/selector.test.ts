import { createRng } from '../src/engine/rng';
import {
  availableMiniGames,
  filterPrompts,
  matchesLevel,
  matchesRoom,
  rememberPrompts,
  selectPrompts,
} from '../src/engine/selector';
import type { Prompt } from '../src/engine/types';

function makePrompt(overrides: Partial<Prompt> & { id: string }): Prompt {
  return {
    game: 'act',
    ar: 'نص',
    en: 'text',
    rooms: ['friends'],
    difficulty: 'easy',
    level: 'family',
    region: 'kw',
    enabled: true,
    pack: 'core',
    ...overrides,
  };
}

const pool: Prompt[] = Array.from({ length: 10 }, (_, i) =>
  makePrompt({ id: `p${i}`, ar: `نص ${i}`, en: `text ${i}` })
);

describe('room and level matching', () => {
  it('treats "mixed" as every room', () => {
    const p = makePrompt({ id: 'x', rooms: ['ramadan'] });
    expect(matchesRoom(p, 'mixed')).toBe(true);
    expect(matchesRoom(p, 'ramadan')).toBe(true);
    expect(matchesRoom(p, 'kids')).toBe(false);
  });

  it('lets a lower content level play in a higher one, never the reverse', () => {
    const kids = makePrompt({ id: 'k', level: 'kids' });
    const adults = makePrompt({ id: 'a', level: 'adults' });
    expect(matchesLevel(kids, 'adults')).toBe(true);
    expect(matchesLevel(adults, 'kids')).toBe(false);
    expect(matchesLevel(adults, 'adults')).toBe(true);
  });

  it('drops disabled prompts and unowned packs', () => {
    const local = [
      makePrompt({ id: 'on' }),
      makePrompt({ id: 'off', enabled: false }),
      makePrompt({ id: 'paid', pack: 'nostalgia' }),
    ];
    const result = filterPrompts({ game: 'act', room: 'friends', level: 'adults' }, local);
    expect(result.map((p) => p.id)).toEqual(['on']);

    const withPack = filterPrompts(
      { game: 'act', room: 'friends', level: 'adults', packs: ['core', 'nostalgia'] },
      local
    );
    expect(withPack.map((p) => p.id).sort()).toEqual(['on', 'paid']);
  });
});

describe('selectPrompts', () => {
  it('never returns a prompt already used in this session', () => {
    const picked = selectPrompts(
      {
        game: 'act',
        room: 'friends',
        level: 'family',
        count: 5,
        usedIds: ['p0', 'p1', 'p2'],
        recentIds: [],
        rng: createRng(1),
      },
      pool
    );
    expect(picked).toHaveLength(5);
    expect(picked.map((p) => p.id)).not.toContain('p0');
    expect(picked.map((p) => p.id)).not.toContain('p1');
  });

  it('prefers prompts outside the cross-session recency window', () => {
    const recent = ['p0', 'p1', 'p2', 'p3', 'p4'];
    const picked = selectPrompts(
      {
        game: 'act',
        room: 'friends',
        level: 'family',
        count: 5,
        usedIds: [],
        recentIds: recent,
        rng: createRng(7),
      },
      pool
    );
    expect(picked.map((p) => p.id).sort()).toEqual(['p5', 'p6', 'p7', 'p8', 'p9']);
  });

  it('releases the oldest memories first when the pool runs short', () => {
    const recent = pool.map((p) => p.id); // everything is "recent"
    const picked = selectPrompts(
      {
        game: 'act',
        room: 'friends',
        level: 'family',
        count: 3,
        usedIds: [],
        recentIds: recent,
        rng: createRng(3),
      },
      pool
    );
    expect(picked.map((p) => p.id)).toEqual(['p0', 'p1', 'p2']);
  });

  it('returns fewer cards rather than repeating when nothing is left', () => {
    const picked = selectPrompts(
      {
        game: 'act',
        room: 'friends',
        level: 'family',
        count: 5,
        usedIds: pool.slice(0, 8).map((p) => p.id),
        recentIds: [],
        rng: createRng(11),
      },
      pool
    );
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((p) => p.id)).size).toBe(2);
  });

  it('deals a different order for different seeds', () => {
    const a = selectPrompts(
      {
        game: 'act',
        room: 'friends',
        level: 'family',
        count: 6,
        usedIds: [],
        recentIds: [],
        rng: createRng(1),
      },
      pool
    ).map((p) => p.id);
    const b = selectPrompts(
      {
        game: 'act',
        room: 'friends',
        level: 'family',
        count: 6,
        usedIds: [],
        recentIds: [],
        rng: createRng(999),
      },
      pool
    ).map((p) => p.id);
    expect(a).not.toEqual(b);
  });
});

describe('rememberPrompts', () => {
  it('appends ids and caps the window per mini-game', () => {
    let recent: Record<string, string[]> = {};
    for (let i = 0; i < 60; i++) {
      recent = rememberPrompts(recent, 'act', [`id-${i}`]);
    }
    expect(recent.act).toHaveLength(40);
    expect(recent.act[recent.act.length - 1]).toBe('id-59');
    expect(recent.act).not.toContain('id-0');
  });

  it('moves a repeated id to the newest position instead of duplicating it', () => {
    let recent = rememberPrompts({}, 'act', ['a', 'b', 'c']);
    recent = rememberPrompts(recent, 'act', ['a']);
    expect(recent.act).toEqual(['b', 'c', 'a']);
  });
});

describe('availableMiniGames', () => {
  it('excludes mini-games without enough cards for one round', () => {
    const thin = [makePrompt({ id: 'only-one' })];
    expect(availableMiniGames('friends', 'family', ['act'], thin)).toEqual([]);
  });

  it('respects a mini-game room whitelist', () => {
    // `who` is not offered in the Ramadan room by configuration.
    expect(availableMiniGames('ramadan', 'family', ['who'])).toEqual([]);
    expect(availableMiniGames('friends', 'family', ['who'])).toEqual(['who']);
  });
});
