import { useRef } from 'react';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { Sheet } from './Sheet';
import { PencilMark } from './PencilMark';

/* Иконки стеков: PNG в src/assets/tech-icons/<slug>.png подхватываются сами. */
const icons = import.meta.glob<string>('../assets/tech-icons/*.png', {
  eager: true,
  import: 'default',
});

function iconFor(label: string): string | undefined {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/\./g, '');
  return icons[`../assets/tech-icons/${slug}.png`];
}

function ChipLook({ label }: { label: string }) {
  const icon = iconFor(label);
  return (
    <>
      {icon && <img className="tech-chip__icon" src={icon} alt="" width={20} height={20} />}
      {label}
    </>
  );
}

/**
 * ЛИСТ 04 — Технологии (ревизия 02): две бесконечные марки-ленты БЕЗ
 * hover/click-логики (6); рамки чипов — по одному multi-frame оверлею на
 * ряд вместо персональных (лечит лаги обводок).
 */
export function TechSheet() {
  const { t } = useLang();
  const chips = t.tech.chips;
  const half = Math.ceil(chips.length / 2);
  const rows: [typeof chips, typeof chips] = [chips.slice(0, half), chips.slice(half)];

  return (
    <Sheet id="sheet-04" titleId="sheet-04-title" kicker={t.tech.kicker} title={t.tech.title} dense>
      <div className="tech-marquee">
        {rows.map((row, r) => (
          <MarqueeRow key={r} row={row} reverse={r === 1} seed={630 + r} />
        ))}
      </div>
      <PencilMark text={t.tech.pencil} style={{ bottom: '6px', right: '10%' }} />
    </Sheet>
  );
}

function MarqueeRow({ row, reverse, seed }: {
  row: string[];
  reverse: boolean;
  seed: number;
}) {
  // Чипы собираются колбэком-рефом: фабрика оверлея читает готовый список.
  const chipsRef = useRef<HTMLElement[]>([]);
  const rowRef = useRough<HTMLDivElement>('multi-frame', seed, () => ({
    targets: chipsRef.current,
  }));
  return (
    <div
      className={`tech-marquee__row${reverse ? ' tech-marquee__row--rev' : ''}`}
      ref={(el) => {
        rowRef.current = el;
        if (el) chipsRef.current = Array.from(el.querySelectorAll<HTMLElement>('.tech-chip'));
      }}
    >
      {[0, 1].map((copy) => (
        <div className="tech-marquee__track" key={copy} aria-hidden={copy === 1 || undefined}>
          {row.map((c) => (
            <span key={c} className="tech-chip" style={{ display: 'inline-flex' }}>
              <ChipLook label={c} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
