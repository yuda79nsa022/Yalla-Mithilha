// Renders the stage page (stage/promo.html) frame by frame. Its render(t) is
// a pure function of time, so every frame is exact — no screen recording.
//   node render.js <stageDir> <outDir> stills   → still-<t>.png, one per scene, to review first
//   node render.js <stageDir> <outDir> frames   → frames/00000.jpg … at 30 fps, for ffmpeg
const { chromium } = require('playwright');
const fs = require('fs');

const [STAGE, OUT, MODE = 'frames'] = process.argv.slice(2);
const FPS = 30;
// Mid-scene moments (scene start times are in stage/promo.html).
const STILLS = [2.6, 8.2, 13.8, 20.6, 26.4, 32.0, 38.0, 41.5, 44.2, 51.5];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + require('path').resolve(STAGE, 'promo.html'));
  await page.evaluate(() => window.ready);

  if (MODE === 'stills') {
    for (const t of STILLS) {
      await page.evaluate((t) => window.render(t), t);
      await page.screenshot({ path: `${OUT}/still-${String(t).replace('.', '_')}.png` });
    }
    console.log(`stills: ${STILLS.length}`);
  } else {
    fs.mkdirSync(`${OUT}/frames`, { recursive: true });
    const total = await page.evaluate(() => window.TOTAL);
    const n = Math.round(total * FPS);
    for (let f = 0; f < n; f++) {
      await page.evaluate((t) => window.render(t), f / FPS);
      await page.screenshot({ path: `${OUT}/frames/${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 95 });
    }
    console.log(`frames: ${n} (${total}s at ${FPS} fps)`);
  }
  if (errors.length) console.error('page errors:', errors);
  await browser.close();
})();
