/* Полная приёмка физики в настоящем браузере (headed).
   Порядок подобран так, чтобы пасхалка с перезагрузкой была последней:
   контакты (осколки+корзина) → кнопка (бросок вправо, прибивание) → пасхалка. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'verify/gui-physics';
mkdirSync(OUT, { recursive: true });
// Скриншот в разгар анимации может не успевать — одна повторная попытка.
const shot = async (page, name) => {
  for (let i = 0; i < 2; i += 1) {
    try {
      await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 15000 });
      return;
    } catch {
      await page.waitForTimeout(700);
    }
  }
  log('скриншот не удался:', name);
};
const log = (...a) => console.log('[check]', ...a);

const browser = await chromium.launch({
  headless: false,
  // Окно может оказаться перекрытым другими окнами на столе — иначе Chromium
  // ставит rAF на паузу и вся физика замирает посреди сценария.
  args: [
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-features=CalculateNativeWinOcclusion',
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => log('PAGEERROR:', String(e).slice(0, 250)));

const piecePos = (sel = '.physics-piece') =>
  page.evaluate(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const m2 = el.style.transform.match(/translate3d\(([\d.-]+)px, ([\d.-]+)px/);
      if (!m2) return null;
      return { x: parseFloat(m2[1]), y: parseFloat(m2[2]) };
    },
    sel,
  );

const settledPiecePos = async (sel) => {
  for (let i = 0; i < 20; i += 1) {
    const a = await piecePos(sel);
    if (!a) return null;
    await page.waitForTimeout(250);
    const b = await piecePos(sel);
    if (b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1) return b;
  }
  return piecePos(sel);
};

const grabPiece = async () => {
  const p = await settledPiecePos();
  if (!p) return null;
  await page.mouse.move(p.x + 50, p.y + 16);
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.waitForTimeout(120);
  return p;
};

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.bringToFront();
// Приложение может монтироваться несколько секунд (vite-трансформация на
// холодную) — ждём явных признаков, а не фиксированную паузу.
await page.waitForSelector('[data-theme-stamp]', { timeout: 20000 });
await page.evaluate(() => {
  window.__evlog = [];
  const rec = (e) => {
    if (window.__evlog.length < 400) {
      window.__evlog.push(`${e.type}@${Math.round(e.clientX)},${Math.round(e.clientY)}`);
    }
  };
  for (const t of ['mousemove', 'mousedown', 'mouseup']) {
    window.addEventListener(t, rec, { passive: true, capture: true });
  }
});
await page.waitForTimeout(800);

// ============================== Т1: строка TEL → осколки =====================
// Листы открываются ScrollTrigger-ревилом — скроллим колесом, как человек,
// иначе контент остаётся скрытым после мгновенного прыжка.
{
  const targetY = await page.evaluate(() => {
    const el = document.querySelector('#sheet-07');
    return el ? el.getBoundingClientRect().top + window.scrollY - 320 : 0;
  });
  let cur = await page.evaluate(() => window.scrollY);
  for (let i = 0; i < 40 && cur < targetY; i += 1) {
    await page.mouse.wheel(0, Math.min(800, targetY - cur));
    await page.waitForTimeout(120);
    cur = await page.evaluate(() => window.scrollY);
  }
}
await page.waitForSelector('#sheet-07 button', { state: 'attached', timeout: 20000 });
const reveal = page.getByRole('button', { name: /РАСКРЫТЬ|REVEAL/ });
// gsap-ревил держит лист в visibility:hidden, пока ScrollTrigger не сработает:
// ждём видимость, при необходимости подталкиваем скроллом.
try {
  await reveal.waitFor({ state: 'visible', timeoutMs: 6000 });
} catch {
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.wheel(0, 140);
    await page.waitForTimeout(250);
    await page.mouse.wheel(0, -140);
    await page.waitForTimeout(250);
    try {
      await reveal.waitFor({ state: 'visible', timeoutMs: 2000 });
      break;
    } catch { /* ещё трясём */ }
  }
}
await page.waitForTimeout(400);
const revealCount = await reveal.count();
log('T1 reveal count:', revealCount);
if (revealCount === 1) {
  // Кнопка может быть в середине gsap-ревила (opacity) — force-клик по реальным
  // координатам; сам ревил сайта здесь не тестируем.
  await reveal.click({ force: true });
  await page.waitForTimeout(300);
  await shot(page, 't1_shards_fly');
  await page.waitForTimeout(1500);
  const t1 = await page.evaluate(() => ({
    shards: document.querySelectorAll('.physics-shard').length,
    telHidden: (() => {
      const rows = [...document.querySelectorAll('.stamp-grid__row')];
      const tel = rows.find((r) => r.textContent.includes('TEL'));
      return tel ? getComputedStyle(tel).visibility : null;
    })(),
  }));
  log('T1 shatter:', JSON.stringify(t1));
  await shot(page, 't1_shards_rest');

  // ================= Т2: корзина появляется при захвате, ест осколки, уезжает
  const mouth = await page.evaluate(() => {
    const bin = document.querySelector('.physics-bin');
    if (!bin) return null;
    const r = bin.getBoundingClientRect();
    return { x: Math.max(26, r.x + r.width * 0.62), y: r.y + r.height * 0.42 };
  });
  log('T2 bin mouth:', JSON.stringify(mouth));
  let eaten = 0;
  for (let round = 0; round < 30; round += 1) {
    const shards = await page.evaluate(
      () => document.querySelectorAll('.physics-shard').length,
    );
    if (shards === 0) break;
    // Прицеливаемся по РЕАЛЬНЫМ позициям тел (transform осколка ≠ позиция тела).
    const d = await page.evaluate(() => window.__physicsDebug?.());
    if (!d || d.bodies.length === 0) break;
    const target = d.bodies.reduce((a, b) =>
      Math.hypot(b.x - d.bin.x, b.y - d.bin.y) < Math.hypot(a.x - d.bin.x, a.y - d.bin.y) ? b : a,
    );
    const cx = target.x;
    const cy = target.y;
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(120);
    await page.mouse.down();
    await page.waitForTimeout(150);
    // медленно тащим и держим у рта: constraint дотягивает тело в сенсор
    for (let i = 1; i <= 14; i += 1) {
      await page.mouse.move(cx + ((mouth.x - cx) * i) / 14, cy + ((mouth.y - cy) * i) / 14, {
        steps: 1,
      });
      await page.waitForTimeout(55);
    }
    await page.waitForTimeout(600);
    await page.mouse.up();
    await page.waitForTimeout(800);
    const now = await page.evaluate(
      () => document.querySelectorAll('.physics-shard').length,
    );
    if (now < shards) eaten += shards - now;
    log(`T2 round ${round}: ${shards} -> ${now} (eaten ${eaten})`);
  }
  await page.waitForTimeout(1100);
  const t2 = await page.evaluate(() => ({
    binGone: document.querySelector('.physics-bin')?.className ?? null,
    shardsLeft: document.querySelectorAll('.physics-shard').length,
  }));
  log('T2 bin final:', JSON.stringify(t2), 'eaten:', eaten);
  await shot(page, 't2_bin_gone');
} else {
  log('T1: кнопка РАСКРЫТЬ не найдена');
}

// ============================== Т3: кнопка темы ==============================
// Возврат наверх принудительно: CSS scroll-behavior может делать scrollTo
// плавным, а плавный скролл к началу редко успевает за тест.
await page.evaluate(() => {
  window.__t3mark = 'pre-clicks';
});
let sy = await page.evaluate(() => Math.round(window.scrollY));
for (let i = 0; i < 40 && sy > 40; i += 1) {
  await page.mouse.wheel(0, -Math.max(500, sy));
  await page.waitForTimeout(120);
  sy = await page.evaluate(() => Math.round(window.scrollY));
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForSelector('[data-theme-stamp]', { timeout: 20000 });
await page.waitForTimeout(900);
// Кликаем до появления «ПРИБИТЬ» (максимум 6): каждый клик обязан.flip-нуть тему.
for (let i = 0; i < 6; i += 1) {
  const state = await page.evaluate(() => ({
    btn: !!document.querySelector('[data-theme-stamp]'),
    theme: document.documentElement.dataset.theme,
  }));
  if (!state.btn) break;
  const btn = page.locator('[data-theme-stamp]');
  await btn.click({ timeoutMs: 3000 });
  await page.waitForTimeout(950);
  const after = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    nailBtn: [...document.querySelectorAll('header button')].some(
      (b) => b.textContent.trim() === 'ПРИБИТЬ',
    ),
  }));
  if (after.nailBtn) {
    log(`T3 detached on click ${i + 1}`);
    break;
  }
  if (after.theme === state.theme) {
    log(`T3 click ${i + 1} не дошёл (тема не изменилась) — повтор`);
  }
}
await page.waitForTimeout(1300);
const t3 = await page.evaluate(() => ({
  t3mark: window.__t3mark ?? 'RELOADED',
  pieces: document.querySelectorAll('.physics-piece').length,
  pieceTransform: document.querySelector('.physics-piece')?.style.transform?.slice(0, 60) ?? null,
  binClass: document.querySelector('.physics-bin')?.className ?? null,
  sketch: !!document.querySelector('.sketch-cover'),
  nailBtn: [...document.querySelectorAll('header button')].some(
    (b) => b.textContent.trim() === 'ПРИБИТЬ',
  ),
  theme: document.documentElement.dataset.theme,
}));
log('T3 detach:', JSON.stringify(t3));
await shot(page, 't3_detached');

// бросок вправо-вверх — прочь от корзины (только кнопка, не осколки!)
const themeBefore = t3.theme;
{
  // прицеливание по РЕАЛЬНОМУ телу + ретраи: кусок может медленно катиться
  let grabbed = false;
  for (let attempt = 0; attempt < 6 && !grabbed; attempt += 1) {
    const d = await page.evaluate(() => window.__physicsDebug?.());
    const b = d?.bodies?.[0];
    if (!b) break;
    await page.mouse.move(b.x, b.y);
    await page.waitForTimeout(160);
    await page.mouse.down();
    await page.waitForTimeout(220);
    const dbg = await page.evaluate(() => window.__physicsDebug?.());
    grabbed = dbg.grabbed;
    if (!grabbed) {
      const ev = await page.evaluate(() => (window.__evlog || []).slice(-5));
      log(`T3 grab fail ${attempt}: button=${dbg.mouse.button} mouse=(${dbg.mouse.x},${dbg.mouse.y}) ev=${JSON.stringify(ev)}`);
      await page.mouse.up();
      await page.waitForTimeout(350);
    }
  }
  log('T3 throw grab:', grabbed);
  if (grabbed) {
    const d = await page.evaluate(() => window.__physicsDebug?.());
    const b = d.bodies[0];
    for (let i = 1; i <= 5; i += 1) {
      const nx = Math.min(b.x + i * 70, 1400);
      const ny = Math.max(40, b.y - i * 60);
      await page.mouse.move(nx, ny, { steps: 1 });
      await page.waitForTimeout(14);
    }
    await page.mouse.up();
    await page.waitForTimeout(1700);
  }
}
const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme);
log('T3 throw:', themeBefore, '->', themeAfter);
await shot(page, 't3_after_throw');

// прибивание притаскиванием: ретраи захвата + удержание в зоне слота
{
  const slot = await page.evaluate(() => {
    // юзерская ревизия: слот-якорь вместо кнопки «ПРИБИТЬ»
    const b = document.querySelector('.nail-slot-anchor');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (slot) {
    let grabbed = false;
    for (let attempt = 0; attempt < 6 && !grabbed; attempt += 1) {
      const d = await page.evaluate(() => window.__physicsDebug?.());
      const b = d?.bodies?.[0];
      if (!b) break;
      await page.mouse.move(b.x, b.y);
      await page.waitForTimeout(160);
      await page.mouse.down();
      await page.waitForTimeout(220);
      grabbed = (await page.evaluate(() => window.__physicsDebug?.())).grabbed;
      if (!grabbed) {
        await page.mouse.up();
        await page.waitForTimeout(350);
      }
    }
    log('T3 nail grab:', grabbed);
    if (grabbed) {
      // медленно тащим к слоту
      const d = await page.evaluate(() => window.__physicsDebug?.());
      const b = d.bodies[0];
      for (let i = 1; i <= 18; i += 1) {
        await page.mouse.move(b.x + ((slot.x - b.x) * i) / 18, b.y + ((slot.y - b.y) * i) / 18, {
          steps: 1,
        });
        await page.waitForTimeout(45);
      }
      // ДЕРЖИМ: constraint дотягивает тело в зону, прибивание срабатывает при удержании
      await page.waitForTimeout(1200);
      const hold = await page.evaluate(() => window.__physicsDebug?.());
      log('T3 nail hold:', JSON.stringify({ grabbed: hold?.grabbed, nail: hold?.nail }));
      await shot(page, 't3_nailing');
      await page.mouse.up();
      await page.waitForTimeout(400);
      await shot(page, 't3_hammer');
    }
    const fx = await page.evaluate(() => ({
      fx: !!document.querySelector('.nail-fx'),
      hammer: !!document.querySelector('.nail-fx__hammer'),
      nails: document.querySelectorAll('.nail-fx__nail').length,
    }));
    log('T3 fx:', JSON.stringify(fx));
    await page.waitForTimeout(2800);
  }
}
const t3final = await page.evaluate(() => ({
  sceneGone: !document.querySelector('.physics-scene'),
  themeBtnBack: !!document.querySelector('[data-theme-stamp]'),
  fxGone: !document.querySelector('.nail-fx'),
}));
log('T3 final:', JSON.stringify(t3final));
await shot(page, 't3_restored');

// ============================== Т4: пасхалка (перезагрузка) ==================
await page.evaluate(() => {
  window.__marker = 'alive';
});
for (let i = 0; i < 3; i += 1) {
  const r = await page.evaluate(() => {
    const b = document.querySelector('[data-theme-stamp]');
    if (!b) return null;
    const q = b.getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  });
  if (!r) break;
  await page.mouse.click(r.x, r.y);
  await page.waitForTimeout(900);
}
await page.waitForTimeout(1300);
{
  const p = await settledPiecePos('.physics-piece:not(.physics-shard)');
  if (p) {
    // тащим кусок прямо в рот корзины и отпускаем там
    const mouth = await page.evaluate(() => {
      const bin = document.querySelector('.physics-bin');
      if (!bin) return { x: 60, y: 700 };
      const r = bin.getBoundingClientRect();
      return { x: r.x + r.width * 0.6, y: r.y + r.height * 0.42 };
    });
    await page.mouse.move(p.x + 50, p.y + 16);
    await page.waitForTimeout(120);
    await page.mouse.down();
    for (let i = 1; i <= 12; i += 1) {
      await page.mouse.move(p.x + 50 + ((mouth.x - p.x - 50) * i) / 12, p.y + 16 + ((mouth.y - p.y - 16) * i) / 12, { steps: 1 });
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(300);
    await shot(page, 't4_cover');
    await page.mouse.up();
    await page.waitForTimeout(2000);
  }
}
const t4 = await page.evaluate(() => ({
  marker: window.__marker ?? 'RELOADED',
  sketch: !!document.querySelector('.sketch-cover'),
}));
log('T4 easter egg:', JSON.stringify(t4));

await browser.close();
log('DONE');
