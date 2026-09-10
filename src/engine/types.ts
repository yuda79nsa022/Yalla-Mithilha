/**
 * Core domain types for Yalla Mithilha.
 *
 * Everything in `src/engine` and `src/i18n` is intentionally free of React
 * Native imports so it can be unit-tested in plain Node.
 */

export type Lang = 'ar' | 'en';

/**
 * Which deck-language pool a game deals from — chosen by the player at
 * checkout, entirely separate from `Lang` (the app's own UI language).
 * `'mixed'` deals from every playable deck regardless of content language.
 */
export type DeckLang = Lang | 'mixed';
