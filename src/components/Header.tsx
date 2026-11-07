import { useEffect, useRef, useState } from 'react';
import { gsap } from '../lib/gsap';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../theme/ThemeProvider';
import { useSheetsObserver } from '../hooks/useSheetsObserver';
import { useRough } from '../rough/useRough';
import { useMedia } from '../hooks/useMedia';
import { knock } from '../lib/knock';
import type { Playground } from '../lib/physics';
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
  const [cad, setCad] = useState(cadOn);
  const themeBtnRef = useRough<HTMLButtonElement>('stamp', 501, () => ({
    colorKey: 'accent',
    padding: 3,
  }));
  const [stage, setStage] = useState<ThemeStage>(0);
  const playgroundRef = useRef<Playground | null>(null);
  const lastFlip = useRef(0);

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
      { rotate: -4 * s, y: s * 2 },
      { rotate: 3 * s, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.35)', transformOrigin: 'bottom left' },
    );
  };

  /** Оторвать кнопку в физику: тема меняется на каждом отскоке (11). */
  const detach = async () => {
    const btn = themeBtnRef.current;
    if (!btn || playgroundRef.current) return;
    setStage(3);
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
    playgroundRef.current = pg;
    pg.fragmentize(btn, { canSplit: false, restitution: 0.6 });
    pg.setBin(() => {
      // Кнопка в корзине: страница зарастает рисованными линиями и перезагружается.
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
    });
  };

  /** Прибить кнопку обратно на гвозди: полёт, три удара, метки гвоздей. */
  const nailBack = () => {
    const btn = themeBtnRef.current;
    playgroundRef.current?.destroy();
    playgroundRef.current = null;
    setStage(0);
    if (!btn) return;
    knock(0.9);
    if (!reduced) {
      gsap.fromTo(
        btn,
        { y: 220, rotate: 24, autoAlpha: 0 },
        { y: 0, rotate: 0, autoAlpha: 1, duration: 0.55, ease: 'power2.in' },
      );
      [0, 1, 2].forEach((i) => {
        const nail = document.createElement('span');
        nail.className = 'nail-mark';
        nail.style.left = `${6 + i * 9}px`;
        nail.style.top = '50%';
        btn.appendChild(nail);
        window.setTimeout(() => {
          knock(1 - i * 0.15);
          gsap.fromTo(nail, { scaleX: 3, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.18 });
        }, 550 + i * 160);
        window.setTimeout(() => nail.remove(), 3200);
      });
    }
  };

  const onThemeClick = () => {
    toggleTheme();
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
          ЕД • <b>2026-Ф1</b>
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
            <button
              type="button"
              className="toggle-btn"
              aria-label={t.contacts.restore}
              onClick={nailBack}
              style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
            >
              {t.nav.nail}
            </button>
          )}
          <button
            type="button"
            className="toggle-btn"
            aria-label={t.nav.langAria}
            onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
          >
            {t.nav.lang}
          </button>
        </div>
      </div>
    </header>
  );
}
