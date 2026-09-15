import { Audio } from 'expo-av';

/**
 * Round-timer sound effects: a bell when the timer starts, a tick for each
 * of the last 30 seconds, and a buzzer when it hits zero. Loaded once and
 * replayed from memory (`replayAsync`) rather than reloaded from disk on
 * every tick, since the countdown fires one of these every second.
 */
export type SoundName = 'bell' | 'tick' | 'buzzer';

const SOURCES: Record<SoundName, number> = {
  bell: require('../../assets/sounds/bell.wav'),
  tick: require('../../assets/sounds/tick.wav'),
  buzzer: require('../../assets/sounds/buzzer.wav'),
};

const loaded = new Map<SoundName, Audio.Sound>();
let loadPromise: Promise<void> | null = null;

function loadAll(): Promise<void> {
  if (!loadPromise) {
    loadPromise = Promise.all(
      (Object.keys(SOURCES) as SoundName[]).map(async (name) => {
        const { sound } = await Audio.Sound.createAsync(SOURCES[name]);
        loaded.set(name, sound);
      })
    ).then(() => undefined);
  }
  return loadPromise;
}

/** Call ahead of time (e.g. when the play screen mounts) so the first `playSound` has no load latency. */
export function preloadSounds(): void {
  loadAll().catch(() => undefined);
}

/**
 * Never throws and never awaited by callers for its result — a sound
 * effect failing (autoplay policy, a muted device, an unsupported codec)
 * is not a reason to interrupt a round in progress.
 */
export async function playSound(name: SoundName): Promise<void> {
  try {
    await loadAll();
    const sound = loaded.get(name);
    if (!sound) return;
    await sound.replayAsync();
  } catch {
    // See above — playback failures are silently ignored on purpose.
  }
}
