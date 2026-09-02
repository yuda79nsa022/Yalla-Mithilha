import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

/**
 * Confidence: high. Tiles 1-2 (مدرسة المشاغبين and its lead) were already
 * solid. Tiles 3-6 replace two earlier cast-member guesses I was never
 * fully sure of, sourced instead from a 500-title Egyptian plays list the
 * user provided — a list with a named, real source (elcinema.com) and a
 * genuinely irregular year distribution across 33 years, unlike the two
 * earlier lists that didn't hold up. Every title used here is one I can
 * independently corroborate against something I actually know (Hamlet,
 * the pre-Islamic Arab epic of Al-Zeer Salem, Taha Hussein's novel, My
 * Fair Lady), so the risk is limited to the same kind of title-recognition
 * check as kuwaiti-plays.ts, not a blind trust of the source list.
 */
export const EGYPTIAN_PLAYS: CategoryDeck = {
  id: 'egyptian-plays',
  nameAr: 'مسرحيات مصرية',
  nameEn: 'Egyptian Plays',
  tier: 'free',
  level: 'family',
  region: 'egypt',
  tiles: makeTiles('egyptian-plays', [
    ['المسرحية المصرية الشهيرة من سنة ١٩٧٣ عن طلاب مشاغبين، من أكثر الأعمال اللي يُستشهد بجملها لليوم', 'The famous 1973 Egyptian stage play about a class of troublemaking students, still widely quoted today', 'مدرسة المشاغبين', 'School of Troublemakers (Madrasat Al-Moshaghbeen)'],
    ['بطل مسرحية "مدرسة المشاغبين"', 'The lead actor of "School of Troublemakers"', 'عادل إمام', 'Adel Imam'],
    ['مسرحية مصرية بعنوان "هاملت" — مقتبسة عن مسرحية لأي كاتب مسرحي إنجليزي شهير؟', 'An Egyptian play titled "هاملت" — adapted from a work by which famous English playwright?', 'هاملت لشكسبير', 'Shakespeare\'s "Hamlet"'],
    ['مسرحية مصرية بعنوان "سيدتي الجميلة" — شنو اسم هالمسرحية الغنائية الشهيرة بالإنجليزي؟', 'An Egyptian play titled "سيدتي الجميلة" — what’s that famous musical called in English?', 'سيدتي الجميلة', 'My Fair Lady'],
    ['مسرحية مصرية بعنوان "الزير سالم" — عن أي بطل عربي أسطوري من الشعر الجاهلي؟', 'An Egyptian play titled "الزير سالم" — about which legendary pre-Islamic Arab folk hero?', 'الزير سالم (المهلهل بن ربيعة)', 'Al-Zeer Salem, the pre-Islamic Arab folk hero'],
    ['مسرحية مصرية بعنوان "دعاء الكروان" — مقتبسة عن رواية شهيرة لأي كاتب مصري كبير؟', 'An Egyptian play titled "دعاء الكروان" (The Nightingale\'s Prayer) — adapted from a famous novel by which major Egyptian writer?', 'طه حسين', 'Taha Hussein'],
  ]),
};
