import { describe, expect, it } from 'vitest';
import { dilate, gradeFor, scoreMasks } from '../src/scoring';

const SIZE = 64;

function blank(): Uint8Array {
  return new Uint8Array(SIZE * SIZE);
}

/** Ring of thickness ~2 cells around the grid center. */
function ring(radius: number, dx = 0, dy = 0): Uint8Array {
  const m = blank();
  const c = SIZE / 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - c - dx, y - c - dy);
      if (Math.abs(d - radius) <= 1) m[y * SIZE + x] = 1;
    }
  }
  return m;
}

describe('dilate', () => {
  it('grows a single cell into a square of side 2r+1', () => {
    const m = blank();
    m[10 * SIZE + 10] = 1;
    const d = dilate(m, SIZE, 2);
    let n = 0;
    for (const v of d) n += v;
    expect(n).toBe(25);
    expect(d[8 * SIZE + 8]).toBe(1);
    expect(d[7 * SIZE + 10]).toBe(0);
  });

  it('clips at the grid edges', () => {
    const m = blank();
    m[0] = 1;
    let n = 0;
    for (const v of dilate(m, SIZE, 1)) n += v;
    expect(n).toBe(4);
  });
});

describe('scoreMasks', () => {
  it('gives 100 for a perfect copy', () => {
    const t = ring(20);
    const r = scoreMasks(t.slice(), t, SIZE);
    expect(r.score).toBe(100);
    expect(r.grade).toBe('S');
  });

  it('gives 0 for no ink', () => {
    expect(scoreMasks(blank(), ring(20), SIZE).score).toBe(0);
  });

  it('forgives a small wobble within tolerance', () => {
    const r = scoreMasks(ring(20, 1, 1), ring(20), SIZE, 2);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  it('punishes inking only half the design (low recall)', () => {
    const t = ring(20);
    const half = t.slice();
    for (let i = 0; i < half.length; i++) if (i % SIZE < SIZE / 2) half[i] = 0;
    const r = scoreMasks(half, t, SIZE);
    expect(r.recall).toBeLessThan(0.6);
    expect(r.precision).toBeGreaterThan(0.95);
    expect(r.score).toBeLessThan(75);
  });

  it('punishes flooding the whole area (low precision)', () => {
    const flood = new Uint8Array(SIZE * SIZE).fill(1);
    const r = scoreMasks(flood, ring(20), SIZE);
    expect(r.recall).toBe(1);
    expect(r.precision).toBeLessThan(0.3);
    expect(r.score).toBeLessThan(50);
  });

  it('scores the wrong shape poorly', () => {
    const r = scoreMasks(ring(8), ring(25), SIZE);
    expect(r.score).toBeLessThan(15);
  });

  it('rejects mismatched sizes', () => {
    expect(() => scoreMasks(new Uint8Array(4), ring(20), SIZE)).toThrow();
  });
});

describe('gradeFor', () => {
  it('maps boundaries', () => {
    expect(gradeFor(92)).toBe('S');
    expect(gradeFor(80)).toBe('A');
    expect(gradeFor(65)).toBe('B');
    expect(gradeFor(50)).toBe('C');
    expect(gradeFor(30)).toBe('D');
    expect(gradeFor(29)).toBe('F');
  });
});
