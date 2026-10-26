// Plays one full 20-round game on a phone-sized screen and screenshots the
// moments the promo uses, in one language.
//   node capture.js <shotsDir> <en|ar>
// Env: BASE (default http://localhost:4400), PROMO_USER, PROMO_PASS (a player
// with at least one game in the wallet — make-promo.sh creates one).
// Writes <lang>-01-home-guest … <lang>-10-final .png (1170×2532).
const { chromium } = require('playwright');

const OUT = process.argv[2];
const LANG = process.argv[3];
const B = process.env.BASE || 'http://localhost:4400';
const USER = process.env.PROMO_USER || 'Dana';
const PASS = process.env.PROMO_PASS || 'promoPass123';
const AR = LANG === 'ar';

const L = AR
  ? { signIn: /^تسجيل الدخول$/, toLang: /العربية/, start: /^ابدأ المؤقت$/, done: /^خلصنا! سجّلوا النتيجة$/, award: /^أعطِ النقطة لـ/, skip: /^ما حد عرفها$/, next: /^الجولة الجاية$/, teams: ['الصقور', 'القروش'] }
  : { signIn: /^Sign in$/, toLang: /English/, start: /^Start the timer$/, done: /^We’re done — score it$/, award: /^Award /, skip: /^No one guessed it$/, next: /^Next round$/, teams: ['Falcons', 'Sharks'] };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();

  // The hand-off screen mints the QR code's single-use reveal token; keep its
  // id to open the actor's own phone view (the QR's link) once.
  let revealId = null;
  page.on('response', async (r) => {
    if (r.url().endsWith('/charades/reveal-tokens') && r.request().method() === 'POST' && r.status() === 201) {
      try { if (!revealId) revealId = (await r.json()).id; } catch {}
    }
  });

  const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${LANG}-${name}.png` }); };
  // Match buttons by accessible name among visible ones: labels carry arrow
  // glyphs in their text, and the screen stack keeps earlier screens mounted.
  const vis = (re) => page.getByRole('button', { name: re }).locator('visible=true').last();

  // First run shows the language picker; then switch to the wanted language.
  await page.goto(B + '/home'); await page.waitForTimeout(2500);
  if (page.url().includes('language')) { await page.locator('[role="button"]').last().click(); await page.waitForTimeout(1500); }
  const toggle = page.getByRole('button', { name: L.toLang });
  if (await toggle.count()) { await toggle.first().click(); await page.waitForTimeout(800); }
  await shot('01-home-guest');

  await page.goto(B + '/account'); await page.waitForTimeout(1800);
  await page.locator('input').nth(0).fill(USER);
  await page.locator('input[type="password"]').first().fill(PASS);
  await vis(L.signIn).click();
  await page.waitForTimeout(2500);
  await page.goto(B + '/home'); await page.waitForTimeout(2500);
  await shot('02-home-player');

  await page.goto(B + '/charades/draft'); await page.waitForTimeout(2500);
  await page.locator('input').nth(0).fill(L.teams[0]);
  await page.locator('input').nth(1).fill(L.teams[1]);
  const decks = page.locator('[role="checkbox"]');
  const deckCount = await decks.count();
  for (const i of [0, 2, 3].filter((i) => i < deckCount)) await decks.nth(i).click();
  await shot('03-draft');
  await page.locator('[role="button"]').last().click(); // continue to checkout
  await page.waitForTimeout(2500);
  await shot('04-checkout');
  await page.locator('[role="button"]').last().click(); // start the game (spends one game)
  await page.waitForTimeout(3500);
  await shot('05-handoff');

  if (revealId) {
    const phone = await ctx.newPage();
    await phone.goto(`${B}/reveal?id=${encodeURIComponent(revealId)}`);
    await phone.waitForTimeout(2500);
    await phone.screenshot({ path: `${OUT}/${LANG}-06-reveal.png` });
    await phone.close();
  }

  for (let round = 1; round <= 20; round++) {
    await vis(L.start).click();
    if (round === 1) { await page.waitForTimeout(4200); await shot('07-acting'); } else await page.waitForTimeout(300);
    await vis(L.done).click();
    await page.waitForTimeout(400);
    if (round === 1) await shot('08-score-it');
    // A close game the first team edges: they get every one of theirs, the other team misses a few.
    const guessed = round % 2 === 1 || round % 4 !== 0;
    await vis(guessed ? L.award : L.skip).click();
    await page.waitForTimeout(1100);
    if (round === 1) await shot('09-recap');
    await vis(L.next).click();
    if (round < 20) await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500);
  await shot('10-final');
  console.log(`${LANG}: captured a full game`);
  await browser.close();
})().catch((e) => { console.error(`${LANG}: ${e.message.split('\n')[0]}`); process.exit(1); });
