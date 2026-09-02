import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

/**
 * Confidence: LOW-MODERATE. This is the thinnest category I drafted. Tile 1
 * (درب الزلق) I'm reasonably sure is real and foundational. Tiles 2-3 name
 * two performers I believe are real, celebrated figures in Kuwaiti theatre
 * and TV, but I am not confident about the specific credits attached to
 * them here. Tiles 4-6 are safe, true, generic filler, not specific show
 * trivia. Treat this whole file as a first draft that needs a native
 * Kuwaiti's review before it ships for real — see the chat summary for
 * exactly what to check.
 */
export const KUWAITI_SERIES: CategoryDeck = {
  id: 'kuwaiti-series',
  nameAr: 'مسلسلات كويتية',
  nameEn: 'Kuwaiti Series',
  tier: 'free',
  level: 'family',
  region: 'kw',
  tiles: makeTiles('kuwaiti-series', [
    ['من أوائل وأهم المسلسلات الكويتية الكلاسيكية، ويُعتبر من الأعمال التأسيسية للدراما الخليجية', 'One of the earliest and most influential classic Kuwaiti drama series, often cited as a foundational work of Khaleeji TV', 'درب الزلق', 'Darb Al-Zalaq'],
    ['فنان كويتي كبير يُعتبر من الركائز المؤسِّسة للمسرح والتلفزيون الكويتي', 'A major Kuwaiti performer regarded as one of the founding pillars of Kuwaiti theatre and television', 'عبدالحسين عبدالرضا', 'Abdulhussain Abdulredha'],
    ['فنانة كويتية كبيرة تُعتبر من الركائز المؤسِّسة للدراما الكويتية', 'A major Kuwaiti performer regarded as one of the founding pillars of Kuwaiti drama', 'سعاد عبدالله', 'Suad Abdullah'],
    ['اللهجة اللي تُؤدى فيها معظم المسلسلات الكويتية', 'The dialect most Kuwaiti drama series are performed in', 'اللهجة الكويتية', 'Kuwaiti dialect'],
    ['الشهر اللي تعرض فيه القنوات الخليجية عادةً أكبر مواسمها الدرامية الجديدة', 'The month Gulf channels traditionally premiere their biggest new drama season', 'رمضان', 'Ramadan'],
    ['الكلمة الكويتية للحي أو الحارة السكنية القديمة، اللي كثير من الدراما الكلاسيكية تصوّر الحياة فيها', 'The Kuwaiti word for the old residential neighbourhood, the setting much classic drama portrays life in', 'الفريج', 'Al-Freej (the old neighbourhood)'],
  ]),
};
