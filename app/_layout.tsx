import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/state/AppProvider';
import { applyDirection, needsRestartForDirection } from '../src/platform';
import { colors } from '../src/ui/theme';

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, lang, prefs } = useApp();

  useEffect(() => {
    if (!ready || !prefs.lang) return;
    // React Native decides layout direction once, before the first frame, so
    // this only takes effect on the next launch. The language screen tells the
    // player that in plain words rather than leaving a half-mirrored UI.
    if (needsRestartForDirection(lang)) applyDirection(lang);
  }, [lang, prefs.lang, ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
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
        </Gate>
      </AppProvider>
    </SafeAreaProvider>
  );
}
