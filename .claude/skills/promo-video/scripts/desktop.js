// The guest home page on a desktop browser, for the "for everyone" scene.
//   node desktop.js <shotsDir> [en,ar]      Env: BASE
const { chromium } = require('playwright');

const OUT = process.argv[2];
const LANGS = (process.argv[3] || 'en,ar').split(',');
const B = process.env.BASE || 'http://localhost:4400';

(async () => {
  const browser = await chromium.launch();
  for (const lang of LANGS) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(B + '/home'); await page.waitForTimeout(2500);
    if (page.url().includes('language')) { await page.locator('[role="button"]').last().click(); await page.waitForTimeout(1500); }
    const toggle = page.getByRole('button', { name: lang === 'ar' ? /العربية/ : /English/ });
    if (await toggle.count()) { await toggle.first().click(); await page.waitForTimeout(800); }
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${lang}-desktop-home.png` });
    await page.close();
  }
  console.log(`desktop: captured ${LANGS.join(', ')}`);
  await browser.close();
})();
