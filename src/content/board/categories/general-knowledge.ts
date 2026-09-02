import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const GENERAL_KNOWLEDGE: CategoryDeck = {
  id: 'general-knowledge',
  nameAr: 'ثقافة عامة',
  nameEn: 'General Knowledge',
  tier: 'free',
  level: 'family',
  region: 'global',
  tiles: makeTiles('general-knowledge', [
    ['عدد أيام السنة الكبيسة', 'The number of days in a leap year', '٣٦٦', '366'],
    ['اللغة الرسمية الأساسية المتحدثة في البرازيل', 'The main official language spoken in Brazil', 'البرتغالية', 'Portuguese'],
    ['عدد ألوان قوس قزح', 'The number of colours in a rainbow', 'سبعة', 'Seven'],
    ['أطول برج في العالم، موجود في دبي', "The world's tallest building, located in Dubai", 'برج خليفة', 'Burj Khalifa'],
    ['عدد قارات الكرة الأرضية', 'The number of continents on Earth', 'سبعة', 'Seven'],
    ['الصيغة الكيميائية للماء', 'The chemical formula for water', 'H2O', 'H2O'],
  ]),
};
