import type { ReportReason } from './types';

const REPORT_REASONS: ReportReason[] = ['unclear', 'translation', 'not_funny', 'inappropriate', 'too_hard', 'duplicate'];

export class ValidationError extends Error {}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`"${field}" is required and must be a non-empty string`);
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

function requireEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ValidationError(`"${field}" must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export interface CreateDeckBody {
  id: string;
  nameAr: string;
  nameEn: string;
}

export function parseCreateDeckBody(body: unknown): CreateDeckBody {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    id: requireDeckId(b.id),
    nameAr: requireString(b.nameAr, 'nameAr'),
    nameEn: requireString(b.nameEn, 'nameEn'),
  };
}

export interface UpdateDeckBody {
  nameAr?: string;
  nameEn?: string;
}

export function parseUpdateDeckBody(body: unknown): UpdateDeckBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: UpdateDeckBody = {};
  if (b.nameAr !== undefined) out.nameAr = requireString(b.nameAr, 'nameAr');
  if (b.nameEn !== undefined) out.nameEn = requireString(b.nameEn, 'nameEn');
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
}

export function parseRegisterPlayerBody(body: unknown): RegisterPlayerBody {
  const b = (body ?? {}) as Record<string, unknown>;
  return { username: requireUsername(b.username), password: requirePassword(b.password) };
}

export interface UpdatePlayerBody {
  username?: string;
  password?: string;
}

export function parseUpdatePlayerBody(body: unknown): UpdatePlayerBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: UpdatePlayerBody = {};
  if (b.username !== undefined) out.username = requireUsername(b.username);
  if (b.password !== undefined) out.password = requirePassword(b.password);
  return out;
}

export interface StartSessionBody {
  sessionId: string;
  deckId: string;
}

/** `sessionId` is the client's own locally generated id — used verbatim as the server-side game_sessions row id. */
export function parseStartSessionBody(body: unknown): StartSessionBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const sessionId = requireString(b.sessionId, 'sessionId');
  if (sessionId.length > 200) throw new ValidationError('"sessionId" is too long');
  const deckId = requireString(b.deckId, 'deckId');
  if (deckId.length > 200) throw new ValidationError('"deckId" is too long');
  return { sessionId, deckId };
}

export interface SubmitReportItem {
  id: string;
  promptId: string;
  reason: ReportReason;
  lang: string;
  createdAt: number;
  appVersion?: string;
}

export interface SubmitReportsBody {
  reports: SubmitReportItem[];
}

const MAX_REPORTS_PER_BATCH = 50;

function parseOneReport(value: unknown, index: number): SubmitReportItem {
  const r = (value ?? {}) as Record<string, unknown>;
  const id = requireString(r.id, `reports[${index}].id`);
  if (id.length > 100) throw new ValidationError(`reports[${index}].id is too long`);
  const promptId = requireString(r.promptId, `reports[${index}].promptId`);
  if (promptId.length > 200) throw new ValidationError(`reports[${index}].promptId is too long`);
  const reason = requireEnum(r.reason, `reports[${index}].reason`, REPORT_REASONS);
  const lang = requireString(r.lang, `reports[${index}].lang`);
  if (typeof r.createdAt !== 'number' || !Number.isFinite(r.createdAt)) {
    throw new ValidationError(`reports[${index}].createdAt must be a number`);
  }
  const appVersion = r.appVersion !== undefined ? requireString(r.appVersion, `reports[${index}].appVersion`) : undefined;
  return { id, promptId, reason, lang, createdAt: r.createdAt, appVersion };
}

/** The app's offline report queue, synced as a batch — capped so one request can't be used to flood the table. */
export function parseSubmitReportsBody(body: unknown): SubmitReportsBody {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(b.reports) || b.reports.length === 0) {
    throw new ValidationError('"reports" must be a non-empty array');
  }
  if (b.reports.length > MAX_REPORTS_PER_BATCH) {
    throw new ValidationError(`"reports" has too many entries (max ${MAX_REPORTS_PER_BATCH} per batch)`);
  }
  return { reports: b.reports.map((r, i) => parseOneReport(r, i)) };
}

const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;

export interface SetReportStatusBody {
  status: (typeof REPORT_STATUSES)[number];
}

export function parseSetReportStatusBody(body: unknown): SetReportStatusBody {
  const b = (body ?? {}) as Record<string, unknown>;
  return { status: requireEnum(b.status, 'status', REPORT_STATUSES) };
}
