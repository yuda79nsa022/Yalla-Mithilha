import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

/**
 * Confidence: moderate. طاش ما طاش and its two leads are a well-known,
 * long-running Saudi Ramadan staple I'm fairly sure of. Tiles 5-6 are safe,
 * true, but generic filler rather than specific trivia about an Omani,
 * Qatari, Bahraini or Emirati show — I don't have confident material there.
 * Replace with real titles from those countries when available.
 */
export const KHALEEJI_SERIES: CategoryDeck = {
  id: 'khaleeji-series',
  nameAr: 'مسلسلات خليجية',
  nameEn: 'Khaleeji Series',
  tier: 'free',
  level: 'family',
  region: 'gulf',
  tiles: makeTiles('khaleeji-series', [
    ['برنامج سعودي كوميدي طويل الأمد كان يُعرض في رمضان ويتناول قضايا اجتماعية بأسلوب فكاهي', 'A long-running Saudi comedy show that aired every Ramadan, tackling social issues through humour', 'طاش ما طاش', 'Tash Ma Tash'],
    ['أحد الفنانين الكوميديين المرتبطين ببرنامج "طاش ما طاش"', 'One of the comedians most associated with "Tash Ma Tash"', 'ناصر القصبي', 'Nasser Al-Qasabi'],
    ['الفنان الكوميدي الثاني اللي شارك ناصر القصبي بطولة "طاش ما طاش"', 'The other comedian who starred alongside Nasser Al-Qasabi in "Tash Ma Tash"', 'عبدالله السدحان', 'Abdullah Al-Sadhan'],
    ['شكل "طاش ما طاش" الأساسي: مقاطع كوميدية قصيرة ومستقلة داخل كل حلقة', 'The format "Tash Ma Tash" was built on: short, self-contained comedic pieces within each episode', 'سكتشات كوميدية', 'Comedy sketches'],
    ['دول مجلس التعاون الخليجي الست اللي تشترك في إنتاج الدراما "الخليجية"', "The six Gulf Cooperation Council countries whose industries co-produce what's called 'Khaleeji' drama", 'الكويت والسعودية والإمارات وقطر والبحرين وعُمان', 'Kuwait, Saudi Arabia, the UAE, Qatar, Bahrain and Oman'],
    ['الشهر اللي تتنافس فيه القنوات الخليجية عادةً بأقوى مواسمها الدرامية الجديدة', 'The month Gulf channels typically compete with their strongest new drama seasons', 'رمضان', 'Ramadan'],
  ]),
};
