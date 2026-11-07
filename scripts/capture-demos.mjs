/* Интерактивная съёмка демо (ревизия скринов):
   evolution-online — меню + реальная партия («Начать год»);
   intelligent-trails — лендинг + карта с построенным маршрутом + EN. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = `${ROOT}/assets-src/screens`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const VP = { width: 1280, height: 800 };

// ---------- evolution-online ----------
{
  const page = await browser.newPage({ viewport: VP });
  await page.goto('https://evolution-online.vercel.app/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/evolution-online.png` });
  console.log('evo: меню ок');

  // Реальная партия: настройки по умолчанию → «Начать год».
  try {
    await page.getByRole('button', { name: 'Начать год' }).click({ timeout: 5000 });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `${OUT}/evolution-online-2.png` });
    console.log('evo: партия ок');
  } catch (e) {
    console.warn('evo: партия не снята —', String(e).slice(0, 120));
  }
  await page.close();
}

// ---------- intelligent-trails ----------
{
  const page = await browser.newPage({ viewport: VP });
  await page.goto('https://jegors-intelligent-trails.vercel.app/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/intelligent-trails.png` });
  console.log('trails: лендинг ок');

  // Карта с маршрутом: открываем /map, тыкаем по карте в двух местах.
  try {
    await page.goto('https://jegors-intelligent-trails.vercel.app/map', {
      waitUntil: 'load',
      timeout: 30000,
    });
    await page.waitForTimeout(6000); // ждём плитки карты
    // Два клика по карте: ставим точки маршрута (мимо панелей UI).
    await page.mouse.click(420, 460);
    await page.waitForTimeout(1200);
    await page.mouse.click(820, 380);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/intelligent-trails-2.png` });
    console.log('trails: карта/маршрут ок');
  } catch (e) {
    console.warn('trails: карта не снята —', String(e).slice(0, 120));
  }

  // EN-версия лендинга.
  try {
    await page.goto('https://jegors-intelligent-trails.vercel.app/en', {
      waitUntil: 'load',
      timeout: 30000,
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/intelligent-trails-3.png` });
    console.log('trails: EN ок');
  } catch (e) {
    console.warn('trails: EN не снят —', String(e).slice(0, 120));
  }
  await page.close();
}

await browser.close();
console.log('DONE');
