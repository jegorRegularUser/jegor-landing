/* Чистая проверка прибивания: отрыв → падение → драг куска в слот. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'verify/gui-physics';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('[nail]', ...a);

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
page.on('pageerror', (e) => log('PAGEERROR:', String(e).slice(0, 250)));

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
const dbg = await page.evaluate(() => window.__physicsDebug?.());
log('after detach: pieces =', dbg.pieces, 'bodies =', JSON.stringify(dbg.bodies));

// драг куска в слот-якорь
const slot = await page.evaluate(() => {
  const el = document.querySelector('.nail-slot-anchor');
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
log('slot:', JSON.stringify(slot));

const b = dbg.bodies[0];
await page.mouse.move(b.x, b.y);
await page.waitForTimeout(160);
await page.mouse.down();
await page.waitForTimeout(250);
const grabbed = (await page.evaluate(() => window.__physicsDebug?.())).grabbed;
log('grabbed:', grabbed);

if (grabbed) {
  for (let i = 1; i <= 18; i += 1) {
    await page.mouse.move(b.x + ((slot.x - b.x) * i) / 18, b.y + ((slot.y - b.y) * i) / 18, {
      steps: 1,
    });
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(1200);
  const hold = await page.evaluate(() => window.__physicsDebug?.());
  log('hold:', JSON.stringify({ grabbed: hold.grabbed, nail: hold.nail }));
  await page.screenshot({ path: `${OUT}/nail_hammer.png`, timeout: 15000 });
  await page.mouse.up();
  await page.waitForTimeout(3200);
  const fin = await page.evaluate(() => ({
    scene: !!document.querySelector('.physics-scene'),
    themeBtnBack: !!document.querySelector('[data-theme-stamp]'),
  }));
  log('final:', JSON.stringify(fin));
  await page.screenshot({ path: `${OUT}/nail_restored.png`, timeout: 15000 });
}
await browser.close();
log('DONE');
