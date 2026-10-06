/**
 * Skin canvas + ink painting.
 *
 * Three layers are composited into one CanvasTexture that the butt mesh uses as its map:
 *   base  - skin tone, mottling, hair, and the... landmark
 *   irritation - fresh-tattoo redness that spreads around the ink
 *   ink   - what the player actually drew (the only layer that gets scored)
 *
 * Everything lives in UV space: canvas (0,0) is the top-left of the mesh's UV square,
 * and the design is centered on (0.5, 0.5).
 */
import * as THREE from 'three';
import { renderDesign, type Design } from './designs';
import type { Customer } from './customers';

export const TEX_SIZE = 1024;
/** Half-size of the design area in canvas px (design spans 40% of the UV square). */
export const DESIGN_HALF = TEX_SIZE * 0.2;
/** Scoring grid resolution covering the whole canvas (8 px per cell). */
export const GRID = 128;

export const BRUSHES = [
  { label: 'Fine', radius: 4 },
  { label: 'Liner', radius: 7 },
  { label: 'Shader', radius: 13 },
] as const;

const INK = 'rgba(18, 20, 34, 0.94)';

/**
 * Outline of the visible skin in canvas px: lower back on top, two cheeks below with a
 * notch between them at the bottom. Everything outside is alpha 0 and gets cut by
 * the material's alphaTest. Matches the dome footprints in scene.ts#cheekHeight.
 */
function silhouettePath(): Path2D {
  const p = new Path2D();
  // Lower back, tapering slightly at the waist.
  p.moveTo(118, 30);
  p.lineTo(906, 30);
  p.bezierCurveTo(930, 220, 990, 380, 1000, 560);
  p.lineTo(24, 560);
  p.bezierCurveTo(34, 380, 94, 220, 118, 30);
  p.closePath();
  // Cheeks.
  p.ellipse(292, 600, 252, 330, 0, 0, Math.PI * 2);
  p.closePath();
  p.ellipse(732, 600, 252, 330, 0, 0, Math.PI * 2);
  p.closePath();
  return p;
}

function makeCanvas(size = TEX_SIZE): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  if (amount < 0) c.lerp(new THREE.Color('#3a1a1a'), -amount);
  else c.lerp(new THREE.Color('#ffffff'), amount);
  return `#${c.getHexString()}`;
}

export class SkinPainter {
  readonly texture: THREE.CanvasTexture;
  private readonly composite: CanvasRenderingContext2D;
  private readonly base: CanvasRenderingContext2D;
  private readonly irritation: CanvasRenderingContext2D;
  private readonly ink: CanvasRenderingContext2D;
  private readonly silhouette = silhouettePath();
  /** Opaque everywhere except the silhouette; used to cast the rim shadow. */
  private readonly outside: HTMLCanvasElement;
  private dirty = true;
  private last: { x: number; y: number } | null = null;
  /** Total stamp count this session; used as a cheap "has the player done anything" check. */
  stamps = 0;

  constructor() {
    const [compCanvas, comp] = makeCanvas();
    this.composite = comp;
    this.base = makeCanvas()[1];
    this.irritation = makeCanvas()[1];
    this.ink = makeCanvas()[1];
    const [outside, o] = makeCanvas();
    o.fillStyle = '#000';
    o.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    o.globalCompositeOperation = 'destination-out';
    o.fill(this.silhouette);
    this.outside = outside;
    this.texture = new THREE.CanvasTexture(compCanvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  /** Reset all layers for a new customer. */
  prepare(c: Customer): void {
    const b = this.base;
    const S = TEX_SIZE;
    const mid = S / 2;
    b.clearRect(0, 0, S, S);
    b.save();
    b.clip(this.silhouette);
    b.fillStyle = c.skin;
    b.fillRect(0, 0, S, S);

    // Soft mottling so it doesn't look like plastic.
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = 20 + Math.random() * 90;
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      const tint = shade(c.skin, Math.random() < 0.5 ? -0.12 : 0.1);
      g.addColorStop(0, tint + '22');
      g.addColorStop(1, tint + '00');
      b.fillStyle = g;
      b.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Freckles / pores.
    b.fillStyle = shade(c.skin, -0.3) + '55';
    for (let i = 0; i < 380; i++) {
      b.beginPath();
      b.arc(Math.random() * S, Math.random() * S, 0.8 + Math.random() * 1.6, 0, Math.PI * 2);
      b.fill();
    }

    // Crease shading down the middle.
    const crease = b.createLinearGradient(mid - 40, 0, mid + 40, 0);
    crease.addColorStop(0, shade(c.skin, -0.15) + '00');
    crease.addColorStop(0.5, shade(c.skin, -0.35) + 'aa');
    crease.addColorStop(1, shade(c.skin, -0.15) + '00');
    b.fillStyle = crease;
    b.fillRect(mid - 40, S * 0.12, 80, S * 0.88);

    // The landmark. Cartoon-style: a dusky spot with radiating wrinkles.
    const spot = b.createRadialGradient(mid, mid, 0, mid, mid, 46);
    spot.addColorStop(0, shade(c.skin, -0.75));
    spot.addColorStop(0.35, shade(c.skin, -0.45));
    spot.addColorStop(1, shade(c.skin, -0.2) + '00');
    b.fillStyle = spot;
    b.beginPath();
    b.arc(mid, mid, 46, 0, Math.PI * 2);
    b.fill();
    b.strokeStyle = shade(c.skin, -0.6);
    b.lineCap = 'round';
    b.lineWidth = 2.5;
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + Math.random() * 0.2;
      const r0 = 7;
      const r1 = 22 + Math.random() * 12;
      b.beginPath();
      b.moveTo(mid + Math.cos(a) * r0, mid + Math.sin(a) * r0);
      b.quadraticCurveTo(
        mid + Math.cos(a + 0.15) * (r0 + r1) * 0.5,
        mid + Math.sin(a + 0.15) * (r0 + r1) * 0.5,
        mid + Math.cos(a) * r1,
        mid + Math.sin(a) * r1,
      );
      b.stroke();
    }

    // Hair, concentrated toward the middle (as nature intended).
    const hairs = Math.floor(c.hairiness * 900);
    b.strokeStyle = '#2b1d14cc';
    b.lineWidth = 1.6;
    for (let i = 0; i < hairs; i++) {
      const spread = 80 + Math.random() * 300;
      const x = mid + (Math.random() - 0.5) * spread * 1.2;
      const y = mid + (Math.random() - 0.5) * spread * 2;
      const a = Math.random() * Math.PI * 2;
      const len = 6 + Math.random() * 12;
      b.beginPath();
      b.moveTo(x, y);
      b.quadraticCurveTo(x + Math.cos(a + 0.8) * len * 0.6, y + Math.sin(a + 0.8) * len * 0.6, x + Math.cos(a) * len, y + Math.sin(a) * len);
      b.stroke();
    }

    // Darken the rim so the cut-out edge reads as skin curving away, not a paper edge.
    // Inner-shadow trick: draw everything *outside* the silhouette (clipped away) and let
    // only its blurred shadow bleed inward. Stroking the path would also stroke the
    // overlapping interior outlines of the cheeks.
    b.shadowColor = shade(c.skin, -0.4) + 'aa';
    b.shadowBlur = 40;
    b.drawImage(this.outside, 0, 0);
    b.restore();

    this.irritation.clearRect(0, 0, S, S);
    this.ink.clearRect(0, 0, S, S);
    this.last = null;
    this.stamps = 0;
    this.dirty = true;
  }

  /** True if a UV coordinate lands on visible skin (inside the silhouette). */
  isOnSkin(uv: THREE.Vector2): boolean {
    return this.composite.isPointInPath(this.silhouette, uv.x * TEX_SIZE, (1 - uv.y) * TEX_SIZE);
  }

  /** Begin a new stroke (prevents connecting to the previous stroke). */
  lift(): void {
    this.last = null;
  }

  /** Ink at a UV coordinate, interpolating from the previous point in this stroke. */
  paintAt(uv: THREE.Vector2, radius: number): void {
    const x = uv.x * TEX_SIZE;
    const y = (1 - uv.y) * TEX_SIZE;
    const from = this.last ?? { x, y };
    const dist = Math.hypot(x - from.x, y - from.y);
    // A big jump means the mesh lurched or the cursor left and re-entered; don't draw a line across.
    if (dist > TEX_SIZE * 0.08) {
      this.last = { x, y };
      return;
    }
    const step = Math.max(1, radius * 0.35);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.stamp(from.x + (x - from.x) * t, from.y + (y - from.y) * t, radius);
    }
    this.last = { x, y };
  }

  private stamp(x: number, y: number, radius: number): void {
    const irr = this.irritation;
    const r2 = radius * 3.2;
    const g = irr.createRadialGradient(x, y, 0, x, y, r2);
    g.addColorStop(0, 'rgba(220, 40, 40, 0.05)');
    g.addColorStop(1, 'rgba(220, 40, 40, 0)');
    irr.fillStyle = g;
    irr.fillRect(x - r2, y - r2, r2 * 2, r2 * 2);

    const ink = this.ink;
    ink.fillStyle = INK;
    ink.beginPath();
    ink.arc(x, y, radius, 0, Math.PI * 2);
    ink.fill();
    this.stamps++;
    this.dirty = true;
  }

  /** Push layer changes to the GPU. Call once per frame. */
  flush(): void {
    if (!this.dirty) return;
    const c = this.composite;
    c.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
    c.save();
    c.clip(this.silhouette);
    c.drawImage(this.base.canvas, 0, 0);
    c.drawImage(this.irritation.canvas, 0, 0);
    c.drawImage(this.ink.canvas, 0, 0);
    c.restore();
    this.texture.needsUpdate = true;
    this.dirty = false;
  }

  /** Downsample the ink layer into a binary GRID x GRID mask. */
  inkMask(): Uint8Array {
    return toMask(this.ink.canvas);
  }

  /** Square crop of the composite around the design area, for the results screen. */
  snapshot(size = 260): HTMLCanvasElement {
    this.flush();
    const [out, ctx] = makeCanvas(size);
    const crop = DESIGN_HALF * 1.35;
    ctx.drawImage(this.composite.canvas, TEX_SIZE / 2 - crop, TEX_SIZE / 2 - crop, crop * 2, crop * 2, 0, 0, size, size);
    return out;
  }
}

/** Rasterize the reference design in the same canvas space as the ink, then reduce to a mask. */
export function targetMask(design: Design): Uint8Array {
  const [c, ctx] = makeCanvas();
  ctx.strokeStyle = '#000';
  renderDesign(ctx, design, TEX_SIZE / 2, TEX_SIZE / 2, DESIGN_HALF);
  return toMask(c);
}

function toMask(src: HTMLCanvasElement): Uint8Array {
  const [, small] = makeCanvas(GRID);
  small.imageSmoothingEnabled = true;
  small.imageSmoothingQuality = 'high';
  small.drawImage(src, 0, 0, GRID, GRID);
  const data = small.getImageData(0, 0, GRID, GRID).data;
  const mask = new Uint8Array(GRID * GRID);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 50 ? 1 : 0;
  return mask;
}

/** Reference card: design drawn over a little cartoon of the canvas so the player knows where it goes. */
export function drawReferenceCard(canvas: HTMLCanvasElement, design: Design, overlayOn?: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!;
  const S = canvas.width;
  ctx.clearRect(0, 0, S, S);
  if (overlayOn) {
    ctx.drawImage(overlayOn, 0, 0, S, S);
  } else {
    ctx.fillStyle = '#f6efe4';
    ctx.fillRect(0, 0, S, S);
    // Faint guide: crease + center dot.
    ctx.strokeStyle = '#d9c9b4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(S / 2, 0);
    ctx.lineTo(S / 2, S);
    ctx.stroke();
    ctx.fillStyle = '#b48d78';
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = overlayOn ? 'rgba(0, 220, 140, 0.85)' : '#1b1d2c';
  // Same framing as SkinPainter.snapshot: the design half-size is 1/1.35 of the crop half-size.
  renderDesign(ctx, design, S / 2, S / 2, S / 2 / 1.35);
}
