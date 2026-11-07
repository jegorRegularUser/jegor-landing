import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { annotate, annotationGroup } from 'rough-notation';

export type NotationType =
  | 'underline'
  | 'box'
  | 'circle'
  | 'highlight'
  | 'strike-through'
  | 'bracket';

export interface NotationSpec {
  type: NotationType;
  color?: string;
  strokeWidth?: number;
  padding?: number;
  multiline?: boolean;
  brackets?: ('left' | 'right' | 'top' | 'bottom')[];
}

export interface NotationGroupApi {
  show(): void;
  hide(): void;
  remove(): void;
}

/**
 * rough-notation с жизненным циклом спеки §6.5: у библиотеки нет re-measure,
 * поэтому при смене deps (язык, размер текста) аннотации destroy+recreate.
 * Показ управляется снаружи через возвращаемый ref.
 */
export function useNotationGroup(
  targets: RefObject<(Element | null)[]>,
  specs: NotationSpec[],
  deps: unknown[] = [],
): RefObject<NotationGroupApi | null> {
  const apiRef = useRef<NotationGroupApi | null>(null);

  useLayoutEffect(() => {
    const els = (targets.current?.filter((e): e is HTMLElement => Boolean(e)) ?? []).slice(
      0,
      specs.length,
    );
    if (els.length === 0) return;
    const annotations = els.map((el, i) =>
      annotate(el, { ...specs[i], type: specs[i]?.type ?? 'underline' }),
    );
    const group = annotationGroup(annotations);
    apiRef.current = {
      show: () => group.show(),
      hide: () => group.hide(),
      remove: () => annotations.forEach((a) => a.remove()),
    };
    return () => {
      annotations.forEach((a) => a.remove());
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return apiRef;
}

