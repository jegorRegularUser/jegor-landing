import { useEffect, useRef, useState } from 'react';
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

/** Оранжевый полигон-подложка плитки (ревизия 06): рисованный контур +
 *  hachure-заливка, рисуется при маунте, проявляется только по ховеру —
 *  тогл класса .tech-tile--pin управляет opacity оверлея (CSS, §6.1).
 *  Seeds 130+i — серия hover-заливок чипов (спека §4.9). */
function TechTile({
  label,
  index,
  pinned,
  onPin,
  icon,
}: {
  label: string;
  index: number;
  pinned: boolean;
  onPin(): void;
  icon?: string;
}) {
  const fillRef = useRough<HTMLSpanElement>('polygon', 130 + index, () => ({
    colorKey: 'accent',
    padding: 0,
    jitter: 6,
    roughness: 2,
    fillStyle: 'hachure',
    hachureGap: 8,
    hachureAngle: -41,
    strokeWidth: 1,
    opacity: 0.55,
  }));
  return (
    <span
      ref={fillRef}
      className={`tech-tile${pinned ? ' tech-tile--pin' : ''}`}
      title={label}
      onPointerEnter={onPin}
    >
      {icon && <img src={icon} alt={label} height={76} loading="lazy" decoding="async" />}
      <span className="tech-tile__name" aria-hidden="true">
        {label}
      </span>
    </span>
  );
}

/**
 * ЛИСТ 03 — Технологии (ревизия 06): «перечень элементов» — сетка огромных
 * иконок; наведение — тогл: плитка заливается оранжевой hachure-штриховкой
 * рисованного полигона (kind `polygon`, seeds 130+) и подписывается,
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

  // Оба комплекта греются в кэше сразу после load (fetchpriority low, чтобы
  // не воевать с LCP-портретом): смена темы и первый скролл к листу —
  // мгновенные, без burst из 24 запросов и без «пачки через 10 секунд».
  useEffect(() => {
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      for (const url of [...Object.values(icons), ...Object.values(iconsDark)]) {
        const img = new Image();
        img.setAttribute('fetchpriority', 'low');
        img.src = url;
      }
    };
    if (document.readyState === 'complete') {
      const t = window.setTimeout(warm, 800);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }
    window.addEventListener('load', warm, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', warm);
    };
  }, []);

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
        {t.tech.chips.map((label, i) => (
          <TechTile
            key={label}
            label={label}
            index={i}
            pinned={pinned.has(label)}
            onPin={() => togglePin(label)}
            icon={iconFor(label, theme)}
          />
        ))}
      </div>
      <PencilMark text={t.tech.pencil} style={{ bottom: '6px', right: '10%' }} />
    </Sheet>
  );
}
