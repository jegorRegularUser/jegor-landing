import { useRef, useState } from 'react';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../theme/ThemeProvider';
import { Sheet } from './Sheet';
import { PencilMark } from './PencilMark';

/* Иконки стеков: тёмные штрихи — tech-icons (ватман), светлые —
   tech-icons-dark (синька). PNG <slug>.png подхватываются сами. */
const icons = import.meta.glob<string>('../assets/tech-icons/*.png', {
  eager: true,
  import: 'default',
});
const iconsDark = import.meta.glob<string>('../assets/tech-icons-dark/*.png', {
  eager: true,
  import: 'default',
});

function iconFor(label: string, theme: 'dark' | 'light'): string | undefined {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/\./g, '');
  const set = theme === 'dark' ? iconsDark : icons;
  return set[`../assets/tech-icons${theme === 'dark' ? '-dark' : ''}/${slug}.png`];
}

/**
 * ЛИСТ 03 — Технологии (ревизия 04): «перечень элементов» — сетка огромных
 * иконок. Наведение — тогл: плитка заливается оранжевым и подписывается,
 * состояние остаётся до следующего наведения. Имя живёт в alt и тултипе.
 * Подпись всегда резервирует строку — рамки сетки не съезжают.
 */
export function TechSheet() {
  const { t } = useLang();
  const { theme } = useTheme();
  const tilesRef = useRef<HTMLElement[]>([]);
  const gridRef = useRough<HTMLDivElement>('multi-frame', 630, () => ({
    targets: tilesRef.current,
  }));
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set());

  const togglePin = (label: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <Sheet id="sheet-04" titleId="sheet-04-title" kicker={t.tech.kicker} title={t.tech.title} dense>
      <div
        className="tech-grid"
        ref={(el) => {
          gridRef.current = el;
          if (el) tilesRef.current = Array.from(el.querySelectorAll<HTMLElement>('.tech-tile'));
        }}
      >
        {t.tech.chips.map((label) => {
          const icon = iconFor(label, theme);
          return (
            <span
              key={label}
              className={`tech-tile${pinned.has(label) ? ' tech-tile--pin' : ''}`}
              title={label}
              onPointerEnter={() => togglePin(label)}
            >
              {icon && <img src={icon} alt={label} height={76} decoding="async" />}
              <span className="tech-tile__name" aria-hidden="true">
                {label}
              </span>
            </span>
          );
        })}
      </div>
      <PencilMark text={t.tech.pencil} style={{ bottom: '6px', right: '10%' }} />
    </Sheet>
  );
}
