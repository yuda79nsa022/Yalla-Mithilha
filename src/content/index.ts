import type { MiniGameId, Prompt, RoomId } from '../engine/types';
import { ACT_PROMPTS } from './prompts/act';
import { TABOO_PROMPTS } from './prompts/taboo';
import { WHO_PROMPTS } from './prompts/who';
import { IMITATE_PROMPTS } from './prompts/imitate';
import { LIPS_PROMPTS, SOUND_PROMPTS } from './prompts/lips-sound';
import { FINAL_PROMPTS } from './prompts/final';

/**
 * The whole shipped deck. A future admin dashboard would produce files with
 * exactly this shape and drop them in `prompts/`, then add one import here —
 * nothing else in the app needs to change.
 */
export const ALL_PROMPTS: Prompt[] = [
  ...ACT_PROMPTS,
  ...TABOO_PROMPTS,
  ...WHO_PROMPTS,
  ...IMITATE_PROMPTS,
  ...LIPS_PROMPTS,
  ...SOUND_PROMPTS,
  ...FINAL_PROMPTS,
];

export function promptsByGame(prompts: Prompt[] = ALL_PROMPTS): Record<MiniGameId, Prompt[]> {
  const out = {} as Record<MiniGameId, Prompt[]>;
  for (const p of prompts) {
    (out[p.game] ??= []).push(p);
  }
  return out;
}

export function getPromptById(id: string, prompts: Prompt[] = ALL_PROMPTS): Prompt | undefined {
  return prompts.find((p) => p.id === id);
}

export interface ContentIssue {
  promptId: string;
  problem: string;
}

/**
 * Authoring guard rails. Run by `npm test` so a bad content edit fails CI
 * rather than shipping an empty round to a living room full of people.
 */
export function validateContent(prompts: Prompt[] = ALL_PROMPTS): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const seen = new Set<string>();
  const seenAr = new Map<string, string>();
  const seenEn = new Map<string, string>();

  for (const p of prompts) {
    if (seen.has(p.id)) issues.push({ promptId: p.id, problem: 'duplicate id' });
    seen.add(p.id);

    if (!p.ar.trim()) issues.push({ promptId: p.id, problem: 'empty Arabic text' });
    if (!p.en.trim()) issues.push({ promptId: p.id, problem: 'empty English text' });
    if (!p.rooms.length) issues.push({ promptId: p.id, problem: 'no rooms' });
    if (p.rooms.includes('mixed')) {
      issues.push({
        promptId: p.id,
        problem: '"mixed" is a session mode, not a tag — remove it',
      });
    }

    const arKey = p.game + '|' + p.ar.trim();
    const enKey = p.game + '|' + p.en.trim().toLowerCase();
    if (seenAr.has(arKey)) {
      issues.push({ promptId: p.id, problem: `Arabic duplicates ${seenAr.get(arKey)}` });
    }
    if (seenEn.has(enKey)) {
      issues.push({ promptId: p.id, problem: `English duplicates ${seenEn.get(enKey)}` });
    }
    seenAr.set(arKey, p.id);
    seenEn.set(enKey, p.id);

    if (p.game === 'taboo') {
      const ar = p.forbiddenAr ?? [];
      const en = p.forbiddenEn ?? [];
      if (ar.length < 3 || ar.length > 5) {
        issues.push({ promptId: p.id, problem: 'needs 3–5 Arabic forbidden words' });
      }
      if (en.length < 3 || en.length > 5) {
        issues.push({ promptId: p.id, problem: 'needs 3–5 English forbidden words' });
      }
      if (ar.some((w) => w.trim() === p.ar.trim())) {
        issues.push({ promptId: p.id, problem: 'forbidden word repeats the target word' });
      }
    } else if (p.forbiddenAr || p.forbiddenEn) {
      issues.push({ promptId: p.id, problem: 'forbidden words only apply to taboo' });
    }
  }

  return issues;
}

/** Rooms with at least one enabled prompt for each of these mini-games. */
export function roomCoverage(prompts: Prompt[] = ALL_PROMPTS): Record<RoomId, number> {
  const out = {} as Record<RoomId, number>;
  for (const p of prompts) {
    if (!p.enabled) continue;
    for (const r of p.rooms) out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}
