/* trails v3: с диагностикой DOM. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = `${ROOT}/assets-src/screens`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const dumpInputs = async (label) => {
  const info = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input, textarea'))
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => `${el.tagName}:${el.getAttribute('placeholder') || '(no ph)'}`),
  );
  console.log(`[inputs @${label}]`, info.join(' | '));
};

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

// 1) Многоточечный: с диагностикой
await page.goto('https://jegors-intelligent-trails.vercel.app/map', {
  waitUntil: 'load',
  timeout: 30000,
});
await page.waitForTimeout(5000);
await dumpInputs('map open');
try {
  await fillInput(0, 'Красная площадь');
  await page.getByRole('button', { name: /Добавить место/i }).click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await dumpInputs('after add place');
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
  console.log('многоточечный ок');
} catch (e) {
  console.warn('многоточечный не удался:', String(e).slice(0, 300));
}

// 2) Категория: exact «Выбрать...»
try {
  await page.goto('https://jegors-intelligent-trails.vercel.app/map', {
    waitUntil: 'load',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);
  await fillInput(0, 'Патриаршие пруды');
  await page.getByRole('button', { name: 'Категория' }).click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Выбрать...', exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(900);
  await dumpInputs('category open');
  const cafe = page
    .locator('li, [role="option"], [class*="item"], [class*="option"], button')
    .filter({ hasText: /Кафе|Кофейн/i })
    .first();
  await cafe.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Построить маршрут/i }).click({ timeout: 5000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/intelligent-trails-5.png` });
  console.log('категория ок');
} catch (e) {
  console.warn('категория не удалась:', String(e).slice(0, 300));
}

// 3) Прогулка рядом: сначала точка А
try {
  await page.goto('https://jegors-intelligent-trails.vercel.app/map', {
    waitUntil: 'load',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);
  await fillInput(0, 'Патриаршие пруды');
  await page.getByRole('button', { name: /Прогулка рядом/i }).click({ timeout: 6000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/intelligent-trails-6.png` });
  console.log('прогулка рядом ок');
} catch (e) {
  console.warn('прогулка не удалась:', String(e).slice(0, 300));
}

await browser.close();
console.log('DONE');
