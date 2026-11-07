import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ru } from './ru';
import { en } from './en';
import type { Dict } from './ru';

export type Lang = 'ru' | 'en';

const DICTS: Record<Lang, Dict> = { ru, en };

interface LangState {
  lang: Lang;
  t: Dict;
  setLang(l: Lang): void;
}

const LangContext = createContext<LangState | null>(null);

function initialLang(): Lang {
  return document.documentElement.lang === 'en' ? 'en' : 'ru';
}

/** Смена языка: ре-рендер дерева + recreate notation + refresh снаружи (спека §7.1). */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    document.documentElement.lang = l;
    try {
      localStorage.setItem('jegor-lang', l);
    } catch {
      /* приватный режим — язык живёт до перезагрузки */
    }
    setLangState(l);
  }, []);

  const value = useMemo(() => ({ lang, t: DICTS[lang], setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangState {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang вне LangProvider');
  return ctx;
}
