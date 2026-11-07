/* Диагностика броска: быстрый флик как в приёночном скрипте. */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
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
await page.waitForTimeout(1800);
const theme0 = await page.evaluate(() => document.documentElement.dataset.theme);
const pos0 = await page.evaluate(() => document.querySelector('.physics-piece')?.style.transform);
console.log('before throw:', theme0, pos0);

const m = pos0.match(/translate3d\(([\d.-]+)px, ([\d.-]+)px/);
const px = parseFloat(m[1]) + 51;
const py = parseFloat(m[2]) + 16;
await page.mouse.move(px, py);
await page.mouse.down();
for (let i = 1; i <= 8; i += 1) {
  await page.mouse.move(px + i * 60, py - i * 34, { steps: 1 });
  await page.waitForTimeout(12);
}
await page.mouse.up();
for (const wait of [200, 500, 900, 1500]) {
  await page.waitForTimeout(wait);
  const s = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    transform: document.querySelector('.physics-piece')?.style.transform ?? 'GONE',
  }));
  console.log(`+${wait}ms:`, JSON.stringify(s));
}
await page.screenshot({ path: 'verify/gui-physics/probe_throw.png' });
await browser.close();
