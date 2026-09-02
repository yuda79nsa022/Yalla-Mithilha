import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const LANDMARKS: CategoryDeck = {
  id: 'landmarks',
  nameAr: 'معالم عالمية',
  nameEn: 'Landmarks',
  tier: 'free',
  level: 'family',
  region: 'global',
  tiles: makeTiles('landmarks', [
    ['البرج الحديدي المشهور في باريس', 'The famous iron tower in Paris', 'برج إيفل', 'The Eiffel Tower'],
    ['المقابر الفرعونية القديمة الموجودة في الجيزة بمصر', 'The ancient Egyptian tombs located in Giza', 'الأهرامات', 'The Pyramids of Giza'],
    ['السور الصيني الضخم اللي بني قديماً للدفاع عن البلاد', 'The huge Chinese wall built long ago for defence', 'سور الصين العظيم', 'The Great Wall of China'],
    ['التمثال الموجود في ميناء نيويورك، هدية من فرنسا', 'The statue in New York harbour, a gift from France', 'تمثال الحرية', 'The Statue of Liberty'],
    ['المدينة الأثرية في الأردن المنحوتة بالصخر الوردي', 'The ancient city in Jordan carved into pink rock', 'البتراء', 'Petra'],
    ['برج الساعة الشهير في لندن، يُعرف باسم جرسه الكبير', "London's famous clock tower, often called by its bell's name", 'بيغ بن', 'Big Ben'],
  ]),
};
