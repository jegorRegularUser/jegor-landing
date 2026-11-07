import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from '../lib/gsap';
import { annotate } from 'rough-notation';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { useMedia } from '../hooks/useMedia';
import { Sheet } from './Sheet';

/**
 * ЛИСТ 03 — Опыт как git-история (ревизия 02): линии нарисованы rough'ом
 * и пожирнее; карточки по умолчанию компактные (дата + компания), по клику
 * раскрываются поверх контента на своём фоне чертёжной бумаги (5).
 */

const MAIN_H = 'M 0 120 H 1000';
const FREELANCE_H = 'M 355 120 C 385 120 385 205 415 205 H 585 C 615 205 615 120 645 120';
const CEMP_H = 'M 710 120 C 740 120 740 40 770 40 H 1000';

const NODE_POS = [
  { left: '1%', top: '2%' },
  { left: '9%', top: '50%' },
  { left: '36%', top: '66%' },
  { left: '70%', top: '2%' },
];

function ExperienceNode({ seed, index, now, accent }: {
  seed: number;
  index: number;
  now?: boolean;
  accent?: boolean;
}) {
  const { t } = useLang();
  const node = t.experience.nodes[index];
  const [open, setOpen] = useState(false);
  const ref = useRough<HTMLDivElement>('frame', seed, () => ({
    padding: 8,
    colorKey: accent ? 'accent' : 'ink',
  }));
  const orgRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (!open || !orgRef.current) return;
    const ann = annotate(orgRef.current, {
      type: 'underline',
      strokeWidth: 2,
      animationDuration: 0,
    });
    ann.show();
    return () => ann.remove();
  }, [open]);

  return (
    <div
      ref={ref}
      className={`exp-node${open ? ' exp-node--open' : ''}`}
      style={NODE_POS[index]}
    >
      <button
        type="button"
        className="exp-node__head"
        aria-expanded={open}
        aria-label={t.experience.expandAria}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="exp-node__period">
          {node.period}
          {now && <span className="now-pulse">● {t.experience.nowMark}</span>}
        </span>
        <span className="exp-node__org">{node.org}</span>
      </button>
      {open && (
        <div className="exp-node__body">
          <ul className="exp-node__list">
            {node.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ExperienceSheet() {
  const { t } = useLang();
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const desktop = useMedia('(min-width: 900px)');
  const stageRef = useRef<HTMLDivElement>(null);

  // Rough-гит-линии: рисуются реестром (path), вход — мягкий fade (карантин).
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || reduced || !desktop) return;
    const overlays = stage.querySelectorAll<SVGSVGElement>('.rough-overlay');
    const tweens = Array.from(overlays).map((el, i) =>
      gsap.from(el, {
        autoAlpha: 0,
        duration: 0.6,
        delay: i * 0.25,
        scrollTrigger: { trigger: stage, start: 'top 80%', once: true },
      }),
    );
    return () => tweens.forEach((tw) => {
      tw.scrollTrigger?.kill();
      tw.kill();
    });
  }, [reduced, desktop]);

  return (
    <Sheet id="sheet-03" titleId="sheet-03-title" kicker={t.experience.kicker} title={t.experience.title}>
      <div className="rail" ref={stageRef}>
        <RailLines />
        <div className="rail__nodes">
          <ExperienceNode seed={400} index={0} />
          <ExperienceNode seed={401} index={1} now />
          <ExperienceNode seed={402} index={2} />
          <ExperienceNode seed={403} index={3} now accent />
        </div>
      </div>
    </Sheet>
  );
}

/** Три rough-линии оси: основная (Корсофт), фриланс-ветка, ветка ЦЭМП. */
function RailLines() {
  const mainRef = useRough<HTMLDivElement>('path', 620, () => ({
    d: MAIN_H,
    scaleW: 1000,
    strokeWidth: 3,
  }));
  const freelanceRef = useRough<HTMLDivElement>('path', 621, () => ({
    d: FREELANCE_H,
    scaleW: 1000,
    strokeWidth: 2.4,
    colorKey: 'accent2',
  }));
  const cempRef = useRough<HTMLDivElement>('path', 622, () => ({
    d: CEMP_H,
    scaleW: 1000,
    strokeWidth: 3,
    colorKey: 'accent',
  }));
  return (
    <>
      <div className="rail__line" ref={mainRef} aria-hidden="true" />
      <div className="rail__line" ref={freelanceRef} aria-hidden="true" />
      <div className="rail__line" ref={cempRef} aria-hidden="true" />
      <span className="rail__now rail__now--main" aria-hidden="true" />
      <span className="rail__now rail__now--cemp" aria-hidden="true" />
    </>
  );
}
