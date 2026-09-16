import type { Lang } from './types';

export class ValidationError extends Error {}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`"${field}" is required and must be a non-empty string`);
  }
  return value;
}

/** Defaults to 'ar' when omitted — every deck/session predating this field really is Arabic. */
function optionalLang(value: unknown, field: string): Lang {
  if (value === undefined) return 'ar';
  if (value !== 'ar' && value !== 'en') {
    throw new ValidationError(`"${field}" must be "ar" or "en"`);
  }
  return value;
}

/** Omitted entirely means "every playable deck" — deals with old callers (tests, scripts) that predate per-deck selection. Present, it must actually name at least one deck. */
function optionalDeckIds(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === 'string' && v.trim())) {
    throw new ValidationError(`"${field}" must be a non-empty array of deck ids`);
  }
  return value;
}

/** A deck id used as a URL segment and a SQLite primary key: lowercase, digits, hyphens only. */
function requireDeckId(value: unknown): string {
  const id = requireString(value, 'id');
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new ValidationError('"id" may only contain lowercase letters, digits and hyphens');
  }
  return id;
}

export interface CreateDeckBody {
  id: string;
  nameAr: string;
  nameEn: string;
  language: Lang;
}

export function parseCreateDeckBody(body: unknown): CreateDeckBody {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    id: requireDeckId(b.id),
    nameAr: requireString(b.nameAr, 'nameAr'),
    nameEn: requireString(b.nameEn, 'nameEn'),
    language: optionalLang(b.language, 'language'),
  };
}

export interface UpdateDeckBody {
  nameAr?: string;
  nameEn?: string;
  language?: Lang;
}

export function parseUpdateDeckBody(body: unknown): UpdateDeckBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: UpdateDeckBody = {};
  if (b.nameAr !== undefined) out.nameAr = requireString(b.nameAr, 'nameAr');
  if (b.nameEn !== undefined) out.nameEn = requireString(b.nameEn, 'nameEn');
  if (b.language !== undefined) out.language = optionalLang(b.language, 'language');
  return out;
}

export interface ImportTitlesBody {
  titles: string[];
}

/** A parsed docx/xlsx/pdf title list, added to a deck directly — no fixed slot count to stage against, unlike the old board-game import. */
export function parseImportTitlesBody(body: unknown): ImportTitlesBody {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(b.titles) || !b.titles.every((t) => typeof t === 'string')) {
    throw new ValidationError('"titles" must be an array of strings');
  }
  if (b.titles.length > 2000) {
    throw new ValidationError('"titles" has too many entries');
  }
  return { titles: b.titles };
}

export interface SetGamePriceBody {
  fils: number;
}

/** 1000 fils = 1 KD. Capped well above any plausible real price, just to reject fat-fingered input like accidentally adding an extra zero. */
export function parseSetGamePriceBody(body: unknown): SetGamePriceBody {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.fils !== 'number' || !Number.isInteger(b.fils) || b.fils <= 0 || b.fils > 100_000) {
    throw new ValidationError('"fils" must be a positive integer, at most 100000 (100 KD)');
  }
  return { fils: b.fils };
}

export interface CreateAdminUserBody {
  username: string;
  password: string;
}

function requireUsername(value: unknown): string {
  const username = requireString(value, 'username');
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
    throw new ValidationError('"username" must be 3-40 characters: letters, digits, ".", "_" or "-"');
  }
  return username;
}

function requirePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8) {
    throw new ValidationError('"password" must be a string of at least 8 characters');
  }
  return value;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Optional everywhere it's used — omitted, `null`, or an empty string all mean "no email given." */
function optionalEmail(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 254 || !EMAIL_PATTERN.test(value)) {
    throw new ValidationError(`"${field}" must be a valid email address`);
  }
  return value;
}

/** The 6-digit code a reset email contains — always exactly 6 digits, never trimmed/coerced, so a malformed value fails validation instead of silently mismatching every stored hash. */
function requireResetCode(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{6}$/.test(value)) {
    throw new ValidationError('"code" must be the 6-digit reset code');
  }
  return value;
}

export function parseCreateAdminUserBody(body: unknown): CreateAdminUserBody {
  const b = (body ?? {}) as Record<string, unknown>;
  return { username: requireUsername(b.username), password: requirePassword(b.password) };
}

export interface UpdateAdminUserBody {
  username?: string;
  password?: string;
}

export function parseUpdateAdminUserBody(body: unknown): UpdateAdminUserBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: UpdateAdminUserBody = {};
  if (b.username !== undefined) out.username = requireUsername(b.username);
  if (b.password !== undefined) out.password = requirePassword(b.password);
  return out;
}

export interface RegisterPlayerBody {
  username: string;
  password: string;
  /** Optional at signup — without one, this account has no forgot-password channel until it's added later. */
  email?: string;
}

export function parseRegisterPlayerBody(body: unknown): RegisterPlayerBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = optionalEmail(b.email, 'email');
  return {
    username: requireUsername(b.username),
    password: requirePassword(b.password),
    ...(email !== undefined ? { email } : {}),
  };
}

export interface UpdatePlayerBody {
  username?: string;
  password?: string;
  /** `null` explicitly clears the email; omitted leaves it as-is. */
  email?: string | null;
}

export function parseUpdatePlayerBody(body: unknown): UpdatePlayerBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: UpdatePlayerBody = {};
  if (b.username !== undefined) out.username = requireUsername(b.username);
  if (b.password !== undefined) out.password = requirePassword(b.password);
  if (b.email === null) {
    out.email = null;
  } else if (b.email !== undefined) {
    out.email = optionalEmail(b.email, 'email');
  }
  return out;
}

export interface RequestPasswordResetBody {
  username: string;
}

/** Only a username — never reveals whether it matched an account, so validation alone can't leak that either. */
export function parseRequestPasswordResetBody(body: unknown): RequestPasswordResetBody {
  const b = (body ?? {}) as Record<string, unknown>;
  return { username: requireUsername(b.username) };
}

export interface ConfirmPasswordResetBody {
  username: string;
  code: string;
  newPassword: string;
}

export function parseConfirmPasswordResetBody(body: unknown): ConfirmPasswordResetBody {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    username: requireUsername(b.username),
    code: requireResetCode(b.code),
    newPassword: requirePassword(b.newPassword),
  };
}

export interface StartSessionBody {
  sessionId: string;
  deckIds?: string[];
}

/**
 * `sessionId` is the client's own locally generated id — used verbatim as
 * the server-side game_sessions row id. `deckIds` names which decks the
 * session deals from (see `startGameSession`) — the player's own explicit
 * choice made alongside the team names, entirely separate from the app's
 * own UI language.
 */
export function parseStartSessionBody(body: unknown): StartSessionBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const sessionId = requireString(b.sessionId, 'sessionId');
  if (sessionId.length > 200) throw new ValidationError('"sessionId" is too long');
  return { sessionId, deckIds: optionalDeckIds(b.deckIds, 'deckIds') };
}

export interface UpdateHomeContentBody {
  taglineAr?: string;
  taglineEn?: string;
  writeupAr?: string;
  writeupEn?: string;
}

const MAX_TAGLINE_LENGTH = 200;
const MAX_WRITEUP_LENGTH = 2000;

function optionalBoundedString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  const str = requireString(value, field);
  if (str.length > maxLength) throw new ValidationError(`"${field}" is too long (max ${maxLength} characters)`);
  return str;
}

export function parseUpdateHomeContentBody(body: unknown): UpdateHomeContentBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: UpdateHomeContentBody = {};
  const taglineAr = optionalBoundedString(b.taglineAr, 'taglineAr', MAX_TAGLINE_LENGTH);
  if (taglineAr !== undefined) out.taglineAr = taglineAr;
  const taglineEn = optionalBoundedString(b.taglineEn, 'taglineEn', MAX_TAGLINE_LENGTH);
  if (taglineEn !== undefined) out.taglineEn = taglineEn;
  const writeupAr = optionalBoundedString(b.writeupAr, 'writeupAr', MAX_WRITEUP_LENGTH);
  if (writeupAr !== undefined) out.writeupAr = writeupAr;
  const writeupEn = optionalBoundedString(b.writeupEn, 'writeupEn', MAX_WRITEUP_LENGTH);
  if (writeupEn !== undefined) out.writeupEn = writeupEn;
  return out;
}

