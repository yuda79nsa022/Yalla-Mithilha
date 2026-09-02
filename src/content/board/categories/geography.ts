import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const GEOGRAPHY: CategoryDeck = {
  id: 'geography',
  nameAr: 'جغرافيا',
  nameEn: 'Geography',
  tier: 'free',
  level: 'kids',
  region: 'global',
  tiles: makeTiles('geography', [
    ['أكبر قارة في العالم من حيث المساحة', 'The largest continent by area', 'آسيا', 'Asia'],
    ['النهر اللي يمر في مدينة القاهرة', 'The river that runs through Cairo', 'نهر النيل', 'The Nile'],
    ['الدولة الخليجية اللي عاصمتها المنامة', 'The Gulf country whose capital is Manama', 'البحرين', 'Bahrain'],
    ['أصغر قارة في العالم من حيث المساحة', 'The smallest continent by area', 'أستراليا', 'Australia'],
    ['المحيط اللي يفصل بين قارة أمريكا وقارة آسيا من الغرب', 'The ocean that separates the Americas from Asia to the west', 'المحيط الهادئ', 'The Pacific Ocean'],
    ['الجزيرة الكويتية المعروفة بمحمياتها الطبيعية وطيورها', 'The Kuwaiti island known for its nature reserve and birdlife', 'جزيرة بوبيان', 'Bubiyan Island'],
  ]),
};
