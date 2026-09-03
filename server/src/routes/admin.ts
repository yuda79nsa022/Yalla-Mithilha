import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
  CategoryNotFoundError,
  DuplicateCategoryError,
  InvalidTileIndexError,
  createCategory,
  deleteCategory,
  getCategory,
  importTitlesIntoCategory,
  listCategories,
  updateCategory,
  updateTile,
} from '../db';
import { parseDocxTitles, parsePdfTitles, parseXlsxTitles } from '../import/parseTitles';
import {
  ValidationError,
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

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof DuplicateCategoryError) {
    res.status(409).json({ error: err.message });
  } else if (err instanceof CategoryNotFoundError || err instanceof InvalidTileIndexError) {
    res.status(404).json({ error: err.message });
  } else {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
}
