import { useRef, useState } from 'react';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { Sheet } from './Sheet';
import { DimLink } from './DimLink';
import { PencilMark } from './PencilMark';

/** ЛИСТ 07 — Контакты: основная надпись + копирование email (§4.7). */
export function ContactsSheet() {
  const { t } = useLang();
  const gridRef = useRough<HTMLDivElement>('frame', 510, () => ({ padding: 8 }));
  const approvedRef = useRough<HTMLDivElement>('stamp', 502, () => ({
    colorKey: 'accent',
    padding: 10,
  }));
  const copyStampRef = useRough<HTMLSpanElement>('stamp', 503, () => ({
    colorKey: 'accent',
    padding: 4,
  }));
  const [copied, setCopied] = useState(false);
  const liveRef = useRef<HTMLSpanElement>(null);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(t.contacts.email.value);
      setCopied(true);
      if (liveRef.current) liveRef.current.textContent = t.contacts.copiedAria;
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // clipboard недоступен — mailto остаётся базовым путём (решение жюри).
      window.location.href = t.contacts.email.href;
    }
  };

  return (
    <Sheet id="sheet-07" titleId="sheet-07-title" kicker={t.contacts.kicker} title={t.contacts.title}>
      <div className="stamp-grid" ref={gridRef}>
        <div className="stamp-grid__row">
          <span className="stamp-grid__label">{t.contacts.telegram.label}</span>
          <span className="stamp-grid__value">
            <DimLink href={t.contacts.telegram.href} target="_blank" rel="noreferrer">
              {t.contacts.telegram.value}
            </DimLink>
          </span>
          <span />
        </div>
        <div className="stamp-grid__row">
          <span className="stamp-grid__label">{t.contacts.email.label}</span>
          <span className="stamp-grid__value">
            <DimLink href={t.contacts.email.href}>{t.contacts.email.value}</DimLink>
          </span>
          <span style={{ position: 'relative', display: 'inline-flex', gap: 10, alignItems: 'center' }}>
            <button type="button" className="toggle-btn" onClick={copyEmail}>
              {t.contacts.copy}
            </button>
            {copied && (
              <span className="copy-stamp" ref={copyStampRef} style={{ color: 'var(--accent)' }}>
                {t.contacts.copied}
              </span>
            )}
          </span>
        </div>
        <div className="stamp-grid__row">
          <span className="stamp-grid__label">{t.contacts.github.label}</span>
          <span className="stamp-grid__value">
            <DimLink href={t.contacts.github.href} target="_blank" rel="noreferrer">
              {t.contacts.github.value}
            </DimLink>
          </span>
          <span />
        </div>
        <div className="stamp-grid__row">
          <span className="stamp-grid__label">TEL</span>
          <span className="stamp-grid__value" style={{ color: 'var(--muted)' }}>
            {t.contacts.phoneNote}
          </span>
          <span />
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <span
          className="approved-stamp"
          ref={approvedRef}
        >
          {t.contacts.approved}
        </span>
      </div>
      <PencilMark text={t.contacts.pencil} style={{ top: '-30px', right: '8%' }} />
      <span ref={liveRef} aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }} />
    </Sheet>
  );
}
