import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { Sheet } from './Sheet';
import { PencilMark } from './PencilMark';

function Chip({ label, index }: { label: string; index: number }) {
  const [pressed, setPressed] = useState(false);
  const frameRef = useRough<HTMLSpanElement>('chip', 100 + index, () => ({ padding: 4 }));
  const fillRef = useRough<HTMLSpanElement>(
    'hachure-fill',
    130 + index,
    () => ({ fillStyle: 'hachure', hachureGap: 7 }),
  );
  return (
    <button
      type="button"
      className="tech-chip"
      aria-pressed={pressed}
      onClick={() => setPressed((v) => !v)}
    >
      <span className="chip-layer" ref={frameRef} aria-hidden="true" />
      <span className="chip-layer chip-layer--fill" ref={fillRef} aria-hidden="true" />
      {label}
    </button>
  );
}

/** ЛИСТ 04 — Технологии: линейка + drag/snap-слайдер чипов (§4.4). */
export function TechSheet() {
  const { t } = useLang();
  const trackRef = useRef<HTMLUListElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  const chips = t.tech.chips;
  const zones = t.tech.zones;
  const zoneList = [
    { label: zones.fe, from: 0, to: 10 },
    { label: zones.be, from: 10, to: 14 },
    { label: zones.tools, from: 14, to: 16 },
  ];

  const syncIndicator = () => {
    const track = trackRef.current;
    if (!track || !indicatorRef.current) return;
    const max = track.scrollWidth - track.clientWidth;
    const frac = max > 0 ? track.scrollLeft / max : 0;
    // transform в scroll-хендлере разрешён: это не rough (спека §4.4).
    indicatorRef.current.style.transform = `translateX(${frac * 100}%)`;
  };

  const onPointerDown = (e: PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== 'mouse') return;
    const track = trackRef.current;
    if (!track) return;
    drag.current = { down: true, startX: e.clientX, startScroll: track.scrollLeft, moved: false };
    track.classList.add('dragging');
    track.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLUListElement>) => {
    const track = trackRef.current;
    if (!track || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    track.scrollLeft = drag.current.startScroll - dx;
  };

  const onPointerUp = (e: PointerEvent<HTMLUListElement>) => {
    const track = trackRef.current;
    if (!track) return;
    drag.current.down = false;
    track.classList.remove('dragging');
    if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const track = trackRef.current;
    if (!track) return;
    const chip = track.querySelector<HTMLElement>('.tech-chip');
    const step = chip ? chip.offsetWidth + 12 : 120;
    if (e.key === 'ArrowRight') track.scrollBy({ left: step, behavior: 'smooth' });
    if (e.key === 'ArrowLeft') track.scrollBy({ left: -step, behavior: 'smooth' });
  };

  return (
    <Sheet id="sheet-04" titleId="sheet-04-title" kicker={t.tech.kicker} title={t.tech.title} dense>
      <div className="tech-ruler" aria-hidden="true">
        {zoneList.map((z) => (
          <span
            key={z.label}
            className="tech-ruler__zone"
            style={{ left: `${(z.from / 16) * 100}%`, width: `${((z.to - z.from) / 16) * 100}%` }}
          >
            {z.label}
          </span>
        ))}
        <div className="tech-ruler__indicator" ref={indicatorRef} />
      </div>
      <ul
        className="tech-track"
        ref={trackRef}
        tabIndex={0}
        aria-label={t.tech.title}
        onScroll={syncIndicator}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {chips.map((c, i) => (
          <li key={c}>
            <Chip label={c} index={i} />
          </li>
        ))}
      </ul>
      <PencilMark text={t.tech.pencil} style={{ top: '-34px', right: '10%' }} />
    </Sheet>
  );
}
