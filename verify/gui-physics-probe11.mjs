/* Доскролл до sheet-07 колесом: оживает ли ревил листов. */
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
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.bringToFront();
await page.waitForSelector('[data-theme-stamp]', { timeout: 20000 });
await page.waitForTimeout(1200);

const targetY = await page.evaluate(() => {
  const el = document.querySelector('#sheet-07');
  return el ? Math.round(el.getBoundingClientRect().top + window.scrollY - 320) : -1;
});
console.log('targetY:', targetY);
let cur = 0;
for (let i = 0; i < 60 && cur < targetY; i += 1) {
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(90);
  cur = await page.evaluate(() => Math.round(window.scrollY));
  if (i % 8 === 0) console.log('scrolled to', cur);
}
console.log('final scroll:', cur, 'target:', targetY);
await page.waitForTimeout(800);
const st = await page.evaluate(() => {
  const sheet = document.querySelector('#sheet-07');
  const btn = [...(sheet?.querySelectorAll('button') ?? [])].map((b) => ({
    t: b.textContent.trim().slice(0, 10),
    vis: getComputedStyle(b).visibility,
    op: getComputedStyle(b).opacity,
  }));
  const cs = getComputedStyle(sheet);
  return { sheetVis: cs.visibility, sheetOp: cs.opacity, sheetTransform: cs.transform.slice(0, 40), btns: btn };
});
console.log(JSON.stringify(st, null, 1));
await page.screenshot({ path: 'verify/gui-physics/probe_scroll.png' });
await browser.close();
