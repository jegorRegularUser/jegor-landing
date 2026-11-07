import { useState } from 'react';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { Sheet } from './Sheet';
import { PencilMark } from './PencilMark';

/* Иконки стеков: пользователь кладёт PNG в src/assets/tech-icons/<slug>.png —
   чип подхватывает сам. Нет иконки — чип остаётся текстовым. */
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

function Chip({ label, index }: { label: string; index: number }) {
  const [pressed, setPressed] = useState(false);
  const frameRef = useRough<HTMLSpanElement>('chip', 100 + index, () => ({ padding: 4 }));
  const fillRef = useRough<HTMLSpanElement>(
    'hachure-fill',
    130 + index,
    () => ({ fillStyle: 'hachure', hachureGap: 7 }),
  );
  return (
    <button
      type="button"
      className="tech-chip"
      aria-pressed={pressed}
      onClick={() => setPressed((v) => !v)}
    >
      <span className="chip-layer" ref={frameRef} aria-hidden="true" />
      <span className="chip-layer chip-layer--fill" ref={fillRef} aria-hidden="true" />
      <ChipLook label={label} />
    </button>
  );
}

/**
 * ЛИСТ 04 — Технологии (ревизия приёмки): бесконечная лента в два ряда
 * (CSS-marquee без зависимостей), пауза на hover/focus, чипы кликабельны.
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
          <div key={r} className={`tech-marquee__row${r === 1 ? ' tech-marquee__row--rev' : ''}`}>
            {[0, 1].map((copy) => (
              <div className="tech-marquee__track" key={copy} aria-hidden={copy === 1 || undefined}>
                {row.map((c) => {
                  const index = chips.indexOf(c);
                  return copy === 0 ? (
                    <span key={c} style={{ display: 'inline-flex' }}>
                      <Chip label={c} index={index} />
                    </span>
                  ) : (
                    <span key={c} className="tech-chip" style={{ display: 'inline-flex' }}>
                      <ChipLook label={c} />
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="tech-hint">{t.tech.hint}</p>
      <PencilMark text={t.tech.pencil} style={{ top: '6px', right: '10%' }} />
    </Sheet>
  );
}
