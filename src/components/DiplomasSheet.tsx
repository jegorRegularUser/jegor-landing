import { useRef, useState } from 'react';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { Sheet } from './Sheet';
import { PencilMark } from './PencilMark';

const certPreviews = import.meta.glob<string>('../assets/certs/*.webp', {
  eager: true,
  import: 'default',
});
const certPreviewsAvif = import.meta.glob<string>('../assets/certs/*.avif', {
  eager: true,
  import: 'default',
});
const certFull = import.meta.glob<string>('../assets/certs/*.png', {
  eager: true,
  import: 'default',
});

interface Item {
  file: string;
  caption: string;
}

function DiplomaCard({
  item,
  index,
  docLabel,
  openAria,
  onOpen,
}: {
  item: Item;
  index: number;
  docLabel: string;
  openAria: string;
  onOpen(f: string): void;
}) {
  const frameRef = useRough<HTMLButtonElement>('frame', 300 + index, () => ({ padding: 6 }));
  const preview = certPreviews[`../assets/certs/${item.file}.webp`];
  const previewAvif = certPreviewsAvif[`../assets/certs/${item.file}.avif`];

  return (
    <button
      type="button"
      className="diploma-card"
      ref={frameRef}
      onClick={() => onOpen(item.file)}
      aria-label={`${openAria}: ${item.caption}`}
    >
      {preview && (
        <picture>
          {previewAvif && <source type="image/avif" srcSet={previewAvif} />}
          <img
            className="diploma-card__thumb"
            src={preview}
            alt={item.caption}
            width={600}
            height={424}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        </picture>
      )}
      <span className="diploma-card__caption">
        <b>
          {docLabel} {String(index + 1).padStart(2, '0')}
        </b>
        {item.caption}
      </span>
    </button>
  );
}

/** ЛИСТ 06 — Дипломы: сетка карточек + <dialog>-лайтбокс «световой стол» (§4.6). */
export function DiplomasSheet() {
  const { t } = useLang();
  const [openFile, setOpenFile] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = (file: string) => {
    setOpenFile(file);
    dialogRef.current?.showModal();
  };

  const close = () => {
    dialogRef.current?.close();
    setOpenFile(null);
  };

  const fullSrc = openFile ? certFull[`../assets/certs/${openFile}.png`] : undefined;
  const openCaption = t.diplomas.items.find((i) => i.file === openFile)?.caption;

  return (
    <Sheet id="sheet-06" titleId="sheet-06-title" kicker={t.diplomas.kicker} title={t.diplomas.title} dense>
      <div className="diploma-grid">
        {t.diplomas.items.map((item, i) => (
          <DiplomaCard
            key={item.file}
            item={item}
            index={i}
            docLabel={t.diplomas.doc}
            openAria={t.diplomas.lightboxAria}
            onOpen={open}
          />
        ))}
      </div>
      <PencilMark text={t.diplomas.pencil} style={{ top: '6px', right: '4%' }} />

      <dialog
        className="lightbox"
        ref={dialogRef}
        aria-label={t.diplomas.lightboxAria}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        {fullSrc && <img src={fullSrc} alt="" loading="eager" decoding="async" />}
        <div className="lightbox__bar">
          <span>{openCaption}</span>
          <button type="button" className="toggle-btn" onClick={close}>
            {t.diplomas.close}
          </button>
        </div>
      </dialog>
    </Sheet>
  );
}
