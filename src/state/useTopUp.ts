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

/**
 * Buying one game's worth of credit, shared by checkout and the Buy-more
 * screen: starts the payment, sends the player to the gateway's
 * (MyFatoorah's) page, and checks the result when they come back. Nothing
 * here ever decides a payment succeeded — the server asks the gateway.
 */
export function useTopUp() {
  const { player, startTopUp, checkTopUp, confirmTopUp, failTopUp } = useApp();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<PaymentNotice | null>(null);

  // Back from the payment gateway's page: the server's return route sends
  // the browser here with `?payment=…&result=…`. The result in the URL is
  // only a hint — the payment is always re-checked with the server (which
  // asks the gateway itself) before saying anything to the player.
  const { payment: returnedPaymentId, result: returnedResult } = useLocalSearchParams<{
    payment?: string;
    result?: string;
  }>();
  useEffect(() => {
    if (!player) return;
    if (returnedPaymentId) {
      void checkTopUp(returnedPaymentId).then((status) => setNotice(noticeFor(status)));
    } else if (returnedResult === 'error') {
      setNotice('error');
    }
  }, [player, returnedPaymentId, returnedResult, checkTopUp]);

  // Native apps open the gateway's page in the device browser, which never
  // comes back through the return route into the app — so check the payment
  // when the player switches back to the app instead.
  const pendingNativePayment = useRef<string | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const paymentId = pendingNativePayment.current;
      if (state !== 'active' || !paymentId) return;
      void checkTopUp(paymentId).then((status) => {
        if (status === 'paid' || status === 'failed' || status === 'cancelled') pendingNativePayment.current = null;
        setNotice(noticeFor(status));
      });
    });
    return () => sub.remove();
  }, [checkTopUp]);

  const topUp = useCallback(
    async (mode: GameMode) => {
      setBusy(true);
      setNotice(null);
      const payment = await startTopUp(mode);
      if (payment?.redirectUrl) {
        // A real gateway: the player pays on its page. On web this tab goes
        // there and comes back through the return route; native opens the
        // device browser and checks the payment on returning to the app.
        if (Platform.OS === 'web') {
          const g = globalThis as { location?: { href?: string } };
          if (g.location) g.location.href = payment.redirectUrl;
          return; // leaving the page — keep the button busy
        }
        pendingNativePayment.current = payment.id;
        void Linking.openURL(payment.redirectUrl);
      } else if (payment) {
        await confirmTopUp(payment.id); // development mock
      }
      setBusy(false);
    },
    [startTopUp, confirmTopUp]
  );

  const simulateFailure = useCallback(
    async (mode: GameMode) => {
      setBusy(true);
      const payment = await startTopUp(mode);
      if (payment) await failTopUp(payment.id);
      setBusy(false);
    },
    [startTopUp, failTopUp]
  );

  return { busy, notice, topUp, simulateFailure, returnedPaymentId, returnedResult };
}
