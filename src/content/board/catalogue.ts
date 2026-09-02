import type { CategoryDeck, TileContent } from '../../engine/board/types';

/**
 * Placeholder trivia content for the board-game mode, standing in for a real
 * authored catalogue. Enough categories and real Q&A pairs to build and test
 * the drafting/checkout/play screens end to end — not production content.
 * Every tile is `mediaType: 'text'`; image/audio/reorder tiles are a content
 * pipeline gap tracked separately, not something this file solves.
 */

const POINTS = [100, 200, 300, 400, 500, 600];

function makeTiles(
  rows: readonly [ar: string, en: string, answerAr: string, answerEn: string][]
): TileContent[] {
  return rows.map(([ar, en, answerAr, answerEn], i) => ({
    index: i,
    points: POINTS[i],
    mediaType: 'text',
    promptAr: ar,
    promptEn: en,
    answerAr,
    answerEn,
  }));
}

export const BOARD_CATALOGUE: CategoryDeck[] = [
  {
    id: 'history',
    nameAr: 'تاريخ',
    nameEn: 'History',
    tier: 'free',
    tiles: makeTiles([
      ['هالدولة كانت أول دولة توحد الجزيرة العربية تحت حكم واحد', 'This kingdom first unified most of the Arabian Peninsula', 'المملكة العربية السعودية', 'Saudi Arabia'],
      ['بنى هالسور المشهور حول مدينة الكويت قبل ما توسعت المدينة', 'This wall once encircled Kuwait City before the city outgrew it', 'سور الكويت الثالث', 'The Third Wall of Kuwait'],
      ['سنة استقلال الكويت عن الحماية البريطانية', 'The year Kuwait gained independence from British protection', '١٩٦١', '1961'],
      ['أول رئيس لجمهورية مصر العربية', 'The first president of the Republic of Egypt', 'محمد نجيب', 'Muhammad Naguib'],
      ['الإمبراطورية اللي حكمت أغلب الخليج العربي لقرون قبل الدول الحديثة', 'The empire that ruled much of the Gulf coast for centuries before modern states', 'الإمبراطورية العثمانية', 'The Ottoman Empire'],
      ['سنة اكتشاف النفط بكميات تجارية في الكويت', 'The year oil was discovered in commercial quantities in Kuwait', '١٩٣٨', '1938'],
    ]),
  },
  {
    id: 'sports',
    nameAr: 'رياضة',
    nameEn: 'Sports',
    tier: 'free',
    tiles: makeTiles([
      ['عدد لاعبين فريق كرة القدم داخل الملعب', 'How many players a football team fields at once', '١١', '11'],
      ['الدولة اللي فازت بكأس العالم لكرة القدم أكثر من غيرها', 'The country with the most FIFA World Cup titles', 'البرازيل', 'Brazil'],
      ['الرياضة اللي تلعب فيها بالمضرب وكرة صغيرة فوق الشبكة', 'The sport played with a racquet and a small ball over a net', 'تنس', 'Tennis'],
      ['عدد الأشواط في مباراة كرة السلة العادية', 'How many quarters a standard basketball game has', '٤', '4'],
      ['الدولة المضيفة لكأس العالم لكرة القدم ٢٠٢٢', 'The host country of the 2022 FIFA World Cup', 'قطر', 'Qatar'],
      ['اسم أكبر بطولة أولمبية تقام كل أربع سنوات', 'The name of the major international games held every four years', 'الألعاب الأولمبية', 'The Olympic Games'],
    ]),
  },
  {
    id: 'movies',
    nameAr: 'أفلام ومسلسلات',
    nameEn: 'Movies & TV',
    tier: 'free',
    tiles: makeTiles([
      ['استوديو الرسوم المتحركة اللي أنتج أفلام مثل توي ستوري وفايندنق نيمو', 'The animation studio behind Toy Story and Finding Nemo', 'بيكسار', 'Pixar'],
      ['السلسلة السينمائية اللي بطلها ساحر صغير اسمه هاري', 'The film series about a young wizard named Harry', 'هاري بوتر', 'Harry Potter'],
      ['المنصة اللي أنتجت مسلسل Stranger Things', 'The streaming platform behind Stranger Things', 'نتفليكس', 'Netflix'],
      ['اللقب اللي يطلق على جوائز السينما الأمريكية الكبرى', 'The nickname for the major American film awards', 'الأوسكار', 'The Oscars'],
      ['المخرج المعروف بأفلام مثل إنسبشن وإنترستيلر', 'The director known for Inception and Interstellar', 'كريستوفر نولان', 'Christopher Nolan'],
      ['السلسلة اللي تدور أحداثها في عالم خيالي اسمه ويستروس', 'The series set in a fictional world called Westeros', 'صراع العروش', 'Game of Thrones'],
    ]),
  },
  {
    id: 'music',
    nameAr: 'موسيقى',
    nameEn: 'Music',
    tier: 'free',
    tiles: makeTiles([
      ['عدد أوتار العود التقليدي', 'How many strings a traditional oud has', '٥', '5'],
      ['اللقب اللي يطلق على مايكل جاكسون', 'The nickname given to Michael Jackson', 'ملك البوب', 'The King of Pop'],
      ['الآلة الموسيقية اللي تعزف بالنفخ وفيها مفاتيح معدنية طويلة', 'The wind instrument played with a long row of metal keys', 'الساكسفون', 'The Saxophone'],
      ['فرقة البيتلز طلعت أصلاً من هالمدينة البريطانية', 'The British city where the Beatles originally formed', 'ليفربول', 'Liverpool'],
      ['النوع الموسيقي التقليدي اللي يرتبط بالبحر والغوص في الخليج', 'The traditional Gulf musical style associated with pearl diving and the sea', 'فن البحري (النهام)', 'Al-Bahri sea chants'],
      ['عدد الخطوط في السلم الموسيقي القياسي', 'How many lines a standard musical staff has', '٥', '5'],
    ]),
  },
  {
    id: 'geography',
    nameAr: 'جغرافيا',
    nameEn: 'Geography',
    tier: 'free',
    tiles: makeTiles([
      ['أكبر قارة في العالم من حيث المساحة', 'The largest continent by area', 'آسيا', 'Asia'],
      ['النهر اللي يمر في مدينة القاهرة', 'The river that runs through Cairo', 'نهر النيل', 'The Nile'],
      ['الدولة الخليجية اللي عاصمتها المنامة', 'The Gulf country whose capital is Manama', 'البحرين', 'Bahrain'],
      ['أصغر قارة في العالم من حيث المساحة', 'The smallest continent by area', 'أستراليا', 'Australia'],
      ['المحيط اللي يفصل بين قارة أمريكا وقارة آسيا من الغرب', 'The ocean that separates the Americas from Asia to the west', 'المحيط الهادئ', 'The Pacific Ocean'],
      ['الجزيرة الكويتية المعروفة بمحمياتها الطبيعية وطيورها', 'The Kuwaiti island known for its nature reserve and birdlife', 'جزيرة بوبيان', 'Bubiyan Island'],
    ]),
  },
  {
    id: 'food',
    nameAr: 'أكل',
    nameEn: 'Food',
    tier: 'free',
    tiles: makeTiles([
      ['الطبق الخليجي المشهور المكون من رز مع لحم أو دجاج ومكسرات وزبيب', 'The famous Gulf dish of spiced rice with meat or chicken, nuts and raisins', 'المجبوس', 'Machboos'],
      ['المشروب التقليدي اللي يقدم بفناجين صغيرة بدون سكر عادة', 'The traditional drink usually served unsweetened in small cups', 'القهوة العربية', 'Arabic coffee'],
      ['نوع الخبز الرقيق المشهور اللي يخبز فوق صاج محدب', 'The thin bread traditionally baked on a domed griddle', 'خبز الرقاق', 'Raqaq bread'],
      ['البلد الأصلي لأكلة البيتزا', 'The country of origin of pizza', 'إيطاليا', 'Italy'],
      ['التمر يجي أصلاً من هالشجرة', 'Dates grow on this tree', 'نخلة التمر', 'The date palm'],
      ['الحلا الكويتي المعروف المصنوع من الدقيق المحمص والسمن والسكر', 'The Kuwaiti sweet made from toasted flour, ghee and sugar', 'العصيدة', 'Aseeda'],
    ]),
  },
];
