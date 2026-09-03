import { CATALOGUE_API_URL } from '../config';
import type { CategoryDeck } from '../engine/board/types';

export class CatalogueFetchError extends Error {}

function isCategoryDeck(value: unknown): value is CategoryDeck {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    typeof d.nameAr === 'string' &&
    typeof d.nameEn === 'string' &&
    Array.isArray(d.tiles) &&
    d.tiles.length === 6
  );
}

/**
 * Fetches the live catalogue from the admin backend. Throws on any failure
 * (network, bad status, malformed body) — the caller decides what to fall
 * back to; this function never returns anything it hasn't validated.
 */
export async function fetchBoardCatalogue(
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<CategoryDeck[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/catalogue`, { signal: controller.signal });
    if (!res.ok) throw new CatalogueFetchError(`catalogue fetch failed with status ${res.status}`);
    const body: unknown = await res.json();
    if (!Array.isArray(body) || !body.every(isCategoryDeck)) {
      throw new CatalogueFetchError('catalogue response was not a valid CategoryDeck[]');
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}
