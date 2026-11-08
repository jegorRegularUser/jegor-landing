import { gsap } from '../lib/gsap';
import { useLayoutEffect, useRef } from 'react';
import { useLang } from '../i18n/LangContext';
import { useChangeLog } from '../state/ChangeLog';
import { useRough } from '../rough/useRough';
import { sheetReveal } from '../lib/motion';

/** ЛИСТ 07 — Регистрация изменений (13): статичные строки + живые
 *  события (смена темы/языка, разборка телефона, отрыв кнопки).
 *  Таблица лежит на hachure-полигоне (seed 650); deps по числу живых
 *  строк — таблица растёт, полигон перерисовывается вслед (§6.5). */
export function FooterSheet() {
  const { t } = useLang();
  const { entries } = useChangeLog();
  const ref = useRef<HTMLElement>(null);
  const boardRef = useRough<HTMLDivElement>(
    'polygon',
    650,
    () => ({
      colorKey: 'accent',
      // В стороны — с запасом: контур не должен идти вплотную к тексту.
      paddingX: 40,
      paddingY: 18,
      jitter: 10,
      roughness: 2.1,
      fillStyle: 'hachure',
      hachureGap: 16,
      hachureAngle: -41,
      strokeWidth: 1,
      opacity: 0.25,
    }),
    [entries.length],
  );

  useLayoutEffect(() => {
    const sheet = ref.current;
    const tween = sheet ? sheetReveal(sheet) : undefined;
    return () => {
      tween?.scrollTrigger?.kill();
      tween?.kill();
      gsap.set(sheet, { clearProps: 'all' });
    };
  }, []);

  return (
    <footer
      className="sheet footer-sheet"
      id="sheet-08"
      data-sheet
      aria-label={t.footer.kicker}
      ref={ref}
    >
      <div className="sheet__paper">
        <div className="sheet__kicker">
          <span className="sheet__kicker-label">{t.footer.kicker}</span>
          <span className="sheet__kicker-rule" aria-hidden="true" />
        </div>
        <div className="changelog-board" ref={boardRef}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.footer.head.izm}</th>
                <th scope="col">{t.footer.head.sheets}</th>
                <th scope="col">{t.footer.head.content}</th>
                <th scope="col">{t.footer.head.date}</th>
              </tr>
            </thead>
            <tbody>
              {t.footer.rows.map((r) => (
                <tr key={r.izm}>
                  <td>{r.izm}</td>
                  <td>{r.sheets}</td>
                  <td>{r.content}</td>
                  <td>{r.date}</td>
                </tr>
              ))}
              {entries.map((e, i) => (
                <tr key={`${e.content}-${i}`} className="footer-sheet__live">
                  <td>{String(t.footer.rows.length + 1 + i).padStart(2, '0')}</td>
                  <td>{t.footer.head.sheets.toLowerCase()}</td>
                  <td>{e.content}</td>
                  <td>{e.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="footer-sheet__meta">
          <span>{t.footer.note}</span>
          <span>{t.footer.copyright}</span>
        </div>
      </div>
    </footer>
  );
}
