import { useEffect, useRef, useState } from 'react';
import { gsap } from '../lib/gsap';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../theme/ThemeProvider';
import { useSheetsObserver } from '../hooks/useSheetsObserver';
import { useRough } from '../rough/useRough';
import { useMedia } from '../hooks/useMedia';
import { useChangeLog } from '../state/ChangeLog';
import { knock } from '../lib/knock';
import { persistNailsOn } from '../lib/nailFx';
import type { Playground } from '../lib/physics';
import type { Body } from 'matter-js';
import { CAD_TOGGLE_EVENT } from './CadCursor';

function cadOn(): boolean {
  try {
    return localStorage.getItem('jegor-cad') !== 'off';
  } catch {
    return true;
  }
}

type ThemeStage = 0 | 1 | 2 | 3; // 3 = кнопка оторвана и живёт в физике

/** Иконки темы: рукописные солнце/луна (11: явное назначение кнопки). */
function ThemeIcon({ theme }: { theme: 'dark' | 'light' }) {
  return theme === 'dark' ? (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M11 9 A5 5 0 1 1 9 1.5 A4 4 0 0 0 11 9 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M7 1 V2.6 M7 11.4 V13 M1 7 H2.6 M11.4 7 H13 M2.8 2.8 L3.9 3.9 M10.1 10.1 L11.2 11.2 M11.2 2.8 L10.1 3.9 M3.9 10.1 L2.8 11.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function Header() {
  const { t, lang, setLang } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();
  const { activeId } = useSheetsObserver();
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const { addChange } = useChangeLog();
  const [cad, setCad] = useState(cadOn);
  const themeBtnRef = useRough<HTMLButtonElement>('stamp', 501, () => ({
    colorKey: 'accent',
    padding: 3,
  }));
  const [stage, setStage] = useState<ThemeStage>(0);
  // Кнопка прибита намертво: не качается, не срывается, гвозди живут.
  const [nailed, setNailed] = useState(false);
  const playgroundRef = useRef<Playground | null>(null);
  const detachedBodyRef = useRef<Body | null>(null);
  const nailAnchorRef = useRef<HTMLSpanElement>(null);
  const detachingRef = useRef(false);
  const lastFlip = useRef(0);
  // Гонка: эффект на stage 3 срабатывает раньше, чем резолвится import физики.
  // pgReady отмечает готовность сцены и тела — тогда и вешаем setNailBack.
  const [pgReady, setPgReady] = useState(false);

  useEffect(() => {
    const onToggle = () => setCad(cadOn());
    window.addEventListener(CAD_TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(CAD_TOGGLE_EVENT, onToggle);
  }, []);

  const toggleCad = () => {
    const next = !cad;
    try {
      localStorage.setItem('jegor-cad', next ? 'on' : 'off');
    } catch {
      /* приватный режим */
    }
    setCad(next);
    window.dispatchEvent(new Event(CAD_TOGGLE_EVENT));
  };

  const wobble = (s: number) => {
    const btn = themeBtnRef.current;
    if (!btn || reduced) return;
    gsap.fromTo(
      btn,
      { rotate: -7 * s, y: s * 4 },
      {
        rotate: 5 * s,
        y: 0,
        duration: 0.8,
        ease: 'elastic.out(1, 0.3)',
        transformOrigin: 'bottom left',
      },
    );
  };

  /** Пасхалка (16): страница зарастает рисованными линиями и перезагружается. */
  const sketchCover = () => {
    const cover = document.createElement('div');
    cover.className = 'sketch-cover';
    cover.innerHTML = `<svg viewBox="0 0 1000 600" preserveAspectRatio="none">
      ${Array.from({ length: 12 }, (_, i) => {
        const y = 40 + i * 46;
        return `<path d="M -20 ${y} C 250 ${y - 30} 750 ${y + 34} 1020 ${y - 12}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="1400" stroke-dashoffset="1400" style="animation: sketch-draw 0.7s ${i * 0.09}s forwards ease-out" />`;
      }).join('')}
    </svg>`;
    document.body.appendChild(cover);
    window.setTimeout(() => window.location.reload(), 1100);
  };

  /** Оторвать кнопку в физику: тема меняется на каждом отскоке (11). */
  const detach = async () => {
    const btn = themeBtnRef.current;
    if (!btn || playgroundRef.current || detachingRef.current) return;
    detachingRef.current = true;
    // rect и натуральные размеры — ДО setStage: React размонтирует кнопку,
    // и у отсоединённого узла getBoundingClientRect уже нулевой.
    const btnRect = btn.getBoundingClientRect();
    const rect = {
      left: btnRect.left,
      top: btnRect.top,
      width: btn.offsetWidth || btnRect.width,
      height: btn.offsetHeight || btnRect.height,
    };
    setStage(3);
    addChange(t.footer.dynamic.button);
    try {
      const { createPlayground } = await import('../lib/physics');
      const pg = await createPlayground(document.body, {
        onImpact: (_el, speed) => {
          if (speed < 3) return;
          const now = Date.now();
          if (now - lastFlip.current < 400) return;
          lastFlip.current = now;
          toggleTheme();
          knock(Math.min(1, speed / 12));
        },
      });
      if (playgroundRef.current) {
        pg.destroy(); // двойной клик: сцена уже создана — новую не бросаем жить
        return;
      }
      playgroundRef.current = pg;
      detachedBodyRef.current = pg.fragmentize(btn, {
        mode: 'solid',
        restitution: 0.6,
        rect,
      });
      pg.setBin(sketchCover);
      setPgReady(true);
    } catch (e) {
      // Физика недоступна: кнопка падает твинами, тема щёлкает на полпути.
      console.warn('[physics] fallback', e);
      detachingRef.current = false; // кнопку можно будет оторвать снова после возврата
      const flips = [0.35, 0.7];
      gsap.to(btn, {
        y: window.innerHeight,
        rotation: 380,
        duration: 1.2,
        ease: 'power1.in',
        onUpdate: () => {
          const p = gsap.getProperty(btn, 'y') as number;
          const f = p / window.innerHeight;
          if (flips.length && f > flips[0]) {
            flips.shift();
            toggleTheme();
            knock(0.6);
          }
        },
        onComplete: () => {
          btn.style.opacity = '0';
        },
      });
    }
  };

  // Слот кнопки появляется на stage 3 — тогда и включаем прибивание притаскиванием (11).
  useEffect(() => {
    if (stage !== 3 || !pgReady) return;
    const pg = playgroundRef.current;
    const anchor = nailAnchorRef.current;
    const body = detachedBodyRef.current;
    if (!pg || !anchor || !body) return;
    pg.setNailBack(anchor, body, () => {
      // Гвозди забиты: снести физику и вернуть живую кнопку на её слот.
      setStage(0);
      setPgReady(false);
      setNailed(true);
      addChange(t.footer.dynamic.nailed);
      knock(0.8);
      window.setTimeout(() => {
        pg.destroy();
        if (playgroundRef.current === pg) {
          playgroundRef.current = null;
          detachedBodyRef.current = null;
        }
      }, 60);
    });
  }, [stage, pgReady, t, addChange]);

  // Живая кнопка вернулась на слот — молоток уже отыграл по куску в физике,
  // на свежую кнопку просто переносим забитые гвозди (второй раз бить не надо).
  useEffect(() => {
    if (stage !== 0 || !nailed) return;
    const btn = themeBtnRef.current;
    if (!btn || btn.querySelector('.nail-fx__nail')) return;
    persistNailsOn(btn);
  }, [stage, nailed, themeBtnRef]);

  const onThemeClick = () => {
    // Прибитая кнопка мертва: ни смены темы, ни штампа, ни вобла — гвозди держат.
    if (nailed) {
      knock(0.15);
      return;
    }
    toggleTheme();
    addChange(t.footer.dynamic.theme);
    if (stage < 2) {
      const next = (stage + 1) as ThemeStage;
      setStage(next);
      wobble(next);
      knock(0.4 + next * 0.15);
    } else if (stage === 2) {
      void detach();
    }
    // stage 3: кнопка в физике, кликов нет.
  };

  return (
    <header className="header">
      <div className="header__row">
        <a className="header__logo" href="#sheet-01">
          <b>2026-Ф1</b>
        </a>
        <nav className="set-contents" aria-label={t.nav.setContents}>
          {t.nav.sheets.map((s) => (
            <a key={s.id} href={`#${s.id}`} aria-current={activeId === s.id ? 'true' : undefined}>
              {s.label}
            </a>
          ))}
        </nav>
        <div className="header__toggles">
          <button
            type="button"
            className="toggle-btn"
            aria-pressed={cad}
            aria-label={cad ? t.nav.cadOn : t.nav.cadOff}
            onClick={toggleCad}
          >
            CAD
          </button>
          {stage < 3 ? (
            <button
              type="button"
              className={`toggle-btn theme-btn${stage > 0 ? ' theme-btn--loose' : ''}`}
              data-theme-stamp
              ref={themeBtnRef}
              aria-label={t.nav.themeAria}
              onClick={onThemeClick}
            >
              <ThemeIcon theme={theme} />
              {t.nav.theme}
            </button>
          ) : (
            /* Невидимый слот — якорь для прибивания притаскиванием (11).
               Никакой заменяющей кнопки: в навигации дыра, летит один кусок. */
            <span ref={nailAnchorRef} className="nail-slot-anchor" aria-hidden="true" />
          )}
          <button
            type="button"
            className="toggle-btn"
            aria-label={t.nav.langAria}
            onClick={() => {
              setLang(lang === 'ru' ? 'en' : 'ru');
              addChange(t.footer.dynamic.lang);
            }}
          >
            {t.nav.lang}
          </button>
        </div>
      </div>
    </header>
  );
}
