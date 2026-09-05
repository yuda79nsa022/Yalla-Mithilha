/**
 * Analytics contract, deliberately unwired.
 *
 * The MVP sends nothing: there is no network call and no device identifier.
 * This module exists so the event vocabulary is decided once, in code, before
 * anybody is tempted to add a tracker in a hurry.
 *
 * Rules baked into the types below: no player names, no free-text fields.
 */
export type AnalyticsEvent =
  | { name: 'language_changed'; lang: 'ar' | 'en' }
  | { name: 'charades_drafted'; deckId: string }
  | { name: 'charades_unlocked'; deckId: string }
  | { name: 'charades_completed'; winner: 'A' | 'B' | 'tie' }
  | { name: 'wallet_topped_up'; balance: number }
  | { name: 'player_account_created' }
  | { name: 'player_logged_in' }
  | { name: 'player_logout' };

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
