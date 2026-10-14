import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-concurrency-${Date.now()}-${Math.random()}.sqlite`);
process.env.SESSION_SECRET = 'test-secret';
process.env.PLAYER_SESSION_SECRET = 'test-player-secret';

import request from 'supertest';
import { createApp } from '../src/app';
import { runConsistencyChecks } from '../src/checkDb';
import { addTitlesToDeck, createDeck, creditBalance, db, getPlayerById, resetDbForTests } from '../src/db';

// The expected production load: 40 players hitting the server at the same
// time. Every request below is in flight at once against one real HTTP
// server, so they interleave at every `await` the routes have (password
// hashing above all) — the realistic race surface for a single-process
// Node server. Afterwards the ledger must add up exactly and pass every
// check `npm run check-db` runs against production.
const USERS = 40;
const app = createApp();

beforeAll(() => {
  resetDbForTests();
  createDeck({ id: 'load-deck', nameAr: 'مجموعة', nameEn: 'Load Deck' });
  addTitlesToDeck(
    'load-deck',
    Array.from({ length: 120 }, (_, i) => `Load Title ${i}`)
  );
});

afterAll(() => db.close());

describe(`${USERS} concurrent players`, () => {
  it('sign up, spend free games, buy and spend credit — with double-taps — and the ledger stays consistent', async () => {
    // 1. Everyone registers at once (each gets 2 free games).
    const registered = await Promise.all(
      Array.from({ length: USERS }, (_, i) =>
        request(app).post('/players/register').send({ username: `loaduser${i}`, password: 'loadpassword1', email: `loaduser${i}@example.com` })
      )
    );
    expect(registered.every((r) => r.status === 201)).toBe(true);
    const players = registered.map((r) => ({
      id: r.body.player.id as string,
      auth: { Authorization: `Bearer ${r.body.token}` },
    }));

    // 2. Everyone starts both free games at once, each one double-tapped
    //    (the same session id sent twice): the duplicate must resume the
    //    session, never spend a second free game.
    const freeStarts = await Promise.all(
      players.flatMap((p, i) =>
        ['classic', 'modified'].flatMap((mode, j) => {
          const body = { sessionId: `free-${i}-${j}`, mode };
          return [
            request(app).post('/charades/sessions').set(p.auth).send(body),
            request(app).post('/charades/sessions').set(p.auth).send(body),
          ];
        })
      )
    );
    expect(freeStarts.every((r) => r.status < 300)).toBe(true);

    // 3. Everyone tries a third game at once with nothing left: all refused.
    const overdrawn = await Promise.all(
      players.map((p, i) => request(app).post('/charades/sessions').set(p.auth).send({ sessionId: `over-${i}`, mode: 'classic' }))
    );
    expect(overdrawn.every((r) => r.status === 402)).toBe(true);

    // 4. Everyone buys one credit, and the payment provider's confirm fires
    //    twice for each (as a real webhook may): exactly one credit each.
    const checkouts = await Promise.all(players.map((p) => request(app).post('/charades/checkout').set(p.auth)));
    await Promise.all(
      players.flatMap((p, i) => [
        request(app).post(`/charades/checkout/${checkouts[i].body.id}/confirm`).set(p.auth),
        request(app).post(`/charades/checkout/${checkouts[i].body.id}/confirm`).set(p.auth),
      ])
    );
    for (const p of players) expect(creditBalance(p.id)).toBe(1);

    // 5. Everyone spends it on two different sessions at once: exactly one
    //    of each pair gets through, the other is refused.
    const paidStarts = await Promise.all(
      players.flatMap((p, i) => [
        request(app).post('/charades/sessions').set(p.auth).send({ sessionId: `paid-${i}-a`, mode: 'modified' }),
        request(app).post('/charades/sessions').set(p.auth).send({ sessionId: `paid-${i}-b`, mode: 'classic' }),
      ])
    );
    for (let i = 0; i < USERS; i++) {
      expect([paidStarts[2 * i].status, paidStarts[2 * i + 1].status].sort()).toEqual([201, 402]);
    }

    for (const p of players) {
      expect(creditBalance(p.id)).toBe(0);
      expect(getPlayerById(p.id)?.freeGameCredits).toBe(0);
    }
    const sessions = db.prepare('SELECT COUNT(*) AS n FROM game_sessions').get() as { n: number };
    expect(sessions.n).toBe(USERS * 3); // 2 free + 1 paid each, no duplicates

    for (const check of runConsistencyChecks(db)) {
      expect({ check: check.name, problems: check.problems }).toEqual({ check: check.name, problems: [] });
    }
  }, 60_000);
});

describe('database-level ledger guards and check-db', () => {
  it('the database itself refuses a second charge for the same session or a second grant for the same payment', () => {
    const player = db.prepare('SELECT id FROM players LIMIT 1').get() as { id: string };
    const session = db.prepare('SELECT id FROM game_sessions WHERE player_id = ? LIMIT 1').get(player.id) as { id: string };
    const payment = db.prepare("SELECT id FROM payments WHERE player_id = ? AND status = 'paid'").get(player.id) as {
      id: string;
    };
    const insert = db.prepare(
      `INSERT INTO credit_transactions (id, player_id, kind, amount, payment_id, game_session_id, created_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)`
    );
    const charged = db.prepare("SELECT COUNT(*) AS n FROM credit_transactions WHERE game_session_id = ? AND kind = 'consume'");
    // A free-game session has no charge yet, so seed one to collide with.
    if ((charged.get(session.id) as { n: number }).n === 0) {
      insert.run('seed-consume', player.id, 'consume', null, session.id, Date.now());
    }
    expect(() => insert.run('dup-consume', player.id, 'consume', null, session.id, Date.now())).toThrow(/UNIQUE/);
    expect(() => insert.run('dup-grant', player.id, 'grant', payment.id, null, Date.now())).toThrow(/UNIQUE/);
  });

  it('check-db reports broken invariants', () => {
    resetDbForTests();
    const now = Date.now();
    db.prepare(
      `INSERT INTO players (id, username, password_hash, free_game_credits, created_at, updated_at)
       VALUES ('bad', 'baduser', 'x', 7, ?, ?)`
    ).run(now, now);
    db.prepare(
      `INSERT INTO payments (id, player_id, credits, amount_fils, provider, status, created_at, updated_at)
       VALUES ('ungranted', 'bad', 1, 1500, 'test', 'paid', ?, ?)`
    ).run(now, now);

    const failed = runConsistencyChecks(db)
      .filter((r) => r.problems.length > 0)
      .map((r) => r.name);
    expect(failed).toEqual(['free signup games stay within 0..2', 'every paid payment granted credit exactly once']);
  });
});
