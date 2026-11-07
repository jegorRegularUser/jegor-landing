/* Полная телеметрия сценария: консоль, ошибки, состояние DOM по шагам. */
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 400)));
page.on('console', (m) => console.log('CONSOLE[' + m.type() + ']:', m.text().slice(0, 250)));
page.on('requestfailed', (r) => console.log('REQFAIL:', r.url().slice(0, 120), r.failure()?.errorText));

const fp = (tag) =>
  page.evaluate(
    (tag) => {
      const piece = document.querySelector('.physics-piece');
      const t = piece?.style.transform ?? null;
      return {
        tag,
        pieces: document.querySelectorAll('.physics-piece').length,
        pieceTransform: t ? t.slice(0, 60) : null,
        scene: !!document.querySelector('.physics-scene'),
        binClass: document.querySelector('.physics-bin')?.className ?? null,
        sketch: !!document.querySelector('.sketch-cover'),
        nailFx: !!document.querySelector('.nail-fx'),
        headerBtns: [...document.querySelectorAll('header button')].map((b) => b.textContent.trim()),
        bodyKids: document.body.children.length,
        theme: document.documentElement.dataset.theme,
      };
    },
    tag,
  ).then((s) => console.log('FP', JSON.stringify(s)));

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
await fp('T1_end');

const pos = await page.evaluate(() => {
  const el = document.querySelector('.physics-piece');
  const m = el?.style.transform.match(/translate3d\(([\d.-]+)px, ([\d.-]+)px/);
  return m ? { x: parseFloat(m[1]) + 51, y: parseFloat(m[2]) + 16 } : null;
});
console.log('grab at', JSON.stringify(pos));
await page.mouse.move(pos.x, pos.y);
await page.mouse.down();
for (let i = 1; i <= 6; i += 1) {
  await page.mouse.move(Math.max(30, pos.x - i * 90), Math.max(30, pos.y - i * 55), { steps: 1 });
  await page.waitForTimeout(12);
}
await page.mouse.up();
await fp('right_after_up');
for (const w of [400, 800, 1200, 1800]) {
  await page.waitForTimeout(w);
  await fp(`+${w}`);
}
await browser.close();
