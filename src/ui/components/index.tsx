import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HIT_SIZE, colors, onAccent, radius, spacing, type } from '../theme';

/* ------------------------------------------------------------------ text */

type TextVariant = keyof typeof type;

export function T({
  variant = 'body',
  color = colors.text,
  align = 'auto',
  style,
  children,
  numberOfLines,
  accessibilityLabel,
}: {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
  accessibilityLabel?: string;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel}
      // `textAlign: auto` follows the layout direction, so the same component
      // aligns right in Arabic and left in English with no branching.
      style={[type[variant], { color, textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}

/* ---------------------------------------------------------------- screen */

export function Screen({
  children,
  scroll = false,
  background = colors.bg,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  background?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const inner = (
    <View style={[styles.screenInner, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: background }]} edges={['top', 'bottom']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

/* --------------------------------------------------------------- buttons */

export function Button({
  label,
  onPress,
  tone = 'primary',
  accent = colors.accent,
  disabled = false,
  busy = false,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
  accent?: string;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const palette: Record<string, { bg: string; fg: string; border: string }> = {
    primary: { bg: accent, fg: onAccent, border: accent },
    secondary: { bg: 'transparent', fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.textMuted, border: 'transparent' },
    danger: { bg: 'transparent', fg: colors.skip, border: colors.skip },
  };
  const p = palette[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: p.bg, borderColor: p.border },
        pressed && styles.pressed,
        (disabled || busy) && styles.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <T variant="heading" color={p.fg} align="center">
          {label}
        </T>
      )}
    </Pressable>
  );
}

/**
 * The two controls a performer uses mid-round. Deliberately enormous: the
 * phone is often on a forehead or being waved around.
 */
export function BigChoice({
  label,
  onPress,
  color,
  disabled,
  hint,
}: {
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bigChoice,
        { backgroundColor: color },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <T variant="title" color={onAccent} align="center">
        {label}
      </T>
    </Pressable>
  );
}

/* ------------------------------------------------------------ selectables */

export function OptionCard({
  title,
  subtitle,
  selected,
  onPress,
  accent = colors.accent,
  badge,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
  accent?: string;
  badge?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: Boolean(selected) }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        selected && { borderColor: accent, backgroundColor: colors.bgRaised },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.optionRow}>
        {/* A colour bar plus a check mark: selection never depends on hue alone. */}
        <View style={[styles.optionBar, { backgroundColor: selected ? accent : colors.border }]} />
        <View style={styles.optionText}>
          <T variant="heading">{title}</T>
          {subtitle ? (
            <T variant="label" color={colors.textMuted}>
              {subtitle}
            </T>
          ) : null}
        </View>
        {badge ? (
          <View style={[styles.badge, { borderColor: accent }]}>
            <T variant="label" color={accent}>
              {badge}
            </T>
          </View>
        ) : null}
        {selected ? (
          <T variant="heading" color={accent}>
            ✓
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  description?: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
    >
      <View style={styles.optionText}>
        <T variant="body">{label}</T>
        {description ? (
          <T variant="label" color={colors.textMuted}>
            {description}
          </T>
        ) : null}
      </View>
      <View style={[styles.toggleTrack, value && { backgroundColor: colors.correct }]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ bits */

export function Pill({ text, color = colors.accent }: { text: string; color?: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <T variant="label" color={color}>
        {text}
      </T>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Spacer({ size = spacing.md }: { size?: number }) {
  return <View style={{ height: size }} />;
}

/** A row of dots showing how far through the session the group is. */
export function RoundProgress({ round, total }: { round: number; total: number }) {
  const capped = Math.min(total, 24);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: round, min: 0, max: total }}
      style={styles.progressRow}
    >
      {Array.from({ length: capped }, (_, i) => (
        <View
          key={i}
          style={[styles.progressDot, i < round && { backgroundColor: colors.accent }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenInner: { flex: 1, padding: spacing.lg, gap: spacing.md },
  scrollContent: { flexGrow: 1 },
  button: {
    minHeight: HIT_SIZE,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigChoice: {
    flex: 1,
    minHeight: 110,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.4 },
  optionCard: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bgSunken,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  optionBar: { width: 6, alignSelf: 'stretch', minHeight: 40, borderRadius: radius.sm },
  optionText: { flex: 1, gap: 2 },
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT_SIZE,
    paddingVertical: spacing.sm,
  },
  toggleTrack: {
    width: 60,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    padding: 4,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignSelf: 'flex-start',
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  progressRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
});
