/* Смоук физики (15): три клика по ИЗМ.01 — кнопка отрывается; РАСКРЫТЬ —
   телефон рассыпается. Проверяем отсутствие ошибок страницы и наличие
   физической сцены/кусков. */
import { chromium } from 'playwright';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(SITE_URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2000);

// Тема: 3 клика — расшатывание и отрыв.
const themeBtn = page.locator('[data-theme-stamp]');
for (let i = 0; i < 3; i += 1) {
  await themeBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(700);
}
const sceneAfterTheme = (await page.locator('.physics-scene').count()) > 0;
const pieceAfterTheme = (await page.locator('.physics-piece').count()) > 0;
const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme);

// Телефон: РАСКРЫТЬ.
await page.locator('#sheet-07').scrollIntoViewIfNeeded();
await page.getByRole('button', { name: /РАСКРЫТЬ|REVEAL/ }).click();
await page.waitForTimeout(1200);
const piecesAfterPhone = await page.locator('.physics-piece').count();
const binShown = (await page.locator('.physics-bin--in').count()) > 0;

console.log(
  JSON.stringify(
    {
      sceneAfterTheme,
      pieceAfterTheme,
      themeAfter,
      piecesAfterPhone,
      binShown,
      pageErrors: errors.length,
      firstErrors: errors.slice(0, 3),
    },
    null,
    2,
  ),
);
await browser.close();
