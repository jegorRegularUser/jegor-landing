/* trails: попытка построить реальный маршрут + запасные кадры. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = `${ROOT}/assets-src/screens`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const VP = { width: 1280, height: 800 };
const page = await browser.newPage({ viewport: VP });

// 1) Маршрут: точка А через геокодер → «Построить маршрут».
await page.goto('https://jegors-intelligent-trails.vercel.app/map', {
  waitUntil: 'load',
  timeout: 30000,
});
await page.waitForTimeout(5000);

try {
  const input = page.getByPlaceholder(/Адрес или место/i).first();
  await input.click({ timeout: 5000 });
  await input.fill('Красная площадь');
  await page.waitForTimeout(2500); // ждём подсказки геокодера
  // Первая подсказка в списке
  const suggestion = page.locator('li, [role="option"], [class*="suggestion"], [class*="dropdown"]')
    .filter({ hasText: /Красн/i })
    .first();
  await suggestion.click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  // Точка Б: «Куда придем в итоге?»
  const input2 = page.getByPlaceholder(/Куда придем в итоге/i).first();
  await input2.click({ timeout: 4000 });
  await input2.fill('Парк Горького');
  await page.waitForTimeout(2500);
  const sugg2 = page.locator('li, [role="option"], [class*="suggestion"], [class*="dropdown"]')
    .filter({ hasText: /Горьк/i })
    .first();
  await sugg2.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Построить маршрут/i }).click({ timeout: 5000 });
  await page.waitForTimeout(6000); // ждём отрисовку маршрута
  await page.screenshot({ path: `${OUT}/intelligent-trails-2.png` });
  console.log('trails: маршрут построен');
} catch (e) {
  console.warn('маршрут не удался:', String(e).slice(0, 150));
  await page.screenshot({ path: `${OUT}/intelligent-trails-2.png` });
}

// 2) Третий кадр: секция «как работает» на лендинге.
try {
  await page.goto('https://jegors-intelligent-trails.vercel.app/#tutorial', {
    waitUntil: 'load',
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    document.getElementById('tutorial')?.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/intelligent-trails-3.png` });
  console.log('trails: tutorial ок');
} catch (e) {
  console.warn('tutorial не снят:', String(e).slice(0, 120));
}

await browser.close();
console.log('DONE');
