/* Скоростной порог: медленный vs средний vs быстрый драг в одной сессии. */
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
  page.evaluate(
    () => document.querySelector('.physics-piece')?.style.transform ?? 'GONE',
  );

const grabPoint = async () => {
  const t = await piece();
  const m = t.match(/translate3d\(([\d.-]+)px, ([\d.-]+)px/);
  return { x: parseFloat(m[1]) + 50, y: parseFloat(m[2]) + 16 };
};

// --- медленный
{
  const { x, y } = await grabPoint();
  await page.mouse.move(x, y);
  await page.waitForTimeout(80);
  await page.mouse.down();
  await page.waitForTimeout(120);
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(x + i * 25, y - i * 14, { steps: 2 });
    await page.waitForTimeout(50);
  }
  console.log('slow during:', await piece());
  await page.mouse.up();
  await page.waitForTimeout(120);
  console.log('slow after up:', await piece());
  await page.waitForTimeout(1300);
}

// --- средний
{
  const { x, y } = await grabPoint();
  await page.mouse.move(x, y);
  await page.waitForTimeout(80);
  await page.mouse.down();
  for (let i = 1; i <= 6; i += 1) {
    await page.mouse.move(x - i * 60, y - i * 30, { steps: 1 });
    await page.waitForTimeout(30);
  }
  console.log('mid during:', await piece());
  await page.mouse.up();
  await page.waitForTimeout(120);
  console.log('mid after up:', await piece());
  await page.waitForTimeout(1300);
}

// --- быстрый
{
  const { x, y } = await grabPoint();
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i += 1) {
    await page.mouse.move(x - i * 90, y - i * 55, { steps: 1 });
    await page.waitForTimeout(12);
  }
  console.log('fast during:', await piece());
  await page.mouse.up();
  await page.waitForTimeout(120);
  console.log('fast after up:', await piece());
  await page.waitForTimeout(1300);
  console.log('fast settle:', await piece());
}
await browser.close();
