import { useLayoutEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '../lib/gsap';
import { annotate } from 'rough-notation';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { useMedia } from '../hooks/useMedia';
import { Sheet } from './Sheet';

/**
 * ЛИСТ 03 — Опыт как git-история (ревизия приёмки):
 * Корсофт — основная ветка (08.2024 → Н.В.), стажировка Wondertales — коммит до неё,
 * фриланс — ветка, отделившаяся в 04.2025 и вмержившаяся в 10.2025,
 * ЦЭМП — ветка, отросшая от Корсофта в 04.2026 и идущая до Н.В. параллельно.
 * Ось — чистый SVG + DrawSVG (карантин rough соблюдён).
 */

const MAIN_H = 'M 0 120 H 1000';
const FREELANCE_H = 'M 355 120 C 385 120 385 205 415 205 H 585 C 615 205 615 120 645 120';
const CEMP_H = 'M 710 120 C 740 120 740 40 770 40 H 1000';

interface RailVariant {
  main: string;
  freelance: string;
  cemp: string;
  nodes: { left: string; top: string; width: string }[];
}

const DESKTOP: RailVariant = {
  main: MAIN_H,
  freelance: FREELANCE_H,
  cemp: CEMP_H,
  // Позиции карточек (десктоп): стажировка и ЦЭМП сверху, Корсофт и фриланс снизу.
  nodes: [
    { left: '0%', top: '0px', width: '21%' }, // Wondertales
    { left: '9%', top: '58%', width: '24%' }, // Корсофт
    { left: '37%', top: '74%', width: '24%' }, // Фриланс
    { left: '73%', top: '0px', width: '26%' }, // ЦЭМП
  ],
};

function ExperienceNode({ seed, period, org, points, now, style }: {
  seed: number;
  period: string;
  org: string;
  points: string[];
  now?: boolean;
  style: React.CSSProperties;
}) {
  const { t } = useLang();
  const ref = useRough<HTMLDivElement>('frame', seed, () => ({
    padding: 8,
    colorKey: now ? 'accent' : 'ink',
  }));
  const orgRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (!orgRef.current) return;
    let ann: { show(): void; hide(): void; remove(): void } | null = null;
    ann = annotate(orgRef.current, { type: 'underline', strokeWidth: 2, animationDuration: 0 });
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
    <div ref={ref} className="exp-node" style={style}>
      <span className="exp-node__period">
        {period}
        {now && <span className="now-pulse">● {t.experience.nowMark}</span>}
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

export function ExperienceSheet() {
  const { t } = useLang();
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const desktop = useMedia('(min-width: 900px)');
  const railRef = useRef<SVGSVGElement>(null);

  // DrawSVG по всем трем путям оси (чистые SVG).
  useLayoutEffect(() => {
    const paths = railRef.current?.querySelectorAll('path');
    if (!paths?.length || reduced) return;
    const tweens = Array.from(paths).map((p, i) =>
      gsap.from(p, {
        drawSVG: 0,
        duration: 0.7,
        delay: i * 0.25,
        ease: 'power2.out',
        scrollTrigger: { trigger: railRef.current, start: 'top 80%', once: true },
      }),
    );
    return () => tweens.forEach((tw) => {
      tw.scrollTrigger?.kill();
      tw.kill();
    });
  }, [reduced, desktop]);

  // Узлы: stagger fade+rise.
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

  const [n0, n1, n2, n3] = t.experience.nodes;
  const positions = DESKTOP.nodes;

  return (
    <Sheet id="sheet-03" titleId="sheet-03-title" kicker={t.experience.kicker} title={t.experience.title}>
      <div className="rail">
        <svg
          ref={railRef}
          className="rail__svg rail__svg--branch"
          viewBox="0 0 1000 240"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={DESKTOP.main} fill="none" stroke="var(--muted)" strokeWidth="1.5" />
          <path d={DESKTOP.freelance} fill="none" stroke="var(--accent2)" strokeWidth="1.2" />
          <path d={DESKTOP.cemp} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
          {/* Н.В. на конце основной ветки (Корсофт) и ветки ЦЭМП */}
          <circle cx="995" cy="120" r="4" fill="var(--accent)" />
          <circle cx="995" cy="40" r="4" fill="var(--accent)" />
        </svg>
        <div className="rail__canvas">
          <ExperienceNode
            seed={400}
            period={n0.period}
            org={n0.org}
            points={n0.points}
            style={{ ...cssSize(positions[0]) }}
          />
          <ExperienceNode
            seed={401}
            period={n1.period}
            org={n1.org}
            points={n1.points}
            now
            style={{ ...cssSize(positions[1]) }}
          />
          <ExperienceNode
            seed={402}
            period={n2.period}
            org={n2.org}
            points={n2.points}
            style={{ ...cssSize(positions[2]) }}
          />
          <ExperienceNode
            seed={403}
            period={n3.period}
            org={n3.org}
            points={n3.points}
            now
            style={{ ...cssSize(positions[3]) }}
          />
        </div>
        <p className="rail__note">{t.experience.branchNote}</p>
      </div>
    </Sheet>
  );
}

function cssSize(p: { left: string; top: string; width: string }): React.CSSProperties {
  return { left: p.left, top: p.top, width: p.width };
}
