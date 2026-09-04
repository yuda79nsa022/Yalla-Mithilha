import { Redirect, router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Button, Screen, Spacer, T } from '../../src/ui/components';
import { colors, radius, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { awardRound, currentTeamIndex, isCharadesComplete, skipRound } from '../../src/engine/charades';

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
  const [revealed, setRevealed] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [charades?.index]);

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
          {t('charades.play.actorNotice')}
        </T>
        <View style={[styles.card, { borderColor: teamColor }]}>
          {revealed ? (
            <T variant="card" align="center">
              {currentTitle.text}
            </T>
          ) : (
            <Button label={t('charades.play.reveal')} accent={teamColor} onPress={() => setRevealed(true)} />
          )}
        </View>

        {revealed ? (
          <>
            <Button label={t('charades.play.award', { team: teamName })} accent={teamColor} onPress={award} />
            <Button label={t('charades.play.skip')} tone="ghost" onPress={skip} />
          </>
        ) : null}
      </View>

      <Button label={t('charades.play.quit')} tone="danger" onPress={() => setConfirmQuit(true)} />

      <Modal visible={confirmQuit} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <T variant="heading" align="center">
              {t('charades.play.quitConfirm')}
            </T>
            <Spacer />
            <Button
              label={t('charades.play.quit')}
              tone="danger"
              onPress={() => {
                setConfirmQuit(false);
                quitCharades();
                router.replace('/home');
              }}
            />
            <Spacer size={spacing.sm} />
            <Button label={t('common.back')} tone="ghost" onPress={() => setConfirmQuit(false)} />
          </View>
        </View>
      </Modal>
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
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  modal: { backgroundColor: colors.bgRaised, borderRadius: radius.lg, padding: spacing.lg },
});
