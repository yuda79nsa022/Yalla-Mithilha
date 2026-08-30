import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, T } from '../src/ui/components';
import { colors, spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

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

  if (done) return <Redirect href={prefs.lang ? '/home' : '/language'} />;

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
        <T variant="display" align="center">
          يلا مثّلها
        </T>
        <T variant="heading" color={colors.textMuted} align="center">
          Yalla Mithilha
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
