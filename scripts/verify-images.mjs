/* Функциональная проверка загрузки картинок (Playwright, собранный preview).
   1) blur-up: картинки тормозятся route'ом (~40s на файл), JS идёт быстро —
      LQIP-фоны видны ДО load на герое и дипломах.
   2) лайтбокс диплома: открывается, полная версия (webp/avif) грузится.
   3) карусель проектов: стрелка листает кадры, лайтбокс кадра открывается.
   Запуск: node scripts/verify-images.mjs <url> [outDir] */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const URL_ = process.argv[2] ?? 'http://127.0.0.1:4174/';
const OUT = path.join(ROOT, process.argv[3] ?? 'verify/functional');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  reducedMotion: 'reduce',
});
// Google Fonts: fonts.ready на скриншоте не нужен — глушим.
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());

await page.goto(URL_, { waitUntil: 'load' });
await page.evaluate(() => {
  localStorage.setItem('jegor-lang', 'ru');
  localStorage.setItem('jegor-theme', 'dark');
});

// --- 1) blur-up: тормозим только КАРТИНКИ, JS/гидрация живут нормально ---
const held = new Map(); // url -> deferred release
await page.route(
  (url) => /\.(png|webp|avif)$/.test(new URL(url).pathname),
  async (route) => {
    const u = new URL(route.request().url());
    if (!u.pathname.includes('blur') && !held.has(u.pathname)) {
      held.set(u.pathname, route); // держим все обычные картинки «в пути»
      return;
    }
    return route.continue();
  },
);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2000); // гидрация + рендер с одними LQIP

const heroDuring = await page.evaluate(() => {
  const img = document.querySelector('.hero__portrait');
  if (!img) return null;
  return {
    loaded: img.classList.contains('blur-up--loaded'),
    bg: getComputedStyle(img.closest(".blur-up-wrap") ?? img).backgroundImage.slice(0, 24),
  };
});
console.log('hero during held images:', JSON.stringify(heroDuring));
await page.screenshot({ path: path.join(OUT, 'slow-hero-blur.png') });

await page.evaluate(() => document.querySelector('#sheet-06')?.scrollIntoView());
await page.waitForTimeout(600);
const diplomaDuring = await page.evaluate(() => {
  const img = document.querySelector('.diploma-card__thumb');
  if (!img) return null;
  return {
    loaded: img.classList.contains('blur-up--loaded'),
    bg: getComputedStyle(img.closest(".blur-up-wrap") ?? img).backgroundImage.slice(0, 24),
  };
});
console.log('diploma thumb during held images:', JSON.stringify(diplomaDuring));
await page.screenshot({ path: path.join(OUT, 'slow-diplomas-blur.png') });

// --- 2) отпускаем картинки, дожидаемся загрузки ---
await page.unrouteAll({ behavior: 'ignoreErrors' });
for (const route of held.values()) route.continue().catch(() => {});
await page.waitForTimeout(2500);
const heroAfter = await page.evaluate(() => {
  const img = document.querySelector('.hero__portrait');
  return {
    loaded: img?.classList.contains('blur-up--loaded'),
    bgCleared: getComputedStyle(img).backgroundImage === 'none',
  };
});
console.log('hero after load:', JSON.stringify(heroAfter));

// --- 3) лайтбокс диплома (#sheet-06! первый dialog.lightbox в DOM — проектов) ---
await page.evaluate(() => document.querySelector('#sheet-06')?.scrollIntoView());
await page.waitForTimeout(500);
await page.click('.diploma-card');
await page.waitForTimeout(1500);
const lightboxState = await page.evaluate(() => {
  const dlg = document.querySelector('#sheet-06 dialog.lightbox');
  const img = dlg?.querySelector('.lightbox__stage img');
  return {
    open: dlg?.open ?? false,
    stageAr: getComputedStyle(dlg.querySelector('.lightbox__stage')).aspectRatio,
    loaded: img?.classList.contains('blur-up--loaded'),
    src: img?.currentSrc?.split('/').pop(),
  };
});
console.log('diploma lightbox:', JSON.stringify(lightboxState));
await page.screenshot({ path: path.join(OUT, 'lightbox-diploma.png') });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// --- 4) карусель проектов: стрелка + лайтбокс ВИДИМОГО кадра ---
await page.evaluate(() => document.querySelector('#sheet-05')?.scrollIntoView());
await page.waitForTimeout(500);
await page.click('.proj-arrow--next');
await page.waitForTimeout(700);
const carousel = await page.evaluate(() => {
  const track = document.querySelector('.proj-carousel__track');
  const img = track.querySelectorAll('.proj-carousel__slide')[1]?.querySelector('img');
  return {
    transform: track?.style.transform,
    slide2Loaded: img?.classList.contains('blur-up--loaded'),
  };
});
console.log('carousel:', JSON.stringify(carousel));

await page.click('.proj-carousel__slide:nth-child(2) .proj-frame-zoom');
await page.waitForTimeout(1200);
const projLightbox = await page.evaluate(() => {
  const dlg = document.querySelector('#sheet-05 dialog.lightbox');
  const img = dlg?.querySelector('img');
  return {
    open: dlg?.open ?? false,
    ar: getComputedStyle(dlg.querySelector('.lightbox__stage')).aspectRatio,
    loaded: img?.classList.contains('blur-up--loaded'),
  };
});
console.log('project lightbox:', JSON.stringify(projLightbox));
await page.screenshot({ path: path.join(OUT, 'lightbox-project.png') });

await browser.close();
console.log('OK ->', OUT);
