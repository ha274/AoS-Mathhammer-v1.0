// ============================================================
// AoS 4th Edition Monte Carlo Combat Simulator
// Rolls actual dice instead of computing expected values
// ============================================================

import {
  parseThreshold,
  parseDice,
  calcEffSave,
  calcPFailWard,
  parseAntiAbilities,
} from './combat';

// --- Dice rolling primitives ---

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

/** Roll a dice notation string (e.g. "D6", "2D3", "D6+3", "2") and return an integer result */
export function rollDice(val) {
  if (val === "-" || val === "" || val == null) return 0;
  const s = String(val).trim().replace(/\u2212/g, "-");
  const mPlus = s.match(/^(\d*)D(\d+)\s*\+\s*(\d+)$/i);
  if (mPlus) {
    const count = mPlus[1] ? parseInt(mPlus[1]) : 1;
    const sides = parseInt(mPlus[2]);
    let total = parseInt(mPlus[3]);
    for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
    return total;
  }
  const m = s.match(/^(\d*)D(\d+)$/i);
  if (m) {
    const count = m[1] ? parseInt(m[1]) : 1;
    const sides = parseInt(m[2]);
    let total = 0;
    for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
    return total;
  }
  return parseFloat(s) || 0;
}

/** AoS d6 check: 1 always fails, 6 always succeeds */
function passesCheck(threshold) {
  const roll = rollD6();
  if (roll === 1) return false;
  if (roll === 6) return true;
  return roll >= threshold;
}

/** Roll d6 with reroll support. Returns the final roll value. */
function rollD6WithReroll(rerollType) {
  let roll = rollD6();
  if (rerollType === "ones" && roll === 1) roll = rollD6();
  else if (rerollType === "full") {
    // For full reroll we need to know if it failed, but we don't know threshold here.
    // So we return the roll and let caller handle it.
  }
  return roll;
}

/** AoS d6 check with reroll: rerollType = "off" | "ones" | "full" */
function passesCheckReroll(threshold, rerollType) {
  let roll = rollD6();
  const passed = roll === 6 || (roll !== 1 && roll >= threshold);
  if (!passed && rerollType !== "off") {
    if (rerollType === "ones" && roll === 1) roll = rollD6();
    else if (rerollType === "full") roll = rollD6();
    else return false;
    return roll === 6 || (roll !== 1 && roll >= threshold);
  }
  return passed;
}

/** D6 save roll with reroll. Returns { roll, passed } */
function saveRollWithReroll(effSave, rerollType) {
  let roll = rollD6();
  let passed = effSave < 7 && (roll === 6 || (roll !== 1 && roll >= effSave));
  if (!passed && rerollType !== "off") {
    if (rerollType === "ones" && roll === 1) roll = rollD6();
    else if (rerollType === "full") roll = rollD6();
    else return { roll, passed };
    passed = effSave < 7 && (roll === 6 || (roll !== 1 && roll >= effSave));
  }
  return { roll, passed };
}

// --- Single weapon resolution (one iteration) ---

function resolveWeapon(weapon, modelCount, atkMods, defSave, defWardTh, rend, dmg, hitTh, wndTh, critTh, hasCM, hasCW, hasCH, isChampionWeapon, hitReroll, woundReroll, saveReroll) {
  const eH = Math.max(2, (hitTh || 4));
  const eW = Math.max(2, (wndTh || 4));

  // Roll number of attacks (handles dice notation like "D6")
  const isComp = weapon.companion ?? (weapon.ability || "").toLowerCase().includes("companion");
  let baseAtk = rollDice(weapon.attacks);
  if (!isComp) {
    baseAtk += (atkMods.extraAttacks || 0);
    if (isChampionWeapon && modelCount >= 1) baseAtk += 1 / modelCount;
  }
  const totalAtks = Math.max(0, Math.round(baseAtk * modelCount));

  let normalDmg = 0, mortalDmg = 0;
  const hr = hitReroll || "off";
  const wr = woundReroll || "off";
  const sr = saveReroll || "off";

  for (let a = 0; a < totalAtks; a++) {
    // Hit roll (with reroll support)
    let hitRoll = rollD6();
    let hitPassed = hitRoll === 6 || (hitRoll !== 1 && hitRoll >= eH);
    if (!hitPassed && hr !== "off") {
      if (hr === "ones" && hitRoll === 1) hitRoll = rollD6();
      else if (hr === "full") hitRoll = rollD6();
      hitPassed = hitRoll === 6 || (hitRoll !== 1 && hitRoll >= eH);
    }
    if (!hitPassed) continue;

    // Crit check (on the final hit roll)
    const isCrit = hitRoll >= critTh;

    if (hasCM && isCrit) {
      // Crit (Mortal): damage bypasses saves, only ward applies
      const wdmg = rollDice(weapon.damage) + (atkMods.damageMod || 0);
      if (defWardTh == null || !passesCheck(defWardTh)) {
        mortalDmg += wdmg;
      }
    } else if (hasCW && isCrit) {
      // Crit (Auto-wound): skip wound roll, go straight to save
      const effSave = calcEffSave(defSave, rend, 0, false);
      const sv = saveRollWithReroll(effSave, sr);
      if (sv.passed) continue;
      if (defWardTh != null && passesCheck(defWardTh)) continue;
      normalDmg += dmg;
    } else if (hasCH && isCrit) {
      // Crit (2 Hits): generates 2 wound rolls
      for (let h = 0; h < 2; h++) {
        if (!passesCheckReroll(eW, wr)) continue;
        const effSave = calcEffSave(defSave, rend, 0, false);
        const sv = saveRollWithReroll(effSave, sr);
        if (sv.passed) continue;
        if (defWardTh != null && passesCheck(defWardTh)) continue;
        normalDmg += dmg;
      }
    } else {
      // Normal hit: wound → save → ward
      if (!passesCheckReroll(eW, wr)) continue;
      const effSave = calcEffSave(defSave, rend, 0, false);
      const sv = saveRollWithReroll(effSave, sr);
      if (sv.passed) continue;
      if (defWardTh != null && passesCheck(defWardTh)) continue;
      normalDmg += dmg;
    }
  }

  return { normalDmg, mortalDmg };
}

// --- Simulate all weapons for one side (one iteration) ---

function rollAllWeapons(attacker, defender, atkMods, defMods, options, modelOverride, weaponFilter) {
  const defSave = parseThreshold(defender.save);
  const wardTh = defMods.ward ? parseThreshold(defMods.ward) : null;
  const totalSaveMod = (defMods.saveMod || 0) + (defMods.allOutDefence ? 1 : 0);

  let totalNormal = 0, totalMortal = 0;

  // Champion adds +1 attack to one weapon only (most basic: highest modelCount, lowest damage)
  let championWeapon = null;
  if (atkMods.champion) {
    for (const w of attacker.weapons) {
      if (!w.enabled) continue;
      const wt = (w.type || "melee").toLowerCase();
      if (weaponFilter === "ranged" && wt !== "ranged") continue;
      if (weaponFilter === "melee" && wt !== "melee") continue;
      if (w.companion ?? (w.ability || "").toLowerCase().includes("companion")) continue;
      if (!championWeapon
        || (w.modelCount || 1) > (championWeapon.modelCount || 1)
        || ((w.modelCount || 1) === (championWeapon.modelCount || 1) && parseDice(w.damage) < parseDice(championWeapon.damage))) {
        championWeapon = w;
      }
    }
  }

  for (const weapon of attacker.weapons) {
    if (!weapon.enabled) continue;
    const wType = (weapon.type || "melee").toLowerCase();
    if (weaponFilter === "ranged" && wType !== "ranged") continue;
    if (weaponFilter === "melee" && wType !== "melee") continue;

    const isComp = weapon.companion ?? (weapon.ability || "").toLowerCase().includes("companion");
    const wBase = weapon.modelCount || attacker.modelCount || 1;
    let wM = wBase;
    if (modelOverride !== null && modelOverride !== undefined) {
      const orig = attacker.modelCount || 1;
      wM = orig > 0 ? Math.max(0, wBase * (modelOverride / orig)) : 0;
    }

    // Hit/wound modifiers (mirrors combat.js logic)
    let hitMod = 0, wndMod = 0;
    if (isComp) {
      if (atkMods.allOutAttack) hitMod += 1;
      if ((atkMods.hitMod || 0) < 0) hitMod += atkMods.hitMod;
      if ((atkMods.woundMod || 0) < 0) wndMod += atkMods.woundMod;
    } else {
      hitMod = (atkMods.hitMod || 0) + (atkMods.allOutAttack ? 1 : 0);
      wndMod = atkMods.woundMod || 0;
    }
    hitMod = Math.max(-1, Math.min(1, hitMod));
    wndMod = Math.max(-1, Math.min(1, wndMod));

    let rend = parseDice(weapon.rend);
    let dmg = parseDice(weapon.damage);
    if (!isComp) {
      rend += (atkMods.rendMod || 0);
      dmg += (atkMods.damageMod || 0);
    }

    // Charge bonus
    const ab = (weapon.ability || "").toLowerCase();
    if (options.charged && ab.includes("charge (+1 damage)")) dmg += 1;

    // Anti-abilities
    const antiAbs = parseAntiAbilities(weapon.ability);
    for (const e of antiAbs) {
      let hit = false;
      if (e.keyword === "CHARGE") hit = options.wasCharged;
      else hit = (defender.keywords || []).some(k => k.toUpperCase() === e.keyword);
      if (hit) {
        if (e.type === "rend") rend += e.bonus;
        else dmg += e.bonus;
      }
    }

    // Crit setup
    const profileCM = ab.includes("crit (mortal)");
    const profileCW = ab.includes("crit (auto-wound)");
    const profileCH = ab.includes("crit (2 hits)");
    const hasProfileCrit = profileCM || profileCW || profileCH;
    const buffCrit = (!isComp && !hasProfileCrit) ? (atkMods.critBuff || "") : "";
    const hasCM = profileCM || buffCrit === "mortal";
    const hasCW = profileCW || buffCrit === "auto-wound";
    const hasCH = profileCH || buffCrit === "2 hits";
    const critTh = isComp ? 6 : Math.max(2, Math.min(6, atkMods.critOn || 6));

    const hitTh = (parseThreshold(weapon.hit) || 4) - hitMod;
    const wndTh = (parseThreshold(weapon.wound) || 4) - wndMod;

    // Pass base save adjusted for saveMod only; resolveWeapon applies rend via calcEffSave
    const adjSaveForWeapon = defSave != null ? defSave - totalSaveMod : null;

    const result = resolveWeapon(
      weapon, wM, atkMods,
      adjSaveForWeapon,
      wardTh,
      rend, dmg, hitTh, wndTh, critTh,
      hasCM, hasCW, hasCH,
      weapon === championWeapon,
      atkMods.hitReroll || "off",
      atkMods.woundReroll || "off",
      defMods.saveReroll || "off"
    );
    totalNormal += result.normalDmg;
    totalMortal += result.mortalDmg;
  }

  return { normalDmg: totalNormal, mortalDmg: totalMortal, totalDmg: totalNormal + totalMortal };
}

// --- Extra mortals (rolled per iteration) ---

function rollExtraMortals(firstDmgResult, secondDmgResult, firstUnit, secondUnit, firstOpts, secondOpts, firstAtkMods, secondAtkMods, firstDefMods, secondDefMods, combatMode) {
  const secondWardTh = secondDefMods.ward ? parseThreshold(secondDefMods.ward) : null;
  const firstWardTh = firstDefMods.ward ? parseThreshold(firstDefMods.ward) : null;

  let fExtra = 0, sExtra = 0;

  // Power Through (D3 average = 2, but we roll it)
  if (combatMode !== "shoot" && firstOpts.powerThrough) {
    const ptDmg = rollDice("D3");
    if (secondWardTh == null || !passesCheck(secondWardTh)) fExtra += ptDmg;
  }
  if (combatMode !== "shoot" && secondOpts.powerThrough) {
    const ptDmg = rollDice("D3");
    if (firstWardTh == null || !passesCheck(firstWardTh)) sExtra += ptDmg;
  }

  // OnX mortals (after-timing only for this function; before/during handled in main flow)
  const fOnXTiming = firstAtkMods.onXTiming || "after";
  if (fOnXTiming === "after" && firstAtkMods.onXThreshold) {
    const th = parseThreshold(firstAtkMods.onXThreshold);
    if (passesCheck(th)) {
      const dmg = rollDice(firstAtkMods.onXDamage || "D3");
      if (secondWardTh == null || !passesCheck(secondWardTh)) fExtra += dmg;
    }
  }
  const sOnXTiming = secondAtkMods.onXTiming || "after";
  if (sOnXTiming === "after" && secondAtkMods.onXThreshold) {
    const th = parseThreshold(secondAtkMods.onXThreshold);
    if (passesCheck(th)) {
      const dmg = rollDice(secondAtkMods.onXDamage || "D3");
      if (firstWardTh == null || !passesCheck(firstWardTh)) sExtra += dmg;
    }
  }

  // Per-model mortals
  if (firstAtkMods.perModelThreshold) {
    const th = parseThreshold(firstAtkMods.perModelThreshold);
    const enemyModels = secondUnit.modelCount || 0;
    for (let i = 0; i < enemyModels; i++) {
      if (passesCheck(th)) {
        if (secondWardTh == null || !passesCheck(secondWardTh)) fExtra += 1;
      }
    }
  }
  if (secondAtkMods.perModelThreshold) {
    const th = parseThreshold(secondAtkMods.perModelThreshold);
    const enemyModels = firstUnit.modelCount || 0;
    for (let i = 0; i < enemyModels; i++) {
      if (passesCheck(th)) {
        if (firstWardTh == null || !passesCheck(firstWardTh)) sExtra += 1;
      }
    }
  }

  return { fExtra, sExtra };
}

// --- Roll OnX for before/during timing ---

function rollOnX(atkMods, defWardTh, timing) {
  const onXTiming = atkMods.onXTiming || "after";
  if (onXTiming !== timing || !atkMods.onXThreshold) return 0;
  const th = parseThreshold(atkMods.onXThreshold);
  if (!passesCheck(th)) return 0;
  const dmg = rollDice(atkMods.onXDamage || "D3");
  if (defWardTh != null && passesCheck(defWardTh)) return 0;
  return dmg;
}

// ============================================================
// MAIN: Full combat simulation (one iteration)
// ============================================================

function simulateOnce(firstUnit, secondUnit, firstAtkMods, secondAtkMods, firstDefMods, secondDefMods, firstOpts, secondOpts, combatMode) {
  const defHealthFirst = parseDice(firstUnit.health);
  const defHealthSecond = parseDice(secondUnit.health);
  const secondWardTh = secondDefMods.ward ? parseThreshold(secondDefMods.ward) : null;
  const firstWardTh = firstDefMods.ward ? parseThreshold(firstDefMods.ward) : null;

  let fTotalDmg = 0, sTotalDmg = 0;
  let firstModels = firstUnit.modelCount || 1;
  let secondModels = secondUnit.modelCount || 1;

  // Adjust defence for allOutAttack (opponent's AoA penalizes your saves)
  const adjSecondDefMods = secondAtkMods.allOutAttack
    ? { ...secondDefMods, saveMod: (secondDefMods.saveMod || 0) - 1 } : secondDefMods;
  const adjFirstDefMods = firstAtkMods.allOutAttack
    ? { ...firstDefMods, saveMod: (firstDefMods.saveMod || 0) - 1 } : firstDefMods;

  // === PHASE: Shooting ===
  if (combatMode !== "melee") {
    const fShoot = rollAllWeapons(firstUnit, secondUnit, firstAtkMods, adjSecondDefMods, { ...firstOpts, charged: false }, null, "ranged");
    fTotalDmg += fShoot.totalDmg;

    // In Shoot+Charge only the charging (first-striking) unit shoots
    let sShoot = { totalDmg: 0 };
    if (combatMode !== "shootCharge") {
      sShoot = rollAllWeapons(secondUnit, firstUnit, secondAtkMods, adjFirstDefMods, { ...secondOpts, charged: false }, null, "ranged");
      sTotalDmg += sShoot.totalDmg;
    }

    // Apply shooting casualties
    const fShootKills = defHealthSecond > 0 ? Math.min(Math.floor(fShoot.totalDmg / defHealthSecond), secondModels) : 0;
    const sShootKills = defHealthFirst > 0 ? Math.min(Math.floor(sShoot.totalDmg / defHealthFirst), firstModels) : 0;
    firstModels = Math.max(0, firstModels - sShootKills);
    secondModels = Math.max(0, secondModels - fShootKills);
  }

  if (combatMode === "shoot") {
    // Shooting only — no melee
    const fKills = defHealthSecond > 0 ? Math.min(Math.floor(fTotalDmg / defHealthSecond), secondUnit.modelCount) : 0;
    const sKills = defHealthFirst > 0 ? Math.min(Math.floor(sTotalDmg / defHealthFirst), firstUnit.modelCount) : 0;
    return { fTotalDmg, sTotalDmg, fKills, sKills };
  }

  // === PHASE: Pre-combat mortals (OnX "before") ===
  const fBeforeMortals = rollOnX(firstAtkMods, secondWardTh, "before");
  const sBeforeMortals = rollOnX(secondAtkMods, firstWardTh, "before");
  fTotalDmg += fBeforeMortals;
  sTotalDmg += sBeforeMortals;
  if (defHealthSecond > 0) secondModels = Math.max(0, secondModels - Math.floor(fBeforeMortals / defHealthSecond));
  if (defHealthFirst > 0) firstModels = Math.max(0, firstModels - Math.floor(sBeforeMortals / defHealthFirst));

  // === PHASE: First striker melee ===
  const meleeModelOverride = combatMode === "shootCharge" ? firstModels : null;
  const fMelee = rollAllWeapons(firstUnit, secondUnit, firstAtkMods, adjSecondDefMods, firstOpts, meleeModelOverride, "melee");

  // During-combat mortals
  const fDuringMortals = rollOnX(firstAtkMods, secondWardTh, "during");
  const fMeleeTotal = fMelee.totalDmg + fDuringMortals;
  fTotalDmg += fMeleeTotal;

  // Calculate second unit survivors after first strike
  const meleeKills = defHealthSecond > 0 ? Math.min(Math.floor(fMeleeTotal / defHealthSecond), secondModels) : 0;
  secondModels = Math.max(0, secondModels - meleeKills);

  // === PHASE: Fight back ===
  let sMelee = { totalDmg: 0 };
  if (secondModels > 0) {
    sMelee = rollAllWeapons(secondUnit, firstUnit, secondAtkMods, adjFirstDefMods, secondOpts, secondModels, "melee");
    const sDuringMortals = rollOnX(secondAtkMods, firstWardTh, "during");
    sMelee.totalDmg += sDuringMortals;
    sTotalDmg += sMelee.totalDmg;

    const fbackKills = defHealthFirst > 0 ? Math.min(Math.floor(sMelee.totalDmg / defHealthFirst), firstModels) : 0;
    firstModels = Math.max(0, firstModels - fbackKills);
  }

  // === PHASE: Fight Twice (first striker) ===
  if (firstOpts.fightTwice && firstModels > 0) {
    const fFT = rollAllWeapons(firstUnit, secondUnit, firstAtkMods, adjSecondDefMods, firstOpts, firstModels, "melee");
    fTotalDmg += fFT.totalDmg;
    const ftKills = defHealthSecond > 0 ? Math.min(Math.floor(fFT.totalDmg / defHealthSecond), secondModels) : 0;
    secondModels = Math.max(0, secondModels - ftKills);
  }

  // === PHASE: Fight Twice (second striker) ===
  if (secondOpts.fightTwice && secondModels > 0) {
    const sFT = rollAllWeapons(secondUnit, firstUnit, secondAtkMods, adjFirstDefMods, secondOpts, secondModels, "melee");
    sTotalDmg += sFT.totalDmg;
    const ftKills = defHealthFirst > 0 ? Math.min(Math.floor(sFT.totalDmg / defHealthFirst), firstModels) : 0;
    firstModels = Math.max(0, firstModels - ftKills);
  }

  // === PHASE: Post-combat extra mortals ===
  const extras = rollExtraMortals(null, null, firstUnit, secondUnit, firstOpts, secondOpts, firstAtkMods, secondAtkMods, firstDefMods, secondDefMods, combatMode);
  fTotalDmg += extras.fExtra;
  sTotalDmg += extras.sExtra;

  // Final kill counts (based on total damage vs full unit HP pool)
  const fKills = defHealthSecond > 0 ? Math.min(Math.floor(fTotalDmg / defHealthSecond), secondUnit.modelCount) : 0;
  const sKills = defHealthFirst > 0 ? Math.min(Math.floor(sTotalDmg / defHealthFirst), firstUnit.modelCount) : 0;

  return { fTotalDmg, sTotalDmg, fKills, sKills };
}

// ============================================================
// PUBLIC: Run N iterations and aggregate statistics
// ============================================================

export function runSimulation({ firstUnit, secondUnit, firstAtkMods, secondAtkMods, firstDefMods, secondDefMods, firstOpts, secondOpts, combatMode, iterations = 10000 }) {
  const fDamages = new Float32Array(iterations);
  const sDamages = new Float32Array(iterations);
  const fKillsArr = new Uint16Array(iterations);
  const sKillsArr = new Uint16Array(iterations);

  for (let i = 0; i < iterations; i++) {
    const r = simulateOnce(firstUnit, secondUnit, firstAtkMods, secondAtkMods, firstDefMods, secondDefMods, firstOpts, secondOpts, combatMode);
    fDamages[i] = r.fTotalDmg;
    sDamages[i] = r.sTotalDmg;
    fKillsArr[i] = r.fKills;
    sKillsArr[i] = r.sKills;
  }

  return {
    iterations,
    first: aggregateStats(fDamages, fKillsArr, secondUnit.modelCount || 1),
    second: aggregateStats(sDamages, sKillsArr, firstUnit.modelCount || 1),
  };
}

function aggregateStats(damages, kills, enemyModelCount) {
  const n = damages.length;
  const sortedDmg = Array.from(damages).sort((a, b) => a - b);
  const sortedKills = Array.from(kills).sort((a, b) => a - b);

  const sumDmg = sortedDmg.reduce((s, v) => s + v, 0);
  const sumKills = sortedKills.reduce((s, v) => s + v, 0);

  const pct = (arr, p) => arr[Math.floor(p * arr.length)] || 0;

  // Whiff chance (0 total damage)
  let whiffCount = 0;
  // Kill-half chance (kills >= ceil(enemyModels/2))
  const halfThreshold = Math.ceil(enemyModelCount / 2);
  let halfKillCount = 0;
  for (let i = 0; i < n; i++) {
    if (damages[i] <= 0) whiffCount++;
    if (kills[i] >= halfThreshold) halfKillCount++;
  }

  // Damage histogram (bucket by integer)
  const maxDmg = Math.ceil(sortedDmg[n - 1] || 0);
  const dmgBuckets = new Array(maxDmg + 1).fill(0);
  for (let i = 0; i < n; i++) dmgBuckets[Math.floor(damages[i])] = (dmgBuckets[Math.floor(damages[i])] || 0) + 1;

  // Kill histogram
  const killBuckets = new Array(enemyModelCount + 1).fill(0);
  for (let i = 0; i < n; i++) {
    const k = Math.min(kills[i], enemyModelCount);
    killBuckets[k]++;
  }

  // Cumulative kill chance: chance to kill >= X models
  const killCumulative = new Array(enemyModelCount + 1).fill(0);
  let cumSum = 0;
  for (let k = enemyModelCount; k >= 0; k--) {
    cumSum += killBuckets[k];
    killCumulative[k] = cumSum / n;
  }

  const avgKills = sumKills / n;

  return {
    avgDamage: sumDmg / n,
    medianDamage: pct(sortedDmg, 0.5),
    avgKills,
    medianKills: pct(sortedKills, 0.5),
    wipeChance: killCumulative[enemyModelCount] || 0,
    whiffChance: whiffCount / n,
    halfKillChance: halfKillCount / n,
    modelsRemaining: Math.max(0, enemyModelCount - avgKills),
    percentiles: {
      p10: pct(sortedDmg, 0.1),
      p25: pct(sortedDmg, 0.25),
      p50: pct(sortedDmg, 0.5),
      p75: pct(sortedDmg, 0.75),
      p90: pct(sortedDmg, 0.9),
    },
    dmgBuckets,
    killBuckets,
    killCumulative,
    min: sortedDmg[0],
    max: sortedDmg[n - 1],
  };
}
