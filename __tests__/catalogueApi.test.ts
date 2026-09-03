import { CatalogueFetchError, fetchBoardCatalogue } from '../src/services/catalogueApi';
import type { CategoryDeck } from '../src/engine/board/types';

const validDeck: CategoryDeck = {
  id: 'sample',
  nameAr: 'sample',
  nameEn: 'sample',
  tier: 'free',
  level: 'family',
  region: 'global',
  tiles: Array.from({ length: 6 }, (_, i) => ({
    id: `sample-${i + 1}`,
    index: i,
    points: (i + 1) * 100,
    mediaType: 'text' as const,
    promptAr: 'س',
    promptEn: 'q',
    answerAr: 'ج',
    answerEn: 'a',
  })),
};

function mockFetch(impl: typeof fetch) {
  (global as unknown as { fetch: typeof fetch }).fetch = impl;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('fetchBoardCatalogue', () => {
  it('returns the decks on a valid response', async () => {
    mockFetch(async () => new Response(JSON.stringify([validDeck]), { status: 200 }));
    const decks = await fetchBoardCatalogue('http://example.test');
    expect(decks).toEqual([validDeck]);
  });

  it('throws on a non-OK status', async () => {
    mockFetch(async () => new Response('nope', { status: 500 }));
    await expect(fetchBoardCatalogue('http://example.test')).rejects.toThrow(CatalogueFetchError);
  });

  it('throws when the body is not an array', async () => {
    mockFetch(async () => new Response(JSON.stringify({ not: 'an array' }), { status: 200 }));
    await expect(fetchBoardCatalogue('http://example.test')).rejects.toThrow(CatalogueFetchError);
  });

  it('throws when an item is missing required fields or has the wrong tile count', async () => {
    mockFetch(async () => new Response(JSON.stringify([{ id: 'x' }]), { status: 200 }));
    await expect(fetchBoardCatalogue('http://example.test')).rejects.toThrow(CatalogueFetchError);
  });

  it('propagates a network failure', async () => {
    mockFetch(async () => {
      throw new Error('network down');
    });
    await expect(fetchBoardCatalogue('http://example.test')).rejects.toThrow('network down');
  });
});
