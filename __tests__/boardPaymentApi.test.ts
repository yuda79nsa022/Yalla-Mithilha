import {
  BoardPaymentError,
  confirmBoardCheckout,
  consumeBoardCredit,
  failBoardCheckout,
  getBoardCredits,
  startBoardCheckout,
} from '../src/services/boardPaymentApi';

function mockFetch(impl: typeof fetch) {
  (global as unknown as { fetch: typeof fetch }).fetch = impl;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getBoardCredits', () => {
  it('returns the balance', async () => {
    mockFetch(async () => new Response(JSON.stringify({ balance: 3 }), { status: 200 }));
    expect(await getBoardCredits('tok', 'http://example.test')).toBe(3);
  });

  it('throws a BoardPaymentError with the 401 status when unauthenticated', async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }));
    await expect(getBoardCredits('bad-tok', 'http://example.test')).rejects.toMatchObject({ status: 401 });
  });
});

describe('startBoardCheckout', () => {
  it('returns the created payment', async () => {
    mockFetch(
      async () =>
        new Response(
          JSON.stringify({ id: 'pay-1', product: 'single', credits: 1, amountFils: 2000, currency: 'KWD', status: 'initiated' }),
          { status: 201 }
        )
    );
    const payment = await startBoardCheckout('tok', 'single', 'http://example.test');
    expect(payment).toMatchObject({ id: 'pay-1', status: 'initiated', credits: 1 });
  });
});

describe('confirmBoardCheckout / failBoardCheckout', () => {
  it('confirm returns the new balance', async () => {
    mockFetch(async () => new Response(JSON.stringify({ balance: 2 }), { status: 200 }));
    expect(await confirmBoardCheckout('tok', 'pay-1', 'http://example.test')).toEqual({ balance: 2 });
  });

  it('fail resolves without throwing on a 200', async () => {
    mockFetch(async () => new Response(JSON.stringify({ status: 'failed' }), { status: 200 }));
    await expect(failBoardCheckout('tok', 'pay-1', 'http://example.test')).resolves.toBeDefined();
  });
});

describe('consumeBoardCredit', () => {
  it('returns the balance after spending a credit', async () => {
    mockFetch(async () => new Response(JSON.stringify({ balance: 0 }), { status: 200 }));
    expect(await consumeBoardCredit('tok', 'board-1', 'http://example.test')).toEqual({ balance: 0 });
  });

  it('throws a BoardPaymentError with status 402 when the balance is empty', async () => {
    mockFetch(async () => new Response(JSON.stringify({ error: 'not enough credits' }), { status: 402 }));
    await expect(consumeBoardCredit('tok', 'board-1', 'http://example.test')).rejects.toMatchObject({
      status: 402,
    });
  });

  it('wraps a network failure in a BoardPaymentError', async () => {
    mockFetch(async () => {
      throw new Error('network down');
    });
    await expect(consumeBoardCredit('tok', 'board-1', 'http://example.test')).rejects.toThrow(BoardPaymentError);
  });
});
