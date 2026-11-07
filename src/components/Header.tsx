import { useEffect, useState } from 'react';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../theme/ThemeProvider';
import { useSheetsObserver } from '../hooks/useSheetsObserver';
import { useRough } from '../rough/useRough';
import { CAD_TOGGLE_EVENT } from './CadCursor';

function cadOn(): boolean {
  try {
    return localStorage.getItem('jegor-cad') !== 'off';
  } catch {
    return true;
  }
}

export function Header() {
  const { t, lang, setLang } = useLang();
  const { toggle: toggleTheme } = useTheme();
  const { activeId } = useSheetsObserver();
  const [cad, setCad] = useState(cadOn);
  const themeBtnRef = useRough<HTMLButtonElement>('stamp', 501, () => ({
    colorKey: 'accent',
    padding: 3,
  }));

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
          <button
            type="button"
            className="toggle-btn"
            data-theme-stamp
            ref={themeBtnRef}
            aria-label={t.nav.themeAria}
            onClick={toggleTheme}
          >
            {t.nav.theme}
          </button>
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
