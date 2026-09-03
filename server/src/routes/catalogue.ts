import { Router } from 'express';
import { listCompleteCategories } from '../db';
import type { PublicCategoryDeck } from '../types';

export const catalogueRouter = Router();

// Public read-only data, fetched by the app running as a web page on a
// different origin. Deliberately not applied to /admin — those routes stay
// same-origin-only, on top of requiring the bearer token.
catalogueRouter.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

/**
 * Public, unauthenticated — this is what the app fetches. Only categories
 * where every tile has real content are ever returned; a half-finished
 * import can sit in the admin UI indefinitely without risk of reaching a
 * real game.
 */
catalogueRouter.get('/', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  const decks: PublicCategoryDeck[] = listCompleteCategories().map((c) => ({
    id: c.id,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    tier: c.tier,
    level: c.level,
    region: c.region,
    ...(c.imageUrl ? { imageUrl: `${origin}${c.imageUrl}` } : {}),
    tiles: c.tiles.map((t) => ({
      id: t.id,
      index: t.index,
      points: t.points,
      mediaType: t.mediaType,
      promptAr: t.promptAr,
      promptEn: t.promptEn,
      ...(t.mediaUrl ? { mediaUrl: t.mediaUrl } : {}),
      ...(t.reorderItems ? { reorderItems: t.reorderItems } : {}),
      answerAr: t.answerAr,
      answerEn: t.answerEn,
    })),
  }));
  res.json(decks);
});
