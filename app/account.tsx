import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { Button, ConfirmModal, Screen, Spacer, T } from '../src/ui/components';
import { HIT_SIZE, colors, radius, spacing, type } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';

export default function Account() {
  const { t, player, playerAuthBusy, playerAuthError, registerPlayerAccount, loginPlayerAccount, logoutPlayerAccount } =
    useApp();
  const [mode, setMode] = useState<'signIn' | 'create'>('signIn');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const logout = () => {
    setConfirmingLogout(false);
    logoutPlayerAccount();
    router.replace('/home');
  };

  const submit = async () => {
    const ok =
      mode === 'signIn'
        ? await loginPlayerAccount(username.trim(), password)
        : await registerPlayerAccount(username.trim(), password);
    if (ok) router.back();
  };

  if (player) {
    return (
      <Screen scroll>
        <Spacer size={spacing.md} />
        <T variant="title">{t('account.title')}</T>
        <Spacer size={spacing.xl} />
        <T variant="body">{t('account.loggedInAs', { username: player.username })}</T>
        <Spacer size={spacing.xl} />
        <Button label={t('account.logout')} tone="danger" onPress={() => setConfirmingLogout(true)} />
        <Spacer />
        <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />

        <ConfirmModal
          visible={confirmingLogout}
          title={t('account.logout')}
          body={t('account.logoutConfirm')}
          confirmLabel={t('common.yes')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={logout}
          onCancel={() => setConfirmingLogout(false)}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Spacer size={spacing.md} />
      <T variant="title">{t('account.title')}</T>
      <T variant="body" color={colors.textMuted}>
        {t('account.subtitle')}
      </T>
      <Spacer size={spacing.xl} />

      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder={t('account.username')}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={40}
        accessibilityLabel={t('account.username')}
        style={styles.input}
      />
      <Spacer size={spacing.md} />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={t('account.password')}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        accessibilityLabel={t('account.password')}
        style={styles.input}
      />

      {playerAuthError ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.skip}>
            {playerAuthError}
          </T>
        </>
      ) : null}

      <Spacer size={spacing.xl} />
      <Button
        label={mode === 'signIn' ? t('account.signIn') : t('account.createAccount')}
        disabled={!username.trim() || !password || playerAuthBusy}
        onPress={submit}
      />
      <Spacer size={spacing.sm} />
      <Button
        label={mode === 'signIn' ? t('account.switchToCreate') : t('account.switchToSignIn')}
        tone="secondary"
        onPress={() => setMode(mode === 'signIn' ? 'create' : 'signIn')}
      />

      <Spacer size={spacing.xl} />
      <Button label={t('common.back')} tone="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: HIT_SIZE,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.bgSunken,
    ...type.body,
    textAlign: 'auto',
  },
});
