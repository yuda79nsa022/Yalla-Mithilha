import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-playerauth-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { db, resetDbForTests, setGamePriceFils, signupBonusCredits } from '../src/db';
import { resetCodeProvider } from '../src/notifications/resetCodeProvider';

const app = createApp();

beforeEach(() => resetDbForTests());

describe('CORS on /players', () => {
  it('answers a preflight OPTIONS request so a cross-origin POST can succeed', async () => {
    const res = await request(app)
      .options('/players/register')
      .set('Origin', 'http://example.test')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('sets Access-Control-Allow-Origin on the actual response, unlike /admin routes', async () => {
    const res = await request(app)
      .post('/players/register')
      .send({ username: 'corscheck', password: 'password1234' });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});

describe('POST /players/register', () => {
  it('creates a player account and returns a token', async () => {
    const res = await request(app)
      .post('/players/register')
      .send({ username: 'newplayer', password: 'password1234' });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.player).toMatchObject({ username: 'newplayer' });
    expect(res.body.player.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate username with 409', async () => {
    await request(app).post('/players/register').send({ username: 'dup', password: 'password1234' });
    const res = await request(app).post('/players/register').send({ username: 'dup', password: 'password1234' });
    expect(res.status).toBe(409);
  });

  it('rejects a password shorter than 8 characters with 400', async () => {
    const res = await request(app)
      .post('/players/register')
      .send({ username: 'shortpw', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('credits the one-time signup bonus, worth 3.00 KD in games at the current price', async () => {
    setGamePriceFils(1500); // 1.500 KD/game, so 3.00 KD is exactly 2 games
    const register = await request(app)
      .post('/players/register')
      .send({ username: 'bonusplayer', password: 'password1234' });
    expect(register.status).toBe(201);

    const wallet = await request(app)
      .get('/charades/wallet')
      .set('Authorization', `Bearer ${register.body.token}`);
    expect(wallet.body.balance).toBe(2);
    expect(wallet.body.balance).toBe(signupBonusCredits());
  });

  it('never re-grants the bonus on login, only on registration', async () => {
    const register = await request(app)
      .post('/players/register')
      .send({ username: 'onceonly', password: 'password1234' });

    await request(app).post('/players/login').send({ username: 'onceonly', password: 'password1234' });
    const wallet = await request(app)
      .get('/charades/wallet')
      .set('Authorization', `Bearer ${register.body.token}`);
    expect(wallet.body.balance).toBe(signupBonusCredits());
  });

  it('a player token does not work as an admin session', async () => {
    const register = await request(app)
      .post('/players/register')
      .send({ username: 'notanadmin', password: 'password1234' });

    const res = await request(app)
      .get('/admin/categories')
      .set('Authorization', `Bearer ${register.body.token}`);
    expect(res.status).toBe(401);
  });

  it('accepts an optional email at signup', async () => {
    const res = await request(app)
      .post('/players/register')
      .send({ username: 'withemail', password: 'password1234', email: 'withemail@example.com' });
    expect(res.status).toBe(201);
  });

  it('works fine with no email at all, same as before this field existed', async () => {
    const res = await request(app)
      .post('/players/register')
      .send({ username: 'noemail', password: 'password1234' });
    expect(res.status).toBe(201);
  });

  it('rejects a malformed email with 400', async () => {
    const res = await request(app)
      .post('/players/register')
      .send({ username: 'bademail', password: 'password1234', email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('POST /players/login', () => {
  it('logs in with the correct username and password', async () => {
    await request(app).post('/players/register').send({ username: 'jane', password: 'correct-horse' });

    const res = await request(app).post('/players/login').send({ username: 'jane', password: 'correct-horse' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.player).toMatchObject({ username: 'jane' });
    expect(res.body.player.passwordHash).toBeUndefined();
  });

  it('rejects the wrong password', async () => {
    await request(app).post('/players/register').send({ username: 'jane', password: 'correct-horse' });

    const res = await request(app).post('/players/login').send({ username: 'jane', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown username', async () => {
    const res = await request(app).post('/players/login').send({ username: 'nobody', password: 'whatever123' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing username or password with 400', async () => {
    const res = await request(app).post('/players/login').send({ username: 'jane' });
    expect(res.status).toBe(400);
  });
});

describe('POST /players/password-reset/request + /confirm', () => {
  afterEach(() => jest.restoreAllMocks());

  /** Captures the code `sendResetCode` was called with, without actually delivering anything. Restores any spy from a previous call first, so each call's own count starts fresh. */
  async function requestResetAndCaptureCode(username: string): Promise<string> {
    jest.restoreAllMocks();
    const spy = jest.spyOn(resetCodeProvider, 'sendResetCode').mockResolvedValue(undefined);
    const res = await request(app).post('/players/password-reset/request').send({ username });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    return spy.mock.calls[0][0].code;
  }

  it('responds with the same generic message for an unknown username as for a known one', async () => {
    await request(app)
      .post('/players/register')
      .send({ username: 'hasmail', password: 'password1234', email: 'hasmail@example.com' });

    const spy = jest.spyOn(resetCodeProvider, 'sendResetCode').mockResolvedValue(undefined);
    const unknown = await request(app).post('/players/password-reset/request').send({ username: 'nosuchuser' });
    const known = await request(app).post('/players/password-reset/request').send({ username: 'hasmail' });

    expect(unknown.status).toBe(200);
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    // Only the real, email-bearing account actually triggered a send.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('never sends a code for an account with no email on file, but still responds generically', async () => {
    await request(app).post('/players/register').send({ username: 'noemailreset', password: 'password1234' });

    const spy = jest.spyOn(resetCodeProvider, 'sendResetCode').mockResolvedValue(undefined);
    const res = await request(app).post('/players/password-reset/request').send({ username: 'noemailreset' });
    expect(res.status).toBe(200);
    expect(spy).not.toHaveBeenCalled();

    const confirm = await request(app)
      .post('/players/password-reset/confirm')
      .send({ username: 'noemailreset', code: '000000', newPassword: 'brandnewpassword' });
    expect(confirm.status).toBe(400);
  });

  it('resets the password with the emailed code, and the old password stops working', async () => {
    await request(app)
      .post('/players/register')
      .send({ username: 'resetme', password: 'oldpassword1', email: 'resetme@example.com' });

    const code = await requestResetAndCaptureCode('resetme');
    const confirm = await request(app)
      .post('/players/password-reset/confirm')
      .send({ username: 'resetme', code, newPassword: 'brandnewpassword' });
    expect(confirm.status).toBe(200);
    expect(confirm.body).toEqual({ ok: true });

    const oldLogin = await request(app).post('/players/login').send({ username: 'resetme', password: 'oldpassword1' });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post('/players/login')
      .send({ username: 'resetme', password: 'brandnewpassword' });
    expect(newLogin.status).toBe(200);
  });

  it('records a self-service audit log entry on a successful reset', async () => {
    await request(app)
      .post('/players/register')
      .send({ username: 'audited', password: 'oldpassword1', email: 'audited@example.com' });
    const code = await requestResetAndCaptureCode('audited');
    await request(app)
      .post('/players/password-reset/confirm')
      .send({ username: 'audited', code, newPassword: 'brandnewpassword' });

    const row = db
      .prepare("SELECT * FROM audit_log WHERE action = 'player.password_reset_self' AND actor_username = ?")
      .get('audited') as { actor_username: string } | undefined;
    expect(row).toBeDefined();
  });

  it('a code is single-use — confirming twice fails the second time', async () => {
    await request(app)
      .post('/players/register')
      .send({ username: 'singleuse', password: 'oldpassword1', email: 'singleuse@example.com' });
    const code = await requestResetAndCaptureCode('singleuse');

    const first = await request(app)
      .post('/players/password-reset/confirm')
      .send({ username: 'singleuse', code, newPassword: 'newpassword1' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/players/password-reset/confirm')
      .send({ username: 'singleuse', code, newPassword: 'anotherpassword' });
    expect(second.status).toBe(400);
  });

  it('a new request invalidates any code already outstanding for that player', async () => {
    await request(app)
      .post('/players/register')
      .send({ username: 'superseded', password: 'oldpassword1', email: 'superseded@example.com' });
    const firstCode = await requestResetAndCaptureCode('superseded');
    await requestResetAndCaptureCode('superseded'); // a second request, before the first code was ever used

    const res = await request(app)
      .post('/players/password-reset/confirm')
      .send({ username: 'superseded', code: firstCode, newPassword: 'newpassword1' });
    expect(res.status).toBe(400);
  });

  it('locks the code out after 5 wrong guesses, even though it has not expired', async () => {
    await request(app)
      .post('/players/register')
      .send({ username: 'bruteforced', password: 'oldpassword1', email: 'bruteforced@example.com' });
    const code = await requestResetAndCaptureCode('bruteforced');
    const wrongCode = code === '111111' ? '222222' : '111111';

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/players/password-reset/confirm')
        .send({ username: 'bruteforced', code: wrongCode, newPassword: 'newpassword1' });
      expect(res.status).toBe(400);
    }

    // The 6th attempt uses the real code, but the account is already locked out.
    const res = await request(app)
      .post('/players/password-reset/confirm')
      .send({ username: 'bruteforced', code, newPassword: 'newpassword1' });
    expect(res.status).toBe(400);
  });

  it('rejects an expired code', async () => {
    await request(app)
      .post('/players/register')
      .send({ username: 'expired', password: 'oldpassword1', email: 'expired@example.com' });
    const code = await requestResetAndCaptureCode('expired');
    db.prepare('UPDATE password_resets SET expires_at = ?').run(Date.now() - 1000);

    const res = await request(app)
      .post('/players/password-reset/confirm')
      .send({ username: 'expired', code, newPassword: 'newpassword1' });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed code with 400 before ever touching the database', async () => {
    const res = await request(app)
      .post('/players/password-reset/confirm')
      .send({ username: 'whoever', code: 'abcdef', newPassword: 'newpassword1' });
    expect(res.status).toBe(400);
  });

  it('rejects a new password shorter than 8 characters with 400', async () => {
    await request(app)
      .post('/players/register')
      .send({ username: 'shortnew', password: 'oldpassword1', email: 'shortnew@example.com' });
    const code = await requestResetAndCaptureCode('shortnew');

    const res = await request(app)
      .post('/players/password-reset/confirm')
      .send({ username: 'shortnew', code, newPassword: 'short' });
    expect(res.status).toBe(400);
  });
});
