import { describe, expect, it } from 'vitest';
import { UPGRADES, effectsOf, type UpgradeId } from '../src/upgrades';

describe('upgrades', () => {
  it('are neutral when nothing is owned', () => {
    expect(effectsOf(new Set())).toEqual({ painRate: 1, squirm: 1, bonusSeconds: 0, stencil: false, tipMult: 1 });
  });

  it('every upgrade changes something', () => {
    const neutral = JSON.stringify(effectsOf(new Set()));
    for (const u of UPGRADES) {
      expect(JSON.stringify(effectsOf(new Set<UpgradeId>([u.id]))), u.id).not.toBe(neutral);
    }
  });

  it('all have prices and copy', () => {
    for (const u of UPGRADES) {
      expect(u.price).toBeGreaterThan(0);
      expect(u.effect.length).toBeGreaterThan(5);
      expect(u.blurb.length).toBeGreaterThan(5);
    }
  });
});
