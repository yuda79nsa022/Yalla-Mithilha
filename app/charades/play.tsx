import { Redirect, router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, ConfirmModal, Screen, Spacer, T } from '../../src/ui/components';
import { colors, radius, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { awardRound, currentTeamIndex, isCharadesComplete, skipRound } from '../../src/engine/charades';
import { buildRevealUrl, resolveRevealBaseUrl } from '../../src/engine/reveal';
import { REVEAL_BASE_URL } from '../../src/config';

function webOrigin(): string | null {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as { location?: { origin?: string } };
  return g.location?.origin ?? null;
}

function ScoreChip({ name, score, color }: { name: string; score: number; color: string }) {
  return (
    <View style={[styles.scoreChip, { borderColor: color }]}>
      <T variant="label" numberOfLines={1}>
        {name}
      </T>
      <T variant="heading" color={color}>
        {score}
      </T>
    </View>
  );
}

export default function CharadesPlay() {
  useKeepAwake();
  const { t, charades, updateCharades, quitCharades } = useApp();
  const [confirmQuit, setConfirmQuit] = useState(false);

  if (!charades) return <Redirect href="/charades/draft" />;
  if (charades.lock !== 'unlocked') return <Redirect href="/charades/checkout" />;

  const complete = isCharadesComplete(charades);

  if (complete) {
    const [scoreA, scoreB] = charades.scores;
    const winner = scoreA === scoreB ? null : scoreA > scoreB ? charades.teamAName : charades.teamBName;
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
          <T variant="title" align="center">
            {t('charades.play.complete')}
          </T>
          <T variant="display" align="center" color={colors.accent}>
            {winner ? t('charades.play.winner', { team: winner }) : t('charades.play.tie')}
          </T>
          <Spacer />
          <View style={styles.scoreRow}>
            <ScoreChip name={charades.teamAName} score={scoreA} color={colors.teamA} />
            <ScoreChip name={charades.teamBName} score={scoreB} color={colors.teamB} />
          </View>
          <Spacer size={spacing.xl} />
          <Button
            label={t('charades.play.home')}
            onPress={() => {
              quitCharades();
              router.replace('/home');
            }}
          />
        </View>
      </Screen>
    );
  }

  const teamIndex = currentTeamIndex(charades);
  const teamName = teamIndex === 0 ? charades.teamAName : charades.teamBName;
  const teamColor = teamIndex === 0 ? colors.teamA : colors.teamB;
  const currentTitle = charades.titles[charades.index];

  const award = () => updateCharades(awardRound(charades, teamIndex));
  const skip = () => updateCharades(skipRound(charades));

  const baseUrl = resolveRevealBaseUrl(REVEAL_BASE_URL, webOrigin());
  const revealUrl = baseUrl ? buildRevealUrl(baseUrl, currentTitle.text) : null;

  return (
    <Screen>
      <Spacer size={spacing.sm} />
      <View style={styles.header}>
        <ScoreChip name={charades.teamAName} score={charades.scores[0]} color={colors.teamA} />
        <View style={{ alignItems: 'center' }}>
          <T variant="label" color={colors.textMuted}>
            {t('charades.play.round', { round: charades.index + 1, total: charades.titles.length })}
          </T>
          <T variant="heading" color={teamColor}>
            {t('charades.play.turn', { team: teamName })}
          </T>
        </View>
        <ScoreChip name={charades.teamBName} score={charades.scores[1]} color={colors.teamB} />
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <T variant="label" align="center" color={colors.textMuted}>
          {t('charades.play.scanInstruction', { team: teamName })}
        </T>
        <View style={[styles.card, { borderColor: teamColor }]}>
          {revealUrl ? (
            <QRCode value={revealUrl} size={200} />
          ) : (
            <T variant="label" align="center" color={colors.textMuted}>
              {t('charades.play.scanUnavailable')}
            </T>
          )}
        </View>

        <Button label={t('charades.play.award', { team: teamName })} accent={teamColor} onPress={award} />
        <Button label={t('charades.play.skip')} tone="ghost" onPress={skip} />
      </View>

      <Button label={t('charades.play.quit')} tone="danger" onPress={() => setConfirmQuit(true)} />

      <ConfirmModal
        visible={confirmQuit}
        title={t('charades.play.quitConfirm')}
        confirmLabel={t('charades.play.quit')}
        cancelLabel={t('common.back')}
        destructive
        onConfirm={() => {
          setConfirmQuit(false);
          quitCharades();
          router.replace('/home');
        }}
        onCancel={() => setConfirmQuit(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  scoreChip: {
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    minWidth: 90,
  },
  scoreRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  card: {
    borderWidth: 2,
    borderRadius: radius.lg,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bgRaised,
  },
});
