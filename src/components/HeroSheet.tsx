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
import { Sheet } from './Sheet';
import { DimLink } from './DimLink';
import { PencilMark } from './PencilMark';

/** Окно осциллографа: живёт только в тёмной теме (спека §5.4). */
function OscilloscopeWindow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const quadRef = useRef<ShaderQuad | null>(null);
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const frameRef = useRough<HTMLDivElement>('frame', 51, () => ({ colorKey: 'accent2', padding: 6 }));

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

/** Светлая тема: «Спецификация свечения» вместо канваса (спека §5.4). */
function GradientSpec() {
  const ref = useRough<HTMLDivElement>('hachure-fill', 610, () => ({
    fillStyle: 'hachure',
    hachureGap: 9,
  }));
  return (
    <div className="gradient-spec" ref={ref} aria-hidden="true">
      <div className="gradient-spec__row">
        <span className="gradient-spec__swatch" style={{ background: 'var(--accent2)' }} />
        C1 — ЧЕРТЁЖНО-ГОЛУБОЙ
      </div>
      <div className="gradient-spec__row">
        <span className="gradient-spec__swatch" style={{ background: 'var(--accent-dim)' }} />
        C2 — РЕДЛАЙН ПРИГЛУШЁННЫЙ
      </div>
      <div className="gradient-spec__row">
        <span className="gradient-spec__swatch" style={{ background: 'var(--bg)' }} />
        C3 — ФОН
      </div>
    </div>
  );
}

export function HeroSheet() {
  const { t } = useLang();
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const nameRef = useRef<HTMLHeadingElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const annoRef = useRef<ReturnType<typeof annotate> | null>(null);
  const titleBlockRef = useRough<HTMLDivElement>('stamp', 500, () => ({ padding: 4 }));

  // Rough-обводка силуэта по готовому пути (спайк Э4(а) — путь подтверждён).
  const silhouetteRef = useRough<HTMLDivElement>(
    'silhouette',
    42,
    () => ({ d: silhouette.levels['0.004'].path, targetEl: portraitRef.current?.querySelector('img') ?? null }),
     
    [],
  );

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
    const fontsReady = Promise.race([
      document.fonts.ready,
      new Promise((r) => setTimeout(r, 800)),
    ]);

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
        // Выноски: fade + DrawSVG по чистым SVG (карантин соблюдён, §4.0).
        tl.from('.callout', { autoAlpha: 0, stagger: 0.08, duration: 0.3 }, 0.5);
        tl.from('.callout svg path', { drawSVG: 0, duration: 0.5, stagger: 0.08 }, 0.5);
        tl.from('.hero__role', { autoAlpha: 0, y: 12, duration: 0.4 }, 0.4);
        tl.from('.hero__contacts > *', { autoAlpha: 0, y: 8, stagger: 0.06, duration: 0.3 }, 0.55);
        tl.from('.title-block', { autoAlpha: 0, duration: 0.4 }, 0.8);
        tl.play();
    });

    return () => {
      tl.kill();
      split?.revert();
      annoRef.current?.remove();
    };
  }, [reduced, t]);

  const [c1, c2, c3] = t.hero.callouts;

  return (
    <Sheet id="sheet-01" titleId="sheet-01-title" hero kicker={`${t.hero.kicker} • ${t.hero.kickerNote}`}>
      <div className="hero" ref={rootRef}>
        <div className="hero__text">
          <h1 className="hero__name" ref={nameRef} id="sheet-01-title" style={{ display: 'block' }}>
            {t.hero.nameLines[0]}
            <br />
            {t.hero.nameLines[1]}
          </h1>
          <p className="hero__role">{t.hero.role}</p>
          <div className="hero__contacts">
            <DimLink href="https://t.me/panteloma">TG @panteloma</DimLink>
            <DimLink href="mailto:dvoinyakovegor00@gmail.com">EMAIL</DimLink>
            <DimLink href="https://github.com/jegorRegularUser">GITHUB</DimLink>
          </div>
          <PencilMark text={t.hero.pencil} style={{ bottom: '-34px', left: '40%' }} />
        </div>

        <div className="hero__figure">
          {theme === 'dark' ? <OscilloscopeWindow /> : <GradientSpec />}

          <div className="hero__portrait-wrap" ref={portraitRef}>
            <div ref={silhouetteRef} style={{ position: 'relative' }}>
              <picture>
                <source type="image/avif" srcSet={portraitAvif} />
                <source type="image/webp" srcSet={portraitWebp} />
                <img
                  src={portraitPng}
                  alt={t.hero.photoAlt}
                  width={1696}
                  height={2047}
                  fetchPriority="high"
                  decoding="async"
                  className="hero__portrait"
                />
              </picture>
            </div>
          </div>

          <span className="callout" style={{ left: '2%', top: '8%' }} aria-hidden="true">
            <svg width="52" height="14" viewBox="0 0 52 14">
              <path d="M0 7 H46 M42 2 L48 7 L42 12" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {c1}
          </span>
          <span className="callout" style={{ right: '0%', top: '46%' }} aria-hidden="true">
            {c2}
            <svg width="52" height="14" viewBox="0 0 52 14">
              <path d="M52 7 H6 M10 2 L4 7 L10 12" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
          <span className="callout" style={{ left: '38%', bottom: '12%' }} aria-hidden="true">
            <svg width="14" height="52" viewBox="0 0 14 52">
              <path d="M7 0 V46 M2 42 L7 48 L12 42" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {c3}
          </span>

          <div className="title-block" ref={titleBlockRef}>
            <table>
              <tbody>
                <tr>
                  <td>{t.hero.stamp.drawn}</td>
                  <td>{t.hero.stamp.drawnBy}</td>
                </tr>
                <tr>
                  <td>{t.hero.stamp.checked}</td>
                  <td>{t.hero.stamp.checkedBy}</td>
                </tr>
                <tr>
                  <td>{t.hero.stamp.sheet}</td>
                  <td>{t.hero.stamp.date}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
