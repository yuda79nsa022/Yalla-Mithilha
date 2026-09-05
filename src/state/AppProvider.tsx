import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { draftCharades, unlockCharades as unlockCharadesState } from '../engine/charades';
import type { CharadesState } from '../engine/charades';
import {
  DEFAULT_PREFERENCES,
  clearCharades,
  clearPlayerSession,
  loadCharades,
  loadPlayerSession,
  loadPreferences,
  resetAllLocalData,
  saveCharades,
  savePlayerSession,
  savePreferences,
  type Preferences,
  type PlayerSession,
} from '../engine/persistence';
import type { Lang } from '../engine/types';
import { makeTranslator, type TranslateParams, type TranslationKey } from '../i18n';
import { deviceLanguage, deviceStore } from '../platform';
import { track } from '../services/analytics';
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
   * Spends one wallet credit and deals the drafted session's 20 titles.
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

  /** A real player account. Signing up or signing in sends a username and password to the backend. */
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
  const [charades, setCharadesState] = useState<CharadesState | null>(null);
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [gamePriceFils, setGamePriceFils] = useState(0);
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null);
  const [playerAuthBusy, setPlayerAuthBusy] = useState(false);
  const [playerAuthError, setPlayerAuthError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [storedPrefs, storedCharades, storedPlayerSession] = await Promise.all([
        loadPreferences(deviceStore),
        loadCharades(deviceStore),
        loadPlayerSession(deviceStore),
      ]);

      setPrefsState({ ...storedPrefs, lang: storedPrefs.lang ?? deviceLanguage() });
      setCharadesState(storedCharades);
      setPlayerSession(storedPlayerSession);
      setReady(true);

      // Spending real money requires a connection — no offline fallback. A
      // failure just leaves the deck list empty and the draft screen says so.
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
    })();
  }, []);

  const lang: Lang = prefs.lang ?? 'en';
  const t = useMemo(() => makeTranslator(lang), [lang]);

  const setPrefs = useCallback((patch: Partial<Preferences>) => {
    setPrefsState((current) => {
      const next = { ...current, ...patch };
      void savePreferences(deviceStore, next);
      return next;
    });
  }, []);

  const wipeEverything = useCallback(async () => {
    await resetAllLocalData(deviceStore);
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
