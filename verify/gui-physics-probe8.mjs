/* Серия проб захвата с логом событий: куда реально ложится mousedown. */
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

await page.evaluate(() => {
  window.__evlog = [];
  const rec = (e) => {
    if (window.__evlog.length < 200) {
      window.__evlog.push(
        `${e.type} @${Math.round(e.clientX)},${Math.round(e.clientY)} -> ` +
          `${e.target.tagName}.${String(e.target.className).slice(0, 30)}`,
      );
    }
  };
  for (const t of ['mousemove', 'mousedown', 'mouseup']) {
    window.addEventListener(t, rec, { passive: true, capture: true });
  }
});

const piece = () =>
  page.evaluate(() => document.querySelector('.physics-piece')?.style.transform ?? 'GONE');
const grabPoint = async () => {
  const t = await piece();
  const m = t.match(/translate3d\(([\d.-]+)px, ([\d.-]+)px/);
  return { x: parseFloat(m[1]) + 50, y: parseFloat(m[2]) + 16 };
};

for (let attempt = 0; attempt < 6; attempt += 1) {
  const { x, y } = await grabPoint();
  await page.evaluate(() => {
    window.__evlog.length = 0;
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  const d = await page.evaluate(() => ({
    dbg: window.__physicsDebug?.(),
    log: window.__evlog.slice(-6),
  }));
  console.log(
    `attempt ${attempt}: grab=${d.dbg?.grabbed} button=${d.dbg?.mouse.button} mouse=(${d.dbg?.mouse.x},${d.dbg?.mouse.y})`,
  );
  console.log('   last events:', JSON.stringify(d.log));
  await page.mouse.up();
  await page.waitForTimeout(100);
  await page.waitForTimeout(1400);
}
await browser.close();
