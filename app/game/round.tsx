import { Redirect, router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BigChoice, Button, Screen, Spacer, T } from '../../src/ui/components';
import { colors, miniGameColor, radius, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { useKeepAwake } from '../../src/platform/keepAwake';
import { completeRound, currentPlan, roundPrompts } from '../../src/engine/engine';
import { MINI_GAMES } from '../../src/engine/config';
import {
  canSkip,
  currentCard,
  endEarly,
  markCorrect,
  skipCard,
  skipsLeft,
  startRound,
  tick,
  togglePause,
  type RoundController,
} from '../../src/state/roundController';
import { useTilt } from '../../src/platform/useTilt';
import { vibrate } from '../../src/platform';
import { play } from '../../src/platform/audio';
import { formatNumber } from '../../src/i18n';
import { track } from '../../src/services/analytics';
import type { Player, PromptReport } from '../../src/engine/types';

const REPORT_REASONS: PromptReport['reason'][] = [
  'unclear',
  'translation',
  'not_funny',
  'inappropriate',
  'too_hard',
  'duplicate',
];

export default function Round() {
  useKeepAwake(); // A screen that sleeps mid-charade ends the round for you.
  const { t, lang, session, prefs, updateSession, report } = useApp();
  const [state, setState] = useState<RoundController | null>(null);
  const [vote, setVote] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);

  const plan = session ? currentPlan(session) : undefined;

  useEffect(() => {
    if (!session || !plan) return;
    setState(startRound(plan.game, roundPrompts(session), plan.isFinal));
    setVote(null);
  }, [plan?.index, session?.startedAt]);

  // The clock. One interval, paused with the round, cleared on unmount.
  useEffect(() => {
    if (!state || state.finished || state.paused) return;
    const id = setInterval(() => setState((s) => (s ? tick(s) : s)), 1000);
    return () => clearInterval(id);
  }, [state?.finished, state?.paused, plan?.index]);

  useEffect(() => {
    if (state?.secondsLeft === 3) void play('countdown');
  }, [state?.secondsLeft]);

  const answer = useCallback(() => {
    void vibrate('success', prefs.haptics);
    void play('correct');
    setState((s) => (s ? markCorrect(s) : s));
  }, [prefs.haptics]);

  const pass = useCallback(() => {
    setState((s) => {
      if (!s || !canSkip(s)) return s;
      void vibrate('warning', prefs.haptics);
      void play('skip');
      const card = currentCard(s);
      if (card) track({ name: 'prompt_skipped', promptId: card.id, game: s.game });
      return skipCard(s);
    });
  }, [prefs.haptics]);

  const tiltOn = Boolean(
    state &&
      prefs.motion &&
      session?.setup.motionEnabled &&
      MINI_GAMES[state.game].supportsTilt &&
      !state.paused &&
      !state.finished
  );
  useTilt(tiltOn, { onForward: answer, onBackward: pass });

  // Round over: write it into the session and move to the result screen.
  useEffect(() => {
    if (!state?.finished || !session || !plan) return;
    void play('roundEnd');
    void vibrate('heavy', prefs.haptics);
    const next = completeRound(session, {
      roundIndex: plan.index,
      teamId: plan.teamId,
      performerId: plan.performerId,
      game: plan.game,
      cards: state.results,
      votedPlayerId: vote ?? undefined,
    });
    track({
      name: 'minigame_completed',
      game: plan.game,
      correct: state.results.filter((r) => r.outcome === 'correct').length,
      skipped: state.results.filter((r) => r.outcome === 'skip').length,
    });
    updateSession(next);
    router.replace('/game/result');
  }, [state?.finished]);

  if (!session) return <Redirect href="/home" />;
  if (!plan || !state) return null;

  const accent = miniGameColor(plan.game);
  const card = currentCard(state);
  const left = skipsLeft(state);
  const danger = state.secondsLeft <= 10;

  return (
    <Screen background={colors.bgSunken}>
      <View style={styles.topRow}>
        <T
          variant="timer"
          color={danger ? colors.skip : accent}
          accessibilityLabel={t('round.timeLeft', { seconds: state.secondsLeft })}
        >
          {formatNumber(lang, state.secondsLeft)}
        </T>
        <View style={styles.topRight}>
          <T variant="label" color={colors.textMuted}>
            {t('round.cardsLeft', {
              count: formatNumber(lang, Math.max(0, state.cards.length - state.cursor)),
            })}
          </T>
          <T variant="label" color={left === 0 ? colors.skip : colors.textMuted}>
            {left === null
              ? ''
              : left === 0
                ? t('round.noSkips')
                : t('round.skipsLeft', { count: formatNumber(lang, left) })}
          </T>
        </View>
      </View>

      <View style={[styles.card, { borderColor: accent }]}>
        {card ? (
          plan.game === 'taboo' ? (
            <TabooCard
              word={lang === 'ar' ? card.ar : card.en}
              forbidden={(lang === 'ar' ? card.forbiddenAr : card.forbiddenEn) ?? []}
              label={t('round.forbidden')}
              accent={accent}
            />
          ) : (
            <T variant="card" align="center">
              {lang === 'ar' ? card.ar : card.en}
            </T>
          )
        ) : null}
      </View>

      {plan.game === 'who' ? (
        <WhoVote
          players={session.setup.players}
          selected={vote}
          onSelect={(id) => {
            setVote(id);
            answer();
          }}
          accent={accent}
        />
      ) : (
        <>
          {MINI_GAMES[plan.game].supportsTilt ? (
            <T variant="label" color={colors.textMuted} align="center">
              {tiltOn ? t('round.tiltHint') : t('round.tiltOff')}
            </T>
          ) : null}
          <View style={styles.choices}>
            <BigChoice
              label={t('round.skip')}
              color={colors.skip}
              onPress={pass}
              disabled={!canSkip(state)}
            />
            <BigChoice label={t('round.correct')} color={colors.correct} onPress={answer} />
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Button
          label={state.paused ? t('round.resume') : t('round.pause')}
          tone="ghost"
          onPress={() => setState((s) => (s ? togglePause(s) : s))}
          style={styles.footerButton}
        />
        <Button
          label={t('round.report')}
          tone="ghost"
          onPress={() => {
            // Pause first: a report should never cost the performer time.
            setState((s) => (s ? { ...s, paused: true } : s));
            setReporting(true);
          }}
          style={styles.footerButton}
        />
        <Button
          label={t('round.endEarly')}
          tone="ghost"
          onPress={() => setState((s) => (s ? endEarly(s) : s))}
          style={styles.footerButton}
        />
      </View>

      <Modal visible={reporting} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <T variant="heading">{t('report.title')}</T>
            <Spacer size={spacing.sm} />
            {REPORT_REASONS.map((reason) => (
              <Button
                key={reason}
                label={t(`report.${reason}` as never)}
                tone="secondary"
                style={{ marginBottom: spacing.sm }}
                onPress={async () => {
                  if (card) await report(card.id, reason);
                  setReporting(false);
                  setState((s) => (s ? { ...s, paused: false } : s));
                }}
              />
            ))}
            <Button
              label={t('common.cancel')}
              tone="ghost"
              onPress={() => {
                setReporting(false);
                setState((s) => (s ? { ...s, paused: false } : s));
              }}
            />
          </View>
        </View>
      </Modal>

      {state.paused && !reporting ? (
        <Pressable
          style={styles.pauseOverlay}
          onPress={() => setState((s) => (s ? togglePause(s) : s))}
          accessibilityRole="button"
          accessibilityLabel={t('round.resume')}
        >
          <T variant="title" align="center">
            {t('round.resume')}
          </T>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function TabooCard({
  word,
  forbidden,
  label,
  accent,
}: {
  word: string;
  forbidden: string[];
  label: string;
  accent: string;
}) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.md }}>
      <T variant="card" align="center">
        {word}
      </T>
      <T variant="label" color={colors.skip}>
        {label}
      </T>
      <View style={styles.forbiddenList}>
        {forbidden.map((wordItem) => (
          <View key={wordItem} style={[styles.forbiddenChip, { borderColor: accent }]}>
            <T variant="body" color={colors.textMuted}>
              {wordItem}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

function WhoVote({
  players,
  selected,
  onSelect,
  accent,
}: {
  players: Player[];
  selected: string | null;
  onSelect: (id: string) => void;
  accent: string;
}) {
  return (
    <ScrollView contentContainerStyle={styles.voteList}>
      {players.map((player) => (
        <Pressable
          key={player.id}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === player.id }}
          onPress={() => onSelect(player.id)}
          style={({ pressed }) => [
            styles.voteChip,
            { borderColor: accent },
            pressed && { opacity: 0.7 },
          ]}
        >
          <T variant="heading">{player.name}</T>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topRight: { alignItems: 'flex-end' },
  card: {
    flex: 1,
    borderWidth: 3,
    borderRadius: radius.lg,
    backgroundColor: colors.bgRaised,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choices: { flexDirection: 'row', gap: spacing.md },
  forbiddenList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  forbiddenChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  voteList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  voteChip: {
    borderWidth: 2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', gap: spacing.sm },
  footerButton: { flex: 1, paddingHorizontal: spacing.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: { backgroundColor: colors.bgRaised, borderRadius: radius.lg, padding: spacing.lg },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
