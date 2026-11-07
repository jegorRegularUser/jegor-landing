import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface ChangeEntry {
  izm: string;
  content: string;
  date: string;
}

interface ChangeLogState {
  entries: ChangeEntry[];
  addChange(content: string): void;
}

const ChangeLogContext = createContext<ChangeLogState | null>(null);

function today(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/**
 * ЛИСТ 08 «Регистрация изменений», который реально регистрирует: смена
 * темы, локализации, разборка телефона и отрыв кнопки добавляют строки.
 */
export function ChangeLogProvider({ children }: { children: ReactNode }) {
  const [extra, setExtra] = useState<ChangeEntry[]>([]);

  const addChange = useCallback((content: string) => {
    setExtra((prev) => {
      if (prev.some((e) => e.content === content && e.date === today())) return prev;
      return [...prev, { izm: '', content, date: today() }];
    });
  }, []);

  const value = useMemo(() => ({ entries: extra, addChange }), [extra, addChange]);
  return <ChangeLogContext.Provider value={value}>{children}</ChangeLogContext.Provider>;
}

export function useChangeLog(): ChangeLogState {
  const ctx = useContext(ChangeLogContext);
  if (!ctx) throw new Error('useChangeLog вне ChangeLogProvider');
  return ctx;
}

export { today as changeToday };
