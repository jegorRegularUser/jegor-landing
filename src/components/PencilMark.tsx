import type { CSSProperties } from 'react';

/** Карандашная пометка «от руки» (спека §3.4): лимит 3 на лист — на совести вызова. */
export function PencilMark({ text, style }: { text: string; style?: CSSProperties }) {
  const rotate = -2 + (Math.abs(hash(text)) % 5);
  return (
    <span
      className="pencil-mark"
      style={{ rotate: `${rotate}deg`, ...style }}
      aria-hidden="true"
    >
      {text}
    </span>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
