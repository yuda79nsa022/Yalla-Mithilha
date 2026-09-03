import rateLimit from 'express-rate-limit';

// express-rate-limit's default in-memory store persists for the life of the
// process. Jest sets NODE_ENV=test automatically, and a single test file can
// legitimately make dozens of login attempts (wrong-password cases, etc.) —
// so limiting is disabled under test rather than tuned around the suite.
// Read live rather than once at import time, so a test can flip NODE_ENV to
// exercise the limiter itself (see __tests__/rateLimit.test.ts).
const skip = () => process.env.NODE_ENV === 'test';

/** Login endpoints: generous enough for a real user mistyping a password a few times. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'too many attempts, try again later' },
});

/** Account creation: tighter, since it is the more attractive target for abuse/enumeration. */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'too many accounts created from this network, try again later' },
});

/** Content reports: unauthenticated by design (no account needed to report a card), so this is the only thing standing between it and a flood. Each request can carry a batch, so the request-count budget stays modest. */
export const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'too many reports from this network, try again later' },
});
