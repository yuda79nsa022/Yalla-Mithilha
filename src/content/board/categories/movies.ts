import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const MOVIES: CategoryDeck = {
  id: 'movies',
  nameAr: 'أفلام ومسلسلات',
  nameEn: 'Movies & TV',
  tier: 'free',
  level: 'friends',
  region: 'global',
  tiles: makeTiles('movies', [
    ['استوديو الرسوم المتحركة اللي أنتج أفلام مثل توي ستوري وفايندنق نيمو', 'The animation studio behind Toy Story and Finding Nemo', 'بيكسار', 'Pixar'],
    ['السلسلة السينمائية اللي بطلها ساحر صغير اسمه هاري', 'The film series about a young wizard named Harry', 'هاري بوتر', 'Harry Potter'],
    ['المنصة اللي أنتجت مسلسل Stranger Things', 'The streaming platform behind Stranger Things', 'نتفليكس', 'Netflix'],
    ['اللقب اللي يطلق على جوائز السينما الأمريكية الكبرى', 'The nickname for the major American film awards', 'الأوسكار', 'The Oscars'],
    ['المخرج المعروف بأفلام مثل إنسبشن وإنترستيلر', 'The director known for Inception and Interstellar', 'كريستوفر نولان', 'Christopher Nolan'],
    ['السلسلة اللي تدور أحداثها في عالم خيالي اسمه ويستروس', 'The series set in a fictional world called Westeros', 'صراع العروش', 'Game of Thrones'],
  ]),
};
