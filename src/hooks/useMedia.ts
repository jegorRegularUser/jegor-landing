import { useEffect, useState } from 'react';

/** Подписка на media query (reduced-motion, pointer:fine и т.п.). */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function useReducedMotion(): boolean {
  return useMedia('(prefers-reduced-motion: reduce)');
}

export function usePrefersPointerFine(): boolean {
  return useMedia('(pointer: fine)');
}
