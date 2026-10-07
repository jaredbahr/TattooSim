/**
 * Procedural 32×32 pixel-art client portraits with live moods.
 * Displayed with `image-rendering: pixelated` so each pixel stays a chunky block.
 */
export type Sex = 'f' | 'm';
export type HairStyle =
  | 'bald' | 'mohawk' | 'mullet' | 'bun' | 'spiky' | 'afro' | 'combover'
  | 'long' | 'ponytail' | 'bob' | 'pigtails';
export type FacialHair = 'none' | 'beard' | 'stache' | 'goatee';
export type Mood =
  | 'calm' | 'nervous' | 'hurt' | 'agony'
  | 'thrilled' | 'happy' | 'meh' | 'mad' | 'devastated';

export interface Looks {
  sex: Sex;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  facial: FacialHair;
  glasses: boolean;
  shirt: string;
  /** Lipstick color (women), or null. */
  lips: string | null;
  earrings: boolean;
}

export const PORTRAIT_SIZE = 32;

const MOOD_BG: Record<Mood, string> = {
  calm: '#3a6f7a', nervous: '#7a6b3a', hurt: '#9a5a2a', agony: '#9a2a3a',
  thrilled: '#3a8a4f', happy: '#3a7a5a', meh: '#55506a', mad: '#8a2a2a', devastated: '#3a3f6a',
};

const HAIR_STYLES: Record<Sex, HairStyle[]> = {
  m: ['bald', 'mohawk', 'mullet', 'bun', 'spiky', 'afro', 'combover'],
  f: ['long', 'long', 'ponytail', 'ponytail', 'bob', 'bun', 'pigtails', 'afro', 'mohawk'],
};
const LIPSTICKS = ['#d0304a', '#e0567a', '#a8204a', '#c0406a', '#8a3a7a'];
const HAIR_COLORS = ['#2b1d14', '#5a3a1e', '#a8743a', '#e0c26a', '#d6d6d6', '#b8382a', '#5b2a86', '#1f8a6a'];
const FACIALS: FacialHair[] = ['none', 'none', 'beard', 'stache', 'goatee'];
const SHIRTS = ['#3d6fb6', '#b63d5a', '#3db66f', '#d4a72c', '#6b3db6', '#444', '#c25b2a'];

export function randomLooks(skin: string, sex: Sex = 'm', rand: () => number = Math.random): Looks {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
  return {
    sex,
    skin,
    hair: pick(HAIR_STYLES[sex]),
    hairColor: pick(HAIR_COLORS),
    facial: sex === 'm' ? pick(FACIALS) : 'none',
    glasses: rand() < 0.3,
    shirt: pick(SHIRTS),
    lips: sex === 'f' && rand() < 0.75 ? pick(LIPSTICKS) : null,
    earrings: sex === 'f' ? rand() < 0.6 : rand() < 0.1,
  };
}

function darker(hex: string, f = 0.75): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

export function drawPortrait(canvas: HTMLCanvasElement, looks: Looks, mood: Mood): void {
  canvas.width = canvas.height = PORTRAIT_SIZE;
  const ctx = canvas.getContext('2d')!;
  const px = (x: number, y: number, w = 1, h = 1, c?: string) => {
    if (c) ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const skinShade = darker(looks.skin, 0.8);
  const ink = '#1a1420';

  // Background + shirt + neck.
  px(0, 0, 32, 32, MOOD_BG[mood]);
  px(4, 28, 24, 4, looks.shirt);
  px(12, 25, 8, 4, skinShade);

  // Head with clipped corners, ears.
  px(9, 7, 14, 20, looks.skin);
  px(8, 9, 1, 15, looks.skin);
  px(23, 9, 1, 15, looks.skin);
  px(7, 15, 1, 4, skinShade);
  px(24, 15, 1, 4, skinShade);
  px(9, 26, 14, 1, skinShade);

  // Hair.
  const hc = looks.hairColor;
  switch (looks.hair) {
    case 'mohawk': px(14, 1, 4, 8, hc); break;
    case 'mullet': px(9, 5, 14, 4, hc); px(8, 8, 2, 4, hc); px(22, 8, 2, 4, hc); px(7, 18, 2, 9, hc); px(23, 18, 2, 9, hc); break;
    case 'bun': px(9, 5, 14, 4, hc); px(13, 1, 6, 4, hc); px(8, 8, 1, 5, hc); px(23, 8, 1, 5, hc); break;
    case 'spiky':
      px(9, 5, 14, 3, hc);
      for (let x = 9; x < 23; x += 3) px(x, 2, 2, 3, hc);
      break;
    case 'afro': px(5, 1, 22, 9, hc); px(4, 4, 2, 12, hc); px(26, 4, 2, 12, hc); break;
    case 'combover': px(9, 6, 14, 2, hc); px(15, 5, 8, 1, hc); px(9, 8, 4, 1, hc); break;
    case 'bald': px(13, 8, 4, 1, '#ffffff55'); break;
    case 'long': px(9, 5, 14, 4, hc); px(7, 7, 3, 21, hc); px(22, 7, 3, 21, hc); px(9, 8, 3, 3, hc); break;
    case 'bob': px(8, 5, 16, 5, hc); px(7, 8, 3, 15, hc); px(22, 8, 3, 15, hc); px(10, 9, 5, 2, hc); break;
    case 'ponytail': px(9, 5, 14, 4, hc); px(8, 8, 1, 4, hc); px(23, 8, 1, 4, hc); px(24, 6, 3, 3, hc); px(25, 9, 3, 10, hc); px(26, 19, 2, 3, hc); break;
    case 'pigtails': px(9, 5, 14, 4, hc); px(8, 8, 1, 3, hc); px(23, 8, 1, 3, hc); px(4, 9, 4, 3, hc); px(24, 9, 4, 3, hc); px(3, 12, 3, 8, hc); px(26, 12, 3, 8, hc); break;
  }

  // Eyebrows, angled by mood. Inner end = toward the nose.
  const brow = darker(looks.hair === 'bald' ? looks.skin : hc, looks.hair === 'bald' ? 0.6 : 1);
  const innerUp = mood === 'nervous' || mood === 'hurt' || mood === 'devastated' || mood === 'agony';
  const innerDown = mood === 'mad';
  px(10, 12, 4, 1, brow);
  px(18, 12, 4, 1, brow);
  if (innerUp) { px(13, 11, 1, 1, brow); px(18, 11, 1, 1, brow); px(10, 13, 1, 1, brow); px(21, 13, 1, 1, brow); }
  if (innerDown) { px(13, 13, 1, 1, brow); px(18, 13, 1, 1, brow); px(10, 11, 1, 1, brow); px(21, 11, 1, 1, brow); }

  // Eyes.
  if (mood === 'hurt' || mood === 'agony' || mood === 'thrilled') {
    // Squeezed shut: > <  (or happy ^ ^)
    const c = ink;
    if (mood === 'thrilled') {
      px(11, 15, 1, 1, c); px(12, 14, 1, 1, c); px(13, 15, 1, 1, c);
      px(18, 15, 1, 1, c); px(19, 14, 1, 1, c); px(20, 15, 1, 1, c);
    } else {
      px(11, 14, 1, 1, c); px(12, 15, 1, 1, c); px(11, 16, 1, 1, c);
      px(20, 14, 1, 1, c); px(19, 15, 1, 1, c); px(20, 16, 1, 1, c);
    }
  } else {
    const wide = mood === 'nervous';
    px(11, 14, 3, wide ? 3 : 2, '#ffffff');
    px(18, 14, 3, wide ? 3 : 2, '#ffffff');
    px(12, wide ? 15 : 14, 1, mood === 'meh' ? 1 : 2, ink);
    px(19, wide ? 15 : 14, 1, mood === 'meh' ? 1 : 2, ink);
    if (mood === 'meh') { px(11, 14, 3, 1, skinShade); px(18, 14, 3, 1, skinShade); }
  }

  // Lashes.
  if (looks.sex === 'f' && !(mood === 'hurt' || mood === 'agony' || mood === 'thrilled')) {
    px(10, 13, 1, 1, ink); px(14, 13, 1, 1, ink); px(17, 13, 1, 1, ink); px(21, 13, 1, 1, ink);
  }

  // Glasses.
  if (looks.glasses) {
    ctx.fillStyle = ink;
    for (const x of [10, 17]) {
      px(x, 13, 5, 1); px(x, 17, 5, 1); px(x, 13, 1, 5); px(x + 4, 13, 1, 5);
    }
    px(15, 14, 2, 1);
  }

  // Nose.
  px(15, 17, 2, 3, skinShade);

  // Facial hair (drawn before the mouth so the mouth stays readable).
  if (looks.facial === 'beard') { px(9, 20, 14, 6, hc); px(10, 26, 12, 2, hc); }
  if (looks.facial === 'stache') px(12, 20, 8, 1, hc);
  if (looks.facial === 'goatee') { px(14, 24, 4, 3, hc); px(12, 20, 8, 1, hc); }

  // Earrings.
  if (looks.earrings) { px(7, 19, 1, 2, '#f4e04d'); px(24, 19, 1, 2, '#f4e04d'); }

  // Mouth.
  const lip = looks.lips ?? '#7a2a2a';
  switch (mood) {
    case 'calm': px(13, 22, 6, 1, lip); break;
    case 'happy': px(12, 21, 1, 1, lip); px(13, 22, 6, 1, lip); px(19, 21, 1, 1, lip); break;
    case 'thrilled': px(12, 21, 8, 3, ink); px(13, 21, 6, 1, '#fff'); px(14, 23, 4, 1, '#d24a5a'); break;
    case 'nervous':
      for (let i = 0; i < 6; i++) px(13 + i, 22 + (i % 2), 1, 1, lip);
      break;
    case 'hurt': px(12, 21, 8, 3, ink); px(12, 22, 8, 1, '#fff'); px(14, 21, 1, 3, ink); px(17, 21, 1, 3, ink); break;
    case 'agony': px(13, 20, 6, 6, ink); px(14, 24, 4, 2, '#d24a5a'); break;
    case 'meh': px(13, 23, 2, 1, lip); px(15, 22, 4, 1, lip); break;
    case 'mad': px(12, 23, 1, 1, lip); px(13, 22, 6, 1, lip); px(19, 23, 1, 1, lip); break;
    case 'devastated': px(12, 23, 1, 1, lip); px(13, 22, 6, 1, lip); px(19, 23, 1, 1, lip); px(14, 22, 1, 1, '#000'); break;
  }

  // Sweat and tears.
  const water = '#7cc8ff';
  if (mood === 'nervous' || mood === 'hurt') { px(24, 9, 1, 1, water); px(23, 10, 3, 2, water); }
  if (mood === 'agony' || mood === 'devastated') { px(11, 17, 1, 6, water); px(20, 17, 1, 6, water); px(10, 22, 1, 2, water); px(21, 22, 1, 2, water); }
  if (mood === 'thrilled' || mood === 'happy') { px(10, 18, 2, 1, '#ff8a9a'); px(20, 18, 2, 1, '#ff8a9a'); }
  if (mood === 'mad') { px(25, 4, 1, 3, '#ff4a4a'); px(27, 5, 1, 3, '#ff4a4a'); px(24, 6, 3, 1, '#ff4a4a'); }
}

export function moodForPain(pain: number): Mood {
  if (pain < 0.25) return 'calm';
  if (pain < 0.55) return 'nervous';
  if (pain < 0.82) return 'hurt';
  return 'agony';
}

export function moodForScore(score: number): Mood {
  if (score >= 92) return 'thrilled';
  if (score >= 75) return 'happy';
  if (score >= 55) return 'meh';
  if (score >= 30) return 'mad';
  return 'devastated';
}
