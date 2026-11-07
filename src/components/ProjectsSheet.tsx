import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import type { Dict } from '../i18n/ru';
import { Sheet } from './Sheet';
import { DimLink } from './DimLink';
import { PencilMark } from './PencilMark';

type ProjectItem = Dict['projects']['items'][number];

const screensWebp = import.meta.glob<string>('../assets/screens/*.webp', {
  eager: true,
  import: 'default',
});
const screensAvif = import.meta.glob<string>('../assets/screens/*.avif', {
  eager: true,
  import: 'default',
});

function screenFor(name: string): { webp?: string; avif?: string } {
  return {
    webp: screensWebp[`../assets/screens/${name}.webp`],
    avif: screensAvif[`../assets/screens/${name}.avif`],
  };
}

function ProjectCard({ index, item }: { index: number; item: ProjectItem }) {
  const t = useLang().t.projects;
  const frameRef = useRough<HTMLDivElement>('frame', 200 + index, () => ({ padding: 10 }));
  const slotRef = useRough<HTMLDivElement>('hachure-fill', 210, () => ({
    fillStyle: 'cross-hatch',
    hachureGap: 10,
  }));
  const stampRef = useRough<HTMLDivElement>('stamp', 220, () => ({ colorKey: 'accent', padding: 4 }));
  const screen = item.screen ? screenFor(item.screen) : {};
  const disabled = item.status === 'wip';

  return (
    <article className="proj-card" aria-hidden={undefined}>
      <div className={`proj-card__inner${disabled ? ' proj-card--wip' : ''}`} ref={frameRef}>
        <header className="proj-card__head">
          <span>
            {t.unit} <b>{item.id}</b> — {item.name}
          </span>
        </header>
        {screen.webp ? (
          <picture>
            {screen.avif && <source type="image/avif" srcSet={screen.avif} />}
            <img
              className="proj-card__screen"
              src={screen.webp}
              alt={item.name}
              width={1200}
              height={750}
              loading="lazy"
              decoding="async"
            />
          </picture>
        ) : (
          <div className="proj-slot" ref={slotRef}>
            <span className="proj-slot__note">{t.slotNote}</span>
          </div>
        )}
        {disabled && (
          <div className="wip-stamp" ref={stampRef}>
            {t.wipStamp}
          </div>
        )}
        <p className="proj-card__desc">{item.desc}</p>
        <ul className="proj-card__tags">
          {item.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        <div className="proj-card__links">
          {!disabled && item.demo && (
            <DimLink href={item.demo} target="_blank" rel="noreferrer">
              {t.demo} →
            </DimLink>
          )}
          {!disabled && item.repo && (
            <DimLink href={item.repo} target="_blank" rel="noreferrer">
              {t.repo} →
            </DimLink>
          )}
          {disabled && <span style={{ color: 'var(--muted)' }}>{t.wipStamp} → itch.io</span>}
        </div>
      </div>
    </article>
  );
}

/** ЛИСТ 05 — Пет-проекты: слайдер «изделий» (§4.5). */
export function ProjectsSheet() {
  const { t } = useLang();
  const items = t.projects.items;
  const [index, setIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<SVGPathElement>(null);
  const prevRef = useRough<HTMLButtonElement>('arrow', 600, () => ({ padding: 8 }));
  const nextRef = useRough<HTMLButtonElement>('arrow', 601, () => ({ padding: 8 }));
  const swipe = useRef({ x: 0, active: false });

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, next));
    setIndex(clamped);
    if (progressRef.current) {
      const frac = items.length > 1 ? clamped / (items.length - 1) : 1;
      progressRef.current.style.strokeDashoffset = String(300 * (1 - frac));
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swipe.current = { x: e.clientX, active: true };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!swipe.current.active) return;
    const dx = e.clientX - swipe.current.x;
    swipe.current.active = false;
    if (Math.abs(dx) > 48) go(index + (dx < 0 ? 1 : -1));
  };

  return (
    <Sheet id="sheet-05" titleId="sheet-05-title" kicker={t.projects.kicker} title={t.projects.title}>
      <div
        ref={viewportRef}
        className="proj-viewport"
        role="region"
        aria-roledescription="carousel"
        aria-label={t.projects.title}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div
          className="proj-track"
          ref={trackRef}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {items.map((item, i) => (
            <ProjectCard key={item.id} index={i} item={item} />
          ))}
        </div>
      </div>

      <div className="proj-nav">
        <button
          type="button"
          className="proj-nav__btn"
          ref={prevRef}
          aria-label={t.projects.prev}
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          ←
        </button>
        <button
          type="button"
          className="proj-nav__btn"
          ref={nextRef}
          aria-label={t.projects.next}
          disabled={index === items.length - 1}
          onClick={() => go(index + 1)}
        >
          →
        </button>
        <span className="proj-nav__counter" aria-live="polite">
          {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
        </span>
        <svg className="proj-progress" viewBox="0 0 300 6" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 3 H300" stroke="var(--grid-major)" strokeWidth="2" fill="none" />
          <path
            ref={progressRef}
            d="M0 3 H300"
            stroke="var(--accent)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="300"
            strokeDashoffset="0"
          />
        </svg>
      </div>
      <PencilMark text={t.projects.pencil} style={{ top: '-34px', right: '6%' }} />
    </Sheet>
  );
}
