import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';

const SESSION_SECRET = process.env.SESSION_SECRET;
const PLAYER_SESSION_SECRET = process.env.PLAYER_SESSION_SECRET;
const TOKEN_TTL = '12h';
const BCRYPT_ROUNDS = 10;

export interface SessionPayload {
  sub: string; // admin user id
  username: string;
}

export interface PlayerSessionPayload {
  sub: string; // player id
  username: string;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSessionToken(payload: SessionPayload): string {
  if (!SESSION_SECRET) throw new Error('SESSION_SECRET is not configured');
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: TOKEN_TTL });
}

function verifySessionToken(token: string): SessionPayload | null {
  if (!SESSION_SECRET) return null;
  try {
    return jwt.verify(token, SESSION_SECRET) as SessionPayload;
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
  return jwt.sign(payload, PLAYER_SESSION_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyPlayerSessionToken(token: string): PlayerSessionPayload | null {
  if (!PLAYER_SESSION_SECRET) return null;
  try {
    return jwt.verify(token, PLAYER_SESSION_SECRET) as PlayerSessionPayload;
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
