/* Захват кнопки после отрыва: полная телеметрия точки клика. */
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

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.bringToFront();
await page.waitForSelector('[data-theme-stamp]', { timeout: 20000 });
await page.waitForTimeout(1200);
for (let i = 0; i < 3; i += 1) {
  const btn = page.locator('[data-theme-stamp]');
  if ((await btn.count()) === 0) break;
  await btn.click({ timeoutMs: 3000 });
  await page.waitForTimeout(900);
}
await page.waitForTimeout(1500);

const d = await page.evaluate(() => window.__physicsDebug?.());
console.log('dbg:', JSON.stringify(d));
console.log('piece transform:', await page.evaluate(() => document.querySelector('.physics-piece')?.style.transform));
const bodyPos = d.bodies[0];
console.log('body0:', JSON.stringify(bodyPos));

const hit = await page.evaluate(
  (pos) => {
    const els = document.elementsFromPoint(pos.x, pos.y).slice(0, 4).map((e) => e.tagName + '.' + String(e.className).slice(0, 40));
    return els;
  },
  { x: bodyPos.x, y: bodyPos.y },
);
console.log('elementsFromPoint at body:', JSON.stringify(hit));

await page.mouse.move(bodyPos.x, bodyPos.y);
await page.waitForTimeout(150);
await page.mouse.down();
await page.waitForTimeout(250);
console.log('after down:', JSON.stringify(await page.evaluate(() => window.__physicsDebug?.())));
await page.mouse.move(bodyPos.x - 100, bodyPos.y - 60, { steps: 4 });
await page.waitForTimeout(200);
console.log('after move:', JSON.stringify(await page.evaluate(() => window.__physicsDebug?.())));
await page.mouse.up();
await browser.close();
