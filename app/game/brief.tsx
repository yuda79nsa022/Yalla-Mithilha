import { Redirect, router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Pill, RoundProgress, Screen, Spacer, T } from '../../src/ui/components';
import { colors, miniGameColor, onAccent, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { currentPlan, performerName, progress } from '../../src/engine/engine';
import { MINI_GAMES } from '../../src/engine/config';
import { formatNumber } from '../../src/i18n';

/** Says which mini-game is coming, its one rule, and who is performing. */
export default function Brief() {
  const { t, session, lang } = useApp();
  if (!session) return <Redirect href="/home" />;

  const plan = currentPlan(session);
  if (!plan) return <Redirect href="/game/winner" />;

  const accent = miniGameColor(plan.game);
  const config = MINI_GAMES[plan.game];
  const { round, total } = progress(session);

  return (
    <Screen>
      <RoundProgress round={round} total={total} />
      <T variant="label" color={colors.textMuted}>
        {t('brief.round', {
          round: formatNumber(lang, round),
          total: formatNumber(lang, total),
        })}
      </T>

      <View style={styles.center}>
        <View style={[styles.tag, { backgroundColor: accent }]}>
          <T variant="title" color={onAccent} align="center">
            {t(`game.${plan.game}` as never)}
          </T>
        </View>
        <Spacer size={spacing.lg} />
        <T variant="heading" align="center">
          {t(`game.${plan.game}.rule` as never)}
        </T>
        <Spacer size={spacing.lg} />
        <T variant="body" color={colors.textMuted} align="center">
          {t('brief.performer', { name: performerName(session, plan.performerId) })}
        </T>
        <Spacer size={spacing.sm} />
        <View style={styles.pills}>
          <Pill
            text={`${formatNumber(lang, config.roundSeconds)} ${t('common.seconds')}`}
            color={accent}
          />
          {config.skipLimit !== null ? (
            <Pill
              text={t('round.skipsLeft', { count: formatNumber(lang, config.skipLimit) })}
              color={colors.textMuted}
            />
          ) : null}
          {plan.isFinal ? <Pill text={t('brief.finalRound')} color={colors.accent} /> : null}
          {plan.isSuddenDeath ? (
            <Pill text={t('winner.suddenDeath')} color={colors.skip} />
          ) : null}
        </View>
      </View>

      <Button
        label={t('brief.start')}
        accent={accent}
        onPress={() => router.replace('/game/round')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tag: { borderRadius: 24, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  pills: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
});
