import { ALL_PROMPTS } from '../src/content';
import { MINI_GAMES } from '../src/engine/config';
import {
  NotEnoughContentError,
  advance,
  beginRound,
  completeRound,
  createSession,
  currentPlan,
  isFinished,
  progress,
  rematch,
  roundPrompts,
  sessionPromptIdsByGame,
} from '../src/engine/engine';
import {
  MemoryStore,
  clearSession,
  loadPreferences,
  loadSession,
  resetAllLocalData,
  saveSession,
  savePreferences,
  DEFAULT_PREFERENCES,
  addReport,
  loadReports,
} from '../src/engine/persistence';
import { scoreCard, standings } from '../src/engine/scoring';
import { rememberPrompts } from '../src/engine/selector';
import type { CardResult, Player, SessionState } from '../src/engine/types';

const players: Player[] = [
  { id: 'p1', name: 'Ahmad' },
  { id: 'p2', name: 'Noura' },
  { id: 'p3', name: 'Faisal' },
  { id: 'p4', name: 'Dana' },
];

function newSession(overrides: Partial<Parameters<typeof createSession>[0]> = {}) {
  return createSession({
    lang: 'ar',
    room: 'friends',
    mode: 'teams',
    length: 'standard',
    level: 'family',
    players,
    seed: 20260829,
    ...overrides,
  });
}

/** Plays a whole session, answering `correctRatio` of the cards correctly. */
function playThrough(start: SessionState, correctRatio = 0.6): SessionState {
  let state = start;
  let guard = 0;
  while (!isFinished(state) && guard++ < 200) {
    const plan = currentPlan(state);
    if (!plan) break;
    state = beginRound(state);
    const cards: CardResult[] = roundPrompts(state).map((prompt, i) =>
      scoreCard(
        prompt.id,
        plan.game,
        i / Math.max(1, plan.promptIds.length) < correctRatio ? 'correct' : 'skip',
        plan.isFinal
      )
    );
    state = completeRound(state, {
      roundIndex: plan.index,
      teamId: plan.teamId,
      performerId: plan.performerId,
      game: plan.game,
      cards,
    });
    state = advance(state);
  }
  return state;
}

describe('createSession', () => {
  it('builds a plan with a final challenge for each team', () => {
    const state = newSession();
    expect(state.plan.length).toBeGreaterThan(4);
    const finals = state.plan.filter((r) => r.isFinal);
    expect(finals).toHaveLength(2);
    expect(finals.map((r) => r.teamId).sort()).toEqual(['team-a', 'team-b']);
    // The finals are the last thing that happens.
    expect(state.plan.slice(-2).every((r) => r.isFinal)).toBe(true);
  });

  it('opens on the pass-the-phone screen for secret mini-games', () => {
    const state = newSession();
    const expected = MINI_GAMES[state.plan[0].game].secret ? 'pass' : 'brief';
    expect(state.phase).toBe(expected);
  });

  it('never reserves the same prompt twice when the room has enough cards', () => {
    const state = newSession({ room: 'mixed', length: 'standard' });
    const ids = state.plan.flatMap((r) => r.promptIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('recycles rather than dealing an empty round in a narrow room', () => {
    // `kids` is the smallest deck we ship, played at the longest length.
    const state = newSession({ room: 'kids', level: 'kids', length: 'long' });
    for (const round of state.plan) {
      expect(round.promptIds.length).toBeGreaterThan(0);
    }
    // Even when recycling, no card comes back in back-to-back rounds.
    for (let i = 1; i < state.plan.length; i++) {
      const previous = new Set(state.plan[i - 1].promptIds);
      expect(state.plan[i].promptIds.some((id) => previous.has(id))).toBe(false);
    }
  });

  it('fills every planned round with cards', () => {
    const state = newSession({ length: 'long' });
    for (const round of state.plan) {
      expect(round.promptIds.length).toBeGreaterThan(0);
      expect(round.promptIds.length).toBeLessThanOrEqual(MINI_GAMES[round.game].cardsPerRound);
    }
  });

  it('respects the content level for the whole plan', () => {
    const state = newSession({ level: 'kids', room: 'kids' });
    const byId = new Map(ALL_PROMPTS.map((p) => [p.id, p]));
    for (const round of state.plan) {
      for (const id of round.promptIds) {
        expect(byId.get(id)?.level).toBe('kids');
      }
    }
  });

  it('is reproducible from its seed', () => {
    const a = newSession({ seed: 1234 });
    const b = newSession({ seed: 1234 });
    expect(a.plan).toEqual(b.plan);
  });

  it('avoids prompts seen in a previous session', () => {
    const first = newSession({ room: 'mixed', length: 'quick' });
    const recent = sessionPromptIdsByGame(first);
    const second = createSession({
      lang: 'ar',
      room: 'mixed',
      mode: 'teams',
      length: 'quick',
      level: 'family',
      players,
      seed: 555,
      recentIds: recent,
    });
    const firstIds = new Set(first.plan.flatMap((r) => r.promptIds));
    const secondIds = second.plan.flatMap((r) => r.promptIds);
    const overlap = secondIds.filter((id) => firstIds.has(id));
    expect(overlap).toHaveLength(0);
  });

  it('refuses to start when no mini-game has enough content', () => {
    expect(() => newSession({ prompts: [] })).toThrow(NotEnoughContentError);
  });
});

describe('turn taking', () => {
  it('alternates the teams through the body of the game', () => {
    const state = newSession();
    const body = state.plan.filter((r) => !r.isFinal);
    body.forEach((round, i) => {
      expect(round.teamId).toBe(i % 2 === 0 ? 'team-a' : 'team-b');
    });
  });

  it('rotates performers inside each team', () => {
    const state = newSession({ length: 'long' });
    for (const team of state.setup.teams) {
      const performers = state.plan
        .filter((r) => r.teamId === team.id)
        .map((r) => r.performerId);
      expect(new Set(performers.slice(0, team.playerIds.length)).size).toBe(
        team.playerIds.length
      );
    }
  });

  it('only ever picks a performer from the team whose turn it is', () => {
    const state = newSession({ length: 'long' });
    for (const round of state.plan) {
      const team = state.setup.teams.find((t) => t.id === round.teamId)!;
      expect(team.playerIds).toContain(round.performerId);
    }
  });
});

describe('a complete game', () => {
  it('runs from the first round to a final standing', () => {
    const end = playThrough(newSession(), 0.7);
    expect(isFinished(end)).toBe(true);
    expect(end.results.length).toBeGreaterThanOrEqual(end.plan.length);
    const table = standings(end.scores, end.setup.teams);
    expect(table).toHaveLength(2);
    expect(table[0].points).toBeGreaterThanOrEqual(table[1].points);
  });

  it('gives up on sudden death rather than looping forever', () => {
    // Both teams score identically every round, so no tie-break can separate
    // them. The game must still end.
    const end = playThrough(newSession({ length: 'quick' }), 0.5);
    expect(isFinished(end)).toBe(true);
    expect(end.plan.filter((r) => r.isSuddenDeath).length).toBeLessThanOrEqual(6);
  });

  it('rotates through several different mini-games', () => {
    const end = playThrough(newSession({ length: 'long' }));
    const played = new Set(end.results.map((r) => r.game));
    expect(played.size).toBeGreaterThanOrEqual(4);
  });

  it('reports progress as round X of Y', () => {
    const state = newSession();
    expect(progress(state)).toEqual({ round: 1, total: state.plan.length });
  });

  it('adds sudden death when the teams finish level', () => {
    // Award nothing at all: both teams end on zero.
    const end = playThrough(newSession({ length: 'quick' }), 0);
    const suddenDeath = end.plan.filter((r) => r.isSuddenDeath);
    expect(suddenDeath.length).toBeGreaterThanOrEqual(2);
  });

  it('a rematch keeps the players but deals new cards', () => {
    const end = playThrough(newSession({ room: 'mixed', length: 'quick' }));
    const again = rematch(end, sessionPromptIdsByGame(end));
    expect(again.setup.players).toEqual(end.setup.players);
    expect(again.setup.room).toBe(end.setup.room);
    expect(again.results).toEqual([]);
    expect(Object.values(again.scores).every((v) => v === 0)).toBe(true);

    const before = new Set(end.plan.flatMap((r) => r.promptIds));
    const after = again.plan.flatMap((r) => r.promptIds);
    expect(after.filter((id) => before.has(id))).toHaveLength(0);
  });
});

describe('free-for-all', () => {
  it('treats each player as their own team', () => {
    const state = newSession({ mode: 'ffa' });
    expect(state.setup.teams).toHaveLength(players.length);
    expect(state.plan.filter((r) => r.isFinal)).toHaveLength(players.length);
    const end = playThrough(state);
    expect(isFinished(end)).toBe(true);
  });
});

describe('persistence', () => {
  it('survives an app restart mid-game', async () => {
    const store = new MemoryStore();
    let state = newSession();
    state = beginRound(state);
    await saveSession(store, state);

    const restored = await loadSession(store);
    expect(restored).not.toBeNull();
    expect(restored!.currentRound).toBe(state.currentRound);
    expect(restored!.plan).toEqual(state.plan);
    expect(restored!.setup.players).toEqual(players);
  });

  it('does not offer to resume a finished game', async () => {
    const store = new MemoryStore();
    await saveSession(store, playThrough(newSession()));
    expect(await loadSession(store)).toBeNull();
  });

  it('ignores corrupt saved data instead of crashing', async () => {
    const store = new MemoryStore();
    await store.setItem('ym:session:v1', '{not json');
    expect(await loadSession(store)).toBeNull();
  });

  it('remembers player names and settings between games', async () => {
    const store = new MemoryStore();
    await savePreferences(store, {
      ...DEFAULT_PREFERENCES,
      lang: 'ar',
      lastPlayers: players,
      lastRoom: 'diwaniya',
    });
    const prefs = await loadPreferences(store);
    expect(prefs.lastPlayers).toEqual(players);
    expect(prefs.lastRoom).toBe('diwaniya');
    expect(prefs.sound).toBe(true);
  });

  it('stores prompt reports locally', async () => {
    const store = new MemoryStore();
    await addReport(store, {
      id: 'r1',
      promptId: 'act-001',
      reason: 'unclear',
      createdAt: 1,
      lang: 'ar',
    });
    expect(await loadReports(store)).toHaveLength(1);
  });

  it('wipes everything on request', async () => {
    const store = new MemoryStore();
    await savePreferences(store, { ...DEFAULT_PREFERENCES, lang: 'ar' });
    await saveSession(store, newSession());
    await resetAllLocalData(store);
    expect(await loadSession(store)).toBeNull();
    expect((await loadPreferences(store)).lang).toBeNull();
  });

  it('clears just the saved game when the host quits', async () => {
    const store = new MemoryStore();
    await saveSession(store, newSession());
    await clearSession(store);
    expect(await loadSession(store)).toBeNull();
  });

  it('carries the recency window forward across sessions', () => {
    const first = newSession({ room: 'mixed', length: 'quick' });
    let recent: Record<string, string[]> = {};
    for (const [game, ids] of Object.entries(sessionPromptIdsByGame(first))) {
      recent = rememberPrompts(recent, game as never, ids);
    }
    expect(Object.keys(recent).length).toBeGreaterThan(0);
    const second = createSession({
      lang: 'en',
      room: 'mixed',
      mode: 'teams',
      length: 'quick',
      level: 'family',
      players,
      recentIds: recent,
      seed: 4242,
    });
    const firstIds = new Set(first.plan.flatMap((r) => r.promptIds));
    expect(second.plan.flatMap((r) => r.promptIds).some((id) => firstIds.has(id))).toBe(false);
  });
});
