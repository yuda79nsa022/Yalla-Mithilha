import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import {
  addTitlesToDeck,
  createDeck,
  deleteDeck,
  deleteTitle,
  getDeck,
  getGamePriceFils,
  listDecks,
  recordAudit,
  setGamePriceFils,
  updateDeck,
} from '../db';
import { handleError } from '../errors';
import { parseDocxTitles, parsePdfTitles, parseXlsxTitles } from '../import/parseTitles';
import { parseCreateDeckBody, parseImportTitlesBody, parseSetGamePriceBody, parseUpdateDeckBody } from '../validate';

export const adminDecksRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — a title list, not a media library
});

class UnsupportedFileTypeError extends Error {}

async function parseTitlesFromUpload(file: Express.Multer.File): Promise<string[]> {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.docx') return parseDocxTitles(file.buffer);
  if (ext === '.xlsx') return parseXlsxTitles(file.buffer);
  if (ext === '.pdf') return parsePdfTitles(file.buffer);
  throw new UnsupportedFileTypeError(`unsupported file type "${ext}" — expected .docx, .xlsx or .pdf`);
}

adminDecksRouter.get('/decks', (_req, res) => {
  res.json(listDecks());
});

adminDecksRouter.get('/decks/:id', (req, res) => {
  const deck = getDeck(req.params.id);
  if (!deck) {
    res.status(404).json({ error: `deck "${req.params.id}" not found` });
    return;
  }
  res.json(deck);
});

adminDecksRouter.post('/decks', (req, res) => {
  try {
    const input = parseCreateDeckBody(req.body);
    const deck = createDeck(input);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'deck.create',
      target: deck.id,
      after: { nameAr: deck.nameAr, nameEn: deck.nameEn },
    });
    res.status(201).json(deck);
  } catch (err) {
    handleError(err, res);
  }
});

adminDecksRouter.put('/decks/:id', (req, res) => {
  try {
    const input = parseUpdateDeckBody(req.body);
    const before = getDeck(req.params.id);
    const deck = updateDeck(req.params.id, input);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'deck.update',
      target: req.params.id,
      before: before ? { nameAr: before.nameAr, nameEn: before.nameEn } : undefined,
      after: { nameAr: deck.nameAr, nameEn: deck.nameEn },
    });
    res.json(deck);
  } catch (err) {
    handleError(err, res);
  }
});

adminDecksRouter.delete('/decks/:id', (req, res) => {
  try {
    const before = getDeck(req.params.id);
    deleteDeck(req.params.id);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'deck.delete',
      target: req.params.id,
      before: before ? { nameAr: before.nameAr, nameEn: before.nameEn, titleCount: before.titles.length } : undefined,
    });
    res.status(204).end();
  } catch (err) {
    handleError(err, res);
  }
});

/**
 * One step, unlike the old board-game category import: a deck has no fixed
 * slot count to stage a preview against, so every non-duplicate, non-empty
 * line the file parses to gets appended directly.
 */
adminDecksRouter.post('/decks/:id/import', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'no file uploaded — expected a "file" field' });
    return;
  }
  try {
    const titles = await parseTitlesFromUpload(file);
    const result = addTitlesToDeck(req.params.id, titles);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'deck.import',
      target: req.params.id,
      after: { titlesFound: titles.length, ...result },
    });
    res.json({ titlesFound: titles.length, ...result, deck: getDeck(req.params.id) });
  } catch (err) {
    if (err instanceof UnsupportedFileTypeError) {
      res.status(400).json({ error: err.message });
      return;
    }
    handleError(err, res);
  }
});

adminDecksRouter.delete('/decks/:deckId/titles/:titleId', (req, res) => {
  try {
    deleteTitle(req.params.deckId, req.params.titleId);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'deck.title.delete',
      target: `${req.params.deckId}/${req.params.titleId}`,
    });
    res.status(204).end();
  } catch (err) {
    handleError(err, res);
  }
});

adminDecksRouter.get('/settings/game-price', (_req, res) => {
  res.json({ fils: getGamePriceFils() });
});

adminDecksRouter.put('/settings/game-price', (req, res) => {
  try {
    const { fils } = parseSetGamePriceBody(req.body);
    const before = getGamePriceFils();
    const after = setGamePriceFils(fils);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'settings.game-price.update',
      target: 'game-price',
      before: { fils: before },
      after: { fils: after },
    });
    res.json({ fils: after });
  } catch (err) {
    handleError(err, res);
  }
});
