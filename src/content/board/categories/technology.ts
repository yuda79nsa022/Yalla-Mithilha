import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const TECHNOLOGY: CategoryDeck = {
  id: 'technology',
  nameAr: 'تقنية',
  nameEn: 'Technology',
  tier: 'free',
  level: 'friends',
  region: 'global',
  tiles: makeTiles('technology', [
    ['الشركة اللي تصنع آيفون', 'The company that makes the iPhone', 'أبل', 'Apple'],
    ['محرك البحث اللي صار اسمه فعل يعني "دوّر عن شي أونلاين"', 'The search engine whose name became a verb meaning to look something up online', 'قوقل', 'Google'],
    ['لغة البرمجة المسماة على اسم نوع من الثعابين', 'The programming language named after a type of snake', 'بايثون', 'Python'],
    ['المخترع المعروف باختراع الهاتف', 'The inventor credited with inventing the telephone', 'ألكسندر غراهام بيل', 'Alexander Graham Bell'],
    ['الوحدة المستخدمة لقياس سرعة معالج الكمبيوتر', "The unit used to measure a computer processor's speed", 'هرتز', 'Hertz'],
    ['السنة اللي طرحت فيها أول نسخة من الآيفون', 'The year the first iPhone was released', '٢٠٠٧', '2007'],
  ]),
};
