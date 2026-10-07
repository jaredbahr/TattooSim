import { describe, expect, it } from 'vitest';
import { makeCustomer, reviewFor } from '../src/customers';

describe('makeCustomer', () => {
  it('never reuses a name passed in avoidNames', () => {
    for (let i = 0; i < 200; i++) {
      const c = makeCustomer(1, Math.random, [], { sex: 'f', avoidNames: ['Darlene', 'Pam'] });
      expect(['Darlene', 'Pam']).not.toContain(c.name);
    }
  });

  it('matches wording to the client', () => {
    for (let i = 0; i < 200; i++) {
      const c = makeCustomer(1, Math.random, [], { sex: 'f' });
      expect(c.request).not.toMatch(/\{(ex|partner|party|d|D)\}/);
      expect(c.request).not.toContain('Bachelor party');
    }
  });
});

describe('pronoun tokens', () => {
  it('never produce "my him" / "my her"', async () => {
    const { reactionFor } = await import('../src/customers');
    for (let i = 0; i < 300; i++) {
      const c = makeCustomer(1, Math.random, [], { sex: i % 2 ? 'f' : 'm' });
      const lines = [reactionFor(Math.random() * 100, c), reviewFor(Math.random() * 100, c), c.request];
      for (const l of lines) expect(l).not.toMatch(/\bmy (him|her)\b/i);
    }
  });
});

describe('reviewFor', () => {
  it("doesn't repeat a joke within one summary", () => {
    const c = makeCustomer(1);
    const used = new Set<string>();
    // Three 1-star reviews: there are three 1-star templates, so all must differ.
    const lines = [0, 1, 2].map(() => reviewFor(5, c, used).replace(/^.*?: /, ''));
    expect(new Set(lines).size).toBe(3);
  });
});
