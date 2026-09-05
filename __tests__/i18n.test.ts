import { ar } from '../src/i18n/ar';
import { en } from '../src/i18n/en';
import {
  allKeys,
  directionFor,
  formatNumber,
  isRtl,
  langFromLocale,
  makeTranslator,
  missingKeys,
  translate,
} from '../src/i18n';

describe('catalogues', () => {
  it('has the same keys in Arabic and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ar).sort());
  });

  it('has no empty strings in either language', () => {
    expect(missingKeys('ar')).toEqual([]);
    expect(missingKeys('en')).toEqual([]);
  });

  it('does not leave English text sitting in the Arabic catalogue', () => {
    const suspicious = allKeys().filter((key) => {
      if (key === 'lang.english' || key === 'app.name') return false;
      return /^[\x00-\x7F]+$/.test(ar[key]);
    });
    expect(suspicious).toEqual([]);
  });
});

describe('translate', () => {
  it('interpolates named parameters', () => {
    expect(translate('en', 'charades.play.turn', { team: 'Dana' })).toBe('Dana’s turn');
    expect(translate('ar', 'charades.play.turn', { team: 'دانة' })).toContain('دانة');
  });

  it('leaves an unknown placeholder untouched instead of printing undefined', () => {
    expect(translate('en', 'charades.play.turn', { other: 'x' })).toContain('{{team}}');
  });

  it('falls back to English for a missing key rather than crashing', () => {
    expect(translate('ar', 'not.a.real.key' as never)).toBe('not.a.real.key');
  });

  it('exposes a bound translator', () => {
    const t = makeTranslator('en');
    expect(t('charades.play.round', { round: 2, total: 20 })).toBe('Round 2 of 20');
  });
});

describe('direction', () => {
  it('marks Arabic as right-to-left and English as left-to-right', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
    expect(directionFor('ar')).toBe('rtl');
    expect(directionFor('en')).toBe('ltr');
  });

  it('defaults to Arabic only for Arabic device locales', () => {
    expect(langFromLocale('ar-KW')).toBe('ar');
    expect(langFromLocale('ar')).toBe('ar');
    expect(langFromLocale('en-US')).toBe('en');
    expect(langFromLocale(null)).toBe('en');
  });
});

describe('formatNumber', () => {
  it('uses Arabic-Indic digits in Arabic', () => {
    expect(formatNumber('ar', 30)).toBe('٣٠');
    expect(formatNumber('ar', 105)).toBe('١٠٥');
  });

  it('leaves English numbers alone', () => {
    expect(formatNumber('en', 30)).toBe('30');
  });
});
