import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createSession,
  rematch as rematchSession,
  sessionPromptIdsByGame,
  type CreateSessionInput,
} from '../engine/engine';
import { draftBoard, unlockBoard as unlockBoardState } from '../engine/board/board';
import type { BoardState, CategoryDeck } from '../engine/board/types';
import {
  DEFAULT_PREFERENCES,
  addReport,
  clearBoard,
  clearSession,
  loadBoard,
  loadCatalogueCache,
  loadPreferences,
  loadRecent,
  loadReports,
  loadSession,
  resetAllLocalData,
  saveBoard,
  saveCatalogueCache,
  saveRecent,
  savePreferences,
  saveSession,
  type Preferences,
} from '../engine/persistence';
import { rememberPrompts } from '../engine/selector';
import type { Lang, MiniGameId, PromptReport, SessionState, Team } from '../engine/types';
import { BOARD_CATALOGUE } from '../content/board';
import { makeTranslator, type TranslateParams, type TranslationKey } from '../i18n';
import { deviceLanguage, deviceStore } from '../platform';
import { setSoundEnabled } from '../platform/audio';
import { boardCredits, grantCredits, ownedPacks, spendCredit } from '../services/entitlements';
import { track } from '../services/analytics';
import { fetchBoardCatalogue } from '../services/catalogueApi';

interface AppValue {
  ready: boolean;
  lang: Lang;
  t: (key: TranslationKey, params?: TranslateParams) => string;
  prefs: Preferences;
  setPrefs: (patch: Partial<Preferences>) => void;
  packs: string[];

  /** A game saved from a previous launch, offered on the home screen. */
  savedSession: SessionState | null;
  session: SessionState | null;
  startSession: (input: Omit<CreateSessionInput, 'recentIds' | 'packs'>) => SessionState;
  updateSession: (next: SessionState) => void;
  resumeSaved: () => void;
  discardSaved: () => void;
  finishSession: (state: SessionState) => void;
  quitSession: () => void;
  playAgain: () => SessionState | null;

  reports: PromptReport[];
  report: (promptId: string, reason: PromptReport['reason']) => Promise<void>;
  wipeEverything: () => Promise<void>;

  /**
   * SeenJeem-style board game: draft, pay, play on one shared screen.
   * `catalogue` starts as the cached or bundled category list and is
   * replaced in the background by a live fetch — never blocks startup, and
   * silently keeps whatever it already had if the fetch fails.
   */
  catalogue: CategoryDeck[];
  board: BoardState | null;
  boardCredits: number;
  startBoardDraft: (
    teamAName: string,
    teamBName: string,
    teamAPicks: readonly [string, string, string],
    teamBPicks: readonly [string, string, string]
  ) => BoardState;
  updateBoard: (next: BoardState) => void;
  /** Spends one credit and unlocks the drafted board. False when there is no credit to spend. */
  unlockCurrentBoard: () => Promise<boolean>;
  /** Stands in for a real MyFatoorah/Tap purchase callback until that integration exists. */
  buyBoardCreditsDev: (count: number) => Promise<void>;
  quitBoard: () => void;
}

const AppContext = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}

/** Convenience hook for the common case of only needing translations. */
export function useT() {
  return useApp().t;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefsState] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [session, setSession] = useState<SessionState | null>(null);
  const [savedSession, setSavedSession] = useState<SessionState | null>(null);
  const [recent, setRecent] = useState<Record<string, string[]>>({});
  const [reports, setReports] = useState<PromptReport[]>([]);
  const [packs, setPacks] = useState<string[]>(['core']);
  const [board, setBoardState] = useState<BoardState | null>(null);
  const [credits, setCredits] = useState(0);
  const [catalogue, setCatalogue] = useState<CategoryDeck[]>(BOARD_CATALOGUE);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const [
        storedPrefs,
        storedRecent,
        storedReports,
        storedPacks,
        unfinished,
        storedBoard,
        storedCredits,
        cachedCatalogue,
      ] = await Promise.all([
        loadPreferences(deviceStore),
        loadRecent(deviceStore),
        loadReports(deviceStore),
        ownedPacks(deviceStore),
        loadSession(deviceStore),
        loadBoard(deviceStore),
        boardCredits(deviceStore),
        loadCatalogueCache(deviceStore),
      ]);

      setPrefsState({ ...storedPrefs, lang: storedPrefs.lang ?? deviceLanguage() });
      setRecent(storedRecent);
      setReports(storedReports);
      setPacks(storedPacks);
      setSavedSession(unfinished);
      setBoardState(storedBoard);
      setCredits(storedCredits);
      if (cachedCatalogue) setCatalogue(cachedCatalogue);
      setSoundEnabled(storedPrefs.sound);
      setReady(true);

      // Never blocks startup — the cached or bundled catalogue is already
      // showing. A failure here (offline, server down) just leaves it be.
      fetchBoardCatalogue()
        .then((fresh) => {
          setCatalogue(fresh);
          void saveCatalogueCache(deviceStore, fresh);
        })
        .catch(() => undefined);
    })();
  }, []);

  const lang: Lang = prefs.lang ?? 'en';
  const t = useMemo(() => makeTranslator(lang), [lang]);

  const setPrefs = useCallback((patch: Partial<Preferences>) => {
    setPrefsState((current) => {
      const next = { ...current, ...patch };
      if (patch.sound !== undefined) setSoundEnabled(patch.sound);
      void savePreferences(deviceStore, next);
      return next;
    });
  }, []);

  /**
   * Every state change is written to disk, but throttled: a round can produce
   * a dozen updates in a minute and AsyncStorage writes are not free.
   */
  const persistSession = useCallback((next: SessionState | null) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!next) {
      void clearSession(deviceStore);
      return;
    }
    saveTimer.current = setTimeout(() => {
      void saveSession(deviceStore, next);
    }, 400);
  }, []);

  const updateSession = useCallback(
    (next: SessionState) => {
      setSession(next);
      persistSession(next);
    },
    [persistSession]
  );

  const startSession = useCallback(
    (input: Omit<CreateSessionInput, 'recentIds' | 'packs'>) => {
      const next = createSession({ ...input, recentIds: recent, packs });
      setSavedSession(null);
      updateSession(next);
      track({
        name: 'game_started',
        room: next.setup.room,
        length: next.setup.length,
        level: next.setup.level,
        players: next.setup.players.length,
        mode: next.setup.mode,
      });
      return next;
    },
    [packs, recent, updateSession]
  );

  const rememberSession = useCallback(
    (state: SessionState) => {
      let next = recent;
      for (const [game, ids] of Object.entries(sessionPromptIdsByGame(state))) {
        next = rememberPrompts(next, game as MiniGameId, ids);
      }
      setRecent(next);
      void saveRecent(deviceStore, next);
      return next;
    },
    [recent]
  );

  const finishSession = useCallback(
    (state: SessionState) => {
      rememberSession(state);
      setSession(state);
      void clearSession(deviceStore);
      track({
        name: 'game_completed',
        rounds: state.results.length,
        durationSeconds: Math.round((state.updatedAt - state.startedAt) / 1000),
      });
    },
    [rememberSession]
  );

  const quitSession = useCallback(() => {
    if (session) {
      rememberSession(session);
      track({ name: 'game_abandoned', roundsPlayed: session.results.length });
    }
    setSession(null);
    setSavedSession(null);
    void clearSession(deviceStore);
  }, [rememberSession, session]);

  const playAgain = useCallback(() => {
    if (!session) return null;
    const next = rematchSession(session, recent);
    updateSession(next);
    track({ name: 'rematch_selected' });
    return next;
  }, [recent, session, updateSession]);

  const resumeSaved = useCallback(() => {
    if (!savedSession) return;
    setSession(savedSession);
    setSavedSession(null);
  }, [savedSession]);

  const discardSaved = useCallback(() => {
    setSavedSession(null);
    void clearSession(deviceStore);
  }, []);

  const report = useCallback(
    async (promptId: string, reason: PromptReport['reason']) => {
      const entry: PromptReport = {
        id: `rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        promptId,
        reason,
        createdAt: Date.now(),
        lang,
      };
      setReports(await addReport(deviceStore, entry));
      track({ name: 'prompt_reported', promptId, reason });
    },
    [lang]
  );

  const wipeEverything = useCallback(async () => {
    await resetAllLocalData(deviceStore);
    setSession(null);
    setSavedSession(null);
    setRecent({});
    setReports([]);
    setPacks(['core']);
    setBoardState(null);
    setCredits(0);
    setPrefsState({ ...DEFAULT_PREFERENCES, lang });
  }, [lang]);

  const updateBoard = useCallback((next: BoardState) => {
    setBoardState(next);
    void saveBoard(deviceStore, next);
  }, []);

  const startBoardDraft = useCallback(
    (
      teamAName: string,
      teamBName: string,
      teamAPicks: readonly [string, string, string],
      teamBPicks: readonly [string, string, string]
    ) => {
      const teamA: Team = { id: 'board-a', name: teamAName, playerIds: [], performerCursor: 0 };
      const teamB: Team = { id: 'board-b', name: teamBName, playerIds: [], performerCursor: 0 };
      const next = draftBoard(teamA, teamB, teamAPicks, teamBPicks, catalogue);
      updateBoard(next);
      track({ name: 'board_drafted', categoryIds: next.categories.map((c) => c.id) });
      return next;
    },
    [catalogue, updateBoard]
  );

  const unlockCurrentBoard = useCallback(async () => {
    if (!board) return false;
    const remaining = await spendCredit(deviceStore);
    if (remaining === null) return false;
    setCredits(remaining);
    updateBoard(unlockBoardState(board));
    track({ name: 'board_unlocked' });
    return true;
  }, [board, updateBoard]);

  const buyBoardCreditsDev = useCallback(async (count: number) => {
    const next = await grantCredits(deviceStore, count);
    setCredits(next);
    track({ name: 'board_credits_granted', count });
  }, []);

  const quitBoard = useCallback(() => {
    setBoardState(null);
    void clearBoard(deviceStore);
  }, []);

  const value: AppValue = {
    ready,
    lang,
    t,
    prefs,
    setPrefs,
    packs,
    savedSession,
    session,
    startSession,
    updateSession,
    resumeSaved,
    discardSaved,
    finishSession,
    quitSession,
    playAgain,
    reports,
    report,
    wipeEverything,
    catalogue,
    board,
    boardCredits: credits,
    startBoardDraft,
    updateBoard,
    unlockCurrentBoard,
    buyBoardCreditsDev,
    quitBoard,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
