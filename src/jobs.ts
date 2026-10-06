/**
 * Job types. Every client wants one of these, and the job decides how big the design is,
 * where the camera starts, how strict the scoring is, and what it pays.
 *
 * All sizes are in skin-canvas pixels (the canvas is TEX_SIZE square, hole at the center).
 */
export type JobKind = 'hole' | 'cheek' | 'moon';

export interface JobSpec {
  kind: JobKind;
  label: string;
  blurb: string;
  /** Half-size of the design's unit box. */
  half: number;
  /** Stroke width of the design lines. */
  lineWidthPx: number;
  /** Half-size of the square region that gets scored and shown on the cards. */
  cropHalf: number;
  /** Camera framing when the job starts. The player can toggle zoom either way. */
  zoom: 'close' | 'wide';
  payMult: number;
  /** Extra seconds on the clock. */
  timeBonus: number;
}

export const JOBS: Record<JobKind, JobSpec> = {
  hole: {
    kind: 'hole',
    label: 'Hole Job',
    blurb: 'Close-up work. Small design, built around the hole. Mind the pucker.',
    half: 88,
    lineWidthPx: 9,
    cropHalf: 128,
    zoom: 'close',
    payMult: 1.2,
    timeBonus: 0,
  },
  cheek: {
    kind: 'cheek',
    label: 'Cheek Job',
    blurb: 'Big piece across both cheeks. Coverage matters.',
    half: 360,
    lineWidthPx: 16,
    cropHalf: 470,
    zoom: 'wide',
    payMult: 1.0,
    timeBonus: 0,
  },
  moon: {
    kind: 'moon',
    label: 'Full Moon',
    blurb: 'The works: cheeks AND hole. Zoom in for the detail work.',
    half: 360,
    lineWidthPx: 12,
    cropHalf: 470,
    zoom: 'wide',
    payMult: 1.7,
    timeBonus: 15,
  },
};
