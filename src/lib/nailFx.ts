/* FX «прибивания»: стоковый молоток бьёт по трём стоковым гвоздям (11).
   Гвоздь «незабит» (вид сбоку, лежит горизонтально) после удара меняется
   на «забит» (вид с торца). Молоток с горизонтальным хватом стоит справа
   (или слева, если справа нет места) от хоста на уровне кнопки — целиком
   в пределах экрана даже у самой верхней шапки.
   Забитые гвозди могут переехать жить в хост (persistNails).
   Звук — knock() из WebAudio, файлы не нужны. */

import { gsap } from './gsap';
import { knock } from './knock';
import hammerSrc from '../assets/hammer.png';
import nailLooseSrc from '../assets/nail-loose.png';
import nailFixedSrc from '../assets/nail-fixed.png';

export interface NailFxOptions {
  reduced?: boolean;
  /** Слой, который мелко трясётся в момент удара (сцена физики). */
  shakeEl?: HTMLElement | null;
  /** Оставить забитые гвозди жить в хосте (кнопка прибита намертво). */
  persistNails?: boolean;
  onDone?: () => void;
}

const NAILS = 3;
const HAMMER = 120; // px, сторона квадратного png

interface NailSpot {
  x: number;
  y: number;
  left: number;
  top: number;
}

/** Рандомные места гвоздей внутри кнопки: не по краям и не друг на друге. */
function nailSpots(w: number, h: number): NailSpot[] {
  const spots: NailSpot[] = [];
  const padX = 14;
  const padY = 10;
  const minX = Math.min(padX, Math.max(6, w - padX - 16));
  const maxX = Math.max(minX + 4, w - padX - 16);
  const minY = Math.min(padY, Math.max(5, h - padY - 16));
  const maxY = Math.max(minY + 4, h - padY - 16);
  for (let i = 0; i < NAILS; i += 1) {
    let x = 0;
    let y = 0;
    for (let tryI = 0; tryI < 24; tryI += 1) {
      x = minX + Math.random() * (maxX - minX);
      y = minY + Math.random() * (maxY - minY);
      const ok = spots.every((s) => Math.hypot(s.x - x, s.y - y) > 22);
      if (ok) break;
    }
    spots.push({ x, y, left: x + 8, top: y + 8 });
  }
  return spots;
}

/** Забитый гвоздь: вид с торца, без наклона. */
function setFixed(nail: HTMLImageElement): void {
  nail.src = nailFixedSrc;
  nail.style.transform = 'translate(-50%, -50%) scale(0.8)';
}

export function playNailFx(host: HTMLElement, opts: NailFxOptions = {}): void {
  const { reduced = false, shakeEl = null, persistNails = false, onDone } = opts;
  const rect = host.getBoundingClientRect();
  // Справа нет места — молоток встаёт слева и бьёт в обратную сторону.
  const spaceRight = window.innerWidth - rect.right > HAMMER * 0.85;
  const side = spaceRight ? 1 : -1; // 1 = молоток справа, голова бьёт влево

  const fx = document.createElement('div');
  fx.className = 'nail-fx';
  fx.setAttribute('aria-hidden', 'true');
  fx.style.left = `${rect.left}px`;
  fx.style.top = `${rect.top}px`;
  fx.style.width = `${rect.width}px`;
  fx.style.height = `${rect.height}px`;

  const spots = nailSpots(rect.width, rect.height);
  const nails: HTMLImageElement[] = [];
  spots.forEach((spot) => {
    const nail = document.createElement('img');
    nail.src = nailLooseSrc;
    nail.alt = '';
    nail.className = 'nail-fx__nail';
    nail.style.left = `${spot.left}px`;
    nail.style.top = `${spot.top}px`;
    fx.appendChild(nail);
    nails.push(nail);
  });

  // Молоток: горизонтальный хват. При rotate(-90deg) голова картинки смотрит
  // влево (бьёт влево), рукоять — вправо. Позиционируем так, чтобы боёк
  // попадал в центр кнопки: центр img на (head.x + 83, head.y - 12).
  const hammer = document.createElement('img');
  hammer.src = hammerSrc;
  hammer.alt = '';
  hammer.className = 'nail-fx__hammer';
  hammer.style.height = `${HAMMER}px`;
  hammer.style.width = `${HAMMER}px`;
  const headX = rect.width * 0.5 + (side === 1 ? -10 : 10);
  const headY = rect.height * 0.5;
  // центр img: head + повернутый оффсет (−83, +12) при side=1; зеркально при side=−1
  const cx = headX + (side === 1 ? 83 : -83);
  const cy = headY - 12;
  hammer.style.left = `${cx - HAMMER / 2}px`;
  hammer.style.top = `${cy - HAMMER / 2}px`;
  fx.appendChild(hammer);
  document.body.appendChild(fx);

  const strike = (nail: HTMLImageElement, i: number) => {
    setFixed(nail);
    gsap.fromTo(nail, { scale: 1.6 }, { scale: 1, duration: 0.16, ease: 'power2.out' });
    knock(0.9 - i * 0.12);
    if (!reduced) {
      gsap.fromTo(
        host,
        { scaleY: 0.93 },
        { scaleY: 1, duration: 0.16, ease: 'power2.out', transformOrigin: '50% 100%' },
      );
      if (shakeEl) {
        gsap.fromTo(shakeEl, { x: -2 }, { x: 0, duration: 0.18, ease: 'power1.out' });
      }
    }
  };

  if (reduced) {
    nails.forEach(setFixed);
    hammer.style.display = 'none';
    if (persistNails) persistNailsIn(host, nails);
    window.setTimeout(() => {
      fx.remove();
      onDone?.();
    }, 340);
    return;
  }

  // Базовая позиция молотка (замах рядом с кнопкой); aimY доводит голову до гвоздя.
  const baseY = cy - HAMMER / 2;
  const restRotation = side === 1 ? -102 : 102; // лёгкий подъём головы — замах
  const hitRotation = side === 1 ? -88 : 88;

  const tl = gsap.timeline({
    onComplete: () => {
      if (persistNails) {
        // Гвозди переезжают жить в кнопку; молоток и стенд убираются.
        persistNailsIn(host, nails);
        fx.remove();
        onDone?.();
        return;
      }
      gsap.to(fx, {
        autoAlpha: 0,
        duration: 0.22,
        onComplete: () => {
          fx.remove();
          onDone?.();
        },
      });
    },
  });

  nails.forEach((nail, i) => {
    const spot = spots[i];
    const aimY = spot.top - (baseY + HAMMER / 2) + spot.y; // доводка головы по y
    const at = i * 0.36;
    // замах (отъезд от кнопки + подъём головы) → удар (влёт по x) → отскок
    tl.to(hammer, { x: side * 26, rotation: restRotation, duration: 0.16, ease: 'power2.out' }, at)
      .to(hammer, { y: aimY, x: side * 6, rotation: hitRotation, duration: 0.09, ease: 'power3.in' }, at + 0.17)
      .call(() => strike(nail, i), undefined, at + 0.26)
      .to(hammer, { x: side * 26, rotation: restRotation, duration: 0.12, ease: 'power1.out' }, at + 0.3);
  });
  tl.to({}, { duration: 0.12 });
}

/** Забитые гвозди переезжают из FX-слоя в сам хост: координаты совпадают
 *  (стенд ставится ровно над хостом), гвозди живут и скроллятся вместе с ним. */
function persistNailsIn(host: HTMLElement, nails: HTMLImageElement[]): void {
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  nails.forEach((nail) => {
    host.appendChild(nail);
  });
}

/** Проставить забитые гвозди на хост без FX-сцены: живая кнопка вернулась
 *  на слот после прибивания куска — молоток уже отыграл по куску.
 *  Позиции — те же рандомные, что при прибивании (seed не сохраняем —
 *  раскладка всё равно декоративная). */
export function persistNailsOn(host: HTMLElement): void {
  if (host.querySelector('.nail-fx__nail')) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  nailSpots(host.offsetWidth, host.offsetHeight).forEach((spot) => {
    const nail = document.createElement('img');
    nail.src = nailFixedSrc;
    nail.alt = '';
    nail.className = 'nail-fx__nail';
    nail.style.left = `${spot.left}px`;
    nail.style.top = `${spot.top}px`;
    nail.style.transform = 'translate(-50%, -50%) scale(0.8)';
    host.appendChild(nail);
  });
}
