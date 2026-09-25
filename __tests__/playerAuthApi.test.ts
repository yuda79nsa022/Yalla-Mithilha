import {
  PlayerAuthError,
  confirmPasswordReset,
  loginPlayer,
  registerPlayer,
  requestPasswordReset,
} from '../src/services/playerAuthApi';

function mockFetch(impl: typeof fetch) {
  (global as unknown as { fetch: typeof fetch }).fetch = impl;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('registerPlayer', () => {
  it('returns the token and player on a valid response', async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ token: 'tok', player: { id: '1', username: 'jane' } }), { status: 201 })
    );
    const result = await registerPlayer('jane', 'password1234', 'jane@example.com', 'http://example.test');
    expect(result).toEqual({ token: 'tok', player: { id: '1', username: 'jane' } });
  });

  it('sends the email along in the request body', async () => {
    let sentBody: unknown;
    mockFetch(async (_url, init) => {
      sentBody = JSON.parse((init as RequestInit).body as string);
      return new Response(JSON.stringify({ token: 'tok', player: { id: '1', username: 'jane' } }), { status: 201 });
    });
    await registerPlayer('jane', 'password1234', 'jane@example.com', 'http://example.test');
    expect(sentBody).toEqual({ username: 'jane', password: 'password1234', email: 'jane@example.com' });
  });

  it('throws a PlayerAuthError carrying the server message on a duplicate username', async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: 'username "jane" is already taken' }), { status: 409 }));
    await expect(
      registerPlayer('jane', 'password1234', 'jane@example.com', 'http://example.test')
    ).rejects.toMatchObject({
      message: 'username "jane" is already taken',
      status: 409,
    });
  });

  it('throws a PlayerAuthError when the body is malformed', async () => {
    mockFetch(async () => new Response(JSON.stringify({ nonsense: true }), { status: 201 }));
    await expect(
      registerPlayer('jane', 'password1234', 'jane@example.com', 'http://example.test')
    ).rejects.toThrow(PlayerAuthError);
  });

  it('wraps a network failure in a PlayerAuthError', async () => {
    mockFetch(async () => {
      throw new Error('network down');
    });
    await expect(
      registerPlayer('jane', 'password1234', 'jane@example.com', 'http://example.test')
    ).rejects.toThrow(PlayerAuthError);
  });
});

describe('loginPlayer', () => {
  it('returns the token and player on a valid response', async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ token: 'tok', player: { id: '1', username: 'jane' } }), { status: 200 })
    );
    const result = await loginPlayer('jane', 'password1234', 'http://example.test');
    expect(result).toEqual({ token: 'tok', player: { id: '1', username: 'jane' } });
  });

  it('throws a PlayerAuthError on invalid credentials', async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: 'invalid username or password' }), { status: 401 }));
    await expect(loginPlayer('jane', 'wrong', 'http://example.test')).rejects.toMatchObject({
      message: 'invalid username or password',
      status: 401,
    });
  });
});

describe('requestPasswordReset', () => {
  it('resolves on a 200 response, regardless of body shape', async () => {
    mockFetch(async () => new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    await expect(requestPasswordReset('jane', 'http://example.test')).resolves.toBeUndefined();
  });

  it('throws a PlayerAuthError on a non-2xx response', async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: 'too many reset requests, try again later' }), { status: 429 }));
    await expect(requestPasswordReset('jane', 'http://example.test')).rejects.toMatchObject({
      message: 'too many reset requests, try again later',
      status: 429,
    });
  });
});

describe('confirmPasswordReset', () => {
  it('resolves on a 200 response', async () => {
    mockFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(confirmPasswordReset('jane', '123456', 'newpassword1', 'http://example.test')).resolves.toBeUndefined();
  });

  it('throws a PlayerAuthError with the server message on an invalid code', async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: 'invalid or expired reset code' }), { status: 400 }));
    await expect(confirmPasswordReset('jane', '000000', 'newpassword1', 'http://example.test')).rejects.toMatchObject({
      message: 'invalid or expired reset code',
      status: 400,
    });
  });
});
