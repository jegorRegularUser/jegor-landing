import { useLayoutEffect, useRef, useState } from 'react';
import type { ImgHTMLAttributes, ReactNode } from 'react';

/** <picture>-обёртка c blur-up: LQIP — крошечный webp (билд инлайнит его в
 *  data-URI) — красится фоном на ОБЁРТКЕ и виден, пока пикселей нет; сам
 *  <img> кроссфейдится поверх по load (CSS: .blur-up-wrap > img). Когда
 *  картинка загружена, фон снимается — сквозь прозрачные пиксели (вырезка
 *  героя) LQIP-прямоугольник не светится. sources — дополнительные <source>
 *  (avif/webp); children идут перед ними. Кэш: load мог отработать до
 *  маунта — добираем в layout-эффекте, до первой отрисовки. */
export function BlurImage({
  lqip,
  sources,
  children,
  className,
  width,
  height,
  ...img
}: {
  lqip?: string;
  sources?: { type: string; srcSet: string }[];
  children?: ReactNode;
} & ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  // Пропорции — на обёртку: пока запрос картинки в пути (или удержан
  // прокси), Chromium считает max-content img нулём и схлопывает
  // fit-content-предков; явный aspect-ratio резервирует бокс обёртки
  // независимо от состояния загрузки.
  const ar = width && height ? { aspectRatio: `${width} / ${height}` } : undefined;

  return (
    <picture
      className="blur-up-wrap"
      style={{ ...ar, ...(lqip && !loaded ? { backgroundImage: `url("${lqip}")` } : {}) }}
    >
      {children}
      {sources?.map((s) => (
        <source key={s.type} type={s.type} srcSet={s.srcSet} />
      ))}
      <img
        {...img}
        width={width}
        height={height}
        ref={ref}
        className={`${className ?? ''} blur-up${loaded ? ' blur-up--loaded' : ''}`}
        onLoad={() => setLoaded(true)}
      />
    </picture>
  );
}
