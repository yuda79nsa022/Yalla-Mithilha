import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

/**
 * Confidence: mixed. Tiles 1-2 (مدرسة المشاغبين and its lead) are solid.
 * Tiles 3-4 name cast members I recall with only moderate confidence —
 * verify before this ships for real. Tiles 5-6 are safe, true, but
 * intentionally easy/generic filler, not specific trivia — replace them
 * with real named plays once available.
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
    ['ممثل مصري كوميدي شارك في بطولة "مدرسة المشاغبين" مع عادل إمام', 'A comic Egyptian actor who co-starred in "School of Troublemakers" alongside Adel Imam', 'سعيد صالح', 'Saeed Saleh'],
    ['ممثل آخر من فريق بطولة "مدرسة المشاغبين"', 'Another member of the "School of Troublemakers" cast', 'يونس شلبي', 'Younes Shalaby'],
    ['المصطلح العربي للعمل المسرحي الطويل، عكس الاسكتش القصير', 'The Arabic term for a full-length stage play, as opposed to a short sketch', 'مسرحية', 'A "masrahiyya" (stage play)'],
    ['اسم المكان اللي تُعرض فيه المسرحيات', 'The word for the venue where a play is performed', 'مسرح', 'A theatre ("masrah")'],
  ]),
};
