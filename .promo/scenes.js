// The promo's scenes, in order — 52 s. Shots are the names capture.js saves
// (<lang>-<shot>.png); captions are keys in captions.js. Backgrounds:
// ground · accent · ink · pop (promo.json "colors").
window.SCENES = [
  { type: 'logo', duration: 4.6, bg: 'ground', caption: 'tagline' },
  { type: 'phones', duration: 5.8, bg: 'ground', caption: 's2', shots: ['02-home-player'], alt: '01-home-guest' },
  { type: 'phones', duration: 5.6, bg: 'ground', caption: 's3', shots: ['03-draft'], alt: '04-checkout' },
  // The QR hand-off, then the actor's own phone — the same game, so one language.
  { type: 'phones', duration: 6.6, bg: 'accent', caption: 's4', shots: ['05-handoff', '06-reveal'], sameLanguage: true, reveal: true, label: 's4Label', squares: true },
  { type: 'phones', duration: 6.0, bg: 'ink', caption: 's5', shots: ['07-acting', '08-score-it'], squares: true },
  { type: 'phones', duration: 5.6, bg: 'pop', caption: 's6', shots: ['09-recap'], alt: '08-score-it', squares: true },
  { type: 'phones', duration: 5.8, bg: 'ink', caption: 's7', shots: ['10-final'], alt: '09-recap', squares: true },
  { type: 'desktop', duration: 5.6, bg: 'ground', caption: 's8', shot: 'desktop-home', tags: 'tags' },
  { type: 'end', duration: 6.4, bg: 'ground', caption: 'endLine' },
];
