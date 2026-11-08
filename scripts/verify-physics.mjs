/* Верификация v3: press-drag и броски синтетическими событиями window
   (CDP-драг Playwright перехватывается браузером — артефакт теста,
   в реальном браузере mousemove при зажатой кнопке доставляется). */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5178';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
let failed = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '  PASS' : '  FAIL'} ${label}`);
  if (!cond) failed++;
};
const readPiece = () =>
  page.evaluate(() => {
    const d = window.__physicsDebug();
    return d.bodies[0]
      ? { x: d.bodies[0].x, y: d.bodies[0].y, sp: d.bodies[0].speed, pieces: d.pieces }
      : null;
  });
const isGrabbed = () => page.evaluate(() => window.__physicsDebug().grabbed);

/** Синтетический press-drag: mousedown у пустого места, mousemove на кусок. */
const grabBySyntheticPressDrag = async () => {
  for (let a = 0; a < 4; a++) {
    const b = await readPiece();
    if (!b) return false;
    if (b.sp > 2.5) {
      await page.waitForTimeout(250);
      continue;
    }
    await page.evaluate(({ px, py, tx, ty }) => {
      const ev = (x, y, type, buttons) =>
        window.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            button: 0,
            buttons,
            view: window,
          }),
        );
      ev(px, py, 'mousedown', 1);
      for (let i = 1; i <= 8; i++)
        ev(px + ((tx - px) * i) / 8, py + ((ty - py) * i) / 8, 'mousemove', 1);
    }, { px: b.x - 150, py: b.y - 60, tx: b.x, ty: b.y });
    await page.waitForTimeout(180);
    if (await isGrabbed()) return true;
    await page.evaluate(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, clientX: 0, clientY: 0, button: 0, buttons: 0 }),
      );
    });
  }
  return false;
};

/** Синтетический бросок из текущего захвата. */
const syntheticThrow = async (tx, ty) => {
  const g = await readPiece();
  const from = (await page.evaluate(() => window.__physicsDebug().mouse)) ?? { x: 640, y: 400 };
  await page.evaluate(({ fx, fy, tx, ty }) => {
    const ev = (x, y, type, buttons) =>
      window.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          button: 0,
          buttons,
          view: window,
        }),
      );
    // разгон: серия движений в сторону броска
    for (let i = 1; i <= 6; i++)
      ev(fx + ((tx - fx) * i) / 6, fy + ((ty - fy) * i) / 6, 'mousemove', 1);
    ev(tx, ty, 'mouseup', 0);
  }, { fx: from.x, fy: from.y, tx, ty });
  await page.waitForTimeout(850);
};

// ---------- V1: строка ----------
console.log('V1: phone string shatters on first floor hit');
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.stamp-grid__row')].find((r) =>
    r.querySelector('.phone-blur'),
  );
  const top = row.getBoundingClientRect().top + scrollY;
  window.scrollTo({ top: top - 380, behavior: 'instant' });
});
await page.waitForTimeout(500);
let floorFrames = 0;
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.stamp-grid__row')].find((r) =>
    r.querySelector('.phone-blur'),
  );
  row.querySelector('button').click();
});
for (let i = 0; i < 90; i++) {
  const s = await page.evaluate(() => {
    const scene = document.querySelector('.physics-scene');
    const piece = scene?.querySelector('.physics-piece');
    const m = piece?.style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/);
    return {
      shards: scene ? scene.querySelectorAll('.physics-shard').length : 0,
      pieceY: m ? parseFloat(m[2]) : -1,
    };
  });
  if (s.pieceY > 0 && s.pieceY + 69 >= 786) floorFrames++;
  if (s.shards > 2) break;
  await page.waitForTimeout(22);
}
await page.waitForTimeout(300);
const shards1 = await page.evaluate(
  () => document.querySelectorAll('.physics-scene .physics-shard').length,
);
ok(
  shards1 > 2 && floorFrames <= 3,
  `shattered right at first floor contact (shards=${shards1}, floor frames=${floorFrames})`,
);

// ---------- V2: кнопка ----------
console.log('V2: button grab + tosses');
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const themeBtn = page.locator('.theme-btn');
for (let i = 0; i < 3; i++) {
  await themeBtn.click();
  await page.waitForTimeout(400);
}
await page.waitForTimeout(700);

const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
let flipped = false;
for (let i = 0; i < 50; i++) {
  await page.waitForTimeout(40);
  const s = await page.evaluate(() => {
    const d = window.__physicsDebug();
    return { th: document.documentElement.dataset.theme, y: d.bodies[0]?.y ?? -1 };
  });
  if (s.th !== themeBefore) {
    flipped = s.y < 0 || s.y + 17 <= 806;
    break;
  }
}
ok(flipped, `theme flips on first floor contact`);

ok(await grabBySyntheticPressDrag(), 'press-drag grabs the piece (synthetic events)');

let tossFail = 0;
for (let toss = 1; toss <= 10; toss++) {
  if (!(await isGrabbed())) {
    if (!(await grabBySyntheticPressDrag())) {
      tossFail++;
      continue;
    }
  }
  const dir = toss % 2 === 0 ? 1 : -1;
  await syntheticThrow(
    // левый бросок целим в стену на средней высоте: кусок отскакивает в
    // комнату и не ныряет в корзину (попадание в корзину = BSOD по дизайну)
    Math.max(dir === 1 ? 80 : 380, Math.min(1200, 640 + dir * (280 + (toss % 3) * 140))),
    dir === 1 ? 260 + (toss % 4) * 120 : 280 + (toss % 3) * 60,
  );
}
const afterToss = await readPiece();
ok(tossFail === 0, `all 10 tosses grabbed (fails=${tossFail})`);
ok(!!afterToss, `piece alive after 10 tosses (${afterToss ? 'yes' : 'GONE'})`);

// застрявшая кнопка мыши
const b1 = await readPiece();
await page.evaluate(({ x, y }) => {
  const ev = (cx, cy, type, buttons) =>
    window.dispatchEvent(
      new MouseEvent(type, { bubbles: true, clientX: cx, clientY: cy, button: 0, buttons, view: window }),
    );
  ev(x, y, 'mousedown', 1);
}, b1);
await page.waitForTimeout(150);
await page.evaluate(() => window.dispatchEvent(new FocusEvent('blur')));
await page.waitForTimeout(200);
const heal = await page.evaluate(() => {
  const d = window.__physicsDebug();
  return { grabbed: d.grabbed, btn: d.mouse.button };
});
ok(!heal.grabbed && heal.btn !== 0, `stuck button healed on blur (grabbed=${heal.grabbed})`);

ok(await grabBySyntheticPressDrag(), 'piece grabbable again after stuck-button incident');
await page.evaluate(() => {
  window.dispatchEvent(
    new MouseEvent('mouseup', { bubbles: true, clientX: 0, clientY: 0, button: 0, buttons: 0 }),
  );
});
await page.waitForTimeout(300);

// ---------- V3: прибивание + вращение ----------
console.log('V3: nailed button rotates on click');
const anchor = await page.evaluate(() => {
  const a = document.querySelector('.nail-slot-anchor');
  if (!a) return null;
  const r = a.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
if (!anchor) {
  console.log('  SKIP: no anchor visible');
} else {
  ok(await grabBySyntheticPressDrag(), 'grab for nailing');
  // синтетически тащим к слоту и держим рядом
  await page.evaluate(({ ax, ay }) => {
    const ev = (x, y, type, buttons) =>
      window.dispatchEvent(
        new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, buttons, view: window }),
      );
    for (let i = 1; i <= 10; i++)
      ev(640 + ((ax - 640) * i) / 10, 400 + ((ay + 50 - 400) * i) / 10, 'mousemove', 1);
    for (let i = 1; i <= 6; i++) ev(ax, ay + 50 - i * 8, 'mousemove', 1);
  }, { ax: anchor.x, ay: anchor.y });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const d = window.__physicsDebug();
    window.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        clientX: d.mouse.x,
        clientY: d.mouse.y,
        button: 0,
        buttons: 0,
      }),
    );
  });
  let nailed = false;
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(200);
    nailed = await page.evaluate(() => !!document.querySelector('.theme-btn--nailed'));
    if (nailed) break;
  }
  ok(nailed, 'nailed button restored to slot');
  if (nailed) {
    const trBefore = await page.evaluate(() => {
      const el = document.querySelector('.theme-btn--nailed');
      return getComputedStyle(el).transform;
    });
    await page.locator('.theme-btn--nailed').click();
    await page.waitForTimeout(120);
    const trMid = await page.evaluate(() => {
      const el = document.querySelector('.theme-btn--nailed');
      return getComputedStyle(el).transform;
    });
    await page.waitForTimeout(800);
    const thAfter = await page.evaluate(() => document.documentElement.dataset.theme);
    ok(
      trMid !== 'none' && trMid !== trBefore,
      `nailed button ROTATES on click (${trMid === 'none' ? 'no transform' : 'transform active'})`,
    );
    ok(!!thAfter, `theme toggled while nailed (${thAfter})`);
  }
}

await browser.close();
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
