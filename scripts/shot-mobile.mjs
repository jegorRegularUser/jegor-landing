/* Временный скрипт проверки: мобильные (390x844) и десктоп скриншоты листов.
   Запуск: node scripts/shot-mobile.mjs [outDir] [url]
   reducedMotion: ревилы отключены — всё видно без прокрутки-ожидания. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, process.argv[2] ?? 'verify/check');
const URL_ = process.argv[3] ?? 'http://localhost:5199/';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

async function shotPage(viewport, tag, dsf = 1) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: dsf,
    reducedMotion: 'reduce',
  });
  await page.goto(URL_, { waitUntil: 'load', timeout: 45000 });
  // Язык и фиксы вьюпорта: локаль Chromium — en-US, а отчёт про ru-фразы.
  await page.evaluate(() => {
    localStorage.setItem('jegor-lang', 'ru');
    localStorage.setItem('jegor-theme', 'dark');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  // Полный прогон вниз — lazy-картинки грузятся, ленивые ревилы отрабатывают.
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
  const sheets = await page.$$eval('section[data-sheet]', (els) =>
    els.map((s) => ({ id: s.id, top: s.offsetTop, h: s.offsetHeight })),
  );
  for (const { id } of sheets) {
    const el = await page.$(`#${id}`);
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await el.screenshot({ path: path.join(OUT, `${tag}-${id}.png`) });
  }
  await page.close();
}

await shotPage({ width: 390, height: 844 }, 'mob');
await shotPage({ width: 1280, height: 800 }, 'desk');
await browser.close();
console.log('OK ->', OUT);
