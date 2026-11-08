/* Разведка партии эволюции при 6 игроках: старт, дамп кнопок, попытка разыграть карту. */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('https://evolution-online.vercel.app/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3000);

// 6 игроков (ты + 5 ботов)
await page.getByRole('button', { name: '6', exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Начать год' }).click();
await page.waitForTimeout(4500);

const dump = async (label) => {
  const items = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, [role="button"], input, textarea'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .slice(0, 60)
      .map((el) => (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 50))
      .filter(Boolean),
  );
  console.log(`=== ${label} ===`);
  console.log(items.join(' | '));
};

await dump('поле после старта');

// Попытка разыграть первую карту как животное: открыть карту и искать кнопку
const card = page.locator('[class*="card"], .hand > *, [class*="hand"] > *').filter({ hasText: /ЖИВОТНОЕ|животное/ }).first();
try {
  await card.click({ timeout: 4000 });
  await page.waitForTimeout(800);
  await dump('после клика по карте');
  // Ищем кнопку размещения (Животное / В популяцию / +1)
  for (const name of ['В популяцию', 'Животное', 'Разместить', '+1']) {
    const btn = page.getByRole('button', { name }).first();
    if ((await btn.count()) > 0) {
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(800);
      console.log(`нажал: ${name}`);
      break;
    }
  }
  await dump('после размещения');
} catch (e) {
  console.warn('карта не сыгралась:', String(e).slice(0, 150));
}

await page.screenshot({ path: 'assets-src/screens/recon-evo.png' });
await browser.close();
console.log('DONE');
