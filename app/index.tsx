import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Screen, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { ar } from '../src/i18n/ar';
import { en } from '../src/i18n/en';

/**
 * Splash. Held for a beat so the title lands, then routes to the language
 * picker on a first run or straight to the home screen afterwards.
 */
export default function Splash() {
  const { prefs } = useApp();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDone(true), 900);
    return () => clearTimeout(timer);
  }, []);

  // A native install already knows what it installed — straight to the menu.
  // A website visitor might not know what Yalla Mithilha even is yet, so the
  // web build's entry point is the explainer landing page instead.
  if (done) {
    if (!prefs.lang) return <Redirect href="/language" />;
    return <Redirect href={Platform.OS === 'web' ? '/landing' : '/home'} />;
  }

  return (
    <Screen>
      <View style={styles.center}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel={`${ar['app.name']} / ${en['app.name']}`}
        />
        {/* Always both languages, regardless of the current app language —
            this is the brand mark, shown before a language is even chosen
            on a first run. Reads from the translation catalogues directly
            (rather than duplicating the strings here) so there is exactly
            one place each name is spelled. */}
        <T variant="display" align="center">
          {ar['app.name']}
        </T>
        <T variant="heading" color={colors.textMuted} align="center">
          {en['app.name']}
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  logo: { width: 140, height: 140, borderRadius: 28, marginBottom: spacing.lg },
});
