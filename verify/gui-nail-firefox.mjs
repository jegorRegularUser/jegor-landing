/* Nail FX в Firefox: что видит юзер в момент прибивания. */
import { firefox } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'verify/gui-physics';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('[ff]', ...a);

const browser = await firefox.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => log('PAGEERROR:', String(e).slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') log('CONSOLE', m.type(), m.text().slice(0, 200));
});

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.bringToFront();
await page.waitForSelector('[data-theme-stamp]', { timeout: 20000 });
await page.waitForTimeout(1500);

for (let i = 0; i < 3; i += 1) {
  const btn = page.locator('[data-theme-stamp]');
  if ((await btn.count()) === 0) break;
  await btn.click({ timeoutMs: 3000 });
  await page.waitForTimeout(900);
}
await page.waitForTimeout(1500);
const dbg = await page.evaluate(() => window.__physicsDebug?.());
if (!dbg || !dbg.bodies.length) {
  log('нет куска');
  await browser.close();
  process.exit(1);
}
const slot = await page.evaluate(() => {
  const el = document.querySelector('.nail-slot-anchor');
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
const b = dbg.bodies[0];
log('piece at', b.x, b.y, 'slot', JSON.stringify(slot));
await page.mouse.move(b.x, b.y);
await page.waitForTimeout(160);
await page.mouse.down();
await page.waitForTimeout(250);
const grabbed = (await page.evaluate(() => window.__physicsDebug?.())).grabbed;
log('grabbed:', grabbed);
if (grabbed) {
  for (let i = 1; i <= 18; i += 1) {
    await page.mouse.move(b.x + ((slot.x - b.x) * i) / 18, b.y + ((slot.y - b.y) * i) / 18, {
      steps: 1,
    });
    await page.waitForTimeout(45);
  }
  // ждём появления fx и снимаем несколько кадров с телеметрией
  for (let i = 0; i < 6; i += 1) {
    await page.waitForTimeout(400);
    const fxState = await page.evaluate(() => {
      const fx = document.querySelector('.nail-fx');
      const hammer = document.querySelector('.nail-fx__hammer');
      const nails = [...document.querySelectorAll('.nail-fx__nail')];
      const info = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
          vis: cs.visibility, op: cs.opacity, src: el.src?.split('/').pop() ?? null,
          transform: cs.transform === 'none' ? 'none' : cs.transform.slice(0, 34),
        };
      };
      return { fx: info(fx), hammer: info(hammer), nails: nails.map(info) };
    });
    log(`+${(i + 1) * 400}ms:`, JSON.stringify(fxState));
    if (i === 1) {
      await page.screenshot({ path: `${OUT}/ff_nail_1.png`, timeout: 15000 });
    }
    if (i === 2) {
      await page.screenshot({ path: `${OUT}/ff_nail_2.png`, timeout: 15000 });
    }
  }
  await page.mouse.up();
  await page.waitForTimeout(1500);
}
const fin = await page.evaluate(() => ({
  scene: !!document.querySelector('.physics-scene'),
  themeBtnBack: !!document.querySelector('[data-theme-stamp]'),
}));
log('final:', JSON.stringify(fin));
await browser.close();
log('DONE');
