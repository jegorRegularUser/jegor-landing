/* Обёртка matter.js (динамический импорт — движок не в критическом чанке).
   Сцена = фиксированный полноэкранный слой: стенки по краям вьюпорта,
   куски перетаскиваются мышью/тачем, при сильном ударе о стенку/пол
   кусок раскалывается на два, корзина-сенсор съедает куски. */

import type { Engine, Body } from 'matter-js';
import binSrc from '../assets/bin.png';

export interface Playground {
  /** Превращает DOM-элемент в физическое тело (клон улетает в слой сцены). */
  fragmentize(el: HTMLElement, opts?: { canSplit?: boolean; restitution?: number }): void;
  /** Корзина-сенсор. onEnter вызывается, когда кусок попадает внутрь. */
  setBin(onEnter: (el: HTMLElement) => void): void;
  /** Пауза физики (невидимая вкладка). */
  setPaused(v: boolean): void;
  destroy(): void;
}

interface PieceMeta {
  el: HTMLElement;
  canSplit: boolean;
  splitDepth: number;
}

const SPLIT_SPEED = 9; // скорость, при которой кусок раскалывается
const MAX_DEPTH = 1; // раскол не глубже одного уровня

export async function createPlayground(
  container: HTMLElement,
  hooks: { onImpact?: (piece: HTMLElement, speed: number) => void } = {},
): Promise<Playground> {
  // matter-js — CJS-пакет: default-interop обязателен, иначе краш (приёмка 15).
  const mod = await import('matter-js');
  const Matter = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
  const { Engine, Runner, Bodies, Composite, Mouse, MouseConstraint, Events, Body } = Matter;

  const scene = document.createElement('div');
  scene.className = 'physics-scene';
  scene.setAttribute('aria-hidden', 'true');
  container.appendChild(scene);

  const engine: Engine = Engine.create({ gravity: { x: 0, y: 1.4, scale: 0.001 } });
  const runner = Runner.create();
  Runner.run(runner, engine);

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  const wallOpts = { isStatic: true };
  let walls: Body[] = [];
  const buildWalls = () => {
    Composite.remove(engine.world, walls);
    walls = [
      Bodies.rectangle(W() / 2, H() + 40, W() * 2, 80, wallOpts), // пол
      Bodies.rectangle(W() / 2, -40, W() * 2, 80, wallOpts), // потолок
      Bodies.rectangle(-40, H() / 2, 80, H() * 2, wallOpts), // левая
      Bodies.rectangle(W() + 40, H() / 2, 80, H() * 2, wallOpts), // правая
    ];
    Composite.add(engine.world, walls);
  };
  buildWalls();

  const mouse = Mouse.create(scene);
  const mc = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.12, render: { visible: false } },
  });
  Composite.add(engine.world, mc);

  // Корзина выезжает из-за границы, только когда берут первый кусок (16).
  let binShown = false;
  Events.on(mc as never, 'startdrag', () => {
    if (binShown) return;
    binShown = true;
    binRectEl?.classList.add('physics-bin--in');
  });

  const pieces = new Set<Body>();

  const sync = () => {
    for (const body of pieces) {
      const meta = body.plugin.meta as PieceMeta | undefined;
      if (!meta || !meta.el) continue;
      meta.el.style.transform = `translate(${body.position.x - meta.el.offsetWidth / 2}px, ${
        body.position.y - meta.el.offsetHeight / 2
      }px) rotate(${body.angle}rad)`;
    }
    requestAnimationFrame(sync);
  };
  const raf = requestAnimationFrame(sync);

  const removePiece = (body: Body) => {
    const meta = body.plugin.meta as PieceMeta;
    meta.el.remove();
    Composite.remove(engine.world, body);
    pieces.delete(body);
  };

  const makePiece = (
    el: HTMLElement,
    x: number,
    y: number,
    w: number,
    h: number,
    meta: PieceMeta,
    angle = 0,
    velocity?: { x: number; y: number },
  ): Body => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.classList.add('physics-piece');
    clone.style.width = `${w}px`;
    clone.style.height = `${h}px`;
    clone.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${angle}rad)`;
    scene.appendChild(clone);
    meta.el = clone;
    const body = Bodies.rectangle(x, y, w, h, {
      restitution: 0.55,
      friction: 0.4,
      angle,
      plugin: { meta },
    });
    if (velocity) Body.setVelocity(body, velocity);
    pieces.add(body);
    Composite.add(engine.world, body);
    return body;
  };

  let bin: Body | null = null;
  let binRectEl: HTMLElement | null = null;

  Events.on(engine, 'collisionStart', (e) => {
    for (const pair of e.pairs) {
      const [a, b] = [pair.bodyA, pair.bodyB];
      for (const [body, other] of [
        [a, b],
        [b, a],
      ]) {
        const meta = body.plugin?.meta as PieceMeta | undefined;
        if (!meta) continue;
        // Корзина-сенсор: static + isSensor, помечен plugin.bin.
        if (other.plugin?.bin) {
          removePiece(body);
          continue;
        }
        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        if (speed > 3) hooks.onImpact?.(meta.el, speed);
        if (meta.canSplit && meta.splitDepth < MAX_DEPTH && speed > SPLIT_SPEED) {
          const { x, y } = body.position;
          const w = (meta.el.offsetWidth * (Math.random() > 0.5 ? 0.55 : 0.45)) | 0;
          const h = meta.el.offsetHeight;
          removePiece(body);
          meta.canSplit = false;
          for (const dx of [-1, 1]) {
            makePiece(
              meta.el,
              x + dx * (w / 2),
              y,
              w,
              h,
              { ...meta, splitDepth: meta.splitDepth + 1 },
              body.angle,
              {
                x: body.velocity.x + dx * 2,
                y: body.velocity.y - 1,
              },
            );
          }
        }
      }
    }
  });

  const onResize = () => buildWalls();
  window.addEventListener('resize', onResize);

  const onVisibility = () => {
    if (document.hidden) Runner.stop(runner);
    else Runner.run(runner, engine);
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    fragmentize(el, opts = {}) {
      const rect = el.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      // Кусок уходит в фиксированную сцену: координаты вьюпорта.
      el.style.visibility = 'hidden';
      makePiece(
        el,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect.width,
        rect.height,
        { el, canSplit: opts.canSplit ?? true, splitDepth: 0 },
        0,
      );
      void scrollX;
      void scrollY;
    },
    setBin(onEnter) {
      if (binRectEl) binRectEl.remove();
      const w = 130;
      const h = 110;
      const x = -36; // высунута из-за левого края страницы (16)
      const y = H() - h - 16;
      binRectEl = document.createElement('div');
      binRectEl.className = 'physics-bin';
      const img = document.createElement('img');
      img.src = binSrc;
      img.alt = '';
      binRectEl.appendChild(img);
      binRectEl.style.left = `${x}px`;
      binRectEl.style.top = `${y}px`;
      scene.appendChild(binRectEl);
      bin = Bodies.rectangle(x + w / 2 + 10, y + h / 2, w - 20, h - 20, {
        isStatic: true,
        isSensor: true,
        plugin: { bin: true },
      });
      Composite.add(engine.world, bin);
      Events.on(engine, 'collisionStart', function handler(e) {
        for (const pair of e.pairs) {
          for (const body of [pair.bodyA, pair.bodyB]) {
            if (body === bin) {
              const other = pair.bodyA === bin ? pair.bodyB : pair.bodyA;
              const meta = other.plugin?.meta as PieceMeta | undefined;
              if (meta) {
                onEnter(meta.el);
                removePiece(other);
                Events.off(engine, 'collisionStart', handler);
              }
            }
          }
        }
      });
    },
    setPaused(v) {
      if (v) Runner.stop(runner);
      else Runner.run(runner, engine);
    },
    destroy() {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      Runner.stop(runner);
      Composite.clear(engine.world, false, true);
      Engine.clear(engine);
      scene.remove();
    },
  };
}
