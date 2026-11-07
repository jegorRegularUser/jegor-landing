import { useLayoutEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '../lib/gsap';
import { annotate } from 'rough-notation';
import { redrawAll } from '../rough/registry';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { useMedia } from '../hooks/useMedia';
import { Sheet } from './Sheet';
import { PencilMark } from './PencilMark';

const RAIL_H = 'M0 20 H1000';
const RAIL_V = 'M20 0 V1000';

/** Один узел оси: rough-рамка seed 400–403 (реестр §4.9). */
function ExperienceNode({ seed, period, org, points, active }: {
  seed: number;
  period: string;
  org: string;
  points: string[];
  active?: boolean;
}) {
  const ref = useRough<HTMLDivElement>('frame', seed, () => ({ padding: 8 }));
  const orgRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (!orgRef.current) return;
    const sheet = document.getElementById('sheet-03');
    if (!sheet) return;
    let ann: { show(): void; hide(): void; remove(): void } | null = null;
    ann = annotate(orgRef.current, { type: 'underline', strokeWidth: 2 });
    const st = ScrollTrigger.create({
      trigger: orgRef.current,
      start: 'top 80%',
      onEnter: () => ann?.show(),
      onLeaveBack: () => ann?.hide(),
    });
    return () => {
      st.kill();
      ann?.remove();
    };
  }, [org]);

  return (
    <div ref={ref} className={`exp-node${active ? ' exp-node--active' : ''}`}>
      <span className="exp-node__period">
        {period}
        {active && <span className="now-pulse">●</span>}
      </span>
      <h3 className="exp-node__org" ref={orgRef}>
        {org}
      </h3>
      <ul className="exp-node__list">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

/** ЛИСТ 03 — Опыт («Монтажная ось»): DrawSVG-ось, MorphSVG на брейкпоинте (§4.3). */
export function ExperienceSheet() {
  const { t } = useLang();
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const fine = useMedia('(pointer: fine)');
  const railRef = useRef<SVGSVGElement>(null);
  const railPathRef = useRef<SVGPathElement>(null);

  // Ось: чистый SVG + DrawSVG (карантин соблюдён — rough не трогаем).
  useLayoutEffect(() => {
    const path = railPathRef.current;
    if (!path || reduced) return;
    const draw = gsap.from(path, {
      drawSVG: 0,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: railRef.current, start: 'top 80%', once: true },
    });
    return () => {
      draw.scrollTrigger?.kill();
      draw.kill();
    };
  }, [reduced]);

  // Морф H↔V на брейкпоинте 768px; тач и reduced — кроссфейд (спека §4.3).
  useLayoutEffect(() => {
    const path = railPathRef.current;
    if (!path) return;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      if (reduced || !fine) return;
      if (path.getAttribute('d') !== RAIL_H) {
        gsap.to(path, {
          morphSVG: RAIL_H,
          duration: 0.6,
          ease: 'power2.inOut',
          onComplete: () => {
            path.setAttribute('d', RAIL_H);
            gsap.set(path, { morphSVG: undefined as unknown as string });
            // Хук (iv): после морфа — redraw rough-узлов секции.
            redrawAll();
            ScrollTrigger.refresh();
          },
        });
      } else {
        path.setAttribute('d', RAIL_H);
      }
    });
    mm.add('(max-width: 899px)', () => {
      path.setAttribute('d', RAIL_V);
    });
    return () => mm.revert();
  }, [reduced, fine]);

  // Узлы: stagger fade+rise 60ms (спека §4.3).
  useLayoutEffect(() => {
    if (reduced) return;
    const nodes = document.querySelectorAll('#sheet-03 .exp-node');
    const tweens = Array.from(nodes).map((n, i) =>
      gsap.from(n, {
        autoAlpha: 0,
        y: 24,
        duration: 0.5,
        delay: i * 0.06,
        scrollTrigger: { trigger: n, start: 'top 88%', once: true },
      }),
    );
    return () => tweens.forEach((tw) => {
      tw.scrollTrigger?.kill();
      tw.kill();
    });
  }, [reduced, t]);

  const nodes = t.experience.nodes;

  return (
    <Sheet id="sheet-03" titleId="sheet-03-title" kicker={t.experience.kicker} title={t.experience.title}>
      <div className="rail">
        <svg ref={railRef} className="rail__svg" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
          <path
            ref={railPathRef}
            d={RAIL_H}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="1.5"
          />
        </svg>
        <div className="rail__nodes">
          {nodes.map((n, i) => (
            <ExperienceNode
              key={n.org}
              seed={400 + i}
              period={n.period}
              org={n.org}
              points={n.points}
              active={i === nodes.length - 1}
            />
          ))}
        </div>
        <PencilMark text={t.experience.pencil} style={{ top: '-34px', right: '6%' }} />
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)' }}>
        {t.experience.freelanceRail}: {nodes[2].period}
      </p>
    </Sheet>
  );
}
