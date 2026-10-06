/**
 * Customer generation: who walks in, what they want, and how badly they'll squirm.
 */
import { DESIGNS, type Design } from './designs';

export interface Customer {
  name: string;
  avatar: string;
  design: Design;
  /** What they say when they walk in. */
  request: string;
  /** Hex skin tone used for the base texture. */
  skin: string;
  /** 0..1, amount of body hair the artist has to work around. */
  hairiness: number;
  /** 0..1, how much they wiggle at rest. */
  squirm: number;
  /** 0..1, how fast pain builds while inking. Higher = more flinching. */
  sensitivity: number;
  /** Multiplier on the tip they leave. */
  generosity: number;
  trait: string;
}

const NAMES = [
  'Gary', 'Brenda', 'Big Steve', 'Tammy', 'Doug', 'Kyle', 'Linda', 'Chad',
  'Deb', 'Randy', 'Crystal', 'Earl', 'Marge', 'Todd', 'Becky', 'Vince',
  'Pam', 'Duane', 'Sheila', 'Lance', 'Gloria', 'Rusty', 'Darlene', 'Moose',
];

const AVATARS = ['🧔', '👩‍🦰', '👨‍🦲', '👵', '🧑‍🎤', '🤠', '👩‍🦳', '🧑‍🔧', '🕺', '👨‍🍳', '🧙', '🦹'];

const SKINS = ['#f5d0b5', '#eabf9f', '#d9a27e', '#c68a62', '#a86f4c', '#8a5537', '#6b3f28', '#f2c4c4'];

const OPENERS = [
  'Lost a bet. Make it a {d}.',
  "My ex said I'd never get a {d} back there. Prove her wrong.",
  'Bachelor party. Do not ask. Just a {d}.',
  "I want a {d}. It's for my doctor. He'll know.",
  "Fortune cookie said 'great things come from behind.' {D}, please.",
  "It's my 50th. I've earned a {d}.",
  "Proctologist dared me. One {d}, extra crispy.",
  "I'm a private person. That's why I want a {d} in the most private place.",
  "Honestly? I just want my cheeks to have a {d}. Is that weird?",
  "My grandma had a {d} there. Family tradition.",
  'Saw it on TikTok. {D}. Go.',
  "I'm sitting on a secret. Make it a {d}.",
];

const TRAITS: { label: string; squirm: number; sensitivity: number; generosity: number; hair: number }[] = [
  { label: 'Calm as a cucumber', squirm: 0.15, sensitivity: 0.3, generosity: 1.0, hair: 0.1 },
  { label: 'Ticklish', squirm: 0.55, sensitivity: 0.6, generosity: 1.1, hair: 0.1 },
  { label: 'Big baby', squirm: 0.35, sensitivity: 1.0, generosity: 0.9, hair: 0.2 },
  { label: 'Hairy', squirm: 0.25, sensitivity: 0.4, generosity: 1.0, hair: 0.9 },
  { label: 'Too much coffee', squirm: 0.85, sensitivity: 0.5, generosity: 1.2, hair: 0.3 },
  { label: 'Big tipper', squirm: 0.3, sensitivity: 0.5, generosity: 1.8, hair: 0.3 },
  { label: 'Cheapskate', squirm: 0.3, sensitivity: 0.5, generosity: 0.5, hair: 0.4 },
  { label: 'Ex-Marine', squirm: 0.05, sensitivity: 0.15, generosity: 1.0, hair: 0.5 },
];

function pick<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function fillTemplate(t: string, design: Design): string {
  const lower = design.name.toLowerCase();
  const upper = lower.charAt(0).toUpperCase() + lower.slice(1);
  return t.replaceAll('{d}', lower).replaceAll('{D}', upper);
}

/**
 * Build one customer. `day` raises the baseline squirm so later days get harder.
 * `avoid` lets the day planner skip designs already used today.
 */
export function makeCustomer(day: number, rand: () => number = Math.random, avoid: string[] = []): Customer {
  const pool = DESIGNS.filter((d) => !avoid.includes(d.id));
  const design = pick(pool.length ? pool : DESIGNS, rand);
  const trait = pick(TRAITS, rand);
  const dayPressure = Math.min(0.35, (day - 1) * 0.07);
  return {
    name: pick(NAMES, rand),
    avatar: pick(AVATARS, rand),
    design,
    request: fillTemplate(pick(OPENERS, rand), design),
    skin: pick(SKINS, rand),
    hairiness: trait.hair,
    squirm: Math.min(1, trait.squirm + dayPressure),
    sensitivity: trait.sensitivity,
    generosity: trait.generosity,
    trait: trait.label,
  };
}

export function reactionFor(score: number, c: Customer): string {
  const d = c.design.name.toLowerCase();
  if (score >= 92) return pick([
    `*sobbing* It's the most beautiful ${d} I've ever had back there.`,
    `I'm going to show this to EVERYONE. Mom included.`,
    `Five stars. I'd sit for you again. Well, not sit. You know.`,
  ], Math.random);
  if (score >= 80) return pick([
    `Oh that's a solid ${d}. My cheeks have never looked so cultured.`,
    `Nice! A little wobbly, but so am I.`,
    `Yeah that's a ${d}. I'm telling my proctologist.`,
  ], Math.random);
  if (score >= 65) return pick([
    `It's... ${d}-adjacent. I'll take it.`,
    `If I squint in the mirror, yeah. A ${d}.`,
    `Honestly, nobody's gonna get a good look anyway.`,
  ], Math.random);
  if (score >= 50) return pick([
    `Is that a ${d}? It looks like a weather map.`,
    `My wife says it looks like a ${d} that got hit by a bus.`,
    `I asked for a ${d}. This is a cry for help.`,
  ], Math.random);
  if (score >= 30) return pick([
    `What... what IS that?`,
    `I'm going to have to move to a new state.`,
    `That's not a ${d}. That's a crime scene.`,
  ], Math.random);
  return pick([
    `I'm calling my lawyer. And my priest.`,
    `You drew a CRY FOR HELP on my BUTT.`,
    `There is nothing there but regret and ink.`,
  ], Math.random);
}

export function reviewFor(score: number, c: Customer): string {
  const stars = score >= 92 ? 5 : score >= 80 ? 4 : score >= 65 ? 3 : score >= 40 ? 2 : 1;
  const body = [
    '',
    `"Ruined my life and my ${c.design.name.toLowerCase()}. Bathroom was clean though."`,
    `"Not great. Sitting down is now a deeply emotional experience."`,
    `"Decent work. Artist did not make eye contact, which I appreciated."`,
    `"Great vibes, steady hands. Would bend over again."`,
    `"A MASTERPIECE. The Louvre should be calling. They won't, but they should."`,
  ][stars];
  return `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} ${c.name}: ${body}`;
}
