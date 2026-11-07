import { useLayoutEffect, useRef } from 'react';
import { ScrollTrigger } from '../lib/gsap';
import { useRough } from '../rough/useRough';
import { useNotationGroup } from '../rough/useNotation';
import { useLang } from '../i18n/LangContext';
import { Sheet } from './Sheet';
import { PencilMark } from './PencilMark';

/** ЛИСТ 02 — Обо мне («Спецификация»): примечания + таблица позиций (§4.2). */
export function AboutSheet() {
  const { t } = useLang();
  const ageRef = useRough<HTMLElement>('circle', 60, () => ({ padding: 6 }));
  const phraseRefs = useRef<(HTMLElement | null)[]>([]);
  const groupRef = useNotationGroup(
    phraseRefs,
    t.about.annotate.map(() => ({ type: 'underline' as const, strokeWidth: 2, animationDuration: 0 })),
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

  const phrases = splitByPhrases(t.about.note1, t.about.note2, t.about.annotate);

  return (
    <Sheet id="sheet-02" titleId="sheet-02-title" kicker={t.about.kicker} title={t.about.title} dense={false}>
      <div className="about">
        <div>
          {phrases.map((part, i) =>
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
          <PencilMark text={t.about.pencil} style={{ top: '6px', right: '4%' }} />
        </div>
        <div>
          <p className="about__age">
            {t.about.ageLabel}{' '}
            <b ref={ageRef as React.RefObject<HTMLElement>} style={{ padding: '2px 10px' }}>
              {t.about.age}
            </b>
          </p>
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
    </Sheet>
  );
}

interface Part {
  text: string;
  annotated?: boolean;
}

/** Разбивка примечаний на части: помеченные фразы получают rough-notation. */
function splitByPhrases(note1: string, note2: string, phrases: string[]): Part[] {
  const parts: Part[] = [];
  const push = (text: string, annotated: boolean) => {
    if (text) parts.push({ text, annotated });
  };
  const consume = (note: string) => {
    let rest = note;
    for (const phrase of phrases) {
      const idx = rest.indexOf(phrase);
      if (idx === -1) continue;
      push(rest.slice(0, idx), false);
      push(phrase, true);
      rest = rest.slice(idx + phrase.length);
    }
    push(rest, false);
  };
  consume(note1);
  push(' ', false);
  consume(note2);
  return parts;
}
