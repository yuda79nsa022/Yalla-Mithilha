import { getHomeContent, startGameSession } from '../src/services/walletApi';

function mockFetch(impl: typeof fetch) {
  (global as unknown as { fetch: typeof fetch }).fetch = impl;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('startGameSession', () => {
  it('sends the chosen deck ids alongside the session id', async () => {
    let sentBody: unknown;
    mockFetch(async (_url, init) => {
      sentBody = JSON.parse((init as RequestInit).body as string);
      return new Response(JSON.stringify({ session: { titles: [] }, balance: 0 }), { status: 201 });
    });

    await startGameSession('tok', 'sess-1', ['us-movies']);

    expect(sentBody).toEqual({ sessionId: 'sess-1', deckIds: ['us-movies'] });
  });

  it('also sends multiple chosen deck ids as-is', async () => {
    let sentBody: unknown;
    mockFetch(async (_url, init) => {
      sentBody = JSON.parse((init as RequestInit).body as string);
      return new Response(JSON.stringify({ session: { titles: [] }, balance: 0 }), { status: 201 });
    });

    await startGameSession('tok', 'sess-1', ['kuwaiti-plays', 'us-movies']);

    expect(sentBody).toEqual({ sessionId: 'sess-1', deckIds: ['kuwaiti-plays', 'us-movies'] });
  });
});

describe('getHomeContent', () => {
  it('fetches and returns the home screen copy', async () => {
    const content = { taglineAr: 'أ', taglineEn: 'A', writeupAr: 'ب', writeupEn: 'B' };
    mockFetch(async () => new Response(JSON.stringify(content), { status: 200 }));

    await expect(getHomeContent()).resolves.toEqual(content);
  });
});
