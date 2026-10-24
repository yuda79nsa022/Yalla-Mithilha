import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-lists-${Date.now()}-${Math.random()}.sqlite`);
process.env.DATA_DIR = path.join(os.tmpdir(), `yalla-test-lists-data-${Date.now()}-${Math.random()}`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import fs from 'fs';
import request from 'supertest';
import { createApp } from '../src/app';
import { createPlayer, recordAudit, resetDbForTests } from '../src/db';
import { makeAdminAuthHeader } from './helpers/testAuth';

const app = createApp();
let auth: { Authorization: string };

beforeEach(async () => {
  resetDbForTests();
  auth = await makeAdminAuthHeader();
});

describe('paged admin lists', () => {
  it('keeps the plain array when no page is asked for', async () => {
    const res = await request(app).get('/admin/decks').set(auth);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('searches, sorts and pages decks, with a title count instead of the titles', async () => {
    for (const id of ['alpha', 'bravo', 'charlie', 'delta']) {
      await request(app).post('/admin/decks').set(auth).send({ id, nameAr: id, nameEn: `Deck ${id}` });
    }
    await request(app).post('/admin/decks/charlie/titles').set(auth).field('text', 'one');

    const page1 = await request(app).get('/admin/decks?page=1&pageSize=3&sort=id&dir=desc').set(auth);
    expect(page1.status).toBe(200);
    expect(page1.body.total).toBe(4);
    expect(page1.body.items.map((d: any) => d.id)).toEqual(['delta', 'charlie', 'bravo']);
    expect(page1.body.items[1].titleCount).toBe(1);
    expect(page1.body.items[1].titles).toBeUndefined();

    const page2 = await request(app).get('/admin/decks?page=2&pageSize=3&sort=id&dir=desc').set(auth);
    expect(page2.body.items.map((d: any) => d.id)).toEqual(['alpha']);

    const search = await request(app).get('/admin/decks?page=1&q=BRA').set(auth);
    expect(search.body.items.map((d: any) => d.id)).toEqual(['bravo']);
    expect(search.body.total).toBe(1);
  });

  it('treats % and _ in a search as plain characters', async () => {
    createPlayer({ username: 'a_b', passwordHash: 'x' });
    createPlayer({ username: 'axb', passwordHash: 'x' });
    const res = await request(app).get('/admin/players?page=1&q=a_b').set(auth);
    expect(res.body.items.map((p: any) => p.username)).toEqual(['a_b']);
  });

  it('searches players by email and never returns a password hash', async () => {
    createPlayer({ username: 'sara', passwordHash: 'secret-hash', email: 'sara@example.com' });
    createPlayer({ username: 'omar', passwordHash: 'secret-hash' });
    const res = await request(app).get('/admin/players?page=1&q=example.com').set(auth);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].username).toBe('sara');
    expect(JSON.stringify(res.body)).not.toContain('secret-hash');
  });

  it('pages admins', async () => {
    await request(app).post('/admin/users').set(auth).send({ username: 'zed-admin', password: 'password-123' });
    const res = await request(app).get('/admin/users?page=1&pageSize=1&sort=username&dir=desc').set(auth);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].username).toBe('zed-admin');
  });

  it('searches the audit log newest first, including the before/after snapshots', async () => {
    recordAudit({ actorId: 'a', actorUsername: 'amal', action: 'deck.create', target: 'one', after: { nameEn: 'Gulf Series' } });
    recordAudit({ actorId: 'a', actorUsername: 'amal', action: 'deck.create', target: 'two', after: { nameEn: 'Plays' } });
    const all = await request(app).get('/admin/audit-log?page=1').set(auth);
    expect(all.body.items.map((e: any) => e.target)).toEqual(['two', 'one']);
    const found = await request(app).get('/admin/audit-log?page=1&q=gulf').set(auth);
    expect(found.body.items.map((e: any) => e.target)).toEqual(['one']);
  });

  it('rejects an unknown sort key and bad paging numbers', async () => {
    expect((await request(app).get('/admin/decks?page=1&sort=password_hash').set(auth)).status).toBe(400);
    expect((await request(app).get('/admin/players?page=0').set(auth)).status).toBe(400);
    expect((await request(app).get('/admin/users?page=1&pageSize=1000').set(auth)).status).toBe(400);
    expect((await request(app).get('/admin/audit-log?page=1&dir=sideways').set(auth)).status).toBe(400);
  });
});

describe('branding', () => {
  it('has a default name and timezone, public to everyone', async () => {
    const res = await request(app).get('/charades/branding');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ appNameAr: 'بس بدون كلام', appNameEn: 'Bas Bedoon Kalam', logoPath: null, timezone: 'Asia/Kuwait' });
  });

  it('updates the name and timezone, and audits it', async () => {
    const res = await request(app).put('/admin/settings/branding').set(auth).send({ appNameEn: 'Yalla Mithilha', timezone: 'Asia/Dubai' });
    expect(res.status).toBe(200);
    expect(res.body.appNameEn).toBe('Yalla Mithilha');
    expect(res.body.appNameAr).toBe('بس بدون كلام');
    expect(res.body.timezone).toBe('Asia/Dubai');
    const log = await request(app).get('/admin/audit-log').set(auth);
    expect(log.body[0].action).toBe('settings.branding.update');
  });

  it('rejects an unknown timezone and a blank name', async () => {
    expect((await request(app).put('/admin/settings/branding').set(auth).send({ timezone: 'Mars/Olympus' })).status).toBe(400);
    expect((await request(app).put('/admin/settings/branding').set(auth).send({ appNameEn: '   ' })).status).toBe(400);
  });

  it('requires an admin session to change anything', async () => {
    expect((await request(app).put('/admin/settings/branding').send({ appNameEn: 'x' })).status).toBe(401);
  });

  it('uploads, serves and removes a logo', async () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const up = await request(app).put('/admin/settings/branding/logo').set(auth).attach('logo', png, 'logo.png');
    expect(up.status).toBe(200);
    expect(up.body.logoPath).toMatch(/^\/branding\/logo-.+\.png$/);
    const served = await request(app).get(up.body.logoPath);
    expect(served.status).toBe(200);

    const file = path.join(process.env.DATA_DIR!, 'branding', path.basename(up.body.logoPath));
    expect(fs.existsSync(file)).toBe(true);
    const removed = await request(app).put('/admin/settings/branding/logo').set(auth).field('removeLogo', 'true');
    expect(removed.body.logoPath).toBeNull();
    expect(fs.existsSync(file)).toBe(false);
  });

  it('refuses an SVG logo', async () => {
    const res = await request(app).put('/admin/settings/branding/logo').set(auth).attach('logo', Buffer.from('<svg/>'), 'logo.svg');
    expect(res.status).toBe(400);
  });
});

describe('payment done page', () => {
  it('hands the result to the game window, or continues to checkout', async () => {
    const res = await request(app).get('/charades/checkout/myfatoorah/done?payment=0b6a-11&result=paid');
    expect(res.status).toBe(200);
    expect(res.text).toContain('"target":"/charades/checkout?payment=0b6a-11&result=paid"');
    expect(res.text).toContain("BroadcastChannel('myfatoorah')");
  });

  it('never echoes anything that is not a payment id or a known result', async () => {
    const res = await request(app).get('/charades/checkout/myfatoorah/done?payment=%3Cscript%3E&result=%3Cb%3E');
    expect(res.text).not.toContain('<script>alert');
    expect(res.text).toContain('"payment":null');
    expect(res.text).toContain('"result":"error"');
  });
});
