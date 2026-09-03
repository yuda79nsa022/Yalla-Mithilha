import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

/**
 * Confidence: moderate. Tiles 1 and 4 (درب الزلق، أم هارون) are ones I'm
 * genuinely confident about — أم هارون in particular got real international
 * press coverage (Reuters, BBC) in 2020 for its subject matter, independent
 * of any list. Tiles 2-3 name two performers I believe are real, celebrated
 * figures in Kuwaiti theatre and TV, but I'm not confident about the
 * specific credits attached to them here. Tiles 5-6 are safe, true, generic
 * filler, not specific show trivia. This is still the thinnest of the
 * "real" categories — treat it as needing a native Kuwaiti's review before
 * it ships for real.
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
    ['مسلسل كويتي من إنتاج ٢٠٢٠ أثار اهتماماً إعلامياً دولياً لأنه يتناول قصة قابلة يهودية في الكويت القديمة', 'A 2020 Kuwaiti-produced series that drew international media attention for its story of a Jewish midwife in old Kuwait', 'أم هارون', 'Umm Haroun'],
    ['الشهر اللي تعرض فيه القنوات الخليجية عادةً أكبر مواسمها الدرامية الجديدة', 'The month Gulf channels traditionally premiere their biggest new drama season', 'رمضان', 'Ramadan'],
    ['الكلمة الكويتية للحي أو الحارة السكنية القديمة، اللي كثير من الدراما الكلاسيكية تصوّر الحياة فيها', 'The Kuwaiti word for the old residential neighbourhood, the setting much classic drama portrays life in', 'الفريج', 'Al-Freej (the old neighbourhood)'],
  ]),
};
