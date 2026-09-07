import { resolveCatalogueApiUrl } from '../src/config';

describe('resolveCatalogueApiUrl', () => {
  it('prefers an explicitly configured URL over the page origin', () => {
    expect(resolveCatalogueApiUrl('https://configured.example', 'https://page.example', 'http://localhost:4000')).toBe(
      'https://configured.example'
    );
  });

  it('falls back to the page origin when nothing is configured (the unified pm2 deployment)', () => {
    expect(resolveCatalogueApiUrl(undefined, 'https://page.example', 'http://localhost:4000')).toBe(
      'https://page.example'
    );
  });

  it('falls back to the dev default when neither is available (native, unconfigured)', () => {
    expect(resolveCatalogueApiUrl(undefined, null, 'http://localhost:4000')).toBe('http://localhost:4000');
  });

  it('treats an empty/whitespace-only configured value as unset', () => {
    expect(resolveCatalogueApiUrl('   ', 'https://page.example', 'http://localhost:4000')).toBe(
      'https://page.example'
    );
  });
});
