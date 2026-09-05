import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { I18nManager, Platform } from 'react-native';
import type { KeyValueStore } from '../engine/persistence';
import { langFromLocale } from '../i18n';
import type { Lang } from '../engine/types';

/** AsyncStorage behind the engine's storage interface. */
export const deviceStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

/**
 * The language a first-time player sees before they ever touch the language
 * toggle. On web this is always Arabic — the audience this app is actually
 * built for — rather than trusting the browser's reported locale, which is
 * often English even for an Arabic-speaking visitor. Native keeps detecting
 * the device's own language, since that's a deliberate per-user OS setting
 * rather than a browser default nobody configured.
 */
export function deviceLanguage(): Lang {
  if (Platform.OS === 'web') return 'ar';
  const locales = Localization.getLocales?.() ?? [];
  return langFromLocale(locales[0]?.languageTag ?? null);
}

/**
 * React Native lays a whole tree out in one direction, decided before the JS
 * bundle draws its first frame. Switching direction therefore needs a reload,
 * which we make explicit rather than leaving a half-mirrored screen behind.
 *
 * On web, `I18nManager.isRTL` is `undefined` rather than a real boolean, so
 * comparing it to `lang === 'ar'` is always true regardless of which language
 * is active — a permanently wrong "restart needed" notice. None of this
 * app's own layout actually depends on `I18nManager`'s mirroring anyway
 * (every screen sets its own `textAlign` and never relies on RN to flip flex
 * containers), so there is nothing to restart for on web at all.
 */
export function needsRestartForDirection(lang: Lang): boolean {
  if (Platform.OS === 'web') return false;
  return I18nManager.isRTL !== (lang === 'ar');
}

export function applyDirection(lang: Lang): void {
  const rtl = lang === 'ar';
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
}

export const isRtlLayout = () => I18nManager.isRTL;
