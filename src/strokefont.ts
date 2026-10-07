/**
 * Single-stroke font for text tattoos. Normal fonts are filled shapes you can't trace
 * with a needle; these letters are a few straight strokes each, like a sign painter's
 * block caps. Glyphs live on a 4×6 grid (x right, y down).
 */
type Stroke = [number, number][];

const GLYPHS: Record<string, Stroke[]> = {
  A: [[[0, 6], [2, 0], [4, 6]], [[1, 4], [3, 4]]],
  B: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]], [[0, 0], [3, 0], [4, 1], [4, 2], [3, 3]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3], [2, 3]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[1, 0], [3, 0]], [[2, 0], [2, 6]], [[1, 6], [3, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 3], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[2, 3], [4, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
};


/** Horizontal advance per character, as a fraction of the letter height. */
const ADVANCE = 4 / 6 + 0.28;

export function textWidth(text: string, height: number): number {
  return text.length * ADVANCE * height - 0.28 * height;
}

/**
 * Add `text` to the current path, centered on (cx, cy) with letters `height` tall.
 * Spaces advance without drawing; `skip` lists indices to leave blank (e.g. the hole as an O).
 */
export function strokeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  height: number,
  skip: number[] = [],
): void {
  const s = height / 6;
  let x = cx - textWidth(text, height) / 2;
  const top = cy - height / 2;
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (g && !skip.includes(i)) {
      for (const stroke of g) {
        ctx.moveTo(x + stroke[0][0] * s, top + stroke[0][1] * s);
        for (let k = 1; k < stroke.length; k++) ctx.lineTo(x + stroke[k][0] * s, top + stroke[k][1] * s);
      }
    }
    x += ADVANCE * height;
  });
}

/** X position of the center of character `i` for text centered on cx. */
export function charCenter(text: string, i: number, cx: number, height: number): number {
  return cx - textWidth(text, height) / 2 + i * ADVANCE * height + (4 / 6) * height / 2;
}
