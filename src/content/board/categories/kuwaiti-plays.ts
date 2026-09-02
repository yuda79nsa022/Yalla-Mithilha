import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

/**
 * Confidence: LOW. I do not have confident knowledge of specific named
 * Kuwaiti stage plays, so this file leans on the two performers from
 * kuwaiti-series.ts (who I believe are genuinely associated with Kuwaiti
 * theatre specifically, not just TV) plus safe, generic, true theatre-
 * culture facts. Nothing here is fabricated, but this is the category
 * that most needs real content from someone who actually knows Kuwaiti
 * theatre — see the chat summary.
 */
export const KUWAITI_PLAYS: CategoryDeck = {
  id: 'kuwaiti-plays',
  nameAr: 'مسرحيات كويتية',
  nameEn: 'Kuwaiti Plays',
  tier: 'free',
  level: 'family',
  region: 'kw',
  tiles: makeTiles('kuwaiti-plays', [
    ['فنان كويتي كبير، من أشهر نجوم المسرح الكويتي على مدى عقود', 'A major Kuwaiti performer, one of the most celebrated stars of Kuwaiti stage theatre for decades', 'عبدالحسين عبدالرضا', 'Abdulhussain Abdulredha'],
    ['فنانة كويتية كبيرة، من أشهر نجمات المسرح الكويتي', 'A major Kuwaiti performer, one of the most celebrated stars of Kuwaiti stage theatre', 'سعاد عبدالله', 'Suad Abdullah'],
    ['الكلمة العربية للعمل المسرحي', 'The Arabic word for a stage play', 'مسرحية', 'A "masrahiyya" (stage play)'],
    ['اسم المكان اللي تُعرض فيه المسرحيات أمام جمهور حي', 'The word for the venue where a play is performed in front of a live audience', 'مسرح', 'A theatre ("masrah")'],
    ['نوع الفن اللي يُؤدى مباشرة أمام جمهور حاضر، بعكس التلفزيون أو السينما', 'The form of performance done live in front of a present audience, unlike television or film', 'المسرح', 'Live theatre'],
    ['المصطلح العربي لتصفيق الجمهور بعد نهاية العرض المسرحي', 'The Arabic term for the audience applauding at the end of a stage performance', 'تصفيق', 'Applause'],
  ]),
};
