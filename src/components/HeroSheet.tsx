import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import portraitAvif from '../assets/portrait.avif';
import portraitWebp from '../assets/portrait.webp';
import portraitPng from '../assets/portrait.png';
import silhouette from '../assets/silhouette-hero.json';
import { gsap, SplitText } from '../lib/gsap';
import { useRough } from '../rough/useRough';
import { annotate } from 'rough-notation';
import type { ShaderQuad } from '../shader/quad';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../hooks/useMedia';
import { changeToday } from '../state/ChangeLog';
import { Sheet } from './Sheet';
import { PencilMark } from './PencilMark';

/** Окно осциллографа: живёт только в тёмной теме (спека §5.4). */
function OscilloscopeWindow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const quadRef = useRef<ShaderQuad | null>(null);
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const frameRef = useRough<HTMLDivElement>('frame', 51, () => ({
    colorKey: 'accent2',
    padding: 6,
  }));

  useEffect(() => {
    let disposed = false;
    (async () => {
      // Динамический import: шейдер не в критическом чанке (спека §10.1).
      const { mountShaderQuad } = await import('../shader/quad');
      if (disposed || !canvasRef.current) return;
      const quad = mountShaderQuad(canvasRef.current, ['#56C8E8', '#B85C2A', '#0A1E33'], reduced);
      if (disposed) {
        quad?.dispose();
        return;
      }
      if (!quad) {
        setFailed(true);
        return;
      }
      quadRef.current = quad;
    })();
    return () => {
      disposed = true;
      quadRef.current?.dispose();
      quadRef.current = null;
    };
  }, [reduced]);

  // Пауза: вне вьюпорта, скрытая вкладка (спека §5.4).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let inView = true;
    let visible = !document.hidden;
    const sync = () => quadRef.current?.setPaused(!inView || !visible);
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? true;
        sync();
      },
      { threshold: 0 },
    );
    io.observe(el);
    const onVis = () => {
      visible = !document.hidden;
      sync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  if (failed) {
    return (
      <div className="osc-window" ref={wrapRef}>
        <div className="shader-fallback" />
      </div>
    );
  }

  return (
    <div className="osc-window" ref={wrapRef}>
      <div ref={frameRef} style={{ position: 'absolute', inset: 0 }}>
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
    </div>
  );
}

/** Светлая тема: фейковая ошибка React (забавка 8.1). Собственной штриховки
 *  у панели нет — фон-штриховка живёт отдельным слоем LightHatch за ней.
 *  Стектрейс намеренно «консольный» на английском, туду-приписка локализуется. */
function ErrorCard() {
  const { t } = useLang();
  return (
    <div className="err-card" aria-hidden="true">
      <div className="err-card__head">
        <span>Uncaught Error</span>
        <span>react-dom.development.js:15486</span>
      </div>
      <pre>{`Error: gradient didn't load on light theme
    at OscilloscopeWindow (sheet-01.tsx:42)
    at renderWithHooks (react-dom.development.js:15486)`}</pre>
      <pre className="err-card__comment">{t.hero.errTodo}</pre>
    </div>
  );
}

/** Фон фигуры в светлой теме — за портретом: рисованный полигон с оранжевой
 *  (терракота --accent) hachure-заливкой, тот же вид, что у плиток листа 03
 *  (jitter-контур, штрих −41°). Бокс подложки задаёт .light-hatch — он
 *  повторяет геометрию окна осциллографа тёмной темы. */
function LightHatch() {
  const ref = useRough<HTMLDivElement>('polygon', 611, () => ({
    colorKey: 'accent',
    padding: 8,
    jitter: 8,
    roughness: 2.1,
    fillStyle: 'hachure',
    hachureGap: 13,
    hachureAngle: -41,
    strokeWidth: 1,
    opacity: 0.4,
  }));
  return <div className="light-hatch" ref={ref} aria-hidden="true" />;
}

/** Рисованная стрелка выноски (3): rough-оверлей вместо голого svg. */
function CalloutArrow({
  seed,
  flip,
  vertical,
}: {
  seed: number;
  flip?: boolean;
  vertical?: boolean;
}) {
  const ref = useRough<HTMLSpanElement>('arrow', seed, () => ({
    flip,
    padding: 2,
    roughness: 1.2,
  }));
  return (
    <span
      className={`callout-arrow${vertical ? ' callout-arrow--v' : ''}`}
      ref={ref}
      aria-hidden="true"
    />
  );
}

export function HeroSheet() {
  const { t, lang } = useLang();
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const nameRef = useRef<HTMLHeadingElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const annoRef = useRef<ReturnType<typeof annotate> | null>(null);
  const titleBlockRef = useRough<HTMLDivElement>('stamp', 500, () => ({ padding: 4 }));

  // Rough-обводка силуэта по готовому пути (спайк Э4(а) — путь подтверждён).
  // Уровень 0.002 — самая плотная кривая: меньше изломов на длинных дугах.
  const silhouetteRef = useRough<HTMLDivElement>(
    'silhouette',
    42,
    () => ({
      d: silhouette.levels['0.002'].path,
      targetEl: portraitRef.current?.querySelector('img') ?? null,
    }),
    [],
  );

  // Интро — один раз за монтирование (зависимость только reduced): смена
  // языка не должна перезапускать анимацию и снова всё прятать.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const name = nameRef.current;
    if (!root || !name) return;

    if (reduced) {
      // Всё сразу в финальном состоянии (спека §4.1).
      return;
    }

    let split: SplitText | null = null;
    const tl = gsap.timeline({ paused: true });
    const fontsReady = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]);

    fontsReady.then(() => {
      // Шрифты готовы (или 800ms истекли): имя либо сплитится, либо живёт как есть.
      if (document.fonts.status === 'loaded') {
        split = new SplitText(name, { type: 'chars' });
        tl.from(split.chars, { yPercent: 110, autoAlpha: 0, stagger: 0.03, duration: 0.5 }, 0);
      }
      tl.call(
        () => {
          const a = annotate(name, { type: 'underline', animationDuration: 600 });
          annoRef.current = a;
          a.show();
        },
        undefined,
        0.2,
      );
      tl.fromTo(
        root.querySelector('.hero__portrait-wrap'),
        { autoAlpha: 0, scale: 0.97 },
        { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'power2.out' },
        0.25,
      );
      tl.from('.callout', { autoAlpha: 0, stagger: 0.08, duration: 0.3 }, 0.5);
      tl.from('.hero__role', { autoAlpha: 0, y: 12, duration: 0.4 }, 0.4);
      tl.from('.title-block', { autoAlpha: 0, duration: 0.4 }, 0.8);
      tl.play();
    });

    return () => {
      tl.kill();
      split?.revert();
      annoRef.current?.remove();
    };
  }, [reduced]);

  // Смена языка: h1 пересоздаётся (key={lang}) — пере-сплит имени и свежее
  // подчёркивание. Старый SplitText.revert() из интро восстанавливал свой
  // исходный DOM и затирал React-текст — имя оставалось русским в EN.
  const mountedLangRef = useRef(lang);
  useLayoutEffect(() => {
    if (mountedLangRef.current === lang) return;
    mountedLangRef.current = lang;
    if (reduced) return;
    const name = nameRef.current;
    if (!name || document.fonts.status !== 'loaded') return;
    const split = new SplitText(name, { type: 'chars' });
    const a = annotate(name, { type: 'underline', animationDuration: 600 });
    a.show();
    return () => {
      split.revert();
      a.remove();
    };
  }, [lang, reduced]);

  const [c1, c2] = t.hero.callouts;

  return (
    <Sheet
      id="sheet-01"
      titleId="sheet-01-title"
      hero
      kicker={`${t.hero.kicker} • ${t.hero.kickerNote}`}
    >
      <div className="hero" ref={rootRef}>
        <div className="hero__text">
          <h1
            key={lang}
            className="hero__name"
            ref={nameRef}
            id="sheet-01-title"
            style={{ display: 'block' }}
          >
            <span className="hero__name-line">{t.hero.nameLines[0]}</span>
            <span className="hero__name-line">{t.hero.nameLines[1]}</span>
          </h1>
          <p className="hero__role">{t.hero.role}</p>
          <PencilMark text={t.hero.pencil} style={{ bottom: '6px', left: '40%' }} />
        </div>

        <div className="hero__figure">
          {theme === 'dark' ? <OscilloscopeWindow /> : <LightHatch />}

          <div className="hero__portrait-wrap" ref={portraitRef}>
            <div ref={silhouetteRef} style={{ position: 'relative' }}>
              <picture>
                <source type="image/avif" srcSet={portraitAvif} />
                <source type="image/webp" srcSet={portraitWebp} />
                <img
                  src={portraitPng}
                  alt={t.hero.photoAlt}
                  width={2000}
                  height={2413}
                  fetchPriority="high"
                  decoding="async"
                  className="hero__portrait"
                />
              </picture>
            </div>
          </div>

          {theme === 'light' && <ErrorCard />}

          <span
            className="callout callout--city"
            style={{ right: '2%', top: '0%' }}
            aria-hidden="true"
          >
            {c1}
            <CalloutArrow seed={640} />
          </span>
          <span
            className="callout callout--scale"
            style={{ left: '30%', bottom: '-46px' }}
            aria-hidden="true"
          >
            <CalloutArrow seed={641} vertical />
            {c2}
          </span>

          <div className="title-block" ref={titleBlockRef}>
            <table>
              <tbody>
                <tr>
                  <td>{t.hero.stamp.drawn}</td>
                  <td className="hand">{t.hero.stamp.drawnBy}</td>
                </tr>
                <tr>
                  <td>{t.hero.stamp.checked}</td>
                  <td className="hand">{t.hero.stamp.checkedBy}</td>
                </tr>
                <tr>
                  <td>{t.hero.stamp.sheet}</td>
                  <td className="hand">
                    {t.hero.stamp.dateLabel} — {changeToday()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
