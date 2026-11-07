import { describe, expect, it } from 'vitest';
import rough from 'roughjs';

/**
 * Same-seed детерминизм (спека §4.9, верифицировано архитектором на
 * roughjs@4.6.6): та же геометрия при той же seed; смена цвета геометрию
 * не меняет — основа recolor-in-place.
 */
describe('rough.js generator', () => {
  const gen = rough.generator();

  it('same seed → идентичный Drawable', () => {
    const a = gen.rectangle(10, 10, 200, 80, { seed: 42 });
    const b = gen.rectangle(10, 10, 200, 80, { seed: 42 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('другая seed → другой джиттер', () => {
    const a = gen.rectangle(10, 10, 200, 80, { seed: 42 });
    const b = gen.rectangle(10, 10, 200, 80, { seed: 43 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('смена stroke не меняет геометрию', () => {
    const a = gen.rectangle(10, 10, 200, 80, { seed: 42, stroke: '#111111' });
    const b = gen.rectangle(10, 10, 200, 80, { seed: 42, stroke: '#ddebf7' });
    const strip = (d: unknown) =>
      JSON.stringify(d, (key, value) => (key === 'stroke' ? undefined : value));
    expect(strip(a)).toBe(strip(b));
  });

  it('path силуэта: same-seed идентичен', () => {
    const d = 'M 0 0 L 300 40 L 320 300 L 40 320 Z';
    const a = gen.path(d, { seed: 42, roughness: 1.4 });
    const b = gen.path(d, { seed: 42, roughness: 1.4 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('реестр seed-серий уникален', () => {
    // Серии (ревизия 02): 42; 51; 60; проекты 200–202/210/220; дипломы
    // 300–310; опыт 400–403; штампы 500–503/510/512; карусели 600–605;
    // err-card 610/611; гит-линии 620–622; марки 630–631; выноски 640–641.
    const seeds = [
      42, 51, 60,
      200, 201, 202, 210, 220,
      ...Array.from({ length: 11 }, (_, i) => 300 + i),
      400, 401, 402, 403,
      500, 501, 502, 503, 510, 512,
      600, 601, 602, 603, 604, 605,
      610, 611, 620, 621, 622, 630, 631, 640, 641,
    ];
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});
