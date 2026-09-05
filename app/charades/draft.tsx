import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { Button, Screen, Spacer, T } from '../../src/ui/components';
import { HIT_SIZE, colors, radius, spacing, type } from '../../src/ui/theme';
import { useApp } from '../../src/state/AppProvider';

export default function CharadesDraft() {
  const { t, startCharadesDraft } = useApp();
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');

  const confirmDraft = () => {
    if (!teamAName.trim() || !teamBName.trim()) return;
    startCharadesDraft(teamAName.trim(), teamBName.trim());
    router.push('/charades/checkout');
  };

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('charades.draft.title')}</T>
      <T variant="body" color={colors.textMuted}>
        {t('charades.draft.subtitle')}
      </T>
      <Spacer size={spacing.xl} />

      <TextInput
        value={teamAName}
        onChangeText={setTeamAName}
        placeholder={t('charades.draft.teamAName')}
        placeholderTextColor={colors.textMuted}
        maxLength={20}
        accessibilityLabel={t('charades.draft.teamAName')}
        style={[styles.input, { borderColor: colors.teamA }]}
      />
      <Spacer size={spacing.md} />
      <TextInput
        value={teamBName}
        onChangeText={setTeamBName}
        placeholder={t('charades.draft.teamBName')}
        placeholderTextColor={colors.textMuted}
        maxLength={20}
        accessibilityLabel={t('charades.draft.teamBName')}
        style={[styles.input, { borderColor: colors.teamB }]}
      />

      <Spacer size={spacing.xl} />
      <Button
        label={t('charades.draft.confirm')}
        disabled={!teamAName.trim() || !teamBName.trim()}
        accent={colors.accent}
        onPress={confirmDraft}
      />
      <Spacer size={spacing.sm} />
      <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: HIT_SIZE,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.bgSunken,
    ...type.body,
    textAlign: 'auto',
  },
});
