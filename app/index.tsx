import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../src/ui/components';
import { Logo } from '../src/ui/Logo';
import { spacing } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

/**
 * Splash. Held for a beat so the brand mark lands, then routes to the
 * language picker on a first run or straight to the home screen afterwards.
 */
export default function Splash() {
  const { prefs } = useApp();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDone(true), 900);
    return () => clearTimeout(timer);
  }, []);

  if (done) {
    if (!prefs.lang) return <Redirect href="/language" />;
    return <Redirect href="/home" />;
  }

  return (
    <Screen>
      <View style={styles.center}>
        <Logo size="lg" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});
