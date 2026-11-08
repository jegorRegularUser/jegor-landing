/* Обёртка matter.js (динамический импорт — движок не в критическом чанке).
   Сцена = фиксированный полноэкранный слой: толстые стенки за краями вьюпорта,
   детали перетаскиваются мышью/тачем, бросок считается по буферу позиций
   (пружина MouseConstraint гасит скорость — известная проблема #270).
   Два режима fragmentize: 'solid' — элемент целиком (кнопка темы),
   'shatter' — вороной-осколки через d3-delaunay (клетки выпуклые, поэтому
   Bodies.fromVertices работает без poly-decomp). Осколки докалываются о края
   экрана: выпуклый полигон режется плоскостью (Sutherland–Hodgman).
   Корзина-сенсор у левого нижнего угла съедает детали и уезжает, когда пусто.
   Кнопку можно прибить: притаскиваешь к слоту — молоток забивает гвозди (11). */

import type { Engine, Body, Mouse as MatterMouse } from 'matter-js';
import { Delaunay } from 'd3-delaunay';
import { gsap } from './gsap';
import { playNailFx } from './nailFx';
import binSrc from '../assets/bin.png';

export interface FragmentOptions {
  /** solid = одна деталь (кнопка), shatter = вороной-осколки (строка). */
  mode?: 'solid' | 'shatter';
  restitution?: number;
  density?: number;
  /** Точка удара в координатах вьюпорта — от неё разлетаются осколки. */
  impact?: { x: number; y: number } | null;
  /** Сколько осколков генерировать (по умолчанию 9). */
  shards?: number;
  /** Прямоугольник элемента, снятый ДО его размонтирования (у отсоединённого
   *  узла rect нулевой). width/height — натуральные (offsetWidth/Height). */
  rect?: { left: number; top: number; width: number; height: number };
  /** Подскок вверх при отрыве (px/шаг) — кусок «срывается с гвоздей». */
  kickUp?: number;
}

export interface Playground {
  /** Превращает DOM-элемент в физику; для solid возвращает тело. */
  fragmentize(el: HTMLElement, opts?: FragmentOptions): Body | null;
  /** Корзина-сенсор: onEnter — кусок попал внутрь, onAllGone — все убраны. */
  setBin(onEnter: (el: HTMLElement) => void, onAllGone?: () => void): void;
  /** Прибить тело к слоту anchor: притаскивание рядом запускает молоток. */
  setNailBack(anchor: HTMLElement, body: Body, onDone: () => void): void;
  /** Пауза физики (невидимая вкладка). */
  setPaused(v: boolean): void;
  destroy(): void;
}

interface Pt {
  x: number;
  y: number;
}

/** @types/matter-js не декларирует handler-поля Mouse, в рантайме они есть. */
type MouseWithHandlers = MatterMouse & {
  mousemove: (e: MouseEvent | TouchEvent) => void;
  mouseup: (e: MouseEvent | TouchEvent) => void;
};

interface PieceMeta {
  el: HTMLElement;
  /** Исходник для клонов при докалывании (только осколки). */
  src?: HTMLElement;
  rectW: number;
  rectH: number;
  /** Полигон в координатах исходного элемента (осколки). */
  poly?: Pt[];
  /** Центроид полигона (или центра) в координатах исходника. */
  cx: number;
  cy: number;
  kind: 'solid' | 'shard';
  canSplit: boolean;
  splitDepth: number;
  area: number;
  grabScale: number;
  /** Скорость до шага: в collisionStart она уже частично погашена резолвером —
   *  кэшируем значение из beforeUpdate для стабильного порога. */
  prevSpeed: number;
}

const SPLIT_SPEED = 9; // скорость докалывания осколка уровня 0
const SPLIT_SPEED_2 = 12; // последний уровень — нужен сильный бросок
const MAX_DEPTH = 2;
const MIN_SHARD_AREA = 16; // крошка тоже живёт — слова не должны исчезать
const MIN_SPLIT_AREA = 900; // мельче — не докалывается
const THROW_CAP = 60; // px/шаг, против тоннелирования
const BIN_W = 210; // корзина вылезает примерно на половину картинки (16)

function polyArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a / 2);
}

function polyCentroid(poly: Pt[]): Pt {
  let sx = 0;
  let sy = 0;
  let a = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    sx += (p.x + q.x) * cross;
    sy += (p.y + q.y) * cross;
  }
  a /= 2;
  if (Math.abs(a) < 1e-6) {
    // вырожденный: среднее вершин
    const n = poly.length || 1;
    return {
      x: poly.reduce((s, p) => s + p.x, 0) / n,
      y: poly.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  return { x: sx / (6 * a), y: sy / (6 * a) };
}

/** Знаковая площадь: положительная = clockwise в экранных координатах (y вниз),
 *  как ждёт matter-js. */
function signedArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function ensureClockwise(poly: Pt[]): void {
  if (signedArea(poly) < 0) poly.reverse();
}

/** Отрезает от выпуклого полигона полуплоскость dot(p - origin, n) >= 0. */
function clipHalfPlane(poly: Pt[], origin: Pt, nx: number, ny: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = (a.x - origin.x) * nx + (a.y - origin.y) * ny;
    const db = (b.x - origin.x) * nx + (b.y - origin.y) * ny;
    if (da >= 0) out.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** Клип произвольного (слабо-вогнутого) полинома по выпуклому:
 *  последовательный SH-клип по каждому рёберному полупространству клипа. */
function clipByConvex(subject: Pt[], clip: Pt[]): Pt[] {
  let out = subject;
  const cc = polyCentroid(clip);
  for (let i = 0; i < clip.length && out.length >= 3; i += 1) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    let nx = -(b.y - a.y);
    let ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    // нормаль должна смотреть внутрь клипа (к его центроиду)
    if ((cc.x - a.x) * nx + (cc.y - a.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    out = clipHalfPlane(out, a, nx, ny);
  }
  return out;
}

/** Мини-вороной внутри прямоугольника: n точек с джиттером → выпуклые клетки. */
function voronoiInBox(minX: number, minY: number, w: number, h: number, n: number): Pt[][] {
  if (w < 30 || h < 18) return [];
  const pad = 0.18;
  const pts: Pt[] = [
    { x: minX + w / 2 + (Math.random() - 0.5) * w * 0.2, y: minY + h / 2 + (Math.random() - 0.5) * h * 0.2 },
  ];
  for (let i = 0; i < n; i += 1) {
    pts.push({
      x: minX + w * (pad + Math.random() * (1 - pad * 2)),
      y: minY + h * (pad + Math.random() * (1 - pad * 2)),
    });
  }
  const delaunay = Delaunay.from(
    pts,
    (q) => q.x,
    (q) => q.y,
  );
  const vor = delaunay.voronoi([minX, minY, minX + w, minY + h]);
  const cells: Pt[][] = [];
  for (let i = 0; i < pts.length; i += 1) {
    const cell = vor.cellPolygon(i);
    if (!cell || cell.length < 4) continue;
    cells.push(cell.slice(0, -1).map((q) => ({ x: q[0], y: q[1] })));
  }
  return cells;
}

export async function createPlayground(
  container: HTMLElement,
  hooks: { onImpact?: (piece: HTMLElement, speed: number) => void } = {},
): Promise<Playground> {
  // matter-js — CJS-пакет: default-interop обязателен, иначе краш (приёмка 15).
  const mod = await import('matter-js');
  const Matter = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
  const { Engine, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Events, Bounds } =
    Matter;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = document.createElement('div');
  scene.className = 'physics-scene';
  scene.setAttribute('aria-hidden', 'true');
  container.appendChild(scene);

  const engine: Engine = Engine.create({ gravity: { x: 0, y: 1.4, scale: 0.001 } });
  const runner = Runner.create();
  Runner.run(runner, engine);

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  // Стенки толстые (240px) и целиком за краем вьюпорта: быстрые куски не пробивают.
  let walls: Body[] = [];
  const buildWalls = () => {
    Composite.remove(engine.world, walls);
    const T = 240;
    walls = [
      Bodies.rectangle(W() / 2, H() + T / 2, W() * 2, T, { isStatic: true }),
      Bodies.rectangle(W() / 2, -T / 2, W() * 2, T, { isStatic: true }),
      Bodies.rectangle(-T / 2, H() / 2, T, H() * 2, { isStatic: true }),
      Bodies.rectangle(W() + T / 2, H() / 2, T, H() * 2, { isStatic: true }),
    ];
    Composite.add(engine.world, walls);
  };
  buildWalls();

  const mouse = Mouse.create(scene) as MouseWithHandlers;
  // MouseConstraint слушает mousemove/mouseup на сцене, но сцена стоит с
  // pointer-events: none — события над страницей через неё не всплывают.
  // Без перевеса на window кусок прилипает к курсору при любом быстром
  // броске (релиз мимо куска не доходит до движка).
  scene.removeEventListener('mousemove', mouse.mousemove);
  scene.removeEventListener('mouseup', mouse.mouseup);
  window.addEventListener('mousemove', mouse.mousemove, { passive: true });
  window.addEventListener('mouseup', mouse.mouseup, { passive: true });
  const mc = MouseConstraint.create(engine, {
    mouse,
    // 0.1 слишком мягко для тяжёлых осколков: еле ползут за мышью. Бросок
    // всё равно считается вручную по буферу позиций на enddrag.
    constraint: { stiffness: 0.2, render: { visible: false } },
  });
  // touchend на window без preventDefault: тапы по сайту не ломаем.
  const onWindowTouchEnd = (e: Event) => {
    if (mc.body) mouse.mouseup(e as unknown as MouseEvent);
  };
  window.addEventListener('touchend', onWindowTouchEnd);
  Composite.add(engine.world, mc);

  const pieces = new Set<Body>();

  // --- корзина ------------------------------------------------------------
  let binEl: HTMLElement | null = null;
  let binBody: Body | null = null;
  let binShown = false;
  let binGone = false;
  let onBinEnter: ((el: HTMLElement) => void) | null = null;
  let onBinAllGone: (() => void) | null = null;
  let binExitTimer = 0;

  // Пропорции bin.png (441×680); на низких окнах корзина не выше 46% высоты.
  const binSize = () => {
    const h = Math.min(BIN_W * (680 / 441), H() * 0.46);
    return { w: h * (441 / 680), h };
  };

  // Утоплена сильно: над «полом» только верхняя часть (~45% высоты картинки).
  const placeBin = () => {
    if (!binEl) return;
    const { w, h } = binSize();
    const left = -w * 0.22; // край картинки за экраном
    const top = H() - h * 0.45;
    binEl.style.width = `${w}px`;
    binEl.style.left = `${left}px`;
    binEl.style.top = `${top}px`;
    if (!binBody) return;
    // Сенсор строго по НАДВОДНОЙ части: ниже уровня экрана куски не пропадают.
    Body.setPosition(binBody, {
      x: left + w * 0.62,
      y: top + (h * 0.45) * 0.5,
    });
  };

  const showBin = () => {
    if (binShown || binGone || !binEl) return;
    binShown = true;
    binEl.classList.add('physics-bin--in');
    placeBin();
    // Сенсор встаёт в мир только вместе с видимой корзиной.
    if (binBody && !binGone) Composite.add(engine.world, binBody);
  };

  const removePiece = (body: Body) => {
    const meta = body.plugin.meta as PieceMeta | undefined;
    if (meta?.el) meta.el.remove();
    Composite.remove(engine.world, body);
    pieces.delete(body);
  };

  const scheduleBinExit = () => {
    if (binGone || !binEl) return;
    binGone = true;
    binExitTimer = window.setTimeout(() => {
      binEl?.classList.add('physics-bin--out');
      if (binBody) Composite.remove(engine.world, binBody);
      onBinAllGone?.();
    }, 450);
  };

  // --- осколки ------------------------------------------------------------
  const syncShard = (meta: PieceMeta, body: Body) => {
    const gap = meta.kind === 'shard' ? 0.985 : 1; // щели-трещины между осколками
    const s = meta.grabScale * gap;
    meta.el.style.transform = `translate3d(${body.position.x - meta.cx}px, ${
      body.position.y - meta.cy
    }px, 0) rotate(${body.angle}rad) scale(${s})`;
  };

  const makeShard = (
    src: HTMLElement,
    rectW: number,
    rectH: number,
    poly: Pt[],
    pos: Pt,
    angle: number,
    velocity?: { x: number; y: number },
    depth = 0,
  ): Body | null => {
    if (poly.length < 3) return null;
    ensureClockwise(poly);
    const area = polyArea(poly);
    if (area < MIN_SHARD_AREA) return null;
    const centroid = polyCentroid(poly);
    const clone = src.cloneNode(true) as HTMLElement;
    clone.classList.add('physics-piece', 'physics-shard');
    // Исходник скрыт до клонирования — inline-visibility переехал бы в осколок;
    // opacity мог замереть на середине твина штампа.
    clone.style.visibility = 'visible';
    clone.style.opacity = '';
    clone.removeAttribute('data-theme-stamp');
    // inert на корне запрещает и pointer-events — кусок нельзя схватить.
    // Блокируем только таб-фокус на интерактивных потомках.
    clone
      .querySelectorAll('button, a, input, select, textarea')
      .forEach((n) => n.setAttribute('tabindex', '-1'));
    clone.style.width = `${rectW}px`;
    clone.style.height = `${rectH}px`;
    clone.style.clipPath = `polygon(${poly.map((p) => `${p.x}px ${p.y}px`).join(',')})`;
    clone.style.transformOrigin = `${centroid.x}px ${centroid.y}px`;
    clone.style.transform = `translate3d(${pos.x - centroid.x}px, ${pos.y - centroid.y}px, 0) rotate(${angle}rad)`;
    scene.appendChild(clone);
    const meta: PieceMeta = {
      el: clone,
      src,
      rectW,
      rectH,
      poly,
      cx: centroid.x,
      cy: centroid.y,
      kind: 'shard',
      canSplit: depth < MAX_DEPTH,
      splitDepth: depth,
      area,
      grabScale: 1,
      prevSpeed: 0,
    };
    const body = Bodies.fromVertices(pos.x, pos.y, [poly], {
      restitution: 0.5,
      friction: 0.08,
      frictionAir: 0.015,
      angle,
      plugin: { meta },
    });
    if (!body) return null;
    Body.setInertia(body, body.inertia * 2.5);
    if (velocity) Body.setVelocity(body, velocity);
    pieces.add(body);
    Composite.add(engine.world, body);
    return body;
  };

  const splitShard = (body: Body, meta: PieceMeta) => {
    if (!meta.poly || !meta.src) return;
    // Одно тело может попасть в две пары одного collisionStart (угол+пол):
    // без сброса флага получим 4 наложенных осколка вместо 2.
    meta.canSplit = false;
    const c = polyCentroid(meta.poly);
    const xs = meta.poly.map((q) => q.x);
    const ys = meta.poly.map((q) => q.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    // Докалывание — мини-вороной по bbox осколка: неровные «стеклянные»
    // куски вместо плоских полос от бисекции вытянутого осколка.
    const cells = voronoiInBox(minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY, 3);
    const parts = cells
      .map((cell) => clipByConvex(cell, meta.poly!))
      .filter((poly) => poly.length >= 3 && polyArea(poly) >= MIN_SHARD_AREA);
    if (parts.length < 2) return;
    const { x: px, y: py } = body.position;
    const cos = Math.cos(body.angle);
    const sin = Math.sin(body.angle);
    const v = body.velocity;
    removePiece(body);
    for (const poly of parts) {
      const child = polyCentroid(poly);
      const dx = child.x - c.x;
      const dy = child.y - c.y;
      // центроид потомка в мире: P + R(angle)·(c_child − c_parent)
      const kick = 1.4 + Math.random() * 1.8;
      const ang = Math.atan2(dy, dx) || Math.random() * Math.PI * 2;
      makeShard(
        meta.src,
        meta.rectW,
        meta.rectH,
        poly,
        { x: px + dx * cos - dy * sin, y: py + dx * sin + dy * cos },
        body.angle,
        {
          x: v.x + Math.cos(ang) * kick,
          y: v.y + Math.sin(ang) * kick - 0.6,
        },
        meta.splitDepth + 1,
      );
    }
  };

  /** Корзина не аннигилирует: тело уходит из мира сразу, а клон доедает
   *  инерцию внутрь корзины и растворяется на глазах. */
  const swallowPiece = (body: Body, bin: Body) => {
    const meta = body.plugin.meta as PieceMeta | undefined;
    if (!meta || !meta.el) return;
    if (mc.body === body) {
      mc.constraint.bodyB = null;
      (mc as unknown as { body: Body | null }).body = null;
    }
    const el = meta.el;
    const v = body.velocity;
    Composite.remove(engine.world, body);
    pieces.delete(body);
    if (pieces.size === 0) scheduleBinExit();
    gsap.to(el, {
      x: `+=${bin.position.x - body.position.x + v.x * 12}`,
      y: `+=${bin.position.y - body.position.y + v.y * 12 + 30}`,
      rotation: `+=${(Math.random() - 0.5) * 80}`,
      scale: 0.45,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => el.remove(),
    });
  };

  // --- столкновения -------------------------------------------------------
  Events.on(engine, 'collisionStart', (e) => {
    for (const pair of e.pairs) {
      const [a, b] = [pair.bodyA, pair.bodyB];
      for (const [body, other] of [
        [a, b],
        [b, a],
      ]) {
        const meta = body.plugin?.meta as PieceMeta | undefined;
        if (!meta) continue;
        if (other.plugin?.bin) {
          // Корзина ест ВСЕ куски, обработчик живёт до destroy (был баг: снимался после первого).
          onBinEnter?.(meta.el);
          swallowPiece(body, other);
          continue;
        }
        const speed = meta.prevSpeed;
        if (speed > 3) hooks.onImpact?.(meta.el, speed);
        if (
          meta.kind === 'shard' &&
          meta.canSplit &&
          meta.area > MIN_SPLIT_AREA &&
          speed > (meta.splitDepth === 0 ? SPLIT_SPEED : SPLIT_SPEED_2)
        ) {
          splitShard(body, meta);
        }
      }
    }
  });

  // Кэш скорости до шага физики + бросок по буферу позиций.
  const throwHistory: { t: number; x: number; y: number }[] = [];
  let grabOffset: Pt = { x: 0, y: 0 };

  Events.on(engine, 'beforeUpdate', () => {
    for (const body of pieces) {
      const meta = body.plugin.meta as PieceMeta | undefined;
      if (meta) meta.prevSpeed = body.speed;
    }
    // ЖЁСТКИЕ ГРАНИЦЫ: bounds тела не имеют права пересечь видимую область —
    // ни на прогнозе, ни на факте. Двойная защита: до шага и после него.
    const clampBounds = (hard: boolean) => {
      const top = 2;
      const left = 2;
      for (const body of pieces) {
        const b = body.bounds;
        const maxY = H() - 4;
        const maxX = W() - 4;
        const out =
          b.max.y > maxY || b.min.y < top || b.max.x > maxX || b.min.x < left;
        if (!out) continue;
        const dx =
          b.max.x > maxX ? b.max.x - maxX : b.min.x < left ? b.min.x - left : 0;
        const dy = b.max.y > maxY ? b.max.y - maxY : b.min.y < top ? b.min.y - top : 0;
        if (hard || !hard) {
          // сдвигаем тело внутрь ровно на величину выхода
          Body.setPosition(body, { x: body.position.x - dx, y: body.position.y - dy });
          const vv = body.velocity;
          if (dy > 0 && vv.y > 0) {
            Body.setVelocity(body, { x: vv.x * 0.7, y: -Math.abs(vv.y) * 0.45 - 1.2 });
          } else if (dy < 0 && vv.y < 0) {
            Body.setVelocity(body, { x: vv.x * 0.7, y: Math.abs(vv.y) * 0.45 });
          } else if (dx > 0 && vv.x > 0) {
            Body.setVelocity(body, { x: -Math.abs(vv.x) * 0.45 - 1.2, y: vv.y });
          } else if (dx < 0 && vv.x < 0) {
            Body.setVelocity(body, { x: Math.abs(vv.x) * 0.45, y: vv.y });
          }
        }
      }
    };
    // прогноз до шага: скорость, уводящая bounds за край, гасится заранее
    for (const body of pieces) {
      const vv = body.velocity;
      if (body.bounds.max.y + vv.y > H() - 4 && vv.y > 0) {
        Body.setVelocity(body, { x: vv.x, y: -Math.abs(vv.y) * 0.4 - 1 });
      }
      if (body.bounds.min.x + vv.x < 2 && vv.x < 0) {
        Body.setVelocity(body, { x: Math.abs(vv.x) * 0.4 + 1, y: vv.y });
      }
      if (body.bounds.max.x + vv.x > W() - 4 && vv.x > 0) {
        Body.setVelocity(body, { x: -Math.abs(vv.x) * 0.4 - 1, y: vv.y });
      }
    }
    clampBounds(false);
    // страховка от убеговших (тоннель/вырожденный полигон)
    let escaped: Body | null = null;
    for (const body of pieces) {
      if (
        body.position.y > H() + 3000 ||
        body.position.x < -3000 ||
        body.position.x > W() + 3000
      ) {
        escaped = body;
        break;
      }
    }
    if (escaped) {
      const meta = escaped.plugin.meta as PieceMeta | undefined;
      if (meta?.el) meta.el.remove();
      Composite.remove(engine.world, escaped);
      pieces.delete(escaped);
      if (pieces.size === 0) scheduleBinExit();
    }
    // бросок считается по МЫШИ (она = рука, 1:1 с махом): тело-то отстаёт
    // от пружины MouseConstraint и на релизе «не долетает».
    if (mc.body) {
      throwHistory.push({
        t: engine.timing.timestamp,
        x: mouse.position.x,
        y: mouse.position.y,
      });
      if (throwHistory.length > 6) throwHistory.shift();
    }
  });

  // Страховка после шага: физика всё равно протолкнула тело за край —
  // мгновенно возвращаем (один кадр, без видимого провала).
  Events.on(engine, 'afterUpdate', () => {
    const left = 2;
    const top = 2;
    for (const body of pieces) {
      const b = body.bounds;
      const maxY = H() - 4;
      const maxX = W() - 4;
      if (b.max.y > maxY || b.max.x > maxX || b.min.x < left || b.min.y < top) {
        const dx = b.max.x > maxX ? b.max.x - maxX : b.min.x < left ? b.min.x - left : 0;
        const dy = b.max.y > maxY ? b.max.y - maxY : b.min.y < top ? b.min.y - top : 0;
        Body.setPosition(body, { x: body.position.x - dx, y: body.position.y - dy });
      }
    }
  });

  // Вращение: тупые куски крутятся сами себя — гасим и утяжеляем момент.
  Events.on(engine, 'beforeUpdate', () => {
    for (const body of pieces) {
      if (Math.abs(body.angularVelocity) > 0.001) {
        Body.setAngularVelocity(body, body.angularVelocity * 0.97);
      }
      const sp = Math.hypot(body.velocity.x, body.velocity.y);
      if (sp > 42) {
        const k = 42 / sp;
        Body.setVelocity(body, { x: body.velocity.x * k, y: body.velocity.y * k });
      }
    }
  });

  Events.on(mc as never, 'startdrag', (e: unknown) => {
    const body = (e as { body?: Body }).body;
    showBin();
    if (!body) return;
    const meta = body.plugin?.meta as PieceMeta | undefined;
    if (!meta) return;
    if (body === nailBody) nailGrabbed = true;
    Body.setAngularVelocity(body, 0); // взял — кусок перестаёт крутиться сам
    meta.grabScale = 1.05;
    meta.el.classList.add('physics-piece--grab');
    grabOffset = { x: mouse.position.x - body.position.x, y: mouse.position.y - body.position.y };
    throwHistory.length = 0;
  });

  Events.on(mc as never, 'enddrag', (e: unknown) => {
    const body = (e as { body?: Body }).body;
    const meta = body?.plugin?.meta as PieceMeta | undefined;
    if (meta) {
      meta.grabScale = 1;
      meta.el.classList.remove('physics-piece--grab');
    }
    const first = throwHistory[0];
    const last = throwHistory[throwHistory.length - 1];
    throwHistory.length = 0;
    if (!body || !first || !last || last.t <= first.t || !meta) return;
    // Matter ждёт скорость в px/шаг (60 Гц): переводим px/мс → px/шаг.
    const steps = Math.max(1, (last.t - first.t) / 16.666);
    let vx = (last.x - first.x) / steps;
    let vy = (last.y - first.y) / steps;
    const mag = Math.hypot(vx, vy);
    if (mag > THROW_CAP) {
      vx *= THROW_CAP / mag;
      vy *= THROW_CAP / mag;
    }
    Body.setVelocity(body, { x: vx, y: vy });
    // Подкрутка от точки захвата: чем дальше взял от центра, тем сильнее
    // крутится; вращение ленивое (инерция утяжелена) — не «юла».
    const spin =
      (grabOffset.x * vy - grabOffset.y * vx) / (320 + grabOffset.x ** 2 + grabOffset.y ** 2);
    Body.setAngularVelocity(body, Math.max(-0.3, Math.min(0.3, spin)));
    // Отпустил в зоне слота — прибиваем сразу, не дожидаясь остановки:
    // на подлёте кусок слишком быстр, и триггер «почти стоит» его пропускает.
    if (body === nailBody && nailArmed && anchorRect) {
      measureAnchor();
      if (inNailZone(body)) beginNailing();
    }
  });

  // --- визуальный синк ----------------------------------------------------
  let raf = 0;
  const sync = () => {
    for (const body of pieces) {
      const meta = body.plugin.meta as PieceMeta | undefined;
      if (!meta || !meta.el) continue;
      syncShard(meta, body);
    }
    raf = requestAnimationFrame(sync);
  };
  raf = requestAnimationFrame(sync);

  // --- прибивание на место ------------------------------------------------
  let nailAnchor: HTMLElement | null = null;
  let nailBody: Body | null = null;
  let nailDone: (() => void) | null = null;
  let anchorRect: DOMRect | null = null;
  let nailing = false;
  let anchorScanRaf = 0;
  // Кусок рождается ровно на слоте — без этих флагов он «прибивается» сам
  // в момент спавна. Молоток включается, только если кусок схватили и унесли.
  let nailGrabbed = false;
  let nailArmed = false;

  const measureAnchor = () => {
    anchorRect = nailAnchor ? nailAnchor.getBoundingClientRect() : null;
  };

  // Якорь (слот кнопки в sticky-шапке) меняется при скролле — меряем лениво.
  const onScroll = () => {
    if (!anchorScanRaf) {
      anchorScanRaf = requestAnimationFrame(() => {
        anchorScanRaf = 0;
        measureAnchor();
      });
    }
  };

  const beginNailing = () => {
    const body = nailBody;
    if (!body || nailing) return;
    nailing = true;
    const meta = body.plugin.meta as PieceMeta;
    if (mc.body === body) {
      mc.constraint.bodyB = null;
      // Типы matter не допускают null, движок на этапе рантайма — допускает.
      (mc as unknown as { body: Body | null }).body = null;
    }
    Composite.remove(engine.world, body);
    pieces.delete(body);
    meta.grabScale = 1;
    meta.el.classList.remove('physics-piece--grab');
    meta.el.classList.add('physics-piece--nail');
    const r = anchorRect ?? nailAnchor!.getBoundingClientRect();
    const tx = r.left + r.width / 2 - meta.rectW / 2;
    const ty = r.top + r.height / 2 - meta.rectH / 2;
    gsap.to(meta.el, {
      x: tx,
      y: ty,
      rotation: 0,
      scale: 1,
      duration: reduced ? 0.01 : 0.42,
      ease: 'back.out(1.4)',
      onComplete: () => {
        playNailFx(meta.el, { reduced, shakeEl: scene, onDone: () => nailDone?.() });
      },
    });
  };

  /** Тело внутри зоны слота (±56px). */
  const inNailZone = (body: Body): boolean => {
    if (!anchorRect) return false;
    const pad = 56;
    return Bounds.overlaps(body.bounds, {
      min: { x: anchorRect.left - pad, y: anchorRect.top - pad },
      max: { x: anchorRect.right + pad, y: anchorRect.bottom + pad },
    });
  };

  const watchAnchor = () => {
    if (!nailBody || nailing) return;
    if (!anchorRect) measureAnchor();
    if (!anchorRect) return;
    const fits = inNailZone(nailBody);
    if (!fits) {
      // Кусок покинул зону слота (после захвата) — возврат теперь «намеренный».
      if (nailGrabbed) nailArmed = true;
      return;
    }
    if (!nailArmed) return;
    // В зоне слота и либо держат мышью, либо кусок почти остановился.
    if (mc.body === nailBody || nailBody.speed < 2.5) beginNailing();
  };
  // Проверка зоны слота — в конце каждого шага физики.
  Events.on(engine, 'afterUpdate', watchAnchor);

  // --- ресайз/видимость ---------------------------------------------------
  const onResize = () => {
    buildWalls();
    placeBin();
    anchorRect = null;
    // Куски, оставшиеся за новыми стенками, возвращаем в вьюпорт.
    for (const body of pieces) {
      const x = Math.min(Math.max(body.position.x, 30), W() - 30);
      const y = Math.min(Math.max(body.position.y, 30), H() - 30);
      if (x !== body.position.x || y !== body.position.y) {
        Body.setPosition(body, { x, y });
        Body.setVelocity(body, { x: 0, y: 0 });
      }
    }
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, { passive: true });

  const onVisibility = () => {
    if (document.hidden) Runner.stop(runner);
    else Runner.run(runner, engine);
  };
  document.addEventListener('visibilitychange', onVisibility);

  // Dev-отладка захвата (только в dev-сервере, сносится в destroy).
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__physicsDebug = () => ({
      pieces: pieces.size,
      grabbed: !!mc.body,
      mouse: {
        x: Math.round(mouse.position.x),
        y: Math.round(mouse.position.y),
        button: mouse.button,
      },
      bodies: [...pieces].slice(0, 30).map((b) => ({
        x: Math.round(b.position.x),
        y: Math.round(b.position.y),
        speed: Math.round(b.speed * 10) / 10,
      })),
      bin: binBody
        ? {
            x: Math.round(binBody.position.x),
            y: Math.round(binBody.position.y),
            minX: Math.round(binBody.bounds.min.x),
            maxX: Math.round(binBody.bounds.max.x),
            minY: Math.round(binBody.bounds.min.y),
            maxY: Math.round(binBody.bounds.max.y),
          }
        : null,
      nail: { armed: nailArmed, grabbed: nailGrabbed, nailing },
    });
  }

  return {
    fragmentize(el, opts = {}) {
      // rect может приехать снятым заранее: у отсоединённого узла он нулевой.
      const rect = opts.rect
        ? {
            left: opts.rect.left,
            top: opts.rect.top,
            width: opts.rect.width,
            height: opts.rect.height,
          }
        : el.getBoundingClientRect();
      // Кусок уходит в фиксированную сцену: координаты вьюпорта.
      el.style.visibility = 'hidden';
      const mode = opts.mode ?? 'solid';
      if (mode === 'solid') {
        // Клон, не перенос узла: оригинал остаётся в дереве React (иначе
        // unmount падает с NotFoundError), клон уезжает в сцену.
        const clone = el.cloneNode(true) as HTMLElement;
        clone.classList.add('physics-piece');
        // Исходник прячется до клонирования; opacity мог замереть на середине
        // твина штампа темы. inert на корне запрещает pointer-events — нельзя.
        clone.style.visibility = 'visible';
        clone.style.opacity = '';
        // Клон тянет за собой data-theme-stamp: на каждом флипе темы
        // ThemeProvider гасит «штамп» уже по куску — маркер снимаем.
        clone.removeAttribute('data-theme-stamp');
        clone
          .querySelectorAll('button, a, input, select, textarea')
          .forEach((n) => n.setAttribute('tabindex', '-1'));
        // Натуральные размеры: rect во время анимации штампа (scale) врёт,
        // а тело и клон должны совпадать пиксель в пиксель.
        const w = el.offsetWidth || rect.width;
        const h = el.offsetHeight || rect.height;
        // Центр bbox остаётся центром элемента при scale вокруг центра.
        const cxw = rect.left + rect.width / 2;
        const cyw = rect.top + rect.height / 2;
        clone.style.width = `${w}px`;
        clone.style.height = `${h}px`;
        clone.style.transform = `translate3d(${cxw - w / 2}px, ${cyw - h / 2}px, 0)`;
        scene.appendChild(clone);
        const meta: PieceMeta = {
          el: clone,
          rectW: w,
          rectH: h,
          cx: w / 2,
          cy: h / 2,
          kind: 'solid',
          canSplit: false,
          splitDepth: 0,
          area: w * h,
          grabScale: 1,
          prevSpeed: 0,
        };
        const body = Bodies.rectangle(cxw, cyw, w, h, {
          restitution: opts.restitution ?? 0.6,
          friction: 0.08,
          frictionAir: 0.015,
          density: opts.density ?? 0.0028,
          plugin: { meta },
        });
        // Утяжелённый момент инерции: кусок не крутится «юлой» от любого чиха.
        Body.setInertia(body, body.inertia * 3);
        if (opts.kickUp) Body.setVelocity(body, { x: 0, y: -opts.kickUp });
        pieces.add(body);
        Composite.add(engine.world, body);
        return body;
      }
      // shatter: вороной по прямоугольнику элемента, осколки разлетаются от точки удара.
      const count = opts.shards ?? 9;
      const inset = 10;
      const w = Math.max(el.offsetWidth || rect.width, 40);
      const h = Math.max(el.offsetHeight || rect.height, 24);
      const localImpact = opts.impact
        ? {
            x: Math.min(Math.max(opts.impact.x - rect.left, inset), w - inset),
            y: Math.min(Math.max(opts.impact.y - rect.top, inset), h - inset),
          }
        : { x: w / 2, y: h / 2 };
      const pts: Pt[] = [localImpact];
      for (let i = 1; i < count; i += 1) {
        pts.push({
          x: inset + Math.random() * (w - inset * 2),
          y: inset + Math.random() * (h - inset * 2),
        });
      }
      const delaunay = Delaunay.from(
        pts,
        (p) => p.x,
        (p) => p.y,
      );
      const voronoi = delaunay.voronoi([0, 0, w, h]);
      for (let i = 0; i < pts.length; i += 1) {
        const cell = voronoi.cellPolygon(i);
        if (!cell || cell.length < 4) continue;
        // cellPolygon отдаёт [[x,y],...] замкнуто (последняя = первой) — в объекты, без дубля.
        const poly: Pt[] = cell.slice(0, -1).map((p) => ({ x: p[0], y: p[1] }));
        const centroid = polyCentroid(poly);
        const wx = rect.left + centroid.x;
        const wy = rect.top + centroid.y;
        const dx = wx - (opts.impact?.x ?? wx);
        const dy = wy - (opts.impact?.y ?? wy);
        const dist = Math.hypot(dx, dy) || 1;
        const kick = 2.2 + Math.random() * 2.4;
        makeShard(el, w, h, poly, { x: wx, y: wy }, 0, {
          x: (dx / dist) * kick,
          y: (dy / dist) * kick - 0.8,
        });
      }
      return null;
    },

    setBin(onEnter, onAllGone) {
      onBinEnter = onEnter;
      onBinAllGone = onAllGone ?? null;
      if (binEl) return; // сенсор и картинка создаются один раз
      const { w, h } = binSize();
      binEl = document.createElement('div');
      binEl.className = 'physics-bin';
      const img = document.createElement('img');
      img.src = binSrc;
      img.alt = '';
      binEl.appendChild(img);
      scene.appendChild(binEl);
      // Сенсор создаётся, но В МИР НЕ ДОБАВЛЯЕТСЯ до первого захвата куска:
      // иначе летящие в левый нижний угол куски пропадают в невидимую корзину.
      binBody = Bodies.rectangle(0, 0, w * 0.62, h * 0.45 * 0.85, {
        isStatic: true,
        isSensor: true,
        plugin: { bin: true },
      });
      placeBin();
    },

    setNailBack(anchor, body, onDone) {
      // Повторный вызов (перезапуск эффекта, смена языка) не должен
      // разоружать уже взведённое прибивание.
      if (nailBody === body) {
        nailAnchor = anchor;
        nailDone = onDone;
        anchorRect = null;
        return;
      }
      nailAnchor = anchor;
      nailBody = body;
      nailDone = onDone;
      nailGrabbed = false;
      nailArmed = false;
      anchorRect = null;
    },

    setPaused(v) {
      if (v) Runner.stop(runner);
      else Runner.run(runner, engine);
    },

    destroy() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(anchorScanRaf);
      window.clearTimeout(binExitTimer);
      if (import.meta.env.DEV) delete (window as unknown as Record<string, unknown>).__physicsDebug;
      // Перевешанные на window слушатели мыши — иначе утекают вместе с
      // замыканием на мёртвую сцену, и движок не собирается GC.
      window.removeEventListener('mousemove', mouse.mousemove);
      window.removeEventListener('mouseup', mouse.mouseup);
      window.removeEventListener('touchend', onWindowTouchEnd);
      // Поздний onDone после destroy никуда вести не должен.
      nailDone = null;
      nailBody = null;
      nailing = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      Runner.stop(runner);
      for (const body of pieces) {
        const meta = body.plugin?.meta as PieceMeta | undefined;
        if (meta?.el && meta.el !== meta.src) gsap.killTweensOf(meta.el);
      }
      Composite.clear(engine.world, false, true);
      Engine.clear(engine);
      scene.remove();
    },
  };
}
