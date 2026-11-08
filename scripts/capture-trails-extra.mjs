/* trails: дополнительные кадры логики — маршрут с промежуточной точкой
   и режим «Категория» (закончим в кафе). */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = `${ROOT}/assets-src/screens`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const fillPlace = async (placeholder, text) => {
  const input = page.getByPlaceholder(placeholder).first();
  await input.click({ timeout: 6000 });
  await input.fill(text);
  await page.waitForTimeout(2200);
  const sug = page
    .locator('li, [role="option"], [class*="suggestion"], [class*="dropdown"]')
    .filter({ hasText: new RegExp(text.split(' ')[0], 'i') })
    .first();
  await sug.click({ timeout: 6000 });
  await page.waitForTimeout(1500);
};

// 1) Маршрут с промежуточной точкой: Красная площадь → Зарядье → Парк Горького.
await page.goto('https://jegors-intelligent-trails.vercel.app/map', {
  waitUntil: 'load',
  timeout: 30000,
});
await page.waitForTimeout(5000);
try {
  await fillPlace(/Адрес или место/i, 'Красная площадь');
  await page.getByRole('button', { name: /\+ Добавить место/i }).click({ timeout: 5000 });
  await page.waitForTimeout(800);
  // Новый инпут промежуточной точки
  const mid = page.getByPlaceholder(/Добавить место|Промежуточн|Куда пойти/i).first();
  if ((await mid.count()) > 0) {
    await mid.click({ timeout: 4000 });
    await mid.fill('Зарядье');
    await page.waitForTimeout(2200);
    const sugMid = page
      .locator('li, [role="option"], [class*="suggestion"], [class*="dropdown"]')
      .filter({ hasText: /Зарядь/i })
      .first();
    await sugMid.click({ timeout: 5000 });
    await page.waitForTimeout(1500);
  } else {
    console.warn('инпут промежуточной точки не найден');
  }
  await fillPlace(/Куда придем в итоге/i, 'Парк Горького');
  await page.getByRole('button', { name: /Построить маршрут/i }).click({ timeout: 5000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/intelligent-trails-4.png` });
  console.log('маршрут с промежуточной точкой ок');
} catch (e) {
  console.warn('многоточечный маршрут не удался:', String(e).slice(0, 150));
}

// 2) Режим «Категория»: закончим в кафе.
try {
  await page.goto('https://jegors-intelligent-trails.vercel.app/map', {
    waitUntil: 'load',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);
  await fillPlace(/Адрес или место/i, 'Патриаршие пруды');
  const catTab = page.getByRole('button', { name: /Категория/i }).first();
  await catTab.click({ timeout: 5000 });
  await page.waitForTimeout(800);
  const cafe = page
    .locator('button, [role="button"], li, [class*="category"]')
    .filter({ hasText: /Кафе|Кофейн/i })
    .first();
  await cafe.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Построить маршрут/i }).click({ timeout: 5000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/intelligent-trails-5.png` });
  console.log('категория ок');
} catch (e) {
  console.warn('категория не удалась:', String(e).slice(0, 150));
}

await browser.close();
console.log('DONE');
