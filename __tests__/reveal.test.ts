import { buildRevealUrl, parseRevealToken, resolveRevealBaseUrl } from '../src/engine/reveal';
import { decodeRevealToken, encodeRevealToken } from '../src/engine/revealToken';

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

describe('buildRevealUrl + parseRevealToken', () => {
  it('builds a link to the reveal route carrying a single opaque token, not a readable query string', () => {
    const url = buildRevealUrl('https://example.com', 'The Lion King', 'أفلام', 'Movies');
    expect(url.startsWith('https://example.com/reveal?d=')).toBe(true);
    // The whole point: none of the plaintext title/category ever appears in the URL itself.
    expect(url).not.toContain('The Lion King');
    expect(url).not.toContain('Movies');
  });

  it('round-trips title, category and image through build -> parse', () => {
    const url = buildRevealUrl(
      'https://example.com',
      'The Lion King',
      'أفلام',
      'Movies',
      'https://api.example/title-images/x.png'
    );
    const token = new URL(url).searchParams.get('d');
    const payload = parseRevealToken(token ?? undefined);
    expect(payload).toEqual({
      t: 'The Lion King',
      ca: 'أفلام',
      ce: 'Movies',
      img: 'https://api.example/title-images/x.png',
    });
  });

  it('round-trips Arabic titles and special characters', () => {
    const title = 'أحلام الشوارع & أصدقاء؟';
    const url = buildRevealUrl('https://example.com', title, 'فئة', 'Category');
    const token = new URL(url).searchParams.get('d');
    expect(parseRevealToken(token ?? undefined)?.t).toBe(title);
  });

  it('omits the img field entirely when the title has no picture', () => {
    const url = buildRevealUrl('https://example.com', 'The Lion King', 'أفلام', 'Movies');
    const token = new URL(url).searchParams.get('d');
    expect(parseRevealToken(token ?? undefined)?.img).toBeUndefined();
  });

  it('returns null for a missing token', () => {
    expect(parseRevealToken(undefined)).toBeNull();
  });
});

describe('encodeRevealToken / decodeRevealToken', () => {
  it('produces a token containing none of the plaintext payload', () => {
    const token = encodeRevealToken({ t: 'The Lion King', ca: 'أفلام', ce: 'Movies' });
    expect(token).not.toContain('Lion');
    expect(token).not.toContain('أفلام');
    // Only hex characters, four per encoded UTF-16 unit.
    expect(token).toMatch(/^[0-9a-f]+$/);
    expect(token.length % 4).toBe(0);
  });

  it('round-trips a payload with no image', () => {
    const payload = { t: 'Title', ca: 'فئة', ce: 'Category' };
    expect(decodeRevealToken(encodeRevealToken(payload))).toEqual(payload);
  });

  it('round-trips a long title with emoji and mixed scripts', () => {
    const payload = { t: 'مسلسل 😄 Friends season 3', ca: 'مسلسلات', ce: 'Series', img: 'https://x.example/a.png' };
    expect(decodeRevealToken(encodeRevealToken(payload))).toEqual(payload);
  });

  it('rejects garbage input instead of throwing', () => {
    expect(decodeRevealToken('not-hex!!')).toBeNull();
    expect(decodeRevealToken('abc')).toBeNull(); // not a multiple of 4
    expect(decodeRevealToken('')).toBeNull();
  });

  it('rejects a well-formed token whose decoded JSON is the wrong shape', () => {
    // Valid JSON, but missing the required t/ca/ce string fields.
    const token = encodeRevealToken({ x: 1 } as never);
    expect(decodeRevealToken(token)).toBeNull();
  });
});
