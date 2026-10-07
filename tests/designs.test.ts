import { describe, expect, it } from 'vitest';
import { BLACKOUT, DESIGNS, fillDesign } from '../src/designs';
import { HUMOR } from '../src/humor';
import { makeCustomer, reactionFor, reviewFor } from '../src/customers';

const ALL = [...DESIGNS, BLACKOUT];
const BAD_GRAMMAR = /\b[Aa] [aeiou]|\b\w+ss\b(?<!glass|ass|less|kiss|boss|class|press|miss|mess|grass|dress|bless|cross|loss)|\{|undefined/;

describe('fillDesign', () => {
  it('picks a/an and pluralizes cleanly', () => {
    const eye = DESIGNS.find((d) => d.id === 'eye')!;
    const wings = DESIGNS.find((d) => d.id === 'wings')!;
    expect(fillDesign('Make it a {d}.', eye)).toBe('Make it an all-seeing eye.');
    expect(fillDesign('A {d}? Sure.', eye)).toBe('An all-seeing eye? Sure.');
    expect(fillDesign('Matching {d}s.', wings)).toBe('Matching pairs of angel wings.');
    expect(fillDesign('{D}. Final answer.', wings)).toBe('Pair of angel wings. Final answer.');
  });

  it('reads cleanly in every design-aware joke pool, for every design', () => {
    const pools = Object.values(HUMOR).flat().filter((t) => t.includes('{d}') || t.includes('{D}'));
    expect(pools.length).toBeGreaterThan(10);
    for (const design of ALL) {
      for (const t of pools) expect(fillDesign(t, design)).not.toMatch(BAD_GRAMMAR);
    }
  });

  it('reads cleanly in walk-in requests, reactions and reviews', () => {
    for (const design of DESIGNS) {
      for (let i = 0; i < 30; i++) {
        const c = makeCustomer(3, Math.random, [], { design: design.id, surprise: false, mindChange: false });
        expect(c.request).not.toMatch(BAD_GRAMMAR);
        for (const score of [5, 25, 45, 65, 85, 98]) {
          expect(reactionFor(score, c)).not.toMatch(BAD_GRAMMAR);
          expect(reviewFor(score, c, new Set())).not.toMatch(BAD_GRAMMAR);
        }
      }
    }
  });
});
