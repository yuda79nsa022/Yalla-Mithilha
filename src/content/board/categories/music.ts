import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const MUSIC: CategoryDeck = {
  id: 'music',
  nameAr: 'موسيقى',
  nameEn: 'Music',
  tier: 'free',
  level: 'family',
  region: 'gulf',
  tiles: makeTiles('music', [
    ['عدد أوتار العود التقليدي', 'How many strings a traditional oud has', '٥', '5'],
    ['اللقب اللي يطلق على مايكل جاكسون', 'The nickname given to Michael Jackson', 'ملك البوب', 'The King of Pop'],
    ['الآلة الموسيقية اللي تعزف بالنفخ وفيها مفاتيح معدنية طويلة', 'The wind instrument played with a long row of metal keys', 'الساكسفون', 'The Saxophone'],
    ['فرقة البيتلز طلعت أصلاً من هالمدينة البريطانية', 'The British city where the Beatles originally formed', 'ليفربول', 'Liverpool'],
    ['النوع الموسيقي التقليدي اللي يرتبط بالبحر والغوص في الخليج', 'The traditional Gulf musical style associated with pearl diving and the sea', 'فن البحري (النهام)', 'Al-Bahri sea chants'],
    ['عدد الخطوط في السلم الموسيقي القياسي', 'How many lines a standard musical staff has', '٥', '5'],
  ]),
};
