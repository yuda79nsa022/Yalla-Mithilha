import { Redirect, router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen, Spacer, T } from '../../src/ui/components';
import { colors, miniGameColor, onAccent, spacing } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';
import { currentPlan, performerName, teamById } from '../../src/engine/engine';
import { vibrate } from '../../src/platform';

/**
 * The privacy gate. Nothing about the coming card is on screen — only whose
 * hands the phone should be in.
 */
export default function Pass() {
  const { t, session, prefs } = useApp();
  if (!session) return <Redirect href="/home" />;

  const plan = currentPlan(session);
  if (!plan) return <Redirect href="/game/winner" />;

  const accent = miniGameColor(plan.game);
  const name = performerName(session, plan.performerId);
  const team = teamById(session, plan.teamId);
  const teamName = team
    ? team.name.startsWith('team.')
      ? t(team.name as never)
      : team.name
    : '';

  const go = () => {
    void vibrate('light', prefs.haptics);
    router.replace('/game/brief');
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('pass.ready')}
      onPress={go}
      style={{ flex: 1 }}
    >
      <Screen background={colors.bgSunken}>
        <View style={styles.center}>
          <View style={[styles.badge, { borderColor: accent }]}>
            <T variant="label" color={accent}>
              {teamName}
            </T>
          </View>
          <Spacer size={spacing.lg} />
          <T variant="display" align="center">
            {t('pass.title', { name })}
          </T>
          <Spacer size={spacing.md} />
          <T variant="heading" color={colors.textMuted} align="center">
            {t('pass.subtitle')}
          </T>
          <Spacer size={spacing.xxl} />
          <View style={[styles.cta, { backgroundColor: accent }]}>
            <T variant="heading" color={onAccent}>
              {t('pass.ready')}
            </T>
          </View>
        </View>
      </Screen>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  cta: { borderRadius: 999, paddingHorizontal: 32, paddingVertical: 18 },
});
