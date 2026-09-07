import { startGameSession } from '../src/services/walletApi';

function mockFetch(impl: typeof fetch) {
  (global as unknown as { fetch: typeof fetch }).fetch = impl;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('startGameSession', () => {
  it('sends the current app language alongside the session id', async () => {
    let sentBody: unknown;
    mockFetch(async (_url, init) => {
      sentBody = JSON.parse((init as RequestInit).body as string);
      return new Response(JSON.stringify({ session: { titles: [] }, balance: 0 }), { status: 201 });
    });

    await startGameSession('tok', 'sess-1', 'en');

    expect(sentBody).toEqual({ sessionId: 'sess-1', lang: 'en' });
  });
});
