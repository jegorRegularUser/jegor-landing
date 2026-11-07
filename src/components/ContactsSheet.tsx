import { useEffect, useRef, useState } from 'react';
import { gsap } from '../lib/gsap';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { useMedia } from '../hooks/useMedia';
import { knock } from '../lib/knock';
import { useChangeLog } from '../state/ChangeLog';
import type { Playground } from '../lib/physics';
import { Sheet } from './Sheet';
import { DimLink } from './DimLink';
import { PencilMark } from './PencilMark';

/** ЛИСТ 07 — Контакты (ревизия 02): копирование у всех трёх строк,
 *  штамп СКОПИРОВАНО появляется сразу и не исчезает (12.3). */
export function ContactsSheet() {
  const { t } = useLang();
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const { addChange } = useChangeLog();
  const gridRef = useRough<HTMLDivElement>('frame', 510, () => ({ padding: 8 }));
  const approvedRef = useRough<HTMLSpanElement>('stamp', 502, () => ({
    colorKey: 'accent',
    padding: 10,
  }));
  const approvedInnerRef = useRough<HTMLSpanElement>('stamp', 512, () => ({
    colorKey: 'accent',
    padding: 4,
  }));
  const stampRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const phoneRowRef = useRef<HTMLDivElement>(null);
  const playgroundRef = useRef<Playground | null>(null);
  const [phoneState, setPhoneState] = useState<'idle' | 'broken' | 'empty'>('idle');
  const liveRef = useRef<HTMLSpanElement>(null);

  // Анимация штампа — в эффекте (реф уже смонтирован), надпись остаётся (12.3).
  useEffect(() => {
    if (!copied) return;
    const stamp = stampRefs.current[copied];
    if (stamp && !reduced) {
      gsap.fromTo(
        stamp,
        { scale: 1.9, rotate: 4, autoAlpha: 0 },
        { scale: 1, rotate: -8, autoAlpha: 1, duration: 0.35, ease: 'back.out(2.5)' },
      );
    } else if (stamp) {
      stamp.style.opacity = '1';
    }
    knock(0.7);
  }, [copied, reduced]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return; // clipboard недоступен — ничего не штампуем
    }
    setCopied(key);
    if (liveRef.current) liveRef.current.textContent = t.contacts.copiedAria;
  };

  /** 7.2 + 10: строка телефона разбивается на куски и падает; корзина снизу слева. */
  const breakPhoneRow = async () => {
    const row = phoneRowRef.current;
    if (!row || playgroundRef.current) return;
    setPhoneState('broken');
    addChange(t.footer.dynamic.phone);
    const parts = Array.from(row.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && !c.dataset.noPhysics,
    );
    try {
      const { createPlayground } = await import('../lib/physics');
      const pg = await createPlayground(document.body, {
        onImpact: () => knock(0.25),
      });
      playgroundRef.current = pg;
      let total = 0;
      let gone = 0;
      for (const child of parts) {
        pg.fragmentize(child, { canSplit: true });
        total += 1;
      }
      pg.setBin(() => {
        gone += 1;
        knock(0.4);
        if (gone >= total) setPhoneState('empty');
      });
    } catch (e) {
      // Физика недоступна: куски падают твинами.
      console.warn('[physics] fallback', e);
      parts.forEach((child, i) => {
        gsap.to(child, {
          y: window.innerHeight,
          rotation: 160 + i * 60,
          duration: 0.9 + i * 0.08,
          delay: i * 0.06,
          ease: 'power1.in',
          onComplete: () => {
            child.style.opacity = '0';
          },
        });
      });
      gsap.delayedCall(1.4, () => setPhoneState('empty'));
    }
  };

  const restorePhoneRow = () => {
    playgroundRef.current?.destroy();
    playgroundRef.current = null;
    setPhoneState('idle');
  };

  const contactRows = [
    { key: 'tg', label: t.contacts.telegram.label, value: t.contacts.telegram.value, href: t.contacts.telegram.href },
    { key: 'mail', label: t.contacts.email.label, value: t.contacts.email.value, href: t.contacts.email.href },
    { key: 'gh', label: t.contacts.github.label, value: t.contacts.github.value, href: t.contacts.github.href },
  ];

  return (
    <Sheet id="sheet-07" titleId="sheet-07-title" kicker={t.contacts.kicker} title={t.contacts.title}>
      <div className="stamp-grid" ref={gridRef}>
        {contactRows.map((c) => (
          <div className="stamp-grid__row" key={c.key}>
            <span className="stamp-grid__label">{c.label}</span>
            <span className="stamp-grid__value">
              <DimLink href={c.href} target="_blank" rel="noreferrer">
                {c.value}
              </DimLink>
            </span>
            <span className="stamp-grid__action">
              <button
                type="button"
                className="toggle-btn"
                data-no-physics
                onClick={() => copy(c.key, c.href)}
              >
                {t.contacts.copy}
              </button>
              <span
                className="copy-stamp"
                data-no-physics
                ref={(el) => {
                  stampRefs.current[c.key] = el;
                }}
                style={{ opacity: copied === c.key ? 1 : 0 }}
              >
                {t.contacts.copied}
              </span>
            </span>
          </div>
        ))}
        <div className="stamp-grid__row" ref={phoneRowRef}>
          <span className="stamp-grid__label">{t.contacts.telLabel}</span>
          <span className="stamp-grid__stamp-empty" aria-hidden="true" />
          <span className="stamp-grid__action">
            {phoneState === 'idle' && (
              <button type="button" className="toggle-btn" onClick={breakPhoneRow}>
                {t.contacts.reveal}
              </button>
            )}
            {phoneState === 'empty' && (
              <button
                type="button"
                className="toggle-btn"
                data-no-physics
                onClick={restorePhoneRow}
              >
                {t.contacts.restore}
              </button>
            )}
          </span>
        </div>
      </div>

      <div className="approved-wrap">
        <span className="approved-stamp" ref={approvedRef}>
          <span className="approved-stamp__inner" ref={approvedInnerRef} aria-hidden="true" />
          {t.contacts.approved}
        </span>
      </div>
      <PencilMark text={t.contacts.pencil} style={{ bottom: '6px', right: '8%' }} />
      <span
        ref={liveRef}
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
      />
    </Sheet>
  );
}
