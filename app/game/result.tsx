import { Redirect, router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Divider, Screen, Spacer, T } from '../../src/ui/components';
import { colors, miniGameColor, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { advance, teamById } from '../../src/engine/engine';
import { formatNumber } from '../../src/i18n';
import { ALL_PROMPTS } from '../../src/content';

export default function Result() {
  const { t, lang, session, updateSession, finishSession } = useApp();
  if (!session) return <Redirect href="/home" />;

  const last = session.results[session.results.length - 1];
  if (!last) return <Redirect href="/game/pass" />;

  const accent = miniGameColor(last.game);
  const team = teamById(session, last.teamId);
  const teamName = team
    ? team.name.startsWith('team.')
      ? t(team.name as never)
      : team.name
    : '';
  const byId = new Map(ALL_PROMPTS.map((p) => [p.id, p]));

  const next = () => {
    const advanced = advance(session);
    updateSession(advanced);
    if (advanced.phase === 'finished') {
      finishSession(advanced);
      router.replace('/game/winner');
    } else {
      router.replace(advanced.phase === 'pass' ? '/game/pass' : '/game/brief');
    }
  };

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="label" color={accent}>
        {t(`game.${last.game}` as never)}
      </T>
      <T variant="title">{t('result.title')}</T>
      <Spacer size={spacing.sm} />
      <T variant="display" color={accent}>
        {t('result.points', { count: formatNumber(lang, last.points), team: teamName })}
      </T>

      <Spacer />
      <Divider />
      <View style={{ gap: spacing.sm }}>
        {last.cards.map((cardResult, i) => {
          const prompt = byId.get(cardResult.promptId);
          const correct = cardResult.outcome === 'correct';
          return (
            <View key={`${cardResult.promptId}-${i}`} style={styles.row}>
              {/* A mark plus a colour: the outcome never depends on hue alone. */}
              <T variant="heading" color={correct ? colors.correct : colors.textMuted}>
                {correct ? '✓' : '–'}
              </T>
              <T variant="body" style={{ flex: 1 }} numberOfLines={2}>
                {prompt ? (lang === 'ar' ? prompt.ar : prompt.en) : cardResult.promptId}
              </T>
            </View>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />
      <Spacer />
      <Button label={t('result.continue')} accent={accent} onPress={next} />
      <Spacer size={spacing.sm} />
      <Button
        label={t('result.scoreboard')}
        tone="secondary"
        onPress={() => router.push('/game/scoreboard')}
      />
      <Spacer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
