import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const HUMAN_BODY: CategoryDeck = {
  id: 'human-body',
  nameAr: 'جسم الإنسان',
  nameEn: 'Human Body',
  tier: 'free',
  level: 'kids',
  region: 'global',
  tiles: makeTiles('human-body', [
    ['أكبر عضو في جسم الإنسان', 'The largest organ in the human body', 'الجلد', 'The skin'],
    ['عدد عظام جسم الإنسان البالغ', 'The number of bones in an adult human body', '٢٠٦', '206'],
    ['الجزء المسؤول عن التفكير ومركز الجهاز العصبي', "The part responsible for thinking, the body's control centre", 'الدماغ', 'The brain'],
    ['عدد حجرات القلب البشري', 'The number of chambers in the human heart', 'أربعة', '4'],
    ['الغدة اللي تلقب بـ"الغدة الرئيسية" لأنها تتحكم بغدد هرمونية ثانية', "The gland nicknamed the body's 'master gland' because it controls other hormone glands", 'الغدة النخامية', 'The pituitary gland'],
    ['تقريباً كم لتر دم يوجد في جسم الإنسان البالغ', 'Roughly how many litres of blood an adult human body holds', 'حوالي ٥ لترات', 'About 5 litres'],
  ]),
};
