import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-sessions-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { resetDbForTests, updatePlayer } from '../src/db';
import { makeAdminAuthHeader, makePlayerSession } from './helpers/testAuth';

// A session token is only good while its account still exists and its
// password hasn't changed since it was issued — not just until the token's
// own 12-hour expiry. See `isCurrent` in src/auth.ts.
const app = createApp();

beforeEach(() => resetDbForTests());

const playerWallet = (auth: { Authorization: string }) => request(app).get('/charades/wallet').set(auth);
const adminDecks = (auth: { Authorization: string }) => request(app).get('/admin/decks').set(auth);

function adminIdOf(auth: { Authorization: string }): string {
  return (jwt.decode(auth.Authorization.slice(7)) as { sub: string }).sub;
}

describe('player sessions end when the account changes', () => {
  it('a password change by an admin signs the player out everywhere', async () => {
    const admin = await makeAdminAuthHeader();
    const { auth, player } = await makePlayerSession();
    expect((await playerWallet(auth)).status).toBe(200);

    const changed = await request(app).put(`/admin/players/${player.id}`).set(admin).send({ password: 'brandnewpassword' });
    expect(changed.status).toBe(200);
    expect((await playerWallet(auth)).status).toBe(401);

    // Signing in again with the new password works as normal.
    const login = await request(app).post('/players/login').send({ username: player.username, password: 'brandnewpassword' });
    expect(login.status).toBe(200);
    expect((await playerWallet({ Authorization: `Bearer ${login.body.token}` })).status).toBe(200);
  });

  it('a password reset (the same updatePlayer path) signs the player out', async () => {
    const { auth, player } = await makePlayerSession();
    updatePlayer(player.id, { passwordHash: 'replaced-hash' });
    expect((await playerWallet(auth)).status).toBe(401);
  });

  it('changing only the username or email keeps the player signed in', async () => {
    const admin = await makeAdminAuthHeader();
    const { auth, player } = await makePlayerSession();
    await request(app).put(`/admin/players/${player.id}`).set(admin).send({ username: 'renamedplayer' });
    expect((await playerWallet(auth)).status).toBe(200);
  });

  it("a deleted player's token is refused with 401 — never a server error", async () => {
    const admin = await makeAdminAuthHeader();
    const { auth, player } = await makePlayerSession();
    expect((await request(app).delete(`/admin/players/${player.id}`).set(admin)).status).toBe(204);

    expect((await playerWallet(auth)).status).toBe(401);
    const start = await request(app).post('/charades/sessions').set(auth).send({ sessionId: 's1', mode: 'classic' });
    expect(start.status).toBe(401);
  });
});

describe('admin sessions end when the account changes', () => {
  it("deleting an admin ends that admin's access immediately", async () => {
    const keeper = await makeAdminAuthHeader();
    const removed = await makeAdminAuthHeader();
    expect((await adminDecks(removed)).status).toBe(200);

    expect((await request(app).delete(`/admin/users/${adminIdOf(removed)}`).set(keeper)).status).toBe(204);
    expect((await adminDecks(removed)).status).toBe(401);
    expect((await adminDecks(keeper)).status).toBe(200);
  });

  it("changing an admin's password signs that admin out", async () => {
    const keeper = await makeAdminAuthHeader();
    const target = await makeAdminAuthHeader();
    await request(app).put(`/admin/users/${adminIdOf(target)}`).set(keeper).send({ password: 'brandnewpassword' });
    expect((await adminDecks(target)).status).toBe(401);
    expect((await adminDecks(keeper)).status).toBe(200);
  });
});

describe('token format', () => {
  it('a token issued before session versions existed (no `ver`) still works, so deploying signs no one out', async () => {
    const { player } = await makePlayerSession();
    const legacy = jwt.sign({ sub: player.id, username: player.username }, 'test-player-secret', { expiresIn: '12h' });
    expect((await playerWallet({ Authorization: `Bearer ${legacy}` })).status).toBe(200);
  });

  it('only HS256 is accepted, even with the right secret', async () => {
    const { player } = await makePlayerSession();
    const otherAlg = jwt.sign({ sub: player.id, username: player.username, ver: 0 }, 'test-player-secret', {
      expiresIn: '12h',
      algorithm: 'HS512',
    });
    expect((await playerWallet({ Authorization: `Bearer ${otherAlg}` })).status).toBe(401);
  });
});
