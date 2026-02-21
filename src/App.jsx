import { useState, useMemo, useCallback } from 'react';
import { C } from './styles';
import { parseDice, simulateCombat, calcExtraMortals } from './engine/combat';
import { PRESETS } from './data/presets';
import { defaultMods, defaultOpts } from './data/defaults';
import DataImport from './components/DataImport';
import UnitPanel from './components/UnitPanel';
import Results from './components/Results';
import SimResults from './components/SimResults';
import TrainingGrounds from './components/TrainingGrounds';
import GuidePanel from './components/GuidePanel';

const defaultUnit = () => JSON.parse(JSON.stringify(PRESETS[0]));

export default function App() {
  // Page navigation
  const [page, setPage] = useState("combat"); // "combat" | "training" | "guide"

  const [unitA, setUnitA] = useState(defaultUnit());
  const [unitB, setUnitB] = useState(() => JSON.parse(JSON.stringify(PRESETS[2])));

  const [aAtk, setAAtk] = useState(defaultMods());
  const [aOpts, setAOpts] = useState(defaultOpts());
  const [aDef, setADef] = useState(defaultMods());
  const [bAtk, setBAtk] = useState(defaultMods());
  const [bOpts, setBOpts] = useState(defaultOpts());
  const [bDef, setBDef] = useState(defaultMods());

  const [aFirst, setAFirst] = useState(true);
  const [combatMode, setCombatMode] = useState("melee");

  // Shared BSData state — one import feeds both panels
  const [bsdataUnits, setBsdataUnits] = useState([]);
  const [showLegacy, setShowLegacy] = useState(false);

  // Custom user-saved presets (localStorage)
  const [customPresets, setCustomPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aos-mathhammer-presets') || '[]'); }
    catch { return []; }
  });
  const savePreset = (unitData) => {
    const preset = JSON.parse(JSON.stringify(unitData));
    delete preset.abilities; // Don't persist BSData abilities — they come from import
    const updated = [...customPresets.filter(p => p.name !== preset.name), preset];
    setCustomPresets(updated);
    localStorage.setItem('aos-mathhammer-presets', JSON.stringify(updated));
  };
  const deletePreset = (name) => {
    const updated = customPresets.filter(p => p.name !== name);
    setCustomPresets(updated);
    localStorage.setItem('aos-mathhammer-presets', JSON.stringify(updated));
  };

  // Save unit edits back to BSData library
  // originalKey: the __key used to find the entry to update/fork
  // unitData: the unit to save (may have different name)
  // Returns the __key of the saved entry (may be new if name changed)
  const updateBsdataUnit = useCallback((unitData, originalKey) => {
    const lookupKey = originalKey || unitData.__key;
    if (!lookupKey) return unitData.__key;
    let resultKey = lookupKey;
    setBsdataUnits(prev => {
      const original = prev.find(u => u.__key === lookupKey);
      if (!original) return prev;
      if (original.name !== unitData.name) {
        // Name changed — insert as new entry after original (keeps original intact)
        const newKey = `${unitData.faction}::${unitData.name}::custom`;
        resultKey = newKey;
        const newUnit = { ...unitData, __key: newKey };
        const idx = prev.indexOf(original);
        const updated = [...prev];
        updated.splice(idx + 1, 0, newUnit);
        return updated;
      }
      return prev.map(u => u.__key === lookupKey ? { ...unitData } : u);
    });
    return resultKey;
  }, []);

  // Exclusive charge linking
  const setAOptsLinked = (newOpts) => {
    if (newOpts.charged && !aOpts.charged) {
      setAOpts({ ...newOpts, wasCharged: false });
      setBOpts(prev => ({ ...prev, wasCharged: true, charged: false }));
      return;
    }
    if (!newOpts.charged && aOpts.charged) {
      setAOpts(newOpts);
      setBOpts(prev => ({ ...prev, wasCharged: false }));
      return;
    }
    if (newOpts.wasCharged && !aOpts.wasCharged) {
      setAOpts({ ...newOpts, charged: false });
      setBOpts(prev => ({ ...prev, charged: true, wasCharged: false }));
      return;
    }
    if (!newOpts.wasCharged && aOpts.wasCharged) {
      setAOpts(newOpts);
      setBOpts(prev => ({ ...prev, charged: false }));
      return;
    }
    setAOpts(newOpts);
  };
  const setBOptsLinked = (newOpts) => {
    if (newOpts.charged && !bOpts.charged) {
      setBOpts({ ...newOpts, wasCharged: false });
      setAOpts(prev => ({ ...prev, wasCharged: true, charged: false }));
      return;
    }
    if (!newOpts.charged && bOpts.charged) {
      setBOpts(newOpts);
      setAOpts(prev => ({ ...prev, wasCharged: false }));
      return;
    }
    if (newOpts.wasCharged && !bOpts.wasCharged) {
      setBOpts({ ...newOpts, charged: false });
      setAOpts(prev => ({ ...prev, charged: true, wasCharged: false }));
      return;
    }
    if (!newOpts.wasCharged && bOpts.wasCharged) {
      setBOpts(newOpts);
      setAOpts(prev => ({ ...prev, charged: false }));
      return;
    }
    setBOpts(newOpts);
  };

  // Determine first/second based on toggle
  const firstUnit = aFirst ? unitA : unitB;
  const secondUnit = aFirst ? unitB : unitA;
  const firstAtkMods = aFirst ? aAtk : bAtk;
  const secondAtkMods = aFirst ? bAtk : aAtk;
  const firstDefMods = aFirst ? aDef : bDef;
  const secondDefMods = aFirst ? bDef : aDef;
  const firstOpts = aFirst ? aOpts : bOpts;
  const secondOpts = aFirst ? bOpts : aOpts;

  // Helper: check weapon types
  const hasRanged = (u) => u.weapons.some(w => w.enabled && (w.type || "melee") === "ranged");

  // SHOOTING PHASE
  const firstShoot = useMemo(() => {
    if (combatMode === "melee") return null;
    if (!hasRanged(firstUnit)) return { weapons: [], totalDamage: 0, modelsKilled: 0, percentUnitKilled: 0, remainingModels: secondUnit.modelCount };
    const adjSecondDef = secondAtkMods.allOutAttack
      ? { ...secondDefMods, saveMod: (secondDefMods.saveMod || 0) - 1 } : secondDefMods;
    const shootOpts = { ...firstOpts, charged: false };
    return simulateCombat(firstUnit, secondUnit, firstAtkMods, adjSecondDef, shootOpts, null, "ranged");
  }, [firstUnit, secondUnit, firstAtkMods, secondAtkMods.allOutAttack, secondDefMods, firstOpts, combatMode]);

  const secondShoot = useMemo(() => {
    if (combatMode === "melee") return null;
    // In Shoot+Charge only the charging (first-striking) unit shoots
    if (combatMode === "shootCharge") return { weapons: [], totalDamage: 0, modelsKilled: 0, percentUnitKilled: 0, remainingModels: firstUnit.modelCount };
    if (!hasRanged(secondUnit)) return { weapons: [], totalDamage: 0, modelsKilled: 0, percentUnitKilled: 0, remainingModels: firstUnit.modelCount };
    const adjFirstDef = firstAtkMods.allOutAttack
      ? { ...firstDefMods, saveMod: (firstDefMods.saveMod || 0) - 1 } : firstDefMods;
    const shootOpts = { ...secondOpts, charged: false };
    return simulateCombat(secondUnit, firstUnit, secondAtkMods, adjFirstDef, shootOpts, null, "ranged");
  }, [secondUnit, firstUnit, secondAtkMods, firstAtkMods.allOutAttack, firstDefMods, secondOpts, combatMode]);

  // Survivors after shooting
  const firstSurvAfterShoot = useMemo(() => {
    if (!secondShoot) return firstUnit.modelCount;
    return Math.max(0, (firstUnit.modelCount || 1) - (secondShoot.modelsKilled || 0));
  }, [secondShoot, firstUnit.modelCount]);

  const secondSurvAfterShoot = useMemo(() => {
    if (!firstShoot) return secondUnit.modelCount;
    return Math.max(0, (secondUnit.modelCount || 1) - (firstShoot.modelsKilled || 0));
  }, [firstShoot, secondUnit.modelCount]);

  // MELEE PHASE
  const firstResult = useMemo(() => {
    if (combatMode === "shoot") return { weapons: [], totalDamage: 0, modelsKilled: 0, percentUnitKilled: 0, remainingModels: secondUnit.modelCount };
    const adjSecondDef = secondAtkMods.allOutAttack
      ? { ...secondDefMods, saveMod: (secondDefMods.saveMod || 0) - 1 } : secondDefMods;
    const meleeModelOverride = combatMode === "shootCharge" ? firstSurvAfterShoot : null;
    return simulateCombat(firstUnit, secondUnit, firstAtkMods, adjSecondDef, firstOpts, meleeModelOverride, "melee");
  }, [firstUnit, secondUnit, firstAtkMods, secondAtkMods.allOutAttack, secondDefMods, firstOpts, combatMode, firstSurvAfterShoot]);

  const secondSurvForFightback = useMemo(() => {
    if (combatMode === "shoot") return 0;
    const postShoot = combatMode === "shootCharge" ? secondSurvAfterShoot : secondUnit.modelCount;
    const defHealth = parseDice(secondUnit.health);
    if (defHealth <= 0) return 0;
    const meleeKills = defHealth > 0 ? Math.min(Math.floor(firstResult.totalDamage / defHealth), postShoot) : 0;
    return Math.max(0, postShoot - meleeKills);
  }, [firstResult, secondUnit, combatMode, secondSurvAfterShoot]);

  const secondResult = useMemo(() => {
    if (combatMode === "shoot") return { weapons: [], totalDamage: 0, modelsKilled: 0, percentUnitKilled: 0, remainingModels: 0 };
    if (secondSurvForFightback <= 0) return { weapons: [], totalDamage: 0, modelsKilled: 0, percentUnitKilled: 0, remainingModels: 0 };
    const adjFirstDef = firstAtkMods.allOutAttack
      ? { ...firstDefMods, saveMod: (firstDefMods.saveMod || 0) - 1 } : firstDefMods;
    return simulateCombat(secondUnit, firstUnit, secondAtkMods, adjFirstDef, secondOpts, secondSurvForFightback, "melee");
  }, [secondUnit, firstUnit, secondAtkMods, firstAtkMods.allOutAttack, firstDefMods, secondOpts, secondSurvForFightback, combatMode]);

  // FIGHT TWICE — first striker's second fight (strike-last, after counterattack)
  const firstSurvForFT = useMemo(() => {
    if (combatMode === "shoot" || !firstOpts.fightTwice) return 0;
    const startModels = combatMode === "shootCharge" ? firstSurvAfterShoot : (firstUnit.modelCount || 1);
    const defHealth = parseDice(firstUnit.health);
    if (defHealth <= 0) return startModels;
    const kills = Math.min(Math.floor(secondResult.totalDamage / defHealth), startModels);
    return Math.max(0, startModels - kills);
  }, [combatMode, firstOpts.fightTwice, firstUnit, secondResult, firstSurvAfterShoot]);

  const firstFT = useMemo(() => {
    if (!firstOpts.fightTwice || combatMode === "shoot" || firstSurvForFT <= 0)
      return null;
    const adjSecondDef = secondAtkMods.allOutAttack
      ? { ...secondDefMods, saveMod: (secondDefMods.saveMod || 0) - 1 } : secondDefMods;
    return simulateCombat(firstUnit, secondUnit, firstAtkMods, adjSecondDef, firstOpts, firstSurvForFT, "melee");
  }, [firstOpts.fightTwice, combatMode, firstSurvForFT, firstUnit, secondUnit, firstAtkMods, secondAtkMods.allOutAttack, secondDefMods, firstOpts]);

  // FIGHT TWICE — second striker's second fight (strike-last)
  const secondSurvForFT = useMemo(() => {
    if (combatMode === "shoot" || !secondOpts.fightTwice) return 0;
    // Second unit survivors after ALL first-unit melee damage (first fight + fight twice)
    const postShoot = combatMode === "shootCharge" ? secondSurvAfterShoot : (secondUnit.modelCount || 1);
    const defHealth = parseDice(secondUnit.health);
    if (defHealth <= 0) return 0;
    const totalFirstDmg = firstResult.totalDamage + (firstFT?.totalDamage || 0);
    const kills = Math.min(Math.floor(totalFirstDmg / defHealth), postShoot);
    return Math.max(0, postShoot - kills);
  }, [combatMode, secondOpts.fightTwice, secondUnit, secondSurvAfterShoot, firstResult, firstFT]);

  const secondFT = useMemo(() => {
    if (!secondOpts.fightTwice || combatMode === "shoot" || secondSurvForFT <= 0)
      return null;
    const adjFirstDef = firstAtkMods.allOutAttack
      ? { ...firstDefMods, saveMod: (firstDefMods.saveMod || 0) - 1 } : firstDefMods;
    return simulateCombat(secondUnit, firstUnit, secondAtkMods, adjFirstDef, secondOpts, secondSurvForFT, "melee");
  }, [secondOpts.fightTwice, combatMode, secondSurvForFT, secondUnit, firstUnit, secondAtkMods, firstAtkMods.allOutAttack, firstDefMods, secondOpts]);

  // EXTRA MORTALS (consolidated in engine)
  const extraMortals = useMemo(() => calcExtraMortals({
    firstR: firstResult, secondR: secondResult,
    firstUnit, secondUnit, firstOpts, secondOpts,
    firstAtkMods, secondAtkMods, firstDefMods, secondDefMods, combatMode,
  }), [firstResult, secondResult, firstUnit, secondUnit, firstOpts, secondOpts, firstAtkMods, secondAtkMods, firstDefMods, secondDefMods, combatMode]);

  const navBtn = (id, label) => (
    <button onClick={() => setPage(id)} style={{
      padding: "8px 20px", border: "none", cursor: "pointer",
      fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
      background: page === id ? `${C.gold}30` : "transparent",
      color: page === id ? C.gold : C.fGold,
      borderBottom: page === id ? `2px solid ${C.gold}` : "2px solid transparent",
      transition: "all 0.15s", textTransform: "uppercase",
    }}>{label}</button>
  );

  return <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%, rgba(40,34,24,1) 0%, rgba(12,10,8,1) 70%)", color: "#e8dcc4", fontFamily: "'Crimson Text', serif" }}>

    {/* Header */}
    <div style={{ textAlign: "center", padding: "24px 16px 0", borderBottom: "1px solid rgba(201,168,76,0.15)" }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 900, color: C.gold, letterSpacing: 4, textTransform: "uppercase", textShadow: "0 2px 12px rgba(201,168,76,0.3)" }}>AoS Mathhammer</div>
      <div style={{ fontSize: 12, color: C.fGold, letterSpacing: 2, marginTop: 4, textTransform: "uppercase" }}>Combat Probability Simulator</div>

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 12 }}>
        {navBtn("combat", "Combat Sim")}
        {navBtn("training", "Training Grounds")}
        {navBtn("guide", "Guide")}
      </div>
    </div>

    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 12px" }}>

      {/* SHARED BSDATA IMPORT — one fetch, both panels use it */}
      <DataImport units={bsdataUnits} setUnits={setBsdataUnits} showLegacy={showLegacy} setShowLegacy={setShowLegacy} />

      {page === "combat" && <>
        {/* COMBAT MODE SELECTOR */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, marginBottom: 10, padding: "6px 0" }}>
          <span style={{ fontSize: 11, color: C.fGold, letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>Mode:</span>
          {[
            { id: "shoot", label: "Shoot Only" },
            { id: "shootCharge", label: "Shoot + Charge" },
            { id: "melee", label: "Melee Only" },
          ].map(m => (
            <button key={m.id} onClick={() => setCombatMode(m.id)} style={{
              padding: "5px 12px", cursor: "pointer",
              fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
              background: combatMode === m.id ? `${C.gold}30` : "rgba(0,0,0,0.3)",
              color: combatMode === m.id ? C.gold : C.fGold,
              border: `1px solid ${combatMode === m.id ? `${C.gold}44` : "rgba(201,168,76,0.15)"}`,
              borderRadius: 4, transition: "all 0.15s"
            }}>{m.label}</button>
          ))}
        </div>

        {/* STRIKES FIRST TOGGLE */}
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
          marginBottom: 14, padding: "8px 0",
          opacity: combatMode === "shoot" ? 0.4 : 1,
          pointerEvents: combatMode === "shoot" ? "none" : "auto"
        }}>
          <span style={{ fontSize: 11, color: C.fGold, letterSpacing: 1, textTransform: "uppercase" }}>Strikes First:</span>
          <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderRadius: 6, border: "1px solid rgba(201,168,76,0.15)", overflow: "hidden" }}>
            <button onClick={() => setAFirst(true)} style={{
              padding: "6px 16px", border: "none", cursor: "pointer",
              fontFamily: "'Cinzel', serif", fontSize: 12, fontWeight: 700, letterSpacing: 1,
              background: aFirst ? `${C.gold}30` : "transparent", color: aFirst ? C.gold : C.fGold,
              borderRight: "1px solid rgba(201,168,76,0.15)", transition: "all 0.15s"
            }}>{unitA.name}</button>
            <button onClick={() => setAFirst(false)} style={{
              padding: "6px 16px", border: "none", cursor: "pointer",
              fontFamily: "'Cinzel', serif", fontSize: 12, fontWeight: 700, letterSpacing: 1,
              background: !aFirst ? `${C.gold}30` : "transparent", color: !aFirst ? C.gold : C.fGold,
              transition: "all 0.15s"
            }}>{unitB.name}</button>
          </div>
        </div>

        {/* Unit panels */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <UnitPanel label={`${unitA.name || "UNIT A"}${aFirst ? " FIRST" : ""}`}
            unit={unitA} setUnit={setUnitA}
            atkMods={aAtk} setAtkMods={setAAtk}
            defMods={aDef} setDefMods={setADef}
            options={aOpts} setOptions={setAOptsLinked}
            opponentHealth={parseDice(unitB.health)}
            bsdataUnits={bsdataUnits} showLegacy={showLegacy}
            customPresets={customPresets} onSavePreset={savePreset} onDeletePreset={deletePreset}
            onUpdateBsdataUnit={updateBsdataUnit} />
          <UnitPanel label={`${unitB.name || "UNIT B"}${!aFirst ? " FIRST" : ""}`}
            unit={unitB} setUnit={setUnitB}
            atkMods={bAtk} setAtkMods={setBAtk}
            defMods={bDef} setDefMods={setBDef}
            options={bOpts} setOptions={setBOptsLinked}
            opponentHealth={parseDice(unitA.health)}
            bsdataUnits={bsdataUnits} showLegacy={showLegacy}
            customPresets={customPresets} onSavePreset={savePreset} onDeletePreset={deletePreset}
            onUpdateBsdataUnit={updateBsdataUnit} />
        </div>

        {/* Results */}
        <Results
          firstR={firstResult} secondR={secondResult}
          firstShoot={firstShoot} secondShoot={secondShoot}
          combatMode={combatMode}
          firstUnit={firstUnit} secondUnit={secondUnit}
          firstLabel={firstUnit.name} secondLabel={secondUnit.name}
          firstOpts={firstOpts} secondOpts={secondOpts}
          firstDefMods={firstDefMods} secondDefMods={secondDefMods}
          firstAtkMods={firstAtkMods} secondAtkMods={secondAtkMods}
          firstSurvAfterShoot={firstSurvAfterShoot}
          secondSurvAfterShoot={secondSurvAfterShoot}
          secondSurvForFightback={secondSurvForFightback}
          firstFT={firstFT} secondFT={secondFT}
          firstSurvForFT={firstSurvForFT} secondSurvForFT={secondSurvForFT}
          extraMortals={extraMortals}
          aFirst={aFirst} onToggleFirst={() => setAFirst(p => !p)}
        />

        {/* Monte Carlo Simulator */}
        <SimResults
          firstUnit={firstUnit} secondUnit={secondUnit}
          firstAtkMods={firstAtkMods} secondAtkMods={secondAtkMods}
          firstDefMods={firstDefMods} secondDefMods={secondDefMods}
          firstOpts={firstOpts} secondOpts={secondOpts}
          combatMode={combatMode}
        />
      </>}

      {page === "training" && <TrainingGrounds
        bsdataUnits={bsdataUnits}
        showLegacy={showLegacy}
        customPresets={customPresets}
      />}

      {page === "guide" && <GuidePanel />}

      <div style={{ textAlign: "center", padding: "20px 0 12px", fontSize: 10, color: "#554f43", letterSpacing: 1 }}>
        <div>AOS MATHHAMMER v0.17 — Training Grounds — AoS 4th Edition</div>
        <a href="https://ko-fi.com/yoularp" target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-block", marginTop: 8, padding: "4px 14px", fontSize: 11, fontFamily: "'Cinzel', serif", fontWeight: 600, letterSpacing: 1, color: C.gold, background: "rgba(201,168,76,0.08)", border: `1px solid rgba(201,168,76,0.2)`, borderRadius: 4, textDecoration: "none", transition: "all 0.2s", cursor: "pointer" }}
          onMouseEnter={e => { e.target.style.background = "rgba(201,168,76,0.18)"; e.target.style.borderColor = "rgba(201,168,76,0.4)"; }}
          onMouseLeave={e => { e.target.style.background = "rgba(201,168,76,0.08)"; e.target.style.borderColor = "rgba(201,168,76,0.2)"; }}
        >Support on Ko-fi</a>
      </div>
    </div>
  </div>;
}
