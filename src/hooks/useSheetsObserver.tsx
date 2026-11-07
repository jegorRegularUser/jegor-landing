import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface ObserverState {
  /** id активного листа (для бейджа CAD-курсора и состава комплекта). */
  activeId: string;
  /** Плотная зона (сетка чипов/сертификатов) — крест курсора гаснет. */
  dense: boolean;
}

const SheetsContext = createContext<ObserverState>({ activeId: 'sheet-01', dense: false });

/**
 * Один IntersectionObserver на всё: активный лист = секция, пересекающая
 * середину вьюпорта; плотные зоны — листы 04 и 06 (спека §4.0).
 */
export function SheetsObserverProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ObserverState>({ activeId: 'sheet-01', dense: false });

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-sheet]'));
    const midpoints = new Map<string, boolean>();

    const io = new IntersectionObserver(
      (entries) => {
        let active = state.activeId;
        let dense = false;
        for (const e of entries) {
          const id = (e.target as HTMLElement).id;
          midpoints.set(id, e.isIntersecting);
          if (e.isIntersecting && (e.target as HTMLElement).dataset.dense === 'true') {
            dense = true;
          }
        }
        for (const id of midpoints.keys()) {
          if (midpoints.get(id)) active = id;
        }
        setState({ activeId: active, dense });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    const denseIo = new IntersectionObserver(
      (entries) => {
        setState((s) => {
          const dense = entries.some((e) => e.isIntersecting);
          return dense === s.dense ? s : { ...s, dense };
        });
      },
      { threshold: 0.35 },
    );

    for (const s of sections) {
      io.observe(s);
      if (s.dataset.dense === 'true') denseIo.observe(s);
    }
    return () => {
      io.disconnect();
      denseIo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <SheetsContext.Provider value={state}>{children}</SheetsContext.Provider>;
}

export function useSheetsObserver(): ObserverState {
  return useContext(SheetsContext);
}
