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

describe('reviewFor', () => {
  it("doesn't repeat a joke within one summary", () => {
    const c = makeCustomer(1);
    const used = new Set<string>();
    // Three 1-star reviews: there are three 1-star templates, so all must differ.
    const lines = [0, 1, 2].map(() => reviewFor(5, c, used).replace(/^.*?: /, ''));
    expect(new Set(lines).size).toBe(3);
  });
});
