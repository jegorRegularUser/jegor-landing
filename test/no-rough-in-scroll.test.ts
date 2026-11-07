import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Карантин DrawSVG/rough (спека §4.0): вызовы rough (registerRough,
 * redrawAll, recolorAll, rough.svg) запрещены внутри scroll/hover-колбэков.
 * Regex-скан достаточен (решение архитектора).
 */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

describe('карантин rough в scroll-хендлерах', () => {
  const files = walk(SRC);

  it('в колбэках onScroll/onUpdate/onToggle нет вызовов rough', () => {
    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf-8');
      const re = /on(S|c)croll|onUpdate|onToggle|addEventListener\(\s*'(scroll|pointermove)'/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        // Окно 240 символов после вхождения: достаточно, чтобы поймать вызов.
        const window = text.slice(m.index, m.index + 240);
        if (/registerRough|redrawAll|recolorAll|rough\.svg/.test(window)) {
          violations.push(`${path.relative(SRC, file)} @ ${m.index}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
