/* Проверка no-WebGL фолбэка (спека §10.4). Требует запущенный vite preview на :4173. */
import { chromium } from 'playwright';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  localStorage.setItem('jegor-theme', 'dark');
  localStorage.setItem('jegor-lang', 'ru');
});
const page = await ctx.newPage();
await page.goto(SITE_URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3000);
const hasCanvas = (await page.locator('.osc-window canvas').count()) > 0;
const hasFallback = (await page.locator('.shader-fallback').count()) > 0;
console.log(JSON.stringify({ hasCanvas, hasFallback, pass: !hasCanvas && hasFallback }));
await page.screenshot({ path: 'verify/no-webgl.png' });
await ctx.close();
await browser.close();
