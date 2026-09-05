import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';
import type { KeyValueStore } from '../engine/persistence';
import { langFromLocale } from '../i18n';
import type { Lang } from '../engine/types';

/** AsyncStorage behind the engine's storage interface. */
export const deviceStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export function deviceLanguage(): Lang {
  const locales = Localization.getLocales?.() ?? [];
  return langFromLocale(locales[0]?.languageTag ?? null);
}

/**
 * React Native lays a whole tree out in one direction, decided before the JS
 * bundle draws its first frame. Switching direction therefore needs a reload,
 * which we make explicit rather than leaving a half-mirrored screen behind.
 */
export function needsRestartForDirection(lang: Lang): boolean {
  return I18nManager.isRTL !== (lang === 'ar');
}

export function applyDirection(lang: Lang): void {
  const rtl = lang === 'ar';
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
}

export const isRtlLayout = () => I18nManager.isRTL;
