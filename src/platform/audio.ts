/**
 * Sound effects.
 *
 * The MVP ships no audio files: everything the brief asks for (countdown,
 * correct, skip, end of round, celebration) needs original or licensed assets,
 * and shipping placeholder beeps would be worse than silence in a room full of
 * people. This module is the seam where they land — drop files into
 * `assets/sounds/`, fill in `SOUND_FILES`, and nothing else changes.
 *
 * See `docs/ASSUMPTIONS.md` for the asset list a sound designer needs to
 * deliver.
 */

export type SoundName = 'countdown' | 'correct' | 'skip' | 'roundEnd' | 'celebrate';

/** Populate with `require('../../assets/sounds/correct.m4a')` when assets land. */
export const SOUND_FILES: Partial<Record<SoundName, number>> = {};

let enabled = true;

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/**
 * No-op until assets exist. Kept async so the call sites never need changing.
 */
export async function play(_name: SoundName): Promise<void> {
  if (!enabled) return;
  // Intentionally silent in the MVP.
}

export async function unloadAll(): Promise<void> {
  // Nothing loaded yet.
}
