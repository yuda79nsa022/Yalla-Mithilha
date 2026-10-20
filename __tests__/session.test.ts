import { SESSION_REFRESH_WINDOW_MS, checkSession, tokenExpiresAt } from '../src/services/session';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const tokenWith = (payload: object) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`;

describe('tokenExpiresAt', () => {
  it('reads the exp claim, in ms', () => {
    expect(tokenExpiresAt(tokenWith({ sub: 'p', exp: 1_700_000_000 }))).toBe(1_700_000_000_000);
  });

  it('copes with a non-ASCII username in the payload', () => {
    expect(tokenExpiresAt(tokenWith({ username: 'دانة', exp: 5 }))).toBe(5000);
  });

  it('is null for anything without a readable exp', () => {
    expect(tokenExpiresAt('not-a-jwt')).toBeNull();
    expect(tokenExpiresAt('a.%%%.c')).toBeNull();
    expect(tokenExpiresAt(tokenWith({ sub: 'p' }))).toBeNull();
    expect(tokenExpiresAt(tokenWith({ exp: 'soon' }))).toBeNull();
  });
});

describe('checkSession', () => {
  const now = 1_000_000_000_000;
  const expiringIn = (ms: number) => tokenWith({ exp: (now + ms) / 1000 });

  it('leaves a fresh token alone', () => {
    expect(checkSession(expiringIn(SESSION_REFRESH_WINDOW_MS + 60_000), now)).toBe('ok');
  });

  it('refreshes one close to expiry', () => {
    expect(checkSession(expiringIn(SESSION_REFRESH_WINDOW_MS - 60_000), now)).toBe('refresh');
  });

  it('ends one that already expired', () => {
    expect(checkSession(expiringIn(0), now)).toBe('expired');
    expect(checkSession(expiringIn(-1000), now)).toBe('expired');
  });

  it('leaves an unreadable token for the server to judge', () => {
    expect(checkSession('opaque', now)).toBe('ok');
  });
});
