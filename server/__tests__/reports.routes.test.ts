import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-reportsroutes-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { resetDbForTests } from '../src/db';
import { makeAdminAuthHeader } from './helpers/testAuth';

const app = createApp();

beforeEach(() => resetDbForTests());

const sampleReport = { id: 'rep-1', promptId: 'act-42', reason: 'unclear', lang: 'en', createdAt: Date.now() };

describe('POST /reports', () => {
  it('requires no auth — reporting a card never needs an account', async () => {
    const res = await request(app).post('/reports').send({ reports: [sampleReport] });
    expect(res.status).toBe(201);
    expect(res.body.received).toBe(1);
  });

  it('allows cross-origin submission', async () => {
    const res = await request(app).post('/reports').send({ reports: [sampleReport] });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('answers a CORS preflight', async () => {
    const res = await request(app)
      .options('/reports')
      .set('Origin', 'http://example.test')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');
    expect(res.status).toBe(204);
  });

  it('accepts a batch and dedupes on retry', async () => {
    const batch = { reports: [sampleReport, { ...sampleReport, id: 'rep-2' }] };
    const first = await request(app).post('/reports').send(batch);
    expect(first.body.received).toBe(2);
    const retry = await request(app).post('/reports').send(batch);
    expect(retry.body.received).toBe(0);
  });

  it('rejects an unknown reason with 400', async () => {
    const res = await request(app)
      .post('/reports')
      .send({ reports: [{ ...sampleReport, reason: 'because' }] });
    expect(res.status).toBe(400);
  });

  it('rejects an empty batch with 400', async () => {
    const res = await request(app).post('/reports').send({ reports: [] });
    expect(res.status).toBe(400);
  });

  it('rejects a batch over the size cap with 400', async () => {
    const reports = Array.from({ length: 51 }, (_, i) => ({ ...sampleReport, id: `rep-${i}` }));
    const res = await request(app).post('/reports').send({ reports });
    expect(res.status).toBe(400);
  });
});

describe('admin reports', () => {
  it('GET /admin/reports requires auth', async () => {
    const res = await request(app).get('/admin/reports');
    expect(res.status).toBe(401);
  });

  it('lists synced reports for review', async () => {
    const auth = await makeAdminAuthHeader();
    await request(app).post('/reports').send({ reports: [sampleReport] });

    const res = await request(app).get('/admin/reports').set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ promptId: 'act-42', status: 'open' });
  });

  it('resolves every open report for a card in one call', async () => {
    const auth = await makeAdminAuthHeader();
    await request(app)
      .post('/reports')
      .send({ reports: [sampleReport, { ...sampleReport, id: 'rep-2', reason: 'duplicate' }] });

    const res = await request(app)
      .put('/admin/reports/by-prompt/act-42/status')
      .set(auth)
      .send({ status: 'resolved' });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);

    const list = await request(app).get('/admin/reports').set(auth);
    expect(list.body.every((r: any) => r.status === 'resolved')).toBe(true);
  });

  it('status update requires auth', async () => {
    const res = await request(app).put('/admin/reports/by-prompt/act-42/status').send({ status: 'resolved' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown status with 400', async () => {
    const auth = await makeAdminAuthHeader();
    const res = await request(app)
      .put('/admin/reports/by-prompt/act-42/status')
      .set(auth)
      .send({ status: 'ignored' });
    expect(res.status).toBe(400);
  });
});
