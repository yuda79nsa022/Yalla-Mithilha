import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-credits-${Date.now()}-${Math.random()}.sqlite`);

import {
  BoardGameNotFoundError,
  InsufficientCreditsError,
  PaymentNotFoundError,
  completeBoardGame,
  confirmPayment,
  consumeCreditForBoardGame,
  createPayment,
  createPlayer,
  creditBalance,
  failPayment,
  getBoardGame,
  getPayment,
  resetDbForTests,
} from '../src/db';

beforeEach(() => resetDbForTests());

function makePlayer(username = `player-${Date.now()}-${Math.random()}`) {
  return createPlayer({ username, passwordHash: 'hashed' });
}

describe('createPayment', () => {
  it('starts a payment in "initiated" status with no credits granted yet', () => {
    const player = makePlayer();
    const payment = createPayment({ playerId: player.id, product: 'single', provider: 'mock' });
    expect(payment.status).toBe('initiated');
    expect(payment.credits).toBe(1);
    expect(creditBalance(player.id)).toBe(0);
  });

  it('prices a bundle as 2 credits', () => {
    const player = makePlayer();
    const payment = createPayment({ playerId: player.id, product: 'bundle2', provider: 'mock' });
    expect(payment.credits).toBe(2);
  });
});

describe('confirmPayment', () => {
  it('grants credits exactly once, even when called twice (duplicate webhook)', () => {
    const player = makePlayer();
    const payment = createPayment({ playerId: player.id, product: 'bundle2', provider: 'mock' });

    const first = confirmPayment(payment.id);
    expect(first.payment.status).toBe('paid');
    expect(first.balance).toBe(2);

    const second = confirmPayment(payment.id);
    expect(second.balance).toBe(2); // not 4
    expect(getPayment(payment.id)?.status).toBe('paid');
  });

  it('throws for an unknown payment id', () => {
    expect(() => confirmPayment('nope')).toThrow(PaymentNotFoundError);
  });

  it('does not grant credits for a payment that already failed', () => {
    const player = makePlayer();
    const payment = createPayment({ playerId: player.id, product: 'single', provider: 'mock' });
    failPayment(payment.id);

    const result = confirmPayment(payment.id);
    expect(result.balance).toBe(0);
    expect(getPayment(payment.id)?.status).toBe('failed');
  });
});

describe('failPayment', () => {
  it('marks a payment failed and grants nothing', () => {
    const player = makePlayer();
    const payment = createPayment({ playerId: player.id, product: 'single', provider: 'mock' });
    const failed = failPayment(payment.id);
    expect(failed.status).toBe('failed');
    expect(creditBalance(player.id)).toBe(0);
  });

  it('is idempotent — failing an already-paid payment does not un-pay it', () => {
    const player = makePlayer();
    const payment = createPayment({ playerId: player.id, product: 'single', provider: 'mock' });
    confirmPayment(payment.id);
    failPayment(payment.id);
    expect(getPayment(payment.id)?.status).toBe('paid');
    expect(creditBalance(player.id)).toBe(1);
  });
});

describe('consumeCreditForBoardGame', () => {
  it('refuses to start a paid game with zero balance', () => {
    const player = makePlayer();
    expect(() => consumeCreditForBoardGame(player.id, 'board-1')).toThrow(InsufficientCreditsError);
  });

  it('spends exactly one credit and creates an active board game', () => {
    const player = makePlayer();
    const payment = createPayment({ playerId: player.id, product: 'bundle2', provider: 'mock' });
    confirmPayment(payment.id);

    const { boardGame, balance } = consumeCreditForBoardGame(player.id, 'board-1');
    expect(boardGame.status).toBe('active');
    expect(balance).toBe(1); // 2 granted, 1 spent
  });

  it('is idempotent by boardGameId — resuming an interrupted game never spends a second credit', () => {
    const player = makePlayer();
    const payment = createPayment({ playerId: player.id, product: 'bundle2', provider: 'mock' });
    confirmPayment(payment.id);

    const first = consumeCreditForBoardGame(player.id, 'board-1');
    const second = consumeCreditForBoardGame(player.id, 'board-1');
    expect(first.balance).toBe(1);
    expect(second.balance).toBe(1); // unchanged — not 0
  });

  it('refuses to hand back another player\'s board game', () => {
    const a = makePlayer();
    const b = makePlayer();
    const paymentA = createPayment({ playerId: a.id, product: 'single', provider: 'mock' });
    confirmPayment(paymentA.id);
    consumeCreditForBoardGame(a.id, 'shared-id');

    expect(() => consumeCreditForBoardGame(b.id, 'shared-id')).toThrow(BoardGameNotFoundError);
  });
});

describe('completeBoardGame', () => {
  it('marks a board game completed', () => {
    const player = makePlayer();
    const payment = createPayment({ playerId: player.id, product: 'single', provider: 'mock' });
    confirmPayment(payment.id);
    consumeCreditForBoardGame(player.id, 'board-1');

    const completed = completeBoardGame(player.id, 'board-1');
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).not.toBeNull();
    expect(getBoardGame('board-1')?.status).toBe('completed');
  });

  it('throws for an unknown board game', () => {
    const player = makePlayer();
    expect(() => completeBoardGame(player.id, 'nope')).toThrow(BoardGameNotFoundError);
  });
});
