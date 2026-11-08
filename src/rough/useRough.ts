import { useLayoutEffect, useRef } from 'react';
import type { DependencyList, RefObject } from 'react';
import { registerRough, unregisterRough } from './registry';
import type { RoughKind, RoughOpts } from './registry';

/**
 * Единственный путь к фабрике rough из React (спека §9): инъекция в
 * useLayoutEffect по ref, unregister в cleanup — иначе утечка реестра.
 * optsFactory вычисляется в эффекте (там доступны актуальные размеры).
 */
export function useRough<T extends HTMLElement>(
  kind: RoughKind,
  seed: number,
  optsFactory?: () => RoughOpts,
  deps: DependencyList = [],
): RefObject<T | null> {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerRough(el, kind, seed, optsFactory?.() ?? {});
    // keepSvg: оверлей должен выжить, если узел уходит из DOM в физику
    // (кнопка темы отрывается — клон уносит обводку с собой).
    return () => unregisterRough(el, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
