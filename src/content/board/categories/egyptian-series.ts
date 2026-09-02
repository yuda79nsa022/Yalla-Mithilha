import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

/**
 * Confidence: mixed-moderate. Tiles 1, 3 and 5 (رأفت الهجان، ليالي الحلمية،
 * الاختيار) are real, well-known series titles I'm fairly sure of. Tiles 2
 * and 4 (specific lead-actor claims) are recalled with only moderate
 * confidence — verify before this ships for real. Tile 6 (Ahmed Mekky as
 * the star of الكبير أوي) is also moderate confidence, added after the
 * user's 500-title Egyptian series list confirmed الاختيار and الكبير أوي
 * are real, ongoing multi-season franchises (both appear with several
 * numbered parts). Note: رأفت الهجان and ليالي الحلمية are NOT in that list
 * — it only covers 2020-2027, and both predate that range, so the list
 * neither confirms nor contradicts those two.
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
    ['مسلسل مصري وطني درامي طويل، وصل لجزئه الثالث، يتناول قصصاً واقعية عن مواجهة الإرهاب', 'A long-running Egyptian patriotic drama, now on its third instalment, dealing with real stories of confronting terrorism', 'الاختيار', 'Al-Ikhtiyar (The Choice)'],
    ['الفنان المصري الكوميدي المعروف ببطولة مسلسل "الكبير أوي" اللي وصل لأجزاء كثيرة', 'The Egyptian comedian known for starring in "El-Kabeer Awi", a comedy series that has run for many seasons', 'أحمد مكي', 'Ahmed Mekky'],
  ]),
};
