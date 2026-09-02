import type { CategoryDeck } from '../../../engine/board/types';
import { makeTiles } from '../helpers';

/**
 * Confidence: LOW. I do not have confident knowledge of specific named
 * plays from Oman, Qatar, Bahrain, Saudi Arabia or the UAE, so every tile
 * here is a safe, true, generic theatre-culture fact rather than real
 * show-specific trivia. This is the second category (with kuwaiti-plays)
 * that most needs real content — see the chat summary.
 */
export const KHALEEJI_PLAYS: CategoryDeck = {
  id: 'khaleeji-plays',
  nameAr: 'مسرحيات خليجية',
  nameEn: 'Khaleeji Plays',
  tier: 'free',
  level: 'family',
  region: 'gulf',
  tiles: makeTiles('khaleeji-plays', [
    ['دول مجلس التعاون الخليجي الست اللي تنتج مسرحيات "خليجية"', "The six Gulf Cooperation Council countries whose theatre scenes produce what's called 'Khaleeji' plays", 'الكويت والسعودية والإمارات وقطر والبحرين وعُمان', 'Kuwait, Saudi Arabia, the UAE, Qatar, Bahrain and Oman'],
    ['الكلمة العربية للعمل المسرحي', 'The Arabic word for a stage play', 'مسرحية', 'A "masrahiyya" (stage play)'],
    ['اللهجة اللي تُؤدى فيها معظم المسرحيات الخليجية', 'The dialect most Khaleeji plays are performed in', 'اللهجة الخليجية', 'A Gulf (Khaleeji) dialect'],
    ['الفن اللي يُؤدى فيه الممثلون أدوارهم مباشرة أمام جمهور حاضر', 'The performing art in which actors perform their roles live in front of a present audience', 'المسرح', 'Live theatre'],
    ['غالباً الغرض من المسرحية الخليجية الكوميدية: إضحاك الجمهور مع تمرير نقد اجتماعي خفيف', 'The usual aim of a Khaleeji comedy play: making the audience laugh while slipping in light social commentary', 'النقد الاجتماعي الكوميدي', 'Comedic social commentary'],
    ['الشهر اللي كثير من العروض المسرحية الخليجية الكبرى تُقام فيه بمناسبة العطلة الطويلة', 'The month many major Khaleeji stage productions are timed around, thanks to the long holiday', 'رمضان', 'Ramadan'],
  ]),
};
