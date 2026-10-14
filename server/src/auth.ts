import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { getAdminSessionVersion, getPlayerSessionVersion } from './db';

const SESSION_SECRET = process.env.SESSION_SECRET;
const PLAYER_SESSION_SECRET = process.env.PLAYER_SESSION_SECRET;
const TOKEN_TTL = '12h';
// Pinned on both sign and verify, so a token can only ever be checked as the
// HMAC it was issued as — never under whatever algorithm its header claims.
const TOKEN_ALGORITHM = 'HS256';
// bcrypt (native, libuv-threadpool-backed), not bcryptjs (pure JS, runs on
// the main thread) — a load test found bcryptjs serializing every
// concurrent register/login onto Node's single thread, so a burst of
// simultaneous signups queued up and got linearly slower (~1s at 10
// concurrent, ~16s at 200). Native bcrypt offloads the hashing to libuv's
// thread pool, so concurrent hashes actually run in parallel.
const BCRYPT_ROUNDS = 10;

export interface SessionPayload {
  sub: string; // admin user id
  username: string;
}

export interface PlayerSessionPayload {
  sub: string; // player id
  username: string;
}

/**
 * The account's `session_version` at the time the token was issued (see
 * db.ts). Absent on tokens issued before it existed, which counts as 0 —
 * every account's starting version — so deploying this signed no one out.
 */
interface VersionedClaims {
  ver?: number;
}

/**
 * A token is only good while its account still exists and its password
 * hasn't changed since the token was issued — checked on every request, so
 * deleting an account or changing its password ends all its sessions at once
 * instead of leaving them valid until the token's own expiry.
 */
function isCurrent(claims: VersionedClaims, currentVersion: number | null): boolean {
  return currentVersion !== null && (claims.ver ?? 0) === currentVersion;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSessionToken(payload: SessionPayload): string {
  if (!SESSION_SECRET) throw new Error('SESSION_SECRET is not configured');
  const claims: SessionPayload & VersionedClaims = { ...payload, ver: getAdminSessionVersion(payload.sub) ?? 0 };
  return jwt.sign(claims, SESSION_SECRET, { expiresIn: TOKEN_TTL, algorithm: TOKEN_ALGORITHM });
}

function verifySessionToken(token: string): SessionPayload | null {
  if (!SESSION_SECRET) return null;
  try {
    const claims = jwt.verify(token, SESSION_SECRET, { algorithms: [TOKEN_ALGORITHM] }) as SessionPayload &
      VersionedClaims;
    return isCurrent(claims, getAdminSessionVersion(claims.sub)) ? claims : null;
  } catch {
    return null;
  }
}

/**
 * A player session is signed with its own secret, entirely separate from
 * admin sessions — even if the two payload shapes happen to look alike, a
 * player token can never verify against SESSION_SECRET or vice versa.
 */
export function signPlayerSessionToken(payload: PlayerSessionPayload): string {
  if (!PLAYER_SESSION_SECRET) throw new Error('PLAYER_SESSION_SECRET is not configured');
  const claims: PlayerSessionPayload & VersionedClaims = { ...payload, ver: getPlayerSessionVersion(payload.sub) ?? 0 };
  return jwt.sign(claims, PLAYER_SESSION_SECRET, { expiresIn: TOKEN_TTL, algorithm: TOKEN_ALGORITHM });
}

function verifyPlayerSessionToken(token: string): PlayerSessionPayload | null {
  if (!PLAYER_SESSION_SECRET) return null;
  try {
    const claims = jwt.verify(token, PLAYER_SESSION_SECRET, { algorithms: [TOKEN_ALGORITHM] }) as PlayerSessionPayload &
      VersionedClaims;
    return isCurrent(claims, getPlayerSessionVersion(claims.sub)) ? claims : null;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: SessionPayload;
      player?: PlayerSessionPayload;
    }
  }
}

/** Every admin route requires a valid session token from POST /admin/auth/login. */
export const requireAdminSession: RequestHandler = (req, res, next) => {
  if (!SESSION_SECRET) {
    res.status(500).json({ error: 'SESSION_SECRET is not configured on the server' });
    return;
  }
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  req.admin = payload;
  next();
};

/** For any future player-only route that needs to know who's asking. Not used by register/login themselves. */
export const requirePlayerSession: RequestHandler = (req, res, next) => {
  if (!PLAYER_SESSION_SECRET) {
    res.status(500).json({ error: 'PLAYER_SESSION_SECRET is not configured on the server' });
    return;
  }
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifyPlayerSessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  req.player = payload;
  next();
};
