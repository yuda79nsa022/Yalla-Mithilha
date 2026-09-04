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
import { draftCharades, unlockCharades as unlockCharadesState } from '../engine/charades';
import type { CharadesState } from '../engine/charades';
import {
  DEFAULT_PREFERENCES,
  addReport,
  clearCharades,
  clearPlayerSession,
  clearSession,
  loadCharades,
  loadPlayerSession,
  loadPreferences,
  loadRecent,
  loadReports,
  loadSession,
  loadSyncedReportIds,
  markReportsSynced,
  resetAllLocalData,
  saveCharades,
  savePlayerSession,
  saveRecent,
  savePreferences,
  saveSession,
  type Preferences,
  type PlayerSession,
} from '../engine/persistence';
import { rememberPrompts } from '../engine/selector';
import type { Lang, MiniGameId, PromptReport, SessionState } from '../engine/types';
import { makeTranslator, type TranslateParams, type TranslationKey } from '../i18n';
import { deviceLanguage, deviceStore } from '../platform';
import { setSoundEnabled } from '../platform/audio';
import { ownedPacks } from '../services/entitlements';
import { track } from '../services/analytics';
import { syncReports } from '../services/reportSyncApi';
import { PlayerAuthError, loginPlayer as loginPlayerApi, registerPlayer as registerPlayerApi } from '../services/playerAuthApi';
import {
  WalletError,
  confirmCheckout as confirmCheckoutApi,
  failCheckout as failCheckoutApi,
  getGamePrice,
  getWalletBalance,
  listDecks,
  startCheckout as startCheckoutApi,
  startGameSession,
  type CheckoutPayment,
  type PublicDeck,
} from '../services/walletApi';

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
   * The paid game: silent charades. `decks` is the server's list of playable
   * decks (no offline fallback — spending real money already requires a
   * connection). `gamePriceFils` is the current admin-set price of one game.
   */
  decks: PublicDeck[];
  gamePriceFils: number;
  charades: CharadesState | null;
  startCharadesDraft: (deckId: string, teamAName: string, teamBName: string) => CharadesState;
  updateCharades: (next: CharadesState) => void;
  /**
   * Spends one wallet credit and deals the drafted session's 10 titles.
   * Requires a signed-in player — wallet credits are owned by an account,
   * never a device. False when there is no player session, no credit to
   * spend, or the deck turned out to be empty.
   */
  unlockCurrentCharades: () => Promise<boolean>;
  quitCharades: () => void;

  /**
   * Real, server-authoritative wallet balance — owned by the signed-in
   * player's account, never trusted to local device state. Topping up
   * requires a player session; drafting a session does not.
   */
  walletBalance: number;
  walletBusy: boolean;
  walletError: string | null;
  refreshWallet: () => Promise<void>;
  /** Starts a top-up for exactly one game's worth of credit. Returns `null` when there is no player session. */
  startTopUp: () => Promise<CheckoutPayment | null>;
  /** Stands in for a real KNET/payment-provider success callback until that integration exists. */
  confirmTopUp: (paymentId: string) => Promise<boolean>;
  /** Stands in for a real payment-provider failure/cancellation callback. */
  failTopUp: (paymentId: string) => Promise<void>;

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
  const [charades, setCharadesState] = useState<CharadesState | null>(null);
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [gamePriceFils, setGamePriceFils] = useState(0);
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null);
  const [playerAuthBusy, setPlayerAuthBusy] = useState(false);
  const [playerAuthError, setPlayerAuthError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const [storedPrefs, storedRecent, storedReports, storedPacks, unfinished, storedCharades, storedPlayerSession] =
        await Promise.all([
          loadPreferences(deviceStore),
          loadRecent(deviceStore),
          loadReports(deviceStore),
          ownedPacks(deviceStore),
          loadSession(deviceStore),
          loadCharades(deviceStore),
          loadPlayerSession(deviceStore),
        ]);

      setPrefsState({ ...storedPrefs, lang: storedPrefs.lang ?? deviceLanguage() });
      setRecent(storedRecent);
      setReports(storedReports);
      setPacks(storedPacks);
      setSavedSession(unfinished);
      setCharadesState(storedCharades);
      setPlayerSession(storedPlayerSession);
      setSoundEnabled(storedPrefs.sound);
      setReady(true);

      // Spending real money already requires a connection, so there is no
      // offline fallback here the way the free Party Game has — a failure
      // just leaves the deck list empty and the draft screen says so.
      listDecks()
        .then(setDecks)
        .catch(() => undefined);
      getGamePrice()
        .then((r) => setGamePriceFils(r.fils))
        .catch(() => undefined);

      // Wallet balance lives entirely on the server — nothing to show until a
      // saved player session proves there is an account to check. A failure
      // here just leaves the balance at 0; the checkout screen can retry.
      if (storedPlayerSession) {
        getWalletBalance(storedPlayerSession.token)
          .then(setWalletBalance)
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
    setCharadesState(null);
    setWalletBalance(0);
    setWalletError(null);
    setPlayerSession(null);
    setPlayerAuthError(null);
    setPrefsState({ ...DEFAULT_PREFERENCES, lang });
  }, [lang]);

  const updateCharades = useCallback((next: CharadesState) => {
    setCharadesState(next);
    void saveCharades(deviceStore, next);
  }, []);

  const startCharadesDraft = useCallback(
    (deckId: string, teamAName: string, teamBName: string) => {
      const next = draftCharades(deckId, teamAName, teamBName);
      updateCharades(next);
      track({ name: 'charades_drafted', deckId });
      return next;
    },
    [updateCharades]
  );

  const refreshWallet = useCallback(async () => {
    if (!playerSession) {
      setWalletBalance(0);
      return;
    }
    try {
      setWalletBalance(await getWalletBalance(playerSession.token));
    } catch {
      // Leave the last-known balance showing rather than flash it to zero on a transient network error.
    }
  }, [playerSession]);

  const unlockCurrentCharades = useCallback(async () => {
    if (!charades || !playerSession) return false;
    try {
      const { titles, balance } = await startGameSession(playerSession.token, charades.id, charades.deckId);
      setWalletBalance(balance);
      updateCharades(unlockCharadesState(charades, titles));
      track({ name: 'charades_unlocked', deckId: charades.deckId });
      return true;
    } catch (err) {
      setWalletError(err instanceof WalletError ? err.message : 'could not reach the server');
      return false;
    }
  }, [charades, playerSession, updateCharades]);

  const startTopUp = useCallback(async () => {
    if (!playerSession) return null;
    setWalletBusy(true);
    setWalletError(null);
    try {
      return await startCheckoutApi(playerSession.token);
    } catch (err) {
      setWalletError(err instanceof WalletError ? err.message : 'could not reach the server');
      return null;
    } finally {
      setWalletBusy(false);
    }
  }, [playerSession]);

  const confirmTopUp = useCallback(
    async (paymentId: string) => {
      if (!playerSession) return false;
      setWalletBusy(true);
      setWalletError(null);
      try {
        const { balance } = await confirmCheckoutApi(playerSession.token, paymentId);
        setWalletBalance(balance);
        track({ name: 'wallet_topped_up', balance });
        return true;
      } catch (err) {
        setWalletError(err instanceof WalletError ? err.message : 'could not reach the server');
        return false;
      } finally {
        setWalletBusy(false);
      }
    },
    [playerSession]
  );

  const failTopUp = useCallback(
    async (paymentId: string) => {
      if (!playerSession) return;
      try {
        await failCheckoutApi(playerSession.token, paymentId);
      } catch {
        // Nothing to reconcile client-side — the payment simply never grants credits.
      }
    },
    [playerSession]
  );

  const quitCharades = useCallback(() => {
    setCharadesState(null);
    void clearCharades(deviceStore);
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
      getWalletBalance(session.token).then(setWalletBalance).catch(() => undefined);
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
      getWalletBalance(session.token).then(setWalletBalance).catch(() => undefined);
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
    setWalletBalance(0);
    setWalletError(null);
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
    decks,
    gamePriceFils,
    charades,
    startCharadesDraft,
    updateCharades,
    unlockCurrentCharades,
    quitCharades,
    walletBalance,
    walletBusy,
    walletError,
    refreshWallet,
    startTopUp,
    confirmTopUp,
    failTopUp,
    player: playerSession ? { id: playerSession.id, username: playerSession.username } : null,
    playerAuthBusy,
    playerAuthError,
    registerPlayerAccount,
    loginPlayerAccount,
    logoutPlayerAccount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
