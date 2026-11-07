import { gsap } from './gsap';

/**
 * Гейт reduced-motion (спека §10.3): в matchMedia-ветке reduce твины не
 * создаются, состояния сразу финальные. Ветку «no-preference» настраивает
 * вызывающий код.
 */
export const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_QUERY).matches;
}

/**
 * Единая точка создания reveal-твинов листов (спека §4.0). Родительский
 * useLayoutEffect секции — детские rough-инъекции успевают замерить layout.
 */
export function sheetReveal(sheet: HTMLElement): void {
  if (prefersReducedMotion()) return;
  gsap.from(sheet, {
    y: 48,
    rotate: 0.4,
    autoAlpha: 0,
    duration: 0.6,
    ease: 'power2.out',
    scrollTrigger: { trigger: sheet, start: 'top 85%', once: true },
  });
}
