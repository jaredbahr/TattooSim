/**
 * Shop upgrades, bought between days with the cash you earned. One-time purchases that
 * last for the rest of the run (a new game starts fresh).
 */
export type UpgradeId = 'numbing' | 'strap' | 'espresso' | 'stencil' | 'cushion';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  icon: string;
  price: number;
  /** What it does, in plain words. */
  effect: string;
  /** The joke. */
  blurb: string;
}

export const UPGRADES: Upgrade[] = [
  {
    id: 'numbing', name: 'Numbing Cream', icon: '🧴', price: 150,
    effect: 'Pain builds 35% slower.',
    blurb: 'Smells like pine and bad decisions.',
  },
  {
    id: 'strap', name: 'Bench Strap', icon: '🪢', price: 220,
    effect: 'Clients squirm 35% less.',
    blurb: 'Velcro. Clients sign a second waiver for it.',
  },
  {
    id: 'espresso', name: 'Espresso Machine', icon: '☕', price: 180,
    effect: '+8 seconds per client.',
    blurb: 'You work faster. Your hands are... mostly fine.',
  },
  {
    id: 'stencil', name: 'Stencil Transfer', icon: '🟪', price: 350,
    effect: 'A faint purple guide of the design on the skin.',
    blurb: 'Basically cheating. Our lawyer says it is fine.',
  },
  {
    id: 'cushion', name: 'Donut Cushion', icon: '🍩', price: 90,
    effect: 'Clients tip 15% more.',
    blurb: 'For the ride home. They appreciate it.',
  },
];

/** Tuning knobs the game reads; all neutral (1 / 0) when nothing is owned. */
export interface UpgradeEffects {
  painRate: number;
  squirm: number;
  bonusSeconds: number;
  stencil: boolean;
  tipMult: number;
}

export function effectsOf(owned: ReadonlySet<UpgradeId>): UpgradeEffects {
  return {
    painRate: owned.has('numbing') ? 0.65 : 1,
    squirm: owned.has('strap') ? 0.65 : 1,
    bonusSeconds: owned.has('espresso') ? 8 : 0,
    stencil: owned.has('stencil'),
    tipMult: owned.has('cushion') ? 1.15 : 1,
  };
}
