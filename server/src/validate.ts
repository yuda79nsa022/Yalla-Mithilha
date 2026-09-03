import type { CategoryStatus, ContentLevel, MediaType, ProductId, RegionTag, ReportReason, Tier } from './types';

const TIERS: Tier[] = ['free', 'paid'];
const LEVELS: ContentLevel[] = ['kids', 'family', 'friends', 'adults'];
const REGIONS: RegionTag[] = ['kw', 'gulf', 'egypt', 'global'];
const MEDIA_TYPES: MediaType[] = ['text', 'image', 'audio', 'reorder', 'dotless'];
const PRODUCT_IDS: ProductId[] = ['single', 'bundle2'];
const CATEGORY_STATUSES: CategoryStatus[] = ['draft', 'published', 'archived'];
const REPORT_REASONS: ReportReason[] = ['unclear', 'translation', 'not_funny', 'inappropriate', 'too_hard', 'duplicate'];

export class ValidationError extends Error {}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`"${field}" is required and must be a non-empty string`);
  }
  return value;
}

/** A category id used as a URL segment and a SQLite primary key: lowercase, digits, hyphens only. */
function requireCategoryId(value: unknown): string {
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

export interface CreateCategoryBody {
  id: string;
  nameAr: string;
  nameEn: string;
  tier: Tier;
  level: ContentLevel;
  region: RegionTag;
}

export function parseCreateCategoryBody(body: unknown): CreateCategoryBody {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    id: requireCategoryId(b.id),
    nameAr: requireString(b.nameAr, 'nameAr'),
    nameEn: requireString(b.nameEn, 'nameEn'),
    tier: requireEnum(b.tier, 'tier', TIERS),
    level: requireEnum(b.level, 'level', LEVELS),
    region: requireEnum(b.region, 'region', REGIONS),
  };
}

export interface UpdateCategoryBody {
  nameAr?: string;
  nameEn?: string;
  tier?: Tier;
  level?: ContentLevel;
  region?: RegionTag;
}

export function parseUpdateCategoryBody(body: unknown): UpdateCategoryBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: UpdateCategoryBody = {};
  if (b.nameAr !== undefined) out.nameAr = requireString(b.nameAr, 'nameAr');
  if (b.nameEn !== undefined) out.nameEn = requireString(b.nameEn, 'nameEn');
  if (b.tier !== undefined) out.tier = requireEnum(b.tier, 'tier', TIERS);
  if (b.level !== undefined) out.level = requireEnum(b.level, 'level', LEVELS);
  if (b.region !== undefined) out.region = requireEnum(b.region, 'region', REGIONS);
  return out;
}

export interface SetCategoryStatusBody {
  status: CategoryStatus;
}

export function parseSetCategoryStatusBody(body: unknown): SetCategoryStatusBody {
  const b = (body ?? {}) as Record<string, unknown>;
  return { status: requireEnum(b.status, 'status', CATEGORY_STATUSES) };
}

export interface ImportCommitBody {
  titles: string[];
}

/** The exact title list a prior /import/preview call proposed, sent back once an admin confirms it. */
export function parseImportCommitBody(body: unknown): ImportCommitBody {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(b.titles) || !b.titles.every((t) => typeof t === 'string')) {
    throw new ValidationError('"titles" must be an array of strings');
  }
  if (b.titles.length > 2000) {
    throw new ValidationError('"titles" has too many entries');
  }
  return { titles: b.titles };
}

export interface UpdateTileBody {
  promptAr?: string;
  promptEn?: string;
  answerAr?: string;
  answerEn?: string;
  mediaType?: MediaType;
  mediaUrl?: string | null;
  reorderItems?: string[] | null;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new ValidationError(`"${field}" must be a string`);
  return value;
}

export function parseUpdateTileBody(body: unknown): UpdateTileBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: UpdateTileBody = {};
  const promptAr = optionalString(b.promptAr, 'promptAr');
  if (promptAr !== undefined) out.promptAr = promptAr;
  const promptEn = optionalString(b.promptEn, 'promptEn');
  if (promptEn !== undefined) out.promptEn = promptEn;
  const answerAr = optionalString(b.answerAr, 'answerAr');
  if (answerAr !== undefined) out.answerAr = answerAr;
  const answerEn = optionalString(b.answerEn, 'answerEn');
  if (answerEn !== undefined) out.answerEn = answerEn;
  if (b.mediaType !== undefined) out.mediaType = requireEnum(b.mediaType, 'mediaType', MEDIA_TYPES);
  if (b.mediaUrl !== undefined) {
    if (b.mediaUrl !== null && typeof b.mediaUrl !== 'string') {
      throw new ValidationError('"mediaUrl" must be a string or null');
    }
    out.mediaUrl = b.mediaUrl as string | null;
  }
  if (b.reorderItems !== undefined) {
    if (b.reorderItems !== null && !Array.isArray(b.reorderItems)) {
      throw new ValidationError('"reorderItems" must be an array or null');
    }
    out.reorderItems = b.reorderItems as string[] | null;
  }
  return out;
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

export interface CreateCheckoutBody {
  product: ProductId;
}

export function parseCreateCheckoutBody(body: unknown): CreateCheckoutBody {
  const b = (body ?? {}) as Record<string, unknown>;
  return { product: requireEnum(b.product, 'product', PRODUCT_IDS) };
}

export interface ConsumeCreditBody {
  boardGameId: string;
}

/** The client's own local BoardState.id — used verbatim as the server-side board_games row id. */
export function parseConsumeCreditBody(body: unknown): ConsumeCreditBody {
  const b = (body ?? {}) as Record<string, unknown>;
  const boardGameId = requireString(b.boardGameId, 'boardGameId');
  if (boardGameId.length > 200) {
    throw new ValidationError('"boardGameId" is too long');
  }
  return { boardGameId };
}

/** Tile index comes from a URL segment, e.g. /categories/:id/tiles/:index. */
export function parseTileIndex(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 5) {
    throw new ValidationError('tile index must be an integer between 0 and 5');
  }
  return n;
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
