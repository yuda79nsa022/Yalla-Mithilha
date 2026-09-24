import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ARABIC_LINE_HEIGHT_BOOST,
  FONT_BY_WEIGHT,
  HIT_SIZE,
  backArrow,
  colors,
  endArrow,
  fonts,
  hardShadow,
  hardShadowPressed,
  onAccent,
  radius,
  spacing,
  type,
} from '../theme';
import { useApp } from '../../state/AppProvider';

/* ------------------------------------------------------------------ text */

type TextVariant = keyof typeof type;

export function T({
  variant = 'body',
  color = colors.ink,
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
  const { lang } = useApp();
  const isAr = lang === 'ar';
  const base = type[variant];
  return (
    <Text
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel}
      // `textAlign: auto` follows the layout direction, so the same component
      // aligns right in Arabic and left in English with no branching. A
      // custom-loaded static TTF needs its own per-weight family (see
      // FONT_BY_WEIGHT) rather than relying on the `fontWeight` property to
      // synthesize bold.
      style={[
        base,
        {
          color,
          textAlign: align,
          fontFamily: FONT_BY_WEIGHT[String(base.fontWeight)] ?? fonts.ar,
          lineHeight: isAr ? Math.round(base.lineHeight * ARABIC_LINE_HEIGHT_BOOST) : base.lineHeight,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ---------------------------------------------------------------- screen */

export function Screen({
  children,
  scroll = false,
  background = colors.ground,
  style,
  header,
  footer,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  background?: string;
  style?: StyleProp<ViewStyle>;
  /** Header bar: a back button or wordmark on the start side, custom content (EN toggle, logo) on the end side. */
  header?: { title?: string; onBack?: () => void; end?: React.ReactNode; light?: boolean; titleColor?: string };
  /** Pinned footer content (primary CTA) — always visible, never scrolls with the content above it. */
  footer?: React.ReactNode;
}) {
  const { t, lang } = useApp();
  const inner = <View style={[styles.screenInner, style]}>{children}</View>;
  const ruleColor = header?.light ? colors.white : colors.ink;
  return (
    // A neutral outer canvas plus a max-640px column centered inside it —
    // on a phone this is a no-op (the column just fills the viewport), but
    // on a wide desktop window it keeps the whole screen — header, scroll
    // body and pinned footer alike — at one comfortable reading width
    // instead of stretching edge-to-edge. No border/frame around it: it
    // blends into the ground background rather than reading as a boxed
    // card floating in empty space.
    <View style={styles.pageOuter}>
      <SafeAreaView style={[styles.screen, styles.pageColumn, { backgroundColor: background }]} edges={['top', 'bottom']}>
        {header ? (
        <View style={[styles.headerBar, { borderBottomColor: ruleColor }]}>
          {header.onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              onPress={header.onBack}
              style={styles.backButton}
              hitSlop={8}
            >
              <T variant="label" color={header.light ? colors.white : colors.ink}>
                {backArrow(lang)}
              </T>
              <T variant="label" color={header.light ? colors.white : colors.ink}>
                {t('common.back')}
              </T>
            </Pressable>
          ) : (
            <T variant="heading" style={{ fontSize: 15 }} color={header.titleColor ?? (header.light ? colors.white : colors.ink)}>
              {header.title ?? t('app.name')}
            </T>
          )}
          {header.end}
        </View>
      ) : null}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
        {footer ? (
          <View style={[styles.footer, { borderTopColor: ruleColor, backgroundColor: background }]}>{footer}</View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

/* --------------------------------------------------------------- buttons */

export function Button({
  label,
  onPress,
  tone = 'primary',
  accent = colors.purple,
  disabled = false,
  busy = false,
  style,
  accessibilityHint,
  showArrow = true,
  shadowColor,
  borderColor,
  textColor,
  background,
  forceShadow = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
  accent?: string;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  /** Set false for buttons that end in their own glyph (✓, ×, +) instead of the default arrow. */
  showArrow?: boolean;
  /** Overrides the hard-shadow colour (default ink) — e.g. the final-score screen's green button casts a purple shadow. */
  shadowColor?: string;
  /** Overrides the border colour on top of the tone's default (used for a white border on a coloured background). */
  borderColor?: string;
  /** Overrides the label colour on top of the tone's default (e.g. white text for a secondary button on the ink final-score screen). */
  textColor?: string;
  /** Overrides the background colour on top of the tone's default (e.g. a white "secondary" button on a purple screen). */
  background?: string;
  /** Gives a normally shadow-less tone (secondary/ghost/danger) a hard shadow anyway — the turn-handoff screen's white CTA. */
  forceShadow?: boolean;
}) {
  const { lang } = useApp();
  const [pressed, setPressed] = React.useState(false);
  const palette: Record<string, { bg: string; fg: string; border: string; shadow: boolean }> = {
    primary: { bg: accent, fg: onAccent, border: 'transparent', shadow: true },
    secondary: { bg: 'transparent', fg: colors.ink, border: colors.ink, shadow: false },
    ghost: { bg: 'transparent', fg: colors.neutral700, border: 'transparent', shadow: false },
    danger: { bg: 'transparent', fg: colors.red, border: colors.red, shadow: false },
  };
  const p = palette[tone];
  const useShadow = (p.shadow || forceShadow) && !disabled && !busy;
  const border = borderColor ?? p.border;
  const fg = disabled ? colors.mutedText : textColor ?? p.fg;
  const bg = disabled ? colors.mutedBg : background ?? p.bg;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor: border, borderWidth: border === 'transparent' ? 0 : 2 },
        useShadow && (pressed ? hardShadowPressed(lang, shadowColor) : hardShadow(lang, shadowColor)),
        useShadow && pressed && { transform: [{ translateX: lang === 'ar' ? -3 : 3 }, { translateY: 3 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonRow}>
          <T variant="heading" color={fg} style={{ fontSize: tone === 'primary' ? 22 : 15 }}>
            {label}
          </T>
          {showArrow ? (
            <T variant="heading" color={fg} style={{ fontSize: tone === 'primary' ? 26 : 15 }}>
              {endArrow(lang)}
            </T>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

/* ---------------------------------------------------------------- fields */

/** A labelled, ink-bordered input — 13px bold label above, purple focus ring (hard offset shadow). */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  maxLength,
  accessibilityLabel,
  borderColor,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  maxLength?: number;
  accessibilityLabel?: string;
  /** Team-colour border override on the setup screen; defaults to ink. */
  borderColor?: string;
}) {
  const { lang } = useApp();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T variant="label" style={{ fontSize: 13 }}>
        {label}
      </T>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={accessibilityLabel ?? label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          { borderColor: focused ? colors.purple : borderColor ?? colors.ink },
          focused && hardShadowPressed(lang, colors.purple),
        ]}
      />
    </View>
  );
}

/* --------------------------------------------------------- category tile */

/** The 2-column setup-screen tile: 2-digit index + checkbox up top, name below. Selected = solid purple + hard shadow. */
export function CategoryTile({
  index,
  name,
  selected,
  onPress,
}: {
  index: number;
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { lang } = useApp();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      onPress={onPress}
      style={[
        styles.categoryTile,
        { backgroundColor: selected ? colors.purple : colors.white },
        selected && hardShadowPressed(lang),
      ]}
    >
      <View style={styles.categoryTileTop}>
        <T
          style={{ fontFamily: fonts.display, fontSize: 12, color: selected ? colors.white : colors.ink }}
        >
          {String(index + 1).padStart(2, '0')}
        </T>
        <View style={[styles.checkbox, { borderColor: selected ? colors.white : colors.ink }]}>
          {selected ? <T style={{ fontSize: 12, fontWeight: '900', color: colors.white }}>✓</T> : null}
        </View>
      </View>
      <T variant="label" color={selected ? colors.white : colors.ink} style={{ fontSize: 15 }}>
        {name}
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
  accent = colors.purple,
  badge,
  role = 'radio',
  imageUri,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
  accent?: string;
  badge?: string;
  /** `'radio'` (default) for a single-choice group; `'checkbox'` when more than one option can be selected at once. */
  role?: 'radio' | 'checkbox';
  /** An optional icon/cover picture shown beside the title — e.g. a deck's own picture on the deck picker. */
  imageUri?: string;
}) {
  const { lang } = useApp();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'checkbox' ? { checked: Boolean(selected) } : { selected: Boolean(selected) }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={[
        styles.optionCard,
        { borderColor: colors.ink, backgroundColor: selected ? accent : colors.white },
        selected && hardShadowPressed(lang),
      ]}
    >
      <View style={styles.optionRow}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.optionImage} resizeMode="cover" /> : null}
        <View style={styles.optionText}>
          <T variant="heading" color={selected ? colors.white : colors.ink}>
            {title}
          </T>
          {subtitle ? (
            <T variant="label" color={selected ? colors.white : colors.neutral700}>
              {subtitle}
            </T>
          ) : null}
        </View>
        {badge ? (
          <View style={[styles.badge, { borderColor: selected ? colors.white : accent }]}>
            <T variant="label" color={selected ? colors.white : accent}>
              {badge}
            </T>
          </View>
        ) : null}
        {selected ? (
          <T variant="heading" color={colors.white}>
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
          <T variant="label" color={colors.neutral700}>
            {description}
          </T>
        ) : null}
      </View>
      <View style={[styles.toggleTrack, { borderColor: colors.ink }, value && { backgroundColor: colors.green }]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ bits */

/** A text-only link: no border except a 2px purple-700 underline (e.g. "نسيت كلمة السر؟", "تسجيل الخروج"). */
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.textLink, pressed && styles.pressed]}
    >
      <T variant="label" color={colors.purple700} style={{ fontSize: 14 }}>
        {label}
      </T>
    </Pressable>
  );
}

/** A square-cornered outline pill — used for the "EN"/"عربي" language toggle and small tags. */
export function Pill({ text, color = colors.ink }: { text: string; color?: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <T style={{ fontFamily: fonts.display, fontSize: 13, letterSpacing: 1, color }}>{text}</T>
    </View>
  );
}

export function Divider({ color = colors.ink }: { color?: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

export function Spacer({ size = spacing.md }: { size?: number }) {
  return <View style={{ height: size }} />;
}

/** The 20-segment round tracker on the turn-handoff/acting screens. */
export function RoundProgress({ round, total }: { round: number; total: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: round, min: 0, max: total }}
      style={styles.progressRow}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            { backgroundColor: i < round - 1 ? colors.ink : i === round - 1 ? colors.white : colors.purpleTop },
          ]}
        />
      ))}
    </View>
  );
}

/** The bordered 2-column team score grid used on the round-result and final-score screens. */
export function ScoreBlock({
  teamAName,
  teamAScore,
  teamBName,
  teamBScore,
  big = false,
  light = false,
}: {
  teamAName: string;
  teamAScore: number;
  teamBName: string;
  teamBScore: number;
  /** Final-score screen uses larger digits. */
  big?: boolean;
  /** On the ink final-score background, the un-highlighted cell is transparent, not white. */
  light?: boolean;
}) {
  return (
    <View style={[styles.scoreBlock, { borderColor: light ? colors.white : colors.ink }]}>
      <View
        style={[
          styles.scoreCell,
          { backgroundColor: colors.purple, borderColor: light ? colors.white : colors.ink },
        ]}
      >
        <T variant="label" color={colors.white} style={{ fontSize: 14 }}>
          {teamAName}
        </T>
        <T style={{ fontFamily: fonts.displayBlack, fontSize: big ? 72 : 64, color: colors.white }}>{teamAScore}</T>
      </View>
      <View style={[styles.scoreCell, { backgroundColor: light ? 'transparent' : colors.white }]}>
        <T variant="label" color={light ? colors.white : colors.ink} style={{ fontSize: 14 }}>
          {teamBName}
        </T>
        <T style={{ fontFamily: fonts.displayBlack, fontSize: big ? 72 : 64, color: light ? colors.white : colors.ink }}>
          {teamBScore}
        </T>
      </View>
    </View>
  );
}

/**
 * `Alert.alert` is a silent no-op on the web build (react-native-web ships
 * it as an empty function) — a confirmation built on it never appears in a
 * browser, so a destructive action either does nothing there or, worse,
 * needs a second path just for web. A real `Modal` works on every
 * platform, so every yes/no confirmation in this app goes through this
 * instead of `Alert.alert`.
 */
export function ConfirmModal({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}) {
  const { lang } = useApp();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.confirmBackdrop}>
        <View style={[styles.confirmCard, hardShadow(lang)]}>
          <T variant="heading" align="center">
            {title}
          </T>
          {body ? (
            <>
              <Spacer size={spacing.sm} />
              <T variant="body" align="center" color={colors.neutral700}>
                {body}
              </T>
            </>
          ) : null}
          <Spacer size={spacing.lg} />
          <Button label={confirmLabel} tone={destructive ? 'danger' : 'primary'} onPress={onConfirm} showArrow={false} />
          <Spacer size={spacing.sm} />
          <Button label={cancelLabel} tone="ghost" onPress={onCancel} showArrow={false} />
        </View>
      </View>
    </Modal>
  );
}

/**
 * The two controls a performer uses mid-round. Deliberately enormous: the
 * phone is often on a forehead or being waved around. Kept for backward
 * compatibility with call sites that still reference it directly.
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
  const { lang } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.bigChoice, { backgroundColor: color, borderColor: colors.ink }, !disabled && hardShadow(lang)]}
    >
      <T variant="title" color={onAccent} align="center">
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pageOuter: { flex: 1, alignItems: 'center', backgroundColor: colors.ground },
  pageColumn: { width: '100%', maxWidth: 640 },
  screen: { flex: 1 },
  screenInner: { flex: 1, padding: spacing.lg, gap: spacing.md },
  scrollContent: { flexGrow: 1 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { padding: 20, borderTopWidth: 2 },
  button: {
    minHeight: HIT_SIZE,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  bigChoice: {
    flex: 1,
    minHeight: 110,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.4 },
  input: {
    minHeight: HIT_SIZE,
    borderWidth: 2,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    backgroundColor: colors.white,
    fontFamily: 'NotoKufiArabic_500Medium',
    fontSize: 16,
  },
  categoryTile: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 96,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 12,
    justifyContent: 'space-between',
    gap: 8,
  },
  categoryTileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  checkbox: { width: 18, height: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  optionCard: {
    borderWidth: 2,
    padding: spacing.md,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  optionImage: { width: 40, height: 40, backgroundColor: colors.mutedBg },
  optionText: { flex: 1, gap: 2 },
  badge: {
    borderWidth: 1,
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
    borderWidth: 2,
    padding: 4,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: colors.ink,
    alignSelf: 'flex-start',
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  pill: {
    borderWidth: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  textLink: {
    alignSelf: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: colors.purple700,
    paddingBottom: 2,
  },
  divider: { height: 2 },
  progressRow: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
  progressSegment: { height: 6, flexGrow: 1, minWidth: 8 },
  scoreBlock: { flexDirection: 'row', borderWidth: 2 },
  scoreCell: { flex: 1, padding: 18, gap: 2, borderRightWidth: 2 },
  confirmBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  confirmCard: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink, padding: spacing.lg },
});
