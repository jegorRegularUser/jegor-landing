import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from '../lib/gsap';
import { annotate } from 'rough-notation';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { useMedia } from '../hooks/useMedia';
import { Sheet } from './Sheet';

/**
 * ЛИСТ 03 — Опыт (ревизия 04): последовательный стек карточек.
 * Гит-ветки и абсолютная раскладка убраны — карточки наезжали друг на друга
 * и вылезали за лист. Порядок хронологический; раскрытие — анимацией,
 * rough-рамка перерисовывается на новый размер тем же seed'ом.
 * Корсофт и ЦЭМП — с оранжевой рамкой (обе «по н.в.»).
 */

function ExperienceNode({ seed, index, now, accent }: {
  seed: number;
  index: number;
  now?: boolean;
  accent?: boolean;
}) {
  const { t } = useLang();
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const node = t.experience.nodes[index];
  const [open, setOpen] = useState(false);
  // Рамка перерисовывается на весь раскрытый размер тем же seed'ом (6.1).
  const ref = useRough<HTMLDivElement>(
    'frame',
    seed,
    () => ({
      padding: 8,
      colorKey: accent ? 'accent' : 'ink',
    }),
    [open],
  );
  const orgRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

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

  // Раскрытие — плавное: тело вырастает по высоте и проявляется,
  // rough-рамка к этому моменту уже перерисована на новый размер (6.6).
  useEffect(() => {
    if (open && bodyRef.current && !reduced) {
      const el = bodyRef.current;
      const h = el.offsetHeight;
      gsap.fromTo(
        el,
        { height: 0, autoAlpha: 0, overflow: 'hidden' },
        {
          height: h,
          autoAlpha: 1,
          duration: 0.5,
          ease: 'power3.out',
          clearProps: 'height,overflow',
          onComplete: () => {
            el.style.height = '';
            el.style.overflow = '';
          },
        },
      );
    }
  }, [open, reduced]);

  return (
    <div
      ref={ref}
      className={`exp-node${open ? ' exp-node--open' : ''}`}
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
        <span className="exp-node__org" ref={orgRef}>{node.org}</span>
      </button>
      {open && (
        <div className="exp-node__body" ref={bodyRef}>
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
  const stageRef = useRef<HTMLDivElement>(null);

  // Вход стека: карточки поднимаются по очереди, когда лист доскроллился.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || reduced) return;
    const tw = gsap.from(stage.querySelectorAll('.exp-node'), {
      autoAlpha: 0,
      y: 24,
      stagger: 0.08,
      duration: 0.5,
      ease: 'power2.out',
      scrollTrigger: { trigger: stage, start: 'top 80%', once: true },
    });
    return () => {
      tw.scrollTrigger?.kill();
      tw.kill();
    };
  }, [reduced]);

  return (
    <Sheet id="sheet-03" titleId="sheet-03-title" kicker={t.experience.kicker} title={t.experience.title}>
      <div className="rail" ref={stageRef}>
        {t.experience.nodes.map((_, i) => (
          <ExperienceNode
            key={i}
            seed={400 + i}
            index={i}
            now={i === 1 || i === 3}
            accent={i === 1 || i === 3}
          />
        ))}
      </div>
    </Sheet>
  );
}
