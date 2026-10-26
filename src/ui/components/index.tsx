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
import Svg, { Circle, Path } from 'react-native-svg';
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
import { isRtlLayout, needsRestartForDirection } from '../../platform';
import { Logo, useLogoIsImage } from '../Logo';
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

/** Width of the centred page column, and of the two-column pages (home, setup, sign-in). */
export const CONTENT_MAX_WIDTH = 640;
export const WIDE_MAX_WIDTH = 1100;

/**
 * Where a page's actions go — the one placement rule for every page, dialog
 * and the admin tool alike: bottom-right in English, bottom-left in Arabic,
 * with the primary action outermost and any secondary/cancel beside it on the
 * inside. `align` is the cross-axis alignment that puts a block on that side;
 * `row` is the direction that puts a ButtonRow's last child (its primary)
 * outermost. Native mirrors flex itself once the app runs RTL; web never does
 * (see needsRestartForDirection), so both cases are worked out here.
 */
export function useActionLayout(): { align: 'flex-start' | 'flex-end'; row: 'row' | 'row-reverse' } {
  const { lang } = useApp();
  const rtlEngine = Platform.OS !== 'web' && Boolean(isRtlLayout());
  const mirrored = (lang === 'ar') !== rtlEngine;
  return { align: mirrored ? 'flex-start' : 'flex-end', row: mirrored ? 'row-reverse' : 'row' };
}

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
  wide = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  /**
   * Pages are a centred column (CONTENT_MAX_WIDTH) so nothing — text, link,
   * button — ever runs edge to edge on a desktop window. Only pages with a
   * real two-column layout (home, setup, sign-in) opt into the wider
   * WIDE_MAX_WIDTH.
   */
  wide?: boolean;
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
  // A phone gets a little less padding than a desktop window, so more of each page fits on its screen.
  // A short window (a laptop's browser, a small phone) also gets less top and bottom padding.
  const { width, height } = useWindowDimensions();
  const { lang } = useApp();
  const actions = useActionLayout();
  const inner = (
    <View
      style={[
        styles.screenInner,
        { maxWidth: wide ? WIDE_MAX_WIDTH : CONTENT_MAX_WIDTH },
        width < 600 && styles.screenInnerPhone,
        height < 700 && styles.screenInnerShort,
        style,
      ]}
    >
      {children}
    </View>
  );
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
          // A page that's taller than the window scrolls between the header
          // and the action bar. In Arabic its scrollbar belongs on the left,
          // like any right-to-left page: the browser puts it on the start
          // side of a right-to-left box, so the box is marked rtl and the
          // page inside reset to ltr — which leaves the page's own layout
          // (worked out per language elsewhere) exactly as it was.
          style={[styles.screen, Platform.OS === 'web' && lang === 'ar' && styles.scrollRtl]}
          contentContainerStyle={[styles.scrollContent, Platform.OS === 'web' && styles.scrollLtr]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={styles.screen}>{inner}</View>
      )}
        {footer ? (
          // The action bar: the same column as the page above it, its
          // actions on the end side (see useActionLayout).
          <View style={[styles.footer, { backgroundColor: background }]}>
            <View
              style={[
                styles.footerInner,
                { maxWidth: wide ? WIDE_MAX_WIDTH : CONTENT_MAX_WIDTH, alignItems: actions.align },
                width < 600 && styles.footerInnerPhone,
              ]}
            >
              {footer}
            </View>
          </View>
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
  const { t, appName } = useApp();
  const { width } = useWindowDimensions();
  const color = onDark ? colors.white : colors.mutedText;
  // On a phone the link lives in the ☰ menu instead, keeping this one line.
  showLinks = showLinks && width >= 760;
  return (
    <View style={styles.copyright}>
      <T variant="label" align="center" color={color} style={styles.copyrightText}>
        {t('app.copyright', { year: new Date().getFullYear(), name: appName })}
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

const ACCOUNT_DROPDOWN_WIDTH = 220;

/** Every control in the header bar — tabs, account, log out, language — is this tall. */
const NAV_CONTROL_HEIGHT = 40;

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
  const { t, appName, player, charades, walletLoaded, walletBalance, freeGameCredits, logoutPlayerAccount } = useApp();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [confirmingLogout, setConfirmingLogout] = React.useState(false);
  const [accountMenu, setAccountMenu] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const accountTriggerRef = React.useRef<View>(null);
  const compact = width < 760;
  const fg = light ? colors.white : colors.ink;
  const brandColor = light ? colors.white : colors.purple;
  // The bar reads in the page's direction: brand on the start side (right in
  // Arabic), the sections, account and language toggle on the end side.
  const { row } = useActionLayout();
  const mirror = { flexDirection: row };

  const go = (href: string) => {
    if (pathname !== href) router.navigate(href as never);
  };

  // A logo picture is the brand on its own; only the plain cube gets the name beside it.
  const logoIsImage = useLogoIsImage();
  const brandContent = (
    <View style={[styles.navBrand, mirror]}>
      <Logo size={compact ? 'xs' : 'sm'} />
      {!compact && !logoIsImage ? (
        <T variant="heading" color={brandColor} style={{ fontSize: 15 }} numberOfLines={1}>
          {appName}
        </T>
      ) : null}
    </View>
  );

  // The bar spans the window with a rule under it, its contents lined up
  // with the page column below — logo over the content's start edge, the
  // menu over its end edge — rather than pinned to the window's corners.
  const frame = (content: React.ReactNode) => (
    <View style={[styles.headerFrame, { borderBottomColor: light ? 'rgba(255,255,255,0.25)' : colors.mutedBg }]}>{content}</View>
  );

  if (variant !== 'site') {
    return frame(
      // Slimmer than the site bar — every pixel goes to the game.
      <View style={[styles.headerBar, mirror, compact && styles.headerBarPhone, styles.headerBarGame]}>
        <View style={[styles.navStart, mirror]}>
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
  const gamesLeft = walletBalance + freeGameCredits;
  // A guest gets only Sign in (and the language toggle): the sections are
  // for a signed-in player. A signed-in player gets the username dropdown
  // instead of Sign in.
  const links: NavLink[] = player
    ? [
        { key: 'home', label: t('nav.home'), href: '/home', active: pathname === '/home' || pathname === '/' },
        { key: 'play', label: charades ? t('nav.resume') : t('nav.play'), href: playHref, active: pathname.startsWith('/charades') },
        { key: 'settings', label: t('nav.settings'), href: '/settings', active: pathname === '/settings' },
      ]
    : [{ key: 'account', label: t('account.signIn'), href: '/account', active: pathname === '/account' }];
  const accountItems: NavLink[] = [
    { key: 'profile', label: t('nav.profile'), href: '/account', active: pathname === '/account' },
    { key: 'changePassword', label: t('nav.changePassword'), href: '/change-password', active: pathname === '/change-password' },
    { key: 'usage', label: t('nav.usageReport'), href: '/usage', active: pathname === '/usage' },
    { key: 'buy', label: t('nav.buyMore'), href: '/buy', active: pathname === '/buy' },
  ];
  const accountMenuActive = accountItems.some((item) => item.active);
  const openAccountMenu = () => {
    accountTriggerRef.current?.measureInWindow((x, y, w, h) => setAccountMenu({ x, y, w, h }));
  };
  const closeAccountMenu = () => setAccountMenu(null);

  const logout = () => {
    setConfirmingLogout(false);
    logoutPlayerAccount();
    router.replace('/home');
  };

  return frame(
    <View style={[styles.headerBar, mirror, compact && styles.headerBarPhone]}>
      <Pressable accessibilityRole="link" accessibilityLabel={t('nav.home')} onPress={() => go('/home')} hitSlop={6}>
        {brandContent}
      </Pressable>
      <View style={[styles.navEnd, mirror, { gap: compact ? spacing.xs : spacing.sm }]}>
        {links.map((link) => (
          <Pressable
            key={link.key}
            accessibilityRole="link"
            accessibilityLabel={link.label}
            accessibilityState={{ selected: link.active }}
            onPress={() => go(link.href)}
            style={({ pressed }) => [
              styles.navIconButton,
              // A wide window names each section beside its icon — the same tabs as the admin tool's.
              !compact && styles.navTab,
              !compact && mirror,
              { borderColor: link.active ? brandColor : 'transparent' },
              link.active && { backgroundColor: brandColor },
              pressed && styles.pressed,
            ]}
          >
            <NavIcon name={link.key} color={link.active ? (light ? colors.ink : colors.white) : fg} />
            {!compact ? (
              <T variant="label" color={link.active ? (light ? colors.ink : colors.white) : fg} style={{ fontSize: 14 }} numberOfLines={1}>
                {link.label}
              </T>
            ) : null}
          </Pressable>
        ))}
        {player ? (
          <View ref={accountTriggerRef} collapsable={false}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nav.accountMenu')}
              accessibilityState={{ expanded: accountMenu !== null }}
              onPress={openAccountMenu}
              style={({ pressed }) => [
                styles.navAccount,
                mirror,
                { borderColor: accountMenuActive ? brandColor : fg },
                accountMenuActive && { backgroundColor: brandColor },
                pressed && styles.pressed,
              ]}
            >
              {compact ? (
                // A phone has no room for the name — the account icon stands in, the menu says who.
                <NavIcon name="account" color={accountMenuActive ? (light ? colors.ink : colors.white) : fg} />
              ) : (
                <T
                  variant="label"
                  color={accountMenuActive ? (light ? colors.ink : colors.white) : fg}
                  style={{ fontSize: 13, maxWidth: 140 }}
                  numberOfLines={1}
                >
                  {player.username}
                </T>
              )}
              {walletLoaded ? (
                <View style={styles.navBadge}>
                  <T variant="label" color={colors.white} style={{ fontSize: 11 }}>
                    {gamesLeft}
                  </T>
                </View>
              ) : null}
              <T variant="label" color={accountMenuActive ? (light ? colors.ink : colors.white) : fg} style={{ fontSize: 11 }}>
                {'▾'}
              </T>
            </Pressable>
          </View>
        ) : null}
        {player && !compact ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('account.logout')}
            onPress={() => setConfirmingLogout(true)}
            style={({ pressed }) => [styles.navIconButton, { borderColor: 'transparent' }, pressed && styles.pressed]}
          >
            <NavIcon name="logout" color={light ? colors.white : colors.red} />
          </Pressable>
        ) : null}
        <LanguageToggle light={light} />
      </View>
      <Modal visible={accountMenu !== null} transparent animationType="fade" onRequestClose={closeAccountMenu}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeAccountMenu} accessibilityLabel={t('nav.close')}>
          {accountMenu ? (
            <View
              style={[
                styles.accountDropdown,
                {
                  top: accountMenu.y + accountMenu.h + 4,
                  left: Math.max(8, Math.min(accountMenu.x + accountMenu.w - ACCOUNT_DROPDOWN_WIDTH, width - ACCOUNT_DROPDOWN_WIDTH - 8)),
                },
              ]}
            >
              {accountItems.map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: item.active }}
                  onPress={() => {
                    closeAccountMenu();
                    go(item.href);
                  }}
                  style={({ pressed }) => [styles.accountDropdownItem, item.active && styles.accountDropdownItemActive, pressed && styles.pressed]}
                >
                  <T variant="label" color={item.active ? colors.white : colors.ink} style={{ fontSize: 15 }}>
                    {item.label}
                  </T>
                </Pressable>
              ))}
              {compact ? (
                // On a phone, log out lives here rather than as its own header icon.
                <Pressable
                  accessibilityRole="menuitem"
                  onPress={() => {
                    closeAccountMenu();
                    setConfirmingLogout(true);
                  }}
                  style={({ pressed }) => [styles.accountDropdownItem, styles.accountDropdownLogout, pressed && styles.pressed]}
                >
                  <T variant="label" color={colors.red} style={{ fontSize: 15 }}>
                    {t('account.logout')}
                  </T>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </Modal>
      <ConfirmModal
        visible={confirmingLogout}
        title={t('account.logout')}
        body={t('account.logoutConfirm')}
        confirmLabel={t('common.yes')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={logout}
        onCancel={() => setConfirmingLogout(false)}
      />
    </View>
  );
}

/** Feather-style 24px line icons for the header bar, keyed by nav link. */
function NavIcon({ name, color }: { name: string; color: string }) {
  const common = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === 'home' ? (
        <>
          <Path d="M3 11l9-8 9 8" {...common} />
          <Path d="M5 10v10h14V10" {...common} />
          <Path d="M10 20v-6h4v6" {...common} />
        </>
      ) : name === 'play' ? (
        <Path d="M7 4l13 8-13 8z" {...common} />
      ) : name === 'buy' ? (
        <>
          <Circle cx={9} cy={20} r={1} {...common} />
          <Circle cx={18} cy={20} r={1} {...common} />
          <Path d="M1 2h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" {...common} />
        </>
      ) : name === 'settings' ? (
        <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" {...common} />
      ) : name === 'privacy' ? (
        <>
          <Circle cx={12} cy={12} r={10} {...common} />
          <Path d="M12 16v-4M12 8h.01" {...common} />
        </>
      ) : name === 'account' ? (
        <>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...common} />
          <Circle cx={12} cy={7} r={4} {...common} />
        </>
      ) : (
        <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" {...common} />
      )}
    </Svg>
  );
}

/* --------------------------------------------------------------- buttons */

/** One label size for every button on every screen — the Create account / Sign in size. */
const BUTTON_LABEL_SIZE = 17;

/**
 * A group of actions (Cancel + Save, Skip + Award …), always on the end
 * side — see useActionLayout. Children go in reading order with the primary
 * last: it lands outermost (far right in English, far left in Arabic).
 * Every action on every page goes through this or the Screen footer, so
 * none of them ever sits anywhere else.
 */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  const actions = useActionLayout();
  return <View style={[styles.buttonPair, { flexDirection: actions.row, alignSelf: actions.align }]}>{children}</View>;
}

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
  const { row } = useActionLayout();
  const [pressed, setPressed] = React.useState(false);
  // Every button — whatever the screen — is the same size: HIT_SIZE tall, one
  // label size. The filled look (ink border + hard shadow) is the Create
  // account / Sign in button; there is deliberately no "smaller" variant.
  const palette: Record<string, { bg: string; fg: string; border: string; shadow: boolean }> = {
    primary: { bg: accent, fg: onAccent, border: colors.ink, shadow: true },
    secondary: { bg: 'transparent', fg: colors.ink, border: colors.ink, shadow: false },
    ghost: { bg: 'transparent', fg: colors.neutral700, border: 'transparent', shadow: false },
    danger: { bg: 'transparent', fg: colors.red, border: colors.red, shadow: false },
  };
  const p = palette[tone];
  const useShadow = (p.shadow || forceShadow) && !disabled && !busy;
  const border = disabled && p.border !== 'transparent' ? colors.mutedText : borderColor ?? p.border;
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
        <View style={[styles.buttonRow, { flexDirection: row }]}>
          <T variant="heading" color={fg} style={{ fontSize: BUTTON_LABEL_SIZE }}>
            {label}
          </T>
          {showArrow ? (
            <T variant="heading" color={fg} style={{ fontSize: BUTTON_LABEL_SIZE + 2 }}>
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

/**
 * One row of a page's own menu (Settings, Profile) — a place to go, not an
 * action, so it is a full-width list row rather than a button; a page's
 * actions stay in its footer.
 */
export function MenuItem({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  const { lang } = useApp();
  // Reading order: the label first, the arrow at the far end.
  const { row } = useActionLayout();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, { flexDirection: row }, pressed && { backgroundColor: colors.mutedBg }]}
    >
      <T variant="label" style={{ fontSize: 16, flex: 1 }} numberOfLines={1}>
        {label}
      </T>
      {value ? (
        <T variant="label" color={colors.neutral700} style={{ fontSize: 14, fontWeight: '500' }} numberOfLines={1}>
          {value}
        </T>
      ) : null}
      <T variant="heading" color={colors.purple} style={{ fontSize: 18 }}>
        {endArrow(lang)}
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

/**
 * The heading at the top of every page. One size rule for all of them: 24 on
 * a phone or a short window, 30 otherwise — so no page's title is bigger
 * than another's for no reason.
 */
export function PageTitle({ children, color = colors.ink }: { children: React.ReactNode; color?: string }) {
  const { lang } = useApp();
  const { width, height } = useWindowDimensions();
  const small = width < 600 || height < 700;
  return (
    <T
      variant="title"
      color={color}
      style={small ? { fontSize: 24, lineHeight: lang === 'ar' ? 36 : 30 } : { fontSize: 30, lineHeight: lang === 'ar' ? 44 : 38 }}
    >
      {children}
    </T>
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
          <ButtonRow>
            <Button label={cancelLabel} tone="secondary" onPress={onCancel} showArrow={false} />
            <Button label={confirmLabel} tone={destructive ? 'danger' : 'primary'} onPress={onConfirm} showArrow={false} />
          </ButtonRow>
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
      <ButtonRow>
        <Button label={t('wallet.buyMore')} accent={colors.red} onPress={() => router.push('/buy')} />
      </ButtonRow>
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
  langToggle: { borderWidth: 2, paddingHorizontal: 12, height: NAV_CONTROL_HEIGHT, justifyContent: 'center' },
  screenInner: { flex: 1, width: '100%', alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  screenInnerPhone: { padding: spacing.md, gap: 12 },
  screenInnerShort: { paddingVertical: 12, gap: 12 },
  scrollContent: { flexGrow: 1 },
  scrollRtl: { direction: 'rtl' },
  scrollLtr: { direction: 'ltr' },
  headerFrame: { borderBottomWidth: 2 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: WIDE_MAX_WIDTH,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  headerBarPhone: { paddingVertical: 10, paddingHorizontal: spacing.md, gap: spacing.xs },
  headerBarGame: { paddingVertical: 6 },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navStart: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
  navEnd: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  navLink: { paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  navAccount: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, paddingHorizontal: 12, height: NAV_CONTROL_HEIGHT, maxWidth: 260 },
  navAccountActive: { backgroundColor: colors.ink },
  navBadge: { backgroundColor: colors.purple, paddingHorizontal: 6, paddingVertical: 1 },
  accountDropdown: {
    position: 'absolute',
    width: ACCOUNT_DROPDOWN_WIDTH,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  accountDropdownItem: { paddingVertical: 12, paddingHorizontal: spacing.md },
  accountDropdownItemActive: { backgroundColor: colors.purple },
  accountDropdownLogout: { borderTopWidth: 2, borderTopColor: colors.mutedBg },
  navIconButton: { borderWidth: 2, width: NAV_CONTROL_HEIGHT, height: NAV_CONTROL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  navTab: { width: 'auto', flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  navIconBadge: { position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, paddingHorizontal: 3, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
  navMenuButton: { borderWidth: 2, width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  navSheetBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'stretch' },
  navSheet: { backgroundColor: colors.ground, borderBottomWidth: 2, borderBottomColor: colors.ink, paddingBottom: spacing.md },
  navSheetItem: { paddingVertical: 14, paddingHorizontal: spacing.lg },
  navSheetItemActive: { backgroundColor: colors.purple },
  navSheetAccount: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, alignItems: 'flex-start' },
  copyrightText: { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { paddingTop: 16, paddingBottom: 8, borderTopWidth: 2, borderTopColor: colors.mutedBg },
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
    minWidth: 128,
    maxWidth: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  // `flex-end` along the row's own direction is the end side in both languages, so a pair that
  // wraps onto two lines on a narrow phone still sits on the end side, not back at the start.
  buttonPair: { gap: spacing.sm, flexWrap: 'wrap', maxWidth: '100%', justifyContent: 'flex-end' },
  footerInner: { width: '100%', alignSelf: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  footerInnerPhone: { paddingHorizontal: spacing.md },
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT_SIZE,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
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
