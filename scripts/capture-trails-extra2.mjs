/* trails v2: многоточечный маршрут, категория через «Выбрать...», прогулка рядом. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = `${ROOT}/assets-src/screens`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const fillInput = async (nth, text) => {
  const input = page.getByPlaceholder('Адрес или место...').nth(nth);
  await input.click({ timeout: 6000 });
  await input.fill(text);
  await page.waitForTimeout(2200);
  const sug = page
    .locator('li, [role="option"], [class*="suggestion"], [class*="dropdown"], [class*="Suggest"]')
    .filter({ hasText: new RegExp(text.split(' ')[0], 'i') })
    .first();
  await sug.click({ timeout: 6000 });
  await page.waitForTimeout(1500);
};

// 1) Три точки: Красная площадь → Зарядье → Парк Горького.
await page.goto('https://jegors-intelligent-trails.vercel.app/map', {
  waitUntil: 'load',
  timeout: 30000,
});
await page.waitForTimeout(5000);
try {
  await fillInput(0, 'Красная площадь');
  await page.getByRole('button', { name: /Добавить место/i }).click({ timeout: 5000 });
  await page.waitForTimeout(800);
  await fillInput(1, 'Зарядье');
  const to = page.getByPlaceholder(/Куда придем в итоге/i).first();
  await to.click({ timeout: 5000 });
  await to.fill('Парк Горького');
  await page.waitForTimeout(2200);
  const sug2 = page
    .locator('li, [role="option"], [class*="suggestion"], [class*="dropdown"], [class*="Suggest"]')
    .filter({ hasText: /Горьк/i })
    .first();
  await sug2.click({ timeout: 6000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Построить маршрут/i }).click({ timeout: 5000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/intelligent-trails-4.png` });
  console.log('многоточечный маршрут ок');
} catch (e) {
  console.warn('многоточечный не удался:', String(e).slice(0, 200));
}

// 2) Категория: закончим в кафе.
try {
  await page.goto('https://jegors-intelligent-trails.vercel.app/map', {
    waitUntil: 'load',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);
  await fillInput(0, 'Патриаршие пруды');
  await page.getByRole('button', { name: 'Категория' }).click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Выбрать/ }).click({ timeout: 5000 });
  await page.waitForTimeout(800);
  const cafe = page
    .locator('li, [role="option"], [class*="item"], [class*="option"]')
    .filter({ hasText: /Кафе|Кофейн/i })
    .first();
  await cafe.click({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Построить маршрут/i }).click({ timeout: 5000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/intelligent-trails-5.png` });
  console.log('категория ок');
} catch (e) {
  console.warn('категория не удалась:', String(e).slice(0, 200));
}

// 3) Прогулка рядом.
try {
  await page.goto('https://jegors-intelligent-trails.vercel.app/map', {
    waitUntil: 'load',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);
  await page.getByRole('button', { name: /Прогулка рядом/i }).click({ timeout: 5000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/intelligent-trails-6.png` });
  console.log('прогулка рядом ок');
} catch (e) {
  console.warn('прогулка не удалась:', String(e).slice(0, 200));
}

await browser.close();
console.log('DONE');
