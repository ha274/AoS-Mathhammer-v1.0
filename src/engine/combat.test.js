import { describe, it, expect } from 'vitest';
import {
  parseDice,
  parseThreshold,
  probPass,
  probFail,
  calcPFailSave,
  calcEffSave,
  calcPFailWard,
  applyRerollPass,
  applyRerollFail,
  parseAntiAbilities,
  resolveAnti,
  simulateCombat,
  calcExtraMortals,
} from './combat';

// ============================================================
// parseDice
// ============================================================
describe('parseDice', () => {
  it('parses plain numbers', () => {
    expect(parseDice('1')).toBe(1);
    expect(parseDice('2')).toBe(2);
    expect(parseDice('5')).toBe(5);
  });

  it('parses simple dice notation', () => {
    expect(parseDice('D6')).toBeCloseTo(3.5);
    expect(parseDice('D3')).toBe(2);
    expect(parseDice('d6')).toBeCloseTo(3.5);
  });

  it('parses multi-dice notation', () => {
    expect(parseDice('2D6')).toBe(7);
    expect(parseDice('3D6')).toBeCloseTo(10.5);
    expect(parseDice('2D3')).toBe(4);
  });

  it('parses dice + flat bonus', () => {
    expect(parseDice('D6+3')).toBeCloseTo(6.5);
    expect(parseDice('2D6+3')).toBe(10);
    expect(parseDice('D3+1')).toBe(3);
  });

  it('returns 0 for empty/dash values', () => {
    expect(parseDice('-')).toBe(0);
    expect(parseDice('')).toBe(0);
    expect(parseDice(null)).toBe(0);
    expect(parseDice(undefined)).toBe(0);
  });

  it('handles unicode minus sign', () => {
    // The engine replaces \u2212 with -
    expect(parseDice('\u22121')).toBe(-1);
  });
});

// ============================================================
// parseThreshold
// ============================================================
describe('parseThreshold', () => {
  it('parses "X+" format', () => {
    expect(parseThreshold('4+')).toBe(4);
    expect(parseThreshold('2+')).toBe(2);
    expect(parseThreshold('6+')).toBe(6);
  });

  it('parses plain numbers', () => {
    expect(parseThreshold('3')).toBe(3);
    expect(parseThreshold('5')).toBe(5);
  });

  it('returns null for empty/dash', () => {
    expect(parseThreshold('-')).toBeNull();
    expect(parseThreshold('')).toBeNull();
    expect(parseThreshold(null)).toBeNull();
    expect(parseThreshold(undefined)).toBeNull();
  });
});

// ============================================================
// probPass / probFail
// ============================================================
describe('probPass', () => {
  it('returns correct probabilities for standard thresholds', () => {
    expect(probPass(2)).toBeCloseTo(5 / 6);  // 2+ = 83.3%
    expect(probPass(3)).toBeCloseTo(4 / 6);  // 3+ = 66.7%
    expect(probPass(4)).toBeCloseTo(3 / 6);  // 4+ = 50%
    expect(probPass(5)).toBeCloseTo(2 / 6);  // 5+ = 33.3%
    expect(probPass(6)).toBeCloseTo(1 / 6);  // 6+ = 16.7%
  });

  it('clamps to max 5/6 (1s always fail)', () => {
    expect(probPass(1)).toBeCloseTo(5 / 6);
    expect(probPass(0)).toBeCloseTo(5 / 6);
  });

  it('clamps to min 1/6 (6s always pass)', () => {
    expect(probPass(7)).toBeCloseTo(1 / 6);
    expect(probPass(8)).toBeCloseTo(1 / 6);
  });

  it('returns 0 for null threshold', () => {
    expect(probPass(null)).toBe(0);
  });
});

describe('probFail', () => {
  it('is the complement of probPass', () => {
    expect(probFail(4)).toBeCloseTo(1 - probPass(4));
    expect(probFail(2)).toBeCloseTo(1 - probPass(2));
    expect(probFail(6)).toBeCloseTo(1 - probPass(6));
  });

  it('returns 1 for null threshold (no save = always fails)', () => {
    expect(probFail(null)).toBe(1);
  });
});

// ============================================================
// calcPFailSave / calcEffSave
// ============================================================
describe('calcPFailSave', () => {
  it('computes base save failure probability', () => {
    // 4+ save, 0 rend → eff 4 → fail = 1 - 3/6 = 0.5
    expect(calcPFailSave(4, 0)).toBeCloseTo(0.5);
  });

  it('applies rend (adds to threshold)', () => {
    // 4+ save, rend 2 → eff 6 → fail = 1 - 1/6 = 5/6
    expect(calcPFailSave(4, 2)).toBeCloseTo(5 / 6);
  });

  it('applies save modifier (subtracts from threshold)', () => {
    // 4+ save, rend 0, saveMod 1 → eff 3 → fail = 1 - 4/6 = 2/6
    expect(calcPFailSave(4, 0, 1)).toBeCloseTo(2 / 6);
  });

  it('applies All-Out Defence (reduces effective by 1)', () => {
    // 4+ save, rend 0, saveMod 0, AOD → eff 3 → fail = 2/6
    expect(calcPFailSave(4, 0, 0, true)).toBeCloseTo(2 / 6);
  });

  it('clamps effective save to minimum 2', () => {
    // 2+ save, rend 0, saveMod 2, AOD → would be -1, clamped to 2
    expect(calcPFailSave(2, 0, 2, true)).toBeCloseTo(1 / 6);
  });

  it('returns 1 when save is impossible (eff >= 7)', () => {
    // 4+ save, rend 3 → eff 7 → no save possible
    expect(calcPFailSave(4, 3)).toBe(1);
  });

  it('returns 1 for null base save', () => {
    expect(calcPFailSave(null, 0)).toBe(1);
  });
});

describe('calcEffSave', () => {
  it('computes effective save threshold', () => {
    expect(calcEffSave(4, 0)).toBe(4);
    expect(calcEffSave(4, 2)).toBe(6);
    expect(calcEffSave(4, 0, 1)).toBe(3);
  });

  it('clamps minimum to 2', () => {
    expect(calcEffSave(2, 0, 2, true)).toBe(2);
  });

  it('returns 7 for null base save', () => {
    expect(calcEffSave(null, 0)).toBe(7);
  });
});

// ============================================================
// calcPFailWard
// ============================================================
describe('calcPFailWard', () => {
  it('returns ward failure probability', () => {
    // 6+ ward → fail = 5/6
    expect(calcPFailWard(6)).toBeCloseTo(5 / 6);
    // 5+ ward → fail = 4/6
    expect(calcPFailWard(5)).toBeCloseTo(4 / 6);
    // 4+ ward → fail = 3/6
    expect(calcPFailWard(4)).toBeCloseTo(0.5);
  });

  it('returns 1 for null ward (no ward = damage passes through)', () => {
    expect(calcPFailWard(null)).toBe(1);
  });
});

// ============================================================
// parseAntiAbilities
// ============================================================
describe('parseAntiAbilities', () => {
  it('parses single anti-ability with rend', () => {
    const result = parseAntiAbilities('Anti-CHARGE (+1 Rend)');
    expect(result).toEqual([{ keyword: 'CHARGE', bonus: 1, type: 'rend' }]);
  });

  it('parses single anti-ability with damage', () => {
    const result = parseAntiAbilities('Anti-MONSTER (+2 Damage)');
    expect(result).toEqual([{ keyword: 'MONSTER', bonus: 2, type: 'damage' }]);
  });

  it('parses multiple anti-abilities', () => {
    const result = parseAntiAbilities('Anti-CHARGE (+1 Rend), Anti-MONSTER (+2 Damage)');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ keyword: 'CHARGE', bonus: 1, type: 'rend' });
    expect(result[1]).toEqual({ keyword: 'MONSTER', bonus: 2, type: 'damage' });
  });

  it('returns empty for dash/empty/null', () => {
    expect(parseAntiAbilities('-')).toEqual([]);
    expect(parseAntiAbilities('')).toEqual([]);
    expect(parseAntiAbilities(null)).toEqual([]);
  });

  it('handles multi-word keywords', () => {
    const result = parseAntiAbilities('Anti-WAR MACHINE (+1 Rend)');
    expect(result).toEqual([{ keyword: 'WAR MACHINE', bonus: 1, type: 'rend' }]);
  });
});

// ============================================================
// resolveAnti
// ============================================================
describe('resolveAnti', () => {
  it('returns zero bonuses when no match', () => {
    const result = resolveAnti('Anti-MONSTER (+1 Rend)', ['INFANTRY']);
    expect(result).toEqual({ rendBonus: 0, dmgBonus: 0 });
  });

  it('matches keyword in defender keywords', () => {
    const result = resolveAnti('Anti-MONSTER (+1 Rend)', ['MONSTER', 'HERO']);
    expect(result).toEqual({ rendBonus: 1, dmgBonus: 0 });
  });

  it('matches CHARGE when wasCharged is true', () => {
    const result = resolveAnti('Anti-CHARGE (+1 Rend)', [], true);
    expect(result).toEqual({ rendBonus: 1, dmgBonus: 0 });
  });

  it('does not match CHARGE when wasCharged is false', () => {
    const result = resolveAnti('Anti-CHARGE (+1 Rend)', [], false);
    expect(result).toEqual({ rendBonus: 0, dmgBonus: 0 });
  });

  it('accumulates multiple matching bonuses', () => {
    const result = resolveAnti(
      'Anti-MONSTER (+1 Rend), Anti-HERO (+2 Damage)',
      ['MONSTER', 'HERO']
    );
    expect(result).toEqual({ rendBonus: 1, dmgBonus: 2 });
  });

  it('handles empty ability string', () => {
    const result = resolveAnti('', ['MONSTER']);
    expect(result).toEqual({ rendBonus: 0, dmgBonus: 0 });
  });
});

// ============================================================
// simulateCombat
// ============================================================

// Helper: minimal unit factory
function makeUnit(overrides = {}) {
  return {
    name: 'Test Unit',
    modelCount: 1,
    health: '2',
    save: '4+',
    points: 100,
    keywords: [],
    weapons: [{
      name: 'Test Weapon',
      type: 'melee',
      attacks: '2',
      hit: '4+',
      wound: '4+',
      rend: '0',
      damage: '1',
      ability: '',
      enabled: true,
      modelCount: 1,
    }],
    ...overrides,
  };
}

function defaultMods() {
  return { hitMod: 0, woundMod: 0, rendMod: 0, damageMod: 0, extraAttacks: 0, allOutAttack: false, champion: false, critBuff: '', critOn: 6, hitReroll: 'off', woundReroll: 'off' };
}

function defaultDefMods() {
  return { allOutDefence: false, saveMod: 0, ward: null, save6Reflect: false, saveReroll: 'off' };
}

function defaultOpts() {
  return { charged: false, wasCharged: false, powerThrough: false, fightTwice: false };
}

describe('simulateCombat', () => {
  it('calculates basic melee damage', () => {
    // 2 attacks, 4+ hit (50%), 4+ wound (50%), 4+ save (50% fail), 1 dmg, no ward
    // Expected: 2 * 0.5 * 0.5 * 0.5 * 1 * 1 = 0.25
    const attacker = makeUnit();
    const defender = makeUnit();
    const result = simulateCombat(attacker, defender, defaultMods(), defaultDefMods(), defaultOpts());

    expect(result.totalDamage).toBeCloseTo(0.25);
    expect(result.weapons).toHaveLength(1);
    expect(result.weapons[0].name).toBe('Test Weapon');
  });

  it('returns zero damage when no weapons enabled', () => {
    const attacker = makeUnit({
      weapons: [{ ...makeUnit().weapons[0], enabled: false }],
    });
    const result = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
    expect(result.totalDamage).toBe(0);
    expect(result.weapons).toHaveLength(0);
  });

  it('filters weapons by type', () => {
    const attacker = makeUnit({
      weapons: [
        { name: 'Sword', type: 'melee', attacks: '2', hit: '4+', wound: '4+', rend: '0', damage: '1', ability: '', enabled: true, modelCount: 1 },
        { name: 'Bow', type: 'ranged', attacks: '2', hit: '4+', wound: '4+', rend: '0', damage: '1', ability: '', enabled: true, modelCount: 1 },
      ],
    });

    const meleeResult = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts(), null, 'melee');
    expect(meleeResult.weapons).toHaveLength(1);
    expect(meleeResult.weapons[0].name).toBe('Sword');

    const rangedResult = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts(), null, 'ranged');
    expect(rangedResult.weapons).toHaveLength(1);
    expect(rangedResult.weapons[0].name).toBe('Bow');
  });

  it('applies rend correctly', () => {
    const attacker = makeUnit({
      weapons: [{ ...makeUnit().weapons[0], rend: '2' }],
    });
    // 4+ save with rend 2 → eff save 6+ → fail = 5/6
    // 2 * 0.5 * 0.5 * (5/6) * 1 = 5/12 ≈ 0.4167
    const result = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
    expect(result.totalDamage).toBeCloseTo(5 / 12);
  });

  it('applies ward save', () => {
    // Ward 6+ → fail ward = 5/6
    // 2 * 0.5 * 0.5 * 0.5 * 1 * (5/6) = 0.2083
    const defMods = { ...defaultDefMods(), ward: '6+' };
    const result = simulateCombat(makeUnit(), makeUnit(), defaultMods(), defMods, defaultOpts());
    expect(result.totalDamage).toBeCloseTo(0.25 * (5 / 6));
  });

  it('applies All-Out Attack (+1 hit)', () => {
    const atkMods = { ...defaultMods(), allOutAttack: true };
    // 4+ hit with +1 → 3+ hit → 4/6 chance
    // 2 * (4/6) * 0.5 * 0.5 * 1 = 1/3 ≈ 0.333
    const result = simulateCombat(makeUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());
    expect(result.totalDamage).toBeCloseTo(1 / 3);
  });

  it('applies All-Out Defence', () => {
    const defMods = { ...defaultDefMods(), allOutDefence: true };
    // 4+ save with AOD → saveMod=1, eff save 3+ → fail = 2/6
    // 2 * 0.5 * 0.5 * (2/6) * 1 = 1/6 ≈ 0.1667
    const result = simulateCombat(makeUnit(), makeUnit(), defaultMods(), defMods, defaultOpts());
    expect(result.totalDamage).toBeCloseTo(1 / 6);
  });

  it('applies extra attacks', () => {
    const atkMods = { ...defaultMods(), extraAttacks: 1 };
    // (2+1) attacks * 0.5 * 0.5 * 0.5 = 0.375
    const result = simulateCombat(makeUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());
    expect(result.totalDamage).toBeCloseTo(0.375);
  });

  it('applies champion bonus', () => {
    const atkMods = { ...defaultMods(), champion: true };
    // (2 + 1/1) attacks * 0.5 * 0.5 * 0.5 = 0.375
    const result = simulateCombat(makeUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());
    expect(result.totalDamage).toBeCloseTo(0.375);
  });

  it('applies damage modifier', () => {
    const atkMods = { ...defaultMods(), damageMod: 1 };
    // 2 * 0.5 * 0.5 * 0.5 * 2 = 0.5
    const result = simulateCombat(makeUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());
    expect(result.totalDamage).toBeCloseTo(0.5);
  });

  it('applies rend modifier', () => {
    const atkMods = { ...defaultMods(), rendMod: 1 };
    // 4+ save with rend 1 → eff save 5+ → fail = 4/6
    // 2 * 0.5 * 0.5 * (4/6) * 1 = 1/3
    const result = simulateCombat(makeUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());
    expect(result.totalDamage).toBeCloseTo(1 / 3);
  });

  it('calculates models killed correctly', () => {
    // 10 models with 1 health each, dealing 3.5 damage → 3 kills
    const attacker = makeUnit({
      weapons: [{ ...makeUnit().weapons[0], attacks: '100', damage: '1' }],
    });
    const defender = makeUnit({ modelCount: 10, health: '1' });
    const result = simulateCombat(attacker, defender, defaultMods(), defaultDefMods(), defaultOpts());
    expect(result.modelsKilled).toBeLessThanOrEqual(10);
    expect(result.modelsKilled).toBeGreaterThan(0);
    expect(result.remainingModels).toBe(10 - result.modelsKilled);
  });

  it('caps models killed at model count', () => {
    const attacker = makeUnit({
      weapons: [{ ...makeUnit().weapons[0], attacks: '1000', damage: '10' }],
    });
    const defender = makeUnit({ modelCount: 5, health: '1' });
    const result = simulateCombat(attacker, defender, defaultMods(), defaultDefMods(), defaultOpts());
    expect(result.modelsKilled).toBe(5);
    expect(result.remainingModels).toBe(0);
    expect(result.percentUnitKilled).toBe(100);
  });

  // ---- Crit tests ----
  describe('crit mechanics', () => {
    it('handles Crit (Mortal) from weapon ability', () => {
      const attacker = makeUnit({
        weapons: [{
          ...makeUnit().weapons[0],
          ability: 'Crit (Mortal)',
          attacks: '6',
        }],
      });
      const result = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());

      // Should have mortal damage
      expect(result.totalMortalDamage).toBeGreaterThan(0);
      expect(result.weapons[0].hasCM).toBe(true);
      expect(result.weapons[0].critSource).toBe('Mortal');
    });

    it('handles Crit (Auto-wound) from weapon ability', () => {
      const attacker = makeUnit({
        weapons: [{
          ...makeUnit().weapons[0],
          ability: 'Crit (Auto-wound)',
          attacks: '6',
        }],
      });
      const result = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());

      expect(result.weapons[0].hasCW).toBe(true);
      expect(result.weapons[0].critSource).toBe('Auto-wound');
    });

    it('handles Crit (2 Hits) from weapon ability', () => {
      const attacker = makeUnit({
        weapons: [{
          ...makeUnit().weapons[0],
          ability: 'Crit (2 Hits)',
          attacks: '6',
        }],
      });
      const result = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());

      expect(result.weapons[0].hasCH).toBe(true);
      expect(result.weapons[0].critSource).toBe('2 Hits');
      // 2 Hits should produce more total damage than no crit
      const noCritResult = simulateCombat(makeUnit({ weapons: [{ ...makeUnit().weapons[0], attacks: '6' }] }),
        makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
      expect(result.totalDamage).toBeGreaterThan(noCritResult.totalDamage);
    });

    it('applies crit buff from atkMods for non-profile weapons', () => {
      const atkMods = { ...defaultMods(), critBuff: 'mortal', critOn: 5 };
      const result = simulateCombat(makeUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());

      expect(result.weapons[0].hasCM).toBe(true);
      expect(result.weapons[0].critFromBuff).toBe(true);
      expect(result.weapons[0].critTh).toBe(5);
    });

    it('profile crit takes priority over buff crit', () => {
      const attacker = makeUnit({
        weapons: [{
          ...makeUnit().weapons[0],
          ability: 'Crit (Auto-wound)',
        }],
      });
      const atkMods = { ...defaultMods(), critBuff: 'mortal', critOn: 5 };
      const result = simulateCombat(attacker, makeUnit(), atkMods, defaultDefMods(), defaultOpts());

      // Profile crit (Auto-wound) should win over buff (Mortal)
      expect(result.weapons[0].hasCW).toBe(true);
      expect(result.weapons[0].hasCM).toBe(false);
      expect(result.weapons[0].critFromBuff).toBe(false);
    });
  });

  // ---- Companion tests ----
  describe('companion weapons', () => {
    function companionUnit(extraAbility = '') {
      return makeUnit({
        weapons: [{
          name: 'Companion Claws',
          type: 'melee',
          attacks: '3',
          hit: '4+',
          wound: '3+',
          rend: '1',
          damage: '2',
          ability: `Companion${extraAbility}`,
          enabled: true,
          modelCount: 1,
        }],
      });
    }

    it('applies All-Out Attack to companions', () => {
      const atkMods = { ...defaultMods(), allOutAttack: true };
      const withAOA = simulateCombat(companionUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());
      const without = simulateCombat(companionUnit(), makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
      expect(withAOA.totalDamage).toBeGreaterThan(without.totalDamage);
    });

    it('ignores extra attacks on companions', () => {
      const atkMods = { ...defaultMods(), extraAttacks: 2 };
      const result = simulateCombat(companionUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());
      const base = simulateCombat(companionUnit(), makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
      expect(result.totalDamage).toBeCloseTo(base.totalDamage);
    });

    it('ignores champion on companions', () => {
      const atkMods = { ...defaultMods(), champion: true };
      const result = simulateCombat(companionUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());
      const base = simulateCombat(companionUnit(), makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
      expect(result.totalDamage).toBeCloseTo(base.totalDamage);
    });

    it('ignores positive hit mod on companions', () => {
      const atkMods = { ...defaultMods(), hitMod: 1 };
      const result = simulateCombat(companionUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());
      const base = simulateCombat(companionUnit(), makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
      expect(result.totalDamage).toBeCloseTo(base.totalDamage);
    });

    it('applies negative hit mod to companions', () => {
      const atkMods = { ...defaultMods(), hitMod: -1 };
      const result = simulateCombat(companionUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());
      const base = simulateCombat(companionUnit(), makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
      expect(result.totalDamage).toBeLessThan(base.totalDamage);
    });

    it('ignores rend/damage mods on companions', () => {
      const atkMods = { ...defaultMods(), rendMod: 2, damageMod: 3 };
      const result = simulateCombat(companionUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());
      const base = simulateCombat(companionUnit(), makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
      expect(result.totalDamage).toBeCloseTo(base.totalDamage);
    });

    it('ignores crit buff on companions', () => {
      const atkMods = { ...defaultMods(), critBuff: 'mortal', critOn: 5 };
      const result = simulateCombat(companionUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());
      expect(result.weapons[0].hasCM).toBe(false);
      expect(result.weapons[0].critFromBuff).toBe(false);
    });

    it('treats weapon as companion when companion checkbox is true', () => {
      const attacker = makeUnit({
        weapons: [{
          name: 'Custom Beast',
          type: 'melee',
          attacks: '3',
          hit: '4+',
          wound: '3+',
          rend: '1',
          damage: '2',
          ability: '-',
          companion: true,
          enabled: true,
          modelCount: 1,
        }],
      });
      const atkMods = { ...defaultMods(), extraAttacks: 2, rendMod: 1, damageMod: 1 };
      const result = simulateCombat(attacker, makeUnit(), atkMods, defaultDefMods(), defaultOpts());
      const base = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
      // Companion via checkbox ignores extra attacks, rend, damage mods — same as ability-based
      expect(result.totalDamage).toBeCloseTo(base.totalDamage);
      expect(result.weapons[0].isComp).toBe(true);
    });

    it('companion checkbox false overrides ability text', () => {
      const attacker = makeUnit({
        weapons: [{
          name: 'Not Actually Companion',
          type: 'melee',
          attacks: '3',
          hit: '4+',
          wound: '3+',
          rend: '1',
          damage: '2',
          ability: 'Companion',
          companion: false,
          enabled: true,
          modelCount: 1,
        }],
      });
      const atkMods = { ...defaultMods(), extraAttacks: 2 };
      const result = simulateCombat(attacker, makeUnit(), atkMods, defaultDefMods(), defaultOpts());
      const base = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
      // companion: false overrides ability text — extra attacks SHOULD apply
      expect(result.totalDamage).toBeGreaterThan(base.totalDamage);
      expect(result.weapons[0].isComp).toBe(false);
    });

    it('falls back to ability text when companion field is undefined', () => {
      const attacker = makeUnit({
        weapons: [{
          name: 'Legacy Companion',
          type: 'melee',
          attacks: '3',
          hit: '4+',
          wound: '3+',
          rend: '1',
          damage: '2',
          ability: 'Companion',
          enabled: true,
          modelCount: 1,
          // no companion field — should fall back to ability parsing
        }],
      });
      const atkMods = { ...defaultMods(), extraAttacks: 2 };
      const result = simulateCombat(attacker, makeUnit(), atkMods, defaultDefMods(), defaultOpts());
      const base = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
      // Falls back to ability text parsing — extra attacks ignored
      expect(result.totalDamage).toBeCloseTo(base.totalDamage);
      expect(result.weapons[0].isComp).toBe(true);
    });
  });

  // ---- Charge bonus ----
  it('applies charge +1 damage from weapon ability', () => {
    const attacker = makeUnit({
      weapons: [{
        ...makeUnit().weapons[0],
        ability: 'Charge (+1 Damage)',
      }],
    });
    const opts = { ...defaultOpts(), charged: true };
    const withCharge = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), opts);
    const withoutCharge = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
    // With charge: damage becomes 2 instead of 1
    expect(withCharge.totalDamage).toBeCloseTo(withoutCharge.totalDamage * 2);
  });

  // ---- Anti-ability integration ----
  it('applies anti-ability bonuses from weapon ability', () => {
    const attacker = makeUnit({
      weapons: [{
        ...makeUnit().weapons[0],
        ability: 'Anti-MONSTER (+1 Rend)',
      }],
    });
    const defender = makeUnit({ keywords: ['MONSTER'] });
    const result = simulateCombat(attacker, defender, defaultMods(), defaultDefMods(), defaultOpts());

    // With rend 1 vs 4+ save → eff save 5+ → fail = 4/6
    // 2 * 0.5 * 0.5 * (4/6) * 1 = 1/3
    expect(result.totalDamage).toBeCloseTo(1 / 3);
  });

  // ---- Model override (for shootCharge survivors) ----
  it('scales weapon attacks by model override', () => {
    const attacker = makeUnit({ modelCount: 10 });
    attacker.weapons[0].modelCount = 10;

    const fullResult = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
    const halfResult = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts(), 5);

    expect(halfResult.totalDamage).toBeCloseTo(fullResult.totalDamage / 2);
  });

  // ---- Multi-model unit ----
  it('scales attacks by model count', () => {
    const singleModel = makeUnit({ modelCount: 1 });
    singleModel.weapons[0].modelCount = 1;

    const fiveModels = makeUnit({ modelCount: 5 });
    fiveModels.weapons[0].modelCount = 5;

    const single = simulateCombat(singleModel, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
    const five = simulateCombat(fiveModels, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());

    expect(five.totalDamage).toBeCloseTo(single.totalDamage * 5);
  });

  // ---- Hit/wound mod clamping ----
  it('clamps hit and wound mods to [-1, +1]', () => {
    const atkMods = { ...defaultMods(), hitMod: 3, woundMod: -3 };
    const result = simulateCombat(makeUnit(), makeUnit(), atkMods, defaultDefMods(), defaultOpts());

    // hitMod clamped to +1, woundMod clamped to -1
    expect(result.weapons[0].effHit).toBe(3);  // 4 - 1 = 3
    expect(result.weapons[0].effWnd).toBe(5);  // 4 + 1 = 5
  });

  // ---- No save (null) ----
  it('handles defender with no save', () => {
    const defender = makeUnit({ save: '-' });
    // No save → pFailSave = 1
    // 2 * 0.5 * 0.5 * 1 * 1 = 0.5
    const result = simulateCombat(makeUnit(), defender, defaultMods(), defaultDefMods(), defaultOpts());
    expect(result.totalDamage).toBeCloseTo(0.5);
  });
});

// ============================================================
// calcExtraMortals
// ============================================================
describe('calcExtraMortals', () => {
  const baseUnit = () => makeUnit({ modelCount: 5 });

  const emptyResult = () => ({
    weapons: [{ attacks: 6, pHit: 0.5, pWound: 0.5, name: 'Sword' }],
    totalDamage: 2,
    totalMortalDamage: 0,
    modelsKilled: 1,
    percentUnitKilled: 20,
    remainingModels: 4,
  });

  it('calculates Power Through damage', () => {
    const result = calcExtraMortals({
      firstR: emptyResult(),
      secondR: emptyResult(),
      firstUnit: baseUnit(),
      secondUnit: baseUnit(),
      firstOpts: { powerThrough: true },
      secondOpts: { powerThrough: false },
      firstAtkMods: defaultMods(),
      secondAtkMods: defaultMods(),
      firstDefMods: defaultDefMods(),
      secondDefMods: defaultDefMods(),
      combatMode: 'melee',
    });

    // D3 average = 2, no ward → 2.0
    expect(result.fPTDmg).toBeCloseTo(2.0);
    expect(result.sPTDmg).toBe(0);
  });

  it('Power Through is zero in shoot mode', () => {
    const result = calcExtraMortals({
      firstR: emptyResult(),
      secondR: emptyResult(),
      firstUnit: baseUnit(),
      secondUnit: baseUnit(),
      firstOpts: { powerThrough: true },
      secondOpts: { powerThrough: true },
      firstAtkMods: defaultMods(),
      secondAtkMods: defaultMods(),
      firstDefMods: defaultDefMods(),
      secondDefMods: defaultDefMods(),
      combatMode: 'shoot',
    });

    expect(result.fPTDmg).toBe(0);
    expect(result.sPTDmg).toBe(0);
  });

  it('Power Through is reduced by ward', () => {
    const result = calcExtraMortals({
      firstR: emptyResult(),
      secondR: emptyResult(),
      firstUnit: baseUnit(),
      secondUnit: baseUnit(),
      firstOpts: { powerThrough: true },
      secondOpts: {},
      firstAtkMods: defaultMods(),
      secondAtkMods: defaultMods(),
      firstDefMods: defaultDefMods(),
      secondDefMods: { ...defaultDefMods(), ward: '5+' },
      combatMode: 'melee',
    });

    // 2.0 * (4/6) = 4/3 ≈ 1.333
    expect(result.fPTDmg).toBeCloseTo(2.0 * (4 / 6));
  });

  it('calculates OnX mortals', () => {
    const result = calcExtraMortals({
      firstR: emptyResult(),
      secondR: emptyResult(),
      firstUnit: baseUnit(),
      secondUnit: baseUnit(),
      firstOpts: {},
      secondOpts: {},
      firstAtkMods: { ...defaultMods(), onXThreshold: '4+', onXDamage: 'D3' },
      secondAtkMods: defaultMods(),
      firstDefMods: defaultDefMods(),
      secondDefMods: defaultDefMods(),
      combatMode: 'melee',
    });

    // probPass(4) = 0.5, parseDice('D3') = 2, no ward → 1.0
    expect(result.fOnXDmg).toBeCloseTo(1.0);
    expect(result.sOnXDmg).toBe(0);
  });

  it('calculates per-model mortals', () => {
    const result = calcExtraMortals({
      firstR: emptyResult(),
      secondR: emptyResult(),
      firstUnit: baseUnit(),
      secondUnit: { ...baseUnit(), modelCount: 10 },
      firstOpts: {},
      secondOpts: {},
      firstAtkMods: { ...defaultMods(), perModelThreshold: '4+' },
      secondAtkMods: defaultMods(),
      firstDefMods: defaultDefMods(),
      secondDefMods: defaultDefMods(),
      combatMode: 'melee',
    });

    // 10 models * probPass(4) = 10 * 0.5 = 5.0, no ward
    expect(result.fPMDmg).toBeCloseTo(5.0);
    expect(result.sPMDmg).toBe(0);
  });

  it('calculates Save 6 Reflect', () => {
    const result = calcExtraMortals({
      firstR: emptyResult(),
      secondR: emptyResult(),
      firstUnit: baseUnit(),
      secondUnit: baseUnit(),
      firstOpts: {},
      secondOpts: { save6Reflect: true },
      firstAtkMods: defaultMods(),
      secondAtkMods: defaultMods(),
      firstDefMods: defaultDefMods(),
      secondDefMods: defaultDefMods(),
      combatMode: 'melee',
    });

    // First attacker's weapons: 6 attacks * 0.5 hit * 0.5 wound = 1.5 reaching save
    // Reflect: 1.5 * 1/6 * 1 (no ward on first) = 0.25
    expect(result.reflectToFirst).toBeCloseTo(0.25);
    expect(result.reflectToSecond).toBe(0);
  });

  it('Save 6 Reflect is zero in shoot mode', () => {
    const result = calcExtraMortals({
      firstR: emptyResult(),
      secondR: emptyResult(),
      firstUnit: baseUnit(),
      secondUnit: baseUnit(),
      firstOpts: {},
      secondOpts: { save6Reflect: true },
      firstAtkMods: defaultMods(),
      secondAtkMods: defaultMods(),
      firstDefMods: defaultDefMods(),
      secondDefMods: defaultDefMods(),
      combatMode: 'shoot',
    });

    expect(result.reflectToFirst).toBe(0);
  });

  it('splits OnX by timing — before', () => {
    const result = calcExtraMortals({
      firstR: emptyResult(),
      secondR: emptyResult(),
      firstUnit: baseUnit(),
      secondUnit: baseUnit(),
      firstOpts: {},
      secondOpts: {},
      firstAtkMods: { ...defaultMods(), onXThreshold: '4+', onXDamage: 'D3', onXTiming: 'before' },
      secondAtkMods: defaultMods(),
      firstDefMods: defaultDefMods(),
      secondDefMods: defaultDefMods(),
      combatMode: 'melee',
    });

    expect(result.fOnXBefore).toBeCloseTo(1.0);
    expect(result.fOnXDuring).toBe(0);
    expect(result.fOnXAfter).toBe(0);
    expect(result.fOnXTiming).toBe('before');
  });

  it('splits OnX by timing — during', () => {
    const result = calcExtraMortals({
      firstR: emptyResult(),
      secondR: emptyResult(),
      firstUnit: baseUnit(),
      secondUnit: baseUnit(),
      firstOpts: {},
      secondOpts: {},
      firstAtkMods: { ...defaultMods(), onXThreshold: '4+', onXDamage: 'D3', onXTiming: 'during' },
      secondAtkMods: defaultMods(),
      firstDefMods: defaultDefMods(),
      secondDefMods: defaultDefMods(),
      combatMode: 'melee',
    });

    expect(result.fOnXBefore).toBe(0);
    expect(result.fOnXDuring).toBeCloseTo(1.0);
    expect(result.fOnXAfter).toBe(0);
  });

  it('defaults OnX timing to after', () => {
    const result = calcExtraMortals({
      firstR: emptyResult(),
      secondR: emptyResult(),
      firstUnit: baseUnit(),
      secondUnit: baseUnit(),
      firstOpts: {},
      secondOpts: {},
      firstAtkMods: { ...defaultMods(), onXThreshold: '4+', onXDamage: 'D3' },
      secondAtkMods: defaultMods(),
      firstDefMods: defaultDefMods(),
      secondDefMods: defaultDefMods(),
      combatMode: 'melee',
    });

    expect(result.fOnXBefore).toBe(0);
    expect(result.fOnXDuring).toBe(0);
    expect(result.fOnXAfter).toBeCloseTo(1.0);
    expect(result.fOnXTiming).toBe('after');
  });

  it('totals extra mortals correctly', () => {
    const result = calcExtraMortals({
      firstR: emptyResult(),
      secondR: emptyResult(),
      firstUnit: baseUnit(),
      secondUnit: baseUnit(),
      firstOpts: { powerThrough: true },
      secondOpts: {},
      firstAtkMods: { ...defaultMods(), onXThreshold: '4+', onXDamage: 'D3' },
      secondAtkMods: defaultMods(),
      firstDefMods: defaultDefMods(),
      secondDefMods: defaultDefMods(),
      combatMode: 'melee',
    });

    // fExtraMortals = fPTDmg + fOnXDmg + fPMDmg + reflectToSecond
    expect(result.fExtraMortals).toBeCloseTo(result.fPTDmg + result.fOnXDmg + result.fPMDmg + result.reflectToSecond);
    expect(result.sExtraMortals).toBeCloseTo(result.sPTDmg + result.sOnXDmg + result.sPMDmg + result.reflectToFirst);
  });
});

// ============================================================
// Reroll helpers
// ============================================================
describe('applyRerollPass', () => {
  it('returns original probability when reroll is off', () => {
    expect(applyRerollPass(0.5, 'off')).toBe(0.5);
  });

  it('applies reroll ones correctly', () => {
    // Reroll 1s on hit: pPass + (1/6) * pPass
    const p = probPass(4); // 0.5 for 4+
    const result = applyRerollPass(p, 'ones');
    expect(result).toBeCloseTo(p + (1 / 6) * p);
  });

  it('applies full reroll correctly', () => {
    // Full reroll: 1 - (1 - pPass)^2
    const p = probPass(4); // 0.5 for 4+
    const result = applyRerollPass(p, 'full');
    expect(result).toBeCloseTo(1 - Math.pow(1 - p, 2));
    expect(result).toBeCloseTo(0.75); // 1 - 0.25 = 0.75
  });
});

describe('applyRerollFail', () => {
  it('returns original probability when reroll is off', () => {
    expect(applyRerollFail(0.5, 'off')).toBe(0.5);
  });

  it('applies reroll ones on fail correctly', () => {
    const pFail = probFail(4); // 0.5 for 4+
    const result = applyRerollFail(pFail, 'ones');
    expect(result).toBeCloseTo(pFail * (7 / 6) - (1 / 6));
  });

  it('applies full reroll on fail correctly', () => {
    // Full reroll fail: pFail^2
    const pFail = probFail(4); // 0.5
    const result = applyRerollFail(pFail, 'full');
    expect(result).toBeCloseTo(pFail * pFail);
    expect(result).toBeCloseTo(0.25);
  });
});

// ============================================================
// simulateCombat with rerolls
// ============================================================
describe('simulateCombat rerolls', () => {
  it('hit reroll ones increases damage', () => {
    const attacker = makeUnit();
    const base = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
    const withReroll = simulateCombat(attacker, makeUnit(), { ...defaultMods(), hitReroll: 'ones' }, defaultDefMods(), defaultOpts());
    expect(withReroll.totalDamage).toBeGreaterThan(base.totalDamage);
  });

  it('full hit reroll increases damage more than reroll ones', () => {
    const attacker = makeUnit();
    const ones = simulateCombat(attacker, makeUnit(), { ...defaultMods(), hitReroll: 'ones' }, defaultDefMods(), defaultOpts());
    const full = simulateCombat(attacker, makeUnit(), { ...defaultMods(), hitReroll: 'full' }, defaultDefMods(), defaultOpts());
    expect(full.totalDamage).toBeGreaterThan(ones.totalDamage);
  });

  it('wound reroll ones increases damage', () => {
    const attacker = makeUnit();
    const base = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
    const withReroll = simulateCombat(attacker, makeUnit(), { ...defaultMods(), woundReroll: 'ones' }, defaultDefMods(), defaultOpts());
    expect(withReroll.totalDamage).toBeGreaterThan(base.totalDamage);
  });

  it('save reroll reduces damage (defender rerolling saves)', () => {
    const attacker = makeUnit();
    const base = simulateCombat(attacker, makeUnit(), defaultMods(), defaultDefMods(), defaultOpts());
    const withReroll = simulateCombat(attacker, makeUnit(), defaultMods(), { ...defaultDefMods(), saveReroll: 'full' }, defaultOpts());
    expect(withReroll.totalDamage).toBeLessThan(base.totalDamage);
  });

  it('combined hit and wound rerolls stack', () => {
    const attacker = makeUnit();
    const hitOnly = simulateCombat(attacker, makeUnit(), { ...defaultMods(), hitReroll: 'full' }, defaultDefMods(), defaultOpts());
    const both = simulateCombat(attacker, makeUnit(), { ...defaultMods(), hitReroll: 'full', woundReroll: 'full' }, defaultDefMods(), defaultOpts());
    expect(both.totalDamage).toBeGreaterThan(hitOnly.totalDamage);
  });
});
