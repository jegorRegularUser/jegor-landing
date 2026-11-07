/* Диагностика захвата куска: тянем и логируем всё подряд. */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 300));
});

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

// детач
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
await page.waitForTimeout(1500); // пусть устоится на полу

const probe = await page.evaluate(() => {
  const p = document.querySelector('.physics-piece');
  if (!p) return null;
  const r = p.getBoundingClientRect();
  return {
    transform: p.style.transform,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    pointerEvents: getComputedStyle(p).pointerEvents,
    atPoint: document.elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      .slice(0, 3)
      .map((e) => e.tagName + '.' + String(e.className).slice(0, 30)),
  };
});
console.log('probe:', JSON.stringify(probe));
if (!probe) throw new Error('piece missing');

const cx = probe.rect.x + probe.rect.w / 2;
const cy = probe.rect.y + probe.rect.h / 2;

// медленный захват и перетаскивание
await page.mouse.move(cx, cy);
await page.waitForTimeout(100);
await page.mouse.down();
await page.waitForTimeout(150);
for (let i = 1; i <= 10; i += 1) {
  await page.mouse.move(cx - i * 25, cy - i * 18, { steps: 2 });
  await page.waitForTimeout(50);
}
const during = await page.evaluate(() => document.querySelector('.physics-piece')?.style.transform);
console.log('transform during drag:', during);
await page.waitForTimeout(100);
await page.mouse.up();
await page.waitForTimeout(1200);
const after = await page.evaluate(() => ({
  transform: document.querySelector('.physics-piece')?.style.transform,
  theme: document.documentElement.dataset.theme,
}));
console.log('after release:', JSON.stringify(after));
await browser.close();
