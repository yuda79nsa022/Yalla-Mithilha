import { Redirect, router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Screen, Spacer, T } from '../../src/ui/components';
import { colors, radius, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { leaders, standings, topPerformerId } from '../../src/engine/scoring';
import { performerName } from '../../src/engine/engine';
import { formatNumber } from '../../src/i18n';

const TEAM_COLORS = [colors.teamA, colors.teamB, colors.gold, colors.lips, colors.imitate];

export default function Winner() {
  const { t, lang, session, playAgain, quitSession } = useApp();
  if (!session) return <Redirect href="/home" />;

  const table = standings(session.scores, session.setup.teams);
  const top = leaders(session.scores, session.setup.teams);
  const bestPerformer = topPerformerId(session.results);

  const nameOf = (teamId: string) => {
    const team = session.setup.teams.find((tm) => tm.id === teamId);
    if (!team) return '';
    return team.name.startsWith('team.') ? t(team.name as never) : team.name;
  };

  const again = () => {
    if (playAgain()) router.replace('/game/pass');
  };

  const home = () => {
    quitSession();
    router.replace('/home');
  };

  return (
    <Screen scroll>
      <Spacer size={spacing.xl} />
      <View style={styles.band}>
        {Array.from({ length: 9 }, (_, i) => (
          <View
            key={i}
            style={[styles.chevron, { backgroundColor: i % 2 ? colors.gold : colors.correct }]}
          />
        ))}
      </View>

      <T variant="label" color={colors.textMuted}>
        {t('winner.title')}
      </T>
      <T variant="display" color={colors.gold}>
        {top.length === 1 ? nameOf(top[0]) : top.map(nameOf).join(' + ')}
      </T>

      {bestPerformer ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="body" color={colors.textMuted}>
            {t('winner.topPerformer', { name: performerName(session, bestPerformer) })}
          </T>
        </>
      ) : null}

      <Spacer />
      <View style={{ gap: spacing.sm }}>
        {table.map((row, i) => (
          <View key={row.teamId} style={styles.row}>
            <T variant="heading" color={TEAM_COLORS[i % TEAM_COLORS.length]}>
              {formatNumber(lang, row.rank)}
            </T>
            <T variant="heading" style={{ flex: 1 }}>
              {nameOf(row.teamId)}
            </T>
            <T variant="heading">{formatNumber(lang, row.points)}</T>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <Spacer />
      <Button label={t('winner.rematch')} accent={colors.correct} onPress={again} />
      <Spacer size={spacing.sm} />
      <Button
        label={t('winner.newGame')}
        tone="secondary"
        onPress={() => {
          quitSession();
          router.replace('/rooms');
        }}
      />
      <Spacer size={spacing.sm} />
      <Button label={t('winner.home')} tone="ghost" onPress={home} />
      <Spacer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  chevron: { width: 14, height: 14, transform: [{ rotate: '45deg' }], borderRadius: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgRaised,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
