import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

export const INVENTIONS: CategoryDeck = {
  id: 'inventions',
  nameAr: 'اختراعات ومخترعين',
  nameEn: 'Inventions & Inventors',
  tier: 'free',
  level: 'friends',
  region: 'global',
  tiles: makeTiles('inventions', [
    ['المخترع المعروف باختراع المصباح الكهربائي', 'The inventor credited with inventing the light bulb', 'توماس إديسون', 'Thomas Edison'],
    ['أحد أهم الاختراعات القديمة في النقل، شكله دائري بسيط', 'One of the most important ancient inventions in transport, a simple round shape', 'العجلة', 'The wheel'],
    ['العالم المرتبط بنظرية الجاذبية، وقصته المشهورة مع سقوط تفاحة', 'The scientist linked to the theory of gravity, famous for the falling-apple story', 'إسحاق نيوتن', 'Isaac Newton'],
    ['الجهاز اللي اخترعه يوهانس غوتنبرغ وغيّر طريقة صناعة الكتب', "The device invented by Johannes Gutenberg that changed how books were made", 'المطبعة', 'The printing press'],
    ['العالم المعروف بتطوير نظرية النسبية', 'The scientist known for developing the theory of relativity', 'ألبرت أينشتاين', 'Albert Einstein'],
    ['الأخوان اللي يُنسب لهما اختراع وتطيير أول طائرة ناجحة', 'The brothers credited with inventing and flying the first successful airplane', 'الأخوان رايت', 'The Wright brothers'],
  ]),
};
