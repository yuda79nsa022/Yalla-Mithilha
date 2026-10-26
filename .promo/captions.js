// Every line of text in Bas Bedoon Kalam's promo, per language. A promo shows
// any of these (PROMO_LANGS=en,ar · en · en,ta · ar …): the first language is
// the big headline in each scene, the others are the coloured lines under it.
// Keys are the ones scenes.js names, plus `chips` (one per content scene) and
// `byline` (the end card's "A GAME BY").
//
// To add a language: add it to LANGUAGES (its text direction; its font —
// either one in promo.json "fonts", or any Google Fonts family via `google`,
// loaded at render time; `size` against the Latin headline and `lineHeight`
// for a headline, since scripts differ in both) and give it every key `en`
// has. `\n` is a line break; keep lines short — they're read in a few
// seconds. Marketing copy in a new language should be checked by a native
// speaker before it's published.
window.LANGUAGES = {
  en: { name: 'English', dir: 'ltr', font: 'Archivo', weight: 900, lineHeight: 1.05 },
  ar: { name: 'Arabic', dir: 'rtl', font: 'Kufi', weight: 900, size: 0.82, lineHeight: 1.55 },
  // Not bundled: fetched from Google Fonts while rendering.
  ta: { name: 'Tamil', dir: 'ltr', font: 'Noto Sans Tamil', google: 'Noto+Sans+Tamil:wght@500;700;900', weight: 800, size: 0.7, lineHeight: 1.4 },
};

window.CAPTIONS = {
  en: {
    tagline: 'Game night is better together.',
    s2: 'Two teams.\nOne screen.\nZero words.',
    s3: 'Name your teams.\nPick your decks.',
    s4: 'Scan the code.\nKeep the title\nto yourself.',
    s4Label: 'The actor’s phone',
    s5: 'Two minutes.\nNot a single\nword.',
    s6: 'Every guess,\na cheer.',
    s7: 'Win together.\nLaugh together.',
    s8: 'Arabic & English.\nPhone, tablet\nor TV.',
    endLine: 'Gather your people.',
    byline: 'A GAME BY',
    chips: ['TOGETHER', 'SET UP', 'THE SECRET', 'ACT IT OUT', 'GOT IT!', 'TOGETHER', 'FOR EVERYONE'],
    tags: ['Kuwaiti', 'Khaleeji', 'Egyptian', 'Hollywood'],
  },
  ar: {
    tagline: 'السهرة أحلى… مع بعض',
    s2: 'فريقين… شاشة وحدة…\nوولا كلمة',
    s3: 'سمّوا فرقكم… واختاروا مجموعاتكم',
    s4: 'امسح الرمز…\nوالعنوان سرّ بينك وبين جوالك',
    s4Label: 'جوال الممثّل',
    s5: 'مثّلها… بس بدون كلام!',
    s6: 'كل جولة… ضحك وحماس',
    s7: 'نفوز سوا… ونضحك سوا',
    s8: 'عربي وإنجليزي… على الجوال\nأو التابلت أو التلفزيون',
    endLine: 'يلّا… جمّعوا ربعكم',
    byline: 'لعبة من',
    chips: ['سوا', 'التجهيز', 'السرّ', 'مثّلها', 'عرفوها!', 'سوا', 'للكل'],
    tags: ['كويتي', 'خليجي', 'مصري', 'هوليوود'],
  },
  ta: {
    tagline: 'ஒன்றுகூடினால்தான் விளையாட்டு இரவு களைகட்டும்!',
    s2: 'இரண்டு அணிகள்.\nஒரே திரை.\nஒரு வார்த்தையும் இல்லை.',
    s3: 'அணிகளுக்குப் பெயர் வையுங்கள்.\nதொகுப்புகளைத் தேர்ந்தெடுங்கள்.',
    s4: 'குறியீட்டை ஸ்கேன் செய்யுங்கள்.\nதலைப்பை ரகசியமாக வையுங்கள்.',
    s4Label: 'நடிப்பவரின் போன்',
    s5: 'இரண்டு நிமிடங்கள்.\nஒரு வார்த்தை கூட இல்லை.',
    s6: 'ஒவ்வொரு சரியான பதிலுக்கும்\nஆரவாரம்!',
    s7: 'சேர்ந்து வெல்வோம்.\nசேர்ந்து சிரிப்போம்.',
    s8: 'அரபு & ஆங்கிலம்.\nபோன், டேப்லெட் அல்லது டிவி.',
    endLine: 'வாருங்கள்… நண்பர்களை ஒன்றுகூட்டுங்கள்!',
    byline: 'உருவாக்கியது',
    chips: ['ஒன்றாக', 'தயாராகுங்கள்', 'ரகசியம்', 'நடியுங்கள்', 'சரி!', 'சேர்ந்து', 'அனைவருக்கும்'],
    tags: ['குவைத்', 'வளைகுடா', 'எகிப்து', 'ஹாலிவுட்'],
  },
};
