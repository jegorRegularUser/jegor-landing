import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { gsap } from '../lib/gsap';
import { recolorAll } from '../rough/registry';
import { prefersReducedMotion } from '../lib/motion';
import { useReducedMotion } from '../hooks/useMedia';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggle(): void;
}

const ThemeContext = createContext<ThemeState | null>(null);

function initialTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/**
 * Смена темы = data-theme + localStorage + recolor-in-place (спека §6.3):
 * БЕЗ регенерации rough и БЕЗ ScrollTrigger.refresh. Затем — штамп «ИЗМ. 01».
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const reduced = useReducedMotion();

  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('jegor-theme', next);
    } catch {
      /* приватный режим */
    }
    setTheme(next);
    recolorAll();
    const stamp = document.querySelector<HTMLElement>('[data-theme-stamp]');
    if (stamp && !prefersReducedMotion()) {
      gsap.fromTo(
        stamp,
        { scale: 1.5, rotate: 0, autoAlpha: 0 },
        { scale: 1, rotate: -8, autoAlpha: 1, duration: 0.4, ease: 'back.out(2)' },
      );
    } else if (stamp) {
      stamp.style.opacity = '1';
    }
  }, []);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  void reduced;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme вне ThemeProvider');
  return ctx;
}
