/* Съёмка ассетов и верификационных скриншотов (Playwright).
   1) Демо пет-проектов → assets-src/screens/*.png
   2) Наш сайт (vite preview на :4173, SITE_URL переопределяет) → verify/*.png */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
await mkdir(`${ROOT}/assets-src/screens`, { recursive: true });
await mkdir(`${ROOT}/verify`, { recursive: true });

const browser = await chromium.launch();

// 1) Демо пет-проектов (для слайдера проектов).
for (const [name, url] of [
  ['evolution-online', 'https://evolution-online.vercel.app/'],
  ['intelligent-trails', 'https://jegors-intelligent-trails.vercel.app/'],
]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${ROOT}/assets-src/screens/${name}.png` });
  await page.close();
  console.log(`demo ${name}: ok`);
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
  const ctx = await browser.newContext({ viewport: s.viewport, deviceScaleFactor: 1 });
  await ctx.addInitScript(
    ([theme, lang]) => {
      localStorage.setItem('jegor-theme', theme);
      localStorage.setItem('jegor-lang', lang);
    },
    [s.theme, s.lang],
  );
  const page = await ctx.newPage();
  await page.goto(SITE_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
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
