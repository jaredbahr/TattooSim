import { describe, expect, it } from 'vitest';
import { frontPage } from '../src/newspaper';

describe('frontPage', () => {
  it('fills every placeholder', () => {
    for (let i = 0; i < 60; i++) {
      for (const score of [10, 95]) {
        const p = frontPage({ clientName: 'Rhonda', sex: 'f', designName: 'Bald Eagle', score });
        expect(Object.values(p).join(' ')).not.toMatch(/\{[A-Z]+\}/);
        expect(p.headline).toBe(p.headline.toUpperCase());
      }
    }
  });

  it('runs bad news for bad days and good news for great ones', () => {
    const bad = frontPage({ clientName: 'Gary', sex: 'm', designName: 'Donut', score: 12 });
    expect(bad.headline.length).toBeGreaterThan(10);
    const goods = Array.from({ length: 8 }, () => frontPage({ clientName: 'Gary', sex: 'm', designName: 'Donut', score: 95 }).headline);
    expect(goods.some((h) => /CROWD|BEST IN BEHIND|GALLERY|MUSEUM/.test(h))).toBe(true);
  });
});
