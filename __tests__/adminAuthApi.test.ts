import { AdminAuthError, loginAdmin } from '../src/services/adminAuthApi';

function mockFetch(impl: typeof fetch) {
  (global as unknown as { fetch: typeof fetch }).fetch = impl;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('loginAdmin', () => {
  it('returns the token and user on a valid response', async () => {
    mockFetch(
      async () => new Response(JSON.stringify({ token: 'tok', user: { id: '1', username: 'admin' } }), { status: 200 })
    );
    const result = await loginAdmin('admin', 'password1234', 'http://example.test');
    expect(result).toEqual({ token: 'tok', user: { id: '1', username: 'admin' } });
  });

  it('posts to /admin/auth/login with the given credentials', async () => {
    let calledUrl = '';
    let sentBody: unknown;
    mockFetch(async (url, init) => {
      calledUrl = String(url);
      sentBody = JSON.parse((init as RequestInit).body as string);
      return new Response(JSON.stringify({ token: 'tok', user: { id: '1', username: 'admin' } }), { status: 200 });
    });
    await loginAdmin('admin', 'password1234', 'http://example.test');
    expect(calledUrl).toBe('http://example.test/admin/auth/login');
    expect(sentBody).toEqual({ username: 'admin', password: 'password1234' });
  });

  it('throws an AdminAuthError carrying the server message on invalid credentials', async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: 'invalid username or password' }), { status: 401 }));
    await expect(loginAdmin('admin', 'wrong', 'http://example.test')).rejects.toMatchObject({
      message: 'invalid username or password',
      status: 401,
    });
  });

  it('throws an AdminAuthError when the body is malformed', async () => {
    mockFetch(async () => new Response(JSON.stringify({ nonsense: true }), { status: 200 }));
    await expect(loginAdmin('admin', 'password1234', 'http://example.test')).rejects.toThrow(AdminAuthError);
  });

  it('wraps a network failure in an AdminAuthError', async () => {
    mockFetch(async () => {
      throw new Error('network down');
    });
    await expect(loginAdmin('admin', 'password1234', 'http://example.test')).rejects.toThrow(AdminAuthError);
  });
});
