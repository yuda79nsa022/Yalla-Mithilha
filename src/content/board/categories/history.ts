import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const HISTORY: CategoryDeck = {
  id: 'history',
  nameAr: 'تاريخ',
  nameEn: 'History',
  tier: 'free',
  level: 'family',
  region: 'gulf',
  tiles: makeTiles('history', [
    ['هالدولة كانت أول دولة توحد الجزيرة العربية تحت حكم واحد', 'This kingdom first unified most of the Arabian Peninsula', 'المملكة العربية السعودية', 'Saudi Arabia'],
    ['بنى هالسور المشهور حول مدينة الكويت قبل ما توسعت المدينة', 'This wall once encircled Kuwait City before the city outgrew it', 'سور الكويت الثالث', 'The Third Wall of Kuwait'],
    ['سنة استقلال الكويت عن الحماية البريطانية', 'The year Kuwait gained independence from British protection', '١٩٦١', '1961'],
    ['أول رئيس لجمهورية مصر العربية', 'The first president of the Republic of Egypt', 'محمد نجيب', 'Muhammad Naguib'],
    ['الإمبراطورية اللي حكمت أغلب الخليج العربي لقرون قبل الدول الحديثة', 'The empire that ruled much of the Gulf coast for centuries before modern states', 'الإمبراطورية العثمانية', 'The Ottoman Empire'],
    ['سنة اكتشاف النفط بكميات تجارية في الكويت', 'The year oil was discovered in commercial quantities in Kuwait', '١٩٣٨', '1938'],
  ]),
};
