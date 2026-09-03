import crypto from 'crypto';
import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
  UPLOADS_DIR,
  createCategory,
  deleteCategory,
  getCategory,
  importTitlesIntoCategory,
  listAuditLog,
  listCategories,
  previewImportForCategory,
  recordAudit,
  setCategoryImage,
  setCategoryStatus,
  updateCategory,
  updateTile,
} from '../db';
import { handleError } from '../errors';
import { parseDocxTitles, parsePdfTitles, parseXlsxTitles } from '../import/parseTitles';
import {
  parseCreateCategoryBody,
  parseImportCommitBody,
  parseSetCategoryStatusBody,
  parseTileIndex,
  parseUpdateCategoryBody,
  parseUpdateTileBody,
} from '../validate';

export const adminRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — a title list, not a media library
});

const IMAGE_EXT_BY_MIMETYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB — a category thumbnail, not a media library
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype in IMAGE_EXT_BY_MIMETYPE);
  },
});

adminRouter.get('/categories', (_req, res) => {
  res.json(listCategories());
});

/** Read-only by design — never exposed for edit or delete from the admin UI. */
adminRouter.get('/audit-log', (_req, res) => {
  res.json(listAuditLog());
});

adminRouter.get('/categories/:id', (req, res) => {
  const category = getCategory(req.params.id);
  if (!category) {
    res.status(404).json({ error: `category "${req.params.id}" not found` });
    return;
  }
  res.json(category);
});

adminRouter.post('/categories', (req, res) => {
  try {
    const input = parseCreateCategoryBody(req.body);
    const created = createCategory(input);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'category.create',
      target: created.id,
      after: created,
    });
    res.status(201).json(created);
  } catch (err) {
    handleError(err, res);
  }
});

adminRouter.put('/categories/:id', (req, res) => {
  try {
    const before = getCategory(req.params.id);
    const input = parseUpdateCategoryBody(req.body);
    const updated = updateCategory(req.params.id, input);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'category.update',
      target: req.params.id,
      before,
      after: updated,
    });
    res.json(updated);
  } catch (err) {
    handleError(err, res);
  }
});

adminRouter.delete('/categories/:id', (req, res) => {
  try {
    const before = getCategory(req.params.id);
    deleteCategory(req.params.id);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'category.delete',
      target: req.params.id,
      before,
    });
    res.status(204).end();
  } catch (err) {
    handleError(err, res);
  }
});

adminRouter.put('/categories/:categoryId/tiles/:index', (req, res) => {
  try {
    const index = parseTileIndex(req.params.index);
    const before = getCategory(req.params.categoryId)?.tiles.find((t) => t.index === index);
    const input = parseUpdateTileBody(req.body);
    const updated = updateTile(req.params.categoryId, index, input);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'tile.update',
      target: `${req.params.categoryId}#${index}`,
      before,
      after: updated,
    });
    res.json(updated);
  } catch (err) {
    handleError(err, res);
  }
});

adminRouter.put('/categories/:id/status', (req, res) => {
  try {
    const before = getCategory(req.params.id);
    const { status } = parseSetCategoryStatusBody(req.body);
    const updated = setCategoryStatus(req.params.id, status);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: `category.status.${status}`,
      target: req.params.id,
      before: before ? { status: before.status } : undefined,
      after: { status },
    });
    res.json(updated);
  } catch (err) {
    handleError(err, res);
  }
});

async function parseTitlesFromUpload(file: Express.Multer.File): Promise<string[]> {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.docx') return parseDocxTitles(file.buffer);
  if (ext === '.xlsx') return parseXlsxTitles(file.buffer);
  if (ext === '.pdf') return parsePdfTitles(file.buffer);
  throw new UnsupportedFileTypeError(`unsupported file type "${ext}" — expected .docx, .xlsx or .pdf`);
}

class UnsupportedFileTypeError extends Error {}

/**
 * Step 1 of upload → preview → confirm → commit: parses the file and
 * returns what *would* be filled and any likely duplicates, without writing
 * anything. The client re-submits the same title list to `/import/commit`
 * once an admin has actually looked at it — nothing here is trusted to
 * still be true by the time that happens (another admin could fill a slot
 * in between), so commit recomputes empty slots itself rather than trusting
 * this preview's tileId assignments.
 */
adminRouter.post('/categories/:categoryId/import/preview', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'no file uploaded — expected a "file" field' });
    return;
  }
  try {
    const titles = await parseTitlesFromUpload(file);
    const { proposed, skipped } = previewImportForCategory(req.params.categoryId, titles);
    res.json({ titlesFound: titles.length, proposed, skipped });
  } catch (err) {
    if (err instanceof UnsupportedFileTypeError) {
      res.status(400).json({ error: err.message });
      return;
    }
    handleError(err, res);
  }
});

/** Step 2: actually writes the titles an admin reviewed and confirmed. Never runs on its own — only ever reachable after a preview. */
adminRouter.post('/categories/:categoryId/import/commit', (req, res) => {
  try {
    const { titles } = parseImportCommitBody(req.body);
    const result = importTitlesIntoCategory(req.params.categoryId, titles);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'category.import',
      target: req.params.categoryId,
      after: { titlesFound: titles.length, ...result },
    });
    res.json({ ...result, titlesFound: titles.length, category: getCategory(req.params.categoryId) });
  } catch (err) {
    handleError(err, res);
  }
});

adminRouter.post('/categories/:id/image', uploadImage.single('image'), (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'no image uploaded, or it was not a jpeg/png/webp/gif' });
    return;
  }

  try {
    const category = getCategory(req.params.id);
    if (!category) {
      res.status(404).json({ error: `category "${req.params.id}" not found` });
      return;
    }

    const ext = IMAGE_EXT_BY_MIMETYPE[file.mimetype];
    // Never trust the client's filename — it becomes part of a filesystem path.
    const filename = `${crypto.randomUUID()}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), file.buffer);

    const previous = category.imageUrl;
    const updated = setCategoryImage(req.params.id, `/uploads/${filename}`);
    if (previous) deleteUploadedFile(previous);

    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'category.image.upload',
      target: req.params.id,
      before: { imageUrl: previous },
      after: { imageUrl: updated.imageUrl },
    });
    res.json(updated);
  } catch (err) {
    handleError(err, res);
  }
});

adminRouter.delete('/categories/:id/image', (req, res) => {
  try {
    const category = getCategory(req.params.id);
    if (!category) {
      res.status(404).json({ error: `category "${req.params.id}" not found` });
      return;
    }
    if (category.imageUrl) deleteUploadedFile(category.imageUrl);
    const updated = setCategoryImage(req.params.id, null);
    recordAudit({
      actorId: req.admin!.sub,
      actorUsername: req.admin!.username,
      action: 'category.image.remove',
      target: req.params.id,
      before: { imageUrl: category.imageUrl },
    });
    res.json(updated);
  } catch (err) {
    handleError(err, res);
  }
});

/** `imageUrl` is the relative /uploads path stored in the DB. Best-effort — a missing file is not an error. */
function deleteUploadedFile(imageUrl: string): void {
  const filename = path.basename(imageUrl);
  try {
    fs.unlinkSync(path.join(UPLOADS_DIR, filename));
  } catch {
    // already gone — fine
  }
}
