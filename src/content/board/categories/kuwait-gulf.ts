import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const KUWAIT_GULF: CategoryDeck = {
  id: 'kuwait-gulf',
  nameAr: 'الكويت والخليج',
  nameEn: 'Kuwait & Gulf',
  tier: 'free',
  level: 'family',
  region: 'kw',
  tiles: makeTiles('kuwait-gulf', [
    ['العملة الرسمية المستخدمة في الكويت', "Kuwait's official currency", 'الدينار الكويتي', 'The Kuwaiti Dinar'],
    ['المعلم الكويتي المشهور بقبابه الثلاث على شاطئ الخليج', "Kuwait's famous landmark with three domes on the Gulf shore", 'أبراج الكويت', 'Kuwait Towers'],
    ['اليوم اللي تبدأ فيه عطلة نهاية الأسبوع في الكويت', "The day Kuwait's weekend begins", 'الجمعة', 'Friday'],
    ['زهرة الكويت الوطنية، نبتة صحراوية تتحمل الجفاف', "Kuwait's national flower, a hardy desert plant", 'الأرفج', 'Arfaj'],
    ['المسطح المائي اللي يحد الكويت من جهة الشرق', 'The body of water bordering Kuwait to the east', 'الخليج العربي', 'The Arabian Gulf'],
    ['الشهر اللي يصوم فيه المسلمون من الفجر للمغرب', 'The month Muslims fast from dawn to sunset', 'رمضان', 'Ramadan'],
  ]),
};
