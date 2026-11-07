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
 * Активный лист — по скроллу (мгновенно, без лага IO на границах):
 * последний лист, чей верх прошёл середину вьюпорта. Плотные зоны
 * (листы 04 и 06) — по IntersectionObserver (спека §4.0).
 */
export function SheetsObserverProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ObserverState>({ activeId: 'sheet-01', dense: false });

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      const sections = document.querySelectorAll<HTMLElement>('[data-sheet]');
      let active = 'sheet-01';
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= mid) active = s.id;
      }
      setState((prev) => (prev.activeId === active ? prev : { ...prev, activeId: active }));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const denseIo = new IntersectionObserver(
      (entries) => {
        setState((s) => {
          const dense = entries.some((e) => e.isIntersecting);
          return dense === s.dense ? s : { ...s, dense };
        });
      },
      { threshold: 0.35 },
    );
    for (const s of document.querySelectorAll<HTMLElement>('[data-sheet]')) {
      if (s.dataset.dense === 'true') denseIo.observe(s);
    }
    return () => denseIo.disconnect();
  }, []);

  return <SheetsContext.Provider value={state}>{children}</SheetsContext.Provider>;
}

export function useSheetsObserver(): ObserverState {
  return useContext(SheetsContext);
}
