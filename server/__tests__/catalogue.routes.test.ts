import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-catalogue-${Date.now()}-${Math.random()}.sqlite`);

import request from 'supertest';
import { createApp } from '../src/app';
import { createCategory, resetDbForTests, setCategoryStatus, updateTile } from '../src/db';

const app = createApp();

beforeEach(() => resetDbForTests());

const sample = {
  id: 'test-cat',
  nameAr: 'فئة',
  nameEn: 'Test Category',
  tier: 'free' as const,
  level: 'family' as const,
  region: 'global' as const,
};

function completeAllTiles(categoryId: string) {
  for (let i = 0; i < 6; i++) {
    updateTile(categoryId, i, {
      promptAr: `س${i}`,
      promptEn: `q${i}`,
      answerAr: `ج${i}`,
      answerEn: `a${i}`,
    });
  }
}

describe('GET /catalogue', () => {
  it('requires no auth', async () => {
    const res = await request(app).get('/catalogue');
    expect(res.status).toBe(200);
  });

  it('allows cross-origin reads, since the app runs on a different origin', async () => {
    const res = await request(app).get('/catalogue');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('never includes a category with any empty tile', async () => {
    createCategory(sample);
    const res = await request(app).get('/catalogue');
    expect(res.body).toEqual([]);
  });

  it('excludes a category even if only one of its six tiles is incomplete', async () => {
    createCategory(sample);
    completeAllTiles(sample.id);
    updateTile(sample.id, 3, { promptAr: '' }); // blank one field back out
    const res = await request(app).get('/catalogue');
    expect(res.body).toEqual([]);
  });

  it('excludes a category that is complete but still draft — new content never publishes itself', async () => {
    createCategory(sample);
    completeAllTiles(sample.id);
    const res = await request(app).get('/catalogue');
    expect(res.body).toEqual([]);
  });

  it('includes a category once every tile is complete AND it has been published, in the CategoryDeck shape the app expects', async () => {
    createCategory(sample);
    completeAllTiles(sample.id);
    setCategoryStatus(sample.id, 'published');
    const res = await request(app).get('/catalogue');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const deck = res.body[0];
    expect(deck).toMatchObject({
      id: sample.id,
      nameAr: sample.nameAr,
      nameEn: sample.nameEn,
      tier: sample.tier,
      level: sample.level,
      region: sample.region,
    });
    expect(deck.tiles).toHaveLength(6);
    expect(deck.tiles.map((t: any) => t.points)).toEqual([100, 200, 300, 400, 500, 600]);
    // Admin-only fields must not leak to the public endpoint.
    expect(deck.tiles[0].needsContent).toBeUndefined();
    expect(deck.updatedAt).toBeUndefined();
    expect(deck.createdAt).toBeUndefined();
  });
});
