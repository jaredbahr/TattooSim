/**
 * Customer generation: who waddles in, what they want, and how badly they'll squirm.
 */
import { designsFor, type Design } from './designs';
import { JOBS, type JobKind, type JobSpec } from './jobs';
import { randomLooks, type Looks, type Sex } from './portrait';
import { ShuffleBag } from './humor';

export interface Customer {
  name: string;
  sex: Sex;
  /** Rear proportions: width and depth multipliers around 1. */
  body: { width: number; depth: number };
  looks: Looks;
  job: JobSpec;
  design: Design;
  /** What they say when they walk in. */
  request: string;
  /** Hex skin tone used for the body and the skin canvas. */
  skin: string;
  /** 0..1, amount of body hair the artist has to work around. */
  hairiness: number;
  /** 0..1, how much they wiggle at rest. */
  squirm: number;
  /** 0..1, how fast pain builds while inking. Higher = more flinching. */
  sensitivity: number;
  /** 0..1, how often the hole puckers and winks. */
  puckeriness: number;
  /** Multiplier on the tip they leave. */
  generosity: number;
  trait: string;
}

const NAMES: Record<Sex, string[]> = {
  m: ['Gary', 'Big Steve', 'Doug', 'Kyle', 'Chad', 'Randy', 'Earl', 'Todd', 'Vince', 'Duane', 'Lance', 'Rusty', 'Moose', 'Dale'],
  f: ['Brenda', 'Tammy', 'Linda', 'Deb', 'Crystal', 'Marge', 'Becky', 'Pam', 'Sheila', 'Gloria', 'Darlene', 'Rhonda', 'Trish', 'Jolene', 'Bev', 'Doreen'],
};
/** Words that change with the client: {ex} = their ex, {partner}, {party}. */
const WORDS: Record<Sex, Record<string, string>> = {
  m: { ex: 'her', partner: 'wife', party: 'Bachelor party' },
  f: { ex: 'him', partner: 'husband', party: 'Bachelorette party' },
};

const SKINS = ['#f5d0b5', '#eabf9f', '#d9a27e', '#c68a62', '#a86f4c', '#8a5537', '#6b3f28', '#f2c4c4'];

const OPENERS: Record<JobKind | 'any', string[]> = {
  any: [
    'Lost a bet. Make it a {d}.',
    '{party}. Do not ask. Just a {d}.',
    "Fortune cookie said 'great things come from behind.' {D}, please.",
    "It's my 50th. I've earned a {d}.",
    'Saw it on TikTok. {D}. Go.',
    "My grandma had a {d} back there. Family tradition.",
    'My therapist said to try new things. {D}.',
    "I'm getting divorced. {D}. Make it count.",
    "It's for a bet with my {partner}. Loser gets a {d}. I lost.",
    'Cheaper than therapy. {D}, please.',
    'I want to be buried with a {d}. Getting a head start.',
  ],
  hole: [
    "Right on the bullseye, chief. I want a {d}.",
    "Proctologist dared me. One {d}, right on the ring.",
    "I'm a private person. That's why I want a {d} in the MOST private place.",
    "Small {d}. Dead center. My doctor will know what it means.",
    "Ring of fire needs some decoration. {D}.",
    "Put a {d} right on the bullseye. Doctor's orders. Not really.",
    'Tiny {d}. Right on the button.',
    'Something for my spray-tan lady to look at. {D}.',
  ],
  cheek: [
    "Go big. {D}. Both cheeks. Make it majestic.",
    "My ex said I'd never get a {d} on my butt. Prove {ex} wrong.",
    "I want people at the beach to SEE this {d}.",
    "Full canvas, baby. {D}. Spread it out.",
    'Use the whole real estate. {D}.',
    'Make it big enough to see from space. {D}.',
  ],
  moon: [
    "The whole moon, man. {D}. Cheeks AND center.",
    "I want the {d}. Don't skip the fiddly bit in the middle.",
    "Spare no expense. Spare no cheek. {D}.",
    'Go big AND go small. {D}. You know what I mean.',
  ],
};

const TRAITS: { label: string; squirm: number; sensitivity: number; pucker: number; generosity: number; hair: number }[] = [
  { label: 'Calm as a cucumber', squirm: 0.15, sensitivity: 0.3, pucker: 0.2, generosity: 1.0, hair: 0.1 },
  { label: 'Ticklish', squirm: 0.55, sensitivity: 0.6, pucker: 0.6, generosity: 1.1, hair: 0.1 },
  { label: 'Big baby', squirm: 0.35, sensitivity: 1.0, pucker: 0.7, generosity: 0.9, hair: 0.2 },
  { label: 'Hairy', squirm: 0.25, sensitivity: 0.4, pucker: 0.3, generosity: 1.0, hair: 0.9 },
  { label: 'Too much coffee', squirm: 0.85, sensitivity: 0.5, pucker: 0.5, generosity: 1.2, hair: 0.3 },
  { label: 'Nervous winker', squirm: 0.25, sensitivity: 0.5, pucker: 1.0, generosity: 1.0, hair: 0.3 },
  { label: 'Big tipper', squirm: 0.3, sensitivity: 0.5, pucker: 0.4, generosity: 1.8, hair: 0.3 },
  { label: 'Cheapskate', squirm: 0.3, sensitivity: 0.5, pucker: 0.4, generosity: 0.5, hair: 0.4 },
  { label: 'Ex-Marine', squirm: 0.05, sensitivity: 0.15, pucker: 0.1, generosity: 1.0, hair: 0.5 },
];

function pick<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function fillTemplate(t: string, design: Design, sex: Sex): string {
  const lower = design.name.toLowerCase();
  const upper = design.name.charAt(0).toUpperCase() + design.name.slice(1);
  let out = t.replaceAll('{d}', lower).replaceAll('{D}', upper);
  for (const [k, v] of Object.entries(WORDS[sex])) out = out.replaceAll(`{${k}}`, v);
  return out;
}

/** Full Moon jobs get more common as the days go on. */
export function pickJob(day: number, rand: () => number = Math.random): JobKind {
  const moonChance = Math.min(0.4, 0.1 + (day - 1) * 0.08);
  const r = rand();
  if (r < moonChance) return 'moon';
  return r < moonChance + (1 - moonChance) / 2 ? 'hole' : 'cheek';
}

export interface CustomerOptions {
  /** Force a job type (Demo Day, tutorial). */
  job?: JobKind;
  /** Force a trait by label, e.g. 'Calm as a cucumber'. */
  trait?: string;
  /** Force a design by id. */
  design?: string;
  sex?: Sex;
  /** Names already used today, so a day never has two Darlenes. */
  avoidNames?: string[];
}

/**
 * Build one customer. `day` raises the baseline squirm so later days get harder.
 * `avoid` lets the day planner skip designs already used today.
 */
export function makeCustomer(
  day: number,
  rand: () => number = Math.random,
  avoid: string[] = [],
  opts: CustomerOptions = {},
): Customer {
  const kind = opts.job ?? pickJob(day, rand);
  const all = designsFor(kind);
  const pool = all.filter((d) => !avoid.includes(d.id));
  const design = all.find((d) => d.id === opts.design) ?? pick(pool.length ? pool : all, rand);
  const trait = TRAITS.find((t) => t.label === opts.trait) ?? pick(TRAITS, rand);
  const skin = pick(SKINS, rand);
  const dayPressure = Math.min(0.35, (day - 1) * 0.07);
  const openers = rand() < 0.6 ? OPENERS[kind] : OPENERS.any;
  const sex: Sex = opts.sex ?? (rand() < 0.5 ? 'f' : 'm');
  // Rears come in all shapes. Women skew a little wider and rounder on average.
  const width = 0.92 + rand() * 0.16 + (sex === 'f' ? 0.04 : 0);
  const depth = 0.85 + rand() * 0.35 + (sex === 'f' ? 0.05 : 0);
  return {
    name: pick(NAMES[sex].filter((n) => !opts.avoidNames?.includes(n)), rand) ?? pick(NAMES[sex], rand),
    sex,
    body: { width, depth },
    looks: randomLooks(skin, sex, rand),
    job: JOBS[kind],
    design,
    request: fillTemplate(pick(openers, rand), design, sex),
    skin,
    hairiness: sex === 'f' ? trait.hair * 0.4 : trait.hair,
    squirm: Math.min(1, trait.squirm + dayPressure),
    sensitivity: trait.sensitivity,
    puckeriness: Math.min(1, trait.pucker + dayPressure * 0.5),
    generosity: trait.generosity,
    trait: trait.label,
  };
}

/** Mirror reactions by grade tier. Tokens: {d} design, {partner}, {ex}. */
const REACTIONS: Record<'S' | 'A' | 'B' | 'C' | 'D' | 'F', string[]> = {
  S: [
    "*sobbing* It's the most beautiful {d} I've ever had back there.",
    "I'm going to show this to EVERYONE. Mom included.",
    "Five stars. I'd sit for you again. Well, not sit. You know.",
    'I am going to start wearing assless chaps. For the art.',
    'My {partner} is going to be SO confused. And proud.',
    'This is the best thing that has ever happened to my butt. And I once sat on a heated seat in a Lexus.',
  ],
  A: [
    "Oh that's a solid {d}. My butt has never looked so cultured.",
    'Nice! A little wobbly, but so am I.',
    "Yeah that's a {d}. I'm telling my proctologist.",
    'Wow. I feel like a museum.',
    'Clean lines. Unlike me.',
    "That's going on the family Christmas card.",
  ],
  B: [
    "It's... {d}-adjacent. I'll take it.",
    'If I squint in the mirror, yeah. A {d}.',
    "Honestly, nobody's gonna get a good look anyway.",
    "It's got character. Like my uncle.",
    "Good enough. I'm not paying for a second opinion.",
    'From across the room this is fantastic.',
  ],
  C: [
    'Is that a {d}? It looks like a weather map.',
    'My {partner} says it looks like a {d} that got hit by a bus.',
    'I asked for a {d}. This is a cry for help.',
    'It looks like a {d} described over the phone.',
    'I think it looks better upside down. Which is how people will see it.',
    'Did you draw this with your other hand?',
  ],
  D: [
    'What... what IS that?',
    "I'm going to have to move to a new state.",
    "That's not a {d}. That's a crime scene.",
    "That's not a tattoo, that's a Rorschach test.",
    'My dog would have done better. My dog is dead.',
    'I see a {d}. Wait, no. A sad potato.',
  ],
  F: [
    "I'm calling my lawyer. And my priest.",
    'You drew a CRY FOR HELP on my BUTT.',
    'There is nothing back there but regret and ink.',
    "I'm going to need you to sign this NDA.",
    'Is this... is this a hate crime?',
    "My {ex} was right about me. And about you.",
  ],
};

const reactionBags = new Map<string, ShuffleBag<string>>();
function nextFrom(map: Map<string, ShuffleBag<string>>, key: string, pool: readonly string[]): string {
  let bag = map.get(key);
  if (!bag) {
    bag = new ShuffleBag(pool);
    map.set(key, bag);
  }
  return bag.next();
}

function fillTokens(t: string, c: Customer): string {
  let out = t.replaceAll('{d}', c.design.name.toLowerCase());
  for (const [k, v] of Object.entries(WORDS[c.sex])) out = out.replaceAll(`{${k}}`, v);
  return out;
}

export function reactionFor(score: number, c: Customer): string {
  const tier = score >= 92 ? 'S' : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 30 ? 'D' : 'F';
  return fillTokens(nextFrom(reactionBags, tier, REACTIONS[tier]), c);
}

const REVIEWS: string[][] = [
  [],
  [
    '"Ruined my life and my {d}. Bathroom was clean though."',
    '"I came in for a {d}. I left with a police sketch."',
    '"Zero stars if I could. My doctor gasped."',
    '"The artist apologized. To my butt. Directly."',
    '"Would not recommend. Parking was easy though."',
    '"I have to shower in the dark now."',
  ],
  [
    '"Not great. Sitting down is now a deeply emotional experience."',
    '"The {d} is... present. That\'s all I\'ll say."',
    '"Artist seemed confused about which end was which."',
    '"Two stars. One for the {d}, one for the free mint."',
    '"My {partner} asked for a refund on my behalf."',
  ],
  [
    '"Decent work. Artist did not make eye contact, which I appreciated."',
    '"Solid {d}. Mostly. From a distance. In low light."',
    '"Would recommend to people I only sort of like."',
    '"Fine. The magazines in the waiting room were from 2003."',
    '"It\'s a {d} if you\'re generous. I am not generous. Three stars."',
  ],
  [
    '"Great vibes, steady hands. Would bend over again."',
    '"My {d} gets compliments at the gym. Wrong kind of attention, but still."',
    '"Clean lines, cold hands. Four stars."',
    '"Lost a star because the artist hummed the Jaws theme."',
    '"Professional, discreet, and only laughed twice."',
  ],
  [
    '"A MASTERPIECE. The Louvre should be calling. They won\'t, but they should."',
    '"I cried. The {d} cried. Perfect."',
    '"Best thing to ever happen back there. And I\'ve had a colonoscopy."',
    '"10/10. Would moon again."',
    '"My {ex} saw it at the beach and wept. Worth every penny."',
  ],
];

const reviewBags = new Map<string, ShuffleBag<string>>();

/** `used` collects review templates already shown, so one summary doesn't repeat a joke. */
export function reviewFor(score: number, c: Customer, used: Set<string> = new Set()): string {
  const stars = score >= 92 ? 5 : score >= 80 ? 4 : score >= 65 ? 3 : score >= 40 ? 2 : 1;
  let template = nextFrom(reviewBags, String(stars), REVIEWS[stars]);
  // The bag already avoids repeats; this guards a reshuffle landing mid-summary.
  for (let i = 0; used.has(template) && i < REVIEWS[stars].length; i++) {
    template = nextFrom(reviewBags, String(stars), REVIEWS[stars]);
  }
  used.add(template);
  return `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} ${c.name}: ${fillTokens(template, c)}`;
}
