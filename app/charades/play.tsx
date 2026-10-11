import { Redirect, router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';
import { Button, ConfirmModal, RoundProgress, ScoreBlock, Screen, Spacer, T } from '../../src/ui/components';
import { Hero } from '../../src/ui/Hero';
import { cardShadow, colors, fonts, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { useKeepAwake } from '../../src/platform/keepAwake';
import { playSound, preloadSounds, setTimerMusicVolume, startTimerMusic, stopTimerMusic } from '../../src/platform/sound';
import {
  ASSIST_EXTRA_SECONDS,
  ASSIST_KINDS,
  DIFFICULTIES,
  DIFFICULTY_POINTS,
  SPEED_BONUS_POINTS,
  SPEED_BONUS_WINDOW_SECONDS,
  STEAL_POINTS,
  adjustScore,
  assistAvailable,
  awardRound,
  canPickDifficulty,
  currentTeamIndex,
  isCharadesComplete,
  isDoubleRound,
  pickDifficulty,
  pointsForGuess,
  revealLetters,
  roundMultiplier,
  skipRound,
  stackSizes,
  stealRound,
  consumeAssist,
  type AssistKind,
  type Difficulty,
} from '../../src/engine/charades';
import { resolveRevealBaseUrl } from '../../src/engine/reveal';
import { CATALOGUE_API_URL, REVEAL_BASE_URL } from '../../src/config';

/** Each round gets 2 minutes to act before the score buttons appear — unless the actor's team ends it early, or buys time with an assist. */
const ROUND_SECONDS = 120;

/** The countdown ticks audibly for its last half-minute, same as a real game-show clock. */
const TICK_SECONDS = 30;

/** Each level's card colour on the pick screen — the same three accents the rest of the app uses. */
const LEVEL_COLORS: Record<Difficulty, string> = { easy: colors.green, medium: colors.purple, hard: colors.red };

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

const VOLUME_STEPS = 5;

function SpeakerIcon({ muted, color }: { muted: boolean; color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9v6h4l5 4V5L8 9H4z" fill={color} />
      {muted ? (
        <Path d="M16 9.5l5 5M21 9.5l-5 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      ) : (
        <Path d="M16 8.5a5 5 0 010 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      )}
    </Svg>
  );
}

/**
 * The background-music volume bar on the acting screen — tapping a segment
 * sets the level directly (rather than a drag gesture, so it works the same
 * with mouse, touch and a screen reader's own "activate" gesture); the
 * speaker button mutes/unmutes without losing the chosen level.
 */
function VolumeControl({
  volume,
  muted,
  onChangeVolume,
  onToggleMute,
}: {
  volume: number;
  muted: boolean;
  onChangeVolume: (volume: number) => void;
  onToggleMute: () => void;
}) {
  const { t } = useApp();
  const activeSegments = muted ? 0 : Math.round(volume * VOLUME_STEPS);
  return (
    <View style={styles.volumeRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(muted ? 'charades.play.musicUnmute' : 'charades.play.musicMute')}
        onPress={onToggleMute}
        style={({ pressed }) => [styles.volumeMuteButton, pressed && styles.pressed]}
      >
        <SpeakerIcon muted={muted} color={colors.ink} />
      </Pressable>
      <T variant="label" style={{ fontSize: 12 }} numberOfLines={1}>
        {t('charades.play.musicVolume')}
      </T>
      <View style={styles.volumeBar}>
        {Array.from({ length: VOLUME_STEPS }, (_, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={t('charades.play.musicVolumeLevel', {
              percent: Math.round(((i + 1) / VOLUME_STEPS) * 100),
            })}
            onPress={() => onChangeVolume((i + 1) / VOLUME_STEPS)}
            style={[styles.volumeSegment, { backgroundColor: i < activeSegments ? colors.purple : colors.white }]}
          />
        ))}
      </View>
    </View>
  );
}

/** How a round ended, held until "next round" is tapped so the recap can show it before the score moves. */
type Outcome =
  | { kind: 'guessed'; team: 0 | 1; points: number; elapsed: number }
  | { kind: 'stolen'; team: 0 | 1; points: number; elapsed: number }
  | { kind: 'missed'; team: 0 | 1; points: 0; elapsed: number };

export default function CharadesPlay() {
  useKeepAwake();
  const { t, lang, charades, updateCharades, quitCharades, prefs, setPrefs, mintRevealToken } = useApp();
  const musicVolume = prefs.musicMuted ? 0 : prefs.musicVolume;
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  /** Seconds the "extra time" assist added this round — so the bar and the speed bonus both know the true round length. */
  const [extraSeconds, setExtraSeconds] = useState(0);
  const [endedEarly, setEndedEarly] = useState(false);
  const [started, setStarted] = useState(false);
  /** Which letter assists were used *this round* — `assistsUsed` on the game state is per game, this is what to show now. */
  const [lettersShown, setLettersShown] = useState<{ first: boolean; last: boolean }>({ first: false, last: false });
  /**
   * Set the instant an outcome button is tapped — the answer itself is
   * already on screen by then (see the `revealed` branch below); this just
   * holds the outcome so `charades.index` doesn't advance until "next round"
   * is tapped.
   */
  const [pendingOutcome, setPendingOutcome] = useState<Outcome | null>(null);

  // Hooks run unconditionally, before the early-return redirects below — so
  // every dependency here has to tolerate `charades` being null.
  const roundKey = charades?.index ?? -1;
  const roundActive = charades !== null && charades.lock === 'unlocked' && !isCharadesComplete(charades);
  const currentTitleForMint = charades?.current ?? null;

  useEffect(() => {
    setTimeLeft(ROUND_SECONDS);
    setExtraSeconds(0);
    setEndedEarly(false);
    setStarted(false);
    setLettersShown({ first: false, last: false });
    setPendingOutcome(null);
  }, [roundKey]);

  // The QR code on the handoff screen below links to a single-use token
  // minted here, server-side — not built client-side the way it used to be
  // — so the server can refuse every scan after the first one (see
  // server/src/routes/reveal.ts). Without that, the same code stayed
  // scannable by anyone pointed at the shared screen for as long as it was
  // up, including an opposing player sneaking a peek at the answer. Minted
  // only once the acting team has picked a level, since there's no title
  // to reveal before that.
  const [revealTokenId, setRevealTokenId] = useState<string | null>(null);
  useEffect(() => {
    setRevealTokenId(null);
  }, [roundKey]);
  useEffect(() => {
    if (!roundActive || started || !currentTitleForMint) return;
    let cancelled = false;
    const { text, deckNameAr, deckNameEn, imageUrl } = currentTitleForMint;
    const absoluteImageUrl = imageUrl ? `${CATALOGUE_API_URL}${imageUrl}` : undefined;
    void mintRevealToken(text, deckNameAr, deckNameEn, absoluteImageUrl).then((id) => {
      if (!cancelled) setRevealTokenId(id);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundActive, started, currentTitleForMint?.id, mintRevealToken]);

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
      void stopTimerMusic();
    } else if (timeLeft <= TICK_SECONDS && timeLeft < prev) {
      void playSound('tick');
    }
  }, [timeLeft, started]);

  // The background track plays for the whole round while the actor is up —
  // started once here rather than alongside the bell tap, so it also covers
  // a re-render/remount mid-round, and stopped the instant the round ends,
  // however it ends (time runs out — handled above — or "end early" is
  // tapped, or the player quits/navigates away entirely). `musicVolume` is
  // deliberately left out of the dependency list: the volume-slider effect
  // just below adjusts an already-playing track live, and including it here
  // too would restart the track (and its loop position) on every drag.
  useEffect(() => {
    if (!roundActive || !started || endedEarly) return;
    void startTimerMusic(musicVolume);
    return () => {
      void stopTimerMusic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundActive, started, endedEarly, roundKey]);

  // Live volume-slider / mute changes reach an already-playing track without
  // restarting it. A no-op before any round has started (nothing loaded yet).
  useEffect(() => {
    void setTimerMusicVolume(musicVolume);
  }, [musicVolume]);

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
  const otherTeamIndex: 0 | 1 = teamIndex === 0 ? 1 : 0;
  const teamName = teamIndex === 0 ? charades.teamAName : charades.teamBName;
  const otherTeamName = otherTeamIndex === 0 ? charades.teamAName : charades.teamBName;
  const teamColor = teamIndex === 0 ? colors.purple : colors.green;
  const roundNumber = charades.index + 1;
  const doubleRound = isDoubleRound(charades);
  const multiplier = roundMultiplier(charades);
  const totalSeconds = ROUND_SECONDS + extraSeconds;
  const elapsed = totalSeconds - timeLeft;

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

  const doubleBanner = doubleRound ? (
    <View style={styles.doubleBanner}>
      <T variant="label" color={colors.ink} style={{ fontSize: 14 }}>
        {t('charades.play.doubleRound', { team: teamName })}
      </T>
    </View>
  ) : null;

  // --- Pick a level: the acting team's call, before anything is revealed ------
  if (!charades.current) {
    const sizes = stackSizes(charades);
    return (
      <Screen
        scroll
        background={colors.purple}
        header={{ light: true, title: t('charades.play.round', { round: roundNumber, total: charades.rounds }) }}
        footer={quitButton}
      >
        <RoundProgress round={roundNumber} total={charades.rounds} />
        <Spacer size={spacing.md} />
        <ScoreBlock
          teamAName={charades.teamAName}
          teamAScore={charades.scores[0]}
          teamBName={charades.teamBName}
          teamBScore={charades.scores[1]}
        />
        <Spacer size={spacing.lg} />
        {doubleBanner}
        {doubleBanner ? <Spacer size={spacing.sm} /> : null}
        <T variant="title" color={colors.white} style={{ fontSize: 30 }}>
          {t('charades.play.pickTitle')}
        </T>
        <T variant="body" color={colors.white} style={{ fontSize: 15 }}>
          {t('charades.play.pickSubtitle', { team: teamName })}
        </T>
        <Spacer size={spacing.md} />
        <View style={styles.levelRow}>
          {DIFFICULTIES.map((level) => {
            const enabled = canPickDifficulty(charades, level);
            const points = DIFFICULTY_POINTS[level] * multiplier;
            return (
              <Pressable
                key={level}
                accessibilityRole="button"
                accessibilityState={{ disabled: !enabled }}
                accessibilityLabel={`${t(`charades.play.level.${level}`)} — ${t('charades.play.levelPoints', { points })}`}
                disabled={!enabled}
                onPress={() => {
                  void playSound('bell');
                  updateCharades(pickDifficulty(charades, level));
                }}
                style={({ pressed }) => [
                  styles.levelCard,
                  cardShadow(lang, colors.ink),
                  { backgroundColor: enabled ? LEVEL_COLORS[level] : colors.mutedBg },
                  pressed && styles.pressed,
                  !enabled && styles.disabled,
                ]}
              >
                <T variant="label" color={level === 'medium' ? colors.white : colors.ink} style={{ fontSize: 14 }}>
                  {t(`charades.play.level.${level}`)}
                </T>
                <T style={{ fontFamily: fonts.displayBlack, fontSize: 44, lineHeight: 50, color: level === 'medium' ? colors.white : colors.ink }}>
                  {points}
                </T>
                <T variant="label" color={level === 'medium' ? colors.white : colors.ink} style={{ fontSize: 11 }} numberOfLines={1}>
                  {sizes[level] > 0 ? t('charades.play.levelLeft', { count: sizes[level] }) : t('charades.play.levelEmpty')}
                </T>
              </Pressable>
            );
          })}
        </View>
        <Spacer size={spacing.sm} />
        <T variant="body" color={colors.white} style={{ fontSize: 13 }}>
          {t('charades.play.speedBonus', { points: SPEED_BONUS_POINTS * multiplier })}
        </T>
        {confirmModal}
      </Screen>
    );
  }

  const currentTitle = charades.current;
  const level = currentTitle.difficulty;
  const revealed = endedEarly || timeLeft <= 0;
  const timedOut = !endedEarly && timeLeft <= 0;
  const category = lang === 'ar' ? currentTitle.deckNameAr : currentTitle.deckNameEn;

  const baseUrl = resolveRevealBaseUrl(REVEAL_BASE_URL, webOrigin());
  const absoluteImageUrl = currentTitle.imageUrl ? `${CATALOGUE_API_URL}${currentTitle.imageUrl}` : undefined;
  // `revealTokenId` is minted server-side, above, the moment this round's
  // handoff screen becomes active — null until that round-trip resolves (a
  // brief "scan unavailable" instead of a QR code) or if it fails outright.
  const revealUrl = baseUrl && revealTokenId ? `${baseUrl}/reveal?id=${encodeURIComponent(revealTokenId)}` : null;

  const levelChip = (
    <View style={[styles.categoryChip, { backgroundColor: LEVEL_COLORS[level] }]}>
      <T variant="label" color={level === 'medium' ? colors.white : colors.ink} numberOfLines={1} style={{ fontSize: 12 }}>
        {t(`charades.play.level.${level}`)} · {t('charades.play.levelPoints', { points: DIFFICULTY_POINTS[level] * multiplier })}
      </T>
    </View>
  );

  const nextRound = () => {
    if (!pendingOutcome) return;
    if (pendingOutcome.kind === 'guessed') updateCharades(awardRound(charades, pendingOutcome.team, pendingOutcome.points));
    else if (pendingOutcome.kind === 'stolen') updateCharades(stealRound(charades));
    else updateCharades(skipRound(charades));
  };

  const adjustTeamScore = (team: 0 | 1, delta: number) => {
    updateCharades(adjustScore(charades, team, delta));
  };

  const spendAssist = (kind: AssistKind) => {
    if (!assistAvailable(charades, teamIndex, kind)) return;
    if (kind === 'extraTime') {
      setTimeLeft((prev) => prev + ASSIST_EXTRA_SECONDS);
      setExtraSeconds((prev) => prev + ASSIST_EXTRA_SECONDS);
    } else if (kind === 'firstLetters') {
      setLettersShown((prev) => ({ ...prev, first: true }));
    } else {
      setLettersShown((prev) => ({ ...prev, last: true }));
    }
    updateCharades(consumeAssist(charades, teamIndex, kind));
  };

  // --- Round result: the "+N للفريق" recap shown after tapping an outcome -----
  if (pendingOutcome) {
    const scoringTeam = pendingOutcome.team;
    const scoringTeamName = scoringTeam === 0 ? charades.teamAName : charades.teamBName;
    const nextTeamName = otherTeamName;
    const bannerBg = pendingOutcome.kind === 'missed' ? colors.mutedBg : colors.green;
    const headline =
      pendingOutcome.kind === 'guessed'
        ? t('charades.play.guessedIt')
        : pendingOutcome.kind === 'stolen'
          ? t('charades.play.stolenOutcome')
          : t('charades.play.notGuessed');
    // The actual score update only lands in `charades.scores` once "next
    // round" is tapped (see `nextRound` above), but showing that stale,
    // not-yet-updated total right next to a "+N for {team}!" banner reads as
    // the wrong team having scored — so this recap previews the outcome
    // already applied, purely for display.
    const previewScores: [number, number] = [...charades.scores];
    if (pendingOutcome.kind !== 'missed') previewScores[scoringTeam] += pendingOutcome.points;
    const breakdown: string[] = [];
    if (pendingOutcome.kind === 'guessed') {
      breakdown.push(`${t(`charades.play.level.${level}`)} ${DIFFICULTY_POINTS[level]}`);
      if (pendingOutcome.elapsed <= SPEED_BONUS_WINDOW_SECONDS) breakdown.push(`${t('charades.play.breakdownFast')} +${SPEED_BONUS_POINTS}`);
      if (doubleRound) breakdown.push(`${t('charades.play.breakdownDouble')} ×2`);
    }
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
            {headline}
          </T>
          {pendingOutcome.kind !== 'missed' ? (
            <View style={styles.resultTag}>
              <T variant="label" color={colors.white} style={{ fontWeight: '900', fontSize: 16 }} numberOfLines={1}>
                {t('charades.play.pointAwardedTo', { team: scoringTeamName, points: pendingOutcome.points })}
              </T>
            </View>
          ) : null}
          {breakdown.length ? (
            <T variant="body" style={{ fontSize: 13 }}>
              {breakdown.join(' · ')}
            </T>
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
          {category} · {formatTime(pendingOutcome.elapsed)}
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

  // --- Reveal + outcome buttons: privacy is over, the group scores it together -
  if (revealed) {
    const guessPoints = pointsForGuess(charades, level, elapsed);
    return (
      <Screen
        scroll
        header={{ title: t('charades.play.round', { round: roundNumber, total: charades.rounds }) }}
        footer={
          <>
            <View style={styles.scoreHeaderRow}>
              <ScoreChip name={charades.teamAName} score={charades.scores[0]} color={colors.purple} onAdjust={(d) => adjustTeamScore(0, d)} />
              <ScoreChip name={charades.teamBName} score={charades.scores[1]} color={colors.green} onAdjust={(d) => adjustTeamScore(1, d)} />
            </View>
            <Spacer size={spacing.md} />
            <Button
              label={t('charades.play.awardWithPoints', { team: teamName, points: guessPoints })}
              accent={colors.green}
              showArrow={false}
              onPress={() => setPendingOutcome({ kind: 'guessed', team: teamIndex, points: guessPoints, elapsed })}
            />
            {timedOut ? (
              <>
                <Spacer size={spacing.sm} />
                <Button
                  label={t('charades.play.steal', { team: otherTeamName, points: STEAL_POINTS })}
                  tone="secondary"
                  showArrow={false}
                  onPress={() => setPendingOutcome({ kind: 'stolen', team: otherTeamIndex, points: STEAL_POINTS, elapsed })}
                />
              </>
            ) : null}
            <Spacer size={spacing.sm} />
            <Button
              label={t('charades.play.skip')}
              tone="ghost"
              showArrow={false}
              onPress={() => setPendingOutcome({ kind: 'missed', team: teamIndex, points: 0, elapsed })}
            />
          </>
        }
      >
        <View style={styles.categoryChipRow}>
          <T variant="heading" color={teamColor}>
            {t('charades.play.turn', { team: teamName })}
          </T>
          {levelChip}
        </View>
        {timedOut ? (
          <>
            <Spacer size={spacing.sm} />
            <T variant="label" color={colors.red} style={{ fontSize: 13 }}>
              {t('charades.play.timeUp', { team: otherTeamName })}
            </T>
          </>
        ) : null}
        <Spacer size={spacing.lg} />
        <View style={[styles.titleCard, cardShadow(lang, teamColor)]}>
          <T style={{ fontFamily: fonts.displayBlack, fontSize: 40, lineHeight: 46 }}>{currentTitle.text}</T>
          <T variant="body" style={{ fontSize: 13 }}>
            {category}
          </T>
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
        header={{ light: true, title: t('charades.play.round', { round: roundNumber, total: charades.rounds }) }}
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
        <RoundProgress round={roundNumber} total={charades.rounds} />
        <Spacer size={spacing.md} />
        <ScoreBlock
          teamAName={charades.teamAName}
          teamAScore={charades.scores[0]}
          teamBName={charades.teamBName}
          teamBScore={charades.scores[1]}
        />
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
          {doubleBanner}
          <View style={styles.categoryChipRow}>
            <T variant="body" color={colors.white} style={{ fontWeight: '700', fontSize: 18 }}>
              {t('charades.play.turnLabel')}
            </T>
            {levelChip}
          </View>
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
        {confirmModal}
      </Screen>
    );
  }

  // --- Acting: timer running, actor sees the word only via the QR scan ---------
  const assistLabel = (kind: AssistKind) =>
    kind === 'extraTime' ? t('charades.play.assist.extraTime', { seconds: ASSIST_EXTRA_SECONDS }) : t(`charades.play.assist.${kind}`);
  return (
    <Screen
      scroll
      header={{ title: t('charades.play.roundTeam', { round: roundNumber, team: teamName }) }}
      footer={<Button label={t('charades.play.endEarly')} tone="secondary" showArrow={false} onPress={() => setEndedEarly(true)} />}
    >
      <View style={styles.timerBlock}>
        <View style={styles.timerRow}>
          <View style={{ gap: 4 }}>
            <T variant="label" style={{ fontSize: 13 }}>
              {t('charades.play.timeLabel')}
            </T>
            {levelChip}
          </View>
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
                width: `${(timeLeft / totalSeconds) * 100}%`,
                backgroundColor: timeLeft <= 10 ? colors.red : colors.purple,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.assistBlock}>
        <View style={styles.assistHeader}>
          <T variant="label" style={{ fontSize: 13 }}>
            {t('charades.play.assists')}
          </T>
          <T variant="body" color={colors.neutral700} style={{ fontSize: 11 }}>
            {t('charades.play.assistHint')}
          </T>
        </View>
        <View style={styles.assistRow}>
          {ASSIST_KINDS.map((kind) => {
            const available = assistAvailable(charades, teamIndex, kind);
            return (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityState={{ disabled: !available }}
                accessibilityLabel={assistLabel(kind)}
                disabled={!available}
                onPress={() => spendAssist(kind)}
                style={({ pressed }) => [
                  styles.assistButton,
                  { backgroundColor: available ? colors.white : colors.mutedBg },
                  pressed && styles.pressed,
                  !available && styles.disabled,
                ]}
              >
                <T variant="label" style={{ fontSize: 12 }} numberOfLines={1}>
                  {assistLabel(kind)}
                </T>
                {!available ? (
                  <T variant="body" color={colors.neutral700} style={{ fontSize: 10 }}>
                    {t('charades.play.assistUsed')}
                  </T>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        {lettersShown.first ? (
          <T variant="heading" style={{ fontSize: 20 }}>
            {t('charades.play.lettersFirst', { letters: revealLetters(currentTitle.text, 'first') })}
          </T>
        ) : null}
        {lettersShown.last ? (
          <T variant="heading" style={{ fontSize: 20 }}>
            {t('charades.play.lettersLast', { letters: revealLetters(currentTitle.text, 'last') })}
          </T>
        ) : null}
      </View>

      <VolumeControl
        volume={prefs.musicVolume}
        muted={prefs.musicMuted}
        onChangeVolume={(v) => setPrefs({ musicVolume: v, musicMuted: false })}
        onToggleMute={() => setPrefs({ musicMuted: !prefs.musicMuted })}
      />

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
  categoryChipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  categoryChip: { paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  levelRow: { flexDirection: 'row', gap: spacing.sm },
  levelCard: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.ink,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: 2,
  },
  doubleBanner: {
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    transform: [{ rotate: '-1deg' }],
  },
  titleCard: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    padding: spacing.lg,
    gap: spacing.md,
    transform: [{ rotate: '-1.5deg' }],
  },
  quitLink: { alignSelf: 'center', paddingVertical: spacing.sm },
  timerBlock: { gap: 6, paddingBottom: spacing.md, borderBottomWidth: 2, borderBottomColor: colors.ink },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  timerTrack: { height: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white, position: 'relative' },
  timerFill: { position: 'absolute', top: 0, bottom: 0 },
  assistBlock: { gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: colors.ink },
  assistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  assistRow: { flexDirection: 'row', gap: spacing.xs },
  assistButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 2,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  volumeMuteButton: {
    width: 30,
    height: 30,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeBar: { flexDirection: 'row', gap: 3, flex: 1 },
  volumeSegment: { flex: 1, height: 14, borderWidth: 2, borderColor: colors.ink },
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
  resultBanner: { padding: spacing.lg, gap: spacing.md, borderBottomWidth: 2, borderBottomColor: colors.ink },
  resultTag: { alignSelf: 'flex-start', backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 4, transform: [{ rotate: '2deg' }] },
});
