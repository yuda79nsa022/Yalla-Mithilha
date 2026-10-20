import { Redirect, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Divider, Screen, Spacer, T } from '../../src/ui/components';
import { Hero } from '../../src/ui/Hero';
import { colors, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { goBack } from '../../src/platform/navigation';
import { useTopUp } from '../../src/state/useTopUp';
import { formatKwd } from '../../src/services/walletApi';

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
    unlockCurrentCharades,
  } = useApp();
  const [starting, setStarting] = useState(false);
  const { busy: toppingUp, notice: paymentNotice, topUp: topUpFor, simulateFailure: simulateFailureFor, returnedPaymentId, returnedResult } =
    useTopUp();

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

  // A payment started from the Buy-more screen also comes back through
  // here (the gateway's return route only knows this one address) — with no
  // game being set up, its result belongs on that screen instead.
  if (!charades && (returnedPaymentId || returnedResult)) {
    const query = returnedPaymentId
      ? `payment=${encodeURIComponent(returnedPaymentId)}&result=${encodeURIComponent(returnedResult ?? '')}`
      : `result=${encodeURIComponent(returnedResult ?? '')}`;
    return <Redirect href={`/buy?${query}`} />;
  }
  if (!charades) return <Redirect href="/charades/draft" />;
  if (charades.lock === 'unlocked') return <Redirect href="/charades/play" />;
  if (!player) return null;

  const mode = charades.mode;
  const priceFils = mode === 'classic' ? gamePriceFils : modifiedGamePriceFils;
  const hasFreeGame = freeGameCredits > 0;
  const canStart = hasFreeGame || walletBalance >= 1;

  const topUp = () => topUpFor(mode);
  const simulateFailure = () => simulateFailureFor(mode);

  const start = async () => {
    setStarting(true);
    const unlocked = await unlockCurrentCharades();
    setStarting(false);
    if (unlocked) router.push('/charades/play');
  };

  return (
    <Screen
      scroll
      header={{ onBack: () => goBack('/charades/draft') }}
      footer={<Button label={t('charades.checkout.start')} disabled={!canStart} busy={starting} onPress={start} />}
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
        busy={toppingUp || walletBusy}
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
