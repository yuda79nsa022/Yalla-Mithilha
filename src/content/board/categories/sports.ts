import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const SPORTS: CategoryDeck = {
  id: 'sports',
  nameAr: 'رياضة',
  nameEn: 'Sports',
  tier: 'free',
  level: 'family',
  region: 'global',
  tiles: makeTiles('sports', [
    ['عدد لاعبين فريق كرة القدم داخل الملعب', 'How many players a football team fields at once', '١١', '11'],
    ['الدولة اللي فازت بكأس العالم لكرة القدم أكثر من غيرها', 'The country with the most FIFA World Cup titles', 'البرازيل', 'Brazil'],
    ['الرياضة اللي تلعب فيها بالمضرب وكرة صغيرة فوق الشبكة', 'The sport played with a racquet and a small ball over a net', 'تنس', 'Tennis'],
    ['عدد الأشواط في مباراة كرة السلة العادية', 'How many quarters a standard basketball game has', '٤', '4'],
    ['الدولة المضيفة لكأس العالم لكرة القدم ٢٠٢٢', 'The host country of the 2022 FIFA World Cup', 'قطر', 'Qatar'],
    ['اسم أكبر بطولة أولمبية تقام كل أربع سنوات', 'The name of the major international games held every four years', 'الألعاب الأولمبية', 'The Olympic Games'],
  ]),
};
