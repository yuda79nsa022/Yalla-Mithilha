import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

/**
 * Confidence: high. Well-documented internationally (Omar Sharif's Hollywood
 * career, Adel Imam's nickname, Egyptian cinema's regional reputation) — the
 * strongest-sourced of the entertainment categories. Tiles 5-6 are still
 * worth a native speaker's once-over before this ships for real.
 */
export const EGYPTIAN_MOVIES: CategoryDeck = {
  id: 'egyptian-movies',
  nameAr: 'أفلام مصرية',
  nameEn: 'Egyptian Movies',
  tier: 'free',
  level: 'family',
  region: 'egypt',
  tiles: makeTiles('egyptian-movies', [
    ['الممثل المصري اللي مثّل مع بيتر أوتول في فيلم "لورنس العرب" سنة ١٩٦٢', 'The Egyptian actor who starred opposite Peter O’Toole in the 1962 epic "Lawrence of Arabia"', 'عمر الشريف', 'Omar Sharif'],
    ['اللقب اللي يعرفونه فيه الجمهور المصري للفنان عادل إمام', "The nickname Egyptian audiences know actor Adel Imam by", 'الزعيم', '"Al-Zaeem" (The Leader)'],
    ['فيلم "دكتور جيفاغو" الأمريكي اللي مثّل بطولته عمر الشريف مع جولي كريستي', 'The film "Doctor Zhivago", in which Omar Sharif starred opposite Julie Christie', 'دكتور جيفاغو', 'Doctor Zhivago'],
    ['اللقب اللي تُعرف فيه صناعة السينما المصرية في المنطقة العربية', "The nickname Egypt's film industry is known by across the Arab world", 'هوليوود الشرق', '"Hollywood of the East"'],
    ['الاسم الأصلي لعمر الشريف قبل ما يتخذ اسمه الفني', 'Omar Sharif’s birth name before he adopted his stage name', 'ميشيل ديمتري شلهوب', 'Michel Demitri Chalhoub'],
    ['اللقب اللي عُرفت فيه الفنانة المصرية فاتن حمامة كنجمة كبيرة في سينما الخمسينات والستينات', 'The nickname Egyptian actress Faten Hamama earned as a leading star of 1950s-60s cinema', 'سيدة الشاشة العربية', '"Lady of the Arab Screen"'],
  ]),
};
