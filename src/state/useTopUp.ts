import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import type { GameMode } from '../engine/game';
import type { PaymentStatus } from '../services/walletApi';
import { useApp } from './AppProvider';

export type PaymentNotice = 'paid' | 'pending' | 'failed' | 'error';

function noticeFor(status: PaymentStatus | null): PaymentNotice {
  return status === 'paid' ? 'paid' : status === 'initiated' ? 'pending' : status ? 'failed' : 'error';
}

/** Just the browser APIs this needs — the project doesn't assume the DOM typings. */
interface PopupWindow {
  closed: boolean;
  close: () => void;
  location: { href: string };
  document?: { title: string; body?: { innerHTML: string } | null };
}
interface BrowserGlobal {
  open?: (url: string, name: string, features: string) => PopupWindow | null;
  location?: { href: string; origin: string };
  localStorage?: { setItem: (k: string, v: string) => void; removeItem: (k: string) => void };
  addEventListener?: (type: 'message', fn: (e: { origin: string; data: unknown }) => void) => void;
  removeEventListener?: (type: 'message', fn: (e: { origin: string; data: unknown }) => void) => void;
  BroadcastChannel?: new (name: string) => { onmessage: ((e: { data: unknown }) => void) | null; close: () => void };
  screenX?: number;
  screenY?: number;
  outerWidth?: number;
  outerHeight?: number;
}
const browser = globalThis as BrowserGlobal;

const POPUP_NAME = 'myfatoorah-checkout';
/**
 * Set while a payment popup is open, so the gateway's "done" page (served by
 * the server at /charades/checkout/myfatoorah/done) knows it is running in a
 * popup even if the browser cut its link back to this window. A timestamp,
 * so one left behind by a closed tab goes stale on its own.
 */
const POPUP_FLAG = 'myfatoorahPopup';
/** How often the server is asked about a payment while its popup is open. */
const POLL_MS = 10_000;

function setPopupFlag(on: boolean) {
  try {
    if (on) browser.localStorage?.setItem(POPUP_FLAG, String(Date.now()));
    else browser.localStorage?.removeItem(POPUP_FLAG);
  } catch {
    // storage blocked — the done page still has window.opener
  }
}

/**
 * Opens the (still empty) payment window. Must run synchronously inside the
 * tap's handler — before any `await` — or the browser treats it as an
 * unrequested popup and blocks it. `null` when it was blocked anyway.
 */
function openPaymentPopup(): PopupWindow | null {
  if (Platform.OS !== 'web' || typeof browser.open !== 'function') return null;
  const w = 520;
  const h = 760;
  const left = Math.max(0, Math.round((browser.screenX ?? 0) + ((browser.outerWidth ?? w) - w) / 2));
  const top = Math.max(0, Math.round((browser.screenY ?? 0) + ((browser.outerHeight ?? h) - h) / 2));
  const popup = browser.open('', POPUP_NAME, `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
  if (!popup) return null;
  try {
    if (popup.document) {
      popup.document.title = 'MyFatoorah';
      if (popup.document.body) {
        popup.document.body.innerHTML =
          '<p style="font-family:system-ui,sans-serif;text-align:center;margin-top:40vh;color:#201E1D">MyFatoorah…</p>';
      }
    }
  } catch {
    // cosmetic only
  }
  return popup;
}

function isResultMessage(data: unknown): data is { type: 'myfatoorah-result'; payment: string | null } {
  return Boolean(data) && typeof data === 'object' && (data as { type?: unknown }).type === 'myfatoorah-result';
}

/**
 * Buying one game's worth of credit, shared by checkout and the Buy-more
 * screen. On web the gateway's (MyFatoorah's) page opens in a popup over the
 * game; the popup reports back when it's done (see the server's done page),
 * and this window also asks the server now and then while it's open. If the
 * browser blocks the popup, the whole tab goes to the gateway instead and
 * comes back through the return route. Native opens the device browser and
 * checks on returning to the app. Nothing here ever decides a payment
 * succeeded — the server asks the gateway — and `onPaid` only runs once the
 * server says "paid".
 */
export function useTopUp({ onPaid }: { onPaid?: () => void } = {}) {
  const { player, startTopUp, checkTopUp, confirmTopUp, failTopUp } = useApp();
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [notice, setNotice] = useState<PaymentNotice | null>(null);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  // The payment currently out at the gateway, and its popup.
  const open = useRef<{ paymentId: string; popup: PopupWindow | null; timer: ReturnType<typeof setInterval> | null } | null>(null);
  // The last payment this screen started — still listened for after it
  // stopped polling, since a browser that cut the popup's link back here
  // reports it closed while the player is in fact still paying.
  const lastPayment = useRef<string | null>(null);
  // Payments whose final answer was already acted on: `onPaid` runs once per
  // payment, never again on a re-render, a session refresh or a late message
  // (a second run would re-deal a game already in progress).
  const settled = useRef(new Set<string>());

  // The popup flag is left alone here: it's cleared once the payment is
  // settled, or goes stale on its own — a popup still open after the player
  // stopped waiting must still close itself rather than load the app.
  const stopWatching = useCallback((closePopup: boolean) => {
    const current = open.current;
    open.current = null;
    if (current?.timer) clearInterval(current.timer);
    if (closePopup && current?.popup && !current.popup.closed) current.popup.close();
    setWaiting(false);
    setBusy(false);
  }, []);

  /** Asks the server; true once the payment is settled one way or the other. */
  const settle = useCallback(
    async (paymentId: string): Promise<boolean> => {
      if (settled.current.has(paymentId)) return true;
      const status = await checkTopUp(paymentId);
      if (status === 'paid' || status === 'failed' || status === 'cancelled') {
        if (settled.current.has(paymentId)) return true; // another check got here first
        settled.current.add(paymentId);
        if (open.current?.paymentId === paymentId) stopWatching(true);
        if (lastPayment.current === paymentId) setPopupFlag(false);
        setNotice(noticeFor(status));
        if (status === 'paid') onPaidRef.current?.();
        return true;
      }
      return false;
    },
    [checkTopUp, stopWatching]
  );

  // Back from the gateway in this same tab (the popup was blocked): the
  // server's return route sends the browser here with `?payment=…&result=…`.
  // The result in the URL is only a hint — the payment is always re-checked
  // with the server before saying anything to the player.
  const { payment: returnedPaymentId, result: returnedResult } = useLocalSearchParams<{
    payment?: string;
    result?: string;
  }>();
  useEffect(() => {
    if (!player) return;
    if (returnedPaymentId) {
      void settle(returnedPaymentId).then((done) => {
        if (!done) setNotice('pending');
      });
    } else if (returnedResult === 'error') {
      setNotice('error');
    }
  }, [player, returnedPaymentId, returnedResult, settle]);

  // The popup's done page reports here — by postMessage while it still has
  // its link to this window, and by BroadcastChannel in case the browser cut
  // it on the way through the gateway. Either is only a nudge to ask the server.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onResult = (data: unknown) => {
      const paymentId = lastPayment.current;
      if (!paymentId || !isResultMessage(data)) return;
      if (data.payment && data.payment !== paymentId) return;
      void settle(paymentId).then((done) => {
        if (!done && open.current?.paymentId === paymentId) {
          stopWatching(true);
          setNotice('pending');
        }
      });
    };
    const onMessage = (e: { origin: string; data: unknown }) => {
      if (e.origin === browser.location?.origin) onResult(e.data);
    };
    browser.addEventListener?.('message', onMessage);
    let channel: { onmessage: ((e: { data: unknown }) => void) | null; close: () => void } | null = null;
    try {
      if (browser.BroadcastChannel) {
        channel = new browser.BroadcastChannel('myfatoorah');
        channel.onmessage = (e) => onResult(e.data);
      }
    } catch {
      channel = null;
    }
    return () => {
      browser.removeEventListener?.('message', onMessage);
      channel?.close();
    };
  }, [settle, stopWatching]);

  // Leaving the screen mid-payment: stop asking, but leave the popup alone —
  // the player may still be paying, and the credit lands either way.
  useEffect(() => () => {
    const current = open.current;
    if (current?.timer) clearInterval(current.timer);
    open.current = null;
  }, []);

  // Native apps open the gateway's page in the device browser, which never
  // comes back through the return route into the app — so check the payment
  // when the player switches back to the app instead.
  const pendingNativePayment = useRef<string | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const paymentId = pendingNativePayment.current;
      if (state !== 'active' || !paymentId) return;
      void settle(paymentId).then((done) => {
        if (done) pendingNativePayment.current = null;
        else setNotice('pending');
      });
    });
    return () => sub.remove();
  }, [settle]);

  const topUp = useCallback(
    async (mode: GameMode) => {
      // Before anything async — see openPaymentPopup.
      const popup = openPaymentPopup();
      setBusy(true);
      setNotice(null);
      const payment = await startTopUp(mode);
      if (!payment) {
        popup?.close();
        setBusy(false);
        return;
      }
      if (!payment.redirectUrl) {
        // The development mock: no gateway page at all.
        popup?.close();
        if (await confirmTopUp(payment.id)) {
          settled.current.add(payment.id);
          setNotice('paid');
          onPaidRef.current?.();
        }
        setBusy(false);
        return;
      }
      if (Platform.OS !== 'web') {
        pendingNativePayment.current = payment.id;
        void Linking.openURL(payment.redirectUrl);
        setBusy(false);
        return;
      }
      if (!popup) {
        // Popups blocked: this tab goes to the gateway and comes back through
        // the return route. Leaving the page — keep the button busy.
        setPopupFlag(false);
        if (browser.location) browser.location.href = payment.redirectUrl;
        return;
      }

      lastPayment.current = payment.id;
      setPopupFlag(true);
      popup.location.href = payment.redirectUrl;
      setWaiting(true);
      let closedChecks = 0;
      const timer = setInterval(() => {
        const current = open.current;
        if (!current || current.paymentId !== payment.id) return;
        void settle(payment.id).then((done) => {
          if (done || open.current?.paymentId !== payment.id) return;
          // Closed without finishing: one more look, then it wasn't completed.
          if (popup.closed && ++closedChecks >= 2) {
            stopWatching(false);
            setNotice('pending');
          }
        });
      }, POLL_MS);
      open.current = { paymentId: payment.id, popup, timer };
    },
    [startTopUp, confirmTopUp, settle, stopWatching]
  );

  /** The player gave up on the open payment window. A payment they did finish still lands in their wallet. */
  const cancelWaiting = useCallback(() => {
    const current = open.current;
    stopWatching(true);
    setNotice('pending');
    if (current) void settle(current.paymentId);
  }, [settle, stopWatching]);

  const simulateFailure = useCallback(
    async (mode: GameMode) => {
      setBusy(true);
      const payment = await startTopUp(mode);
      if (payment) {
        await failTopUp(payment.id);
        setNotice('failed');
      }
      setBusy(false);
    },
    [startTopUp, failTopUp]
  );

  return { busy, waiting, notice, topUp, cancelWaiting, simulateFailure, returnedPaymentId, returnedResult };
}
