import { Stack } from 'expo-router';
import React from 'react';
import { colors } from '../../src/ui/theme';

export default function CharadesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
