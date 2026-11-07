import type { AnchorHTMLAttributes, ReactNode } from 'react';

/**
 * Ссылка с «размерной линией»: постоянное подчёркивание + усиление на
 * hover/focus-visible (спека §4.0). Клавиатурный паритет — через focus-visible.
 */
export function DimLink({
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  return (
    <a className="dim-link" {...rest}>
      {children}
      <svg className="dim-link__svg" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
        <path className="dim-link__line" d="M0 3 H96 M92 0 L97 3 L92 6" />
      </svg>
    </a>
  );
}
