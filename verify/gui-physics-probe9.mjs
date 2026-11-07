/* Граб ✓ → быстрые moves: где разрыв — мышь, constraint или бросок. */
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
await page.waitForTimeout(1500);

const piece = () =>
  page.evaluate(() => document.querySelector('.physics-piece')?.style.transform ?? 'GONE');
const dbg = () => page.evaluate(() => window.__physicsDebug?.());
const grabPoint = async () => {
  const t = await piece();
  const m = t.match(/translate3d\(([\d.-]+)px, ([\d.-]+)px/);
  return { x: parseFloat(m[1]) + 50, y: parseFloat(m[2]) + 16 };
};

// Серия: граб → пауза → быстрые moves с замерами
const { x, y } = await grabPoint();
await page.evaluate(() => {
  window.__evlog = [];
  const rec = (e) => {
    if (window.__evlog.length < 300) {
      window.__evlog.push(`${e.type}@${Math.round(e.clientX)},${Math.round(e.clientY)}`);
    }
  };
  for (const t of ['mousemove', 'mousedown', 'mouseup']) {
    window.addEventListener(t, rec, { passive: true, capture: true });
  }
});
await page.mouse.move(x, y);
await page.mouse.down();
await page.waitForTimeout(250);
console.log('grabbed:', JSON.stringify(await dbg()));
for (let i = 1; i <= 6; i += 1) {
  await page.mouse.move(x - i * 90, y - i * 55, { steps: 1 });
  await page.waitForTimeout(12);
  const d = await dbg();
  console.log(`move ${i}: grabbed=${d.grabbed} mouse=(${d.mouse.x},${d.mouse.y}) piece=`, (await piece()).slice(0, 44));
}
console.log('events tail:', JSON.stringify(await page.evaluate(() => window.__evlog.slice(-8))));
await page.mouse.up();
await page.waitForTimeout(150);
console.log('after up:', JSON.stringify(await dbg()));
await page.waitForTimeout(1200);
console.log('settle:', (await piece()).slice(0, 60));
await browser.close();
