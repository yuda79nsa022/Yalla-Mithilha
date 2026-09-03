import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
        {/* The chevron band is the app's one signature mark: a nod to Sadu
            weaving, drawn in plain views so it costs nothing to render. */}
        <View style={styles.band}>
          {Array.from({ length: 7 }, (_, i) => (
            <View
              key={i}
              style={[styles.chevron, { backgroundColor: i % 2 ? colors.gold : colors.taboo }]}
            />
          ))}
        </View>
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
  band: { flexDirection: 'row', gap: 6, marginBottom: spacing.lg },
  chevron: { width: 18, height: 18, transform: [{ rotate: '45deg' }], borderRadius: 3 },
});
