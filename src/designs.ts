/**
 * Tattoo design library.
 *
 * Every design is drawn in a unit box ([-1, 1] on both axes, +y down, origin = the hole).
 * How big that box is on the skin depends on the job (see jobs.ts): a hole job maps the
 * unit box to ~90 px around the hole, cheek and full-moon jobs map it across both cheeks.
 *
 * The same draw functions render the reference card AND the hidden target mask used for
 * scoring, so what the player sees is exactly what they are judged against.
 *
 * Cheek-scale layout cheat sheet (unit coords):
 *   cheek centers ≈ (±0.61, 0.24) · lower back ≈ y < -0.6 · avoid x≈0 below y 0.6 (the gap)
 */
import type { JobKind } from './jobs';
import { charCenter, strokeText } from './strokefont';

export interface Design {
  id: string;
  name: string;
  job: JobKind;
  /** Hint shown under the reference card. */
  tip: string;
  /** Line work (stroked). */
  draw(ctx: CanvasRenderingContext2D): void;
  /** Solid areas (filled), e.g. tribal and silhouettes. */
  fill?(ctx: CanvasRenderingContext2D): void;
  /** Custom walk-in request (text tattoos read badly through the generic "Make it a {d}"). */
  request?: string;
}

type Pt = [number, number];
const TAU = Math.PI * 2;

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, TAU);
}

function polyline(ctx: CanvasRenderingContext2D, pts: Pt[], close = false): void {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  polyline(ctx, pts, true);
}

const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [-x, y]);
const place = (pts: Pt[], s: number, dx: number, dy: number, flip = false): Pt[] =>
  pts.map(([x, y]) => [(flip ? -x : x) * s + dx, y * s + dy]);

/** Right-hand eagle wing, from shoulder out to the tip and back along a feathered edge. */
function wing(sx: number, sy: number, scale: number): Pt[] {
  const raw: Pt[] = [
    [0, 0], [0.33, -0.2], [0.68, -0.35], [0.96, -0.4],
    [0.83, -0.2], [0.88, -0.12], [0.7, 0], [0.76, 0.1], [0.54, 0.18], [0.58, 0.3], [0.33, 0.32], [0.28, 0.45], [0, 0.4],
  ];
  return raw.map(([x, y]) => [sx + x * scale, sy + y * scale]);
}

/** Swallow silhouette facing +x, unit-ish size. */
const SWALLOW: Pt[] = [
  [0.9, 0], [0.7, -0.12], [0.4, -0.15], [0.1, -0.8], [-0.05, -0.75], [0, -0.2],
  [-0.5, -0.1], [-1.0, -0.35], [-0.65, 0], [-1.0, 0.3], [-0.5, 0.1],
  [0, 0.15], [0.25, 0.55], [0.38, 0.5], [0.35, 0.15], [0.7, 0.12],
];

/** Right half of the tramp stamp; mirrored for the left. Runs top-center → bottom-center. */
const STAMP_HALF: Pt[] = [
  [0, -1.12], [0.25, -1.0], [0.55, -1.16], [0.92, -1.05], [1.1, -0.86], [0.82, -0.92],
  [0.6, -0.86], [0.72, -0.7], [0.48, -0.75], [0.25, -0.82], [0.1, -0.66], [0, -0.6],
];

/** Right-cheek tribal flame for the Eye of the Tribe; mirrored for the left. */
const FLAME: Pt[] = [
  [0.32, 0.05], [0.55, -0.3], [0.62, -0.62], [0.78, -0.3], [0.95, -0.55], [0.98, -0.15],
  [1.15, -0.25], [1.08, 0.2], [0.9, 0.5], [0.85, 0.2], [0.68, 0.45], [0.62, 0.15], [0.45, 0.25],
];

export const DESIGNS: Design[] = [
  // ───────────── Hole jobs: small, built around the hole ─────────────
  {
    id: 'bullseye', name: 'Bullseye', job: 'hole',
    tip: 'Three rings. The target is... self-explanatory.',
    draw(ctx) { circle(ctx, 0, 0, 0.85); circle(ctx, 0, 0, 0.55); circle(ctx, 0, 0, 0.28); },
  },
  {
    id: 'donut', name: 'Donut', job: 'hole',
    tip: 'Sprinkles are mandatory. The hole is provided.',
    draw(ctx) {
      circle(ctx, 0, 0, 0.85);
      circle(ctx, 0, 0, 0.32);
      const sprinkles: [number, number, number][] = [
        [-0.55, -0.2, 0.5], [0.5, -0.35, -0.6], [0.05, -0.6, 0.2],
        [-0.3, 0.55, -0.4], [0.55, 0.35, 0.9], [-0.6, 0.25, 1.3],
      ];
      for (const [x, y, a] of sprinkles) {
        ctx.moveTo(x - Math.cos(a) * 0.1, y - Math.sin(a) * 0.1);
        ctx.lineTo(x + Math.cos(a) * 0.1, y + Math.sin(a) * 0.1);
      }
    },
  },
  {
    id: 'eye', name: 'All-Seeing Eye', job: 'hole',
    tip: 'It watches. It knows. It sits down a lot.',
    draw(ctx) {
      ctx.moveTo(-0.95, 0);
      ctx.quadraticCurveTo(0, -0.85, 0.95, 0);
      ctx.quadraticCurveTo(0, 0.85, -0.95, 0);
      circle(ctx, 0, 0, 0.32);
    },
  },
  {
    id: 'birdeye', name: "Bird's-Eye View", job: 'hole',
    tip: 'A little bird. The hole is its eye. It sees everything.',
    draw(ctx) {
      circle(ctx, 0.15, 0.05, 0.62);
      polyline(ctx, [[-0.4, -0.2], [-1.0, 0.05], [-0.42, 0.3]]);
      circle(ctx, 0, 0, 0.22);
      polyline(ctx, [[0.3, -0.52], [0.5, -0.95], [0.6, -0.62], [0.85, -0.85], [0.72, -0.42]]);
    },
  },
  {
    id: 'tribalsun', name: 'Tribal Sun', job: 'hole',
    tip: 'Ten curved spikes. Fill them in solid. Very 1998.',
    draw(ctx) { circle(ctx, 0, 0, 0.3); },
    fill(ctx) {
      for (let i = 0; i < 10; i++) {
        const a = (i * TAU) / 10;
        polyline(ctx, [
          [Math.cos(a - 0.16) * 0.34, Math.sin(a - 0.16) * 0.34],
          [Math.cos(a + 0.3) * 0.95, Math.sin(a + 0.3) * 0.95],
          [Math.cos(a + 0.18) * 0.34, Math.sin(a + 0.18) * 0.34],
        ], true);
      }
    },
  },
  {
    id: 'lips', name: 'Smooch', job: 'hole',
    tip: 'Big kissy lips. The hole is doing the talking.',
    draw(ctx) {
      ctx.moveTo(-0.92, 0);
      ctx.bezierCurveTo(-0.6, -0.3, -0.45, -0.55, -0.22, -0.48);
      ctx.quadraticCurveTo(0, -0.42, 0, -0.28);
      ctx.quadraticCurveTo(0, -0.42, 0.22, -0.48);
      ctx.bezierCurveTo(0.45, -0.55, 0.6, -0.3, 0.92, 0);
      ctx.bezierCurveTo(0.6, 0.7, -0.6, 0.7, -0.92, 0);
      ctx.moveTo(-0.75, 0.02);
      ctx.quadraticCurveTo(0, 0.18, 0.75, 0.02);
    },
  },
  {
    id: 'smiley', name: 'Smiley Face', job: 'hole',
    tip: "The hole is the nose. Don't overthink it.",
    draw(ctx) {
      circle(ctx, 0, 0, 0.88);
      circle(ctx, -0.34, -0.36, 0.1);
      circle(ctx, 0.34, -0.36, 0.1);
      ctx.moveTo(-0.48, 0.32);
      ctx.quadraticCurveTo(0, 0.78, 0.48, 0.32);
    },
  },
  {
    id: 'sun', name: 'Sunshine', job: 'hole',
    tip: 'The sun shines out of it, apparently.',
    draw(ctx) {
      circle(ctx, 0, 0, 0.36);
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        ctx.moveTo(Math.cos(a) * 0.56, Math.sin(a) * 0.56);
        ctx.lineTo(Math.cos(a) * 0.92, Math.sin(a) * 0.92);
      }
    },
  },
  {
    id: 'spiral', name: 'Black Hole', job: 'hole',
    tip: 'A spiral into the void. Very deep. Literally.',
    draw(ctx) {
      const steps = 140;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = t * 2.4 * TAU;
        const r = 0.18 + t * 0.75;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
    },
  },
  {
    id: 'flower', name: 'Daisy', job: 'hole',
    tip: 'Six petals around the center. Spring has sprung.',
    draw(ctx) {
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        const cx = Math.cos(a) * 0.58;
        const cy = Math.sin(a) * 0.58;
        ctx.moveTo(cx + Math.cos(a) * 0.32, cy + Math.sin(a) * 0.32);
        ctx.ellipse(cx, cy, 0.32, 0.18, a, 0, TAU);
      }
    },
  },
  {
    id: 'crosshair', name: 'Crosshair', job: 'hole',
    tip: 'For the gamer who wants to be found.',
    draw(ctx) {
      circle(ctx, 0, 0, 0.7);
      for (const [x0, y0, x1, y1] of [[0, -0.95, 0, -0.3], [0, 0.3, 0, 0.95], [-0.95, 0, -0.3, 0], [0.3, 0, 0.95, 0]]) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
    },
  },
  {
    id: 'star', name: 'Gold Star', job: 'hole',
    tip: 'For a job well done. Five points, no shortcuts.',
    draw(ctx) { star(ctx, 0, 0.05, 0.95); },
  },

  // ───────────── Cheek jobs: big pieces across both cheeks ─────────────
  {
    id: 'eagle', name: 'Bald Eagle', job: 'cheek',
    tip: 'Wings across both cheeks. Freedom rings. The body goes right down the middle.',
    draw(ctx) {
      polyline(ctx, wing(0.12, -0.5, 1));
      polyline(ctx, mirror(wing(0.12, -0.5, 1)));
      circle(ctx, 0, -0.74, 0.14);
      polyline(ctx, [[0.12, -0.78], [0.3, -0.72], [0.12, -0.66]]);
      polyline(ctx, [[-0.12, -0.6], [-0.14, 0.12], [-0.22, 0.48], [0, 0.32], [0.22, 0.48], [0.14, 0.12], [0.12, -0.6]]);
    },
  },
  {
    id: 'swallows', name: 'Sailor Swallows', job: 'cheek',
    tip: 'One swallow per cheek, facing each other. Solid fill. Old-school.',
    draw(ctx) {
      polyline(ctx, place(SWALLOW, 0.34, -0.62, 0.22), true);
      polyline(ctx, place(SWALLOW, 0.34, 0.62, 0.22, true), true);
    },
    fill(ctx) {
      polyline(ctx, place(SWALLOW, 0.34, -0.62, 0.22), true);
      polyline(ctx, place(SWALLOW, 0.34, 0.62, 0.22, true), true);
    },
  },
  {
    id: 'stamp', name: 'Tribal Tramp Stamp', job: 'cheek',
    tip: 'Lower back, dead center, filled solid. A timeless classic. Allegedly.',
    draw(ctx) { polyline(ctx, [...STAMP_HALF, ...mirror(STAMP_HALF).reverse()], true); },
    fill(ctx) { polyline(ctx, [...STAMP_HALF, ...mirror(STAMP_HALF).reverse()], true); },
  },
  {
    id: 'bigheart', name: 'Big Heart', job: 'cheek',
    tip: 'One giant heart around the whole situation. Romantic.',
    draw(ctx) {
      ctx.moveTo(0, 0.6);
      ctx.bezierCurveTo(-0.6, 0.25, -1.15, -0.15, -0.95, -0.6);
      ctx.bezierCurveTo(-0.78, -1.05, -0.18, -1.05, 0, -0.6);
      ctx.bezierCurveTo(0.18, -1.05, 0.78, -1.05, 0.95, -0.6);
      ctx.bezierCurveTo(1.15, -0.15, 0.6, 0.25, 0, 0.6);
    },
  },
  {
    id: 'wings', name: 'Angel Wings', job: 'cheek',
    tip: 'One wing per cheek, sweeping outward. Heaven sent. Heaven adjacent.',
    draw(ctx) {
      for (const s of [-1, 1]) {
        ctx.moveTo(s * 0.18, -0.3);
        ctx.bezierCurveTo(s * 0.5, -0.75, s * 1.0, -0.7, s * 1.15, -0.4);
        ctx.bezierCurveTo(s * 1.0, -0.3, s * 1.1, -0.1, s * 0.95, 0.0);
        ctx.bezierCurveTo(s * 1.0, 0.15, s * 0.85, 0.3, s * 0.7, 0.3);
        ctx.bezierCurveTo(s * 0.7, 0.5, s * 0.45, 0.55, s * 0.3, 0.45);
        ctx.bezierCurveTo(s * 0.2, 0.3, s * 0.12, 0.0, s * 0.18, -0.3);
        // Feather lines.
        ctx.moveTo(s * 0.35, -0.3);
        ctx.quadraticCurveTo(s * 0.7, -0.35, s * 0.9, -0.2);
        ctx.moveTo(s * 0.32, 0.0);
        ctx.quadraticCurveTo(s * 0.6, -0.02, s * 0.75, 0.12);
      }
    },
  },

  // ───────────── Text tattoos (single-stroke font, see strokefont.ts) ─────────────
  {
    id: 'exitonly', name: 'Exit Only', job: 'cheek',
    tip: 'Sign on the lower back, arrow pointing at the exit. Obviously.',
    request: 'I need signage back there. EXIT ONLY. Big arrow. People need to know.',
    draw(ctx) {
      strokeText(ctx, 'EXIT', 0, -1.05, 0.28);
      strokeText(ctx, 'ONLY', 0, -0.7, 0.28);
      ctx.moveTo(0, -0.5);
      ctx.lineTo(0, -0.2);
      ctx.moveTo(-0.11, -0.33);
      ctx.lineTo(0, -0.2);
      ctx.lineTo(0.11, -0.33);
    },
  },
  {
    id: 'ragrets', name: 'No Ragrets', job: 'cheek',
    tip: 'Spelled exactly like that. The client was very clear.',
    request: "NO RAGRETS. Spell it exactly like that. Don't fix it. I know what I said.",
    draw(ctx) {
      strokeText(ctx, 'NO', 0, -1.02, 0.28);
      strokeText(ctx, 'RAGRETS', 0, -0.66, 0.28);
    },
  },
  {
    id: 'lovehate', name: 'Love / Hate', job: 'cheek',
    tip: 'LOVE on the left cheek, HATE on the right. Duality.',
    request: 'LOVE on the left cheek, HATE on the right. I contain multitudes.',
    draw(ctx) {
      strokeText(ctx, 'LOVE', -0.62, 0.22, 0.26);
      strokeText(ctx, 'HATE', 0.62, 0.22, 0.26);
    },
  },
  {
    id: 'butt', name: 'BUTT Label', job: 'cheek',
    tip: 'Big block letters across both cheeks. In case anyone was confused.',
    request: 'Just label it. BUTT. Big letters. In case of emergency.',
    draw(ctx) {
      strokeText(ctx, 'BUTT', 0, 0.2, 0.5);
    },
  },
  {
    id: 'momheart', name: 'Mom Heart', job: 'cheek',
    tip: 'A heart with MOM in it. A classic, relocated.',
    request: "A heart that says MOM. She'll never see it. Hopefully.",
    draw(ctx) {
      const k = 0.8;
      ctx.moveTo(0, 0.6 * k);
      ctx.bezierCurveTo(-0.6 * k, 0.25 * k, -1.15 * k, -0.15 * k, -0.95 * k, -0.6 * k);
      ctx.bezierCurveTo(-0.78 * k, -1.05 * k, -0.18 * k, -1.05 * k, 0, -0.6 * k);
      ctx.bezierCurveTo(0.18 * k, -1.05 * k, 0.78 * k, -1.05 * k, 0.95 * k, -0.6 * k);
      ctx.bezierCurveTo(1.15 * k, -0.15 * k, 0.6 * k, 0.25 * k, 0, 0.6 * k);
      strokeText(ctx, 'MOM', 0, -0.3, 0.3);
    },
  },
  {
    id: 'yolo', name: 'YOLO', job: 'hole',
    tip: "The hole is the first O. Don't overthink it.",
    request: 'YOLO. Use the hole as the O. Work smarter, not harder.',
    draw(ctx) {
      // Position the text so the first O sits exactly on the hole, and leave it blank.
      const h = 0.42;
      const cx = -charCenter('YOLO', 1, 0, h);
      strokeText(ctx, 'YOLO', cx, 0, h, [1]);
    },
  },

  // ───────────── Full Moon: cheek-sized piece with hole-sized detail ─────────────
  {
    id: 'phoenix', name: 'Phoenix Rising', job: 'moon',
    tip: 'Wings across the cheeks, rising from a tiny sun around the hole. Zoom in for the sun.',
    draw(ctx) {
      circle(ctx, 0, 0, 0.08);
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        ctx.moveTo(Math.cos(a) * 0.12, Math.sin(a) * 0.12);
        ctx.lineTo(Math.cos(a) * 0.19, Math.sin(a) * 0.19);
      }
      polyline(ctx, wing(0.12, -0.42, 0.95));
      polyline(ctx, mirror(wing(0.12, -0.42, 0.95)));
      circle(ctx, 0, -0.82, 0.12);
      polyline(ctx, [[0, -0.7], [0, -0.26]]);
    },
  },
  {
    id: 'tribaleye', name: 'Eye of the Tribe', job: 'moon',
    tip: 'Tribal flames on both cheeks, plus a tiny eye around the hole. Fill the flames.',
    draw(ctx) {
      ctx.moveTo(-0.3, 0);
      ctx.quadraticCurveTo(0, -0.24, 0.3, 0);
      ctx.quadraticCurveTo(0, 0.24, -0.3, 0);
      circle(ctx, 0, 0, 0.09);
      polyline(ctx, FLAME, true);
      polyline(ctx, mirror(FLAME), true);
    },
    fill(ctx) {
      polyline(ctx, FLAME, true);
      polyline(ctx, mirror(FLAME), true);
    },
  },
  {
    id: 'cosmos', name: 'Full Moon', job: 'moon',
    tip: 'Crescent moon on the left, stars on the right, tiny black hole in the middle.',
    draw(ctx) {
      ctx.moveTo(-0.45, -0.22);
      ctx.quadraticCurveTo(-1.25, 0.2, -0.45, 0.62);
      ctx.quadraticCurveTo(-0.85, 0.2, -0.45, -0.22);
      star(ctx, 0.6, 0.0, 0.18);
      star(ctx, 0.9, 0.38, 0.12);
      star(ctx, 0.45, 0.45, 0.1);
      circle(ctx, 0, 0, 0.08);
      circle(ctx, 0, 0, 0.15);
    },
  },
];

/**
 * Draw a design centered at (cx, cy), unit box mapped to `half` px, lines `lineWidthPx` wide.
 * Uses the caller's strokeStyle for lines and `fillStyle` (default: same as stroke) for fills.
 */
export function renderDesign(
  ctx: CanvasRenderingContext2D,
  design: Design,
  cx: number,
  cy: number,
  half: number,
  lineWidthPx: number,
  fillStyle?: string,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(half, half);
  if (design.fill) {
    ctx.fillStyle = fillStyle ?? ctx.strokeStyle;
    ctx.beginPath();
    design.fill(ctx);
    ctx.fill();
  }
  ctx.lineWidth = lineWidthPx / half;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  design.draw(ctx);
  ctx.stroke();
  ctx.restore();
}

export function designsFor(job: JobKind): Design[] {
  return DESIGNS.filter((d) => d.job === job);
}
