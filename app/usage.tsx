import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Divider, Screen, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { formatKwd, type UsageReport } from '../src/services/walletApi';

const STATUS_KEY = {
  paid: 'usage.statusPaid',
  initiated: 'usage.statusInitiated',
  failed: 'usage.statusFailed',
  cancelled: 'usage.statusCancelled',
} as const;

export default function Usage() {
  const { t, lang, player, loadUsage } = useApp();
  const [report, setReport] = useState<UsageReport | null>(null);
  const [failed, setFailed] = useState(false);
  const signedIn = Boolean(player);

  useEffect(() => {
    if (!signedIn) {
      router.replace('/account');
      return;
    }
    let live = true;
    setFailed(false);
    loadUsage()
      .then((r) => live && setReport(r))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [signedIn, loadUsage]);

  if (!player) return null;

  const when = (ts: number) => new Date(ts).toLocaleString(lang === 'ar' ? 'ar-KW' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const modeName = (mode: 'classic' | 'modified') => t(mode === 'classic' ? 'charades.draft.modeClassic' : 'charades.draft.modeModified');

  return (
    <Screen scroll header={{}}>
      <T variant="title">{t('usage.title')}</T>
      {failed ? (
        <T variant="label" color={colors.red}>
          {t('usage.error')}
        </T>
      ) : report === null ? (
        <T variant="label" color={colors.neutral700}>
          {t('usage.loading')}
        </T>
      ) : (
        <>
          <View style={styles.totals}>
            <Stat label={t('usage.gamesPlayed')} value={String(report.totals.gamesPlayed)} />
            <Stat label={t('usage.gamesBought')} value={String(report.totals.gamesBought)} />
            <Stat label={t('usage.spent')} value={formatKwd(report.totals.spentFils)} />
          </View>
          <Divider />
          <T variant="heading" style={{ fontSize: 18 }}>
            {t('usage.gamesHeading')}
          </T>
          {report.games.length === 0 ? (
            <T variant="label" color={colors.neutral700}>
              {t('usage.noGames')}
            </T>
          ) : (
            report.games.map((g) => (
              <View key={g.id} style={styles.row}>
                <T variant="label" style={{ fontSize: 14 }}>
                  {modeName(g.mode)}
                </T>
                <T variant="label" color={colors.neutral700} style={{ fontSize: 13 }}>
                  {when(g.createdAt)}
                </T>
              </View>
            ))
          )}
          <Divider />
          <T variant="heading" style={{ fontSize: 18 }}>
            {t('usage.paymentsHeading')}
          </T>
          {report.payments.length === 0 ? (
            <T variant="label" color={colors.neutral700}>
              {t('usage.noPayments')}
            </T>
          ) : (
            report.payments.map((p) => (
              <View key={p.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <T variant="label" style={{ fontSize: 14 }}>
                    {t('usage.paymentLine', { credits: p.credits, amount: formatKwd(p.amountFils) })}
                  </T>
                  <T variant="label" color={colors.neutral700} style={{ fontSize: 13 }}>
                    {when(p.createdAt)}
                  </T>
                </View>
                <T variant="label" color={p.status === 'paid' ? colors.green : colors.neutral700} style={{ fontSize: 13 }}>
                  {t(STATUS_KEY[p.status])}
                </T>
              </View>
            ))
          )}
          <Button label={t('nav.buyMore')} tone="secondary" onPress={() => router.push('/buy')} />
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <T variant="label" color={colors.neutral700} style={{ fontSize: 12 }} numberOfLines={2}>
        {label}
      </T>
      <T variant="heading" style={{ fontSize: 20 }} numberOfLines={1}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white, padding: 10, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
});
