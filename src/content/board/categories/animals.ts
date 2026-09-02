import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const ANIMALS: CategoryDeck = {
  id: 'animals',
  nameAr: 'حيوانات وطبيعة',
  nameEn: 'Animals & Nature',
  tier: 'free',
  level: 'kids',
  region: 'global',
  tiles: makeTiles('animals', [
    ['أكبر حيوان بري في العالم', 'The largest land animal in the world', 'الفيل الأفريقي', 'The African elephant'],
    ['أسرع حيوان بري في العالم', 'The fastest land animal in the world', 'الفهد الصياد', 'The cheetah'],
    ['عدد أرجل العنكبوت', 'How many legs a spider has', 'ثمانية', 'Eight'],
    ['الثديي الوحيد القادر على الطيران الحقيقي', 'The only mammal capable of true flight', 'الخفاش', 'The bat'],
    ['أكبر كائن عاش على وجه الأرض على الإطلاق', 'The largest animal to have ever lived on Earth', 'الحوت الأزرق', 'The blue whale'],
    ['حيوان الصحراء المعروف بتخزين الدهن، لا الماء، في سنامه', 'The desert animal known for storing fat, not water, in its hump', 'الجمل', 'The camel'],
  ]),
};
