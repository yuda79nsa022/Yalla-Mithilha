import { appNameFor, formatDateTime, logoUrlFor, type Branding } from '../src/services/branding';

const branding: Branding = { appNameAr: 'يلا مثّلها', appNameEn: 'Yalla Mithilha', logoPath: '/branding/logo-1.png', timezone: 'Asia/Kuwait' };

describe('branding helpers', () => {
  it('picks the name for the language, falling back until it loads', () => {
    expect(appNameFor(branding, 'ar', 'x')).toBe('يلا مثّلها');
    expect(appNameFor(branding, 'en', 'x')).toBe('Yalla Mithilha');
    expect(appNameFor(null, 'en', 'Bas Bedoon Kalam')).toBe('Bas Bedoon Kalam');
  });

  it('builds the logo URL against the API, or null for the built-in one', () => {
    expect(logoUrlFor(branding, 'https://game.example')).toBe('https://game.example/branding/logo-1.png');
    expect(logoUrlFor({ ...branding, logoPath: null }, 'https://game.example')).toBeNull();
  });

  it('shows dates in the admin-set timezone, not the device one', () => {
    // 23:30 UTC on 1 Jan is already 2 Jan in Kuwait (UTC+3).
    const ts = Date.UTC(2026, 0, 1, 23, 30);
    expect(formatDateTime(ts, 'en', 'Asia/Kuwait', false)).toContain('2 Jan');
    expect(formatDateTime(ts, 'en', 'UTC', false)).toContain('1 Jan');
    expect(formatDateTime(ts, 'en', 'Not/AZone', false)).toMatch(/Jan 2026/);
  });
});
