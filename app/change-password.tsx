import { router } from 'expo-router';
import React, { useState } from 'react';
import { Button, Field, Screen, T } from '../src/ui/components';
import { colors } from '../src/ui/theme';
import { goBack } from '../src/platform/navigation';
import { useApp } from '../src/state/AppProvider';

export default function ChangePassword() {
  const { t, player, changePassword } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!player) {
    // Only a signed-in player has a password to change.
    router.replace('/account');
    return null;
  }

  const localError = next && next.length < 8 ? t('password.tooShort') : confirm && next !== confirm ? t('password.mismatch') : null;
  const canSubmit = Boolean(current && next.length >= 8 && next === confirm) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setDone(false);
    const failure = await changePassword(current, next);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setCurrent('');
    setNext('');
    setConfirm('');
    setDone(true);
  };

  return (
    <Screen
      scroll
      header={{}}
      footer={
        <>
          <Button label={t('password.save')} disabled={!canSubmit} busy={busy} onPress={submit} />
          <Button label={t('common.cancel')} tone="ghost" showArrow={false} onPress={() => goBack('/account')} />
        </>
      }
    >
      <T variant="title">{t('password.title')}</T>
      <Field label={t('password.current')} value={current} onChangeText={setCurrent} placeholder={t('password.current')} secureTextEntry />
      <Field label={t('password.new')} value={next} onChangeText={setNext} placeholder={t('password.new')} secureTextEntry />
      <Field label={t('password.confirm')} value={confirm} onChangeText={setConfirm} placeholder={t('password.confirm')} secureTextEntry />
      {localError ? (
        <T variant="label" color={colors.red}>
          {localError}
        </T>
      ) : null}
      {error ? (
        <T variant="label" color={colors.red}>
          {error}
        </T>
      ) : null}
      {done ? (
        <T variant="label" color={colors.green}>
          {t('password.done')}
        </T>
      ) : null}
    </Screen>
  );
}
