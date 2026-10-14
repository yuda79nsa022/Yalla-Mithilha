import {
  KEYS,
  MemoryStore,
  clearCharades,
  clearPlayerSession,
  loadCharades,
  loadPlayerSession,
  loadPreferences,
  resetAllLocalData,
  saveCharades,
  savePlayerSession,
  savePreferences,
  DEFAULT_PREFERENCES,
} from '../src/engine/persistence';
import { draftCharades, unlockCharades, type CharadesTitle } from '../src/engine/charades';
import { draftModifiedCharades } from '../src/engine/modifiedCharades';

const titles: CharadesTitle[] = Array.from({ length: 5 }, (_, i) => ({
  id: `t${i}`,
  text: `Title ${i}`,
  deckNameAr: 'مجموعة',
  deckNameEn: 'Deck',
}));

describe('loadCharades', () => {
  it('returns null when nothing is saved', async () => {
    const store = new MemoryStore();
    expect(await loadCharades(store)).toBeNull();
  });

  it('round-trips a saved classic game', async () => {
    const store = new MemoryStore();
    const state = unlockCharades(draftCharades('A', 'B'), titles, 'player-1');
    await saveCharades(store, state);
    expect(await loadCharades(store)).toEqual(state);
  });

  it('round-trips a saved modified game', async () => {
    const store = new MemoryStore();
    const state = draftModifiedCharades('A', 'B');
    await saveCharades(store, state);
    expect(await loadCharades(store)).toEqual(state);
  });

  it('migrates a game saved before `mode` existed to classic, rather than dropping it', async () => {
    const store = new MemoryStore();
    // What a pre-dual-mode save looked like: a classic CharadesState with no
    // `mode` field at all, written directly (saveCharades always stamps the
    // current shape, so this simulates an app update finding an old save).
    const legacy = unlockCharades(draftCharades('A', 'B'), titles, 'player-1');
    const { mode: _mode, ...legacyWithoutMode } = legacy as typeof legacy & { mode: string };
    await store.setItem(KEYS.charades, JSON.stringify(legacyWithoutMode));

    const loaded = await loadCharades(store);
    expect(loaded).not.toBeNull();
    expect(loaded!.mode).toBe('classic');
    expect(loaded!.id).toBe(legacy.id);
  });

  it('returns null for a finished saved game', async () => {
    const store = new MemoryStore();
    let state = unlockCharades(draftCharades('A', 'B'), titles.slice(0, 1), 'player-1');
    state = { ...state, index: 1 }; // past the single dealt title — complete
    await saveCharades(store, state);
    expect(await loadCharades(store)).toBeNull();
  });

  it('returns null for corrupt JSON rather than throwing', async () => {
    const store = new MemoryStore();
    await store.setItem(KEYS.charades, '{not json');
    expect(await loadCharades(store)).toBeNull();
  });

  it('returns null when the saved value has no id', async () => {
    const store = new MemoryStore();
    await store.setItem(KEYS.charades, JSON.stringify({ teamAName: 'A' }));
    expect(await loadCharades(store)).toBeNull();
  });
});

describe('clearCharades', () => {
  it('removes the saved game', async () => {
    const store = new MemoryStore();
    const state = unlockCharades(draftCharades('A', 'B'), titles, 'player-1');
    await saveCharades(store, state);
    await clearCharades(store);
    expect(await loadCharades(store)).toBeNull();
  });
});

describe('preferences', () => {
  it('falls back to the default when nothing is saved', async () => {
    const store = new MemoryStore();
    expect(await loadPreferences(store)).toEqual(DEFAULT_PREFERENCES);
  });

  it('round-trips saved preferences', async () => {
    const store = new MemoryStore();
    await savePreferences(store, { lang: 'ar', musicVolume: 0.6, musicMuted: true });
    expect(await loadPreferences(store)).toEqual({ lang: 'ar', musicVolume: 0.6, musicMuted: true });
  });

  it('backfills a field missing from an older saved shape with the current default', async () => {
    const store = new MemoryStore();
    // Simulates a save written before `musicVolume`/`musicMuted` existed.
    await store.setItem(KEYS.preferences, JSON.stringify({ lang: 'en' }));
    expect(await loadPreferences(store)).toEqual({ lang: 'en', musicVolume: 0.25, musicMuted: false });
  });
});

describe('player session', () => {
  it('returns null when nothing is saved', async () => {
    const store = new MemoryStore();
    expect(await loadPlayerSession(store)).toBeNull();
  });

  it('round-trips a saved session', async () => {
    const store = new MemoryStore();
    const session = { id: 'p1', username: 'alice', token: 'tok' };
    await savePlayerSession(store, session);
    expect(await loadPlayerSession(store)).toEqual(session);
  });

  it('returns null for a malformed saved session', async () => {
    const store = new MemoryStore();
    await store.setItem(KEYS.playerSession, JSON.stringify({ id: 'p1' }));
    expect(await loadPlayerSession(store)).toBeNull();
  });

  it('clearPlayerSession removes it', async () => {
    const store = new MemoryStore();
    await savePlayerSession(store, { id: 'p1', username: 'alice', token: 'tok' });
    await clearPlayerSession(store);
    expect(await loadPlayerSession(store)).toBeNull();
  });
});

describe('resetAllLocalData', () => {
  it('clears preferences, the saved game and the player session together', async () => {
    const store = new MemoryStore();
    await savePreferences(store, { lang: 'ar', musicVolume: 0.5, musicMuted: false });
    await saveCharades(store, unlockCharades(draftCharades('A', 'B'), titles, 'player-1'));
    await savePlayerSession(store, { id: 'p1', username: 'alice', token: 'tok' });

    await resetAllLocalData(store);

    expect(await loadPreferences(store)).toEqual(DEFAULT_PREFERENCES);
    expect(await loadCharades(store)).toBeNull();
    expect(await loadPlayerSession(store)).toBeNull();
  });
});
