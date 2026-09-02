import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const SPACE: CategoryDeck = {
  id: 'space',
  nameAr: 'فضاء وفلك',
  nameEn: 'Space & Astronomy',
  tier: 'free',
  level: 'family',
  region: 'global',
  tiles: makeTiles('space', [
    ['النجم الموجود في مركز مجموعتنا الشمسية', 'The star at the centre of our solar system', 'الشمس', 'The Sun'],
    ['القمر الطبيعي اللي يدور حول الأرض', "The natural satellite that orbits Earth", 'القمر', 'The Moon'],
    ['اسم المجرة اللي تحتوي مجموعتنا الشمسية', 'The name of the galaxy that contains our solar system', 'درب التبانة', 'The Milky Way'],
    ['أول إنسان مشى على سطح القمر', 'The first person to walk on the Moon', 'نيل آرمسترونغ', 'Neil Armstrong'],
    ['الكوكب المعروف بحلقاته البارزة', 'The planet best known for its prominent rings', 'زحل', 'Saturn'],
    ['الوكالة الأمريكية اللي قادت أول مهمة هبوط على القمر', 'The American agency that led the first Moon landing mission', 'وكالة ناسا', 'NASA'],
  ]),
};
