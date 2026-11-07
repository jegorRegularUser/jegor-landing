import { useLayoutEffect } from 'react';
import { LangProvider, useLang } from './i18n/LangContext';
import { ThemeProvider } from './theme/ThemeProvider';
import { SheetsObserverProvider } from './hooks/useSheetsObserver';
import { ScrollTrigger } from './lib/gsap';
import { redrawAll } from './rough/registry';
import { Header } from './components/Header';
import { CadCursor } from './components/CadCursor';
import { HeroSheet } from './components/HeroSheet';
import { AboutSheet } from './components/AboutSheet';
import { ExperienceSheet } from './components/ExperienceSheet';
import { TechSheet } from './components/TechSheet';
import { ProjectsSheet } from './components/ProjectsSheet';
import { DiplomasSheet } from './components/DiplomasSheet';
import { ContactsSheet } from './components/ContactsSheet';
import { FooterSheet } from './components/FooterSheet';

function debounce(fn: () => void, ms: number): () => void {
  let id = 0;
  return () => {
    window.clearTimeout(id);
    id = window.setTimeout(fn, ms);
  };
}

/** Глобальный жизненный цикл GSAP ↔ rough (спека §6.5): шрифты, resize, язык. */
function GlobalLifecycle() {
  const { lang, t } = useLang();

  useLayoutEffect(() => {
    const redraw = () => {
      redrawAll();
      ScrollTrigger.refresh();
    };
    const t1 = window.setTimeout(redraw, 60);
    document.fonts.ready.then(redraw);
    const onResize = debounce(redraw, 200);
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(t1);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Язык: метрики текста меняются — recreate notation внутри компонентов
  // (по deps) + один refresh. document.title/meta — из словаря (§7.1).
  useLayoutEffect(() => {
    document.title = t.meta.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t.meta.description);
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [lang, t]);

  return null;
}

function Site() {
  const { t } = useLang();
  return (
    <>
      <a className="skip-link" href="#main">
        {t.aria.skip}
      </a>
      <GlobalLifecycle />
      <Header />
      <CadCursor />
      <main id="main" aria-label={t.aria.main}>
        <HeroSheet />
        <AboutSheet />
        <ExperienceSheet />
        <TechSheet />
        <ProjectsSheet />
        <DiplomasSheet />
        <ContactsSheet />
      </main>
      <FooterSheet />
    </>
  );
}

export default function App() {
  return (
    <LangProvider>
      <ThemeProvider>
        <SheetsObserverProvider>
          <Site />
        </SheetsObserverProvider>
      </ThemeProvider>
    </LangProvider>
  );
}
