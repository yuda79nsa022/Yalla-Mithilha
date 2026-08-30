import { Stack } from 'expo-router';
import React from 'react';
import { colors } from '../../src/ui/theme';

/**
 * The in-game stack. Back gestures are disabled throughout: a swipe out of a
 * live round while the phone is being waved about would lose the turn.
 */
export default function GameLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
