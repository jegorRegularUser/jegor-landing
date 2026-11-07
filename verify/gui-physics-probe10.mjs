/* Авто-прибивание при спавне? Смотрим сцену каждые 200мс после отрыва. */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  args: [
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-features=CalculateNativeWinOcclusion',
  ],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
});
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 250)));

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.bringToFront();
await page.waitForSelector('[data-theme-stamp]', { timeout: 20000 });
await page.waitForTimeout(1000);

for (let i = 0; i < 3; i += 1) {
  const r = await page.evaluate(() => {
    const b = document.querySelector('[data-theme-stamp]');
    if (!b) return null;
    const q = b.getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  });
  if (!r) break;
  await page.locator('[data-theme-stamp]').click({ timeoutMs: 3000 });
  await page.waitForTimeout(900);
}

for (let i = 1; i <= 12; i += 1) {
  await page.waitForTimeout(250);
  const s = await page.evaluate(() => ({
    pieces: document.querySelectorAll('.physics-piece').length,
    piece: document.querySelector('.physics-piece')?.style.transform?.slice(0, 55) ?? null,
    scene: !!document.querySelector('.physics-scene'),
    fx: !!document.querySelector('.nail-fx'),
    nailBtn: [...document.querySelectorAll('header button')].some(
      (b) => b.textContent.trim() === 'ПРИБИТЬ',
    ),
  }));
  console.log(`~${i * 250}ms:`, JSON.stringify(s));
}
await browser.close();
