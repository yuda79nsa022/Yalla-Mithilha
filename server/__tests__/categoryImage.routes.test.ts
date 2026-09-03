import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-image-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';

import fs from 'fs';
import request from 'supertest';
import { createApp } from '../src/app';
import { createCategory, getCategory, resetDbForTests, setCategoryStatus, UPLOADS_DIR } from '../src/db';
import { makeAdminAuthHeader } from './helpers/testAuth';

const app = createApp();
let auth: { Authorization: string };

// The smallest possible valid PNG (a 1x1 transparent pixel).
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

beforeEach(async () => {
  resetDbForTests();
  auth = await makeAdminAuthHeader();
  for (const f of fs.readdirSync(UPLOADS_DIR)) fs.unlinkSync(path.join(UPLOADS_DIR, f));
});

const sample = {
  id: 'test-cat',
  nameAr: 'فئة',
  nameEn: 'Test Category',
  tier: 'free' as const,
  level: 'family' as const,
  region: 'global' as const,
};

describe('POST /admin/categories/:id/image', () => {
  it('requires auth', async () => {
    createCategory(sample);
    const res = await request(app)
      .post(`/admin/categories/${sample.id}/image`)
      .attach('image', PNG_1X1, 'pic.png');
    expect(res.status).toBe(401);
  });

  it('stores the file and sets imageUrl on the category', async () => {
    createCategory(sample);
    const res = await request(app)
      .post(`/admin/categories/${sample.id}/image`)
      .set(auth)
      .attach('image', PNG_1X1, 'pic.png');

    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toMatch(/^\/uploads\/.+\.png$/);
    const savedPath = path.join(UPLOADS_DIR, path.basename(res.body.imageUrl));
    expect(fs.existsSync(savedPath)).toBe(true);
  });

  it('serves the uploaded image back over HTTP', async () => {
    createCategory(sample);
    const upload = await request(app)
      .post(`/admin/categories/${sample.id}/image`)
      .set(auth)
      .attach('image', PNG_1X1, 'pic.png');

    const res = await request(app).get(upload.body.imageUrl);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^image\/png/);
  });

  it('rejects a non-image file with 400', async () => {
    createCategory(sample);
    const res = await request(app)
      .post(`/admin/categories/${sample.id}/image`)
      .set(auth)
      .attach('image', Buffer.from('not an image'), 'file.txt');
    expect(res.status).toBe(400);
  });

  it('never lets a malicious filename escape the uploads directory', async () => {
    createCategory(sample);
    const res = await request(app)
      .post(`/admin/categories/${sample.id}/image`)
      .set(auth)
      .attach('image', PNG_1X1, '../../../etc/evil.png');

    expect(res.status).toBe(200);
    // The stored id is always a fresh UUID, never derived from the client's filename.
    expect(res.body.imageUrl).not.toContain('..');
    expect(res.body.imageUrl).not.toContain('evil');
  });

  it('404s for a category that does not exist', async () => {
    const res = await request(app)
      .post('/admin/categories/nope/image')
      .set(auth)
      .attach('image', PNG_1X1, 'pic.png');
    expect(res.status).toBe(404);
  });

  it('replaces an existing image and deletes the old file', async () => {
    createCategory(sample);
    const first = await request(app)
      .post(`/admin/categories/${sample.id}/image`)
      .set(auth)
      .attach('image', PNG_1X1, 'pic.png');
    const firstPath = path.join(UPLOADS_DIR, path.basename(first.body.imageUrl));
    expect(fs.existsSync(firstPath)).toBe(true);

    const second = await request(app)
      .post(`/admin/categories/${sample.id}/image`)
      .set(auth)
      .attach('image', PNG_1X1, 'pic2.png');

    expect(second.body.imageUrl).not.toBe(first.body.imageUrl);
    expect(fs.existsSync(firstPath)).toBe(false);
  });
});

describe('DELETE /admin/categories/:id/image', () => {
  it('clears imageUrl and removes the file', async () => {
    createCategory(sample);
    const upload = await request(app)
      .post(`/admin/categories/${sample.id}/image`)
      .set(auth)
      .attach('image', PNG_1X1, 'pic.png');
    const savedPath = path.join(UPLOADS_DIR, path.basename(upload.body.imageUrl));

    const res = await request(app).delete(`/admin/categories/${sample.id}/image`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toBeNull();
    expect(fs.existsSync(savedPath)).toBe(false);
    expect(getCategory(sample.id)!.imageUrl).toBeNull();
  });

  it('is a no-op, not an error, when there is no image to delete', async () => {
    createCategory(sample);
    const res = await request(app).delete(`/admin/categories/${sample.id}/image`).set(auth);
    expect(res.status).toBe(200);
  });
});

describe('GET /catalogue with images', () => {
  it('includes an absolute imageUrl for a category that has one, once complete', async () => {
    createCategory(sample);
    for (let i = 0; i < 6; i++) {
      await request(app)
        .put(`/admin/categories/${sample.id}/tiles/${i}`)
        .set(auth)
        .send({ promptAr: `س${i}`, promptEn: `q${i}`, answerAr: `ج${i}`, answerEn: `a${i}` });
    }
    await request(app)
      .post(`/admin/categories/${sample.id}/image`)
      .set(auth)
      .attach('image', PNG_1X1, 'pic.png');
    setCategoryStatus(sample.id, 'published');

    const res = await request(app).get('/catalogue');
    expect(res.body[0].imageUrl).toMatch(/^https?:\/\/.+\/uploads\/.+\.png$/);
  });
});
