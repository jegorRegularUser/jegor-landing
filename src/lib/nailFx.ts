/* FX «прибивания»: стоковый молоток бьёт по трём стоковым гвоздям (11).
   Гвоздь «незабит» (вид сбоку) после удара меняется на «забит» (вид с торца).
   Хост — элемент, на который ставятся гвозди (живая кнопка или кусок физики).
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

/** Забитый гвоздь: вид с торца, без наклона. */
function setFixed(nail: HTMLImageElement): void {
  nail.src = nailFixedSrc;
  nail.style.transform = 'translate(-50%, -50%) rotate(0deg) scale(0.82)';
}

/** Забитые гвозди переезжают из FX-слоя в сам хост: координаты совпадают
 *  (стенд ставится ровно над хостом), гвозди живут и скроллятся вместе с ним. */
function persistNailsIn(host: HTMLElement, nails: HTMLImageElement[]): void {
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  nails.forEach((nail, i) => {
    nail.style.left = `${9 + i * 15}px`;
    host.appendChild(nail);
  });
}

export function playNailFx(host: HTMLElement, opts: NailFxOptions = {}): void {
  const { reduced = false, shakeEl = null, persistNails = false, onDone } = opts;
  const rect = host.getBoundingClientRect();

  const fx = document.createElement('div');
  fx.className = 'nail-fx';
  fx.setAttribute('aria-hidden', 'true');
  fx.style.left = `${rect.left}px`;
  fx.style.top = `${rect.top}px`;
  fx.style.width = `${rect.width}px`;
  fx.style.height = `${rect.height}px`;

  const nails: HTMLImageElement[] = [];
  for (let i = 0; i < NAILS; i += 1) {
    const nail = document.createElement('img');
    nail.src = nailLooseSrc;
    nail.alt = '';
    nail.className = 'nail-fx__nail';
    nail.style.left = `${9 + i * 15}px`;
    fx.appendChild(nail);
    nails.push(nail);
  }

  // Молоток: базовая геометрия — рукоять к центру слота, голова справа, удар сверху.
  // Ось вращения (transform-origin) — конец рукояти; 92deg = боёк смотрит вниз на гвоздь.
  const hammer = document.createElement('img');
  hammer.src = hammerSrc;
  hammer.alt = '';
  hammer.className = 'nail-fx__hammer';
  const hammerH = 132;
  hammer.style.height = `${hammerH}px`;
  hammer.style.left = `${-hammerH * 0.5 + 62}px`;
  hammer.style.top = `${-hammerH * 0.88 + 18}px`;
  fx.appendChild(hammer);

  document.body.appendChild(fx);

  const strike = (nail: HTMLImageElement, i: number) => {
    setFixed(nail);
    gsap.fromTo(nail, { scale: 1.5 }, { scale: 1, duration: 0.16, ease: 'power2.out' });
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
    const at = i * 0.36;
    // замах → удар → обратный отскок; молоток доезжает до каждого гвоздя по x
    tl.to(hammer, { x: (i - 1) * 15, rotation: 40 + i * 3, duration: 0.17, ease: 'power2.out' }, at)
      .to(hammer, { rotation: 94, duration: 0.08, ease: 'power3.in' }, at + 0.18)
      .call(() => strike(nail, i), undefined, at + 0.26)
      .to(hammer, { rotation: 52, duration: 0.1, ease: 'power1.out' }, at + 0.3);
  });
  tl.to({}, { duration: 0.12 });
}
