/* Кусок в сенсор корзины: телеметрия тел и сенсора. */
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
await page.waitForTimeout(1000);

// к контактам колесом
const targetY = await page.evaluate(() => {
  const el = document.querySelector('#sheet-07');
  return el ? Math.round(el.getBoundingClientRect().top + window.scrollY - 320) : -1;
});
let cur = 0;
for (let i = 0; i < 60 && cur < targetY; i += 1) {
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(80);
  cur = await page.evaluate(() => Math.round(window.scrollY));
}
const reveal = page.getByRole('button', { name: /РАСКРЫТЬ|REVEAL/ });
await reveal.waitFor({ state: 'visible', timeoutMs: 8000 });
await reveal.click({ force: true });
await page.waitForTimeout(2500);

const d0 = await page.evaluate(() => window.__physicsDebug?.());
console.log('after shatter:', JSON.stringify(d0));
const mouth = { x: d0.bin.minX + 20, y: d0.bin.y };
console.log('sensor:', JSON.stringify(d0.bin), 'mouth:', JSON.stringify(mouth));

// берём первое тело и волочим В ЦЕНТР сенсора медленно
const body0 = d0.bodies[0];
console.log('targeting body0 at', body0.x, body0.y);
// позиция мыши = позиция тела (центр масс); захват попадёт в кусок с clip-path
await page.mouse.move(body0.x, body0.y);
await page.waitForTimeout(120);
await page.mouse.down();
await page.waitForTimeout(200);
let grabbed = (await page.evaluate(() => window.__physicsDebug?.())).grabbed;
console.log('grabbed:', grabbed);
if (grabbed) {
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(body0.x + ((mouth.x - body0.x) * i) / 12, body0.y + ((mouth.y - body0.y) * i) / 12, { steps: 1 });
    await page.waitForTimeout(50);
  }
  const during = await page.evaluate(() => window.__physicsDebug?.());
  console.log('during drag:', JSON.stringify({ grabbed: during.grabbed, b0: during.bodies[0] }));
  await page.mouse.up();
  await page.waitForTimeout(900);
  const d2 = await page.evaluate(() => window.__physicsDebug?.());
  console.log('after release:', JSON.stringify({ pieces: d2.pieces, b0: d2.bodies[0], bin: d2.bin }));
}
await page.screenshot({ path: 'verify/gui-physics/probe_bin.png' });
await browser.close();
