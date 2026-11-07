import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n/LangContext';
import { useSheetsObserver } from '../hooks/useSheetsObserver';
import { useMedia } from '../hooks/useMedia';

export const CAD_TOGGLE_EVENT = 'jegor-cad-toggle';

function cadEnabled(): boolean {
  try {
    return localStorage.getItem('jegor-cad') !== 'off';
  } catch {
    return true;
  }
}

/**
 * CAD-курсор: две волосяные линии крестом + mono-бейдж с координатами
 * и активным листом (спека §4.0). Ревизия приёмки: весь слой живёт ПОД
 * контентом (z-index -1, сквозь прозрачную бумагу листов), линии не
 * загораживают текст; активный лист — мгновенно по скроллу.
 */
export function CadCursor() {
  const { t } = useLang();
  const { activeId, dense } = useSheetsObserver();
  const finePointer = useMedia('(pointer: fine)');
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const [enabled, setEnabled] = useState(cadEnabled);
  const [wide, setWide] = useState(() => window.innerWidth >= 1024);

  const vRef = useRef<HTMLDivElement>(null);
  const hRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -1, y: -1 });
  const target = useRef({ x: -1, y: -1 });

  useEffect(() => {
    const onToggle = () => setEnabled(cadEnabled());
    window.addEventListener(CAD_TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(CAD_TOGGLE_EVENT, onToggle);
  }, []);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!enabled || !finePointer || reduced || !wide) return;

    const onMove = (e: PointerEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const { x, y } = target.current;
      if (x === pos.current.x && y === pos.current.y) return;
      pos.current = { x, y };
      if (vRef.current) vRef.current.style.transform = `translateX(${x}px)`;
      if (hRef.current) hRef.current.style.transform = `translateY(${y}px)`;
      if (badgeRef.current) {
        const label = t.nav.sheets.find((s) => s.id === activeId)?.label ?? '';
        badgeRef.current.textContent = `X ${String(x).padStart(4, '0')} · Y ${String(
          y,
        ).padStart(4, '0')} · ${label}`;
        badgeRef.current.style.left = `${x}px`;
        badgeRef.current.style.top = `${y}px`;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, [enabled, finePointer, reduced, wide, activeId, t]);

  if (!enabled || !finePointer || reduced || !wide) return null;

  return (
    <div
      className={`cad-cursor${activeId === 'sheet-01' ? ' cad-cursor--hero' : ''}${
        dense ? ' cad-cursor--dense' : ''
      }`}
      aria-hidden="true"
      data-testid="cad-cursor"
    >
      <div className="cad-cursor__v" ref={vRef} />
      <div className="cad-cursor__h" ref={hRef} />
      <div className="cad-cursor__badge" ref={badgeRef} />
    </div>
  );
}
