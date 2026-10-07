import { describe, expect, it } from 'vitest';
import { HUMOR, ShuffleBag, SIDE_GAGS, aside } from '../src/humor';

describe('ShuffleBag', () => {
  it('plays every item once before repeating', () => {
    const bag = new ShuffleBag(['a', 'b', 'c', 'd', 'e']);
    const round = Array.from({ length: 5 }, () => bag.next());
    expect(new Set(round).size).toBe(5);
  });

  it('never repeats back-to-back, even across reshuffles', () => {
    const bag = new ShuffleBag(['a', 'b', 'c']);
    let prev = bag.next();
    for (let i = 0; i < 300; i++) {
      const cur = bag.next();
      expect(cur).not.toBe(prev);
      prev = cur;
    }
  });

  it('rejects an empty pool', () => {
    expect(() => new ShuffleBag([])).toThrow();
  });
});

describe('joke pools', () => {
  it('every pool has enough lines to stay fresh', () => {
    for (const [kind, lines] of Object.entries(HUMOR)) {
      expect(lines.length, kind).toBeGreaterThanOrEqual(5);
    }
    expect(SIDE_GAGS.length).toBeGreaterThanOrEqual(10);
  });

  it('aside() cycles a whole pool without repeats', () => {
    const n = HUMOR.shopNotes.length;
    const seen = new Set(Array.from({ length: n }, () => aside('shopNotes')));
    expect(seen.size).toBe(n);
  });

  it('keeps running gags rare: the bathroom bit lives in one review, not the UI pools', () => {
    const all = Object.values(HUMOR).flat().join(' ').toLowerCase();
    expect(all).not.toContain('bathroom');
  });
});
