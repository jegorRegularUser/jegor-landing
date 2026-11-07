/* Отладка захвата через __physicsDebug: что видит движок при разных драгах. */
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

// БЕЗ ховера: move + сразу down
{
  const { x, y } = await grabPoint();
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 5; i += 1) {
    await page.waitForTimeout(40);
    console.log('nohover', i, await dbg(), 'piece:', (await piece()).slice(0, 46));
    await page.mouse.move(x - i * 40, y - i * 20, { steps: 1 });
  }
  await page.mouse.up();
  await page.waitForTimeout(120);
  console.log('nohover up:', await dbg());
  await page.waitForTimeout(1200);
}

// С ховером 100мс
{
  const { x, y } = await grabPoint();
  await page.mouse.move(x, y);
  await page.waitForTimeout(100);
  await page.mouse.down();
  for (let i = 0; i < 4; i += 1) {
    await page.waitForTimeout(40);
    console.log('hover', i, await dbg());
    await page.mouse.move(x + i * 50, y + i * 10, { steps: 1 });
  }
  await page.mouse.up();
  await page.waitForTimeout(120);
  console.log('hover up:', await dbg());
}
await browser.close();
