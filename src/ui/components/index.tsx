import { router, usePathname } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ARABIC_LINE_HEIGHT_BOOST,
  FONT_BY_WEIGHT,
  HIT_SIZE,
  colors,
  endArrow,
  fonts,
  hardShadow,
  hardShadowPressed,
  onAccent,
  spacing,
  type,
} from '../theme';
import { useApp } from '../../state/AppProvider';
import { needsRestartForDirection } from '../../platform';
import { Logo } from '../Logo';
import { track } from '../../services/analytics';
import type { Lang } from '../../engine/types';

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

/** The widest a confirmation dialog gets — on a desktop window it stays dialog-sized instead of stretching across the screen. */
export const MAX_DIALOG_WIDTH = 512;

/**
 * The AR/EN switch every screen header carries. On native, flipping between
 * RTL and LTR only fully applies after the app restarts — the notice under
 * the switch says so rather than leaving a half-mirrored layout unexplained.
 */
export function LanguageToggle({ light = false }: { light?: boolean }) {
  const { lang, prefs, setPrefs, t } = useApp();
  const next: Lang = lang === 'ar' ? 'en' : 'ar';
  const label = next === 'ar' ? 'AR' : 'EN';
  const restartNeeded = prefs.lang !== null && needsRestartForDirection(lang);
  const fg = light ? colors.white : colors.purple;
  const border = light ? colors.white : colors.ink;

  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('lang.switchTo', { lang: next === 'ar' ? 'العربية' : 'English' })}
        hitSlop={8}
        onPress={() => {
          setPrefs({ lang: next });
          track({ name: 'language_changed', lang: next });
        }}
        style={({ pressed }) => [styles.langToggle, { borderColor: border }, pressed && { backgroundColor: border }]}
      >
        {({ pressed }: { pressed: boolean }) => (
          <T style={{ fontFamily: fonts.display, fontSize: 13, letterSpacing: 1, color: pressed ? (light ? colors.ink : colors.white) : fg }}>
            {label}
          </T>
        )}
      </Pressable>
      {restartNeeded ? (
        <T variant="label" color={fg} align="right" style={{ maxWidth: 160, fontSize: 11 }}>
          {t('lang.restartNotice')}
        </T>
      ) : null}
    </View>
  );
}

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
  /**
   * The site's top bar. `site` (the default) is the full navigation bar —
   * logo home, the main sections, account and language. `game` is for a game
   * in progress: logo, the round, the language toggle and nothing that leaves
   * the game. `minimal` is for the standalone QR reveal page: logo and
   * language only. There are no back buttons anywhere — the bar is how you
   * get around.
   */
  header?: {
    variant?: 'site' | 'game' | 'minimal';
    /** Shown beside the logo in the `game` bar — the round, the team up. */
    title?: string;
    /** White text, for screens with a dark or purple background. */
    light?: boolean;
  };
  /** Pinned footer content (primary CTA) — always visible, never scrolls with the content above it. */
  footer?: React.ReactNode;
}) {
  const { t, lang } = useApp();
  // A phone gets a little less padding than a desktop window, so more of each page fits on its screen.
  const { width } = useWindowDimensions();
  const inner = <View style={[styles.screenInner, width < 600 && styles.screenInnerPhone, style]}>{children}</View>;
  return (
    // Genuinely fills the available viewport width at any screen size —
    // header, scroll body and pinned footer all stretch edge-to-edge
    // together, so there's no centered column with dead margins on a wide
    // desktop window.
    <View style={[styles.pageOuter, { backgroundColor: background }]}>
      <SafeAreaView style={[styles.screen, { backgroundColor: background }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {header ? <SiteNav variant={header.variant ?? 'site'} title={header.title} light={header.light} /> : null}
      {scroll ? (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={styles.screen}>{inner}</View>
      )}
        {footer ? (
          <View style={[styles.footer, { backgroundColor: background }]}>{footer}</View>
        ) : null}
        <Copyright onDark={background === colors.ink || background === colors.purple} showLinks={(header?.variant ?? 'site') === 'site'} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/**
 * The site footer — copyright, plus the About & privacy link on ordinary
 * pages (not mid-game, where leaving should only ever be a deliberate "End
 * game"). Pinned below everything else, so it never adds scrolling.
 */
function Copyright({ onDark, showLinks }: { onDark: boolean; showLinks: boolean }) {
  const { t } = useApp();
  const { width } = useWindowDimensions();
  const color = onDark ? colors.white : colors.mutedText;
  // On a phone the link lives in the ☰ menu instead, keeping this one line.
  showLinks = showLinks && width >= 760;
  return (
    <View style={styles.copyright}>
      <T variant="label" align="center" color={color} style={styles.copyrightText}>
        {t('app.copyright', { year: new Date().getFullYear() })}
      </T>
      {showLinks ? (
        <Pressable accessibilityRole="link" onPress={() => router.navigate('/privacy')} hitSlop={6}>
          <T variant="label" color={color} style={[styles.copyrightText, { textDecorationLine: 'underline' }]}>
            {t('home.about')}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------ site nav */

type NavLink = { key: string; label: string; href: string; active: boolean };

/**
 * The top bar every screen carries, like a game site's: the logo and name
 * (home) on the start side; the main sections, the player's games left and
 * account, and the language toggle on the end side. A phone keeps the logo
 * and language toggle and folds the rest into a ☰ menu. During a game the
 * bar shows only the logo, the round and the language toggle — nothing that
 * would leave the game by accident.
 */
function SiteNav({ variant, title, light = false }: { variant: 'site' | 'game' | 'minimal'; title?: string; light?: boolean }) {
  const { t, player, charades, walletLoaded, walletBalance, freeGameCredits } = useApp();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const compact = width < 760;
  const fg = light ? colors.white : colors.ink;
  const brandColor = light ? colors.white : colors.purple;

  const go = (href: string) => {
    setMenuOpen(false);
    if (pathname !== href) router.navigate(href as never);
  };

  const brandContent = (
    <View style={styles.navBrand}>
      <Logo size="sm" />
      {!compact || variant !== 'game' ? (
        <T variant="heading" color={brandColor} style={{ fontSize: 15 }} numberOfLines={1}>
          {t('app.name')}
        </T>
      ) : null}
    </View>
  );

  if (variant !== 'site') {
    return (
      <View style={[styles.headerBar, compact && styles.headerBarPhone]}>
        <View style={styles.navStart}>
          {brandContent}
          {title ? (
            <T variant="label" color={fg} style={{ fontSize: 14 }} numberOfLines={1}>
              {title}
            </T>
          ) : null}
        </View>
        <LanguageToggle light={light} />
      </View>
    );
  }

  const playHref = charades ? (charades.lock === 'unlocked' ? '/charades/play' : '/charades/checkout') : '/charades/draft';
  const links: NavLink[] = [
    { key: 'home', label: t('nav.home'), href: '/home', active: pathname === '/home' || pathname === '/' },
    { key: 'play', label: charades ? t('nav.resume') : t('nav.play'), href: playHref, active: pathname.startsWith('/charades') },
    ...(player ? [{ key: 'buy', label: t('nav.buy'), href: '/buy', active: pathname === '/buy' }] : []),
    { key: 'settings', label: t('nav.settings'), href: '/settings', active: pathname === '/settings' },
  ];
  // The footer carries this link on a wide window; on a phone it joins the menu.
  const menuLinks: NavLink[] = [...links, { key: 'privacy', label: t('home.about'), href: '/privacy', active: pathname === '/privacy' }];
  const gamesLeft = walletBalance + freeGameCredits;
  const accountLabel = player ? player.username : t('account.signIn');

  const accountButton = (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={player ? t('nav.account') : t('account.signIn')}
      onPress={() => go('/account')}
      style={({ pressed }) => [styles.navAccount, { borderColor: fg }, pathname === '/account' && styles.navAccountActive, pressed && styles.pressed]}
    >
      <T variant="label" color={pathname === '/account' ? colors.white : fg} style={{ fontSize: 13 }} numberOfLines={1}>
        {accountLabel}
      </T>
      {player && walletLoaded ? (
        <View style={styles.navBadge}>
          <T variant="label" color={colors.white} style={{ fontSize: 11 }}>
            {t('nav.gamesLeft', { count: gamesLeft })}
          </T>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <View style={[styles.headerBar, compact && styles.headerBarPhone]}>
      <Pressable accessibilityRole="link" accessibilityLabel={t('nav.home')} onPress={() => go('/home')} hitSlop={6}>
        {brandContent}
      </Pressable>
      {compact ? (
        <View style={styles.navEnd}>
          <LanguageToggle light={light} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nav.menu')}
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => setMenuOpen(true)}
            style={({ pressed }) => [styles.navMenuButton, { borderColor: fg }, pressed && styles.pressed]}
          >
            <T variant="heading" color={fg} style={{ fontSize: 18, lineHeight: 22 }}>
              ☰
            </T>
          </Pressable>
          <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
            <Pressable style={styles.navSheetBackdrop} onPress={() => setMenuOpen(false)} accessibilityLabel={t('nav.close')}>
              <Pressable style={styles.navSheet} onPress={() => undefined}>
                <View style={[styles.headerBar, styles.headerBarPhone]}>
                  {brandContent}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('nav.close')}
                    onPress={() => setMenuOpen(false)}
                    style={({ pressed }) => [styles.navMenuButton, { borderColor: colors.ink }, pressed && styles.pressed]}
                  >
                    <T variant="heading" style={{ fontSize: 18, lineHeight: 22 }}>
                      ✕
                    </T>
                  </Pressable>
                </View>
                {menuLinks.map((link) => (
                  <Pressable
                    key={link.key}
                    accessibilityRole="link"
                    accessibilityState={{ selected: link.active }}
                    onPress={() => go(link.href)}
                    style={({ pressed }) => [styles.navSheetItem, link.active && styles.navSheetItemActive, pressed && styles.pressed]}
                  >
                    <T variant="heading" color={link.active ? colors.white : colors.ink} style={{ fontSize: 18 }}>
                      {link.label}
                    </T>
                  </Pressable>
                ))}
                <View style={styles.navSheetAccount}>{accountButton}</View>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      ) : (
        <View style={styles.navEnd}>
          {links.map((link) => (
            <Pressable
              key={link.key}
              accessibilityRole="link"
              accessibilityState={{ selected: link.active }}
              onPress={() => go(link.href)}
              style={({ pressed }) => [styles.navLink, link.active && { borderBottomColor: brandColor }, pressed && styles.pressed]}
            >
              <T variant="label" color={link.active ? brandColor : fg} style={{ fontSize: 14 }}>
                {link.label}
              </T>
            </Pressable>
          ))}
          {accountButton}
          <LanguageToggle light={light} />
        </View>
      )}
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
  const { width } = useWindowDimensions();
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
          // 48 on a phone — still a comfortable tap target — so forms fit its screen.
          width < 600 && { minHeight: 48 },
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
  style,
  compact = false,
}: {
  index: number;
  name: string;
  selected: boolean;
  onPress: () => void;
  /** Overrides the default two-to-a-row sizing, e.g. four to a row on a wide window. */
  style?: StyleProp<ViewStyle>;
  /** One short row — checkbox then name, no number — for a phone screen. */
  compact?: boolean;
}) {
  const { lang } = useApp();
  if (compact) {
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={name}
        onPress={onPress}
        style={[
          styles.categoryTile,
          styles.categoryTileCompact,
          { backgroundColor: selected ? colors.purple : colors.white },
          selected && hardShadowPressed(lang),
          style,
        ]}
      >
        <View style={[styles.checkbox, { borderColor: selected ? colors.white : colors.ink }]}>
          {selected ? <T style={{ fontSize: 12, fontWeight: '900', color: colors.white }}>✓</T> : null}
        </View>
        <T variant="label" color={selected ? colors.white : colors.ink} style={{ fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
          {name}
        </T>
      </Pressable>
    );
  }
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
        style,
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
  compact = false,
}: {
  teamAName: string;
  teamAScore: number;
  teamBName: string;
  teamBScore: number;
  /** Final-score screen uses larger digits. */
  big?: boolean;
  /** On the ink final-score background, the un-highlighted cell is transparent, not white. */
  light?: boolean;
  /** Smaller digits, for screens where something else (the QR code) has to fit on a phone too. */
  compact?: boolean;
}) {
  const digits = compact ? { fontSize: 36, lineHeight: 42 } : big ? { fontSize: 72, lineHeight: 78 } : { fontSize: 64, lineHeight: 70 };
  const cellPadding = compact ? { padding: 10 } : null;
  return (
    <View style={[styles.scoreBlock, { borderColor: light ? colors.white : colors.ink }]}>
      <View
        style={[
          styles.scoreCell,
          cellPadding,
          { backgroundColor: colors.purple, borderColor: light ? colors.white : colors.ink },
        ]}
      >
        <T variant="label" color={colors.white} style={{ fontSize: 14 }} numberOfLines={1}>
          {teamAName}
        </T>
        <T style={[{ fontFamily: fonts.displayBlack, color: colors.white }, digits]}>{teamAScore}</T>
      </View>
      <View style={[styles.scoreCell, cellPadding, { backgroundColor: light ? 'transparent' : colors.white }]}>
        <T variant="label" color={light ? colors.white : colors.ink} style={{ fontSize: 14 }} numberOfLines={1}>
          {teamBName}
        </T>
        <T style={[{ fontFamily: fonts.displayBlack, color: light ? colors.white : colors.ink }, digits]}>
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

/* ------------------------------------------------------- account prompts */

/** Asks the player to sign in again once their session ended on its own. Mounted once, above every screen. */
export function SessionExpiredPrompt() {
  const { t, sessionExpired, dismissSessionExpired, player } = useApp();
  const pathname = usePathname();
  // Not over the sign-in screen itself, and never on the standalone reveal
  // page, which a different phone opens from a QR code.
  const visible = sessionExpired && !player && pathname !== '/account' && pathname !== '/reveal';
  return (
    <ConfirmModal
      visible={visible}
      title={t('session.expiredTitle')}
      body={t('session.expiredBody')}
      confirmLabel={t('session.signInAgain')}
      cancelLabel={t('session.notNow')}
      onConfirm={() => {
        dismissSessionExpired();
        router.push('/account');
      }}
      onCancel={dismissSessionExpired}
    />
  );
}

/** "Only N games left — Buy more", shown wherever the wallet matters while the player is under the low-balance threshold. */
export function LowBalanceBanner({ light = false }: { light?: boolean }) {
  const { t, lowBalance, walletBalance, freeGameCredits } = useApp();
  if (!lowBalance) return null;
  return (
    <View style={[styles.lowBalanceBanner, { borderColor: light ? colors.white : colors.red }]}>
      <T variant="label" color={light ? colors.white : colors.red}>
        {t('wallet.lowBanner', { count: walletBalance + freeGameCredits })}
      </T>
      <Spacer size={spacing.sm} />
      <Button label={t('wallet.buyMore')} accent={colors.red} onPress={() => router.push('/buy')} />
    </View>
  );
}

// Which "N games left" the player already acknowledged this run — so the
// alert pops up once each time the count drops, not on every visit home.
let acknowledgedLowBalance: string | null = null;

/**
 * The one-time pop-up when games left fall under the threshold. `path` is
 * the screen it sits on: a stack keeps that screen mounted underneath the
 * ones pushed over it, and a Modal would otherwise pop up over those too —
 * in the middle of a game.
 */
export function LowBalanceAlert({ path }: { path: string }) {
  const { t, lowBalance, walletBalance, freeGameCredits, player } = useApp();
  const pathname = usePathname();
  const key = player ? `${player.id}:${walletBalance + freeGameCredits}` : null;
  const [, rerender] = React.useState(0);
  const visible = pathname === path && lowBalance && key !== null && acknowledgedLowBalance !== key;
  const acknowledge = () => {
    acknowledgedLowBalance = key;
    rerender((n) => n + 1);
  };
  return (
    <ConfirmModal
      visible={visible}
      title={t('wallet.lowTitle')}
      body={t('wallet.lowBody', { count: walletBalance + freeGameCredits })}
      confirmLabel={t('wallet.buyMore')}
      cancelLabel={t('wallet.dismiss')}
      onConfirm={() => {
        acknowledge();
        router.push('/buy');
      }}
      onCancel={acknowledge}
    />
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
  pageOuter: { flex: 1, backgroundColor: colors.ground },
  screen: { flex: 1 },
  headerStart: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerEnd: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  langToggle: { borderWidth: 2, paddingHorizontal: 12, paddingVertical: 5 },
  screenInner: { flex: 1, padding: spacing.lg, gap: spacing.md },
  screenInnerPhone: { padding: spacing.md, gap: 12 },
  scrollContent: { flexGrow: 1 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  headerBarPhone: { paddingVertical: 10, paddingHorizontal: spacing.md },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navStart: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
  navEnd: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  navLink: { paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  navAccount: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 5, maxWidth: 260 },
  navAccountActive: { backgroundColor: colors.ink },
  navBadge: { backgroundColor: colors.purple, paddingHorizontal: 6, paddingVertical: 1 },
  navMenuButton: { borderWidth: 2, width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  navSheetBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'stretch' },
  navSheet: { backgroundColor: colors.ground, borderBottomWidth: 2, borderBottomColor: colors.ink, paddingBottom: spacing.md },
  navSheetItem: { paddingVertical: 14, paddingHorizontal: spacing.lg },
  navSheetItemActive: { backgroundColor: colors.purple },
  navSheetAccount: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, alignItems: 'flex-start' },
  copyrightText: { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  copyright: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.md,
  },
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
  categoryTileCompact: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 8, gap: 8 },
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
  lowBalanceBanner: { borderWidth: 2, padding: spacing.md, backgroundColor: 'transparent' },
  confirmCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.lg,
    width: '100%',
    maxWidth: MAX_DIALOG_WIDTH,
    alignSelf: 'center',
  },
});
