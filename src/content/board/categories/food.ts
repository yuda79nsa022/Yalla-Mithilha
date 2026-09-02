import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const FOOD: CategoryDeck = {
  id: 'food',
  nameAr: 'أكل',
  nameEn: 'Food',
  tier: 'free',
  level: 'kids',
  region: 'gulf',
  tiles: makeTiles('food', [
    ['الطبق الخليجي المشهور المكون من رز مع لحم أو دجاج ومكسرات وزبيب', 'The famous Gulf dish of spiced rice with meat or chicken, nuts and raisins', 'المجبوس', 'Machboos'],
    ['المشروب التقليدي اللي يقدم بفناجين صغيرة بدون سكر عادة', 'The traditional drink usually served unsweetened in small cups', 'القهوة العربية', 'Arabic coffee'],
    ['نوع الخبز الرقيق المشهور اللي يخبز فوق صاج محدب', 'The thin bread traditionally baked on a domed griddle', 'خبز الرقاق', 'Raqaq bread'],
    ['البلد الأصلي لأكلة البيتزا', 'The country of origin of pizza', 'إيطاليا', 'Italy'],
    ['التمر يجي أصلاً من هالشجرة', 'Dates grow on this tree', 'نخلة التمر', 'The date palm'],
    ['الحلا الكويتي المعروف المصنوع من الدقيق المحمص والسمن والسكر', 'The Kuwaiti sweet made from toasted flour, ghee and sugar', 'العصيدة', 'Aseeda'],
  ]),
};
