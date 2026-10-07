/**
 * Tattoo accuracy scoring.
 *
 * Pure functions over square binary masks (Uint8Array, 1 = inked) so they can be
 * unit-tested without a DOM. The game rasterizes the reference design and the
 * player's ink into same-sized grids and calls `scoreMasks`.
 *
 * Method: tolerant precision/recall.
 *   - precision = share of the player's ink that lands within `tolerance` cells of the design
 *   - recall    = share of the design that has player ink within `tolerance` cells
 *   - accuracy  = F1 of the two, curved downward so sloppy work can't pass as a B
 * Precision punishes scribbling everywhere; recall punishes drawing only half the design.
 */

export interface ScoreBreakdown {
  /** 0..1, how much of the ink belongs to the design */
  precision: number;
  /** 0..1, how much of the design got inked */
  recall: number;
  /** 0..100, final displayed score */
  score: number;
  /** letter grade derived from score */
  grade: Grade;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

/** Chebyshev-distance dilation: every cell within `radius` of an inked cell becomes inked. */
export function dilate(mask: Uint8Array, size: number, radius: number): Uint8Array {
  if (radius <= 0) return mask.slice();
  // Separable max filter: horizontal pass, then vertical pass.
  const horiz = new Uint8Array(mask.length);
  for (let y = 0; y < size; y++) {
    const row = y * size;
    for (let x = 0; x < size; x++) {
      if (!mask[row + x]) continue;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(size - 1, x + radius);
      for (let xx = x0; xx <= x1; xx++) horiz[row + xx] = 1;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!horiz[y * size + x]) continue;
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(size - 1, y + radius);
      for (let yy = y0; yy <= y1; yy++) out[yy * size + x] = 1;
    }
  }
  return out;
}

export function countOn(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
}

export function gradeFor(score: number): Grade {
  if (score >= 92) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

/**
 * @param strayInk ink area (in grid cells) that fell outside the scored crop entirely.
 *   It can never hit the design, so it only drags precision down.
 * @param forgiven ink near these cells isn't held against accuracy (e.g. the design a client
 *   asked for before changing their mind). Coverage is still judged on `target` alone.
 */
export function scoreMasks(
  ink: Uint8Array,
  target: Uint8Array,
  size: number,
  tolerance = 2,
  strayInk = 0,
  forgiven?: Uint8Array,
): ScoreBreakdown {
  if (ink.length !== size * size || target.length !== size * size) {
    throw new Error(`mask length must be size*size (${size * size})`);
  }
  const inkCount = countOn(ink) + strayInk;
  const targetCount = countOn(target);
  if (inkCount === 0 || targetCount === 0) {
    return { precision: 0, recall: 0, score: 0, grade: 'F' };
  }

  let allowed = target;
  if (forgiven) {
    allowed = target.slice();
    for (let i = 0; i < allowed.length; i++) allowed[i] |= forgiven[i];
  }
  const targetNear = dilate(allowed, size, tolerance);
  const inkNear = dilate(ink, size, tolerance);

  let inkHits = 0;
  let targetHits = 0;
  for (let i = 0; i < ink.length; i++) {
    if (ink[i] && targetNear[i]) inkHits++;
    if (target[i] && inkNear[i]) targetHits++;
  }

  const precision = inkHits / inkCount;
  const recall = targetHits / targetCount;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  // Downward curve: near-perfect work stays near 100, but sloppy or half-finished work
  // falls off fast (F1 0.92 → 88, 0.75 → 63, 0.55 → 38). Tuned with a simulated player.
  const score = Math.round(100 * Math.pow(f1, 1.6));
  return { precision, recall, score, grade: gradeFor(score) };
}
