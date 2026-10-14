/**
 * The union both game modes share at the edges — persistence, the wallet,
 * AppProvider, and the play-screen router all need to handle "whichever
 * game is saved/in progress" without caring which one. The engines
 * themselves (`./charades`, `./modifiedCharades`) never import this file —
 * only code that genuinely dispatches on `mode` does.
 */

import type { CharadesState as ClassicCharadesState } from './charades';
import { isCharadesComplete as isClassicCharadesComplete } from './charades';
import type { ModifiedCharadesState } from './modifiedCharades';
import { isModifiedCharadesComplete } from './modifiedCharades';

export type GameMode = 'classic' | 'modified';
export const GAME_MODES: readonly GameMode[] = ['classic', 'modified'];

export type { ClassicCharadesState };
export type { ModifiedCharadesState };

export type CharadesState = ClassicCharadesState | ModifiedCharadesState;

/** Dispatches to whichever engine's own completion check matches `state.mode`. */
export function isCharadesComplete(state: CharadesState): boolean {
  return state.mode === 'classic' ? isClassicCharadesComplete(state) : isModifiedCharadesComplete(state);
}

/**
 * The gate that stops one player's game from being resumed by another —
 * same rule for either mode, since both state shapes carry `playerId`. See
 * the classic engine's own `charadesForPlayer` for the full rationale; this
 * is the version shared/dispatcher code (AppProvider, persistence) uses
 * since it has to handle either mode's state.
 */
export function charadesForPlayer(state: CharadesState | null, playerId: string | null): CharadesState | null {
  if (!state) return null;
  if (state.playerId === null) return state;
  return state.playerId === playerId ? state : null;
}
