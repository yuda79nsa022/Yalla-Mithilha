import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const CAPITALS: CategoryDeck = {
  id: 'capitals',
  nameAr: 'عواصم العالم',
  nameEn: 'World Capitals',
  tier: 'free',
  level: 'family',
  region: 'global',
  tiles: makeTiles('capitals', [
    ['عاصمة فرنسا', 'The capital city of France', 'باريس', 'Paris'],
    ['عاصمة اليابان', 'The capital city of Japan', 'طوكيو', 'Tokyo'],
    ['عاصمة مصر', 'The capital city of Egypt', 'القاهرة', 'Cairo'],
    ['عاصمة المملكة المتحدة', 'The capital city of the United Kingdom', 'لندن', 'London'],
    ['عاصمة أستراليا (مو سيدني)', "Australia's capital city (not Sydney)", 'كانبيرا', 'Canberra'],
    ['عاصمة تركيا (مو إسطنبول)', "Turkey's capital city (not Istanbul)", 'أنقرة', 'Ankara'],
  ]),
};
