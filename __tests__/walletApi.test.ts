import { createRevealToken, getHomeContent, startGameSession } from '../src/services/walletApi';

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

describe('createRevealToken', () => {
  it('sends the session id, title, category and image to the server', async () => {
    let sentBody: unknown;
    mockFetch(async (_url, init) => {
      sentBody = JSON.parse((init as RequestInit).body as string);
      return new Response(JSON.stringify({ id: 'rt-1' }), { status: 201 });
    });

    const result = await createRevealToken('tok', 'sess-1', 'Spartacus', 'أفلام', 'Movies', 'https://x.example/a.png');

    expect(sentBody).toEqual({
      sessionId: 'sess-1',
      title: 'Spartacus',
      categoryAr: 'أفلام',
      categoryEn: 'Movies',
      imageUrl: 'https://x.example/a.png',
    });
    expect(result).toEqual({ id: 'rt-1' });
  });

  it('omits imageUrl entirely when the title has no picture', async () => {
    let sentBody: unknown;
    mockFetch(async (_url, init) => {
      sentBody = JSON.parse((init as RequestInit).body as string);
      return new Response(JSON.stringify({ id: 'rt-2' }), { status: 201 });
    });

    await createRevealToken('tok', 'sess-1', 'Spartacus', 'أفلام', 'Movies');

    expect(sentBody).toEqual({ sessionId: 'sess-1', title: 'Spartacus', categoryAr: 'أفلام', categoryEn: 'Movies' });
  });
});

describe('getHomeContent', () => {
  it('fetches and returns the home screen copy', async () => {
    const content = { taglineAr: 'أ', taglineEn: 'A', writeupAr: 'ب', writeupEn: 'B' };
    mockFetch(async () => new Response(JSON.stringify(content), { status: 200 }));

    await expect(getHomeContent()).resolves.toEqual(content);
  });
});
