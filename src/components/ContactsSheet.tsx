import { useRef, useState } from 'react';
import { gsap } from '../lib/gsap';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { useMedia } from '../hooks/useMedia';
import { knock } from '../lib/knock';
import type { Playground } from '../lib/physics';
import { Sheet } from './Sheet';
import { PencilMark } from './PencilMark';

/** ЛИСТ 07 — Контакты (ревизия): штампы-кнопки с импактом, телефон с физикой. */
export function ContactsSheet() {
  const { t } = useLang();
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const gridRef = useRough<HTMLDivElement>('frame', 510, () => ({ padding: 8 }));
  const approvedRef = useRough<HTMLSpanElement>('stamp', 502, () => ({
    colorKey: 'accent',
    padding: 10,
  }));
  const approvedInnerRef = useRough<HTMLSpanElement>('stamp', 512, () => ({
    colorKey: 'accent',
    padding: 4,
  }));
  const copyStampRef = useRough<HTMLSpanElement>('stamp', 503, () => ({
    colorKey: 'accent',
    padding: 4,
  }));
  const phoneRowRef = useRef<HTMLDivElement>(null);
  const playgroundRef = useRef<Playground | null>(null);
  const [copied, setCopied] = useState(false);
  const [phoneState, setPhoneState] = useState<'idle' | 'broken' | 'empty'>('idle');
  const liveRef = useRef<HTMLSpanElement>(null);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(t.contacts.email.value);
      setCopied(true);
      if (liveRef.current) liveRef.current.textContent = t.contacts.copiedAria;
      // Импакт: штамп впечатывается с поворотом, строка вздрагивает (7.1).
      const stamp = copyStampRef.current;
      if (stamp && !reduced) {
        gsap.fromTo(
          stamp,
          { scale: 1.9, rotate: 4, autoAlpha: 0 },
          { scale: 1, rotate: -8, autoAlpha: 1, duration: 0.35, ease: 'back.out(2.5)' },
        );
        gsap.fromTo(
          stamp.closest('.stamp-grid__row') ?? stamp,
          { y: 0 },
          { y: 3, duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.in' },
        );
      }
      knock(0.7);
      window.setTimeout(() => setCopied(false), 2600);
    } catch {
      window.location.href = t.contacts.email.href;
    }
  };

  /** 7.2 + 10: строка телефона разбивается на куски и падает; корзина снизу слева. */
  const breakPhoneRow = async () => {
    const row = phoneRowRef.current;
    if (!row || playgroundRef.current) return;
    setPhoneState('broken');
    const { createPlayground } = await import('../lib/physics');
    const pg = await createPlayground(document.body, {
      onImpact: () => knock(0.25),
    });
    playgroundRef.current = pg;
    let total = 0;
    let gone = 0;
    for (const child of Array.from(row.children)) {
      if (child instanceof HTMLElement && child.offsetParent !== null) {
        pg.fragmentize(child, { canSplit: true });
        total += 1;
      }
    }
    pg.setBin(() => {
      gone += 1;
      knock(0.4);
      if (gone >= total) setPhoneState('empty');
    });
  };

  const restorePhoneRow = () => {
    playgroundRef.current?.destroy();
    playgroundRef.current = null;
    setPhoneState('idle');
  };

  const stampAction = (label: string, value: string, href: string) => (
    <span className="stamp-grid__value">
      <a className="stamp-action" href={href} target="_blank" rel="noreferrer">
        <span className="stamp-action__label">{label}</span>
        <span>{value}</span>
      </a>
    </span>
  );

  return (
    <Sheet id="sheet-07" titleId="sheet-07-title" kicker={t.contacts.kicker} title={t.contacts.title}>
      <div className="stamp-grid" ref={gridRef}>
        <div className="stamp-grid__row">
          <span className="stamp-grid__label">{t.contacts.telegram.label}</span>
          {stampAction('TG', t.contacts.telegram.value, t.contacts.telegram.href)}
          <span />
        </div>
        <div className="stamp-grid__row">
          <span className="stamp-grid__label">{t.contacts.email.label}</span>
          {stampAction('MAIL', t.contacts.email.value, t.contacts.email.href)}
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <button type="button" className="toggle-btn" onClick={copyEmail}>
              {t.contacts.copy}
            </button>
            {copied && (
              <span className="stamp-action__stamp" ref={copyStampRef} style={{ opacity: 1 }}>
                {t.contacts.copied}
              </span>
            )}
          </span>
        </div>
        <div className="stamp-grid__row">
          <span className="stamp-grid__label">{t.contacts.github.label}</span>
          {stampAction('GH', t.contacts.github.value, t.contacts.github.href)}
          <span />
        </div>
        <div className="stamp-grid__row" ref={phoneRowRef}>
          <span className="stamp-grid__label">TEL</span>
          <span className="stamp-grid__value" style={{ color: 'var(--muted)' }}>
            {t.contacts.phoneNote}
          </span>
          <span>
            {phoneState === 'idle' && (
              <button type="button" className="toggle-btn" onClick={breakPhoneRow}>
                {t.contacts.reveal}
              </button>
            )}
            {phoneState === 'empty' && (
              <button type="button" className="toggle-btn" onClick={restorePhoneRow}>
                {t.contacts.restore}
              </button>
            )}
          </span>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 'var(--s5)' }}>
        <span className="approved-stamp" ref={approvedRef}>
          <span className="approved-stamp__inner" ref={approvedInnerRef} aria-hidden="true" />
          {t.contacts.approved}
        </span>
      </div>
      <PencilMark text={t.contacts.pencil} style={{ top: '6px', right: '8%' }} />
      <span
        ref={liveRef}
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
      />
    </Sheet>
  );
}
