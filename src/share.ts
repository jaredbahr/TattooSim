/**
 * Shareable result card: a 1080×1350 PNG (Instagram portrait size) with the logo, the
 * client, your work next to the request, and the grade. On phones it opens the native
 * share sheet; elsewhere it downloads.
 */
import { makeLogoScaled } from './logo';
import { drawPortrait, moodForScore } from './portrait';
import type { Customer } from './customers';
import type { ScoreBreakdown } from './scoring';

const W = 1080;
const H = 1350;

const GRADE_COLORS: Record<string, string> = {
  S: '#f4e04d', A: '#2fd58a', B: '#7cc8ff', C: '#f2a33a', D: '#ff5a5a', F: '#ff5a5a',
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface ShareInput {
  customer: Customer;
  score: ScoreBreakdown;
  quote: string;
  yourWork: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
}

export function buildShareCard(r: ShareInput): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#1c1424';
  ctx.fillRect(0, 0, W, H);
  // Scanlines, for the vibe.
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 3);

  const logo = makeLogoScaled(10);
  ctx.drawImage(logo, (W - logo.width) / 2, 40);

  // Client row.
  const portrait = document.createElement('canvas');
  drawPortrait(portrait, r.customer.looks, moodForScore(r.score.score));
  const py = 300;
  ctx.drawImage(portrait, 70, py, 160, 160);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 6;
  ctx.strokeRect(70, py, 160, 160);
  ctx.fillStyle = '#f6eef7';
  ctx.font = 'bold 56px "Trebuchet MS", sans-serif';
  ctx.fillText(r.customer.name, 260, py + 62);
  ctx.fillStyle = '#b7a8bd';
  ctx.font = '36px "Trebuchet MS", sans-serif';
  ctx.fillText(`${r.customer.design.name} · ${r.customer.job.label}`, 260, py + 116);

  // Quote bubble.
  ctx.font = 'bold 38px "Trebuchet MS", sans-serif';
  const lines = wrap(ctx, `"${r.quote}"`, W - 200);
  const qy = py + 200;
  const qh = 40 + lines.length * 50;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(70, qy, W - 140, qh, 28);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  lines.forEach((l, i) => ctx.fillText(l, 100, qy + 62 + i * 50));

  // Side-by-side.
  // Images fill whatever room the quote leaves above the fixed grade block at the bottom.
  const iy = qy + qh + 40;
  const gradeTop = H - 220;
  const size = Math.min(450, gradeTop - iy - 70);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(r.yourWork, 70, iy, size, size);
  ctx.drawImage(r.overlay, W - 70 - size, iy, size, size);
  ctx.fillStyle = '#b7a8bd';
  ctx.font = '30px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MY WORK', 70 + size / 2, iy + size + 42);
  ctx.fillText('THE REQUEST', W - 70 - size / 2, iy + size + 42);

  // Grade + score.
  const gy = H - 70;
  ctx.textAlign = 'left';
  ctx.fillStyle = GRADE_COLORS[r.score.grade] ?? '#fff';
  ctx.font = 'bold 150px Impact, "Arial Black", sans-serif';
  ctx.fillText(r.score.grade, 70, gy);
  ctx.fillStyle = '#f6eef7';
  ctx.font = 'bold 64px "Trebuchet MS", sans-serif';
  ctx.fillText(`${r.score.score}% likeness`, 230, gy - 50);
  ctx.fillStyle = '#b7a8bd';
  ctx.font = '30px "Trebuchet MS", sans-serif';
  ctx.fillText(location.host ? `Ink your own: ${location.host}${location.pathname}` : 'Cheeky Business', 230, gy);
  return c;
}

/** Native share sheet with the PNG where supported, otherwise a download. */
export async function shareCard(card: HTMLCanvasElement, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await new Promise<Blob | null>((res) => card.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Could not render the share card');
  const filename = `cheeky-business-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Cheeky Business', text: 'Look what I tattooed.' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // Fall through to download on any other failure.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
