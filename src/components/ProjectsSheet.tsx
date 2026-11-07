import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from '../lib/gsap';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import type { Dict } from '../i18n/ru';
import { useMedia } from '../hooks/useMedia';
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

/** Карусель кадров (ревизия 02): стрелки на краях картинки, полоса снизу
 *  кликабельна — клик по месту полосы открывает ближайший кадр (10.1). */
function FrameCarousel({
  name,
  screens,
  seedBase,
  ariaPrev,
  ariaNext,
}: {
  name: string;
  screens: string[];
  seedBase: number;
  ariaPrev: string;
  ariaNext: string;
}) {
  const [index, setIndex] = useState(0);
  const prevRef = useRough<HTMLButtonElement>('arrow', seedBase, () => ({ flip: true, padding: 10 }));
  const nextRef = useRough<HTMLButtonElement>('arrow', seedBase + 1, () => ({ padding: 10 }));
  const progressRef = useRef<SVGPathElement>(null);

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(screens.length - 1, next));
    setIndex(clamped);
    if (progressRef.current) {
      const frac = screens.length > 1 ? clamped / (screens.length - 1) : 1;
      progressRef.current.style.strokeDashoffset = String(300 * (1 - frac));
    }
  };

  return (
    <div
      className="proj-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label={name}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(index + 1);
        if (e.key === 'ArrowLeft') go(index - 1);
      }}
    >
      <div className="proj-carousel__track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {screens.map((s, i) => {
          const shot = screenFor(s);
          return (
            <div className="proj-carousel__slide" key={s}>
              {shot.webp ? (
                <picture>
                  {shot.avif && <source type="image/avif" srcSet={shot.avif} />}
                  <img
                    src={shot.webp}
                    alt={`${name} — кадр ${i + 1}`}
                    width={1280}
                    height={800}
                    loading="lazy"
                    decoding="async"
                  />
                </picture>
              ) : (
                <div className="proj-slot" />
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="proj-arrow proj-arrow--prev"
        ref={prevRef}
        aria-label={ariaPrev}
        disabled={index === 0}
        onClick={() => go(index - 1)}
      />
      <button
        type="button"
        className="proj-arrow proj-arrow--next"
        ref={nextRef}
        aria-label={ariaNext}
        disabled={index === screens.length - 1}
        onClick={() => go(index + 1)}
      />
      {/* Полоса-прогресс: клик по месту открывает ближайший кадр (10.1). */}
      <div
        className="proj-carousel__bar"
        role="slider"
        aria-label={name}
        aria-valuemin={1}
        aria-valuemax={screens.length}
        aria-valuenow={index + 1}
        tabIndex={0}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = (e.clientX - rect.left) / rect.width;
          go(Math.round(frac * (screens.length - 1)));
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(index + 1);
          if (e.key === 'ArrowLeft') go(index - 1);
        }}
      >
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
        <span className="proj-carousel__num">{String(index + 1).padStart(2, '0')}</span>
      </div>
    </div>
  );
}

/** Большой блок изделия (ревизия 02): заметное имя, внятный стек и ссылки. */
function ProjectBlock({ item, index }: { item: ProjectItem; index: number }) {
  const { t } = useLang();
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const frameRef = useRough<HTMLDivElement>('frame', 200 + index, () => ({ padding: 10 }));
  const slotRef = useRough<HTMLDivElement>('hachure-fill', 210, () => ({
    fillStyle: 'cross-hatch',
    hachureGap: 10,
  }));
  const stampRef = useRough<HTMLDivElement>('stamp', 220, () => ({ colorKey: 'accent', padding: 4 }));
  const blockRef = useRef<HTMLElement>(null);
  const disabled = item.status === 'wip';

  useLayoutEffect(() => {
    if (reduced || !blockRef.current) return;
    const tw = gsap.from(blockRef.current, {
      autoAlpha: 0,
      x: index % 2 === 0 ? -48 : 48,
      duration: 0.6,
      ease: 'power2.out',
      scrollTrigger: { trigger: blockRef.current, start: 'top 85%', once: true },
    });
    return () => {
      tw.scrollTrigger?.kill();
      tw.kill();
    };
  }, [reduced, index]);

  return (
    <article className="proj-block" ref={blockRef} aria-disabled={disabled || undefined}>
      <div className="proj-card__inner" ref={frameRef} style={{ padding: 24 }}>
        <header className="proj-block__head">
          <h3 className="proj-block__name">
            <b>{item.id}</b> {item.name}
          </h3>
          {disabled && <span className="proj-block__soon">itch.io — скоро</span>}
        </header>
        <div>
          {disabled ? (
            <div className="proj-carousel" style={{ border: 0 }}>
              <div className="proj-slot" ref={slotRef}>
                <span className="proj-slot__note">{t.projects.slotNote}</span>
              </div>
              <div className="wip-stamp" ref={stampRef}>
                {t.projects.wipStamp}
              </div>
            </div>
          ) : (
            <FrameCarousel
              name={item.name}
              screens={item.screens}
              seedBase={600 + index * 2}
              ariaPrev={t.projects.prev}
              ariaNext={t.projects.next}
            />
          )}
        </div>
        <p className="proj-block__desc">{item.desc}</p>
        <ul className="proj-card__tags">
          {item.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        <div className="proj-card__links">
          {!disabled && item.demo && (
            <DimLink href={item.demo} target="_blank" rel="noreferrer">
              {t.projects.demo}
            </DimLink>
          )}
          {!disabled && item.repo && (
            <DimLink href={item.repo} target="_blank" rel="noreferrer">
              {t.projects.repo}
            </DimLink>
          )}
          {disabled && (
            <DimLink href={item.demo} target="_blank" rel="noreferrer">
              itch.io
            </DimLink>
          )}
        </div>
      </div>
    </article>
  );
}

/** ЛИСТ 05 — Ведомость проектов: вертикальный стек больших блоков. */
export function ProjectsSheet() {
  const { t } = useLang();
  return (
    <Sheet id="sheet-05" titleId="sheet-05-title" kicker={t.projects.kicker} title={t.projects.title}>
      {t.projects.items.map((item, i) => (
        <ProjectBlock key={item.id} item={item} index={i} />
      ))}
      <PencilMark text={t.projects.pencil} style={{ bottom: '6px', right: '6%' }} />
    </Sheet>
  );
}
