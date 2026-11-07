/* Трассировка броска: куда летит кусок, съедает ли его корзина, есть ли перезагрузка. */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 250)));

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.bringToFront();
await page.waitForTimeout(1500);
for (let i = 0; i < 3; i += 1) {
  const r = await page.evaluate(() => {
    const b = document.querySelector('[data-theme-stamp]');
    if (!b) return null;
    const q = b.getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  });
  if (!r) break;
  await page.mouse.click(r.x, r.y);
  await page.waitForTimeout(900);
}
await page.waitForTimeout(1200);
await page.evaluate(() => {
  window.__marker = 'alive';
});
const theme0 = await page.evaluate(() => document.documentElement.dataset.theme);
const pos0 = await page.evaluate(() => document.querySelector('.physics-piece')?.style.transform);
console.log('before throw:', theme0, pos0);

const m = pos0.match(/translate3d\(([\d.-]+)px, ([\d.-]+)px/);
const px = parseFloat(m[1]) + 51;
const py = parseFloat(m[2]) + 16;
await page.mouse.move(px, py);
await page.mouse.down();
for (let i = 1; i <= 6; i += 1) {
  await page.mouse.move(Math.max(30, px - i * 90), Math.max(30, py - i * 55), { steps: 1 });
  await page.waitForTimeout(12);
}
await page.mouse.up();
for (const wait of [150, 300, 500, 800, 1200, 1600, 2200, 3000]) {
  await page.waitForTimeout(wait);
  const s = await page.evaluate(`(() => ({
    marker: window.__marker ?? 'RELOADED',
    theme: document.documentElement.dataset.theme,
    piece: document.querySelector('.physics-piece')?.style.transform ?? null,
    pieces: document.querySelectorAll('.physics-piece').length,
    sketch: !!document.querySelector('.sketch-cover'),
    binIn: document.querySelector('.physics-bin')?.className,
  }))()`);
  console.log(`+${wait}ms:`, JSON.stringify(s));
  if (s.marker === 'RELOADED') break;
}
await browser.close();
