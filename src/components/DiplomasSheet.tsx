import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRough } from '../rough/useRough';
import { useLang } from '../i18n/LangContext';
import { certMeta } from '../assets/image-meta';
import { Sheet } from './Sheet';
import { BlurImage } from './BlurImage';
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
/* Полноразмерные версии лайтбокса (1600px webp/avif вместо PNG) + LQIP.
   Grep-паттерн *.webp/*.avif зацепит и *.blur.webp/*.full.* — поэтому
   все lookup'ы строго по точным ключам `${file}.${ext}`. */
const certFullWebp = import.meta.glob<string>('../assets/certs/*.full.webp', {
  eager: true,
  import: 'default',
});
const certFullAvif = import.meta.glob<string>('../assets/certs/*.full.avif', {
  eager: true,
  import: 'default',
});
const certBlur = import.meta.glob<string>('../assets/certs/*.blur.webp', {
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
  // «Заполнение цветом» у картинок (прил. А): hachure-полигон позади скана,
  // читается в полях letterbox'а (скан непрозрачный). Seeds 320+i — серия
  // заливок дипломов (спека §4.9).
  const mediaRef = useRough<HTMLDivElement>('polygon', 320 + index, () => ({
    colorKey: 'accent',
    padding: 0,
    jitter: 6,
    roughness: 2,
    fillStyle: 'hachure',
    hachureGap: 11,
    hachureAngle: -41,
    strokeWidth: 1,
    opacity: 0.4,
  }));
  const preview = certPreviews[`../assets/certs/${item.file}.webp`];
  const previewAvif = certPreviewsAvif[`../assets/certs/${item.file}.avif`];
  const meta = certMeta[item.file];

  return (
    <button
      type="button"
      className="diploma-card"
      ref={frameRef}
      onClick={() => onOpen(item.file)}
      aria-label={`${openAria}: ${item.caption}`}
    >
      <div className="diploma-card__media" ref={mediaRef}>
        {preview && (
          <BlurImage
            lqip={certBlur[`../assets/certs/${item.file}.blur.webp`]}
            src={preview}
            sources={previewAvif ? [{ type: 'image/avif', srcSet: previewAvif }] : undefined}
            className="diploma-card__thumb"
            alt={item.caption}
            width={meta?.pw}
            height={meta?.ph}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        )}
      </div>
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

  const fullPng = openFile ? certFull[`../assets/certs/${openFile}.png`] : undefined;
  const fullWebp = openFile ? certFullWebp[`../assets/certs/${openFile}.full.webp`] : undefined;
  const fullAvif = openFile ? certFullAvif[`../assets/certs/${openFile}.full.avif`] : undefined;
  const openMeta = openFile ? certMeta[openFile] : undefined;
  const openCaption = t.diplomas.items.find((i) => i.file === openFile)?.caption;

  return (
    <Sheet
      id="sheet-06"
      titleId="sheet-06-title"
      kicker={t.diplomas.kicker}
      title={t.diplomas.title}
      dense
    >
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
      <PencilMark text={t.diplomas.pencil} style={{ top: '46px', right: '4%' }} />

      <dialog
        className="lightbox"
        ref={dialogRef}
        aria-label={t.diplomas.lightboxAria}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        {/* Лайтбокс: полная версия (1600px webp/avif, PNG — fallback) поверх
            растянутого превью из кэша; размер сцены — из meta, без CLS. */}
        {fullPng && (
          <div
            className="lightbox__stage"
            style={
              openMeta
                ? ({ '--lb-ar': `${openMeta.w} / ${openMeta.h}` } as CSSProperties)
                : undefined
            }
          >
            <BlurImage
              lqip={openFile ? certPreviews[`../assets/certs/${openFile}.webp`] : undefined}
              src={fullPng}
              sources={[
                ...(fullAvif ? [{ type: 'image/avif', srcSet: fullAvif }] : []),
                ...(fullWebp ? [{ type: 'image/webp', srcSet: fullWebp }] : []),
              ]}
              alt={openCaption ?? ''}
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          </div>
        )}
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
