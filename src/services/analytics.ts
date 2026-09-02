import type { ContentLevel, MiniGameId, RoomId, SessionLength } from '../engine/types';

/**
 * Analytics contract, deliberately unwired.
 *
 * The MVP sends nothing: there is no network call and no device identifier.
 * This module exists so the event vocabulary is decided once, in code, before
 * anybody is tempted to add a tracker in a hurry.
 *
 * Rules baked into the types below:
 *  - no player names,
 *  - no custom prompt text,
 *  - prompt ids only (they identify a card we wrote, not a person),
 *  - no free-text fields at all.
 */
export type AnalyticsEvent =
  | {
      name: 'game_started';
      room: RoomId;
      length: SessionLength;
      level: ContentLevel;
      players: number;
      mode: 'teams' | 'ffa';
    }
  | { name: 'game_completed'; rounds: number; durationSeconds: number }
  | { name: 'game_abandoned'; roundsPlayed: number }
  | { name: 'room_selected'; room: RoomId }
  | { name: 'minigame_completed'; game: MiniGameId; correct: number; skipped: number }
  | { name: 'prompt_skipped'; promptId: string; game: MiniGameId }
  | { name: 'prompt_reported'; promptId: string; reason: string }
  | { name: 'rematch_selected' }
  | { name: 'language_changed'; lang: 'ar' | 'en' }
  | { name: 'board_drafted'; categoryIds: string[] }
  | { name: 'board_unlocked' }
  | { name: 'board_credits_granted'; count: number }
  | { name: 'board_completed'; winnerTeamId: string | null };

export interface AnalyticsSink {
  track(event: AnalyticsEvent): void;
}

/** The only sink in the MVP. Swap it once a consent flow exists. */
export const noopSink: AnalyticsSink = { track: () => undefined };

let sink: AnalyticsSink = noopSink;

export function setAnalyticsSink(next: AnalyticsSink): void {
  sink = next;
}

export function track(event: AnalyticsEvent): void {
  sink.track(event);
}
