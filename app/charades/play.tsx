import { Redirect, router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';
import {
  Button,
  ConfirmModal,
  LowBalanceBanner,
  RoundProgress,
  ScoreBlock,
  Screen,
  Spacer,
  T,
} from '../../src/ui/components';
import { Hero } from '../../src/ui/Hero';
import { cardShadow, colors, fonts, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { useKeepAwake } from '../../src/platform/keepAwake';
import { playSound, preloadSounds, setTimerMusicVolume, startTimerMusic, stopTimerMusic } from '../../src/platform/sound';
import {
  adjustScore,
  awardRound,
  currentTeamIndex,
  isCharadesComplete,
  pointsForElapsed,
  skipRound,
  type CharadesState as ClassicCharadesState,
  type CharadesTitle,
} from '../../src/engine/charades';
import {
  ASSIST_EXTRA_SECONDS,
  ASSIST_KINDS,
  DIFFICULTIES,
  DIFFICULTY_POINTS,
  MAX_STEALS_PER_GAME,
  STEAL_POINTS,
  adjustScore as adjustModifiedScore,
  assistAvailable,
  awardRound as awardModifiedRound,
  canPickDifficulty,
  canSteal,
  consumeAssist,
  currentTeamIndex as currentModifiedTeamIndex,
  isDoubleRound,
  isModifiedCharadesComplete,
  pickDifficulty,
  pointsForGuess,
  revealLetters,
  skipRound as skipModifiedRound,
  stackSizes,
  stealRound,
  stealsLeft,
  type AssistKind,
  type Difficulty,
  type ModifiedCharadesState,
} from '../../src/engine/modifiedCharades';
import { isCharadesComplete as isAnyCharadesComplete, isIdleTooLong, type CharadesState } from '../../src/engine/game';
import { INACTIVITY_LIMIT_SECONDS, ROUND_SECONDS } from '../../src/engine/rules';
import { resolveRevealBaseUrl } from '../../src/engine/reveal';
import { CATALOGUE_API_URL, REVEAL_BASE_URL } from '../../src/config';

/** The countdown ticks audibly for its last half-minute, same as a real game-show clock. */
const TICK_SECONDS = 30;

/** The "no activity" warning shows for the last this-many seconds before an idle game ends. */
const IDLE_WARNING_SECONDS = 30;

/** How often a tap on the play screen is written to the saved game — often enough to judge a reopened game, rarely enough not to write on every touch. */
const ACTIVITY_SAVE_EVERY_MS = 10_000;

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

/**
 * The acting clock for one round. Measured against the wall clock (when the
 * timer was started, when it was stopped) rather than by counting interval
 * ticks, so a throttled or backgrounded timer can't drift, and kept apart
 * from the time left — an "extra time" assist lengthens the round without
 * making the guess look faster than it was, which is what the points depend
 * on. Everything is stamped with its round: a clock left over from the
 * round before reads as not started, so the next round never flashes the
 * previous round's reveal (or its title) for a frame.
 */
function useRoundClock(round: number) {
  const [clock, setClock] = useState<{ round: number; startedAt: number; stoppedAt: number | null; extraSeconds: number } | null>(
    null
  );
  const [now, setNow] = useState(() => Date.now());
  const current = clock && clock.round === round ? clock : null;
  const limit = ROUND_SECONDS + (current?.extraSeconds ?? 0);
  const elapsed = current ? Math.min(limit, Math.max(0, Math.floor(((current.stoppedAt ?? now) - current.startedAt) / 1000))) : 0;
  const timeLeft = limit - elapsed;
  const started = current !== null;
  const endedEarly = current?.stoppedAt != null;
  const running = started && !endedEarly && timeLeft > 0;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setClock({ round, startedAt: t, stoppedAt: null, extraSeconds: 0 });
  }, [round]);
  const endEarly = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setClock((c) => (c && c.round === round && c.stoppedAt === null ? { ...c, stoppedAt: t } : c));
  }, [round]);
  const addTime = useCallback(
    (seconds: number) => setClock((c) => (c && c.round === round ? { ...c, extraSeconds: c.extraSeconds + seconds } : c)),
    [round]
  );

  return { started, endedEarly, elapsed, timeLeft, limit, running, timeUp: started && !endedEarly && timeLeft <= 0, start, endEarly, addTime };
}

/** Ticks for the last TICK_SECONDS, a buzzer at zero, and the background track while the actor is up. */
function useRoundSounds(running: boolean, started: boolean, timeLeft: number, round: number) {
  const { prefs } = useApp();
  const musicVolume = prefs.musicMuted ? 0 : prefs.musicVolume;

  useEffect(() => {
    preloadSounds();
  }, []);

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

  // Started once per round rather than alongside the bell tap, so it also
  // covers a re-render/remount mid-round, and stopped the instant the round
  // ends however it ends. `musicVolume` is deliberately left out of the
  // dependency list: the effect below adjusts an already-playing track live,
  // and including it here would restart the track on every volume change.
  useEffect(() => {
    if (!running) return;
    void startTimerMusic(musicVolume);
    return () => {
      void stopTimerMusic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, round]);

  useEffect(() => {
    void setTimerMusicVolume(musicVolume);
  }, [musicVolume]);
}

/**
 * Mints the single-use token the handoff screen's QR code links to, server
 * side, so the server can refuse every scan after the first one (see
 * server/src/routes/reveal.ts) — otherwise anyone pointed at the shared
 * screen, an opposing player included, could peek at the answer. `null`
 * until the round-trip resolves, or if it fails.
 */
function useRevealToken(title: CharadesTitle | null, active: boolean, round: number) {
  const { mintRevealToken } = useApp();
  const [token, setToken] = useState<{ round: number; titleId: string; id: string } | null>(null);
  useEffect(() => {
    if (!active || !title) return;
    let cancelled = false;
    const absoluteImageUrl = title.imageUrl ? `${CATALOGUE_API_URL}${title.imageUrl}` : undefined;
    void mintRevealToken(title.text, title.deckNameAr, title.deckNameEn, absoluteImageUrl).then((id) => {
      if (!cancelled && id) setToken({ round, titleId: title.id, id });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, title?.id, round, mintRevealToken]);
  return token && title && token.round === round && token.titleId === title.id ? token.id : null;
}

/**
 * Ends the game once nobody has touched the play screen for
 * INACTIVITY_LIMIT_SECONDS — the same 2 minutes a move is allowed. The
 * acting clock is its own limit, so while it runs (`paused`) the game
 * counts as active; the idle count starts again the moment it stops. Taps
 * are also saved (every few seconds at most) into the game itself, so a
 * game reopened after sitting idle — app closed, phone put away — ends too
 * instead of picking up where it was.
 */
function useIdleEnd(charades: CharadesState | null, paused: boolean) {
  const { markCharadesActivity, endCharadesForInactivity } = useApp();
  const live = charades !== null && charades.lock === 'unlocked' && !isAnyCharadesComplete(charades);
  const lastActivity = useRef(Date.now());
  const lastSaved = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  const record = useCallback(
    (t: number) => {
      lastActivity.current = t;
      setNow(t);
      if (t - lastSaved.current >= ACTIVITY_SAVE_EVERY_MS) {
        lastSaved.current = t;
        markCharadesActivity(t);
      }
    },
    [markCharadesActivity]
  );

  // A game reopened after sitting idle past the limit is over already.
  const checkedOnOpen = useRef(false);
  useEffect(() => {
    if (!live || checkedOnOpen.current || !charades) return;
    checkedOnOpen.current = true;
    if (isIdleTooLong(charades, Date.now())) endCharadesForInactivity();
    else record(Date.now());
  }, [live, charades, record, endCharadesForInactivity]);

  // The acting clock stopping counts as activity — the idle count starts from there.
  useEffect(() => {
    if (!paused) lastActivity.current = Date.now();
  }, [paused]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      const t = Date.now();
      if (paused) {
        record(t);
        return;
      }
      setNow(t);
      if (t - lastActivity.current >= INACTIVITY_LIMIT_SECONDS * 1000) endCharadesForInactivity();
    }, 1000);
    return () => clearInterval(id);
  }, [live, paused, record, endCharadesForInactivity]);

  const secondsLeft =
    live && !paused ? Math.max(0, INACTIVITY_LIMIT_SECONDS - Math.floor((now - lastActivity.current) / 1000)) : null;
  return { onActivity: () => record(Date.now()), secondsLeft };
}

/** Catches every tap anywhere on the play screen (without taking it) and shows the warning before an idle game ends. */
function ActivityBoundary({
  onActivity,
  secondsLeft,
  children,
}: {
  onActivity: () => void;
  secondsLeft: number | null;
  children: React.ReactNode;
}) {
  const { t } = useApp();
  return (
    <View
      style={styles.activityBoundary}
      onStartShouldSetResponderCapture={() => {
        onActivity();
        return false;
      }}
    >
      {children}
      {secondsLeft !== null && secondsLeft <= IDLE_WARNING_SECONDS ? (
        <View style={styles.idleBanner} pointerEvents="none" accessibilityLiveRegion="polite">
          <T variant="label" color={colors.white} align="center" style={{ fontSize: 13 }}>
            {t('charades.play.idleWarning', { time: formatTime(secondsLeft) })}
          </T>
        </View>
      ) : null}
    </View>
  );
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

/** "End game" link plus its confirmation — the same on every in-round screen. */
function QuitControl() {
  const { t, quitCharades } = useApp();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={t('charades.play.quit')} onPress={() => setConfirming(true)} style={styles.quitLink}>
        <T variant="label" color={colors.red} style={{ fontSize: 13 }}>
          {t('charades.play.quit')}
        </T>
      </Pressable>
      <ConfirmModal
        visible={confirming}
        title={t('charades.play.quitConfirm')}
        confirmLabel={t('charades.play.quit')}
        cancelLabel={t('common.back')}
        destructive
        onConfirm={() => {
          setConfirming(false);
          quitCharades();
          router.replace('/home');
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

/** The final scoreboard — after the last round, or straight away for a game ended for inactivity. */
function FinalScreen({ state }: { state: CharadesState }) {
  const { t, quitCharades } = useApp();
  const [scoreA, scoreB] = state.scores;
  const winner = scoreA === scoreB ? null : scoreA > scoreB ? state.teamAName : state.teamBName;
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
            onPress={() => {
              quitCharades();
              router.replace('/charades/draft');
            }}
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
      {state.endedReason === 'inactivity' ? (
        <View style={styles.endedNotice}>
          <T variant="label" color={colors.white} align="center">
            {t('charades.play.endedInactive')}
          </T>
        </View>
      ) : null}
      <Spacer size={spacing.lg} />
      <View style={styles.finalTop}>
        <View style={{ gap: 6, flex: 1 }}>
          <T variant="label" color={colors.green} style={{ fontSize: 15 }}>
            {winner ? t('charades.play.winningTeam') : t('charades.play.finalScore')}
          </T>
          <T style={{ fontFamily: fonts.displayBlack, fontSize: 56, lineHeight: 62, color: colors.white, transform: [{ rotate: '-3deg' }] }}>
            {winner ?? t('charades.play.tie')}
          </T>
        </View>
      </View>
      <Spacer size={spacing.lg} />
      <ScoreBlock teamAName={state.teamAName} teamAScore={scoreA} teamBName={state.teamBName} teamBScore={scoreB} big light />
      <Spacer size={spacing.lg} />
      <LowBalanceBanner light />
    </Screen>
  );
}

/**
 * How a round ended, held on screen until "next round" is tapped — only
 * then does the score actually change. Stamped with its round, so it can't
 * outlive it: the moment the game moves on, a stale outcome no longer
 * counts (it used to linger for a frame and show the points twice).
 */
interface PendingOutcome {
  round: number;
  kind: 'award' | 'steal' | 'skip';
  /** Who scores — the acting team for an award, the other team for a steal. */
  team: 0 | 1;
  points: number;
}

/** The "+N for the team" recap between rounds. */
function RoundRecap({
  state,
  outcome,
  title,
  elapsed,
  isLastRound,
  onNext,
}: {
  state: CharadesState;
  outcome: PendingOutcome;
  title: CharadesTitle;
  elapsed: number;
  isLastRound: boolean;
  onNext: () => void;
}) {
  const { t, lang } = useApp();
  const scored = outcome.kind !== 'skip';
  const scorerName = outcome.team === 0 ? state.teamAName : state.teamBName;
  // Turns strictly alternate by round, whoever scored — after a steal the
  // next team up is still decided by the round number, not by the stealer.
  const nextTeamName = (state.index + 1) % 2 === 0 ? state.teamAName : state.teamBName;
  // The score only lands in `state.scores` once "next round" is tapped, so
  // the recap previews it already applied, purely for display.
  const previewScores: [number, number] = [...state.scores];
  if (scored) previewScores[outcome.team] += outcome.points;
  const category = lang === 'ar' ? title.deckNameAr : title.deckNameEn;
  return (
    <Screen
      scroll
      header={{ title: t('app.name') }}
      footer={
        <>
          {!isLastRound ? (
            <>
              <T variant="label" color={colors.neutral700} style={{ fontSize: 13, fontWeight: '500' }}>
                {t('charades.play.nextTurn', { team: nextTeamName })}
              </T>
              <Spacer size={spacing.sm} />
            </>
          ) : null}
          <Button label={t('charades.play.nextRound')} onPress={onNext} />
        </>
      }
    >
      <View style={[styles.resultBanner, { backgroundColor: scored ? colors.green : colors.mutedBg }]}>
        <T style={{ fontFamily: fonts.displayBlack, fontSize: 48, lineHeight: 56, color: colors.ink, transform: [{ rotate: '-4deg' }] }}>
          {scored ? t('charades.play.guessedIt') : t('charades.play.notGuessed')}
        </T>
        {scored ? (
          <View style={styles.resultTag}>
            <T variant="label" color={colors.white} style={{ fontWeight: '900', fontSize: 16 }} numberOfLines={1}>
              {t('charades.play.pointAwardedTo', { team: scorerName, points: outcome.points })}
            </T>
          </View>
        ) : null}
      </View>
      <Spacer size={spacing.md} />
      <T variant="label" color={colors.neutral700} style={{ fontSize: 12, fontWeight: '500' }}>
        {t('charades.play.answerReveal')}
      </T>
      <T variant="heading" style={{ fontSize: 24 }}>
        {title.text}
      </T>
      <T variant="body" style={{ fontSize: 13 }}>
        {category} · {formatTime(elapsed)}
      </T>
      <Spacer size={spacing.md} />
      <ScoreBlock teamAName={state.teamAName} teamAScore={previewScores[0]} teamBName={state.teamBName} teamBScore={previewScores[1]} />
    </Screen>
  );
}

/**
 * The full-purple turn handoff with the reveal QR code. Laid out to fit a
 * phone without scrolling — compact scores, a smaller QR on short screens —
 * since the code is the one thing on it the actor has to reach.
 */
function HandoffScreen({
  state,
  round,
  total,
  teamName,
  revealUrl,
  onStart,
}: {
  state: CharadesState;
  round: number;
  total: number;
  teamName: string;
  revealUrl: string | null;
  onStart: () => void;
}) {
  const { t, lang } = useApp();
  const { height } = useWindowDimensions();
  const short = height < 700;
  const qrSize = short ? 112 : height < 760 ? 128 : 168;
  return (
    <Screen
      scroll
      background={colors.purple}
      header={{ light: true, title: t('charades.play.round', { round, total }) }}
      footer={<Button label={t('charades.play.startTimer')} tone="secondary" background={colors.white} forceShadow onPress={onStart} />}
    >
      <RoundProgress round={round} total={total} />
      <ScoreBlock teamAName={state.teamAName} teamAScore={state.scores[0]} teamBName={state.teamBName} teamBScore={state.scores[1]} compact />
      <View style={{ gap: spacing.sm }}>
        <T variant="body" color={colors.white} style={{ fontWeight: '700', fontSize: 16 }}>
          {t('charades.play.turnLabel')}
        </T>
        <T
          style={{
            fontFamily: fonts.displayBlack,
            fontSize: short ? 34 : 44,
            lineHeight: short ? 40 : 52,
            color: colors.white,
            transform: [{ rotate: '-3deg' }],
          }}
          numberOfLines={1}
        >
          {teamName}
        </T>
        <T variant="body" color={colors.white} style={{ fontSize: 14 }}>
          {t('charades.play.handoffInstruction')}
        </T>
      </View>
      <View style={[styles.qrCard, cardShadow(lang, colors.ink)]}>
        {revealUrl ? (
          <QRCode value={revealUrl} size={qrSize} />
        ) : (
          <T variant="label" align="center" color={colors.neutral700}>
            {t('charades.play.scanUnavailable')}
          </T>
        )}
      </View>
    </Screen>
  );
}

/** The running clock, its bar, and the background-music control — the acting screen's top half in both modes. */
function ActingClock({ timeLeft, limit }: { timeLeft: number; limit: number }) {
  const { t, lang, prefs, setPrefs } = useApp();
  return (
    <>
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
              { width: `${Math.min(100, (timeLeft / limit) * 100)}%`, backgroundColor: timeLeft <= 10 ? colors.red : colors.purple },
            ]}
          />
        </View>
      </View>
      <VolumeControl
        volume={prefs.musicVolume}
        muted={prefs.musicMuted}
        onChangeVolume={(v) => setPrefs({ musicVolume: v, musicMuted: false })}
        onToggleMute={() => setPrefs({ musicMuted: !prefs.musicMuted })}
      />
    </>
  );
}

/** The revealed title card, shown once the round's clock stops. */
function TitleCard({ title, teamColor }: { title: CharadesTitle; teamColor: string }) {
  const { lang } = useApp();
  const absoluteImageUrl = title.imageUrl ? `${CATALOGUE_API_URL}${title.imageUrl}` : undefined;
  return (
    <View style={[styles.titleCard, cardShadow(lang, teamColor)]}>
      <T style={{ fontFamily: fonts.displayBlack, fontSize: 36, lineHeight: 44 }}>{title.text}</T>
      {absoluteImageUrl ? (
        <Image source={{ uri: absoluteImageUrl }} style={{ width: '100%', height: 180 }} resizeMode="contain" accessibilityLabel={title.text} />
      ) : null}
    </View>
  );
}

function revealUrlFor(tokenId: string | null): string | null {
  const baseUrl = resolveRevealBaseUrl(REVEAL_BASE_URL, webOrigin());
  return baseUrl && tokenId ? `${baseUrl}/reveal?id=${encodeURIComponent(tokenId)}` : null;
}

function ClassicPlayScreen() {
  useKeepAwake();
  const { t, lang, charades: charadesUnion, updateCharades: updateCharadesUnion } = useApp();
  // This screen only ever renders for a classic-mode game or none at all — the
  // dispatcher at the bottom of this file never mounts it for a modified one.
  const charades = charadesUnion as ClassicCharadesState | null;
  const updateCharades = updateCharadesUnion as (next: ClassicCharadesState) => void;

  // Hooks run unconditionally, before the early-return redirects below — so
  // every one of them has to tolerate `charades` being null.
  const round = charades?.index ?? -1;
  const live = charades !== null && charades.lock === 'unlocked' && !isCharadesComplete(charades);
  const currentTitle = live ? charades.titles[charades.index] : null;
  const clock = useRoundClock(round);
  const [pending, setPending] = useState<PendingOutcome | null>(null);
  const outcome = pending && pending.round === round ? pending : null;
  const revealTokenId = useRevealToken(currentTitle, live && !clock.started, round);
  useRoundSounds(clock.running, clock.started, clock.timeLeft, round);
  const idle = useIdleEnd(charades, clock.running);

  if (!charades) return <Redirect href="/charades/draft" />;
  if (charades.lock !== 'unlocked') return <Redirect href="/charades/checkout" />;
  if (isCharadesComplete(charades) || !currentTitle) return <FinalScreen state={charades} />;

  const wrap = (node: React.ReactNode) => (
    <ActivityBoundary onActivity={idle.onActivity} secondsLeft={idle.secondsLeft}>
      {node}
    </ActivityBoundary>
  );
  const total = charades.titles.length;
  const teamIndex = currentTeamIndex(charades);
  const teamName = teamIndex === 0 ? charades.teamAName : charades.teamBName;
  const teamColor = teamIndex === 0 ? colors.purple : colors.green;
  const category = lang === 'ar' ? currentTitle.deckNameAr : currentTitle.deckNameEn;

  // --- Round result: the "+N for the team" recap shown after award/skip ----
  if (outcome) {
    return wrap(
      <RoundRecap
        state={charades}
        outcome={outcome}
        title={currentTitle}
        elapsed={clock.elapsed}
        isLastRound={charades.index + 1 >= total}
        onNext={() =>
          updateCharades(outcome.kind === 'award' ? awardRound(charades, outcome.team, outcome.points) : skipRound(charades))
        }
      />
    );
  }

  // --- Reveal + score buttons: privacy is over, the group scores it together ----
  if (clock.endedEarly || clock.timeUp) {
    return wrap(
      <Screen
        scroll
        header={{ title: t('charades.play.round', { round: charades.index + 1, total }) }}
        footer={
          <>
            <View style={styles.scoreHeaderRow}>
              <ScoreChip
                name={charades.teamAName}
                score={charades.scores[0]}
                color={colors.purple}
                onAdjust={(d) => updateCharades(adjustScore(charades, 0, d))}
              />
              <ScoreChip
                name={charades.teamBName}
                score={charades.scores[1]}
                color={colors.green}
                onAdjust={(d) => updateCharades(adjustScore(charades, 1, d))}
              />
            </View>
            <Spacer size={spacing.md} />
            {clock.timeUp ? (
              // The 2 minutes are the whole move: a guess after the buzzer
              // doesn't score (it used to still award a point).
              <>
                <T variant="label" color={colors.red} align="center" style={{ fontSize: 13 }}>
                  {t('charades.play.timesUp')} {t('charades.play.timesUpNoPoints')}
                </T>
                <Spacer size={spacing.xs} />
                <Button
                  label={t('charades.play.nextRound')}
                  onPress={() => setPending({ round, kind: 'skip', team: teamIndex, points: 0 })}
                />
              </>
            ) : (
              <View style={styles.actingFooterGrid}>
                <Button
                  label={t('charades.play.award', { team: teamName })}
                  accent={colors.green}
                  showArrow={false}
                  style={{ flex: 2 }}
                  onPress={() => setPending({ round, kind: 'award', team: teamIndex, points: pointsForElapsed(clock.elapsed) })}
                />
                <Button
                  label={t('charades.play.skip')}
                  tone="secondary"
                  showArrow={false}
                  style={{ flex: 1 }}
                  onPress={() => setPending({ round, kind: 'skip', team: teamIndex, points: 0 })}
                />
              </View>
            )}
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
        <Spacer size={spacing.sm} />
        <TitleCard title={currentTitle} teamColor={teamColor} />
        <Spacer size={spacing.sm} />
        <QuitControl />
      </Screen>
    );
  }

  // --- Not yet started: full-purple turn handoff -------------------------------
  if (!clock.started) {
    return wrap(
      <HandoffScreen
        state={charades}
        round={charades.index + 1}
        total={total}
        teamName={teamName}
        revealUrl={revealUrlFor(revealTokenId)}
        onStart={() => {
          void playSound('bell');
          clock.start();
        }}
      />
    );
  }

  // --- Acting: timer running, actor sees the word only via the QR scan ---------
  return wrap(
    <Screen
      scroll
      header={{ title: t('charades.play.roundTeam', { round: charades.index + 1, team: teamName }) }}
      footer={<Button label={t('charades.play.endEarly')} tone="secondary" showArrow={false} onPress={clock.endEarly} />}
    >
      <ActingClock timeLeft={clock.timeLeft} limit={clock.limit} />
      <QuitControl />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Hero animateLogo />
      </View>
    </Screen>
  );
}

const DIFFICULTY_COLOR: Record<Difficulty, string> = { easy: colors.green, medium: colors.purple, hard: colors.red };
const DIFFICULTY_LABEL_KEY: Record<Difficulty, 'charades.play.difficultyEasy' | 'charades.play.difficultyMedium' | 'charades.play.difficultyHard'> = {
  easy: 'charades.play.difficultyEasy',
  medium: 'charades.play.difficultyMedium',
  hard: 'charades.play.difficultyHard',
};

function ModifiedPlayScreen() {
  useKeepAwake();
  const { t, lang, charades: charadesUnion, updateCharades: updateCharadesUnion } = useApp();
  // This screen only ever renders for a modified-mode game — see the
  // dispatcher at the bottom of this file.
  const charades = charadesUnion as ModifiedCharadesState | null;
  const updateCharades = updateCharadesUnion as (next: ModifiedCharadesState) => void;

  const round = charades?.index ?? -1;
  const live = charades !== null && charades.lock === 'unlocked' && !isModifiedCharadesComplete(charades);
  const currentTitle = live ? charades.current : null;
  const clock = useRoundClock(round);
  const [pending, setPending] = useState<PendingOutcome | null>(null);
  const outcome = pending && pending.round === round ? pending : null;
  const [hint, setHint] = useState<{ round: number; kind: AssistKind } | null>(null);
  const hintKind = hint && hint.round === round ? hint.kind : null;
  const revealTokenId = useRevealToken(currentTitle, live && !clock.started, round);
  useRoundSounds(clock.running, clock.started, clock.timeLeft, round);
  const idle = useIdleEnd(charades, clock.running);

  if (!charades) return <Redirect href="/charades/draft" />;
  if (charades.lock !== 'unlocked') return <Redirect href="/charades/checkout" />;
  if (isModifiedCharadesComplete(charades)) return <FinalScreen state={charades} />;

  const wrap = (node: React.ReactNode) => (
    <ActivityBoundary onActivity={idle.onActivity} secondsLeft={idle.secondsLeft}>
      {node}
    </ActivityBoundary>
  );
  const teamIndex = currentModifiedTeamIndex(charades);
  const teamName = teamIndex === 0 ? charades.teamAName : charades.teamBName;
  const teamColor = teamIndex === 0 ? colors.purple : colors.green;
  const doubleRound = isDoubleRound(charades);

  // --- Not yet picked: the acting team chooses a difficulty level ------------
  if (currentTitle === null) {
    const sizes = stackSizes(charades);
    return wrap(
      <Screen scroll header={{ title: t('charades.play.round', { round: charades.index + 1, total: charades.rounds }) }}>
        {doubleRound ? (
          <View style={styles.doubleRoundBanner}>
            <T variant="label" color={colors.white}>
              {t('charades.play.doubleRound')}
            </T>
          </View>
        ) : null}
        <T variant="heading" color={teamColor}>
          {t('charades.play.turn', { team: teamName })}
        </T>
        <T variant="body" color={colors.neutral700} style={{ fontSize: 13, fontWeight: '500' }}>
          {t('charades.play.chooseDifficulty')}
        </T>
        {DIFFICULTIES.map((difficulty) => {
          const pickable = canPickDifficulty(charades, difficulty);
          return (
            <Pressable
              key={difficulty}
              accessibilityRole="button"
              accessibilityLabel={t(DIFFICULTY_LABEL_KEY[difficulty])}
              accessibilityState={{ disabled: !pickable }}
              disabled={!pickable}
              onPress={() => updateCharades(pickDifficulty(charades, difficulty))}
              style={({ pressed }) => [
                styles.difficultyRow,
                { borderColor: colors.ink, backgroundColor: DIFFICULTY_COLOR[difficulty] },
                pressed && styles.pressed,
                !pickable && styles.disabled,
              ]}
            >
              <T style={{ fontFamily: fonts.displayBlack, fontSize: 20, color: colors.white }}>{t(DIFFICULTY_LABEL_KEY[difficulty])}</T>
              <T variant="label" color={colors.white}>
                {sizes[difficulty] > 0
                  ? t('charades.play.difficultyPoints', { points: DIFFICULTY_POINTS[difficulty] * (doubleRound ? 2 : 1) })
                  : t('charades.play.difficultyEmpty')}
              </T>
            </Pressable>
          );
        })}
        <T variant="label" color={colors.neutral700} style={{ fontSize: 12, fontWeight: '500' }}>
          {t('charades.play.stealsLeft', { count: stealsLeft(charades), max: MAX_STEALS_PER_GAME })}
        </T>
        <QuitControl />
      </Screen>
    );
  }

  const category = lang === 'ar' ? currentTitle.deckNameAr : currentTitle.deckNameEn;

  // --- Round result recap -------------------------------------------------
  if (outcome) {
    return wrap(
      <RoundRecap
        state={charades}
        outcome={outcome}
        title={currentTitle}
        elapsed={clock.elapsed}
        isLastRound={charades.index + 1 >= charades.rounds}
        onNext={() =>
          updateCharades(
            outcome.kind === 'steal'
              ? stealRound(charades)
              : outcome.kind === 'award'
                ? awardModifiedRound(charades, outcome.team, outcome.points)
                : skipModifiedRound(charades)
          )
        }
      />
    );
  }

  // --- Reveal + score buttons ----------------------------------------------
  if (clock.endedEarly || clock.timeUp) {
    const stealerIndex: 0 | 1 = teamIndex === 0 ? 1 : 0;
    const stealerName = stealerIndex === 0 ? charades.teamAName : charades.teamBName;
    const stealAllowed = canSteal(charades);
    return wrap(
      <Screen
        scroll
        header={{ title: t('charades.play.round', { round: charades.index + 1, total: charades.rounds }) }}
        footer={
          <>
            <View style={styles.scoreHeaderRow}>
              <ScoreChip
                name={charades.teamAName}
                score={charades.scores[0]}
                color={colors.purple}
                onAdjust={(d) => updateCharades(adjustModifiedScore(charades, 0, d))}
              />
              <ScoreChip
                name={charades.teamBName}
                score={charades.scores[1]}
                color={colors.green}
                onAdjust={(d) => updateCharades(adjustModifiedScore(charades, 1, d))}
              />
            </View>
            <Spacer size={spacing.md} />
            {clock.timeUp ? (
              <>
                <T variant="label" color={colors.red} align="center" style={{ fontSize: 13 }}>
                  {t('charades.play.timesUp')}{' '}
                  {stealAllowed
                    ? t('charades.play.stealsLeft', { count: stealsLeft(charades), max: MAX_STEALS_PER_GAME })
                    : t('charades.play.noStealsLeft')}
                </T>
                <Spacer size={spacing.xs} />
                <View style={styles.actingFooterGrid}>
                  <Button
                    label={t('charades.play.stealAward', { team: stealerName })}
                    accent={colors.green}
                    showArrow={false}
                    disabled={!stealAllowed}
                    style={{ flex: 2 }}
                    onPress={() => setPending({ round, kind: 'steal', team: stealerIndex, points: STEAL_POINTS })}
                  />
                  <Button
                    label={t('charades.play.noSteal')}
                    tone="secondary"
                    showArrow={false}
                    style={{ flex: 1 }}
                    onPress={() => setPending({ round, kind: 'skip', team: teamIndex, points: 0 })}
                  />
                </View>
              </>
            ) : (
              <View style={styles.actingFooterGrid}>
                <Button
                  label={t('charades.play.award', { team: teamName })}
                  accent={colors.green}
                  showArrow={false}
                  style={{ flex: 2 }}
                  onPress={() =>
                    setPending({
                      round,
                      kind: 'award',
                      team: teamIndex,
                      points: pointsForGuess(charades, currentTitle.difficulty, clock.elapsed),
                    })
                  }
                />
                <Button
                  label={t('charades.play.skip')}
                  tone="secondary"
                  showArrow={false}
                  style={{ flex: 1 }}
                  onPress={() => setPending({ round, kind: 'skip', team: teamIndex, points: 0 })}
                />
              </View>
            )}
          </>
        }
      >
        <View style={styles.categoryChipRow}>
          <T variant="heading" color={teamColor}>
            {t('charades.play.turn', { team: teamName })}
          </T>
          <View style={[styles.categoryChip, { backgroundColor: DIFFICULTY_COLOR[currentTitle.difficulty] }]}>
            <T variant="label" color={colors.white} numberOfLines={1}>
              {category} · {t(DIFFICULTY_LABEL_KEY[currentTitle.difficulty])}
            </T>
          </View>
        </View>
        <Spacer size={spacing.sm} />
        <TitleCard title={currentTitle} teamColor={teamColor} />
        <Spacer size={spacing.sm} />
        <QuitControl />
      </Screen>
    );
  }

  // --- Not yet started: full handoff with QR ------------------------------
  if (!clock.started) {
    return wrap(
      <HandoffScreen
        state={charades}
        round={charades.index + 1}
        total={charades.rounds}
        teamName={teamName}
        revealUrl={revealUrlFor(revealTokenId)}
        onStart={() => {
          void playSound('bell');
          clock.start();
        }}
      />
    );
  }

  // --- Acting: timer running, optional assist hints -------------------------
  const applyAssist = (kind: AssistKind) => {
    if (!assistAvailable(charades, teamIndex, kind)) return;
    updateCharades(consumeAssist(charades, teamIndex, kind));
    if (kind === 'extraTime') clock.addTime(ASSIST_EXTRA_SECONDS);
    else setHint({ round, kind });
  };
  const hintText =
    hintKind === 'firstLetters' || hintKind === 'lastLetters'
      ? revealLetters(currentTitle.text, hintKind === 'firstLetters' ? 'first' : 'last')
      : null;
  return wrap(
    <Screen
      scroll
      header={{ title: t('charades.play.roundTeam', { round: charades.index + 1, team: teamName }) }}
      footer={<Button label={t('charades.play.endEarly')} tone="secondary" showArrow={false} onPress={clock.endEarly} />}
    >
      <ActingClock timeLeft={clock.timeLeft} limit={clock.limit} />

      {hintText ? (
        <T variant="heading" align="center" style={{ fontSize: 22, letterSpacing: 2 }}>
          {hintText}
        </T>
      ) : null}

      <View style={styles.assistRow}>
        {ASSIST_KINDS.map((kind) => {
          const available = assistAvailable(charades, teamIndex, kind);
          const label =
            kind === 'firstLetters'
              ? t('charades.play.assistFirstLetters')
              : kind === 'lastLetters'
                ? t('charades.play.assistLastLetters')
                : t('charades.play.assistExtraTime', { seconds: ASSIST_EXTRA_SECONDS });
          return (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={label}
              disabled={!available}
              onPress={() => applyAssist(kind)}
              style={({ pressed }) => [styles.assistButton, pressed && styles.pressed, !available && styles.disabled]}
            >
              <T variant="label" style={{ fontSize: 11 }} numberOfLines={1}>
                {available ? label : `${label} · ${t('charades.play.assistUsed')}`}
              </T>
            </Pressable>
          );
        })}
      </View>

      <QuitControl />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Hero animateLogo />
      </View>
    </Screen>
  );
}

export default function CharadesPlay() {
  const { charades } = useApp();
  return charades?.mode === 'modified' ? <ModifiedPlayScreen /> : <ClassicPlayScreen />;
}

const styles = StyleSheet.create({
  activityBoundary: { flex: 1 },
  idleBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.red,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  endedNotice: { borderWidth: 2, borderColor: colors.white, padding: spacing.sm },
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  finalTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  resultBanner: { padding: spacing.lg, gap: spacing.xl, borderBottomWidth: 2, borderBottomColor: colors.ink },
  resultTag: { alignSelf: 'flex-start', backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 4, transform: [{ rotate: '2deg' }] },
  doubleRoundBanner: { backgroundColor: colors.red, padding: spacing.sm, alignItems: 'center' },
  difficultyRow: {
    borderWidth: 2,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assistRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  assistButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingVertical: spacing.xs,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
