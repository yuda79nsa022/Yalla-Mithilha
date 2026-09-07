import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { Router } from 'express';
import multer from 'multer';
import {
  TITLE_IMAGES_DIR,
  addTitlesToDeck,
  addTitlesToDeckWithImages,
  createDeck,
  deleteDeck,
  deleteTitle,
  getDeck,
  getGamePriceFils,
  getTitle,
  listDecks,
  recordAudit,
  setGamePriceFils,
  updateDeck,
  updateTitle,
} from '../db';
import { handleError } from '../errors';
import {
  parseDocxTitles,
  parsePdfTitles,
  parseTitleImageManifestXlsx,
  parseXlsxTitles,
} from '../import/parseTitles';
import { parseCreateDeckBody, parseImportTitlesBody, parseSetGamePriceBody, parseUpdateDeckBody } from '../validate';

export const adminDecksRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — a title list, not a media library
});

// A bundle of poster images is legitimately much bigger than a plain title
// list — a separate limit rather than raising the one above for everything.
const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

class UnsupportedFileTypeError extends Error {}

async function parseTitlesFromUpload(file: Express.Multer.File): Promise<string[]> {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.docx') return parseDocxTitles(file.buffer);
  if (ext === '.xlsx') return parseXlsxTitles(file.buffer);
  if (ext === '.pdf') return parsePdfTitles(file.buffer);
  throw new UnsupportedFileTypeError(`unsupported file type "${ext}" — expected .docx, .xlsx or .pdf`);
}

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // one poster, not a media library

/**
 * Validates and writes one image to disk, returning the servable path
 * (`/title-images/<uuid><ext>`) — or an issue string instead, for the
 * caller to report back rather than throw and abort the whole import.
 */
function saveTitleImage(buffer: Buffer, originalName: string): { path: string } | { issue: string } {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return { issue: `${originalName}: unsupported image type "${ext || '(none)'}" — expected .png, .jpg or .webp` };
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    return { issue: `${originalName}: image is larger than ${MAX_IMAGE_BYTES / (1024 * 1024)} MB` };
  }
  const filename = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(TITLE_IMAGES_DIR, filename), buffer);
  return { path: `/title-images/${filename}` };
}

/** Best-effort — a title's image file may already be gone, or may never have existed; either way the DB record is what matters. */
function deleteTitleImageFile(imagePath: string | null): void {
  if (!imagePath) return;
  const filename = path.basename(imagePath);
  try {
    fs.unlinkSync(path.join(TITLE_IMAGES_DIR, filename));
  } catch {
    // already gone — nothing to clean up
  }
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
      after: { nameAr: deck.nameAr, nameEn: deck.nameEn, language: deck.language },
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
      before: before ? { nameAr: before.nameAr, nameEn: before.nameEn, language: before.language } : undefined,
      after: { nameAr: deck.nameAr, nameEn: deck.nameEn, language: deck.language },
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
      before: before
        ? { nameAr: before.nameAr, nameEn: before.nameEn, language: before.language, titleCount: before.titles.length }
        : undefined,
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

/**
 * Bulk-imports titles paired with pictures: a two-column .xlsx manifest
 * (title, image filename) plus a .zip of the images themselves, matched by
 * filename. A row whose filename isn't found in the zip, or whose image is
 * an unsupported type or too large, still adds its title text — it just
 * has no picture, reported back in `imageIssues` rather than dropping the
 * row or failing the whole import.
 */
adminDecksRouter.post(
  '/decks/:id/import-with-images',
  uploadImages.fields([
    { name: 'manifest', maxCount: 1 },
    { name: 'images', maxCount: 1 },
  ]),
  async (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const manifestFile = files?.manifest?.[0];
    const imagesFile = files?.images?.[0];
    if (!manifestFile) {
      res.status(400).json({ error: 'no manifest uploaded — expected a "manifest" field (.xlsx)' });
      return;
    }
    if (!imagesFile) {
      res.status(400).json({ error: 'no images uploaded — expected an "images" field (.zip)' });
      return;
    }
    if (path.extname(manifestFile.originalname).toLowerCase() !== '.xlsx') {
      res.status(400).json({ error: 'the manifest must be a .xlsx file with two columns: title, image filename' });
      return;
    }
    if (path.extname(imagesFile.originalname).toLowerCase() !== '.zip') {
      res.status(400).json({ error: 'the images file must be a .zip archive' });
      return;
    }
    try {
      const manifestRows = await parseTitleImageManifestXlsx(manifestFile.buffer);
      const zip = new AdmZip(imagesFile.buffer);
      const entries = new Map(zip.getEntries().map((e) => [path.basename(e.entryName).toLowerCase(), e]));

      const imageIssues: string[] = [];
      const rows = manifestRows.map(({ text, imageFilename }) => {
        const entry = entries.get(imageFilename.toLowerCase());
        if (!entry) {
          imageIssues.push(`${imageFilename}: referenced for "${text}" but not found in the zip`);
          return { text, imagePath: null };
        }
        const saved = saveTitleImage(entry.getData(), imageFilename);
        if ('issue' in saved) {
          imageIssues.push(saved.issue);
          return { text, imagePath: null };
        }
        return { text, imagePath: saved.path };
      });

      const result = addTitlesToDeckWithImages(req.params.id, rows);
      recordAudit({
        actorId: req.admin!.sub,
        actorUsername: req.admin!.username,
        action: 'deck.import-with-images',
        target: req.params.id,
        after: { titlesFound: rows.length, ...result, imageIssueCount: imageIssues.length },
      });
      res.json({ titlesFound: rows.length, ...result, imageIssues, deck: getDeck(req.params.id) });
    } catch (err) {
      handleError(err, res);
    }
  }
);

adminDecksRouter.put('/decks/:deckId/titles/:titleId', uploadImages.single('image'), (req, res) => {
  try {
    const existing = getTitle(req.params.deckId, req.params.titleId);
    if (!existing) {
      res.status(404).json({ error: `title "${req.params.titleId}" not found in deck "${req.params.deckId}"` });
      return;
    }

    const input: { text?: string; imagePath?: string | null } = {};
    if (typeof req.body?.text === 'string' && req.body.text.trim()) {
      input.text = req.body.text;
    }

    let newImageIssue: string | null = null;
    if (req.file) {
      const saved = saveTitleImage(req.file.buffer, req.file.originalname);
      if ('issue' in saved) {
        newImageIssue = saved.issue;
      } else {
        input.imagePath = saved.path;
      }
    } else if (req.body?.removeImage === 'true') {
      input.imagePath = null;
    }

    if (newImageIssue) {
      res.status(400).json({ error: newImageIssue });
      return;
    }

    const replacingOrRemovingImage = input.imagePath !== undefined;
    const title = updateTitle(req.params.deckId, req.params.titleId, input);
    if (replacingOrRemovingImage) deleteTitleImageFile(existing.imagePath);

    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'deck.title.update',
      target: `${req.params.deckId}/${req.params.titleId}`,
      before: { text: existing.text, hadImage: Boolean(existing.imagePath) },
      after: { text: title.text, hasImage: Boolean(title.imagePath) },
    });
    res.json(title);
  } catch (err) {
    handleError(err, res);
  }
});

adminDecksRouter.delete('/decks/:deckId/titles/:titleId', (req, res) => {
  try {
    const removed = deleteTitle(req.params.deckId, req.params.titleId);
    deleteTitleImageFile(removed.imagePath);
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
