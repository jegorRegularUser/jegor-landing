/* Съёмка ассетов и верификационных скриншотов (Playwright).
   1) Демо пет-проектов → assets-src/screens/*.png (SKIP_DEMOS=1 — пропустить)
   2) Наш сайт (vite preview на :4173, SITE_URL переопределяет) → verify/*.png
   Съёмка в reducedMotion: ревил-анимации отключены — все секции видимы,
   sticky-шапка на время fullPage-кадра становится статичной. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
await mkdir(`${ROOT}/assets-src/screens`, { recursive: true });
await mkdir(`${ROOT}/verify`, { recursive: true });

const browser = await chromium.launch();

// 1) Демо пет-проектов (по два кадра на карусель).
if (!process.env.SKIP_DEMOS) {
  for (const [name, url, secondUrl] of [
    ['evolution-online', 'https://evolution-online.vercel.app/', null],
    [
      'intelligent-trails',
      'https://jegors-intelligent-trails.vercel.app/',
      'https://jegors-intelligent-trails.vercel.app/en',
    ],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${ROOT}/assets-src/screens/${name}.png` });
    if (secondUrl) {
      await page.goto(secondUrl, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(2500);
    } else {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${ROOT}/assets-src/screens/${name}-2.png` });
    await page.close();
    console.log(`demo ${name}: ok (2 кадра)`);
  }
}

// 2) Наш сайт — ракурсы для визуальной приёмки (спека §4, §10).
const SITE_URL = process.env.SITE_URL ?? 'http://localhost:4173/';
const shots = [
  { name: 'desktop-dark-ru', theme: 'dark', lang: 'ru', viewport: { width: 1440, height: 900 } },
  { name: 'desktop-light-ru', theme: 'light', lang: 'ru', viewport: { width: 1440, height: 900 } },
  { name: 'desktop-dark-en', theme: 'dark', lang: 'en', viewport: { width: 1440, height: 900 } },
  { name: 'mobile-dark-ru', theme: 'dark', lang: 'ru', viewport: { width: 360, height: 780 } },
];
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: s.viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript(
    ([theme, lang]) => {
      localStorage.setItem('jegor-theme', theme);
      localStorage.setItem('jegor-lang', lang);
    },
    [s.theme, s.lang],
  );
  const page = await ctx.newPage();
  await page.goto(SITE_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);
  // sticky-шапка на fullPage-кадре печатается поверх контента — временно статик.
  await page.addStyleTag({ content: '.header { position: static !important; }' });
  await page.screenshot({ path: `${ROOT}/verify/${s.name}.png`, fullPage: true });
  await ctx.close();
  console.log(`shot ${s.name}: ok`);
}

// 3) no-WebGL фолбэк (спека §10.4): тёмная тема + WebGL выключен.
{
  const nobrowser = await chromium.launch({
    args: ['--disable-webgl', '--disable-webgl2'],
  });
  const ctx = await nobrowser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('jegor-theme', 'dark');
    localStorage.setItem('jegor-lang', 'ru');
  });
  const page = await ctx.newPage();
  await page.goto(SITE_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  const hasCanvas = (await page.locator('.osc-window canvas').count()) > 0;
  const hasFallback = (await page.locator('.shader-fallback').count()) > 0;
  console.log(`no-webgl: canvas=${hasCanvas} fallback=${hasFallback}`);
  await page.screenshot({ path: `${ROOT}/verify/no-webgl.png` });
  await ctx.close();
  await nobrowser.close();
}

await browser.close();
console.log('DONE');
