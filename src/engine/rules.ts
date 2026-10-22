/**
 * Timing rules both game modes share. Kept in their own file (rather than in
 * `./game`) because the engines themselves import these, and `./game`
 * imports the engines.
 */

/** Each move — one team's acting round — gets 2 minutes on the clock. */
export const ROUND_SECONDS = 120;

/**
 * Outside the acting clock (handoff, picking a level, scoring a round, the
 * round recap), a game nobody touches for this long is over: the allowed
 * time per move is the same 2 minutes, so a table that has walked away
 * doesn't leave a paid game hanging open forever.
 */
export const INACTIVITY_LIMIT_SECONDS = 120;

/** Why a game ended before its last round — absent on a game that ran its full course. */
export type GameEndReason = 'inactivity';
