import { buildRevealUrl, resolveRevealBaseUrl } from '../src/engine/reveal';

describe('resolveRevealBaseUrl', () => {
  it('prefers an explicitly configured base URL over the page origin', () => {
    expect(resolveRevealBaseUrl('https://configured.example', 'https://page.example')).toBe(
      'https://configured.example'
    );
  });

  it('falls back to the page origin when nothing is configured', () => {
    expect(resolveRevealBaseUrl(null, 'https://page.example')).toBe('https://page.example');
  });

  it('strips a trailing slash from either source', () => {
    expect(resolveRevealBaseUrl('https://configured.example/', null)).toBe('https://configured.example');
    expect(resolveRevealBaseUrl(null, 'https://page.example/')).toBe('https://page.example');
  });

  it('returns null when neither source is available (native host, unconfigured)', () => {
    expect(resolveRevealBaseUrl(null, null)).toBeNull();
  });

  it('treats an empty/whitespace-only configured value as unset', () => {
    expect(resolveRevealBaseUrl('  ', 'https://page.example')).toBe('https://page.example');
  });
});

describe('buildRevealUrl', () => {
  it('builds a link to the reveal route with the title and category URL-encoded', () => {
    const url = buildRevealUrl('https://example.com', 'The Lion King', 'أفلام', 'Movies');
    expect(url.startsWith('https://example.com/charades/reveal?')).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get('t')).toBe('The Lion King');
    expect(params.get('ca')).toBe('أفلام');
    expect(params.get('ce')).toBe('Movies');
  });

  it('round-trips Arabic titles and special characters', () => {
    const title = 'أحلام الشوارع & أصدقاء؟';
    const url = buildRevealUrl('https://example.com', title, 'فئة', 'Category');
    const params = new URL(url).searchParams;
    expect(params.get('t')).toBe(title);
  });
});
