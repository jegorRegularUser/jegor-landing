/* rAF-жизнеспособность по этапам с анти-троттлинг флагами. */
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
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 250)));

const rafCheck = () =>
  page.evaluate(`(async () => ({
    raf: await new Promise((res) => {
      let ok = false;
      requestAnimationFrame(() => { ok = true; });
      setTimeout(() => res(ok), 350);
    }),
    hidden: document.hidden,
    piece: document.querySelector('.physics-piece')?.style.transform?.slice(0, 50) ?? null,
  }))()`);

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.bringToFront();
await page.waitForTimeout(1500);
console.log('start:', JSON.stringify(await rafCheck()));

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
console.log('after detach:', JSON.stringify(await rafCheck()));

const pos0 = await page.evaluate(() => document.querySelector('.physics-piece')?.style.transform);
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
await page.waitForTimeout(400);
console.log('after throw:', JSON.stringify(await rafCheck()));
await page.waitForTimeout(1500);
console.log('later:', JSON.stringify(await rafCheck()));
await browser.close();
