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
  listCategories,
  setCategoryImage,
  updateCategory,
  updateTile,
} from '../db';
import { handleError } from '../errors';
import { parseDocxTitles, parsePdfTitles, parseXlsxTitles } from '../import/parseTitles';
import {
  parseCreateCategoryBody,
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
    res.status(201).json(createCategory(input));
  } catch (err) {
    handleError(err, res);
  }
});

adminRouter.put('/categories/:id', (req, res) => {
  try {
    const input = parseUpdateCategoryBody(req.body);
    res.json(updateCategory(req.params.id, input));
  } catch (err) {
    handleError(err, res);
  }
});

adminRouter.delete('/categories/:id', (req, res) => {
  try {
    deleteCategory(req.params.id);
    res.status(204).end();
  } catch (err) {
    handleError(err, res);
  }
});

adminRouter.put('/categories/:categoryId/tiles/:index', (req, res) => {
  try {
    const index = parseTileIndex(req.params.index);
    const input = parseUpdateTileBody(req.body);
    res.json(updateTile(req.params.categoryId, index, input));
  } catch (err) {
    handleError(err, res);
  }
});

adminRouter.post('/categories/:categoryId/import', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'no file uploaded — expected a "file" field' });
    return;
  }
  const ext = path.extname(file.originalname).toLowerCase();

  try {
    let titles: string[];
    if (ext === '.docx') {
      titles = parseDocxTitles(file.buffer);
    } else if (ext === '.xlsx') {
      titles = await parseXlsxTitles(file.buffer);
    } else if (ext === '.pdf') {
      titles = await parsePdfTitles(file.buffer);
    } else {
      res.status(400).json({ error: `unsupported file type "${ext}" — expected .docx, .xlsx or .pdf` });
      return;
    }

    const result = importTitlesIntoCategory(req.params.categoryId, titles);
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
    res.json(setCategoryImage(req.params.id, null));
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
