import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

/**
 * Confidence: moderate. طاش ما طاش and its two leads are a well-known,
 * long-running Saudi Ramadan staple I'm fairly sure of — and notably absent
 * from the 500-title Khaleeji series list the user later provided, whose
 * Saudi portion is entirely 2024-2026 with no older titles at all (a real
 * gap, not just narrowness — it also excludes العاصوف, one of the most
 * acclaimed recent Saudi series). Tiles 5-6 replace generic filler with two
 * entries from that list's older Omani/Qatari tail that I can corroborate
 * independently: أحمد بن ماجد (a real 15th-century Arab navigator) and
 * ذي قار (a real pre-Islamic Arab battle) — not just "found in the list."
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
    ['مسلسل عُماني تاريخي قديم يحمل اسم ملاح عربي شهير من القرن الخامس عشر اشتهر بمعرفته بطرق الملاحة البحرية', 'An old Omani historical series named after a famous 15th-century Arab navigator known for his knowledge of sea routes', 'أحمد بن ماجد', 'Ahmad Ibn Majid'],
    ['مسلسل قطري تاريخي بعنوان "ذي قار: يوم من أيام العرب" — عن أي معركة عربية قديمة قبل الإسلام؟', 'A Qatari historical series titled "Dhi Qar: A Day Among the Days of the Arabs" — about which ancient pre-Islamic Arab battle?', 'معركة ذي قار', 'The Battle of Dhi Qar'],
  ]),
};
