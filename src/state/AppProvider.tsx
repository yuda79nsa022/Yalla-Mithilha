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
import { draftBoard, unlockBoard } from '../engine/board/board';
import type { BoardState, CategoryDeck } from '../engine/board/types';
import {
  DEFAULT_PREFERENCES,
  addReport,
  clearBoard,
  clearPlayerSession,
  clearSession,
  loadBoard,
  loadCatalogueCache,
  loadPlayerSession,
  loadPreferences,
  loadRecent,
  loadReports,
  loadSession,
  loadSyncedReportIds,
  markReportsSynced,
  resetAllLocalData,
  saveBoard,
  saveCatalogueCache,
  savePlayerSession,
  saveRecent,
  savePreferences,
  saveSession,
  type Preferences,
  type PlayerSession,
} from '../engine/persistence';
import { rememberPrompts } from '../engine/selector';
import type { Lang, MiniGameId, PromptReport, SessionState, Team } from '../engine/types';
import { BOARD_CATALOGUE } from '../content/board';
import { makeTranslator, type TranslateParams, type TranslationKey } from '../i18n';
import { deviceLanguage, deviceStore } from '../platform';
import { setSoundEnabled } from '../platform/audio';
import { ownedPacks } from '../services/entitlements';
import { track } from '../services/analytics';
import { fetchBoardCatalogue } from '../services/catalogueApi';
import { syncReports } from '../services/reportSyncApi';
import { PlayerAuthError, loginPlayer as loginPlayerApi, registerPlayer as registerPlayerApi } from '../services/playerAuthApi';
import {
  BoardPaymentError,
  confirmBoardCheckout as confirmBoardCheckoutApi,
  consumeBoardCredit,
  failBoardCheckout as failBoardCheckoutApi,
  getBoardCredits,
  startBoardCheckout as startBoardCheckoutApi,
  type CheckoutPayment,
  type ProductId,
} from '../services/boardPaymentApi';

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
  startBoardDraft: (
    teamAName: string,
    teamBName: string,
    teamAPicks: readonly [string, string, string],
    teamBPicks: readonly [string, string, string]
  ) => BoardState;
  updateBoard: (next: BoardState) => void;
  /**
   * Spends one server-held credit and unlocks the drafted board. Requires a
   * signed-in player — paid credits are owned by an account, never by a
   * device, so there is no local balance to spend without one. False when
   * there is no player session or no credit to spend.
   */
  unlockCurrentBoard: () => Promise<boolean>;
  quitBoard: () => void;

  /**
   * Real, server-authoritative board-game credits — owned by the signed-in
   * player's account, never trusted to local device state. Buying credits
   * requires a player session; drafting a board does not.
   */
  boardCredits: number;
  boardCreditsBusy: boolean;
  boardCheckoutError: string | null;
  refreshBoardCredits: () => Promise<void>;
  /** Starts a checkout. Returns `null` when there is no player session. */
  startBoardCheckout: (product: ProductId) => Promise<CheckoutPayment | null>;
  /** Stands in for a real KNET/payment-provider success callback until that integration exists. */
  confirmBoardCheckout: (paymentId: string) => Promise<boolean>;
  /** Stands in for a real payment-provider failure/cancellation callback. */
  failBoardCheckout: (paymentId: string) => Promise<void>;

  /**
   * Optional player account, entirely separate from guest play — which never
   * creates one of these and keeps working exactly as before. Signing up or
   * signing in sends a username and password to the backend; nothing else
   * about how the game runs depends on it.
   */
  player: { id: string; username: string } | null;
  playerAuthBusy: boolean;
  playerAuthError: string | null;
  registerPlayerAccount: (username: string, password: string) => Promise<boolean>;
  loginPlayerAccount: (username: string, password: string) => Promise<boolean>;
  logoutPlayerAccount: () => void;
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
  const [catalogue, setCatalogue] = useState<CategoryDeck[]>(BOARD_CATALOGUE);
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null);
  const [playerAuthBusy, setPlayerAuthBusy] = useState(false);
  const [playerAuthError, setPlayerAuthError] = useState<string | null>(null);
  const [boardCredits, setBoardCredits] = useState(0);
  const [boardCreditsBusy, setBoardCreditsBusy] = useState(false);
  const [boardCheckoutError, setBoardCheckoutError] = useState<string | null>(null);

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
        cachedCatalogue,
        storedPlayerSession,
      ] = await Promise.all([
        loadPreferences(deviceStore),
        loadRecent(deviceStore),
        loadReports(deviceStore),
        ownedPacks(deviceStore),
        loadSession(deviceStore),
        loadBoard(deviceStore),
        loadCatalogueCache(deviceStore),
        loadPlayerSession(deviceStore),
      ]);

      setPrefsState({ ...storedPrefs, lang: storedPrefs.lang ?? deviceLanguage() });
      setRecent(storedRecent);
      setReports(storedReports);
      setPacks(storedPacks);
      setSavedSession(unfinished);
      setBoardState(storedBoard);
      if (cachedCatalogue) setCatalogue(cachedCatalogue);
      setPlayerSession(storedPlayerSession);
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

      // Board credits live entirely on the server — nothing to show until a
      // saved player session proves there is an account to check. A failure
      // here just leaves the balance at 0; the checkout screen can retry.
      if (storedPlayerSession) {
        getBoardCredits(storedPlayerSession.token)
          .then(setBoardCredits)
          .catch(() => undefined);
      }

      // Flushes whatever is left of the offline report queue from a
      // previous launch — never blocks startup, no account required. If the
      // device is still offline this just fails silently and tries again
      // next launch (or the next time a report is filed, see `report`
      // below), which is the offline-first pattern already used for the
      // catalogue fetch above.
      void syncPendingReports(storedReports);
    })();
  }, []);

  const syncPendingReports = useCallback(async (allReports: PromptReport[]) => {
    const synced = await loadSyncedReportIds(deviceStore);
    const syncedSet = new Set(synced);
    const pending = allReports.filter((r) => !syncedSet.has(r.id));
    if (!pending.length) return;
    try {
      await syncReports(pending);
      await markReportsSynced(
        deviceStore,
        pending.map((r) => r.id)
      );
    } catch {
      // Still offline, or the server is down — stays queued for next time.
    }
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

      // Best-effort immediate sync — offline (or a down server) just leaves
      // it queued for the next launch's `syncPendingReports` pass.
      syncReports([entry])
        .then(() => markReportsSynced(deviceStore, [entry.id]))
        .catch(() => undefined);
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
    setBoardCredits(0);
    setBoardCheckoutError(null);
    setPlayerSession(null);
    setPlayerAuthError(null);
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

  const refreshBoardCredits = useCallback(async () => {
    if (!playerSession) {
      setBoardCredits(0);
      return;
    }
    try {
      setBoardCredits(await getBoardCredits(playerSession.token));
    } catch {
      // Leave the last-known balance showing rather than flash it to zero on a transient network error.
    }
  }, [playerSession]);

  const unlockCurrentBoard = useCallback(async () => {
    if (!board || !playerSession) return false;
    try {
      const { balance } = await consumeBoardCredit(playerSession.token, board.id);
      setBoardCredits(balance);
      updateBoard(unlockBoard(board));
      track({ name: 'board_unlocked' });
      return true;
    } catch (err) {
      setBoardCheckoutError(err instanceof BoardPaymentError ? err.message : 'could not reach the server');
      return false;
    }
  }, [board, playerSession, updateBoard]);

  const startBoardCheckout = useCallback(
    async (product: ProductId) => {
      if (!playerSession) return null;
      setBoardCreditsBusy(true);
      setBoardCheckoutError(null);
      try {
        return await startBoardCheckoutApi(playerSession.token, product);
      } catch (err) {
        setBoardCheckoutError(err instanceof BoardPaymentError ? err.message : 'could not reach the server');
        return null;
      } finally {
        setBoardCreditsBusy(false);
      }
    },
    [playerSession]
  );

  const confirmBoardCheckout = useCallback(
    async (paymentId: string) => {
      if (!playerSession) return false;
      setBoardCreditsBusy(true);
      setBoardCheckoutError(null);
      try {
        const { balance } = await confirmBoardCheckoutApi(playerSession.token, paymentId);
        setBoardCredits(balance);
        track({ name: 'board_credits_granted', count: balance });
        return true;
      } catch (err) {
        setBoardCheckoutError(err instanceof BoardPaymentError ? err.message : 'could not reach the server');
        return false;
      } finally {
        setBoardCreditsBusy(false);
      }
    },
    [playerSession]
  );

  const failBoardCheckout = useCallback(
    async (paymentId: string) => {
      if (!playerSession) return;
      try {
        await failBoardCheckoutApi(playerSession.token, paymentId);
      } catch {
        // Nothing to reconcile client-side — the payment simply never grants credits.
      }
    },
    [playerSession]
  );

  const quitBoard = useCallback(() => {
    setBoardState(null);
    void clearBoard(deviceStore);
  }, []);

  const registerPlayerAccount = useCallback(async (username: string, password: string) => {
    setPlayerAuthBusy(true);
    setPlayerAuthError(null);
    try {
      const result = await registerPlayerApi(username, password);
      const session: PlayerSession = { id: result.player.id, username: result.player.username, token: result.token };
      setPlayerSession(session);
      await savePlayerSession(deviceStore, session);
      track({ name: 'player_account_created' });
      getBoardCredits(session.token).then(setBoardCredits).catch(() => undefined);
      return true;
    } catch (err) {
      setPlayerAuthError(err instanceof PlayerAuthError ? err.message : 'could not reach the server');
      return false;
    } finally {
      setPlayerAuthBusy(false);
    }
  }, []);

  const loginPlayerAccount = useCallback(async (username: string, password: string) => {
    setPlayerAuthBusy(true);
    setPlayerAuthError(null);
    try {
      const result = await loginPlayerApi(username, password);
      const session: PlayerSession = { id: result.player.id, username: result.player.username, token: result.token };
      setPlayerSession(session);
      await savePlayerSession(deviceStore, session);
      track({ name: 'player_logged_in' });
      getBoardCredits(session.token).then(setBoardCredits).catch(() => undefined);
      return true;
    } catch (err) {
      setPlayerAuthError(err instanceof PlayerAuthError ? err.message : 'could not reach the server');
      return false;
    } finally {
      setPlayerAuthBusy(false);
    }
  }, []);

  const logoutPlayerAccount = useCallback(() => {
    setPlayerSession(null);
    setPlayerAuthError(null);
    setBoardCredits(0);
    setBoardCheckoutError(null);
    void clearPlayerSession(deviceStore);
    track({ name: 'player_logout' });
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
    startBoardDraft,
    updateBoard,
    unlockCurrentBoard,
    quitBoard,
    boardCredits,
    boardCreditsBusy,
    boardCheckoutError,
    refreshBoardCredits,
    startBoardCheckout,
    confirmBoardCheckout,
    failBoardCheckout,
    player: playerSession ? { id: playerSession.id, username: playerSession.username } : null,
    playerAuthBusy,
    playerAuthError,
    registerPlayerAccount,
    loginPlayerAccount,
    logoutPlayerAccount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
