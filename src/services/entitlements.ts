import { KEYS, type KeyValueStore } from '../engine/persistence';

/**
 * Entitlement layer, kept apart from everything else so a store SDK can be
 * added later without touching the engine. The engine only ever asks "which
 * pack ids may I deal from"; how that list is produced is this module's
 * business. There is no payment code in the MVP.
 */
export interface Pack {
  id: string;
  /** Translation key for the pack name. */
  nameKey: string;
  free: boolean;
}

export const PACKS: Pack[] = [
  { id: 'core', nameKey: 'rooms.mixed', free: true },
  // Placeholders for the planned catalogue. No content ships under these ids
  // yet, so they are invisible in the MVP.
  { id: 'nostalgia', nameKey: 'rooms.kuwait', free: false },
  { id: 'ramadan-plus', nameKey: 'rooms.ramadan', free: false },
  { id: 'couples-plus', nameKey: 'rooms.couples', free: false },
];

export const FREE_PACKS = PACKS.filter((p) => p.free).map((p) => p.id);

export async function ownedPacks(store: KeyValueStore): Promise<string[]> {
  try {
    const raw = await store.getItem(KEYS.entitlements);
    const owned = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.from(new Set([...FREE_PACKS, ...owned]));
  } catch {
    return FREE_PACKS;
  }
}

/** Used by tests and, later, by a purchase callback. */
export async function grantPack(store: KeyValueStore, packId: string): Promise<string[]> {
  const current = await ownedPacks(store);
  const next = Array.from(new Set([...current, packId]));
  await store.setItem(KEYS.entitlements, JSON.stringify(next));
  return next;
}

// Board-game credits used to live here as a local AsyncStorage counter, but
// that made them trivially forgeable (edit local storage, play for free
// forever). They are now server-authoritative — see
// `src/services/boardPaymentApi.ts` and `server/src/db.ts`'s credit ledger —
// and require a signed-in player account, unlike everything else in this
// file.
