import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const SCIENCE: CategoryDeck = {
  id: 'science',
  nameAr: 'علوم',
  nameEn: 'Science',
  tier: 'free',
  level: 'family',
  region: 'global',
  tiles: makeTiles('science', [
    ['هالكوكب يلقبونه بالكوكب الأحمر', 'This planet is known as the Red Planet', 'المريخ', 'Mars'],
    ['الغاز اللي يحتاجه الإنسان عشان يتنفس ويعيش', 'The gas humans need to breathe to survive', 'الأكسجين', 'Oxygen'],
    ['العضو اللي يضخ الدم لجميع أنحاء الجسم', 'The organ that pumps blood through the body', 'القلب', 'The heart'],
    ['أكبر كوكب في مجموعتنا الشمسية', 'The largest planet in our solar system', 'المشتري', 'Jupiter'],
    ['الرمز الكيميائي لعنصر الذهب', 'The chemical symbol for the element gold', 'Au', 'Au'],
    ['سرعة الضوء تقريباً بالكيلومتر في الثانية', 'The speed of light, roughly, in kilometres per second', '٣٠٠ ألف كم في الثانية', '300,000 km per second'],
  ]),
};
