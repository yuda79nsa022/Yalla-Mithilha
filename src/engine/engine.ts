import { ALL_PROMPTS } from '../content';
import { MAX_SUDDEN_DEATH_TURNS, MINI_GAMES, STATE_VERSION } from './config';
import { createRng, randomSeed, type Rng } from './rng';
import {
  buildGameOrder,
  buildTeams,
  nextPerformer,
  roundCountFor,
  teamForRound,
  DEFAULT_ROTATABLE,
} from './rotation';
import { availableMiniGames, selectPrompts } from './selector';
import { applyRound, emptyScores, isTied, leaders, roundPoints } from './scoring';
import type {
  ContentLevel,
  GameMode,
  Lang,
  MiniGameId,
  Player,
  Prompt,
  RoomId,
  RoundPlan,
  RoundResult,
  SessionLength,
  SessionSetup,
  SessionState,
  Team,
} from './types';

export interface CreateSessionInput {
  lang: Lang;
  room: RoomId;
  mode: GameMode;
  length: SessionLength;
  level: ContentLevel;
  players: Player[];
  /** Cross-session recency window, keyed by mini-game id. */
  recentIds?: Record<string, string[]>;
  packs?: string[];
  motionEnabled?: boolean;
  seed?: number;
  prompts?: Prompt[];
  now?: number;
}

export class NotEnoughContentError extends Error {
  constructor(public readonly room: RoomId, public readonly level: ContentLevel) {
    super(`No mini-game has enough content for room "${room}" at level "${level}"`);
    this.name = 'NotEnoughContentError';
  }
}

/**
 * Reserves the cards for one round.
 *
 * `usedIds` is mutated as the plan is built so a session never deals the same
 * prompt twice, even across different mini-games sharing a pool.
 */
function reserveCards(
  game: MiniGameId,
  setup: Pick<SessionSetup, 'room' | 'level'>,
  usedIds: string[],
  recentIds: Record<string, string[]>,
  rng: Rng,
  prompts: Prompt[],
  packs?: string[]
): string[] {
  const config = MINI_GAMES[game];
  const picked = selectPrompts(
    {
      game,
      room: setup.room,
      level: setup.level,
      packs,
      count: config.cardsPerRound,
      usedIds,
      recentIds: recentIds[game] ?? [],
      rng,
      recycle: true,
      // Nothing from roughly the last two rounds may come back.
      recycleGuard: config.cardsPerRound * 2,
    },
    prompts
  );
  const ids = picked.map((p) => p.id);
  usedIds.push(...ids);
  return ids;
}

export function createSession(input: CreateSessionInput): SessionState {
  const seed = input.seed ?? randomSeed();
  const rng = createRng(seed);
  const prompts = input.prompts ?? ALL_PROMPTS;
  const recentIds = input.recentIds ?? {};
  const now = input.now ?? Date.now();

  const teams = buildTeams(input.players, input.mode, rng);

  const eligible = availableMiniGames(
    input.room,
    input.level,
    DEFAULT_ROTATABLE,
    prompts,
    input.packs
  );
  if (!eligible.length) throw new NotEnoughContentError(input.room, input.level);

  const bodyRounds = roundCountFor(input.length, teams.length, eligible);
  const order = buildGameOrder(eligible, bodyRounds, rng);

  const setup: SessionSetup = {
    lang: input.lang,
    room: input.room,
    mode: input.mode,
    length: input.length,
    level: input.level,
    players: input.players,
    teams,
    seed,
    motionEnabled: input.motionEnabled ?? true,
  };

  const usedIds: string[] = [];
  const plan: RoundPlan[] = [];
  const cursors = teams.map((t) => ({ ...t }));

  order.forEach((game, index) => {
    const team = teamForRound(cursors, index);
    const { performerId, team: advanced } = nextPerformer(team);
    cursors[index % cursors.length] = advanced;
    plan.push({
      index,
      game,
      teamId: team.id,
      performerId,
      promptIds: reserveCards(game, setup, usedIds, recentIds, rng, prompts, input.packs),
      isFinal: false,
    });
  });

  // One final challenge per team, so the last thing every group does is the
  // loudest thing they do.
  const hasFinalContent =
    availableMiniGames(input.room, input.level, ['final'], prompts, input.packs).length > 0;
  if (hasFinalContent) {
    cursors.forEach((team, i) => {
      const { performerId, team: advanced } = nextPerformer(team);
      cursors[i] = advanced;
      plan.push({
        index: plan.length,
        game: 'final',
        teamId: team.id,
        performerId,
        promptIds: reserveCards('final', setup, usedIds, recentIds, rng, prompts, input.packs),
        isFinal: true,
      });
    });
  }

  return {
    setup,
    plan,
    currentRound: 0,
    phase: MINI_GAMES[plan[0].game].secret ? 'pass' : 'brief',
    results: [],
    scores: emptyScores(teams),
    usedPromptIds: usedIds,
    startedAt: now,
    updatedAt: now,
    version: STATE_VERSION,
  };
}

export function currentPlan(state: SessionState): RoundPlan | undefined {
  return state.plan[state.currentRound];
}

export function roundPrompts(state: SessionState, prompts: Prompt[] = ALL_PROMPTS): Prompt[] {
  const plan = currentPlan(state);
  if (!plan) return [];
  const byId = new Map(prompts.map((p) => [p.id, p]));
  return plan.promptIds.map((id) => byId.get(id)).filter((p): p is Prompt => Boolean(p));
}

export function performerName(state: SessionState, playerId: string): string {
  return state.setup.players.find((p) => p.id === playerId)?.name ?? '';
}

export function teamById(state: SessionState, teamId: string): Team | undefined {
  return state.setup.teams.find((t) => t.id === teamId);
}

export function beginRound(state: SessionState, now = Date.now()): SessionState {
  return { ...state, phase: 'playing', updatedAt: now };
}

export function showBrief(state: SessionState, now = Date.now()): SessionState {
  return { ...state, phase: 'brief', updatedAt: now };
}

/** Records a completed round and moves to the round-result screen. */
export function completeRound(
  state: SessionState,
  result: Omit<RoundResult, 'points'>,
  now = Date.now()
): SessionState {
  const full: RoundResult = { ...result, points: roundPoints(result.cards) };
  return {
    ...state,
    phase: 'roundResult',
    results: [...state.results, full],
    scores: applyRound(state.scores, full),
    updatedAt: now,
  };
}

/**
 * Moves past the result screen. Ends the session at the end of the plan, or
 * appends a sudden-death round if the game would otherwise end level.
 */
export function advance(
  state: SessionState,
  options: { prompts?: Prompt[] } = {},
  now = Date.now()
): SessionState {
  const nextIndex = state.currentRound + 1;
  const prompts = options.prompts ?? ALL_PROMPTS;

  if (nextIndex < state.plan.length) {
    const plan = state.plan[nextIndex];
    return {
      ...state,
      currentRound: nextIndex,
      phase: MINI_GAMES[plan.game].secret ? 'pass' : 'brief',
      updatedAt: now,
    };
  }

  if (isTied(state)) {
    const extended = addSuddenDeathRound(state, prompts, now);
    if (extended) return extended;
  }

  return { ...state, phase: 'finished', updatedAt: now };
}

/**
 * Appends one extra round for each tied team. Returns `null` when there is no
 * unused content left, in which case the game ends as a shared win.
 */
export function addSuddenDeathRound(
  state: SessionState,
  prompts: Prompt[] = ALL_PROMPTS,
  now = Date.now()
): SessionState | null {
  const tied = leaders(state.scores, state.setup.teams);
  if (tied.length < 2) return null;

  const alreadyPlayed = state.plan.filter((r) => r.isSuddenDeath).length;
  if (alreadyPlayed >= MAX_SUDDEN_DEATH_TURNS * tied.length) return null;

  const rng = createRng(state.setup.seed + state.plan.length * 7919);
  const usedIds = [...state.usedPromptIds];
  const extra: RoundPlan[] = [];

  for (const teamId of tied) {
    const team = teamById(state, teamId);
    if (!team) continue;
    const { performerId } = nextPerformer(team);
    const ids = reserveCards('act', state.setup, usedIds, {}, rng, prompts, undefined);
    if (!ids.length) return null;
    extra.push({
      index: state.plan.length + extra.length,
      game: 'act',
      teamId,
      performerId,
      promptIds: ids,
      isFinal: false,
      isSuddenDeath: true,
    });
  }

  if (!extra.length) return null;

  return {
    ...state,
    plan: [...state.plan, ...extra],
    usedPromptIds: usedIds,
    currentRound: state.plan.length,
    phase: 'pass',
    updatedAt: now,
  };
}

export function showScoreboard(state: SessionState, now = Date.now()): SessionState {
  return { ...state, phase: 'scoreboard', updatedAt: now };
}

export function progress(state: SessionState): { round: number; total: number } {
  return { round: Math.min(state.currentRound + 1, state.plan.length), total: state.plan.length };
}

export function isFinished(state: SessionState): boolean {
  return state.phase === 'finished';
}

/** Ids consumed by a session, for the cross-session recency window. */
export function sessionPromptIdsByGame(state: SessionState): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const plan of state.plan) {
    (out[plan.game] ??= []).push(...plan.promptIds);
  }
  return out;
}

/** A rematch keeps the same people and settings but deals a brand new plan. */
export function rematch(
  state: SessionState,
  recentIds: Record<string, string[]>,
  prompts: Prompt[] = ALL_PROMPTS,
  now = Date.now()
): SessionState {
  return createSession({
    lang: state.setup.lang,
    room: state.setup.room,
    mode: state.setup.mode,
    length: state.setup.length,
    level: state.setup.level,
    players: state.setup.players,
    motionEnabled: state.setup.motionEnabled,
    recentIds,
    prompts,
    now,
  });
}
