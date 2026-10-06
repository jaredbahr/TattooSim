/**
 * Pixel-art "CHEEKY BUSINESS" logo: a hand-made 5×7 bitmap font plus a little butt
 * mascot (with a heart tattoo, naturally). Drawn at native resolution; scale it up with
 * `image-rendering: pixelated` or a nearest-neighbor drawImage.
 */

const GLYPHS: Record<string, string[]> = {
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
};

const PINK = '#ff3fa4';
const PINK_LIGHT = '#ff9ad0';
const SHADOW = '#6a0f42';
const OUTLINE = '#12070e';

/** Mascot sprite, 22×18. `o` outline, `s` skin, `h` highlight, `d` shade, `x` hole, `r` heart tattoo. */
const MASCOT = [
  '....oooooo..oooooo....',
  '..oohhssssooosssssoo..',
  '.ohhsssssssosssssssso.',
  '.ohsssssssssssssrrsso.',
  'ohssssssssssssssrrrsso',
  'ossssssssssssssssrssso',
  'osssssssssddssssssssso',
  'osssssssssdxdssssssddo',
  'ossssssssssddsssssssdo',
  'osssssssssssssssssssdo',
  'osssssssssosssssssssdo',
  '.ossssssssosssssssddo.',
  '.osssssssdoodssssdddo.',
  '..ossssddo..oddddddo..',
  '...oodddo....odddoo...',
  '.....ooo......ooo.....',
];
const MASCOT_COLORS: Record<string, string> = {
  o: OUTLINE, s: '#f2b896', h: '#ffe0cc', d: '#d48a6a', x: '#3a1018', r: '#ff3fa4',
};

const GLYPH_W = 5;
const GLYPH_H = 7;

function textWidth(text: string): number {
  return text.length * (GLYPH_W + 1) - 1;
}

/** Draw text with a 1px outline and drop shadow. */
function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  const pixels: [number, number][] = [];
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (!g) return;
    g.forEach((row, gy) => {
      [...row].forEach((cell, gx) => {
        if (cell === '#') pixels.push([x + i * (GLYPH_W + 1) + gx, y + gy]);
      });
    });
  });
  ctx.fillStyle = OUTLINE;
  for (const [px, py] of pixels) ctx.fillRect(px - 1, py - 1, 3, 4);
  ctx.fillStyle = SHADOW;
  for (const [px, py] of pixels) ctx.fillRect(px, py + 1, 1, 1);
  for (const [px, py] of pixels) {
    ctx.fillStyle = py - y < 2 ? PINK_LIGHT : PINK;
    ctx.fillRect(px, py, 1, 1);
  }
}

function drawMascot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  MASCOT.forEach((row, my) => {
    [...row].forEach((cell, mx) => {
      const c = MASCOT_COLORS[cell];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(x + mx, y + my, 1, 1);
    });
  });
}

/** Native-resolution logo canvas (about 80×22 px). */
export function makeLogo(): HTMLCanvasElement {
  const lines = ['CHEEKY', 'BUSINESS'];
  const textW = Math.max(...lines.map(textWidth));
  const mascotW = MASCOT[0].length;
  const w = mascotW + 4 + textW + 2;
  const h = 2 * GLYPH_H + 3 + 4;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  drawMascot(ctx, 0, Math.round((h - MASCOT.length) / 2));
  const tx = mascotW + 4;
  drawText(ctx, lines[0], tx + Math.round((textW - textWidth(lines[0])) / 2), 1);
  drawText(ctx, lines[1], tx, GLYPH_H + 4);
  return c;
}

/** Same logo scaled up by an integer factor with hard pixel edges. */
export function makeLogoScaled(scale: number): HTMLCanvasElement {
  const src = makeLogo();
  const c = document.createElement('canvas');
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
