import rough from 'roughjs';

export type RoughKind =
  | 'frame'
  | 'stamp'
  | 'chip'
  | 'circle'
  | 'arrow'
  | 'silhouette'
  | 'hachure-fill'
  | 'path'
  | 'multi-frame';

export type ColorKey = 'ink' | 'muted' | 'accent' | 'accent2';

export interface RoughOpts {
  /** Элемент, чью геометрию обводим (по умолчанию — сам mount). */
  targetEl?: Element | null;
  colorKey?: ColorKey;
  strokeWidth?: number;
  roughness?: number;
  bowing?: number;
  /** Отступ рамки от границ target, px. */
  padding?: number;
  /** Путь для silhouette (viewBox 1000, длинная сторона). */
  d?: string;
  fillStyle?: 'hachure' | 'cross-hatch' | 'solid' | 'zigzag';
  hachureGap?: number;
  hachureAngle?: number;
  /** Стрелка влево (зеркало). */
  flip?: boolean;
  /** Для path: шкала координат по ширине (k = width / scaleW). */
  scaleW?: number;
  /** Для multi-frame: элементы, вокруг которых рисуются рамки. */
  targets?: Element[];
}

interface Entry {
  kind: RoughKind;
  seed: number;
  opts: RoughOpts;
  mount: HTMLElement;
  svg: SVGSVGElement;
  /** Цвет, вбитый в атрибуты path'ов при рисовании (для recolor-in-place). */
  color: string;
}

const registry = new Map<HTMLElement, Entry>();

const VAR_BY_KEY: Record<ColorKey, string> = {
  ink: '--ink',
  muted: '--muted',
  accent: '--accent',
  accent2: '--accent2',
};

export function readThemeVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function resolveColor(colorKey: ColorKey = 'ink'): string {
  return readThemeVar(VAR_BY_KEY[colorKey]);
}

const KIND_DEFAULTS: Record<RoughKind, { roughness: number; strokeWidth: number }> = {
  silhouette: { roughness: 1.4, strokeWidth: 2.5 },
  stamp: { roughness: 2.2, strokeWidth: 2 },
  frame: { roughness: 1.8, strokeWidth: 1.5 },
  chip: { roughness: 1.4, strokeWidth: 1.5 },
  circle: { roughness: 1.6, strokeWidth: 1.5 },
  arrow: { roughness: 1.5, strokeWidth: 1.5 },
  'hachure-fill': { roughness: 1.8, strokeWidth: 0 },
  path: { roughness: 1.6, strokeWidth: 2.5 },
  'multi-frame': { roughness: 1.4, strokeWidth: 1.5 },
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Разворот дельты в локальные координаты, если mount сейчас повёрнут
 * reveal-твином (спека §4.9): local = R(-θ) · delta.
 */
function unrotate(dx: number, dy: number, mount: HTMLElement): [number, number] {
  const t = getComputedStyle(mount).transform;
  if (!t || t === 'none') return [dx, dy];
  const m = new DOMMatrixReadOnly(t);
  if (!m.is2D || (m.a === 1 && m.b === 0)) return [dx, dy];
  const angle = Math.atan2(m.b, m.a);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return [dx * cos - dy * sin, dx * sin + dy * cos];
}

/**
 * Локальные координаты target внутри mount по цепочке offsetParent:
 * layout-позиция, не зависящая от transform (повёрнутый штамп не раздувает
 * рамку). null — если target не DOM-потомок mount.
 */
function localOffset(target: Element, mount: HTMLElement): [number, number] | null {
  let x = 0;
  let y = 0;
  let el: Element | null = target;
  while (el && el !== mount) {
    if (!(el instanceof HTMLElement)) return null;
    x += el.offsetLeft;
    y += el.offsetTop;
    el = el.offsetParent;
  }
  return el === mount ? [x, y] : null;
}

/** Layout-размер без влияния transform'ов (offsetWidth округляет до px — норм). */
function layoutSize(el: Element): { w: number; h: number } | null {
  if (el instanceof HTMLElement && el.offsetWidth > 0 && el.offsetHeight > 0) {
    return { w: el.offsetWidth, h: el.offsetHeight };
  }
  return null;
}

function drawEntry(entry: Entry): void {
  const { kind, seed, opts, mount } = entry;
  const target = opts.targetEl ?? mount;
  // Маунт без позиционирования якорит overlay к чужому предку — чиним на месте.
  if (getComputedStyle(mount).position === 'static') {
    mount.style.position = 'relative';
  }
  const mountRect = mount.getBoundingClientRect();
  const pad = opts.padding ?? 0;

  // Геометрия — только layout-значения: mount может быть повёрнут
  // (штамп «УТВЕРЖДЕНО»), а getBoundingClientRect вернул бы AABB повёрнутого
  // бокса — рамка уезжала бы вниз втрое относительно верха.
  const local = localOffset(target, mount);
  const size = layoutSize(target);
  const [dx, dy] = local ?? (() => {
    const targetRect = target.getBoundingClientRect();
    return unrotate(targetRect.left - mountRect.left, targetRect.top - mountRect.top, mount);
  })();
  const w = size?.w ?? target.getBoundingClientRect().width;
  const h = size?.h ?? target.getBoundingClientRect().height;

  const svgW = layoutSize(mount)?.w ?? mountRect.width;
  const svgH = layoutSize(mount)?.h ?? mountRect.height;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(svgW));
  svg.setAttribute('height', String(svgH));
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('rough-overlay');
  svg.style.cssText =
    'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:0;';

  const rc = rough.svg(svg);
  const color = resolveColor(opts.colorKey ?? 'ink');
  const defaults = KIND_DEFAULTS[kind];

  const append = (drawable: ReturnType<typeof rc.rectangle>) => {
    svg.appendChild(drawable);
  };

  switch (kind) {
    case 'silhouette': {
      if (!opts.d) break;
      // Двойной штрих: карандашный проход → чернильный (спека §4.1 слой 3).
      // Path задан в системе viewBox 1000 (длинная сторона) — масштабируем
      // в пиксели target. Roughness снижен: длинный контур фигуры иначе
      // рассыпается на ломаные сегменты.
      const longSide = Math.max(w, h);
      const k = longSide / 1000;
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('transform', `translate(${dx} ${dy}) scale(${k})`);
      const pencil = rc.path(opts.d, {
        seed,
        roughness: 1.3,
        strokeWidth: 1.2 / k,
        stroke: resolveColor('muted'),
      });
      const ink = rc.path(opts.d, {
        seed,
        roughness: 0.65,
        strokeWidth: 2.5 / k,
        stroke: color,
      });
      g.appendChild(pencil);
      g.appendChild(ink);
      svg.appendChild(g);
      // pencil-цвет попадает в реестр отдельным цветом: recolor должен
      // заменить и его. Кладём оба цвета в dataset для recolor-in-place.
      g.dataset.pencilColor = resolveColor('muted');
      g.dataset.inkColor = color;
      svg.dataset.color = color;
      mount.prepend(svg);
      entry.svg = svg;
      entry.color = color;
      return;
    }
    case 'circle': {
      append(
        rc.ellipse(dx + w / 2, dy + h / 2, w + pad * 2, h + pad * 2, {
          seed,
          roughness: opts.roughness ?? defaults.roughness,
          stroke: color,
          strokeWidth: opts.strokeWidth ?? defaults.strokeWidth,
        }),
      );
      break;
    }
    case 'arrow': {
      // Горизонтальная стрелка на всю ширину target с наконечником справа.
      const y = dy + h / 2;
      append(
        rc.line(dx, y, dx + w - 8, y, {
          seed,
          roughness: opts.roughness ?? defaults.roughness,
          stroke: color,
          strokeWidth: opts.strokeWidth ?? defaults.strokeWidth,
        }),
      );
      append(
        rc.line(dx + w - 16, y - 6, dx + w - 8, y, {
          seed: seed + 1,
          roughness: opts.roughness ?? defaults.roughness,
          stroke: color,
          strokeWidth: opts.strokeWidth ?? defaults.strokeWidth,
        }),
      );
      append(
        rc.line(dx + w - 16, y + 6, dx + w - 8, y, {
          seed: seed + 2,
          roughness: opts.roughness ?? defaults.roughness,
          stroke: color,
          strokeWidth: opts.strokeWidth ?? defaults.strokeWidth,
        }),
      );
      if (opts.flip) svg.style.transform = 'scaleX(-1)';
      break;
    }
    case 'path': {
      // Произвольный путь (гит-линии оси): координаты в шкале scaleW
      // (по умолчанию 1000), равномерно масштабируются в ширину маунта.
      if (!opts.d) break;
      const k = (opts.scaleW ?? 1000) > 0 ? mountRect.width / (opts.scaleW ?? 1000) : 1;
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('transform', `scale(${k})`);
      const drawable = rc.path(opts.d, {
        seed,
        roughness: opts.roughness ?? defaults.roughness,
        strokeWidth: (opts.strokeWidth ?? defaults.strokeWidth) / k,
        stroke: color,
      });
      g.appendChild(drawable);
      svg.appendChild(g);
      break;
    }
    case 'multi-frame': {
      // Много рамок одним оверлеем (лента чипов): дешево по DOM.
      for (const t of opts.targets ?? []) {
        const r = t.getBoundingClientRect();
        const tx = unrotate(r.left - mountRect.left, r.top - mountRect.top, mount);
        append(
          rc.rectangle(tx[0] - 4, tx[1] - 4, r.width + 8, r.height + 8, {
            seed: seed + ((opts.targets ?? []).indexOf(t) % 7),
            roughness: opts.roughness ?? defaults.roughness,
            stroke: color,
            strokeWidth: opts.strokeWidth ?? defaults.strokeWidth,
          }),
        );
      }
      break;
    }
    case 'hachure-fill': {
      append(
        rc.rectangle(dx, dy, w, h, {
          seed,
          roughness: opts.roughness ?? defaults.roughness,
          stroke: 'none',
          fill: color,
          fillStyle: opts.fillStyle ?? 'hachure',
          hachureGap: opts.hachureGap,
          hachureAngle: opts.hachureAngle,
          fillWeight: opts.strokeWidth,
        }),
      );
      break;
    }
    default: {
      // frame / stamp / chip — прямоугольная рамка вокруг target.
      append(
        rc.rectangle(dx - pad, dy - pad, w + pad * 2, h + pad * 2, {
          seed,
          roughness: opts.roughness ?? defaults.roughness,
          bowing: opts.bowing ?? 1, // undefined в прод-минификации даёт NaN (приёмка)
          stroke: color,
          strokeWidth: opts.strokeWidth ?? defaults.strokeWidth,
        }),
      );
      break;
    }
  }

  svg.dataset.color = color;
  mount.prepend(svg);
  entry.svg = svg;
  entry.color = color;
}

function assertDev(mount: HTMLElement, kind: RoughKind, seed: number): void {
  if (!import.meta.env.DEV) return;
  for (const [el, e] of registry) {
    if (el !== mount && e.seed === seed) {
      console.error(`[rough] seed ${seed} уже занят (${e.kind}); уникальность обязательна`);
    }
  }
  const scale = new DOMMatrixReadOnly(getComputedStyle(mount).transform);
  if (scale.is2D && (Math.abs(scale.a) > 1.001 || Math.abs(scale.d) > 1.001)) {
    console.warn(`[rough] mount имеет scale !== 1 — геометрия обводки собьётся (${kind})`);
  }
}

/**
 * Единственная фабрика rough на сайте (спека §4.9). Рисует overlay внутри
 * mount в локальных координатах; вызывает только из useLayoutEffect.
 */
export function registerRough(
  mount: HTMLElement,
  kind: RoughKind,
  seed: number,
  opts: RoughOpts = {},
): void {
  assertDev(mount, kind, seed);
  const entry: Entry = {
    kind,
    seed,
    opts,
    mount,
    svg: document.createElementNS(SVG_NS, 'svg'),
    color: '',
  };
  drawEntry(entry);
  registry.set(mount, entry);
}

export function unregisterRough(mount: HTMLElement): void {
  const entry = registry.get(mount);
  if (!entry) return;
  entry.svg.remove();
  registry.delete(mount);
}

/** Перерисовка теми же seed: новые размеры, тот же «почерк» (спека §6.5). */
export function redrawAll(): void {
  for (const entry of registry.values()) {
    entry.svg.remove();
    drawEntry(entry);
  }
}

/**
 * Смена темы без регенерации (спека §6.3): заменяем в атрибутах path'ов
 * старый цвет на свежий из CSS-переменных. Rough пишет цвет hachure-заливки
 * в stroke path'ов, поэтому трогаем и stroke, и fill каждого path.
 */
export function recolorAll(): void {
  for (const entry of registry.values()) {
    const newColor = resolveColor(entry.opts.colorKey ?? 'ink');
    const oldColor = entry.color;
    if (!oldColor || oldColor === newColor) continue;
    entry.svg.querySelectorAll('path').forEach((p) => {
      if (p.getAttribute('stroke') === oldColor) p.setAttribute('stroke', newColor);
      if (p.getAttribute('fill') === oldColor) p.setAttribute('fill', newColor);
    });
    // silhouette: у карандашного прохода свой цвет (--muted).
    entry.svg.querySelectorAll('g[data-pencil-color]').forEach((g) => {
      const oldPencil = g.getAttribute('data-pencil-color') ?? '';
      const newPencil = resolveColor('muted');
      g.querySelectorAll('path').forEach((p) => {
        if (p.getAttribute('stroke') === oldPencil) p.setAttribute('stroke', newPencil);
      });
      g.setAttribute('data-pencil-color', newPencil);
    });
    entry.color = newColor;
  }
}

/** Отладочный доступ: число живых оверлеев. */
export function registrySize(): number {
  return registry.size;
}
