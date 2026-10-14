import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import { Button, Divider, Screen, Spacer, T } from '../../src/ui/components';
import { Hero } from '../../src/ui/Hero';
import { colors, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { goBack } from '../../src/platform/navigation';

function formatKwd(fils: number): string {
  return `${(fils / 1000).toFixed(3)} KD`;
}

export default function CharadesCheckout() {
  const {
    t,
    charades,
    player,
    gamePriceFils,
    modifiedGamePriceFils,
    walletBalance,
    freeGameCredits,
    walletBusy,
    walletError,
    refreshWallet,
    startTopUp,
    checkTopUp,
    confirmTopUp,
    failTopUp,
    unlockCurrentCharades,
  } = useApp();
  const [busy, setBusy] = useState<'topup' | 'start' | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<'paid' | 'pending' | 'failed' | 'error' | null>(null);

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
      void checkTopUp(returnedPaymentId).then((status) =>
        setPaymentNotice(status === 'paid' ? 'paid' : status === 'initiated' ? 'pending' : status ? 'failed' : 'error')
      );
    } else if (returnedResult === 'error') {
      setPaymentNotice('error');
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
        setPaymentNotice(status === 'paid' ? 'paid' : status === 'initiated' ? 'pending' : status ? 'failed' : 'error');
      });
    });
    return () => sub.remove();
  }, [checkTopUp]);

  useEffect(() => {
    if (player) void refreshWallet();
  }, [player, refreshWallet]);

  // A guest lands here with nothing to configure — skip straight to sign-in
  // instead of showing an explanatory stop first. `useFocusEffect` (not a
  // plain `useEffect`) is required: React Navigation keeps this screen
  // mounted after navigating away from it, so a plain effect's unchanged
  // dependencies would never refire if the guest hit "back" from the account
  // screen without signing in — leaving a blank screen stuck in the stack.
  // `replace` (not `push`) drops checkout from the stack entirely, so that
  // "back" is exactly the screen that led here (draft or home), not another
  // visit to this same dead end.
  useFocusEffect(
    useCallback(() => {
      if (charades && charades.lock !== 'unlocked' && !player) router.replace('/account');
    }, [charades, player])
  );

  if (!charades) return <Redirect href="/charades/draft" />;
  if (charades.lock === 'unlocked') return <Redirect href="/charades/play" />;
  if (!player) return null;

  const mode = charades.mode;
  const priceFils = mode === 'classic' ? gamePriceFils : modifiedGamePriceFils;
  const hasFreeGame = freeGameCredits > 0;
  const canStart = hasFreeGame || walletBalance >= 1;

  const topUp = async () => {
    setBusy('topup');
    setPaymentNotice(null);
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
    setBusy(null);
  };

  const simulateFailure = async () => {
    setBusy('topup');
    const payment = await startTopUp(mode);
    if (payment) await failTopUp(payment.id);
    setBusy(null);
  };

  const start = async () => {
    setBusy('start');
    const unlocked = await unlockCurrentCharades();
    setBusy(null);
    if (unlocked) router.push('/charades/play');
  };

  return (
    <Screen
      scroll
      header={{ onBack: () => goBack('/charades/draft') }}
      footer={<Button label={t('charades.checkout.start')} disabled={!canStart} busy={busy === 'start'} onPress={start} />}
    >
      <Spacer size={spacing.md} />
      <Hero />
      <Spacer size={spacing.md} />
      <Divider />
      <Spacer size={spacing.md} />
      <T variant="title" style={{ fontSize: 30 }}>
        {t('charades.checkout.title')}
      </T>
      <T variant="body" color={colors.neutral700} style={{ fontSize: 13, fontWeight: '500' }}>
        {t('charades.checkout.subtitle')}
      </T>
      <Spacer size={spacing.xl} />

      <View style={styles.card}>
        <T variant="heading" color={colors.white}>
          {t('charades.checkout.walletBalance', { count: walletBalance })}
        </T>
      </View>

      {hasFreeGame ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.purple}>
            {t('charades.checkout.freeGamesLeft', { count: freeGameCredits })}
          </T>
        </>
      ) : null}

      <Spacer />
      <Button
        label={t('charades.checkout.price', { price: formatKwd(priceFils) })}
        tone="secondary"
        busy={busy === 'topup' || walletBusy}
        onPress={topUp}
      />

      {paymentNotice ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={paymentNotice === 'paid' ? colors.purple : colors.red}>
            {t(
              paymentNotice === 'paid'
                ? 'charades.checkout.paymentReceived'
                : paymentNotice === 'pending'
                  ? 'charades.checkout.paymentNotCompleted'
                  : paymentNotice === 'failed'
                    ? 'charades.checkout.paymentFailed'
                    : 'charades.checkout.paymentError'
            )}
          </T>
        </>
      ) : null}

      {walletError ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.red}>
            {walletError}
          </T>
        </>
      ) : null}

      {__DEV__ ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.neutral700}>
            {t('charades.checkout.devNotice')}
          </T>
          <Spacer size={spacing.xs} />
          <Button label={t('charades.checkout.simulateFailure')} tone="ghost" showArrow={false} onPress={simulateFailure} />
        </>
      ) : null}

      <Spacer size={spacing.xl} />
      <Divider />
    </Screen>
  );
}

const styles = {
  card: {
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.md,
    backgroundColor: colors.purple,
    alignItems: 'center' as const,
  },
};
