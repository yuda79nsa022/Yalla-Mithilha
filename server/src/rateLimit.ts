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

/** Requesting a reset code: tight, since every request costs a real email/SMS send (or would, with a real provider) and is a username-enumeration target even though the response never confirms a match. */
export const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'too many reset requests, try again later' },
});

/** Submitting a code: the real risk here is brute-forcing a 6-digit code before it expires — this, together with the per-code attempt cap in the route itself, keeps that infeasible. */
export const passwordResetConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'too many attempts, try again later' },
});
