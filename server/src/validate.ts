import type { ContentLevel, MediaType, RegionTag, Tier } from './types';

const TIERS: Tier[] = ['free', 'paid'];
const LEVELS: ContentLevel[] = ['kids', 'family', 'friends', 'adults'];
const REGIONS: RegionTag[] = ['kw', 'gulf', 'egypt', 'global'];
const MEDIA_TYPES: MediaType[] = ['text', 'image', 'audio', 'reorder', 'dotless'];

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

/** Tile index comes from a URL segment, e.g. /categories/:id/tiles/:index. */
export function parseTileIndex(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 5) {
    throw new ValidationError('tile index must be an integer between 0 and 5');
  }
  return n;
}
