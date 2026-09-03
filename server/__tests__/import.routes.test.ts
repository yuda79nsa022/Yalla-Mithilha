import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-import-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';

import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { createApp } from '../src/app';
import { createCategory, getCategory, resetDbForTests } from '../src/db';
import { makeAdminAuthHeader } from './helpers/testAuth';

const app = createApp();
let auth: { Authorization: string };

beforeEach(async () => {
  resetDbForTests();
  auth = await makeAdminAuthHeader();
});

const sample = {
  id: 'test-cat',
  nameAr: 'فئة',
  nameEn: 'Test Category',
  tier: 'free' as const,
  level: 'family' as const,
  region: 'global' as const,
};

function buildDocxFixture(titles: string[]): Buffer {
  const zip = new AdmZip();
  const rows = titles
    .map((t, i) => `<w:tr><w:tc><w:p><w:r><w:t>${i + 1}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc></w:tr>`)
    .join('');
  const xml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>${rows}</w:tbl></w:body></w:document>`;
  zip.addFile('word/document.xml', Buffer.from(xml, 'utf-8'));
  return zip.toBuffer();
}

describe('POST /admin/categories/:id/import/preview', () => {
  it('requires auth', async () => {
    createCategory(sample);
    const res = await request(app)
      .post(`/admin/categories/${sample.id}/import/preview`)
      .attach('file', buildDocxFixture(['Title A']), 'list.docx');
    expect(res.status).toBe(401);
  });

  it('proposes fills from a docx without writing anything', async () => {
    createCategory(sample);
    const res = await request(app)
      .post(`/admin/categories/${sample.id}/import/preview`)
      .set(auth)
      .attach('file', buildDocxFixture(['Title A', 'Title B', 'Title C']), 'list.docx');

    expect(res.status).toBe(200);
    expect(res.body.titlesFound).toBe(3);
    expect(res.body.proposed.map((p: any) => p.title)).toEqual(['Title A', 'Title B', 'Title C']);
    expect(res.body.skipped).toBe(0);

    // Nothing was actually written — preview never commits.
    const category = getCategory(sample.id)!;
    expect(category.tiles.every((t) => t.needsContent)).toBe(true);
    expect(category.tiles.every((t) => !t.promptAr)).toBe(true);
  });

  it('reports titles that would not fit as skipped', async () => {
    createCategory(sample);
    const titles = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg'];
    const res = await request(app)
      .post(`/admin/categories/${sample.id}/import/preview`)
      .set(auth)
      .attach('file', buildDocxFixture(titles), 'list.docx');
    expect(res.body.proposed).toHaveLength(6);
    expect(res.body.skipped).toBe(1);
  });

  it('imports from an xlsx file', async () => {
    createCategory(sample);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.addRow(['رقم', 'اسم']);
    sheet.addRow([1, 'مسلسل واحد']);
    sheet.addRow([2, 'مسلسل اثنين']);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const res = await request(app)
      .post(`/admin/categories/${sample.id}/import/preview`)
      .set(auth)
      .attach('file', Buffer.from(buffer), 'list.xlsx');

    expect(res.status).toBe(200);
    // 3, not 2: the header row's own labels come through too (documented
    // artifact — harmless, an admin discards the stray row on sight).
    expect(res.body.proposed).toHaveLength(3);
    expect(res.body.proposed.map((p: any) => p.title)).toEqual(
      expect.arrayContaining(['مسلسل واحد', 'مسلسل اثنين'])
    );
  });

  it('flags a proposed title that already exists elsewhere as a duplicate, without excluding it', async () => {
    createCategory(sample);
    createCategory({ ...sample, id: 'other-cat' });
    await request(app)
      .put('/admin/categories/other-cat/tiles/0')
      .set(auth)
      .send({ promptAr: 'Title A', promptEn: 'q', answerAr: 'ج', answerEn: 'a' });

    const res = await request(app)
      .post(`/admin/categories/${sample.id}/import/preview`)
      .set(auth)
      .attach('file', buildDocxFixture(['Title A']), 'list.docx');

    const proposed = res.body.proposed.find((p: any) => p.title === 'Title A');
    expect(proposed.duplicates).toEqual([{ categoryId: 'other-cat', categoryNameEn: sample.nameEn, tileIndex: 0 }]);
  });

  it('rejects an unsupported file type with 400', async () => {
    createCategory(sample);
    const res = await request(app)
      .post(`/admin/categories/${sample.id}/import/preview`)
      .set(auth)
      .attach('file', Buffer.from('hello'), 'list.txt');
    expect(res.status).toBe(400);
  });

  it('404s for a category that does not exist', async () => {
    const res = await request(app)
      .post('/admin/categories/nope/import/preview')
      .set(auth)
      .attach('file', buildDocxFixture(['Title A']), 'list.docx');
    expect(res.status).toBe(404);
  });
});

describe('POST /admin/categories/:id/import/commit', () => {
  it('requires auth', async () => {
    createCategory(sample);
    const res = await request(app)
      .post(`/admin/categories/${sample.id}/import/commit`)
      .send({ titles: ['Title A'] });
    expect(res.status).toBe(401);
  });

  it('fills empty slots and leaves them needing content', async () => {
    createCategory(sample);
    const res = await request(app)
      .post(`/admin/categories/${sample.id}/import/commit`)
      .set(auth)
      .send({ titles: ['Title A', 'Title B', 'Title C'] });

    expect(res.status).toBe(200);
    expect(res.body.filled).toBe(3);
    const category = getCategory(sample.id)!;
    expect(category.tiles.filter((t) => t.promptAr).map((t) => t.promptAr).sort()).toEqual([
      'Title A',
      'Title B',
      'Title C',
    ]);
    expect(category.tiles.every((t) => t.needsContent)).toBe(true);
  });

  it('never overwrites tiles that already have content', async () => {
    createCategory(sample);
    await request(app)
      .put(`/admin/categories/${sample.id}/tiles/0`)
      .set(auth)
      .send({ promptAr: 'موجود', promptEn: 'existing', answerAr: 'ج', answerEn: 'a' });

    await request(app)
      .post(`/admin/categories/${sample.id}/import/commit`)
      .set(auth)
      .send({ titles: ['New Title'] });

    const category = getCategory(sample.id)!;
    expect(category.tiles[0].promptAr).toBe('موجود');
    expect(category.tiles[1].promptAr).toBe('New Title');
  });

  it('404s for a category that does not exist', async () => {
    const res = await request(app)
      .post('/admin/categories/nope/import/commit')
      .set(auth)
      .send({ titles: ['Title A'] });
    expect(res.status).toBe(404);
  });

  it('rejects a non-array titles field with 400', async () => {
    createCategory(sample);
    const res = await request(app)
      .post(`/admin/categories/${sample.id}/import/commit`)
      .set(auth)
      .send({ titles: 'not an array' });
    expect(res.status).toBe(400);
  });
});
