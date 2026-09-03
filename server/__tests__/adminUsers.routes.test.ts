import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-adminusers-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { resetDbForTests } from '../src/db';
import { makeAdminAuthHeader } from './helpers/testAuth';

const app = createApp();
let auth: { Authorization: string };

beforeEach(async () => {
  resetDbForTests();
  auth = await makeAdminAuthHeader();
});

describe('admin user CRUD', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/admin/users');
    expect(res.status).toBe(401);
  });

  it('lists admin users without ever including a password hash', async () => {
    const res = await request(app).get('/admin/users').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.every((u: any) => u.passwordHash === undefined)).toBe(true);
  });

  it('creates, updates and deletes another admin', async () => {
    const create = await request(app)
      .post('/admin/users')
      .set(auth)
      .send({ username: 'newadmin', password: 'password1234' });
    expect(create.status).toBe(201);
    expect(create.body.username).toBe('newadmin');
    const id = create.body.id;

    const update = await request(app)
      .put(`/admin/users/${id}`)
      .set(auth)
      .send({ username: 'renamedadmin' });
    expect(update.status).toBe(200);
    expect(update.body.username).toBe('renamedadmin');

    const del = await request(app).delete(`/admin/users/${id}`).set(auth);
    expect(del.status).toBe(204);
  });

  it('rejects a duplicate username with 409', async () => {
    await request(app).post('/admin/users').set(auth).send({ username: 'dup', password: 'password1234' });
    const res = await request(app)
      .post('/admin/users')
      .set(auth)
      .send({ username: 'dup', password: 'password1234' });
    expect(res.status).toBe(409);
  });

  it('rejects a password shorter than 8 characters with 400', async () => {
    const res = await request(app)
      .post('/admin/users')
      .set(auth)
      .send({ username: 'shortpw', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('refuses to delete the last remaining admin', async () => {
    // Only the one admin created in beforeEach exists at this point.
    const list = await request(app).get('/admin/users').set(auth);
    expect(list.body).toHaveLength(1);

    const res = await request(app).delete(`/admin/users/${list.body[0].id}`).set(auth);
    expect(res.status).toBe(409);
  });

  it('allows deleting an admin once a second one exists', async () => {
    const create = await request(app)
      .post('/admin/users')
      .set(auth)
      .send({ username: 'second', password: 'password1234' });

    const list = await request(app).get('/admin/users').set(auth);
    const first = list.body.find((u: any) => u.id !== create.body.id);

    const res = await request(app).delete(`/admin/users/${first.id}`).set(auth);
    expect(res.status).toBe(204);
  });

  it('a new admin can actually log in with the password they were created with', async () => {
    await request(app).post('/admin/users').set(auth).send({ username: 'loginable', password: 'password1234' });
    const login = await request(app)
      .post('/admin/auth/login')
      .send({ username: 'loginable', password: 'password1234' });
    expect(login.status).toBe(200);
  });
});
