import { ALL_PROMPTS } from '../content';
import { MINI_GAMES, RECENT_MEMORY_PER_GAME } from './config';
import { shuffle, type Rng } from './rng';
import {
  CONTENT_LEVEL_ORDER,
  type ContentLevel,
  type MiniGameId,
  type Prompt,
  type RoomId,
} from './types';

export interface FilterOptions {
  game: MiniGameId;
  room: RoomId;
  level: ContentLevel;
  /** Packs the player is entitled to. Defaults to `['core']`. */
  packs?: string[];
}

/**
 * `mixed` is not a tag on any prompt — it means "any room". Every other room
 * matches prompts tagged with that room.
 */
export function matchesRoom(prompt: Prompt, room: RoomId): boolean {
  if (room === 'mixed') return true;
  return prompt.rooms.includes(room);
}

export function matchesLevel(prompt: Prompt, level: ContentLevel): boolean {
  return CONTENT_LEVEL_ORDER[prompt.level] <= CONTENT_LEVEL_ORDER[level];
}

/** Every prompt that could legally appear, before repetition rules. */
export function filterPrompts(
  options: FilterOptions,
  prompts: Prompt[] = ALL_PROMPTS
): Prompt[] {
  const packs = options.packs ?? ['core'];
  const config = MINI_GAMES[options.game];

  return prompts.filter((p) => {
    if (!p.enabled) return false;
    if (p.game !== options.game) return false;
    if (!matchesRoom(p, options.room)) return false;
    if (!matchesLevel(p, options.level)) return false;
    if (p.pack && !packs.includes(p.pack)) return false;
    if (config.eligibleRooms !== 'all' && options.room !== 'mixed') {
      if (!config.eligibleRooms.includes(options.room)) return false;
    }
    if (config.eligibleLevels !== 'all' && !config.eligibleLevels.includes(options.level)) {
      return false;
    }
    return true;
  });
}

/** Which mini-games have enough content to be scheduled for this session. */
export function availableMiniGames(
  room: RoomId,
  level: ContentLevel,
  candidates: MiniGameId[],
  prompts: Prompt[] = ALL_PROMPTS,
  packs?: string[]
): MiniGameId[] {
  return candidates.filter((game) => {
    const config = MINI_GAMES[game];
    if (config.eligibleRooms !== 'all' && room !== 'mixed') {
      if (!config.eligibleRooms.includes(room)) return false;
    }
    return filterPrompts({ game, room, level, packs }, prompts).length >= config.cardsPerRound;
  });
}

export interface SelectionInput extends FilterOptions {
  count: number;
  /** Prompt ids already used in this session — hard exclusion. */
  usedIds: readonly string[];
  /** Prompt ids seen in earlier sessions — soft exclusion, oldest first. */
  recentIds: readonly string[];
  rng: Rng;
  /**
   * Last resort: reuse prompts from earlier in this same session when the
   * room is small enough that there is nothing else left. A long game in a
   * narrow room should still deal a full round rather than a half-empty one.
   */
  recycle?: boolean;
  /** How many of the most recently used ids stay off-limits when recycling. */
  recycleGuard?: number;
}

/**
 * Picks `count` prompts.
 *
 * Priority order:
 *  1. never repeat inside the current session,
 *  2. avoid anything in the cross-session recency window,
 *  3. if that leaves too few, release the *oldest* recent ids until it does.
 *
 * The pool is shuffled rather than sorted so two sessions with the same
 * settings do not deal the same cards in the same order.
 */
export function selectPrompts(input: SelectionInput, prompts: Prompt[] = ALL_PROMPTS): Prompt[] {
  const pool = filterPrompts(input, prompts);
  const used = new Set(input.usedIds);
  const eligible = pool.filter((p) => !used.has(p.id));

  const recentRank = new Map<string, number>();
  input.recentIds.forEach((id, i) => recentRank.set(id, i));

  const fresh = shuffle(
    eligible.filter((p) => !recentRank.has(p.id)),
    input.rng
  );
  // Oldest memories are released first: lower index in `recentIds` == older.
  const stale = eligible
    .filter((p) => recentRank.has(p.id))
    .sort((a, b) => (recentRank.get(a.id) ?? 0) - (recentRank.get(b.id) ?? 0));

  const chosen = [...fresh, ...stale].slice(0, input.count);
  if (chosen.length >= input.count || !input.recycle) return chosen;

  const usedOrder = new Map<string, number>();
  input.usedIds.forEach((id, i) => usedOrder.set(id, i));
  const guard = input.recycleGuard ?? 0;
  const cutoff = input.usedIds.length - guard;

  const recyclable = pool
    .filter((p) => {
      const at = usedOrder.get(p.id);
      return at !== undefined && at < cutoff;
    })
    .sort((a, b) => (usedOrder.get(a.id) ?? 0) - (usedOrder.get(b.id) ?? 0));

  return [...chosen, ...recyclable].slice(0, input.count);
}

/** Appends ids to the per-mini-game recency window, trimming the oldest. */
export function rememberPrompts(
  recent: Record<string, string[]>,
  game: MiniGameId,
  ids: readonly string[]
): Record<string, string[]> {
  const current = recent[game] ?? [];
  const merged = [...current.filter((id) => !ids.includes(id)), ...ids];
  return {
    ...recent,
    [game]: merged.slice(Math.max(0, merged.length - RECENT_MEMORY_PER_GAME)),
  };
}
