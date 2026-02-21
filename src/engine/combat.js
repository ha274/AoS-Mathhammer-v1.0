// ============================================================
// AoS 4th Edition Combat Engine
// Pure math — no React, no DOM, fully testable
// ============================================================

export function parseDice(val) {
  if (val === "-" || val === "" || val == null) return 0;
  const s = String(val).trim().replace(/\u2212/g, "-");
  const mPlus = s.match(/^(\d*)D(\d+)\s*\+\s*(\d+)$/i);
  if (mPlus) return (mPlus[1] ? parseInt(mPlus[1]) : 1) * (parseInt(mPlus[2]) + 1) / 2 + parseInt(mPlus[3]);
  const m = s.match(/^(\d*)D(\d+)$/i);
  if (m) return (m[1] ? parseInt(m[1]) : 1) * (parseInt(m[2]) + 1) / 2;
  return parseFloat(s) || 0;
}

export function parseThreshold(val) {
  if (!val || val === "-") return null;
  const n = parseInt(String(val).replace(/\u2212/g, "-").replace("+", ""));
  return isNaN(n) ? null : n;
}

export function probPass(th) {
  if (th == null) return 0;
  return Math.min(5 / 6, Math.max(1 / 6, (7 - th) / 6));
}

export function probFail(th) {
  if (th == null) return 1;
  return 1 - probPass(th);
}

export function calcPFailSave(baseSave, rend, saveMod = 0, aod = false) {
  if (baseSave == null) return 1;
  let eff = baseSave + rend - saveMod;
  if (aod) eff -= 1;
  eff = Math.max(2, eff);
  if (eff >= 7) return 1;
  return probFail(eff);
}

export function calcEffSave(baseSave, rend, saveMod = 0, aod = false) {
  if (baseSave == null) return 7;
  let eff = baseSave + rend - saveMod;
  if (aod) eff -= 1;
  return Math.max(2, eff);
}

export function calcPFailWard(wardTh) {
  return wardTh == null ? 1 : probFail(wardTh);
}

// Reroll helpers for expected-value math
// "ones" = reroll rolls of 1 only; "full" = reroll all fails
export function applyRerollPass(pPass, rerollType) {
  if (rerollType === "ones") return pPass + (1 / 6) * pPass;
  if (rerollType === "full") return 1 - Math.pow(1 - pPass, 2);
  return pPass;
}

export function applyRerollFail(pFail, rerollType) {
  if (rerollType === "ones") return pFail * (7 / 6) - (1 / 6);
  if (rerollType === "full") return pFail * pFail;
  return pFail;
}

export function parseAntiAbilities(ab) {
  if (!ab || ab === "-") return [];
  const out = [];
  const re = /anti-([\w]+(?:\s+[\w]+)*)\s*\(\+(\d+)\s*(rend|damage)\)/gi;
  let m;
  while ((m = re.exec(ab)) !== null) {
    const keyword = m[1].replace(/[.,;:!]+$/, "").trim().toUpperCase();
    if (keyword) out.push({ keyword, bonus: parseInt(m[2]), type: m[3].toLowerCase() });
  }
  return out;
}

export function resolveAnti(ab, defKeywords = [], wasCharged = false) {
  let rB = 0, dB = 0;
  for (const e of parseAntiAbilities(ab)) {
    let hit = false;
    if (e.keyword === "CHARGE") { hit = wasCharged; }
    else { hit = (defKeywords || []).some(k => k.toUpperCase() === e.keyword); }
    if (hit) { if (e.type === "rend") rB += e.bonus; else dB += e.bonus; }
  }
  return { rendBonus: rB, dmgBonus: dB };
}

export function simulateCombat(attacker, defender, atkMods, defMods, options = {}, modelOverride = null, weaponFilter = null) {
  const results = { weapons: [], totalDamage: 0, totalMortalDamage: 0 };
  const defSave = parseThreshold(defender.save);
  const defHealth = parseDice(defender.health);
  const defModels = defender.modelCount || 1;
  const totalHP = defHealth * defModels;
  const wardTh = defMods.ward ? parseThreshold(defMods.ward) : null;
  const fW = calcPFailWard(wardTh);

  // Champion adds +1 attack total to the most basic weapon only (not all weapons).
  // Pick the eligible weapon with highest modelCount; break ties by lowest damage.
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
    if (modelOverride !== null) {
      const orig = attacker.modelCount || 1;
      wM = orig > 0 ? Math.max(0, wBase * (modelOverride / orig)) : 0;
    }

    let baseAtk = parseDice(weapon.attacks);
    if (!isComp) {
      baseAtk += (atkMods.extraAttacks || 0);
      if (weapon === championWeapon && wM >= 1) baseAtk += 1 / wM;
    }
    const tAtk = baseAtk * wM;
    if (tAtk <= 0) continue;

    const hitTh = parseThreshold(weapon.hit);
    const wndTh = parseThreshold(weapon.wound);
    let rend = parseDice(weapon.rend);
    let dmg = parseDice(weapon.damage);

    let hitMod = 0, wndMod = 0;
    if (isComp) {
      if (atkMods.allOutAttack) hitMod += 1;
      if ((atkMods.hitMod || 0) < 0) hitMod += atkMods.hitMod;
      if ((atkMods.woundMod || 0) < 0) wndMod += atkMods.woundMod;
    } else {
      hitMod = (atkMods.hitMod || 0) + (atkMods.allOutAttack ? 1 : 0);
      wndMod = atkMods.woundMod || 0;
      rend += (atkMods.rendMod || 0);
      dmg += (atkMods.damageMod || 0);
    }

    hitMod = Math.max(-1, Math.min(1, hitMod));
    wndMod = Math.max(-1, Math.min(1, wndMod));

    const ab = (weapon.ability || "").toLowerCase();
    if (options.charged && ab.includes("charge (+1 damage)")) dmg += 1;

    const anti = resolveAnti(weapon.ability, defender.keywords || [], options.wasCharged);
    rend += anti.rendBonus;
    dmg += anti.dmgBonus;

    const eH = Math.max(2, (hitTh || 4) - hitMod);
    const pH = applyRerollPass(probPass(eH), atkMods.hitReroll || "off");
    const critTh = isComp ? 6 : Math.max(2, Math.min(6, atkMods.critOn || 6));
    const pC = (7 - critTh) / 6;
    const eW = Math.max(2, (wndTh || 4) - wndMod);
    const pW = applyRerollPass(probPass(eW), atkMods.woundReroll || "off");
    const totalSaveMod = (defMods.saveMod || 0) + (defMods.allOutDefence ? 1 : 0);
    const eS = calcEffSave(defSave, rend, totalSaveMod, false);
    const pFS = applyRerollFail(calcPFailSave(defSave, rend, totalSaveMod, false), defMods.saveReroll || "off");

    const profileCM = ab.includes("crit (mortal)");
    const profileCW = ab.includes("crit (auto-wound)");
    const profileCH = ab.includes("crit (2 hits)");
    const hasProfileCrit = profileCM || profileCW || profileCH;
    const buffCrit = (!isComp && !hasProfileCrit) ? (atkMods.critBuff || "") : "";
    const hasCM = profileCM || buffCrit === "mortal";
    const hasCW = profileCW || buffCrit === "auto-wound";
    const hasCH = profileCH || buffCrit === "2 hits";

    let avgD = 0, avgM = 0, critD = 0;
    const nHP = Math.max(0, pH - pC);

    if (hasCM) {
      critD = tAtk * pC * dmg * fW;
      avgM = critD;
      avgD = tAtk * nHP * pW * pFS * dmg * fW;
    } else if (hasCW) {
      critD = tAtk * pC * pFS * dmg * fW;
      avgD = critD + tAtk * nHP * pW * pFS * dmg * fW;
    } else if (hasCH) {
      critD = tAtk * pC * 2 * pW * pFS * dmg * fW;
      avgD = critD + tAtk * nHP * pW * pFS * dmg * fW;
    } else {
      avgD = tAtk * pH * pW * pFS * dmg * fW;
      critD = 0;
    }

    results.weapons.push({
      name: weapon.name, attacks: tAtk, avgDamage: avgD + avgM,
      pHit: pH, pWound: pW, pFailSave: pFS, pFailWard: fW,
      effHit: eH, effWnd: eW, effSave: eS, rend, dmg,
      isComp, hasCM, hasCW, hasCH,
      critDamage: critD, critSource: hasCM ? "Mortal" : hasCW ? "Auto-wound" : hasCH ? "2 Hits" : "",
      critFromBuff: buffCrit !== "", critTh,
    });
    results.totalDamage += avgD;
    results.totalMortalDamage += avgM;
  }

  const grand = results.totalDamage + results.totalMortalDamage;
  results.totalDamage = grand;
  results.modelsKilled = defHealth > 0 ? Math.min(Math.floor(grand / defHealth), defModels) : 0;
  results.percentUnitKilled = totalHP > 0 ? Math.min(100, (grand / totalHP) * 100) : 0;
  results.remainingModels = Math.max(0, defModels - results.modelsKilled);
  return results;
}

export function calcExtraMortals({ firstR, secondR, firstUnit, secondUnit, firstOpts, secondOpts, firstAtkMods, secondAtkMods, firstDefMods, secondDefMods, combatMode }) {
  const secondWardTh = secondDefMods.ward ? parseThreshold(secondDefMods.ward) : null;
  const firstWardTh = firstDefMods.ward ? parseThreshold(firstDefMods.ward) : null;

  const fPTDmg = (combatMode !== "shoot" && firstOpts.powerThrough) ? 2.0 * calcPFailWard(secondWardTh) : 0;
  const sPTDmg = (combatMode !== "shoot" && secondOpts.powerThrough) ? 2.0 * calcPFailWard(firstWardTh) : 0;
  const fOnXDmg = firstAtkMods.onXThreshold
    ? probPass(parseThreshold(firstAtkMods.onXThreshold)) * parseDice(firstAtkMods.onXDamage || "D3") * calcPFailWard(secondWardTh) : 0;
  const sOnXDmg = secondAtkMods.onXThreshold
    ? probPass(parseThreshold(secondAtkMods.onXThreshold)) * parseDice(secondAtkMods.onXDamage || "D3") * calcPFailWard(firstWardTh) : 0;
  const fPMDmg = firstAtkMods.perModelThreshold
    ? (secondUnit.modelCount || 0) * probPass(parseThreshold(firstAtkMods.perModelThreshold)) * calcPFailWard(secondWardTh) : 0;
  const sPMDmg = secondAtkMods.perModelThreshold
    ? (firstUnit.modelCount || 0) * probPass(parseThreshold(secondAtkMods.perModelThreshold)) * calcPFailWard(firstWardTh) : 0;

  const calcReflect = (combatResult, defenderOpts, attackerWardTh) => {
    if (!defenderOpts.save6Reflect || combatMode === "shoot") return 0;
    let atkReachingSave = 0;
    for (const w of combatResult.weapons) atkReachingSave += w.attacks * w.pHit * w.pWound;
    return atkReachingSave * (1 / 6) * calcPFailWard(attackerWardTh);
  };
  const reflectToFirst = calcReflect(firstR, secondOpts, firstWardTh);
  const reflectToSecond = calcReflect(secondR, firstOpts, secondWardTh);

  // Split OnX by timing phase (before / during / after combat)
  const fOnXTiming = firstAtkMods.onXTiming || "after";
  const sOnXTiming = secondAtkMods.onXTiming || "after";

  const fOnXBefore = fOnXTiming === "before" ? fOnXDmg : 0;
  const fOnXDuring = fOnXTiming === "during" ? fOnXDmg : 0;
  const fOnXAfter  = fOnXTiming === "after"  ? fOnXDmg : 0;
  const sOnXBefore = sOnXTiming === "before" ? sOnXDmg : 0;
  const sOnXDuring = sOnXTiming === "during" ? sOnXDmg : 0;
  const sOnXAfter  = sOnXTiming === "after"  ? sOnXDmg : 0;

  return {
    fPTDmg, sPTDmg, fOnXDmg, sOnXDmg, fPMDmg, sPMDmg,
    reflectToFirst, reflectToSecond,
    // Timing-split OnX
    fOnXBefore, fOnXDuring, fOnXAfter,
    sOnXBefore, sOnXDuring, sOnXAfter,
    fOnXTiming, sOnXTiming,
    // Totals
    fExtraMortals: fPTDmg + fOnXDmg + fPMDmg + reflectToSecond,
    sExtraMortals: sPTDmg + sOnXDmg + sPMDmg + reflectToFirst,
  };
}
