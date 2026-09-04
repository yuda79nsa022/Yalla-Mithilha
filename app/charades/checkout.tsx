import { Redirect, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Divider, Screen, Spacer, T } from '../../src/ui/components';
import { colors, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';

function formatKwd(fils: number): string {
  return `${(fils / 1000).toFixed(3)} KD`;
}

export default function CharadesCheckout() {
  const {
    t,
    charades,
    player,
    gamePriceFils,
    walletBalance,
    walletBusy,
    walletError,
    refreshWallet,
    startTopUp,
    confirmTopUp,
    failTopUp,
    unlockCurrentCharades,
  } = useApp();
  const [busy, setBusy] = useState<'topup' | 'start' | null>(null);

  useEffect(() => {
    if (player) void refreshWallet();
  }, [player, refreshWallet]);

  if (!charades) return <Redirect href="/charades/draft" />;
  if (charades.lock === 'unlocked') return <Redirect href="/charades/play" />;

  const topUp = async () => {
    setBusy('topup');
    const payment = await startTopUp();
    if (payment) await confirmTopUp(payment.id);
    setBusy(null);
  };

  const simulateFailure = async () => {
    setBusy('topup');
    const payment = await startTopUp();
    if (payment) await failTopUp(payment.id);
    setBusy(null);
  };

  const start = async () => {
    setBusy('start');
    const unlocked = await unlockCurrentCharades();
    setBusy(null);
    if (unlocked) router.push('/charades/play');
  };

  if (!player) {
    return (
      <Screen scroll>
        <Spacer size={spacing.md} />
        <T variant="title">{t('charades.checkout.signInTitle')}</T>
        <T variant="body" color={colors.textMuted}>
          {t('charades.checkout.signInBody')}
        </T>
        <Spacer size={spacing.xl} />
        <Button label={t('charades.checkout.signInButton')} onPress={() => router.push('/account')} />
        <Spacer size={spacing.sm} />
        <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('charades.checkout.title')}</T>
      <T variant="body" color={colors.textMuted}>
        {t('charades.checkout.subtitle')}
      </T>
      <Spacer size={spacing.xl} />

      <View style={styles.card}>
        <T variant="heading" color={colors.accent}>
          {t('charades.checkout.walletBalance', { count: walletBalance })}
        </T>
      </View>

      <Spacer />
      <Button
        label={t('charades.checkout.price', { price: formatKwd(gamePriceFils) })}
        tone="secondary"
        busy={busy === 'topup' || walletBusy}
        onPress={topUp}
      />

      {walletError ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.skip}>
            {walletError}
          </T>
        </>
      ) : null}

      <Spacer size={spacing.sm} />
      <T variant="label" color={colors.textMuted}>
        {t('charades.checkout.devNotice')}
      </T>
      <Spacer size={spacing.xs} />
      <Button label={t('charades.checkout.simulateFailure')} tone="ghost" onPress={simulateFailure} />

      <Spacer size={spacing.xl} />
      <Divider />
      <Spacer />
      <Button
        label={t('charades.checkout.start')}
        disabled={walletBalance < 1}
        busy={busy === 'start'}
        onPress={start}
      />
      <Spacer size={spacing.sm} />
      <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = {
  card: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: colors.bgRaised,
    alignItems: 'center' as const,
  },
};
