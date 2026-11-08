/* Приёмка правок 08.11 (мобилка + корзина + локализация itch). */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const browser = await chromium.launch();

// --- мобилка 360×780 ---
for (const [name, theme, sel, actions] of [
  ['fix-hero-light-mobile', 'light', '#sheet-01', null],
  ['fix-tech-mobile', 'dark', '#sheet-04', null],
  ['fix-header-mobile', 'dark', '.header', null],
  ['fix-projects-mobile', 'dark', '#sheet-05', null],
]) {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    hasTouch: true,
  });
  await ctx.addInitScript(([t]) => {
    localStorage.setItem('jegor-theme', t);
    localStorage.setItem('jegor-lang', 'ru');
  }, [theme]);
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  if (actions) await actions(page);
  await page.locator(sel).first().screenshot({ path: `${ROOT}/verify/${name}.png` });
  await ctx.close();
  console.log(`${name}: ok`);
}

// Тап по кадру → лайтбокс (мобилка)
{
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 780 },
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript(() => {
    localStorage.setItem('jegor-theme', 'dark');
    localStorage.setItem('jegor-lang', 'ru');
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.locator('#sheet-05').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.locator('.proj-frame-zoom').first().tap();
  await page.waitForTimeout(500);
  const dlgOpen = await page.evaluate(() => {
    const d = document.querySelector('.proj-carousel dialog');
    return d && d.open;
  });
  await page.screenshot({ path: `${ROOT}/verify/fix-projects-lightbox-mobile.png` });
  console.log(`lightbox open: ${dlgOpen}`);
  await ctx.close();
}

// EN: локализация «itch.io — скоро»
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    localStorage.setItem('jegor-theme', 'dark');
    localStorage.setItem('jegor-lang', 'en');
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.locator('#sheet-05').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  const soon = await page.locator('.proj-block__soon').first().textContent();
  console.log(`soon EN: ${JSON.stringify(soon)}`);
  await ctx.locator ? null : null;
  await page.locator('#sheet-05').screenshot({ path: `${ROOT}/verify/fix-itch-en.png` });
  await ctx.close();
}

// Корзина: тап всасывает все осколки; бросок куска в корзину ест только его
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    localStorage.setItem('jegor-theme', 'dark');
    localStorage.setItem('jegor-lang', 'ru');
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.locator('#sheet-07').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  // Разбить строку телефона
  await page.locator('#sheet-07 button:has-text("РАСКРЫТЬ")').click();
  await page.waitForTimeout(3500); // строка падает и разваливается
  const before = await page.evaluate(() => document.querySelectorAll('.physics-shard').length);
  // Тап по корзине
  await page.locator('.physics-bin').dispatchEvent('pointerdown');
  await page.waitForTimeout(1200);
  const afterTap = await page.evaluate(() => document.querySelectorAll('.physics-shard').length);
  // Драг куска в корзину больше невозможен (осколков нет) — проверяем только счётчики
  console.log(`shards before=${before} afterTap=${afterTap}`);
  await page.screenshot({ path: `${ROOT}/verify/fix-bin-sucked.png` });
  await ctx.close();
}

await browser.close();
console.log('DONE');
