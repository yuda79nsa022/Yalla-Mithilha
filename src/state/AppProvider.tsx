import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { draftCharades, unlockCharades as unlockClassicCharades } from '../engine/charades';
import { charadesForPlayer, type CharadesState, type GameMode } from '../engine/game';
import { draftModifiedCharades, unlockModifiedCharades, type CharadesDeal } from '../engine/modifiedCharades';
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
import {
  PlayerAuthError,
  confirmPasswordReset as confirmPasswordResetApi,
  loginPlayer as loginPlayerApi,
  registerPlayer as registerPlayerApi,
  requestPasswordReset as requestPasswordResetApi,
} from '../services/playerAuthApi';
import {
  WalletError,
  confirmCheckout as confirmCheckoutApi,
  createRevealToken as createRevealTokenApi,
  failCheckout as failCheckoutApi,
  getGamePrice,
  getHomeContent,
  getWalletBalance,
  startCheckout as startCheckoutApi,
  startGameSession,
  type CheckoutPayment,
  type HomeContent,
} from '../services/walletApi';

/** Price-fetch failures just leave that mode's price at 0 — callers fall back to showing nothing rather than a stale number. */
function fetchModePrices(setClassic: (fils: number) => void, setModified: (fils: number) => void) {
  getGamePrice('classic')
    .then((r) => setClassic(r.fils))
    .catch(() => undefined);
  getGamePrice('modified')
    .then((r) => setModified(r.fils))
    .catch(() => undefined);
}

interface AppValue {
  ready: boolean;
  lang: Lang;
  t: (key: TranslationKey, params?: TranslateParams) => string;
  prefs: Preferences;
  setPrefs: (patch: Partial<Preferences>) => void;

  wipeEverything: () => Promise<void>;

  /**
   * The paid game, either mode: silent charades. The server deals every
   * round's title(s) at random from whichever decks the player chose —
   * there is no per-round category to pick. `gamePriceFils` is the current
   * admin-set price of one classic game; `modifiedGamePriceFils` the
   * modified game's own, independently-set price.
   */
  gamePriceFils: number;
  modifiedGamePriceFils: number;
  /** The admin-editable home-screen tagline and write-up. `null` until the first successful fetch — callers fall back to the i18n default text until then. */
  homeContent: HomeContent | null;
  charades: CharadesState | null;
  /** `deckIds` is the player's choice of which decks to play, made alongside the team names and the mode. */
  startCharadesDraft: (teamAName: string, teamBName: string, deckIds: string[], mode: GameMode) => CharadesState;
  updateCharades: (next: CharadesState) => void;
  /**
   * Spends a credit and deals the drafted session's titles, from whichever
   * decks were chosen when the game was drafted. Requires a signed-in
   * player — credits are owned by an account, never a device. A classic
   * draft spends a free signup game first if any remain, otherwise (either
   * mode) a paid credit. False when there is no player session, no credit
   * to spend, or the deal fails.
   */
  unlockCurrentCharades: () => Promise<boolean>;
  quitCharades: () => void;
  /**
   * Mints the single-use token the handoff screen's QR code links to for
   * the round currently being handed off — `null` if there's no player
   * session or the request fails, in which case the caller falls back to
   * showing "scan unavailable" rather than a broken/no QR code.
   */
  mintRevealToken: (title: string, categoryAr: string, categoryEn: string, imageUrl?: string) => Promise<string | null>;

  /**
   * Real, server-authoritative wallet state — owned by the signed-in
   * player's account, never trusted to local device state. `walletBalance`
   * is the paid, pooled balance that covers either mode; `freeGameCredits`
   * is the signup bonus's remainder, also good for either mode.
   * Topping up requires a player session; drafting a session does not.
   */
  walletBalance: number;
  freeGameCredits: number;
  walletBusy: boolean;
  walletError: string | null;
  refreshWallet: () => Promise<void>;
  /** Starts a top-up for exactly one game's worth of credit, at `mode`'s price. Returns `null` when there is no player session. */
  startTopUp: (mode: GameMode) => Promise<CheckoutPayment | null>;
  /** Stands in for a real KNET/payment-provider success callback until that integration exists. */
  confirmTopUp: (paymentId: string) => Promise<boolean>;
  /** Stands in for a real payment-provider failure/cancellation callback. */
  failTopUp: (paymentId: string) => Promise<void>;

  /** A real player account. Signing up or signing in sends a username and password to the backend. */
  player: { id: string; username: string } | null;
  playerAuthBusy: boolean;
  playerAuthError: string | null;
  /** `email` is mandatory — it's the account's only forgot-password channel. */
  registerPlayerAccount: (username: string, password: string, email: string) => Promise<boolean>;
  loginPlayerAccount: (username: string, password: string) => Promise<boolean>;
  logoutPlayerAccount: () => void;
  /**
   * Step one of forgot-password. Always resolves `true` once the server
   * accepts the request, whether or not `username` matched a real account
   * with an email on file — the response never reveals that either way, so
   * there's nothing more specific to report on success.
   */
  requestPasswordReset: (username: string) => Promise<boolean>;
  /** Step two — the code from the (mocked, for now) email plus a new password. */
  confirmPasswordReset: (username: string, code: string, newPassword: string) => Promise<boolean>;
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
  const [gamePriceFils, setGamePriceFils] = useState(0);
  const [modifiedGamePriceFils, setModifiedGamePriceFils] = useState(0);
  const [homeContent, setHomeContent] = useState<HomeContent | null>(null);
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null);
  const [playerAuthBusy, setPlayerAuthBusy] = useState(false);
  const [playerAuthError, setPlayerAuthError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [freeGameCredits, setFreeGameCredits] = useState(0);
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
      // A game saved under a different player (or a paid one saved while
      // signed out) must never resurface for whoever happens to open the
      // app next — see charadesForPlayer.
      const allowedCharades = charadesForPlayer(storedCharades, storedPlayerSession?.id ?? null);
      setCharadesState(allowedCharades);
      if (storedCharades && !allowedCharades) void clearCharades(deviceStore);
      setPlayerSession(storedPlayerSession);
      setReady(true);

      fetchModePrices(setGamePriceFils, setModifiedGamePriceFils);

      getHomeContent()
        .then(setHomeContent)
        .catch(() => undefined);

      // Wallet state lives entirely on the server — nothing to show until a
      // saved player session proves there is an account to check. A failure
      // here just leaves it at 0; the checkout screen can retry.
      if (storedPlayerSession) {
        getWalletBalance(storedPlayerSession.token)
          .then((w) => {
            setWalletBalance(w.balance);
            setFreeGameCredits(w.freeGameCredits);
          })
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
    setFreeGameCredits(0);
    setWalletError(null);
    setPlayerSession(null);
    setPlayerAuthError(null);
    setPrefsState({ ...DEFAULT_PREFERENCES, lang });
  }, [lang]);

  const updateCharades = useCallback((next: CharadesState) => {
    setCharadesState(next);
    void saveCharades(deviceStore, next);
  }, []);

  // Run whenever the signed-in identity changes (login, register, logout) so
  // a game that belongs to someone else never lingers into the new identity
  // — see charadesForPlayer.
  const discardCharadesNotFor = useCallback((playerId: string | null) => {
    setCharadesState((current) => {
      const allowed = charadesForPlayer(current, playerId);
      if (current && !allowed) void clearCharades(deviceStore);
      return allowed;
    });
  }, []);

  const startCharadesDraft = useCallback(
    (teamAName: string, teamBName: string, deckIds: string[], mode: GameMode) => {
      const next: CharadesState =
        mode === 'classic'
          ? draftCharades(teamAName, teamBName, undefined, playerSession?.id ?? null, deckIds)
          : draftModifiedCharades(teamAName, teamBName, undefined, playerSession?.id ?? null, deckIds);
      updateCharades(next);
      track({ name: 'charades_drafted' });
      return next;
    },
    [updateCharades, playerSession]
  );

  // A 401 on any of these means the stored token is dead — expired, or the
  // server no longer recognises it — never a reason to keep retrying with
  // the same token. Clearing the session here is what sends the player back
  // to the sign-in screen instead of being stuck staring at a stale wallet
  // balance and a raw "unauthorized" string forever.
  const handleWalletError = useCallback(
    (err: unknown): string => {
      if (err instanceof WalletError && err.status === 401) {
        setPlayerSession(null);
        setWalletBalance(0);
        void clearPlayerSession(deviceStore);
        return t('account.sessionExpired');
      }
      return err instanceof WalletError ? err.message : 'could not reach the server';
    },
    [t]
  );

  const refreshWallet = useCallback(async () => {
    if (!playerSession) {
      setWalletBalance(0);
      setFreeGameCredits(0);
      return;
    }
    try {
      const w = await getWalletBalance(playerSession.token);
      setWalletBalance(w.balance);
      setFreeGameCredits(w.freeGameCredits);
    } catch (err) {
      if (err instanceof WalletError && err.status === 401) {
        setWalletError(handleWalletError(err));
        return;
      }
      // Leave the last-known balance showing rather than flash it to zero on a transient network error.
    }
  }, [playerSession, handleWalletError]);

  const unlockCurrentCharades = useCallback(
    async () => {
      if (!charades || !playerSession) return false;
      try {
        const { titles, rounds, stacks } = await startGameSession(
          playerSession.token,
          charades.id,
          charades.deckIds,
          charades.mode
        );
        // A spent credit is either the paid wallet or the free signup
        // bonus — re-fetch rather than guess client-side which one the
        // server actually decremented.
        void refreshWallet();
        if (charades.mode === 'classic') {
          updateCharades(unlockClassicCharades(charades, titles, playerSession.id));
        } else {
          const deal: CharadesDeal = { rounds: rounds ?? 0, stacks: stacks ?? { easy: [], medium: [], hard: [] } };
          updateCharades(unlockModifiedCharades(charades, deal, playerSession.id));
        }
        track({ name: 'charades_unlocked' });
        return true;
      } catch (err) {
        setWalletError(handleWalletError(err));
        return false;
      }
    },
    [charades, playerSession, updateCharades, handleWalletError, refreshWallet]
  );

  const mintRevealToken = useCallback(
    async (title: string, categoryAr: string, categoryEn: string, imageUrl?: string) => {
      if (!charades || !playerSession) return null;
      try {
        const { id } = await createRevealTokenApi(playerSession.token, charades.id, title, categoryAr, categoryEn, imageUrl);
        return id;
      } catch {
        // Scan-unavailable is a reasonable fallback for the handoff screen —
        // not worth surfacing as a wallet error the way a failed charge is.
        return null;
      }
    },
    [charades, playerSession]
  );

  const startTopUp = useCallback(async (mode: GameMode) => {
    if (!playerSession) return null;
    setWalletBusy(true);
    setWalletError(null);
    try {
      return await startCheckoutApi(playerSession.token, mode);
    } catch (err) {
      setWalletError(handleWalletError(err));
      return null;
    } finally {
      setWalletBusy(false);
    }
  }, [playerSession, handleWalletError]);

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
        setWalletError(handleWalletError(err));
        return false;
      } finally {
        setWalletBusy(false);
      }
    },
    [playerSession, handleWalletError]
  );

  const failTopUp = useCallback(
    async (paymentId: string) => {
      if (!playerSession) return;
      try {
        await failCheckoutApi(playerSession.token, paymentId);
      } catch (err) {
        if (err instanceof WalletError && err.status === 401) handleWalletError(err);
        // Otherwise nothing to reconcile client-side — the payment simply never grants credits.
      }
    },
    [playerSession, handleWalletError]
  );

  const quitCharades = useCallback(() => {
    setCharadesState(null);
    void clearCharades(deviceStore);
  }, []);

  const registerPlayerAccount = useCallback(async (username: string, password: string, email: string) => {
    setPlayerAuthBusy(true);
    setPlayerAuthError(null);
    try {
      const result = await registerPlayerApi(username, password, email);
      const session: PlayerSession = { id: result.player.id, username: result.player.username, token: result.token };
      setPlayerSession(session);
      await savePlayerSession(deviceStore, session);
      discardCharadesNotFor(session.id);
      track({ name: 'player_account_created' });
      getWalletBalance(session.token)
        .then((w) => {
          setWalletBalance(w.balance);
          setFreeGameCredits(w.freeGameCredits);
        })
        .catch(() => undefined);
      return true;
    } catch (err) {
      setPlayerAuthError(err instanceof PlayerAuthError ? err.message : 'could not reach the server');
      return false;
    } finally {
      setPlayerAuthBusy(false);
    }
  }, [discardCharadesNotFor]);

  const loginPlayerAccount = useCallback(async (username: string, password: string) => {
    setPlayerAuthBusy(true);
    setPlayerAuthError(null);
    try {
      const result = await loginPlayerApi(username, password);
      const session: PlayerSession = { id: result.player.id, username: result.player.username, token: result.token };
      setPlayerSession(session);
      await savePlayerSession(deviceStore, session);
      discardCharadesNotFor(session.id);
      track({ name: 'player_logged_in' });
      getWalletBalance(session.token)
        .then((w) => {
          setWalletBalance(w.balance);
          setFreeGameCredits(w.freeGameCredits);
        })
        .catch(() => undefined);
      return true;
    } catch (err) {
      setPlayerAuthError(err instanceof PlayerAuthError ? err.message : 'could not reach the server');
      return false;
    } finally {
      setPlayerAuthBusy(false);
    }
  }, [discardCharadesNotFor]);

  const logoutPlayerAccount = useCallback(() => {
    setPlayerSession(null);
    setPlayerAuthError(null);
    setWalletBalance(0);
    setFreeGameCredits(0);
    setWalletError(null);
    void clearPlayerSession(deviceStore);
    // Logging out always ends whatever game was in progress — even an
    // unclaimed guest draft, which charadesForPlayer would otherwise treat
    // as fair game for the next guest on this device. A clean break on
    // logout is simpler and less surprising than resuming a stranger's
    // half-set-up game.
    setCharadesState(null);
    void clearCharades(deviceStore);
    track({ name: 'player_logout' });
  }, []);

  const requestPasswordReset = useCallback(async (username: string) => {
    setPlayerAuthBusy(true);
    setPlayerAuthError(null);
    try {
      await requestPasswordResetApi(username);
      return true;
    } catch (err) {
      setPlayerAuthError(err instanceof PlayerAuthError ? err.message : 'could not reach the server');
      return false;
    } finally {
      setPlayerAuthBusy(false);
    }
  }, []);

  const confirmPasswordReset = useCallback(async (username: string, code: string, newPassword: string) => {
    setPlayerAuthBusy(true);
    setPlayerAuthError(null);
    try {
      await confirmPasswordResetApi(username, code, newPassword);
      return true;
    } catch (err) {
      setPlayerAuthError(err instanceof PlayerAuthError ? err.message : 'could not reach the server');
      return false;
    } finally {
      setPlayerAuthBusy(false);
    }
  }, []);

  const value: AppValue = {
    ready,
    lang,
    t,
    prefs,
    setPrefs,
    wipeEverything,
    gamePriceFils,
    modifiedGamePriceFils,
    homeContent,
    charades,
    startCharadesDraft,
    updateCharades,
    unlockCurrentCharades,
    quitCharades,
    mintRevealToken,
    walletBalance,
    freeGameCredits,
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
    requestPasswordReset,
    confirmPasswordReset,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
