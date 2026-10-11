/**
 * The paid game: silent charades. A team names their two sides, picks which
 * decks to play, pays for a session, and the server deals three stacks of
 * titles — one per difficulty level — at random across those decks
 * combined, never a title the player picks individually. Each round the
 * acting team picks a level: easy, medium or hard, worth more the harder it
 * is, so a team that is behind can gamble on hard titles to catch up while
 * a team in front can coast on easy ones. The top title of that stack is
 * theirs; one player privately reads it, acts it out with no words or
 * sounds, their team guesses, then the phone moves to "show answer"
 * (re-confirming the same title) to award the round before the next team
 * picks. Unlike a trivia question, there is no separate written
 * prompt/answer pair — the title itself is both.
 *
 * Scoring, all in one place so the screens never invent a number:
 * - a guessed title scores its level's points (`DIFFICULTY_POINTS`), plus
 *   `SPEED_BONUS_POINTS` when guessed within the first
 *   `SPEED_BONUS_WINDOW_SECONDS` of the round;
 * - each team's final round counts double (`isDoubleRound`);
 * - when the timer runs out, the other team may steal with one guess for
 *   `STEAL_POINTS`;
 * - each team has one of each assist (`ASSIST_KINDS`) per game, free to use.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Points for a guessed title at each level — the spread is deliberately wide so hard picks can overturn a lead. */
export const DIFFICULTY_POINTS: Record<Difficulty, number> = { easy: 1, medium: 3, hard: 5 };
/** Extra point for a guess inside the first minute — keeps the time pressure the game always had. */
export const SPEED_BONUS_POINTS = 1;
export const SPEED_BONUS_WINDOW_SECONDS = 60;
/** What the other team earns by guessing the title once the acting team's time has run out. */
export const STEAL_POINTS = 1;

export type AssistKind = 'firstLetters' | 'lastLetters' | 'extraTime';
export const ASSIST_KINDS: readonly AssistKind[] = ['firstLetters', 'lastLetters', 'extraTime'];
/** How much the "extra time" assist adds to the round clock. */
export const ASSIST_EXTRA_SECONDS = 30;

export interface CharadesTitle {
  id: string;
  text: string;
  deckNameAr: string;
  deckNameEn: string;
  /** A path relative to CATALOGUE_API_URL (e.g. `/title-images/<uuid>.png`) — absent when this title has no picture. */
  imageUrl?: string;
  /** The level this title was dealt into — fixed by the server, so the points it is worth are never a client-side guess. */
  difficulty: Difficulty;
}

/** One stack per level, top first; a stack a chosen set of decks has nothing for is simply empty, and that level is greyed out. */
export type CharadesStacks = Record<Difficulty, CharadesTitle[]>;

/** What the server deals for one paid session. */
export interface CharadesDeal {
  /** How many rounds the game lasts — fewer only when the chosen decks held fewer titles than that in total. */
  rounds: number;
  stacks: CharadesStacks;
}

export type CharadesLock = 'locked' | 'unlocked';

export interface CharadesState {
  /** Client-generated, becomes the server's game_sessions row id — the idempotency key for "start game". */
  id: string;
  teamAName: string;
  teamBName: string;
  /** Empty until `unlockCharades` deals them from the server. Titles leave a stack as they are picked (`pickDifficulty`). */
  stacks: CharadesStacks;
  /** Total rounds in the game; 0 until dealt. */
  rounds: number;
  /** How many rounds have been resolved, 0-based — so also which round is next. */
  index: number;
  /** The title the acting team took off a stack for the round in progress — `null` between rounds, while the level is still being chosen. */
  current: CharadesTitle | null;
  scores: [number, number];
  /** `locked` = drafted (team names chosen) but not yet paid; `unlocked` = paid, titles dealt. */
  lock: CharadesLock;
  /**
   * Who this game belongs to. `null` while it's an unclaimed guest draft —
   * team names only, nothing spent yet, so anyone on this device (including
   * whoever signs in at checkout) may pick it up. `unlockCharades` always
   * stamps a real player id here, since spending a wallet credit always
   * requires being signed in — see `charadesForPlayer`.
   */
  playerId: string | null;
  /** Chosen when drafting, alongside the team names — which decks `unlockCharades` deals from. */
  deckIds: string[];
  /** Which assists each team has already spent this game — one of each per team. */
  assistsUsed: [AssistKind[], AssistKind[]];
}

export function makeCharadesId(): string {
  return `charades-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const emptyStacks = (): CharadesStacks => ({ easy: [], medium: [], hard: [] });

export function draftCharades(
  teamAName: string,
  teamBName: string,
  id: string = makeCharadesId(),
  playerId: string | null = null,
  deckIds: string[] = []
): CharadesState {
  return {
    id,
    teamAName,
    teamBName,
    stacks: emptyStacks(),
    rounds: 0,
    index: 0,
    current: null,
    scores: [0, 0],
    lock: 'locked',
    playerId,
    deckIds,
    assistsUsed: [[], []],
  };
}

export function unlockCharades(state: CharadesState, deal: CharadesDeal, playerId: string): CharadesState {
  return {
    ...state,
    stacks: { easy: [...deal.stacks.easy], medium: [...deal.stacks.medium], hard: [...deal.stacks.hard] },
    rounds: deal.rounds,
    index: 0,
    current: null,
    lock: 'unlocked',
    playerId,
  };
}

/**
 * The gate that stops one player's game from being resumed by another.
 * A still-`locked` draft with no player attached yet (`playerId: null`) is
 * fair game for anyone on the device — that's the guest-drafts-then-signs-
 * in-at-checkout flow the app is built around. Anything else — a draft
 * already tied to a specific signed-in player, or any `unlocked` game,
 * which always has a real payer — only that same player may resume.
 * Returns `null` rather than the mismatched state so callers can treat it
 * exactly like "no saved game".
 */
export function charadesForPlayer(
  state: CharadesState | null,
  playerId: string | null
): CharadesState | null {
  if (!state) return null;
  if (state.playerId === null) return state;
  return state.playerId === playerId ? state : null;
}

/** Which team is up for the current round — strictly alternating, A first. */
export function currentTeamIndex(state: CharadesState): 0 | 1 {
  return (state.index % 2) as 0 | 1;
}

/** How many titles each level still has to offer. */
export function stackSizes(state: CharadesState): Record<Difficulty, number> {
  return { easy: state.stacks.easy.length, medium: state.stacks.medium.length, hard: state.stacks.hard.length };
}

/** A level can be picked while its stack has a title left and no title is already in play. */
export function canPickDifficulty(state: CharadesState, difficulty: Difficulty): boolean {
  return state.lock === 'unlocked' && state.current === null && state.stacks[difficulty].length > 0;
}

/**
 * The acting team's choice for this round: takes the top title off that
 * level's stack and makes it the round's title. Returns the same state when
 * the pick isn't allowed (empty stack, or a title already in play), so a
 * double tap can't skip a title.
 */
export function pickDifficulty(state: CharadesState, difficulty: Difficulty): CharadesState {
  if (!canPickDifficulty(state, difficulty)) return state;
  const [current, ...rest] = state.stacks[difficulty];
  return { ...state, current, stacks: { ...state.stacks, [difficulty]: rest } };
}

/**
 * Each team's final round counts double: the last two rounds of the game
 * are one per team, since turns strictly alternate. Announced before the
 * level is picked, so a 10-point hard pick is a deliberate gamble.
 */
export function isDoubleRound(state: CharadesState): boolean {
  return state.rounds >= 2 && state.index >= state.rounds - 2;
}

export function roundMultiplier(state: CharadesState): number {
  return isDoubleRound(state) ? 2 : 1;
}

/** Points on offer for guessing the title in play — base for the level, plus the speed bonus while it still applies, doubled on a double round. */
export function pointsForGuess(state: CharadesState, difficulty: Difficulty, elapsedSeconds: number): number {
  const base = DIFFICULTY_POINTS[difficulty] + (elapsedSeconds <= SPEED_BONUS_WINDOW_SECONDS ? SPEED_BONUS_POINTS : 0);
  return base * roundMultiplier(state);
}

/** Resolves the round in play: `team` guessed it for `points`. Clears the title in play and moves to the next round. */
export function awardRound(state: CharadesState, team: 0 | 1, points: number = 1): CharadesState {
  const scores: [number, number] = [...state.scores];
  scores[team] += points;
  return { ...state, scores, index: state.index + 1, current: null };
}

/** Resolves the round in play with nobody scoring. */
export function skipRound(state: CharadesState): CharadesState {
  return { ...state, index: state.index + 1, current: null };
}

/**
 * Time ran out and the *other* team guessed it: they take `STEAL_POINTS`,
 * the acting team nothing, and the round is over. Never doubled — a steal
 * is a consolation, not a gamble.
 */
export function stealRound(state: CharadesState): CharadesState {
  const stealer = currentTeamIndex(state) === 0 ? 1 : 0;
  return awardRound(state, stealer, STEAL_POINTS);
}

export function assistAvailable(state: CharadesState, team: 0 | 1, kind: AssistKind): boolean {
  return !state.assistsUsed[team].includes(kind);
}

/** Spends one of a team's assists. Returns the same state when that team has already used it this game. */
export function consumeAssist(state: CharadesState, team: 0 | 1, kind: AssistKind): CharadesState {
  if (!assistAvailable(state, team, kind)) return state;
  const assistsUsed: [AssistKind[], AssistKind[]] = [[...state.assistsUsed[0]], [...state.assistsUsed[1]]];
  assistsUsed[team].push(kind);
  return { ...state, assistsUsed };
}

/**
 * The "first letters" / "last letters" assist text: every word keeps the
 * one letter the assist reveals and hides the rest behind underscores, so
 * "بيت الحمولة" becomes "ب__ ا______" or "__ت _____ة". Shown on the shared
 * screen for the guessing team — the actor already knows the title.
 */
export function revealLetters(text: string, which: 'first' | 'last'): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const chars = Array.from(word);
      if (chars.length <= 1) return word;
      const keep = which === 'first' ? 0 : chars.length - 1;
      return chars.map((c, i) => (i === keep ? c : '_')).join('');
    })
    .join('  ');
}

/**
 * A manual scoreboard correction, separate from `awardRound` — doesn't
 * advance the round, and never lets a score go negative.
 */
export function adjustScore(state: CharadesState, team: 0 | 1, delta: number): CharadesState {
  const scores: [number, number] = [...state.scores];
  scores[team] = Math.max(0, scores[team] + delta);
  return { ...state, scores };
}

/** Over once every round is played, or sooner if every stack has run dry — never while a title is still in play. */
export function isCharadesComplete(state: CharadesState): boolean {
  if (state.lock !== 'unlocked' || state.current !== null) return false;
  const sizes = stackSizes(state);
  return state.index >= state.rounds || sizes.easy + sizes.medium + sizes.hard === 0;
}

/**
 * Brings a saved game from before levels existed (a flat `titles` list
 * and an `index` into it) onto this shape, so a game that was mid-way
 * through the upgrade still resumes: the titles not yet played become one
 * medium stack, and nothing else changes. Anything already in the new
 * shape is returned as-is; anything unrecognisable is `null`.
 */
export function migrateCharades(raw: unknown): CharadesState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  if (r.stacks && typeof r.stacks === 'object') return raw as CharadesState;
  const titles = Array.isArray(r.titles) ? (r.titles as Omit<CharadesTitle, 'difficulty'>[]) : [];
  const index = typeof r.index === 'number' ? r.index : 0;
  const { titles: _titles, ...rest } = r;
  return {
    ...(rest as Omit<CharadesState, 'stacks' | 'rounds' | 'current' | 'assistsUsed'>),
    stacks: { easy: [], medium: titles.slice(index).map((t) => ({ ...t, difficulty: 'medium' as const })), hard: [] },
    rounds: titles.length,
    index,
    current: null,
    assistsUsed: [[], []],
  };
}
