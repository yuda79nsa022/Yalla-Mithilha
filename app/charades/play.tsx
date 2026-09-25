import { Redirect, router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, ConfirmModal, RoundProgress, ScoreBlock, Screen, Spacer, T } from '../../src/ui/components';
import { Hero } from '../../src/ui/Hero';
import { cardShadow, colors, fonts, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { useKeepAwake } from '../../src/platform/keepAwake';
import { playSound, preloadSounds } from '../../src/platform/sound';
import { adjustScore, awardRound, currentTeamIndex, isCharadesComplete, skipRound } from '../../src/engine/charades';
import { buildRevealUrl, resolveRevealBaseUrl } from '../../src/engine/reveal';
import { CATALOGUE_API_URL, REVEAL_BASE_URL } from '../../src/config';

/** Each round gets 2 minutes to act before the score buttons appear — unless the actor's team ends it early. */
const ROUND_SECONDS = 120;

/** The countdown ticks audibly for its last half-minute, same as a real game-show clock. */
const TICK_SECONDS = 30;

/** A correct guess in the round's first minute is worth 2 points, its second minute 1 point. */
function pointsForTimeLeft(timeLeft: number): number {
  return timeLeft > ROUND_SECONDS / 2 ? 2 : 1;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function webOrigin(): string | null {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as { location?: { origin?: string } };
  return g.location?.origin ?? null;
}

/** The adjustable score chip shown on the reveal/scoring screen — the one place mid-game score corrections happen. */
function ScoreChip({
  name,
  score,
  color,
  onAdjust,
}: {
  name: string;
  score: number;
  color: string;
  onAdjust: (delta: number) => void;
}) {
  const { t } = useApp();
  return (
    <View style={[styles.scoreChip, { borderColor: colors.ink }]}>
      <T variant="label" numberOfLines={1} style={{ fontSize: 12 }}>
        {name}
      </T>
      <T style={{ fontFamily: fonts.displayBlack, fontSize: 28, color }}>{score}</T>
      <View style={styles.scoreAdjustRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('charades.play.scoreDecrease', { team: name })}
          disabled={score <= 0}
          onPress={() => onAdjust(-1)}
          style={({ pressed }) => [styles.scoreAdjustButton, pressed && styles.pressed, score <= 0 && styles.disabled]}
        >
          <T variant="heading" style={{ fontSize: 16 }}>
            −
          </T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('charades.play.scoreIncrease', { team: name })}
          onPress={() => onAdjust(1)}
          style={({ pressed }) => [styles.scoreAdjustButton, pressed && styles.pressed]}
        >
          <T variant="heading" style={{ fontSize: 16 }}>
            +
          </T>
        </Pressable>
      </View>
    </View>
  );
}

export default function CharadesPlay() {
  useKeepAwake();
  const { t, lang, charades, updateCharades, quitCharades } = useApp();
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [endedEarly, setEndedEarly] = useState(false);
  const [started, setStarted] = useState(false);
  /**
   * Set the instant "award" or "skip" is tapped — the answer itself is
   * already on screen by then (see the `revealed` branch below); this just
   * holds the outcome so `charades.index` doesn't advance until "next round"
   * is tapped.
   */
  const [pendingOutcome, setPendingOutcome] = useState<{ team: 0 | 1; awarded: boolean; points: number } | null>(
    null
  );

  // Hooks run unconditionally, before the early-return redirects below — so
  // every dependency here has to tolerate `charades` being null.
  const roundKey = charades?.index ?? -1;
  const roundActive = charades !== null && charades.lock === 'unlocked' && !isCharadesComplete(charades);

  useEffect(() => {
    setTimeLeft(ROUND_SECONDS);
    setEndedEarly(false);
    setStarted(false);
    setPendingOutcome(null);
  }, [roundKey]);

  useEffect(() => {
    preloadSounds();
  }, []);

  useEffect(() => {
    if (!roundActive || !started || endedEarly) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [roundActive, started, endedEarly, roundKey]);

  // A tick for each of the last TICK_SECONDS, and a buzzer the instant it
  // hits zero — keyed off `started` too so resetting the round (which also
  // resets timeLeft to ROUND_SECONDS) never fires a stray tick.
  const prevTimeLeftRef = useRef(timeLeft);
  useEffect(() => {
    const prev = prevTimeLeftRef.current;
    prevTimeLeftRef.current = timeLeft;
    if (!started || prev === timeLeft) return;
    if (timeLeft === 0) {
      void playSound('buzzer');
    } else if (timeLeft <= TICK_SECONDS) {
      void playSound('tick');
    }
  }, [timeLeft, started]);

  if (!charades) return <Redirect href="/charades/draft" />;
  if (charades.lock !== 'unlocked') return <Redirect href="/charades/checkout" />;

  const complete = isCharadesComplete(charades);

  if (complete) {
    const [scoreA, scoreB] = charades.scores;
    const winner = scoreA === scoreB ? null : scoreA > scoreB ? charades.teamAName : charades.teamBName;
    const newGame = () => {
      quitCharades();
      router.replace('/charades/draft');
    };
    return (
      <Screen
        scroll
        background={colors.ink}
        header={{ title: t('app.name'), light: true }}
        footer={
          <>
            <Button
              label={t('charades.play.newGame')}
              accent={colors.green}
              shadowColor={colors.purple}
              borderColor={colors.white}
              onPress={newGame}
            />
            <Spacer size={spacing.sm} />
            <Button
              label={t('charades.play.home')}
              tone="secondary"
              showArrow={false}
              borderColor={colors.white}
              textColor={colors.white}
              onPress={() => {
                quitCharades();
                router.replace('/home');
              }}
            />
          </>
        }
      >
        <Spacer size={spacing.lg} />
        <View style={styles.finalTop}>
          <View style={{ gap: 6, flex: 1 }}>
            <T variant="label" color={colors.green} style={{ fontSize: 15 }}>
              {t('charades.play.winningTeam')}
            </T>
            <T style={{ fontFamily: fonts.displayBlack, fontSize: 56, lineHeight: 62, color: colors.white, transform: [{ rotate: '-3deg' }] }}>
              {winner ? winner : t('charades.play.tie')}
            </T>
          </View>
        </View>
        <Spacer size={spacing.lg} />
        <ScoreBlock teamAName={charades.teamAName} teamAScore={scoreA} teamBName={charades.teamBName} teamBScore={scoreB} big light />
      </Screen>
    );
  }

  const teamIndex = currentTeamIndex(charades);
  const teamName = teamIndex === 0 ? charades.teamAName : charades.teamBName;
  const teamColor = teamIndex === 0 ? colors.purple : colors.green;
  const currentTitle = charades.titles[charades.index];

  const revealed = endedEarly || timeLeft <= 0;
  const category = lang === 'ar' ? currentTitle.deckNameAr : currentTitle.deckNameEn;

  const baseUrl = resolveRevealBaseUrl(REVEAL_BASE_URL, webOrigin());
  const absoluteImageUrl = currentTitle.imageUrl ? `${CATALOGUE_API_URL}${currentTitle.imageUrl}` : undefined;
  const revealUrl = baseUrl
    ? buildRevealUrl(baseUrl, currentTitle.text, currentTitle.deckNameAr, currentTitle.deckNameEn, absoluteImageUrl)
    : null;

  const nextRound = () => {
    if (!pendingOutcome) return;
    updateCharades(
      pendingOutcome.awarded ? awardRound(charades, pendingOutcome.team, pendingOutcome.points) : skipRound(charades)
    );
  };

  const adjustTeamScore = (team: 0 | 1, delta: number) => {
    updateCharades(adjustScore(charades, team, delta));
  };

  const quitButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('charades.play.quit')}
      onPress={() => setConfirmQuit(true)}
      style={styles.quitLink}
    >
      <T variant="label" color={colors.red} style={{ fontSize: 13 }}>
        {t('charades.play.quit')}
      </T>
    </Pressable>
  );

  const confirmModal = (
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
  );

  // --- Round result: the "+N للفريق" recap shown after tapping award/skip -------
  if (pendingOutcome) {
    const finishedTeamName = pendingOutcome.team === 0 ? charades.teamAName : charades.teamBName;
    const nextTeamIndex = pendingOutcome.team === 0 ? 1 : 0;
    const nextTeamName = nextTeamIndex === 0 ? charades.teamAName : charades.teamBName;
    const elapsed = ROUND_SECONDS - timeLeft;
    const bannerBg = pendingOutcome.awarded ? colors.green : colors.mutedBg;
    // The actual score update only lands in `charades.scores` once "next
    // round" is tapped (see `nextRound` above), but showing that stale,
    // not-yet-updated total right next to a "+N for {team}!" banner reads as
    // the wrong team having scored — so this recap previews the outcome
    // already applied, purely for display.
    const previewScores: [number, number] = pendingOutcome.awarded
      ? pendingOutcome.team === 0
        ? [charades.scores[0] + pendingOutcome.points, charades.scores[1]]
        : [charades.scores[0], charades.scores[1] + pendingOutcome.points]
      : charades.scores;
    return (
      <Screen
        scroll
        header={{ title: t('app.name') }}
        footer={
          <>
            <T variant="label" color={colors.neutral700} style={{ fontSize: 13, fontWeight: '500' }}>
              {t('charades.play.nextTurn', { team: nextTeamName })}
            </T>
            <Spacer size={spacing.sm} />
            <Button label={t('charades.play.nextRound')} onPress={nextRound} />
          </>
        }
      >
        <View style={[styles.resultBanner, { backgroundColor: bannerBg }]}>
          <T
            style={{
              fontFamily: fonts.displayBlack,
              fontSize: 56,
              lineHeight: 62,
              color: colors.ink,
              transform: [{ rotate: '-4deg' }],
            }}
          >
            {pendingOutcome.awarded ? t('charades.play.guessedIt') : t('charades.play.notGuessed')}
          </T>
          {pendingOutcome.awarded ? (
            <View style={styles.resultTag}>
              <T variant="label" color={colors.white} style={{ fontWeight: '900', fontSize: 16 }} numberOfLines={1}>
                {t('charades.play.pointAwardedTo', { team: finishedTeamName, points: pendingOutcome.points })}
              </T>
            </View>
          ) : null}
        </View>
        <Spacer size={spacing.md} />
        <T variant="label" color={colors.neutral700} style={{ fontSize: 12, fontWeight: '500' }}>
          {t('charades.play.answerReveal')}
        </T>
        <T variant="heading" style={{ fontSize: 24 }}>
          {currentTitle.text}
        </T>
        <T variant="body" style={{ fontSize: 13 }}>
          {category} · {formatTime(elapsed)}
        </T>
        <Spacer size={spacing.md} />
        <ScoreBlock
          teamAName={charades.teamAName}
          teamAScore={previewScores[0]}
          teamBName={charades.teamBName}
          teamBScore={previewScores[1]}
        />
      </Screen>
    );
  }

  // --- Reveal + score buttons: privacy is over, the group scores it together ----
  if (revealed) {
    return (
      <Screen
        scroll
        header={{
          title: t('charades.play.round', { round: charades.index + 1, total: charades.titles.length }),
        }}
        footer={
          <>
            <View style={styles.scoreHeaderRow}>
              <ScoreChip name={charades.teamAName} score={charades.scores[0]} color={colors.purple} onAdjust={(d) => adjustTeamScore(0, d)} />
              <ScoreChip name={charades.teamBName} score={charades.scores[1]} color={colors.green} onAdjust={(d) => adjustTeamScore(1, d)} />
            </View>
            <Spacer size={spacing.md} />
            <View style={styles.actingFooterGrid}>
              <Button
                label={t('charades.play.award', { team: teamName })}
                accent={colors.green}
                showArrow={false}
                style={{ flex: 2 }}
                onPress={() => setPendingOutcome({ team: teamIndex, awarded: true, points: pointsForTimeLeft(timeLeft) })}
              />
              <Button
                label={t('charades.play.skip')}
                tone="secondary"
                showArrow={false}
                style={{ flex: 1 }}
                onPress={() => setPendingOutcome({ team: teamIndex, awarded: false, points: 0 })}
              />
            </View>
          </>
        }
      >
        <View style={styles.categoryChipRow}>
          <T variant="heading" color={teamColor}>
            {t('charades.play.turn', { team: teamName })}
          </T>
          <View style={[styles.categoryChip, { backgroundColor: colors.purple }]}>
            <T variant="label" color={colors.white} numberOfLines={1}>
              {category}
            </T>
          </View>
        </View>
        <Spacer size={spacing.lg} />
        <View style={[styles.titleCard, cardShadow(lang, teamColor)]}>
          <T style={{ fontFamily: fonts.displayBlack, fontSize: 40, lineHeight: 46 }}>{currentTitle.text}</T>
          {absoluteImageUrl ? (
            <Image
              source={{ uri: absoluteImageUrl }}
              style={{ width: '100%', height: 180 }}
              resizeMode="contain"
              accessibilityLabel={currentTitle.text}
            />
          ) : null}
        </View>
        <Spacer size={spacing.lg} />
        {quitButton}
        {confirmModal}
      </Screen>
    );
  }

  // --- Not yet started: full-purple turn handoff -------------------------------
  if (!started) {
    return (
      <Screen
        scroll
        background={colors.purple}
        header={{
          light: true,
          title: t('charades.play.round', { round: charades.index + 1, total: charades.titles.length }),
        }}
        footer={
          <Button
            label={t('charades.play.startTimer')}
            tone="secondary"
            background={colors.white}
            forceShadow
            onPress={() => {
              void playSound('bell');
              setStarted(true);
            }}
          />
        }
      >
        <RoundProgress round={charades.index + 1} total={charades.titles.length} />
        <Spacer size={spacing.md} />
        <ScoreBlock
          teamAName={charades.teamAName}
          teamAScore={charades.scores[0]}
          teamBName={charades.teamBName}
          teamBScore={charades.scores[1]}
        />
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
          <T variant="body" color={colors.white} style={{ fontWeight: '700', fontSize: 18 }}>
            {t('charades.play.turnLabel')}
          </T>
          <T
            variant="timer"
            style={{ fontFamily: fonts.displayBlack, color: colors.white, transform: [{ rotate: '-3deg' }] }}
            numberOfLines={1}
          >
            {teamName}
          </T>
          <T variant="body" color={colors.white} style={{ fontSize: 15, maxWidth: 300 }}>
            {t('charades.play.handoffInstruction')}
          </T>
          <View style={[styles.qrCard, cardShadow(lang, colors.ink)]}>
            {revealUrl ? (
              <QRCode value={revealUrl} size={160} />
            ) : (
              <T variant="label" align="center" color={colors.neutral700}>
                {t('charades.play.scanUnavailable')}
              </T>
            )}
          </View>
        </View>
      </Screen>
    );
  }

  // --- Acting: timer running, actor sees the word only via the QR scan ---------
  return (
    <Screen
      scroll
      header={{
        title: t('charades.play.roundTeam', { round: charades.index + 1, team: teamName }),
        end: (
          <View style={[styles.categoryChip, { backgroundColor: colors.purple }]}>
            <T variant="label" color={colors.white} numberOfLines={1}>
              {category}
            </T>
          </View>
        ),
      }}
      footer={<Button label={t('charades.play.endEarly')} tone="secondary" showArrow={false} onPress={() => setEndedEarly(true)} />}
    >
      <View style={styles.timerBlock}>
        <View style={styles.timerRow}>
          <T variant="label" style={{ fontSize: 13 }}>
            {t('charades.play.timeLabel')}
          </T>
          <T
            variant="timer"
            style={{ fontFamily: fonts.displayBlack, color: timeLeft <= 10 ? colors.red : colors.purple }}
            accessibilityLabel={t('charades.play.timeRemaining', { time: formatTime(timeLeft) })}
          >
            {formatTime(timeLeft)}
          </T>
        </View>
        <View style={styles.timerTrack}>
          <View
            style={[
              styles.timerFill,
              lang === 'ar' ? { right: 0 } : { left: 0 },
              {
                width: `${(timeLeft / ROUND_SECONDS) * 100}%`,
                backgroundColor: timeLeft <= 10 ? colors.red : colors.purple,
              },
            ]}
          />
        </View>
      </View>

      {quitButton}
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Hero animateLogo />
      </View>
      {confirmModal}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scoreChip: {
    borderWidth: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    minWidth: 90,
  },
  scoreAdjustRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  scoreAdjustButton: {
    width: 30,
    height: 30,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreHeaderRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.4 },
  categoryChipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryChip: { paddingHorizontal: 10, paddingVertical: 4 },
  titleCard: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    padding: spacing.lg,
    gap: spacing.md,
    transform: [{ rotate: '-1.5deg' }],
  },
  actingFooterGrid: { flexDirection: 'row', gap: spacing.sm },
  quitLink: { alignSelf: 'center', paddingVertical: spacing.sm },
  timerBlock: { gap: 6, paddingBottom: spacing.md, borderBottomWidth: 2, borderBottomColor: colors.ink },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  timerTrack: { height: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white, position: 'relative' },
  timerFill: { position: 'absolute', top: 0, bottom: 0 },
  qrCard: {
    borderWidth: 3,
    borderColor: colors.ink,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.white,
  },
  finalTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  resultBanner: { padding: spacing.lg, gap: spacing.xl, borderBottomWidth: 2, borderBottomColor: colors.ink },
  resultTag: { alignSelf: 'flex-start', backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 4, transform: [{ rotate: '2deg' }] },
});
