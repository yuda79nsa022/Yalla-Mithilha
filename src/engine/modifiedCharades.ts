/**
 * The modified game: silent charades with difficulty-tiered scoring. A team
 * names their two sides, picks which decks to play, pays for a session, and
 * the server deals three stacks of titles — one per difficulty level — at
 * random across those decks combined, never a title the player picks
 * individually. Each round the acting team picks a level: easy, medium or
 * hard, worth more the harder it is, so a team that is behind can gamble on
 * hard titles to catch up while a team in front can coast on easy ones. The
 * top title of that stack is theirs; one player privately reads it, acts it
 * out with no words or sounds, their team guesses, then the phone moves to
 * "show answer" (re-confirming the same title) to award the round before
 * the next team picks. Unlike a trivia question, there is no separate
 * written prompt/answer pair — the title itself is both.
 *
 * Scoring, all in one place so the screens never invent a number:
 * - a guessed title scores its level's points (`DIFFICULTY_POINTS`) —
 *   easy 2, medium 3, hard 5 — however fast it was guessed (speed only
 *   counts in the classic game);
 * - a title not guessed in time scores nothing for anyone;
 * - each team has one of each assist (`ASSIST_KINDS`) per game, free to use.
 *
 * Kept entirely separate from `src/engine/charades.ts` (the classic game)
 * rather than unified into one state shape — the two rule sets share
 * nothing but team names/scores/lock, and a player picks one or the other
 * per game (see `src/engine/game.ts` for the union both screens dispatch
 * on).
 */

import type { GameEndReason } from './rules';

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Points for a guessed title at each level — the spread is deliberately wide so hard picks can overturn a lead. */
export const DIFFICULTY_POINTS: Record<Difficulty, number> = { easy: 2, medium: 3, hard: 5 };

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

export interface ModifiedCharadesState {
  mode: 'modified';
  /** Client-generated, becomes the server's game_sessions row id — the idempotency key for "start game". */
  id: string;
  teamAName: string;
  teamBName: string;
  /** Empty until `unlockModifiedCharades` deals them from the server. Titles leave a stack as they are picked (`pickDifficulty`). */
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
   * whoever signs in at checkout) may pick it up. `unlockModifiedCharades`
   * always stamps a real player id here, since spending a wallet credit
   * always requires being signed in — see `charadesForPlayer` (shared with
   * the classic engine, in `src/engine/charades.ts`).
   */
  playerId: string | null;
  /** Chosen when drafting, alongside the team names — which decks `unlockModifiedCharades` deals from. */
  deckIds: string[];
  /** Which assists each team has already spent this game — one of each per team. */
  assistsUsed: [AssistKind[], AssistKind[]];
  /** Set when the game was ended early (see `endedReason` in `./game`); absent while it is still being played. */
  endedReason?: GameEndReason;
  /** Epoch ms of the last tap on the play screen — how a reopened game knows it sat idle past the limit. */
  lastActivityAt?: number;
}

export function makeModifiedCharadesId(): string {
  return `charades-modified-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const emptyStacks = (): CharadesStacks => ({ easy: [], medium: [], hard: [] });

export function draftModifiedCharades(
  teamAName: string,
  teamBName: string,
  id: string = makeModifiedCharadesId(),
  playerId: string | null = null,
  deckIds: string[] = []
): ModifiedCharadesState {
  return {
    mode: 'modified',
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

export function unlockModifiedCharades(
  state: ModifiedCharadesState,
  deal: CharadesDeal,
  playerId: string
): ModifiedCharadesState {
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

/** Which team is up for the current round — strictly alternating, A first. */
export function currentTeamIndex(state: ModifiedCharadesState): 0 | 1 {
  return (state.index % 2) as 0 | 1;
}

/** How many titles each level still has to offer. */
export function stackSizes(state: ModifiedCharadesState): Record<Difficulty, number> {
  return { easy: state.stacks.easy.length, medium: state.stacks.medium.length, hard: state.stacks.hard.length };
}

/** A level can be picked while its stack has a title left and no title is already in play. */
export function canPickDifficulty(state: ModifiedCharadesState, difficulty: Difficulty): boolean {
  return state.lock === 'unlocked' && state.current === null && state.stacks[difficulty].length > 0;
}

/**
 * The acting team's choice for this round: takes the top title off that
 * level's stack and makes it the round's title. Returns the same state when
 * the pick isn't allowed (empty stack, or a title already in play), so a
 * double tap can't skip a title.
 */
export function pickDifficulty(state: ModifiedCharadesState, difficulty: Difficulty): ModifiedCharadesState {
  if (!canPickDifficulty(state, difficulty)) return state;
  const [current, ...rest] = state.stacks[difficulty];
  return { ...state, current, stacks: { ...state.stacks, [difficulty]: rest } };
}

/** Points on offer for guessing a title — its level's points, the same in every round. */
export function pointsForGuess(difficulty: Difficulty): number {
  return DIFFICULTY_POINTS[difficulty];
}

/** Resolves the round in play: `team` guessed it for `points`. Clears the title in play and moves to the next round. */
export function awardRound(state: ModifiedCharadesState, team: 0 | 1, points: number = 1): ModifiedCharadesState {
  const scores: [number, number] = [...state.scores];
  scores[team] += points;
  return { ...state, scores, index: state.index + 1, current: null };
}

/** Resolves the round in play with nobody scoring. */
export function skipRound(state: ModifiedCharadesState): ModifiedCharadesState {
  return { ...state, index: state.index + 1, current: null };
}

export function assistAvailable(state: ModifiedCharadesState, team: 0 | 1, kind: AssistKind): boolean {
  return !state.assistsUsed[team].includes(kind);
}

/** Spends one of a team's assists. Returns the same state when that team has already used it this game. */
export function consumeAssist(state: ModifiedCharadesState, team: 0 | 1, kind: AssistKind): ModifiedCharadesState {
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
export function adjustScore(state: ModifiedCharadesState, team: 0 | 1, delta: number): ModifiedCharadesState {
  const scores: [number, number] = [...state.scores];
  scores[team] = Math.max(0, scores[team] + delta);
  return { ...state, scores };
}

/** Over once every round is played, or sooner if every stack has run dry — never while a title is still in play, unless the game was ended early. */
export function isModifiedCharadesComplete(state: ModifiedCharadesState): boolean {
  if (state.lock !== 'unlocked') return false;
  if (state.endedReason) return true;
  if (state.current !== null) return false;
  const sizes = stackSizes(state);
  return state.index >= state.rounds || sizes.easy + sizes.medium + sizes.hard === 0;
}
