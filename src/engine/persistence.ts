import { STATE_VERSION } from './config';
import { isBoardComplete } from './board/board';
import type { BoardState } from './board/types';
import type {
  ContentLevel,
  Lang,
  Player,
  PromptReport,
  RoomId,
  SessionLength,
  SessionState,
} from './types';

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
  session: 'ym:session:v1',
  recent: 'ym:recent:v1',
  reports: 'ym:reports:v1',
  entitlements: 'ym:entitlements:v1',
  boardCredits: 'ym:boardCredits:v1',
  board: 'ym:board:v1',
} as const;

export interface Preferences {
  lang: Lang | null;
  /** Names are kept only on the device and never sent anywhere. */
  lastPlayers: Player[];
  lastRoom: RoomId;
  lastLength: SessionLength;
  lastLevel: ContentLevel;
  lastMode: 'teams' | 'ffa';
  sound: boolean;
  haptics: boolean;
  motion: boolean;
  reduceMotion: boolean;
  hasSeenHowToPlay: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  lang: null,
  lastPlayers: [],
  lastRoom: 'friends',
  lastLength: 'standard',
  lastLevel: 'family',
  lastMode: 'teams',
  sound: true,
  haptics: true,
  motion: true,
  reduceMotion: false,
  hasSeenHowToPlay: false,
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

export async function saveSession(store: KeyValueStore, state: SessionState): Promise<void> {
  await store.setItem(KEYS.session, JSON.stringify(state));
}

/** Returns `null` for a missing, corrupt or out-of-date saved game. */
export async function loadSession(store: KeyValueStore): Promise<SessionState | null> {
  try {
    const raw = await store.getItem(KEYS.session);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionState;
    if (parsed.version !== STATE_VERSION) return null;
    if (!parsed.plan?.length || !parsed.setup?.teams?.length) return null;
    if (parsed.phase === 'finished') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSession(store: KeyValueStore): Promise<void> {
  await store.removeItem(KEYS.session);
}

export async function loadRecent(store: KeyValueStore): Promise<Record<string, string[]>> {
  try {
    const raw = await store.getItem(KEYS.recent);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

export async function saveRecent(
  store: KeyValueStore,
  recent: Record<string, string[]>
): Promise<void> {
  await store.setItem(KEYS.recent, JSON.stringify(recent));
}

export async function loadReports(store: KeyValueStore): Promise<PromptReport[]> {
  try {
    const raw = await store.getItem(KEYS.reports);
    return raw ? (JSON.parse(raw) as PromptReport[]) : [];
  } catch {
    return [];
  }
}

export async function addReport(
  store: KeyValueStore,
  report: PromptReport
): Promise<PromptReport[]> {
  const all = await loadReports(store);
  const next = [...all, report].slice(-200);
  await store.setItem(KEYS.reports, JSON.stringify(next));
  return next;
}

export async function saveBoard(store: KeyValueStore, state: BoardState): Promise<void> {
  await store.setItem(KEYS.board, JSON.stringify(state));
}

/** Returns `null` for a missing, corrupt or malformed saved board. */
export async function loadBoard(store: KeyValueStore): Promise<BoardState | null> {
  try {
    const raw = await store.getItem(KEYS.board);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BoardState;
    if (parsed.tiles?.length !== 36 || parsed.teams?.length !== 2) return null;
    if (isBoardComplete(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearBoard(store: KeyValueStore): Promise<void> {
  await store.removeItem(KEYS.board);
}

/** "Delete everything on this device" — one call, no server involved. */
export async function resetAllLocalData(store: KeyValueStore): Promise<void> {
  await Promise.all(Object.values(KEYS).map((k) => store.removeItem(k)));
}
