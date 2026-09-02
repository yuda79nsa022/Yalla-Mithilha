import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

/**
 * Confidence: mixed-moderate. Tiles 1 and 3 (the two show titles) are
 * well-known classics I'm fairly sure of. Tiles 2, 4 and 6 (specific cast
 * and plot details) are recalled with only moderate confidence — verify
 * before this ships for real.
 */
export const EGYPTIAN_SERIES: CategoryDeck = {
  id: 'egyptian-series',
  nameAr: 'مسلسلات مصرية',
  nameEn: 'Egyptian Series',
  tier: 'free',
  level: 'family',
  region: 'egypt',
  tiles: makeTiles('egyptian-series', [
    ['مسلسل مصري كلاسيكي مبني على قصة حقيقية لضابط مخابرات مصري تسلل لإسرائيل', 'A classic Egyptian drama series based on the true story of an Egyptian intelligence officer who infiltrated Israel', 'رأفت الهجان', 'Raafat El-Haggan'],
    ['الممثل اللي أدى دور البطولة في مسلسل "رأفت الهجان"', 'The lead actor who played the title role in "Raafat El-Haggan"', 'محمود عبد العزيز', 'Mahmoud Abdel Aziz'],
    ['المسلسل المصري الكلاسيكي اللي يتابع قصة عائلة عبر أجيال متعددة، من أهم الأعمال الدرامية المصرية', 'The classic Egyptian family-saga drama that follows one family across several generations, one of Egyptian TV’s most celebrated productions', 'ليالي الحلمية', 'Layali El Helmeya'],
    ['ممثل مصري مرتبط بشكل كبير بمسلسل "ليالي الحلمية"', 'An Egyptian actor closely associated with "Layali El Helmeya"', 'يحيى الفخراني', 'Yehia El-Fakharany'],
    ['الشهر اللي تُعرض فيه عادةً أكبر المسلسلات المصرية الجديدة كل سنة', 'The month in which the biggest new Egyptian series traditionally premiere each year', 'رمضان', 'Ramadan'],
    ['الدولة اللي كان يتجسس عليها بطل "رأفت الهجان" لصالح مصر', 'The country "Raafat El-Haggan" spied on on Egypt’s behalf', 'إسرائيل', 'Israel'],
  ]),
};
