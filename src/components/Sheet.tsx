import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { gsap, ScrollTrigger, SplitText } from '../lib/gsap';
import { prefersReducedMotion, sheetReveal } from '../lib/motion';

const COLS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const ROWS = ['А', 'Б', 'В', 'Г', 'Д'];

interface SheetProps {
  id: string;
  titleId: string;
  kicker: string;
  title?: string;
  /** Дополнение в строке заголовка (например, «ВОЗРАСТ: 20»). */
  titleExtra?: ReactNode;
  dense?: boolean;
  hero?: boolean;
  children: ReactNode;
}

/** Лист: двойная рамка ГОСТ, миллиметровка, метки координат, ревил (§4.0). */
export function Sheet({ id, titleId, kicker, title, titleExtra, dense, hero, children }: SheetProps) {
  const ref = useRef<HTMLElement>(null);

  // StrictMode монтирует дважды: без cleanup второй from-твин ловит лист
  // уже скрытым первым и навсегда возвращает его в невидимость.
  useLayoutEffect(() => {
    const tween = ref.current ? sheetReveal(ref.current) : undefined;
    return () => {
      tween?.scrollTrigger?.kill();
      tween?.kill();
      gsap.set(ref.current, { clearProps: 'all' });
    };
  }, []);

  // Заголовок листа: SplitText по словам (посимвольно — только имя, §3.3).
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.sheet__title');
    if (!el || prefersReducedMotion()) return;
    let split: SplitText | null = null;
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        split = new SplitText(el, { type: 'words' });
        gsap.from(split.words, { yPercent: 70, autoAlpha: 0, stagger: 0.02, duration: 0.45 });
      },
    });
    return () => {
      st.kill();
      split?.revert();
    };
  }, []);

  return (
    <section
      ref={ref}
      id={id}
      data-sheet
      data-dense={dense ? 'true' : undefined}
      aria-labelledby={titleId}
      className={`sheet${hero ? ' sheet--hero' : ''}`}
    >
      <div className="sheet__paper">
        <div className="sheet__marks" aria-hidden="true">
          {COLS.map((c, i) => (
            <span
              key={c}
              className="col-label"
              style={{ left: `${(i + 0.5) * (100 / COLS.length)}%` }}
            >
              {c}
            </span>
          ))}
          {ROWS.map((r, i) => (
            <span
              key={r}
              className="row-label"
              style={{ top: `${(i + 0.5) * (100 / ROWS.length)}%` }}
            >
              {r}
            </span>
          ))}
        </div>
        <div className="sheet__kicker">
          <span className="sheet__kicker-label">{kicker}</span>
          <span className="sheet__kicker-rule" aria-hidden="true" />
        </div>
        {title && (
          <div className="sheet__title-row">
            <h2 className="sheet__title" id={titleId}>
              {title}
            </h2>
            {titleExtra}
          </div>
        )}
        {!title && <h2 className="visually-hidden-title" id={titleId} hidden>{kicker}</h2>}
        {children}
      </div>
    </section>
  );
}
