/* Одноразовые кадры затронутых листов для приёмки (ревизия 06):
   титул light, лист 03 (базовый + hover, обе темы), прил. А, лист 07. */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const browser = await chromium.launch();

async function shot(name, theme, sel, actions) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript(([t]) => {
    localStorage.setItem('jegor-theme', t);
    localStorage.setItem('jegor-lang', 'ru');
  }, [theme]);
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);
  if (sel) await page.locator(sel).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  if (actions) await actions(page);
  await page.locator(sel ?? 'body').screenshot({ path: `${ROOT}/verify/${name}.png` });
  await ctx.close();
  console.log(`${name}: ok`);
}

await shot('rev06-hero-light', 'light', '#sheet-01');
await shot('rev06-tech-dark', 'dark', '#sheet-04');
await shot('rev06-tech-hover-dark', 'dark', '#sheet-04', (p) =>
  p.locator('.tech-tile').nth(4).hover().then(() => p.waitForTimeout(400)),
);
await shot('rev06-tech-hover-light', 'light', '#sheet-04', (p) =>
  p.locator('.tech-tile').nth(6).hover().then(() => p.waitForTimeout(400)),
);
await shot('rev06-certs-dark', 'dark', '#sheet-06');
await shot('rev06-certs-light', 'light', '#sheet-06');
await shot('rev06-footer-dark', 'dark', '#sheet-08');
await browser.close();
