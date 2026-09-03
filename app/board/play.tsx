import { Redirect, router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Screen, Spacer, T } from '../../src/ui/components';
import { colors, radius, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import {
  awardTile,
  isBoardComplete,
  revealTile,
  skipTile,
} from '../../src/engine/board/board';
import type { BoardTile } from '../../src/engine/board/types';

export default function BoardPlay() {
  useKeepAwake();
  const { t, lang, board, updateBoard, quitBoard } = useApp();
  const [answerShown, setAnswerShown] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);

  useEffect(() => {
    setAnswerShown(false);
  }, [board?.currentTile?.categoryId, board?.currentTile?.index]);

  if (!board) return <Redirect href="/board/draft" />;
  if (board.lock !== 'unlocked') return <Redirect href="/board/checkout" />;

  const [teamA, teamB] = board.teams;
  const complete = isBoardComplete(board);

  if (complete) {
    const winner =
      board.scores[teamA.id] === board.scores[teamB.id]
        ? null
        : board.scores[teamA.id] > board.scores[teamB.id]
          ? teamA
          : teamB;
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
          <T variant="title" align="center">
            {t('board.play.complete')}
          </T>
          <T variant="display" align="center" color={colors.accent}>
            {winner ? t('board.play.winner', { team: winner.name }) : t('board.play.tie')}
          </T>
          <Spacer />
          <View style={styles.scoreRow}>
            <ScoreChip name={teamA.name} score={board.scores[teamA.id]} color={colors.teamA} />
            <ScoreChip name={teamB.name} score={board.scores[teamB.id]} color={colors.teamB} />
          </View>
          <Spacer size={spacing.xl} />
          <Button
            label={t('board.play.home')}
            onPress={() => {
              quitBoard();
              router.replace('/home');
            }}
          />
        </View>
      </Screen>
    );
  }

  const activeTeam = board.activeTeamId === teamA.id ? teamA : teamB;
  const activeColor = board.activeTeamId === teamA.id ? colors.teamA : colors.teamB;

  const currentTile: BoardTile | undefined = board.currentTile
    ? board.tiles.find(
        (tl) =>
          tl.categoryId === board.currentTile!.categoryId && tl.index === board.currentTile!.index
      )
    : undefined;

  const openTile = (categoryId: string, index: number) => {
    updateBoard(revealTile(board, categoryId, index));
  };

  const award = (teamId: string) => updateBoard(awardTile(board, teamId));
  const skip = () => updateBoard(skipTile(board));

  return (
    <Screen scroll>
      <Spacer size={spacing.sm} />
      <View style={styles.header}>
        <ScoreChip name={teamA.name} score={board.scores[teamA.id]} color={colors.teamA} />
        <T variant="heading" color={activeColor}>
          {t('board.play.turn', { team: activeTeam.name })}
        </T>
        <ScoreChip name={teamB.name} score={board.scores[teamB.id]} color={colors.teamB} />
      </View>

      <Spacer />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.gridRow}>
            {board.categories.map((cat) => (
              <View key={cat.id} style={styles.headerCell}>
                <T variant="label" align="center">
                  {lang === 'ar' ? cat.nameAr : cat.nameEn}
                </T>
              </View>
            ))}
          </View>
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <View key={row} style={styles.gridRow}>
              {board.categories.map((cat) => {
                const tile = board.tiles.find((tl) => tl.categoryId === cat.id && tl.index === row);
                if (!tile) return <View key={cat.id} style={styles.cell} />;
                const wonColor =
                  tile.wonByTeamId === teamA.id
                    ? colors.teamA
                    : tile.wonByTeamId === teamB.id
                      ? colors.teamB
                      : undefined;
                return (
                  <Pressable
                    key={cat.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${lang === 'ar' ? cat.nameAr : cat.nameEn} ${tile.points}`}
                    accessibilityState={{ disabled: tile.revealed }}
                    disabled={tile.revealed || Boolean(board.currentTile)}
                    onPress={() => openTile(cat.id, row)}
                    style={({ pressed }) => [
                      styles.cell,
                      tile.revealed && styles.cellRevealed,
                      wonColor ? { backgroundColor: wonColor } : null,
                      pressed && !tile.revealed && { opacity: 0.72 },
                    ]}
                  >
                    {!tile.revealed ? (
                      <T variant="heading" color={colors.accent}>
                        {tile.points}
                      </T>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <Spacer size={spacing.xl} />
      <Button label={t('board.play.quit')} tone="danger" onPress={() => setConfirmQuit(true)} />

      <Modal visible={Boolean(currentTile)} transparent animationType="fade">
        {currentTile ? (
          <View style={styles.modalBackdrop}>
            <View style={styles.modal}>
              <T variant="heading" align="center">
                {lang === 'ar' ? currentTile.promptAr : currentTile.promptEn}
              </T>
              <Spacer />
              {answerShown ? (
                <T variant="body" align="center" color={colors.accent}>
                  {t('board.play.answer', {
                    answer: lang === 'ar' ? currentTile.answerAr : currentTile.answerEn,
                  })}
                </T>
              ) : (
                <Button label={t('board.play.showAnswer')} tone="secondary" onPress={() => setAnswerShown(true)} />
              )}
              <Spacer size={spacing.lg} />
              <Button
                label={t('board.play.award', { team: teamA.name })}
                accent={colors.teamA}
                disabled={!answerShown}
                onPress={() => award(teamA.id)}
              />
              <Spacer size={spacing.sm} />
              <Button
                label={t('board.play.award', { team: teamB.name })}
                accent={colors.teamB}
                disabled={!answerShown}
                onPress={() => award(teamB.id)}
              />
              <Spacer size={spacing.sm} />
              <Button label={t('board.play.skip')} tone="ghost" disabled={!answerShown} onPress={skip} />
            </View>
          </View>
        ) : null}
      </Modal>

      <Modal visible={confirmQuit} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <T variant="heading" align="center">
              {t('board.play.quitConfirm')}
            </T>
            <Spacer />
            <Button
              label={t('common.yes')}
              tone="danger"
              onPress={() => {
                quitBoard();
                router.replace('/home');
              }}
            />
            <Spacer size={spacing.sm} />
            <Button label={t('common.no')} tone="ghost" onPress={() => setConfirmQuit(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function ScoreChip({ name, score, color }: { name: string; score: number; color: string }) {
  return (
    <View style={[styles.scoreChip, { borderColor: color }]}>
      <T variant="label" color={color} numberOfLines={1}>
        {name}
      </T>
      <T variant="heading">{score}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  scoreRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  scoreChip: {
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minWidth: 96,
  },
  gridRow: { flexDirection: 'row' },
  headerCell: {
    width: 110,
    padding: spacing.sm,
    justifyContent: 'center',
  },
  cell: {
    width: 110,
    height: 72,
    margin: 2,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellRevealed: { borderColor: colors.border, opacity: 0.45 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: { backgroundColor: colors.bgRaised, borderRadius: radius.lg, padding: spacing.lg },
});
