import { Redirect, router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, RoundProgress, Screen, Spacer, T } from '../../src/ui/components';
import { colors, spacing, radius } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { progress } from '../../src/engine/engine';
import { standings } from '../../src/engine/scoring';
import { formatNumber } from '../../src/i18n';

const TEAM_COLORS = [colors.teamA, colors.teamB, colors.gold, colors.lips, colors.imitate];

export default function Scoreboard() {
  const { t, lang, session } = useApp();
  if (!session) return <Redirect href="/home" />;

  const table = standings(session.scores, session.setup.teams);
  const { round, total } = progress(session);
  const best = table[0]?.points || 1;

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('scoreboard.title')}</T>
      <RoundProgress round={round} total={total} />
      <Spacer />

      <View style={{ gap: spacing.md }}>
        {table.map((row, i) => {
          const team = session.setup.teams.find((tm) => tm.id === row.teamId)!;
          const label = team.name.startsWith('team.') ? t(team.name as never) : team.name;
          const color = TEAM_COLORS[i % TEAM_COLORS.length];
          return (
            <View key={row.teamId}>
              <View style={styles.row}>
                <T variant="heading" style={{ flex: 1 }}>
                  {label}
                </T>
                <T variant="title" color={color}>
                  {formatNumber(lang, row.points)}
                </T>
              </View>
              {/* Bar length carries the same information as the number, for
                  anybody reading from across the room. */}
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { backgroundColor: color, width: `${Math.max(4, (row.points / best) * 100)}%` },
                  ]}
                />
              </View>
              <T variant="label" color={colors.textMuted}>
                {team.playerIds
                  .map((id) => session.setup.players.find((p) => p.id === id)?.name)
                  .filter(Boolean)
                  .join(' · ')}
              </T>
            </View>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />
      <Spacer />
      <Button label={t('scoreboard.continue')} onPress={() => router.back()} />
      <Spacer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: {
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSunken,
    overflow: 'hidden',
    marginVertical: spacing.xs,
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
