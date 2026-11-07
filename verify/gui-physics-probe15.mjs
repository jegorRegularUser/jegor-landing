/* Решающий тест сенсора: целевой бросок в центр корзины + опрос счётчика. */
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
await page.waitForTimeout(3000);
console.log('pieces after shatter:', (await page.evaluate(() => window.__physicsDebug?.())).pieces);

// берём кусок ближе к центру экрана и швыряем в сенсор
const d = await page.evaluate(() => window.__physicsDebug?.());
const victim = d.bodies.reduce((a, b) => (Math.abs(b.x - 700) + Math.abs(b.y - 800) < Math.abs(a.x - 700) + Math.abs(a.y - 800) ? b : a));
console.log('victim at', victim.x, victim.y);
const mouth = { x: d.bin.x, y: d.bin.y };
await page.mouse.move(victim.x, victim.y);
await page.waitForTimeout(120);
await page.mouse.down();
await page.waitForTimeout(150);
// 6 быстрых шагов к корзине
for (let i = 1; i <= 6; i += 1) {
  await page.mouse.move(victim.x + ((mouth.x - victim.x) * i) / 6, victim.y + ((mouth.y - victim.y) * i) / 6, { steps: 1 });
  await page.waitForTimeout(14);
}
await page.mouse.up();
for (let i = 1; i <= 10; i += 1) {
  await page.waitForTimeout(180);
  const s = await page.evaluate(() => {
    const dbg = window.__physicsDebug?.();
    return { pieces: dbg.pieces, binClass: document.querySelector('.physics-bin')?.className?.slice(-8) };
  });
  console.log(`+${i * 180}ms:`, JSON.stringify(s));
}
await browser.close();
