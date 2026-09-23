import { router } from 'expo-router';
import React, { useState } from 'react';
import { Linking, StyleSheet, TextInput } from 'react-native';
import { Button, ConfirmModal, Screen, Spacer, T } from '../src/ui/components';
import { HIT_SIZE, colors, radius, spacing, type } from '../src/ui/theme';
import { useApp } from '../src/state/AppProvider';
import { CATALOGUE_API_URL } from '../src/config';
import { loginAdmin } from '../src/services/adminAuthApi';

type Mode = 'signIn' | 'create' | 'forgotRequest' | 'forgotConfirm';

export default function Account() {
  const {
    t,
    player,
    playerAuthBusy,
    playerAuthError,
    registerPlayerAccount,
    loginPlayerAccount,
    logoutPlayerAccount,
    requestPasswordReset,
    confirmPasswordReset,
  } = useApp();
  const [mode, setMode] = useState<Mode>('signIn');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [justResetPassword, setJustResetPassword] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [tryingAdmin, setTryingAdmin] = useState(false);
  const [adminRedirecting, setAdminRedirecting] = useState(false);

  const logout = () => {
    setConfirmingLogout(false);
    logoutPlayerAccount();
    router.replace('/home');
  };

  const goToMode = (next: Mode) => {
    setJustResetPassword(false);
    setAdminRedirecting(false);
    setMode(next);
  };

  const submit = async () => {
    setAdminRedirecting(false);
    if (mode !== 'signIn') {
      const ok = await registerPlayerAccount(username.trim(), password, email.trim() || undefined);
      if (ok) router.back();
      return;
    }

    const ok = await loginPlayerAccount(username.trim(), password);
    if (ok) {
      router.back();
      return;
    }

    // Not a player account, or the wrong password — try it as an admin
    // sign-in instead, so an admin never needs a separate "Admin sign-in"
    // link to find their own form. A real admin tool (deck management,
    // players, audit log) lives on its own separate page (`/admin-ui`),
    // not inside this app, so success here means opening that page with
    // the freshly issued token rather than navigating anywhere in-app.
    setTryingAdmin(true);
    try {
      const result = await loginAdmin(username.trim(), password);
      setAdminRedirecting(true);
      void Linking.openURL(
        `${CATALOGUE_API_URL}/admin-ui?token=${encodeURIComponent(result.token)}&username=${encodeURIComponent(
          result.user.username
        )}`
      );
    } catch {
      // Not an admin account either — the player-login error already
      // showing (playerAuthError) covers this case, nothing further to add.
    } finally {
      setTryingAdmin(false);
    }
  };

  const sendResetCode = async () => {
    const ok = await requestPasswordReset(username.trim());
    if (ok) setMode('forgotConfirm');
  };

  const submitReset = async () => {
    const ok = await confirmPasswordReset(username.trim(), resetCode.trim(), newPassword);
    if (ok) {
      setResetCode('');
      setNewPassword('');
      setPassword('');
      setJustResetPassword(true);
      setMode('signIn');
    }
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
      {mode === 'signIn' || mode === 'create' ? null : (
        <>
          <Spacer size={spacing.sm} />
          <T variant="heading">{t('account.forgotRequestTitle')}</T>
          <T variant="body" color={colors.textMuted}>
            {t(mode === 'forgotRequest' ? 'account.forgotRequestBody' : 'account.forgotConfirmBody')}
          </T>
        </>
      )}
      {mode === 'create' ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.accent}>
            {t('account.signupBonus')}
          </T>
        </>
      ) : null}
      {mode === 'signIn' && justResetPassword ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.correct}>
            {t('account.resetSuccess')}
          </T>
        </>
      ) : null}
      <Spacer size={spacing.xl} />

      {mode !== 'forgotConfirm' ? (
        <>
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
        </>
      ) : null}

      {mode === 'signIn' || mode === 'create' ? (
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
      ) : null}

      {mode === 'signIn' ? (
        <>
          <Spacer size={spacing.sm} />
          <Button
            label={t('account.forgotPassword')}
            tone="ghost"
            onPress={() => goToMode('forgotRequest')}
          />
        </>
      ) : null}

      {mode === 'create' ? (
        <>
          <Spacer size={spacing.md} />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('account.email')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            maxLength={254}
            accessibilityLabel={t('account.email')}
            style={styles.input}
          />
          <Spacer size={spacing.xs} />
          <T variant="label" color={colors.textMuted}>
            {t('account.emailOptionalHint')}
          </T>
        </>
      ) : null}

      {mode === 'forgotConfirm' ? (
        <>
          <TextInput
            value={resetCode}
            onChangeText={setResetCode}
            placeholder={t('account.resetCode')}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            accessibilityLabel={t('account.resetCode')}
            style={styles.input}
          />
          <Spacer size={spacing.md} />
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('account.newPassword')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            accessibilityLabel={t('account.newPassword')}
            style={styles.input}
          />
        </>
      ) : null}

      {adminRedirecting ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.correct}>
            {t('account.openingAdminTool')}
          </T>
        </>
      ) : playerAuthError ? (
        <>
          <Spacer size={spacing.sm} />
          <T variant="label" color={colors.skip}>
            {playerAuthError}
          </T>
        </>
      ) : null}

      <Spacer size={spacing.xl} />
      {mode === 'signIn' || mode === 'create' ? (
        <>
          <Button
            label={mode === 'signIn' ? t('account.signIn') : t('account.createAccount')}
            disabled={!username.trim() || !password || playerAuthBusy || tryingAdmin}
            onPress={submit}
          />
          <Spacer size={spacing.sm} />
          <Button
            label={mode === 'signIn' ? t('account.switchToCreate') : t('account.switchToSignIn')}
            tone="secondary"
            onPress={() => goToMode(mode === 'signIn' ? 'create' : 'signIn')}
          />
        </>
      ) : mode === 'forgotRequest' ? (
        <>
          <Button
            label={t('account.sendResetCode')}
            disabled={!username.trim() || playerAuthBusy}
            onPress={sendResetCode}
          />
          <Spacer size={spacing.sm} />
          <Button label={t('account.backToSignIn')} tone="secondary" onPress={() => goToMode('signIn')} />
        </>
      ) : (
        <>
          <Button
            label={t('account.resetPassword')}
            disabled={resetCode.trim().length !== 6 || !newPassword || playerAuthBusy}
            onPress={submitReset}
          />
          <Spacer size={spacing.sm} />
          <Button label={t('account.backToSignIn')} tone="secondary" onPress={() => goToMode('signIn')} />
        </>
      )}

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
