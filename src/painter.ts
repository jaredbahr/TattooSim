/**
 * Skin canvas + ink painting.
 *
 * Three layers are composited into one CanvasTexture that the butt mesh uses as its map:
 *   base  - skin tone, mottling, hair, and the... landmark
 *   irritation - fresh-tattoo redness that spreads around the ink
 *   ink   - what the player actually drew (the only layer that gets scored)
 *
 * Everything lives in UV space: canvas (0,0) is the top-left of the mesh's UV square,
 * and the hole (and every design) is centered on (0.5, 0.5).
 *
 * Art direction: the skin layer is pixelated to SKIN_PIXELS to match the low-res world,
 * but the ink is kept at full resolution so linework stays readable.
 */
import * as THREE from 'three';
import { renderDesign } from './designs';
import type { Customer } from './customers';
import type { JobSpec } from './jobs';

export const TEX_SIZE = 1024;
/** Scoring grid resolution covering the job's crop square. */
export const GRID = 128;
/** The skin is drawn smooth, then crunched to this resolution for the PS1 pixel look. Ink stays full-res. */
const SKIN_PIXELS = 160;
/** Finer pixel grid for the hole and hair. */
const DETAIL_PIXELS = 384;

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
export function silhouettePath(): Path2D {
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

/** Downsample a TEX_SIZE canvas to `pixels` and blow it back up with hard edges. */
function pixelateInPlace(ctx: CanvasRenderingContext2D, pixels: number): void {
  const [, small] = makeCanvas(pixels);
  small.drawImage(ctx.canvas, 0, 0, pixels, pixels);
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small.canvas, 0, 0, TEX_SIZE, TEX_SIZE);
  ctx.imageSmoothingEnabled = true;
}

function mixHex(a: string, b: string, t: number): string {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
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
  /** Purple stencil guide (Stencil Transfer upgrade). Visual only, never scored. */
  private readonly stencil: CanvasRenderingContext2D;
  private readonly detail: CanvasRenderingContext2D;
  private readonly silhouette = silhouettePath();
  /** Opaque everywhere except the silhouette; used to cast the rim shadow. */
  private readonly outside: HTMLCanvasElement;
  private dirty = true;
  private last: { x: number; y: number } | null = null;

  constructor() {
    const [compCanvas, comp] = makeCanvas();
    this.composite = comp;
    this.base = makeCanvas()[1];
    this.irritation = makeCanvas()[1];
    this.ink = makeCanvas()[1];
    this.stencil = makeCanvas()[1];
    this.detail = makeCanvas()[1];
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

    // Darken the rim so the cut-out edge reads as skin curving away, not a paper edge.
    // Inner-shadow trick: draw everything *outside* the silhouette (clipped away) and let
    // only its blurred shadow bleed inward. Stroking the path would also stroke the
    // overlapping interior outlines of the cheeks.
    b.shadowColor = shade(c.skin, -0.4) + 'aa';
    b.shadowBlur = 40;
    b.drawImage(this.outside, 0, 0);
    b.restore();

    // Crunch to chunky pixels.
    pixelateInPlace(b, SKIN_PIXELS);

    // Detail layer (the hole and the hair) gets a finer pixel grid so it still reads
    // in the close-up: it's the star of the show.
    const d = this.detail;
    d.clearRect(0, 0, S, S);
    // The landmark. Bold and cartoony so it reads even in the wide shot: a dark core,
    // a mauve pucker ring, and thick radiating wrinkles.
    const spot = d.createRadialGradient(mid, mid, 0, mid, mid, 34);
    spot.addColorStop(0, shade(c.skin, -0.92));
    spot.addColorStop(0.3, shade(c.skin, -0.7));
    spot.addColorStop(0.65, mixHex(shade(c.skin, -0.35), '#b0607a', 0.35));
    spot.addColorStop(1, shade(c.skin, -0.2) + '00');
    d.fillStyle = spot;
    d.beginPath();
    d.arc(mid, mid, 34, 0, Math.PI * 2);
    d.fill();
    d.strokeStyle = shade(c.skin, -0.8);
    d.lineCap = 'round';
    d.lineWidth = 3.5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.15;
      const r0 = 3;
      const r1 = 15 + Math.random() * 8;
      d.beginPath();
      d.moveTo(mid + Math.cos(a) * r0, mid + Math.sin(a) * r0);
      d.quadraticCurveTo(
        mid + Math.cos(a + 0.18) * (r0 + r1) * 0.5,
        mid + Math.sin(a + 0.18) * (r0 + r1) * 0.5,
        mid + Math.cos(a) * r1,
        mid + Math.sin(a) * r1,
      );
      d.stroke();
    }
    d.fillStyle = '#120a0a';
    d.beginPath();
    d.arc(mid, mid, 4.5, 0, Math.PI * 2);
    d.fill();

    // Hair, concentrated toward the middle (as nature intended).
    const hairs = Math.floor(c.hairiness * 500);
    d.strokeStyle = '#2b1d14cc';
    d.lineWidth = 2.6;
    for (let i = 0; i < hairs; i++) {
      const spread = 80 + Math.random() * 300;
      const x = mid + (Math.random() - 0.5) * spread * 1.2;
      const y = mid + (Math.random() - 0.5) * spread * 2;
      const a = Math.random() * Math.PI * 2;
      const len = 6 + Math.random() * 12;
      d.beginPath();
      d.moveTo(x, y);
      d.quadraticCurveTo(x + Math.cos(a + 0.8) * len * 0.6, y + Math.sin(a + 0.8) * len * 0.6, x + Math.cos(a) * len, y + Math.sin(a) * len);
      d.stroke();
    }

    pixelateInPlace(d, DETAIL_PIXELS);
    b.save();
    b.clip(this.silhouette);
    b.drawImage(d.canvas, 0, 0);
    b.restore();

    this.irritation.clearRect(0, 0, S, S);
    this.ink.clearRect(0, 0, S, S);
    this.stencil.clearRect(0, 0, S, S);
    this.last = null;
    this.dirty = true;
  }

  /** Show (or clear, with null) a faint purple guide of the client's design. */
  setStencil(c: Customer | null): void {
    const st = this.stencil;
    st.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
    if (c && !c.surprise) {
      st.strokeStyle = 'rgba(120, 60, 200, 0.45)';
      renderDesign(st, c.design, TEX_SIZE / 2, TEX_SIZE / 2, c.job.half, c.job.lineWidthPx * 0.6, 'rgba(120, 60, 200, 0.18)');
    }
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
    // Only a huge jump is a glitch (e.g. a flinch lurch); leaving the skin already lifts the
    // stroke. Fast swipes on slow phones can legitimately cover ~1/4 of the canvas per frame.
    if (dist > TEX_SIZE * 0.3) {
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
    c.drawImage(this.stencil.canvas, 0, 0);
    c.drawImage(this.irritation.canvas, 0, 0);
    c.drawImage(this.ink.canvas, 0, 0);
    c.restore();
    this.texture.needsUpdate = true;
    this.dirty = false;
  }

  /**
   * The player's ink as a GRID×GRID mask over the job's crop square, plus how much ink
   * (in grid cells) landed outside the crop where it can only count against them.
   */
  /** Copy of the ink layer, kept so a botched client can come back with it. */
  exportInk(): HTMLCanvasElement {
    const [c, ctx] = makeCanvas();
    ctx.drawImage(this.ink.canvas, 0, 0);
    return c;
  }

  /** Start this client's skin with existing ink (a returning cover-up client). */
  loadInk(src: HTMLCanvasElement): void {
    this.ink.drawImage(src, 0, 0);
    this.dirty = true;
  }

  inkMask(job: JobSpec): { mask: Uint8Array; stray: number } {
    const mask = toMask(this.ink.canvas, job.cropHalf);
    // Stray ink: sample the whole canvas coarsely and count samples outside the crop.
    const N = 256;
    const step = TEX_SIZE / N;
    const [, small] = makeCanvas(N);
    small.drawImage(this.ink.canvas, 0, 0, N, N);
    const data = small.getImageData(0, 0, N, N).data;
    const lo = TEX_SIZE / 2 - job.cropHalf;
    const hi = TEX_SIZE / 2 + job.cropHalf;
    let strayPx = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (data[(y * N + x) * 4 + 3] <= 50) continue;
        const cx = (x + 0.5) * step;
        const cy = (y + 0.5) * step;
        if (cx < lo || cx > hi || cy < lo || cy > hi) strayPx += step * step;
      }
    }
    const cellPx = (job.cropHalf * 2) / GRID;
    return { mask, stray: strayPx / (cellPx * cellPx) };
  }

  /** Square crop of the composite around the job's area, for the results screen. */
  snapshot(job: JobSpec, size = 260): HTMLCanvasElement {
    this.flush();
    const [out, ctx] = makeCanvas(size);
    ctx.fillStyle = '#1c1424';
    ctx.fillRect(0, 0, size, size);
    const c = job.cropHalf;
    ctx.drawImage(this.composite.canvas, TEX_SIZE / 2 - c, TEX_SIZE / 2 - c, c * 2, c * 2, 0, 0, size, size);
    return out;
  }

  /** Same outline the mesh is cut to, for drawing guides. */
  get outline(): Path2D {
    return this.silhouette;
  }
}

/**
 * Scoring tolerance in grid cells: about 0.6 of a design line-width of slop. At a full
 * line-width a scribbled blob near the design still read as "95% accurate".
 */
export function toleranceFor(job: JobSpec): number {
  const cellPx = (job.cropHalf * 2) / GRID;
  return Math.max(1, Math.round((0.6 * job.lineWidthPx) / cellPx));
}

/** Rasterize the reference design in the same canvas space as the ink, then reduce to a mask. */
export function targetMask(c: Customer): Uint8Array {
  const [canvas, ctx] = makeCanvas();
  ctx.strokeStyle = '#000';
  renderDesign(ctx, c.design, TEX_SIZE / 2, TEX_SIZE / 2, c.job.half, c.job.lineWidthPx);
  return toMask(canvas, c.job.cropHalf);
}

function toMask(src: HTMLCanvasElement, cropHalf: number): Uint8Array {
  const [, small] = makeCanvas(GRID);
  small.imageSmoothingEnabled = true;
  small.imageSmoothingQuality = 'high';
  const o = TEX_SIZE / 2 - cropHalf;
  small.drawImage(src, o, o, cropHalf * 2, cropHalf * 2, 0, 0, GRID, GRID);
  const data = small.getImageData(0, 0, GRID, GRID).data;
  const mask = new Uint8Array(GRID * GRID);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 50 ? 1 : 0;
  return mask;
}

/**
 * Reference card: the design over a little diagram of the job area (silhouette, crease,
 * hole) so the player knows where it goes. With `overlayOn`, draws the design in green
 * over the player's actual result instead.
 */
export function drawReferenceCard(
  canvas: HTMLCanvasElement,
  c: Customer,
  outline: Path2D,
  overlayOn?: HTMLCanvasElement,
): void {
  const ctx = canvas.getContext('2d')!;
  const S = canvas.width;
  const k = S / (c.job.cropHalf * 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, S, S);
  if (overlayOn) {
    ctx.drawImage(overlayOn, 0, 0, S, S);
  } else {
    ctx.fillStyle = '#3a2c40';
    ctx.fillRect(0, 0, S, S);
  }
  // Map skin-canvas px to card px.
  ctx.setTransform(k, 0, 0, k, S / 2 - (TEX_SIZE / 2) * k, S / 2 - (TEX_SIZE / 2) * k);
  if (!overlayOn) {
    ctx.fillStyle = '#f6efe4';
    ctx.fill(outline);
    ctx.strokeStyle = '#d9c9b4';
    ctx.lineWidth = 2 / k;
    ctx.beginPath();
    ctx.moveTo(TEX_SIZE / 2, 150);
    ctx.lineTo(TEX_SIZE / 2, 760);
    ctx.stroke();
    ctx.fillStyle = '#b48d78';
    ctx.beginPath();
    ctx.arc(TEX_SIZE / 2, TEX_SIZE / 2, Math.max(10, 3 / k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = overlayOn ? 'rgba(0, 220, 140, 0.85)' : '#1b1d2c';
  const fill = overlayOn ? 'rgba(0, 220, 140, 0.45)' : '#1b1d2c';
  renderDesign(ctx, c.design, TEX_SIZE / 2, TEX_SIZE / 2, c.job.half, c.job.lineWidthPx, fill);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
