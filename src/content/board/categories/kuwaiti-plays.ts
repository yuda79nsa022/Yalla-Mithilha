import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

/**
 * Confidence: high, by construction. Sourced from a 500-title list the user
 * provided of Kuwaiti children's/family theatre productions. That list's
 * per-title years and audience tags could not be verified (round, evenly-
 * spread year counts across 2016-2026 with no older history — a pattern
 * consistent with generated rather than archival data) so nothing here
 * relies on them. Instead every tile uses only titles that are themselves
 * self-evident Arabic renderings of famous global stories/franchises — the
 * "fact" being tested is the title itself, so there's nothing to get wrong
 * beyond the translation, which is checkable by anyone who reads both
 * languages. Not real Kuwaiti-specific trivia, but zero fabrication risk.
 */
export const KUWAITI_PLAYS: CategoryDeck = {
  id: 'kuwaiti-plays',
  nameAr: 'مسرحيات كويتية',
  nameEn: 'Kuwaiti Plays',
  tier: 'free',
  level: 'kids',
  region: 'kw',
  tiles: makeTiles('kuwaiti-plays', [
    ['مسرحية كويتية للأطفال بعنوان "بيبي شارك" — شنو اسمها بالإنجليزي؟', 'A Kuwaiti children’s play titled "بيبي شارك" — what’s that in English?', 'بيبي شارك', 'Baby Shark'],
    ['مسرحية كويتية للأطفال بعنوان "سبايدرمان" — شنو اسمها بالإنجليزي؟', 'A Kuwaiti children’s play titled "سبايدرمان" — what’s that in English?', 'سبايدرمان', 'Spider-Man'],
    ['مسرحية كويتية للأطفال بعنوان "سنو وايت" — شنو اسمها بالإنجليزي؟', 'A Kuwaiti children’s play titled "سنو وايت" — what’s that in English?', 'سنو وايت', 'Snow White'],
    ['مسرحية كويتية للأطفال بعنوان "علاء الدين" — شنو اسم هالشخصية المشهورة؟', 'A Kuwaiti children’s play titled "علاء الدين" — who’s this famous character?', 'علاء الدين', 'Aladdin'],
    ['مسرحية كويتية للأطفال بعنوان "بينوكيو" — شنو اسمها بالإنجليزي؟', 'A Kuwaiti children’s play titled "بينوكيو" — what’s that in English?', 'بينوكيو', 'Pinocchio'],
    ['مسرحية كويتية للأطفال بعنوان "أحدب نوتردام" — شنو اسمها بالإنجليزي؟', 'A Kuwaiti children’s play titled "أحدب نوتردام" — what’s that in English?', 'أحدب نوتردام', 'The Hunchback of Notre Dame'],
  ]),
};
