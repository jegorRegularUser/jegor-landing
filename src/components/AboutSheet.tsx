import { useLayoutEffect, useRef } from 'react';
import { ScrollTrigger } from '../lib/gsap';
import { useRough } from '../rough/useRough';
import { useNotationGroup } from '../rough/useNotation';
import { useLang } from '../i18n/LangContext';
import { Sheet } from './Sheet';
import { PencilMark } from './PencilMark';

/** ЛИСТ 02 — Образование (ревизия 02): один текст, таблица без хакатонов. */
export function AboutSheet() {
  const { t } = useLang();
  const ageRef = useRough<HTMLElement>('circle', 60, () => ({ padding: 6 }));
  const phraseRefs = useRef<(HTMLElement | null)[]>([]);
  const groupRef = useNotationGroup(
    phraseRefs,
    t.about.annotate.map(() => ({
      type: 'underline' as const,
      strokeWidth: 2,
      animationDuration: 0,
    })),
    [t],
  );

  useLayoutEffect(() => {
    const sheet = document.getElementById('sheet-02');
    if (!sheet) return;
    const st = ScrollTrigger.create({
      trigger: sheet,
      start: 'top 70%',
      onEnter: () => groupRef.current?.show(),
      onLeaveBack: () => groupRef.current?.hide(),
    });
    return () => st.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  /** Разбивка текста на части: помеченные фразы получают rough-notation. */
  const parts: { text: string; annotated?: boolean }[] = [];
  {
    let rest = t.about.note;
    for (const phrase of t.about.annotate) {
      const idx = rest.indexOf(phrase);
      if (idx === -1) continue;
      if (rest.slice(0, idx)) parts.push({ text: rest.slice(0, idx) });
      parts.push({ text: phrase, annotated: true });
      rest = rest.slice(idx + phrase.length);
    }
    if (rest) parts.push({ text: rest });
  }

  return (
    <Sheet
      id="sheet-02"
      titleId="sheet-02-title"
      kicker={t.about.kicker}
      title={t.about.title}
      titleExtra={
        <span className="about__age">
          {t.about.ageLabel}{' '}
          <b ref={ageRef as React.RefObject<HTMLElement>} style={{ padding: '2px 10px' }}>
            {t.about.age}
          </b>
        </span>
      }
    >
      <div className="about">
        <div className="about__note">
          {parts.map((part, i) =>
            part.annotated ? (
              <em
                key={i}
                ref={(el) => {
                  phraseRefs.current[i] = el;
                }}
                style={{ fontStyle: 'normal' }}
              >
                {part.text}
              </em>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </div>
        <div>
          <table className="pos-table">
            <thead>
              <tr>
                <th scope="col">{t.about.tableHead.pos}</th>
                <th scope="col">{t.about.tableHead.name}</th>
                <th scope="col">{t.about.tableHead.years}</th>
              </tr>
            </thead>
            <tbody>
              {t.about.positions.map((p) => (
                <tr key={p.pos}>
                  <td>{p.pos}</td>
                  <td>{p.name}</td>
                  <td>{p.years}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <PencilMark text={t.about.pencil} style={{ bottom: '6px', right: '4%' }} />
    </Sheet>
  );
}
