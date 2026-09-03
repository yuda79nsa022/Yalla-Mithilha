import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-routes-${Date.now()}-${Math.random()}.sqlite`);
process.env.ADMIN_TOKEN = 'test-token';

import request from 'supertest';
import { createApp } from '../src/app';
import { resetDbForTests } from '../src/db';

const app = createApp();
const auth = { Authorization: 'Bearer test-token' };

beforeEach(() => resetDbForTests());

const sample = {
  id: 'test-cat',
  nameAr: 'فئة',
  nameEn: 'Test Category',
  tier: 'free',
  level: 'family',
  region: 'global',
};

describe('auth', () => {
  it('rejects requests with no token', async () => {
    const res = await request(app).get('/admin/categories');
    expect(res.status).toBe(401);
  });

  it('rejects requests with the wrong token', async () => {
    const res = await request(app)
      .get('/admin/categories')
      .set('Authorization', 'Bearer wrong');
    expect(res.status).toBe(401);
  });

  it('accepts the correct token', async () => {
    const res = await request(app).get('/admin/categories').set(auth);
    expect(res.status).toBe(200);
  });
});

describe('category CRUD', () => {
  it('creates, reads, updates and deletes a category', async () => {
    const create = await request(app).post('/admin/categories').set(auth).send(sample);
    expect(create.status).toBe(201);
    expect(create.body.tiles).toHaveLength(6);

    const get = await request(app).get(`/admin/categories/${sample.id}`).set(auth);
    expect(get.status).toBe(200);
    expect(get.body.nameEn).toBe('Test Category');

    const update = await request(app)
      .put(`/admin/categories/${sample.id}`)
      .set(auth)
      .send({ nameEn: 'Renamed' });
    expect(update.status).toBe(200);
    expect(update.body.nameEn).toBe('Renamed');

    const del = await request(app).delete(`/admin/categories/${sample.id}`).set(auth);
    expect(del.status).toBe(204);

    const getAfter = await request(app).get(`/admin/categories/${sample.id}`).set(auth);
    expect(getAfter.status).toBe(404);
  });

  it('rejects a duplicate category id with 409', async () => {
    await request(app).post('/admin/categories').set(auth).send(sample);
    const dup = await request(app).post('/admin/categories').set(auth).send(sample);
    expect(dup.status).toBe(409);
  });

  it('rejects an invalid category id with 400', async () => {
    const res = await request(app)
      .post('/admin/categories')
      .set(auth)
      .send({ ...sample, id: 'Not Valid!' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid enum value with 400', async () => {
    const res = await request(app)
      .post('/admin/categories')
      .set(auth)
      .send({ ...sample, tier: 'gold' });
    expect(res.status).toBe(400);
  });
});

describe('tile updates', () => {
  it('updates a tile by index', async () => {
    await request(app).post('/admin/categories').set(auth).send(sample);
    const res = await request(app)
      .put(`/admin/categories/${sample.id}/tiles/2`)
      .set(auth)
      .send({ promptAr: 'س', promptEn: 'q', answerAr: 'ج', answerEn: 'a' });
    expect(res.status).toBe(200);
    expect(res.body.needsContent).toBe(false);
    expect(res.body.points).toBe(300);
  });

  it('rejects an out-of-range index with 400', async () => {
    await request(app).post('/admin/categories').set(auth).send(sample);
    const res = await request(app).put(`/admin/categories/${sample.id}/tiles/9`).set(auth).send({});
    expect(res.status).toBe(400);
  });

  it('404s for a tile in a category that does not exist', async () => {
    const res = await request(app).put('/admin/categories/nope/tiles/0').set(auth).send({});
    expect(res.status).toBe(404);
  });
});
