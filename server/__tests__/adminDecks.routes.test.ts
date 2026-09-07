import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-admindecks-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { createApp } from '../src/app';
import { createDeck, getDeck, getGamePriceFils, resetDbForTests } from '../src/db';
import { makeAdminAuthHeader } from './helpers/testAuth';

const app = createApp();
let auth: { Authorization: string };

beforeEach(async () => {
  resetDbForTests();
  auth = await makeAdminAuthHeader();
});

const sample = { id: 'test-deck', nameAr: 'مجموعة', nameEn: 'Test Deck' };

function buildDocxFixture(titles: string[]): Buffer {
  const zip = new AdmZip();
  const rows = titles
    .map((t, i) => `<w:tr><w:tc><w:p><w:r><w:t>${i + 1}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc></w:tr>`)
    .join('');
  const xml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>${rows}</w:tbl></w:body></w:document>`;
  zip.addFile('word/document.xml', Buffer.from(xml, 'utf-8'));
  return zip.toBuffer();
}

async function buildManifestXlsx(rows: Array<[string, string]>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Titles');
  sheet.addRow(['Title', 'Image filename']); // header, always skipped
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function buildImagesZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const zip = new AdmZip();
  for (const f of files) zip.addFile(f.name, f.data);
  return zip.toBuffer();
}

const FAKE_IMAGE = Buffer.from('fake-image-bytes');

describe('deck CRUD', () => {
  it('requires auth', async () => {
    expect((await request(app).get('/admin/decks')).status).toBe(401);
    expect((await request(app).post('/admin/decks').send(sample)).status).toBe(401);
  });

  it('creates, lists, updates and deletes a deck', async () => {
    const created = await request(app).post('/admin/decks').set(auth).send(sample);
    expect(created.status).toBe(201);
    expect(created.body.titles).toEqual([]);

    const list = await request(app).get('/admin/decks').set(auth);
    expect(list.body).toHaveLength(1);

    const updated = await request(app).put(`/admin/decks/${sample.id}`).set(auth).send({ nameEn: 'Renamed' });
    expect(updated.body.nameEn).toBe('Renamed');

    const deleted = await request(app).delete(`/admin/decks/${sample.id}`).set(auth);
    expect(deleted.status).toBe(204);
    expect(getDeck(sample.id)).toBeNull();
  });

  it('rejects a duplicate id with 409', async () => {
    await request(app).post('/admin/decks').set(auth).send(sample);
    const res = await request(app).post('/admin/decks').set(auth).send(sample);
    expect(res.status).toBe(409);
  });

  it('defaults a new deck to Arabic when no language is given', async () => {
    const created = await request(app).post('/admin/decks').set(auth).send(sample);
    expect(created.body.language).toBe('ar');
  });

  it('creates an English-language deck when asked, and can move it back later', async () => {
    const created = await request(app).post('/admin/decks').set(auth).send({ ...sample, language: 'en' });
    expect(created.body.language).toBe('en');

    const updated = await request(app).put(`/admin/decks/${sample.id}`).set(auth).send({ language: 'ar' });
    expect(updated.body.language).toBe('ar');
  });

  it('rejects a language that is neither "ar" nor "en"', async () => {
    const res = await request(app).post('/admin/decks').set(auth).send({ ...sample, language: 'fr' });
    expect(res.status).toBe(400);
  });
});

describe('POST /admin/decks/:id/import', () => {
  it('adds titles parsed from a docx, skipping duplicates', async () => {
    createDeck(sample);
    const first = await request(app)
      .post(`/admin/decks/${sample.id}/import`)
      .set(auth)
      .attach('file', buildDocxFixture(['Title A', 'Title B']), 'list.docx');
    expect(first.status).toBe(200);
    expect(first.body.added).toBe(2);

    const second = await request(app)
      .post(`/admin/decks/${sample.id}/import`)
      .set(auth)
      .attach('file', buildDocxFixture(['Title B', 'Title C']), 'list.docx');
    expect(second.body.added).toBe(1);
    expect(second.body.skipped).toBe(1);
    expect(getDeck(sample.id)!.titles).toHaveLength(3);
  });

  it('rejects an unsupported file type', async () => {
    createDeck(sample);
    const res = await request(app)
      .post(`/admin/decks/${sample.id}/import`)
      .set(auth)
      .attach('file', Buffer.from('not a real file'), 'list.txt');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /admin/decks/:deckId/titles/:titleId', () => {
  it('removes one title', async () => {
    createDeck(sample);
    await request(app)
      .post(`/admin/decks/${sample.id}/import`)
      .set(auth)
      .attach('file', buildDocxFixture(['Title A']), 'list.docx');
    const titleId = getDeck(sample.id)!.titles[0].id;

    const res = await request(app).delete(`/admin/decks/${sample.id}/titles/${titleId}`).set(auth);
    expect(res.status).toBe(204);
    expect(getDeck(sample.id)!.titles).toHaveLength(0);
  });
});

describe('POST /admin/decks/:id/import-with-images', () => {
  it('pairs each title with its picture by filename', async () => {
    createDeck(sample);
    const manifest = await buildManifestXlsx([
      ['Title A', 'a.png'],
      ['Title B', 'b.jpg'],
    ]);
    const images = buildImagesZip([
      { name: 'a.png', data: FAKE_IMAGE },
      { name: 'b.jpg', data: FAKE_IMAGE },
    ]);

    const res = await request(app)
      .post(`/admin/decks/${sample.id}/import-with-images`)
      .set(auth)
      .attach('manifest', manifest, 'manifest.xlsx')
      .attach('images', images, 'images.zip');

    expect(res.status).toBe(200);
    expect(res.body.added).toBe(2);
    expect(res.body.imageIssues).toEqual([]);
    const titles = getDeck(sample.id)!.titles;
    expect(titles.find((t) => t.text === 'Title A')!.imagePath).toMatch(/^\/title-images\/.+\.png$/);
    expect(titles.find((t) => t.text === 'Title B')!.imagePath).toMatch(/^\/title-images\/.+\.jpg$/);
  });

  it('still adds a title whose image filename is missing from the zip, reported in imageIssues', async () => {
    createDeck(sample);
    const manifest = await buildManifestXlsx([['Title A', 'missing.png']]);
    const images = buildImagesZip([{ name: 'unrelated.png', data: FAKE_IMAGE }]);

    const res = await request(app)
      .post(`/admin/decks/${sample.id}/import-with-images`)
      .set(auth)
      .attach('manifest', manifest, 'manifest.xlsx')
      .attach('images', images, 'images.zip');

    expect(res.status).toBe(200);
    expect(res.body.added).toBe(1);
    expect(res.body.imageIssues).toHaveLength(1);
    expect(getDeck(sample.id)!.titles[0]).toMatchObject({ text: 'Title A', imagePath: null });
  });

  it('rejects an unsupported image type, still adding the title without a picture', async () => {
    createDeck(sample);
    const manifest = await buildManifestXlsx([['Title A', 'a.gif']]);
    const images = buildImagesZip([{ name: 'a.gif', data: FAKE_IMAGE }]);

    const res = await request(app)
      .post(`/admin/decks/${sample.id}/import-with-images`)
      .set(auth)
      .attach('manifest', manifest, 'manifest.xlsx')
      .attach('images', images, 'images.zip');

    expect(res.status).toBe(200);
    expect(res.body.imageIssues[0]).toMatch(/unsupported image type/);
    expect(getDeck(sample.id)!.titles[0].imagePath).toBeNull();
  });

  it('requires both a manifest and an images zip', async () => {
    createDeck(sample);
    const manifest = await buildManifestXlsx([['Title A', 'a.png']]);
    const res = await request(app)
      .post(`/admin/decks/${sample.id}/import-with-images`)
      .set(auth)
      .attach('manifest', manifest, 'manifest.xlsx');
    expect(res.status).toBe(400);
  });
});

describe('PUT /admin/decks/:deckId/titles/:titleId', () => {
  async function seedOneTitleWithImage() {
    createDeck(sample);
    const manifest = await buildManifestXlsx([['Title A', 'a.png']]);
    const images = buildImagesZip([{ name: 'a.png', data: FAKE_IMAGE }]);
    await request(app)
      .post(`/admin/decks/${sample.id}/import-with-images`)
      .set(auth)
      .attach('manifest', manifest, 'manifest.xlsx')
      .attach('images', images, 'images.zip');
    return getDeck(sample.id)!.titles[0];
  }

  it('renames a title without touching its image', async () => {
    const title = await seedOneTitleWithImage();
    const res = await request(app)
      .put(`/admin/decks/${sample.id}/titles/${title.id}`)
      .set(auth)
      .field('text', 'Renamed');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ text: 'Renamed', imagePath: title.imagePath });
  });

  it('replaces the picture without touching the text', async () => {
    const title = await seedOneTitleWithImage();
    const res = await request(app)
      .put(`/admin/decks/${sample.id}/titles/${title.id}`)
      .set(auth)
      .attach('image', FAKE_IMAGE, 'new.png');
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Title A');
    expect(res.body.imagePath).not.toBe(title.imagePath);
    expect(res.body.imagePath).toMatch(/\.png$/);
  });

  it('removes the picture when removeImage is sent', async () => {
    const title = await seedOneTitleWithImage();
    const res = await request(app)
      .put(`/admin/decks/${sample.id}/titles/${title.id}`)
      .set(auth)
      .field('removeImage', 'true');
    expect(res.status).toBe(200);
    expect(res.body.imagePath).toBeNull();
  });

  it('returns 404 for an unknown title', async () => {
    createDeck(sample);
    const res = await request(app).put(`/admin/decks/${sample.id}/titles/nope`).set(auth).field('text', 'x');
    expect(res.status).toBe(404);
  });
});

describe('game price setting', () => {
  it('requires auth', async () => {
    expect((await request(app).get('/admin/settings/game-price')).status).toBe(401);
  });

  it('reads and updates the price', async () => {
    const initial = await request(app).get('/admin/settings/game-price').set(auth);
    expect(initial.body.fils).toBe(getGamePriceFils());

    const updated = await request(app).put('/admin/settings/game-price').set(auth).send({ fils: 1500 });
    expect(updated.status).toBe(200);
    expect(updated.body.fils).toBe(1500);
    expect(getGamePriceFils()).toBe(1500);
  });

  it('rejects a non-positive or absurdly large price', async () => {
    expect((await request(app).put('/admin/settings/game-price').set(auth).send({ fils: 0 })).status).toBe(400);
    expect((await request(app).put('/admin/settings/game-price').set(auth).send({ fils: -5 })).status).toBe(400);
    expect((await request(app).put('/admin/settings/game-price').set(auth).send({ fils: 999_999 })).status).toBe(400);
  });
});
