import { isCharadesComplete } from './charades';
import type { CharadesState } from './charades';
import type { Lang } from './types';

/**
 * The engine talks to this interface, never to AsyncStorage directly, so the
 * same code runs in tests (memory adapter) and on device (AsyncStorage).
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  async getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  async removeItem(key: string) {
    this.map.delete(key);
  }
}

export const KEYS = {
  preferences: 'ym:preferences:v1',
  charades: 'ym:charades:v1',
  playerSession: 'ym:playerSession:v1',
} as const;

export interface Preferences {
  lang: Lang | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  lang: null,
};

async function readJson<T>(store: KeyValueStore, key: string, fallback: T): Promise<T> {
  try {
    const raw = await store.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

export async function loadPreferences(store: KeyValueStore): Promise<Preferences> {
  return readJson(store, KEYS.preferences, DEFAULT_PREFERENCES);
}

export async function savePreferences(
  store: KeyValueStore,
  prefs: Preferences
): Promise<void> {
  await store.setItem(KEYS.preferences, JSON.stringify(prefs));
}

export async function saveCharades(store: KeyValueStore, state: CharadesState): Promise<void> {
  await store.setItem(KEYS.charades, JSON.stringify(state));
}

/** Returns `null` for a missing, corrupt or already-finished saved session. */
export async function loadCharades(store: KeyValueStore): Promise<CharadesState | null> {
  try {
    const raw = await store.getItem(KEYS.charades);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CharadesState;
    if (typeof parsed.id !== 'string' || !parsed.id) return null;
    if (isCharadesComplete(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearCharades(store: KeyValueStore): Promise<void> {
  await store.removeItem(KEYS.charades);
}

/** An optional, real account — separate from guest play, which never creates one of these. */
export interface PlayerSession {
  id: string;
  username: string;
  token: string;
}

export async function savePlayerSession(store: KeyValueStore, session: PlayerSession): Promise<void> {
  await store.setItem(KEYS.playerSession, JSON.stringify(session));
}

/** Returns `null` for a missing or corrupt session — the caller falls back to guest play. */
export async function loadPlayerSession(store: KeyValueStore): Promise<PlayerSession | null> {
  try {
    const raw = await store.getItem(KEYS.playerSession);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerSession;
    if (typeof parsed.id !== 'string' || typeof parsed.username !== 'string' || typeof parsed.token !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPlayerSession(store: KeyValueStore): Promise<void> {
  await store.removeItem(KEYS.playerSession);
}

/** "Delete everything on this device" — one call, no server involved. */
export async function resetAllLocalData(store: KeyValueStore): Promise<void> {
  await Promise.all(Object.values(KEYS).map((k) => store.removeItem(k)));
}
