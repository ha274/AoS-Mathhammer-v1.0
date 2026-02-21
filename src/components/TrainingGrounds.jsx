import { useState, useMemo, useCallback } from 'react';
import { C, bI } from '../styles';
import { parseDice, parseThreshold, probPass, simulateCombat, calcPFailWard } from '../engine/combat';
import { PRESETS } from '../data/presets';
import { TARGETS } from '../data/targets';
import { defaultMods, defaultOpts, emptyWeapon } from '../data/defaults';
import UnitSelector from './UnitSelector';
import WeaponRow from './WeaponRow';
import Tog from './ui/Tog';
import Stepper from './ui/Stepper';

// Attempt to auto-detect combat modifiers from ability effect text
function detectAbilityMods(ability) {
  const mods = {};
  const fx = ability.effect || "";
  const mortalMatch = fx.match(/inflict\s+(?:an amount of\s+)?(?:(\d+|D3|D6)\s+)?mortal\s+damage/i);
  if (mortalMatch) mods.mortalDamage = mortalMatch[1] || "D3";
  const rollMatch = fx.match(/(?:roll\s+a?\s*)(D3|D6|dice).*?on\s+a?\s*(\d+)\+/i);
  if (rollMatch) { mods.mortalThreshold = `${rollMatch[2]}+`; mods.mortalDice = rollMatch[1]; }
  const addMatch = fx.match(/add\s+(\d+)\s+to\s+the\s+(attacks?|damage|rend|hit|wound)\s+characteristic/i);
  if (addMatch) {
    const val = parseInt(addMatch[1]);
    const stat = addMatch[2].toLowerCase();
    if (stat.startsWith("attack")) mods.extraAttacks = val;
    else if (stat === "damage") mods.damageMod = val;
    else if (stat === "rend") mods.rendMod = val;
    else if (stat === "hit") mods.hitMod = val;
    else if (stat === "wound") mods.woundMod = val;
  }
  if (/strike-last/i.test(fx)) mods.strikeLast = true;
  if (/strike-first/i.test(fx)) mods.strikeFirst = true;
  const wardMatch = fx.match(/ward\s*\((\d+\+)\)/i) || fx.match(/ward\s+save\s+of\s+(\d+\+)/i);
  if (wardMatch) mods.ward = wardMatch[1];
  return Object.keys(mods).length > 0 ? mods : null;
}

const abilityTypeColors = { activated: "#e8a848", passive: "#68b8e8", spell: "#b888dd", prayer: "#e86868", other: "#776b55" };
const abilityTypeLabels = { activated: "ACT", passive: "PASSIVE", spell: "SPELL", prayer: "PRAYER", other: "OTHER" };

// Score colour ramp: red -> orange -> yellow -> green
function scoreColor(score) {
  if (score >= 120) return "#5cc888";
  if (score >= 85) return "#8dcc5c";
  if (score >= 55) return "#c9a84c";
  if (score >= 30) return "#d08040";
  return "#c06050";
}

function scoreGrade(score) {
  if (score >= 120) return "S";
  if (score >= 95) return "A";
  if (score >= 70) return "B";
  if (score >= 45) return "C";
  if (score >= 25) return "D";
  return "F";
}

// Bar width as percentage (cap at 200 ROI for visual)
function barWidth(score) {
  return Math.min(100, (score / 200) * 100);
}

export default function TrainingGrounds({ bsdataUnits, showLegacy, customPresets }) {
  // Unit state
  const [unit, setUnit] = useState(() => JSON.parse(JSON.stringify(PRESETS[0])));
  const [atkMods, setAtkMods] = useState(defaultMods());
  const [opts, setOpts] = useState(defaultOpts());

  // Phase toggles
  const [phase, setPhase] = useState("melee"); // "shoot" | "shootCharge" | "melee"

  // Defence buff toggles (applied to ALL targets)
  const [defWard, setDefWard] = useState("");
  const [defAOD, setDefAOD] = useState(false);
  const [defSaveReroll, setDefSaveReroll] = useState("off");

  // Reinforce targets toggle (doubles models + points, excludes HERO/MONSTER)
  const [reinforced, setReinforced] = useState(false);

  // Reinforce attacker toggle
  const [atkReinforced, setAtkReinforced] = useState(false);

  // Per-target stat overrides (clickable to cycle)
  const [targetOverrides, setTargetOverrides] = useState({});
  const cycleTargetStat = useCallback((id, field, current) => {
    const cycles = {
      save: ["6+", "5+", "4+", "3+", "2+", "-"],
      ward: ["-", "6+", "5+", "4+"],
      health: ["1", "2", "3", "4", "5", "6", "8", "10", "12", "14", "18"],
      modelCount: [1, 3, 5, 10, 20],
    };
    const cycle = cycles[field];
    const display = field === "ward" ? (current || "-") : (field === "save" && current === "7+" ? "-" : String(current));
    const idx = cycle.indexOf(field === "modelCount" ? Number(current) : display);
    const next = cycle[(idx + 1) % cycle.length];
    setTargetOverrides(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: field === "save" ? (next === "-" ? "7+" : next)
          : field === "ward" ? (next === "-" ? "" : next)
          : field === "modelCount" ? Number(next)
          : String(next),
      }
    }));
  }, []);

  // Collapsible panels
  const [showCrit, setShowCrit] = useState(false);
  const [showMortals, setShowMortals] = useState(false);
  const [showAbilities, setShowAbilities] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showWeapons, setShowWeapons] = useState(false);
  const [showAtkBuffs, setShowAtkBuffs] = useState(false);

  const lbl = { fontSize: 10, color: C.dGold, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 2 };

  const handleImport = useCallback((imported) => {
    const hasChamp = (imported.keywords || []).some(k => k.toUpperCase() === "CHAMPION");
    const saved = imported.savedCombatConfig;
    setAtkMods(prev => ({
      ...prev,
      champion: hasChamp,
      critOn: saved?.critOn ?? 6,
      critBuff: saved?.critBuff ?? "",
      onXThreshold: saved?.onXThreshold ?? "",
      onXDamage: saved?.onXDamage ?? "",
      onXTiming: saved?.onXTiming ?? "after",
      perModelThreshold: saved?.perModelThreshold ?? "",
    }));
    setUnit(imported);
  }, []);

  // Compute effective attacker (with reinforcement applied)
  const effUnit = useMemo(() => {
    if (!atkReinforced || unit.modelCount <= 1) return unit;
    return {
      ...unit,
      modelCount: unit.modelCount * 2,
      points: unit.points * 2,
      weapons: unit.weapons.map(w => ({ ...w, modelCount: (w.modelCount || unit.modelCount) * 2 })),
    };
  }, [unit, atkReinforced]);

  // Run combat against every target
  const results = useMemo(() => {
    const unitPts = effUnit.points || 1;
    const hasRanged = effUnit.weapons.some(w => w.enabled && (w.type || "melee") === "ranged");

    return TARGETS.map(baseTarget => {
      // Apply per-target overrides
      const ovr = targetOverrides[baseTarget.id] || {};
      const customTarget = { ...baseTarget, ...ovr };

      // Reinforce: double models + points for non-HERO/MONSTER targets
      const kws = (customTarget.keywords || []).map(k => k.toUpperCase());
      const canReinforce = !kws.includes("HERO") && !kws.includes("MONSTER");
      const target = (reinforced && canReinforce)
        ? { ...customTarget, modelCount: customTarget.modelCount * 2, points: customTarget.points * 2 }
        : customTarget;

      // Use per-target ward if it has one, otherwise use global toggle
      // Pick the better (lower threshold = stronger) ward
      const targetWard = target.ward || "";
      const effectiveWard = targetWard && defWard
        ? (parseThreshold(targetWard) <= parseThreshold(defWard) ? targetWard : defWard)
        : targetWard || defWard;

      const defMods = {
        ...defaultMods(),
        ward: effectiveWard,
        allOutDefence: defAOD,
        saveReroll: defSaveReroll,
        champion: false,
      };

      // Shooting
      let shootResult = null;
      if (phase !== "melee" && hasRanged) {
        const shootOpts = { ...opts, charged: false };
        shootResult = simulateCombat(effUnit, target, atkMods, defMods, shootOpts, null, "ranged");
      }

      // Melee
      let meleeResult = null;
      if (phase !== "shoot") {
        meleeResult = simulateCombat(effUnit, target, atkMods, defMods, opts, null, "melee");
      }

      // Aggregate pipeline from weapon results (atk → hit → wnd → dmg)
      const allWeapons = [
        ...(shootResult ? shootResult.weapons : []),
        ...(meleeResult ? meleeResult.weapons : []),
      ];
      let pAtk = 0, pHits = 0, pWounds = 0, pDmg = 0;
      for (const w of allWeapons) {
        const a = w.attacks;
        const h = a * w.pHit;
        const wn = h * w.pWound;
        pAtk += a;
        pHits += h;
        pWounds += wn;
        pDmg += w.avgDamage;
      }

      // Extra mortals (onX, perModel)
      const wardTh = effectiveWard ? parseThreshold(effectiveWard) : null;
      const fW = calcPFailWard(wardTh);
      let extraMortals = 0;

      if (atkMods.onXThreshold) {
        const onXDmg = probPass(parseThreshold(atkMods.onXThreshold)) * parseDice(atkMods.onXDamage || "D3") * fW;
        extraMortals += onXDmg;
      }
      if (atkMods.perModelThreshold) {
        const pmDmg = (target.modelCount || 0) * probPass(parseThreshold(atkMods.perModelThreshold)) * fW;
        extraMortals += pmDmg;
      }
      if (opts.powerThrough) {
        const myHealth = parseDice(effUnit.health);
        const tgtHealth = parseDice(target.health);
        if (myHealth > tgtHealth && tgtHealth > 0) {
          extraMortals += 2.0 * fW;
        }
      }

      const shootDmg = shootResult ? shootResult.totalDamage : 0;
      const meleeDmg = meleeResult ? meleeResult.totalDamage : 0;
      const totalDmg = shootDmg + meleeDmg + extraMortals;

      const defHealth = parseDice(target.health);
      const totalHP = defHealth * target.modelCount;
      const kills = defHealth > 0 ? Math.min(Math.floor(totalDmg / defHealth), target.modelCount) : 0;
      const pctKilled = totalHP > 0 ? Math.min(100, (totalDmg / totalHP) * 100) : 0;
      // Damage-based scoring: partial credit for damage dealt (not just full kills)
      // This means doing 11dmg to a 12HP monster scores ~92% instead of 0%
      const pctDamaged = totalHP > 0 ? Math.min(1, totalDmg / totalHP) : 0;
      const ptsDestroyed = pctDamaged * target.points;
      const roi = unitPts > 0 ? (ptsDestroyed / unitPts) * 100 : 0;

      const wiped = totalDmg >= totalHP && totalHP > 0;
      const wastedDmg = wiped ? totalDmg - totalHP : 0;
      const overkillPct = wiped && totalHP > 0 ? (wastedDmg / totalHP) * 100 : 0;

      return {
        target,
        baseId: baseTarget.id,
        isReinforced: reinforced && canReinforce,
        shootDmg,
        meleeDmg,
        extraMortals,
        totalDmg,
        totalHP,
        kills,
        pctKilled,
        ptsDestroyed,
        roi,
        wiped,
        wastedDmg,
        overkillPct,
        pipeline: { atk: pAtk, hits: pHits, wounds: pWounds, dmg: pDmg },
      };
    });
  }, [effUnit, atkMods, opts, phase, defWard, defAOD, defSaveReroll, reinforced, targetOverrides]);

  // Overall MH Score = average ROI across all targets
  const overallScore = useMemo(() => {
    if (results.length === 0) return 0;
    return results.reduce((s, r) => s + r.roi, 0) / results.length;
  }, [results]);

  const bestMatchup = useMemo(() => results.reduce((best, r) => r.roi > best.roi ? r : best, results[0]), [results]);
  const worstMatchup = useMemo(() => results.reduce((worst, r) => r.roi < worst.roi ? r : worst, results[0]), [results]);

  // Check if unit has any ranged weapons
  const hasRanged = effUnit.weapons.some(w => w.enabled && (w.type || "melee") === "ranged");

  const uW = (i, w) => { const ws = [...unit.weapons]; ws[i] = w; setUnit({ ...unit, weapons: ws }); };

  return <div style={{ maxWidth: 1200, margin: "0 auto" }}>

    {/* UNIT CONFIGURATION */}
    <div style={{ background: "linear-gradient(180deg, rgba(30,26,20,0.95) 0%, rgba(20,18,14,0.98) 100%)", border: `1px solid ${C.gold}33`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, color: C.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, borderBottom: `2px solid ${C.gold}44`, paddingBottom: 8 }}>
        Your Unit
      </div>

      {/* Preset selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <select value="" onChange={e => {
          if (!e.target.value) return;
          if (e.target.value.startsWith("custom:")) {
            const p = customPresets.find(x => x.name === e.target.value.slice(7));
            if (p) handleImport(JSON.parse(JSON.stringify(p)));
          } else {
            const p = PRESETS.find(x => x.name === e.target.value);
            if (p) handleImport(JSON.parse(JSON.stringify(p)));
          }
        }} style={{ ...bI, width: "auto", fontSize: 14, padding: "3px 6px", cursor: "pointer", flex: 1, color: "#e8dcc4", background: "#1a1814" }}>
          <option value="">Load Preset...</option>
          {customPresets.length > 0 && <optgroup label="Saved Units">
            {customPresets.map(p => <option key={`c_${p.name}`} value={`custom:${p.name}`}>{p.name} [{p.points}pts]</option>)}
          </optgroup>}
          <optgroup label="Built-in">
            {PRESETS.map(p => <option key={p.name} value={p.name}>{p.name} [{p.points}pts]</option>)}
          </optgroup>
        </select>
      </div>

      <UnitSelector units={bsdataUnits} showLegacy={showLegacy} onSelectUnit={handleImport} />

      {/* Unit stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 8, marginBottom: 8 }}>
        <div><div style={lbl}>Unit Name</div><input value={unit.name} onChange={e => setUnit({ ...unit, name: e.target.value })} style={bI} /></div>
        <div><div style={lbl}>Points</div><input type="number" value={unit.points} onChange={e => setUnit({ ...unit, points: parseInt(e.target.value) || 0 })} style={{ ...bI, textAlign: "center" }} /></div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <button onClick={() => setShowStats(!showStats)} style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
          color: C.fGold, borderRadius: 4, cursor: "pointer", fontSize: 10,
          padding: "4px 10px", fontFamily: "'Cinzel', serif", letterSpacing: 1,
          textTransform: "uppercase", width: "100%", textAlign: "left",
        }}>
          {showStats ? "\u25BE" : "\u25B8"} Unit Stats
          {!showStats && <span style={{ marginLeft: 8, fontSize: 9, opacity: 0.8 }}>
            {unit.modelCount || 1} models | HP {unit.health} | Sv {unit.save}
          </span>}
        </button>
        {showStats && <div style={{ marginTop: 6 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {[["modelCount", "Models", "number"], ["health", "Health"], ["save", "Save"]].map(([k, l, t]) =>
              <div key={k} style={{ flex: 1, minWidth: 55 }}><div style={lbl}>{l}</div>
                <input type={t || "text"} value={unit[k]} onChange={e => {
                  const val = t === "number" ? (parseInt(e.target.value) || 1) : e.target.value;
                  if (k === "modelCount") {
                    const newWeapons = unit.weapons.map(w => ({ ...w, modelCount: val }));
                    setUnit({ ...unit, modelCount: val, weapons: newWeapons });
                  } else {
                    setUnit({ ...unit, [k]: val });
                  }
                }} style={{ ...bI, textAlign: "center" }} min={t === "number" ? 1 : undefined} /></div>
            )}
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={lbl}>Keywords</div>
            <input value={(unit.keywords || []).join(", ")}
              onChange={e => setUnit({ ...unit, keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean) })}
              style={{ ...bI, fontSize: 11 }} placeholder="INFANTRY, MONSTER, DAEMON..." />
          </div>
        </div>}
      </div>

      {/* UNIT ABILITIES */}
      {(() => {
        const abilities = unit.abilities || [];
        const combatAbilities = abilities.filter(a => a.combatRelevant);
        if (abilities.length === 0) return null;
        return <div style={{ marginBottom: 10 }}>
          <button onClick={() => setShowAbilities(!showAbilities)} style={{
            background: showAbilities ? "rgba(104,184,232,0.08)" : "transparent",
            border: `1px solid ${showAbilities ? "rgba(104,184,232,0.25)" : "rgba(255,255,255,0.06)"}`,
            color: showAbilities ? "#68b8e8" : C.fGold, borderRadius: 4, cursor: "pointer", fontSize: 10,
            padding: "4px 10px", fontFamily: "'Cinzel', serif", letterSpacing: 1, textTransform: "uppercase",
            width: "100%", textAlign: "left", transition: "all 0.15s",
          }}>
            {showAbilities ? "\u25BE" : "\u25B8"} Unit Abilities ({abilities.length})
            {combatAbilities.length > 0 && <span style={{ marginLeft: 6, fontSize: 9, color: "#e8a848" }}>
              {combatAbilities.length} combat-relevant
            </span>}
          </button>
          {showAbilities && <div style={{ padding: "6px 0 2px", borderLeft: "2px solid rgba(104,184,232,0.15)", paddingLeft: 8, marginTop: 4, maxHeight: 300, overflowY: "auto" }}>
            {abilities.map((a, i) => {
              const mods = detectAbilityMods(a);
              const color = abilityTypeColors[a.type] || C.fGold;
              return <div key={i} style={{ marginBottom: 8, padding: "6px 8px", background: a.combatRelevant ? "rgba(232,168,72,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${a.combatRelevant ? "rgba(232,168,72,0.2)" : "rgba(255,255,255,0.04)"}`, borderRadius: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: `${color}20`, color, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>
                    {abilityTypeLabels[a.type] || "?"}
                  </span>
                  <span style={{ fontSize: 11, color: "#e8dcc4", fontWeight: 600 }}>{a.name}</span>
                  {a.combatRelevant && <span style={{ fontSize: 8, color: "#e8a848", fontStyle: "italic" }}>COMBAT</span>}
                </div>
                {a.timing && <div style={{ fontSize: 9, color: C.fGold, marginBottom: 2 }}>
                  <span style={{ color: C.dGold }}>Timing:</span> {a.timing}
                </div>}
                {a.declare && <div style={{ fontSize: 9, color: C.fGold, marginBottom: 2, lineHeight: 1.3 }}>
                  <span style={{ color: C.dGold }}>Declare:</span> {a.declare}
                </div>}
                <div style={{ fontSize: 9, color: "#c0b898", lineHeight: 1.3 }}>
                  <span style={{ color: C.dGold }}>Effect:</span> {a.effect}
                </div>
                {mods && <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {mods.mortalDamage && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(232,104,104,0.15)", color: "#e86868" }}>
                    {mods.mortalThreshold ? `${mods.mortalDice || "D3"} on ${mods.mortalThreshold}` : mods.mortalDamage} mortal dmg
                  </span>}
                  {mods.extraAttacks && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(201,168,76,0.15)", color: C.gold }}>+{mods.extraAttacks} Attacks</span>}
                  {mods.damageMod && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(201,168,76,0.15)", color: C.gold }}>+{mods.damageMod} Damage</span>}
                  {mods.rendMod && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(201,168,76,0.15)", color: C.gold }}>+{mods.rendMod} Rend</span>}
                  {mods.hitMod && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(201,168,76,0.15)", color: C.gold }}>+{mods.hitMod} Hit</span>}
                  {mods.woundMod && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(201,168,76,0.15)", color: C.gold }}>+{mods.woundMod} Wound</span>}
                  {mods.strikeLast && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(232,104,104,0.15)", color: "#e86868" }}>Strike-last</span>}
                  {mods.strikeFirst && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(92,204,136,0.15)", color: "#5cc888" }}>Strike-first</span>}
                  {mods.ward && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(160,96,192,0.15)", color: "#a060c0" }}>Ward {mods.ward}</span>}
                </div>}
              </div>;
            })}
          </div>}
        </div>;
      })()}

      {/* Weapons */}
      <div style={{ borderTop: `1px solid ${C.gold}22`, paddingTop: 10, marginTop: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <button onClick={() => setShowWeapons(!showWeapons)} style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
            color: C.fGold, borderRadius: 4, cursor: "pointer", fontSize: 10,
            padding: "4px 10px", fontFamily: "'Cinzel', serif", letterSpacing: 1,
            textTransform: "uppercase", textAlign: "left", flex: 1,
          }}>
            {showWeapons ? "\u25BE" : "\u25B8"} Weapons ({unit.weapons.filter(w => w.enabled).length})
            {!showWeapons && <span style={{ marginLeft: 8, fontSize: 9, opacity: 0.8 }}>
              {unit.weapons.filter(w => w.enabled).map(w => w.name).join(", ")}
            </span>}
          </button>
          <button onClick={() => setUnit({ ...unit, weapons: [...unit.weapons, emptyWeapon()] })} style={{ background: `${C.gold}22`, border: `1px solid ${C.gold}44`, color: C.gold, borderRadius: 4, cursor: "pointer", fontSize: 11, padding: "2px 8px", fontFamily: "'Cinzel', serif", marginLeft: 6 }}>+ Add</button>
        </div>
        {showWeapons && <>
          <div style={{ display: "grid", gridTemplateColumns: "38px 1fr 52px 44px 44px 44px 44px 1fr 26px 36px 30px", gap: 4, padding: "2px 0", borderBottom: "1px solid rgba(201,168,76,0.15)" }}>
            {["Type", "Name", "Atk", "Hit", "Wnd", "Rnd", "Dmg", "Ability", "\uD83D\uDC32", "#", ""].map(h => <span key={h} style={{ fontSize: 9, color: C.fGold, textTransform: "uppercase", textAlign: "center", letterSpacing: 0.8 }}>{h}</span>)}
          </div>
          {unit.weapons.map((w, i) => <WeaponRow key={i} w={w} onChange={w => uW(i, w)} onRemove={() => setUnit({ ...unit, weapons: unit.weapons.filter((_, j) => j !== i) })} canRemove={unit.weapons.length > 1} />)}
        </>}
      </div>

      {/* Attack Buffs */}
      <div style={{ borderTop: `1px solid ${C.gold}22`, paddingTop: 10, marginTop: 12 }}>
        <button onClick={() => setShowAtkBuffs(!showAtkBuffs)} style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
          color: C.gold, borderRadius: 4, cursor: "pointer", fontSize: 10,
          padding: "4px 10px", fontFamily: "'Cinzel', serif", letterSpacing: 1,
          textTransform: "uppercase", width: "100%", textAlign: "left", marginBottom: 8,
        }}>
          {showAtkBuffs ? "\u25BE" : "\u25B8"} Attack Buffs
          {!showAtkBuffs && <span style={{ marginLeft: 8, fontSize: 9, opacity: 0.8 }}>
            {[atkMods.allOutAttack && "AoA", opts.charged && "Charged", (atkMods.hitReroll || "off") !== "off" && `Hit RR: ${{ones:"1s",full:"Full"}[atkMods.hitReroll]}`, (atkMods.woundReroll || "off") !== "off" && `Wnd RR: ${{ones:"1s",full:"Full"}[atkMods.woundReroll]}`].filter(Boolean).join(" | ") || "None active"}
          </span>}
        </button>
        {showAtkBuffs && <>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          <Tog on={atkMods.allOutAttack} click={() => setAtkMods({ ...atkMods, allOutAttack: !atkMods.allOutAttack })} color={C.gold}>All-Out Attack</Tog>
          {(unit.keywords || []).some(k => k.toUpperCase() === "CHAMPION") &&
            <Tog on={atkMods.champion} click={() => setAtkMods({ ...atkMods, champion: !atkMods.champion })} color={C.gold}>Champion</Tog>
          }
          <Tog on={opts.charged} click={() => setOpts({ ...opts, charged: !opts.charged })} color="#c87828">Charged</Tog>
          {unit.modelCount > 1 && <Tog on={atkReinforced} click={() => setAtkReinforced(!atkReinforced)} color="#68b8e8">Reinforce</Tog>}
          <Tog on={(atkMods.hitReroll || "off") !== "off"} click={() => {
            const c = ["off", "ones", "full"];
            setAtkMods({ ...atkMods, hitReroll: c[(c.indexOf(atkMods.hitReroll || "off") + 1) % c.length] });
          }} color={(atkMods.hitReroll || "off") !== "off" ? "#68b8e8" : C.fGold}>Hit RR: {{ off: "Off", ones: "1s", full: "Full" }[atkMods.hitReroll || "off"]}</Tog>
          <Tog on={(atkMods.woundReroll || "off") !== "off"} click={() => {
            const c = ["off", "ones", "full"];
            setAtkMods({ ...atkMods, woundReroll: c[(c.indexOf(atkMods.woundReroll || "off") + 1) % c.length] });
          }} color={(atkMods.woundReroll || "off") !== "off" ? "#68b8e8" : C.fGold}>Wnd RR: {{ off: "Off", ones: "1s", full: "Full" }[atkMods.woundReroll || "off"]}</Tog>
        </div>
        {atkReinforced && unit.modelCount > 1 && <div style={{ fontSize: 9, color: "#68b8e8", fontStyle: "italic", marginBottom: 4 }}>
          Reinforced: {effUnit.modelCount} models, {effUnit.points}pts
        </div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "flex-start" }}>
          <Stepper label="Hit" value={atkMods.hitMod} onChange={v => setAtkMods({ ...atkMods, hitMod: v })} min={-3} max={2} capMin={-1} capMax={1} color={C.gold}
            badges={[{ label: "AoA", value: atkMods.allOutAttack ? 1 : 0, color: C.green }]} />
          <Stepper label="Wound" value={atkMods.woundMod} onChange={v => setAtkMods({ ...atkMods, woundMod: v })} min={-3} max={2} capMin={-1} capMax={1} color={C.gold} />
          <Stepper label="Rend" value={atkMods.rendMod} onChange={v => setAtkMods({ ...atkMods, rendMod: v })} color={C.gold} />
          <Stepper label="Dmg" value={atkMods.damageMod} onChange={v => setAtkMods({ ...atkMods, damageMod: v })} color={C.gold} />
          <Stepper label="Atk" value={atkMods.extraAttacks} onChange={v => setAtkMods({ ...atkMods, extraAttacks: v })} color={C.gold} />
        </div>

        {/* Crit Buffs */}
        {(() => {
          const hasCritMod = (atkMods.critOn || 6) < 6 || !!atkMods.critBuff;
          const critBuffs = ["", "2 hits", "auto-wound", "mortal"];
          const critLabels = { "": "None", "2 hits": "2 Hits", "auto-wound": "Auto-wound", "mortal": "Mortal" };
          const critColors = { "": C.fGold, "2 hits": "#68b8e8", "auto-wound": "#e8a848", "mortal": "#e86868" };
          return <div style={{ marginTop: 6 }}>
            <button onClick={() => setShowCrit(!showCrit)} style={{
              background: hasCritMod ? "rgba(184,136,221,0.1)" : "transparent",
              border: `1px solid ${hasCritMod ? "rgba(184,136,221,0.3)" : "rgba(255,255,255,0.06)"}`,
              color: hasCritMod ? "#b888dd" : C.fGold, borderRadius: 4, cursor: "pointer",
              fontSize: 10, padding: "4px 10px", fontFamily: "'Cinzel', serif",
              letterSpacing: 1, textTransform: "uppercase", width: "100%", textAlign: "left"
            }}>
              {showCrit ? "\u25BE" : "\u25B8"} Crit Buffs
              {hasCritMod && <span style={{ marginLeft: 8, fontSize: 9, opacity: 0.8 }}>
                {(atkMods.critOn || 6) < 6 ? `${atkMods.critOn}+` : ""}
                {atkMods.critBuff ? ` ${critLabels[atkMods.critBuff]}` : ""}
              </span>}
            </button>
            {showCrit && <div style={{ padding: "8px 0 4px", display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <Stepper label="Crit On" value={atkMods.critOn || 6}
                onChange={v => setAtkMods({ ...atkMods, critOn: v })}
                min={5} max={6} color="#b888dd" />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span style={{ fontSize: 8, color: C.fGold, textTransform: "uppercase", letterSpacing: 0.8 }}>Crit Buff</span>
                <button onClick={() => {
                  const idx = critBuffs.indexOf(atkMods.critBuff || "");
                  setAtkMods({ ...atkMods, critBuff: critBuffs[(idx + 1) % critBuffs.length] });
                }} style={{
                  background: atkMods.critBuff ? `${critColors[atkMods.critBuff]}18` : "rgba(0,0,0,0.2)",
                  border: `1px solid ${atkMods.critBuff ? `${critColors[atkMods.critBuff]}40` : "rgba(255,255,255,0.06)"}`,
                  color: critColors[atkMods.critBuff || ""],
                  borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 600,
                  padding: "4px 12px", fontFamily: "'Cinzel', serif", minWidth: 100, transition: "all 0.15s"
                }}>
                  {critLabels[atkMods.critBuff || ""]}
                </button>
              </div>
            </div>}
          </div>;
        })()}

        {/* Mortal Wound Abilities */}
        {(() => {
          const hasOnX = !!atkMods.onXThreshold;
          const hasPM = !!atkMods.perModelThreshold;
          const hasAny = hasOnX || hasPM;
          const isOpen = showMortals || hasAny;
          return <div style={{ marginTop: 6 }}>
            <button onClick={() => setShowMortals(!isOpen)} style={{
              background: hasAny ? "rgba(232,104,104,0.1)" : "transparent",
              border: `1px solid ${hasAny ? "rgba(232,104,104,0.3)" : "rgba(255,255,255,0.06)"}`,
              color: hasAny ? "#e86868" : C.fGold, borderRadius: 4, cursor: "pointer",
              fontSize: 10, padding: "4px 10px", fontFamily: "'Cinzel', serif",
              letterSpacing: 1, textTransform: "uppercase", width: "100%", textAlign: "left"
            }}>
              {isOpen ? "\u25BE" : "\u25B8"} Mortal Wound Abilities
              {hasAny && <span style={{ marginLeft: 8, fontSize: 9, opacity: 0.8 }}>
                {hasOnX ? `${atkMods.onXDamage || "D3"} on ${atkMods.onXThreshold}` : ""}
                {hasOnX && hasPM ? " + " : ""}
                {hasPM ? `Per model ${atkMods.perModelThreshold}` : ""}
              </span>}
            </button>
            {isOpen && <div style={{ padding: "8px 0 4px", borderLeft: "2px solid rgba(232,104,104,0.15)", paddingLeft: 8, marginTop: 4 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Tog on={hasOnX} click={() => {
                    if (!hasOnX) setAtkMods({ ...atkMods, onXThreshold: "2+", onXDamage: atkMods.onXDamage || "D3" });
                    else setAtkMods({ ...atkMods, onXThreshold: "" });
                  }} color="#e86868">Roll for Mortals</Tog>
                </div>
                {hasOnX && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 8, color: C.fGold, textTransform: "uppercase", letterSpacing: 0.8 }}>Threshold</span>
                    <button onClick={() => {
                      const cycle = ["2+", "3+", "4+", "5+"];
                      const idx = cycle.indexOf(atkMods.onXThreshold || "2+");
                      setAtkMods({ ...atkMods, onXThreshold: cycle[(idx + 1) % cycle.length] });
                    }} style={{
                      background: "rgba(232,104,104,0.12)", border: "1px solid rgba(232,104,104,0.3)",
                      color: "#e86868", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 700,
                      padding: "4px 14px", fontFamily: "'Cinzel', serif", minWidth: 50
                    }}>{atkMods.onXThreshold}</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 8, color: C.fGold, textTransform: "uppercase", letterSpacing: 0.8 }}>Damage</span>
                    <button onClick={() => {
                      const cycle = ["D3", "D6", "1", "2", "3"];
                      const idx = cycle.indexOf(atkMods.onXDamage || "D3");
                      setAtkMods({ ...atkMods, onXDamage: cycle[(idx + 1) % cycle.length] });
                    }} style={{
                      background: "rgba(232,104,104,0.12)", border: "1px solid rgba(232,104,104,0.3)",
                      color: "#e86868", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 700,
                      padding: "4px 14px", fontFamily: "'Cinzel', serif", minWidth: 50
                    }}>{atkMods.onXDamage || "D3"}</button>
                  </div>
                </div>}
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#e86868", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                  Per enemy model, on X+ deal 1 mortal
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 8, color: C.fGold, textTransform: "uppercase", letterSpacing: 0.8 }}>Dice Roll</span>
                    <button onClick={() => {
                      const cycle = ["", "6+", "5+", "4+", "3+", "2+"];
                      const idx = cycle.indexOf(atkMods.perModelThreshold || "");
                      setAtkMods({ ...atkMods, perModelThreshold: cycle[(idx + 1) % cycle.length] });
                    }} style={{
                      background: hasPM ? "rgba(232,104,104,0.12)" : "rgba(0,0,0,0.2)",
                      border: `1px solid ${hasPM ? "rgba(232,104,104,0.3)" : "rgba(255,255,255,0.06)"}`,
                      color: hasPM ? "#e86868" : C.fGold,
                      borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 700,
                      padding: "4px 14px", fontFamily: "'Cinzel', serif", minWidth: 50
                    }}>{atkMods.perModelThreshold || "Off"}</button>
                  </div>
                </div>
              </div>
            </div>}
          </div>;
        })()}
      </>}
      </div>
    </div>

    {/* CONTROL BAR — Phase + Defence Buffs */}
    <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>

      {/* Phase Toggle */}
      <div style={{ background: "rgba(25,22,18,0.95)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 8, padding: "12px 16px", flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 10, color: C.fGold, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontFamily: "'Cinzel', serif" }}>Combat Phase</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            { id: "shoot", label: "Shoot Only" },
            { id: "shootCharge", label: "Shoot + Charge" },
            { id: "melee", label: "Melee Only" },
          ].map(m => (
            <button key={m.id} onClick={() => setPhase(m.id)} style={{
              padding: "6px 12px", cursor: "pointer",
              fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
              background: phase === m.id ? `${C.gold}30` : "rgba(0,0,0,0.3)",
              color: phase === m.id ? C.gold : C.fGold,
              border: `1px solid ${phase === m.id ? `${C.gold}44` : "rgba(201,168,76,0.15)"}`,
              borderRadius: 4, transition: "all 0.15s"
            }}>{m.label}</button>
          ))}
        </div>
        {phase !== "melee" && !hasRanged && <div style={{ fontSize: 9, color: "#886655", fontStyle: "italic", marginTop: 6 }}>
          No ranged weapons enabled — shooting will be 0
        </div>}
      </div>

      {/* Defence Buff Toggles */}
      <div style={{ background: "rgba(25,22,18,0.95)", border: `1px solid ${C.red}33`, borderRadius: 8, padding: "12px 16px", flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 10, color: C.red, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontFamily: "'Cinzel', serif" }}>Target Defence Buffs</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          <Tog on={defAOD} click={() => setDefAOD(!defAOD)} color={C.red}>All-Out Defence</Tog>
          <Tog on={!!defWard} click={() => {
            const ws = ["", "6+", "5+", "4+"];
            setDefWard(ws[(ws.indexOf(defWard || "") + 1) % ws.length]);
          }} color={defWard ? "#a060c0" : C.fGold}>Ward {defWard || "None"}</Tog>
          <Tog on={reinforced} click={() => setReinforced(!reinforced)} color="#68b8e8">Reinforce</Tog>
          <Tog on={(defSaveReroll || "off") !== "off"} click={() => {
            const c = ["off", "ones", "full"];
            setDefSaveReroll(c[(c.indexOf(defSaveReroll || "off") + 1) % c.length]);
          }} color={(defSaveReroll || "off") !== "off" ? "#68b8e8" : C.fGold}>Sv RR: {{ off: "Off", ones: "1s", full: "Full" }[defSaveReroll || "off"]}</Tog>
        </div>
        <div style={{ fontSize: 9, color: "#665", fontStyle: "italic", marginTop: 6 }}>
          {defAOD ? "+1 Save | " : ""}{defWard ? `Ward ${defWard} | ` : ""}{(defSaveReroll || "off") !== "off" ? `Save RR: ${{ones:"1s",full:"Full"}[defSaveReroll]} | ` : ""}{reinforced ? "2x models & pts (not Heroes/Monsters)" : ""}
          {!defAOD && !defWard && !reinforced && (defSaveReroll || "off") === "off" && "Applied to all targets"}
        </div>
      </div>
    </div>

    {/* OVERALL SCORE */}
    <div style={{
      background: "linear-gradient(135deg, rgba(25,22,18,0.98) 0%, rgba(15,13,10,0.99) 100%)",
      border: `2px solid ${scoreColor(overallScore)}44`,
      borderRadius: 10, padding: 20, marginBottom: 16, textAlign: "center"
    }}>
      <div style={{ fontSize: 10, color: C.fGold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Overall Mathhammer Score</div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontFamily: "'Cinzel', serif", fontSize: 48, fontWeight: 900, color: scoreColor(overallScore), textShadow: `0 0 20px ${scoreColor(overallScore)}40` }}>
          {overallScore.toFixed(0)}
        </span>
        <span style={{
          fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 900,
          color: scoreColor(overallScore), opacity: 0.8,
          background: `${scoreColor(overallScore)}15`, padding: "2px 12px", borderRadius: 6,
          border: `1px solid ${scoreColor(overallScore)}33`
        }}>
          {scoreGrade(overallScore)}
        </span>
      </div>
      <div style={{ fontSize: 11, color: C.dGold, marginTop: 4 }}>
        Average pts destroyed per 100pts invested across all targets
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: C.fGold, textTransform: "uppercase", letterSpacing: 1 }}>Best Matchup</div>
          <div style={{ fontSize: 13, color: "#5cc888", fontWeight: 700, fontFamily: "'Cinzel', serif" }}>
            {bestMatchup.target.name} <span style={{ fontSize: 11, fontWeight: 400 }}>({bestMatchup.roi.toFixed(0)}%)</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: C.fGold, textTransform: "uppercase", letterSpacing: 1 }}>Worst Matchup</div>
          <div style={{ fontSize: 13, color: "#c06050", fontWeight: 700, fontFamily: "'Cinzel', serif" }}>
            {worstMatchup.target.name} <span style={{ fontSize: 11, fontWeight: 400 }}>({worstMatchup.roi.toFixed(0)}%)</span>
          </div>
        </div>
      </div>
    </div>

    {/* RESULTS TABLE */}
    <div style={{
      background: "linear-gradient(180deg, rgba(25,22,18,0.97) 0%, rgba(15,13,10,0.99) 100%)",
      border: "1px solid rgba(201,168,76,0.2)", borderRadius: 8, padding: 16
    }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, color: C.gold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, textAlign: "center" }}>
        {effUnit.name} <span style={{ color: C.fGold, fontSize: 11 }}>({effUnit.points}pts{atkReinforced && unit.modelCount > 1 ? " reinforced" : ""})</span> vs All Targets
      </div>

      {/* Header row */}
      {(() => {
        const cols = "minmax(100px, 1.8fr) 30px 28px 28px 24px 58px 52px 52px 42px 1fr";
        const cBtn = { cursor: "pointer", background: "none", border: "none", padding: 0, fontFamily: "'Cinzel', serif", textAlign: "center", width: "100%", transition: "opacity 0.15s" };
        return <>
        <div style={{
          display: "grid", gridTemplateColumns: cols,
          gap: 3, padding: "6px 8px", borderBottom: "1px solid rgba(201,168,76,0.2)",
          fontSize: 8, color: C.fGold, textTransform: "uppercase", letterSpacing: 0.8
        }}>
          <span>Target</span>
          <span style={{ textAlign: "center" }}>Sv</span>
          <span style={{ textAlign: "center" }}>W</span>
          <span style={{ textAlign: "center" }}>HP</span>
          <span style={{ textAlign: "center" }}>#</span>
          <span style={{ textAlign: "right" }}>Dmg</span>
          <span style={{ textAlign: "center" }}>Kills</span>
          <span style={{ textAlign: "center" }}>Status</span>
          <span style={{ textAlign: "right" }}>Score</span>
          <span style={{ textAlign: "center" }}>Efficiency</span>
        </div>

        {/* Result rows */}
        {results.map((r, i) => {
          const sc = scoreColor(r.roi);
          const grade = scoreGrade(r.roi);
          const nearWipe = !r.wiped && r.pctKilled >= 90;
          let statusColor, statusBg, statusText;
          if (r.wiped && r.overkillPct <= 10) {
            statusColor = "#5cc888"; statusBg = "rgba(92,200,136,0.12)"; statusText = "WIPED";
          } else if (r.wiped && r.overkillPct <= 50) {
            statusColor = "#e8a848"; statusBg = "rgba(232,168,72,0.10)"; statusText = `+${r.overkillPct.toFixed(0)}%`;
          } else if (r.wiped) {
            statusColor = "#e86868"; statusBg = "rgba(232,104,104,0.10)"; statusText = `+${r.overkillPct.toFixed(0)}%`;
          } else if (nearWipe) {
            statusColor = "#68b8e8"; statusBg = "rgba(104,184,232,0.10)"; statusText = `${r.pctKilled.toFixed(0)}%`;
          } else {
            statusColor = C.fGold; statusBg = "transparent"; statusText = `${r.pctKilled.toFixed(0)}%`;
          }
          // Current effective values for clickable display
          const saveDsp = r.target.save === "7+" ? "-" : r.target.save;
          const wardDsp = r.target.ward || "-";
          const hpPerModel = parseDice(r.target.health);
          const hasOverride = !!targetOverrides[r.baseId];

          return <div key={r.target.id} style={{
            display: "grid", gridTemplateColumns: cols,
            gap: 3, padding: "5px 8px", alignItems: "center",
            borderBottom: `1px solid rgba(201,168,76,${i === results.length - 1 ? "0" : "0.08"})`,
            background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
          }}>
            {/* Target name */}
            <div style={{ fontSize: 11, color: "#e8dcc4", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.target.name}
              {r.isReinforced && <span style={{ fontSize: 7, color: "#68b8e8", marginLeft: 3 }}>x2</span>}
              {hasOverride && <span style={{ fontSize: 7, color: C.gold, marginLeft: 3 }}>*</span>}
            </div>

            {/* Save — clickable */}
            <button onClick={() => cycleTargetStat(r.baseId, "save", r.target.save)} style={{
              ...cBtn, fontSize: 11, fontWeight: 700,
              color: hasOverride && targetOverrides[r.baseId]?.save ? C.gold : C.dGold,
            }}>{saveDsp}{defAOD ? <span style={{ fontSize: 7, color: C.red }}>+</span> : ""}</button>

            {/* Ward — clickable */}
            <button onClick={() => cycleTargetStat(r.baseId, "ward", r.target.ward || "")} style={{
              ...cBtn, fontSize: 10, fontWeight: 600,
              color: wardDsp !== "-" ? "#a060c0" : "#443f38",
            }}>{wardDsp}</button>

            {/* HP per model — clickable */}
            <button onClick={() => cycleTargetStat(r.baseId, "health", r.target.health)} style={{
              ...cBtn, fontSize: 10, fontWeight: 600,
              color: hasOverride && targetOverrides[r.baseId]?.health ? C.gold : C.dGold,
            }}>{hpPerModel}</button>

            {/* Model count — clickable */}
            <button onClick={() => cycleTargetStat(r.baseId, "modelCount", r.target.modelCount)} style={{
              ...cBtn, fontSize: 10, fontWeight: 600,
              color: hasOverride && targetOverrides[r.baseId]?.modelCount ? C.gold : C.fGold,
            }}>{r.target.modelCount}</button>

            {/* Damage — bold and prominent */}
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: sc, fontFamily: "'Cinzel', serif", textShadow: `0 0 8px ${sc}30` }}>{r.totalDmg.toFixed(1)}</span>
              {(r.shootDmg > 0 || r.extraMortals > 0) && <div style={{ fontSize: 7, color: C.fGold }}>
                {r.shootDmg > 0 && <span style={{ color: "#4a9ede" }}>{r.shootDmg.toFixed(1)}R </span>}
                {r.meleeDmg > 0 && <span style={{ color: C.gold }}>{r.meleeDmg.toFixed(1)}M </span>}
                {r.extraMortals > 0 && <span style={{ color: "#e86868" }}>+{r.extraMortals.toFixed(1)}</span>}
              </div>}
            </div>

            {/* Kills — bigger total */}
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: r.kills >= r.target.modelCount ? "#5cc888" : "#e8dcc4", fontFamily: "'Cinzel', serif" }}>
                {r.kills}
              </span>
              <span style={{ fontSize: 11, color: C.fGold, fontWeight: 500 }}>/{r.target.modelCount}</span>
            </div>

            {/* Status — compact */}
            <div style={{
              textAlign: "center", fontSize: 8, fontWeight: 700, color: statusColor,
              background: statusBg, borderRadius: 3, padding: "2px 1px",
              border: `1px solid ${statusColor}22`, lineHeight: 1.2,
            }}>
              {r.wiped && <div>{r.overkillPct > 10 ? "OVERKILL" : "WIPED"}</div>}
              {nearWipe && <div>CLOSE</div>}
              {!r.wiped && !nearWipe && <div>{statusText}</div>}
            </div>

            {/* Score */}
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: sc, fontFamily: "'Cinzel', serif" }}>{grade}</span>
              <div style={{ fontSize: 9, color: sc }}>{r.roi.toFixed(0)}%</div>
            </div>

            {/* Efficiency bar */}
            <div style={{ padding: "0 4px" }}>
              <div style={{
                height: 14, borderRadius: 3,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                overflow: "hidden", position: "relative"
              }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${barWidth(r.roi)}%`,
                  background: `linear-gradient(90deg, ${sc}88, ${sc}cc)`,
                  transition: "width 0.3s ease",
                }} />
                <div style={{
                  position: "absolute", top: 0, bottom: 0, left: "50%",
                  width: 1, background: "rgba(255,255,255,0.15)"
                }} />
              </div>
            </div>
          </div>;
        })}
        </>;
      })()}
    </div>

    {/* LEGEND */}
    <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
      {[
        { grade: "S", label: "Dominant (120%+)", color: "#5cc888" },
        { grade: "A", label: "Strong (95%+)", color: "#8dcc5c" },
        { grade: "B", label: "Solid (70%+)", color: "#c9a84c" },
        { grade: "C", label: "Average (45%+)", color: "#d08040" },
        { grade: "D/F", label: "Weak (<45%)", color: "#c06050" },
      ].map(g => (
        <div key={g.grade} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{
            fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 900, color: g.color,
            background: `${g.color}15`, padding: "1px 6px", borderRadius: 3, border: `1px solid ${g.color}33`
          }}>{g.grade}</span>
          <span style={{ fontSize: 9, color: C.fGold }}>{g.label}</span>
        </div>
      ))}
    </div>

    <div style={{ textAlign: "center", fontSize: 9, color: "#554f43", marginTop: 12 }}>
      Score = pts destroyed / your pts x 100 | 100 = even trade | Higher = better value
    </div>
  </div>;
}
