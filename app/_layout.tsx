import { Stack, router, useGlobalSearchParams, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/state/AppProvider';
import { applyDirection, needsRestartForDirection } from '../src/platform';
import { colors } from '../src/ui/theme';
import { SessionExpiredPrompt } from '../src/ui/components';
import { useBrandFonts } from '../src/ui/fonts';
import { isPublicPath, signInHref } from '../src/services/access';

/**
 * The one sign-in check for every screen: a guest opening anything but the
 * public screens (src/services/access.ts) — by a bookmark, a typed address,
 * or a session that just ended — is sent to sign in, and comes straight
 * back to that screen afterwards. The screen is covered until then, so it
 * never shows for a moment first.
 */
function SignInGuard() {
  const { player } = useApp();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const blocked = !player && !isPublicPath(pathname);
  const search = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v === undefined ? [] : [[k, v]]))
  ).toString();

  useEffect(() => {
    if (blocked) router.replace(signInHref(pathname, search) as never);
  }, [blocked, pathname, search]);

  if (!blocked) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ground, justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.purple} size="large" />
    </View>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, lang, prefs } = useApp();
  const [fontsLoaded] = useBrandFonts();

  useEffect(() => {
    if (!ready || !prefs.lang) return;
    // React Native decides layout direction once, before the first frame, so
    // this only takes effect on the next launch. The language screen tells the
    // player that in plain words rather than leaving a half-mirrored UI.
    if (needsRestartForDirection(lang)) applyDirection(lang);
  }, [lang, prefs.lang, ready]);

  if (!ready || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ground, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.purple} size="large" />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Gate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'fade',
              // Nothing in a live round should be dismissible by a stray swipe.
              gestureEnabled: false,
            }}
          />
          <SignInGuard />
          <SessionExpiredPrompt />
        </Gate>
      </AppProvider>
    </SafeAreaProvider>
  );
}
