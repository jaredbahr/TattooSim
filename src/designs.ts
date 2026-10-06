/**
 * Tattoo design library.
 *
 * Every design is drawn as strokes in a unit box ([-1, 1] on both axes, +y down,
 * origin = the customer's... focal point). The same draw function renders the
 * reference card in the UI and the hidden target mask used for scoring, so what
 * the player sees is exactly what they are judged against.
 */

export interface Design {
  id: string;
  name: string;
  /** Hint shown under the reference card. */
  tip: string;
  draw(ctx: CanvasRenderingContext2D): void;
}

const TAU = Math.PI * 2;

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, TAU);
}

function polyline(ctx: CanvasRenderingContext2D, pts: [number, number][], close = false): void {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

export const DESIGNS: Design[] = [
  {
    id: 'heart',
    name: 'Heart',
    tip: 'Classic. The hole goes right in the middle. Romantic.',
    draw(ctx) {
      ctx.moveTo(0, 0.85);
      ctx.bezierCurveTo(-0.55, 0.45, -1.0, 0.05, -0.85, -0.4);
      ctx.bezierCurveTo(-0.7, -0.85, -0.15, -0.9, 0, -0.45);
      ctx.bezierCurveTo(0.15, -0.9, 0.7, -0.85, 0.85, -0.4);
      ctx.bezierCurveTo(1.0, 0.05, 0.55, 0.45, 0, 0.85);
    },
  },
  {
    id: 'star',
    name: 'Gold Star',
    tip: 'For a job well done. Five points, no shortcuts.',
    draw(ctx) {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 0.92 : 0.38;
        pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.05]);
      }
      polyline(ctx, pts, true);
    },
  },
  {
    id: 'smiley',
    name: 'Smiley Face',
    tip: "The hole is the nose. Don't overthink it.",
    draw(ctx) {
      circle(ctx, 0, 0, 0.85);
      circle(ctx, -0.32, -0.3, 0.1);
      circle(ctx, 0.32, -0.3, 0.1);
      ctx.moveTo(-0.45, 0.3);
      ctx.quadraticCurveTo(0, 0.75, 0.45, 0.3);
    },
  },
  {
    id: 'bullseye',
    name: 'Bullseye',
    tip: 'Three rings. The target is... self-explanatory.',
    draw(ctx) {
      circle(ctx, 0, 0, 0.85);
      circle(ctx, 0, 0, 0.55);
      circle(ctx, 0, 0, 0.25);
    },
  },
  {
    id: 'sun',
    name: 'Sunshine',
    tip: 'The sun shines out of it, apparently.',
    draw(ctx) {
      circle(ctx, 0, 0, 0.35);
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        ctx.moveTo(Math.cos(a) * 0.55, Math.sin(a) * 0.55);
        ctx.lineTo(Math.cos(a) * 0.92, Math.sin(a) * 0.92);
      }
    },
  },
  {
    id: 'donut',
    name: 'Donut',
    tip: 'Sprinkles are mandatory. The hole is provided.',
    draw(ctx) {
      circle(ctx, 0, 0, 0.85);
      circle(ctx, 0, 0, 0.3);
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
    id: 'eye',
    name: 'All-Seeing Eye',
    tip: 'It watches. It knows. It sits down a lot.',
    draw(ctx) {
      ctx.moveTo(-0.95, 0);
      ctx.quadraticCurveTo(0, -0.85, 0.95, 0);
      ctx.quadraticCurveTo(0, 0.85, -0.95, 0);
      circle(ctx, 0, 0, 0.3);
    },
  },
  {
    id: 'spiral',
    name: 'Black Hole',
    tip: 'A spiral into the void. Very deep. Literally.',
    draw(ctx) {
      const turns = 2.6;
      const steps = 140;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = t * turns * TAU;
        const r = 0.12 + t * 0.8;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    },
  },
  {
    id: 'flower',
    name: 'Daisy',
    tip: 'Six petals around the center. Spring has sprung.',
    draw(ctx) {
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        const cx = Math.cos(a) * 0.55;
        const cy = Math.sin(a) * 0.55;
        ctx.moveTo(cx + Math.cos(a) * 0.32, cy + Math.sin(a) * 0.32);
        ctx.ellipse(cx, cy, 0.32, 0.18, a, 0, TAU);
      }
    },
  },
  {
    id: 'crosshair',
    name: 'Crosshair',
    tip: 'For the gamer who wants to be found.',
    draw(ctx) {
      circle(ctx, 0, 0, 0.7);
      ctx.moveTo(0, -0.95);
      ctx.lineTo(0, -0.25);
      ctx.moveTo(0, 0.25);
      ctx.lineTo(0, 0.95);
      ctx.moveTo(-0.95, 0);
      ctx.lineTo(-0.25, 0);
      ctx.moveTo(0.25, 0);
      ctx.lineTo(0.95, 0);
    },
  },
  {
    id: 'peace',
    name: 'Peace Sign',
    tip: 'Inner peace, outer peace. Mostly outer.',
    draw(ctx) {
      circle(ctx, 0, 0, 0.85);
      ctx.moveTo(0, -0.85);
      ctx.lineTo(0, 0.85);
      ctx.moveTo(0, 0.1);
      ctx.lineTo(-0.6, 0.6);
      ctx.moveTo(0, 0.1);
      ctx.lineTo(0.6, 0.6);
    },
  },
  {
    id: 'bolt',
    name: 'Lightning Bolt',
    tip: 'Fast. Dangerous. Avoid after Taco Tuesday.',
    draw(ctx) {
      polyline(
        ctx,
        [
          [0.2, -0.95], [-0.45, 0.1], [-0.02, 0.1],
          [-0.25, 0.95], [0.5, -0.15], [0.05, -0.15],
        ],
        true,
      );
    },
  },
];

/** Line width in unit-box space. Shared by the reference card and the target mask. */
export const DESIGN_LINE_WIDTH = 0.07;

/**
 * Draw a design centered at (cx, cy) with half-size `half` pixels.
 * Caller sets strokeStyle; this sets transform-aware lineWidth and caps.
 */
export function renderDesign(
  ctx: CanvasRenderingContext2D,
  design: Design,
  cx: number,
  cy: number,
  half: number,
  lineWidthUnits = DESIGN_LINE_WIDTH,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(half, half);
  ctx.lineWidth = lineWidthUnits;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  design.draw(ctx);
  ctx.stroke();
  ctx.restore();
}

export function designById(id: string): Design {
  const d = DESIGNS.find((x) => x.id === id);
  if (!d) throw new Error(`unknown design ${id}`);
  return d;
}
