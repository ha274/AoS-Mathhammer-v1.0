import { useState, useCallback } from 'react';
import { C, bI } from '../styles';
import { parseDice, parseThreshold, probPass } from '../engine/combat';
import { PRESETS } from '../data/presets';
import { emptyWeapon } from '../data/defaults';
import UnitSelector from './UnitSelector';
import WeaponRow from './WeaponRow';
import Tog from './ui/Tog';
import Stepper from './ui/Stepper';

// Attempt to auto-detect combat modifiers from ability effect text
function detectAbilityMods(ability) {
  const mods = {};
  const fx = ability.effect || "";

  // "mortal damage equal to the roll" / "inflict D3 mortal damage" / "inflict an amount of mortal damage"
  const mortalMatch = fx.match(/inflict\s+(?:an amount of\s+)?(?:(\d+|D3|D6)\s+)?mortal\s+damage/i);
  if (mortalMatch) {
    mods.mortalDamage = mortalMatch[1] || "D3";
  }

  // "Roll a D3 for each target. On a 2+, inflict..."
  const rollMatch = fx.match(/(?:roll\s+a?\s*)(D3|D6|dice).*?on\s+a?\s*(\d+)\+/i);
  if (rollMatch) {
    mods.mortalThreshold = `${rollMatch[2]}+`;
    mods.mortalDice = rollMatch[1];
  }

  // "Add 1 to the Damage characteristic" / "add 1 to the Attacks characteristic"
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

  // "Strike-last" / "Strike-first"
  if (/strike-last/i.test(fx)) mods.strikeLast = true;
  if (/strike-first/i.test(fx)) mods.strikeFirst = true;

  // WARD detection
  const wardMatch = fx.match(/ward\s*\((\d+\+)\)/i) || fx.match(/ward\s+save\s+of\s+(\d+\+)/i);
  if (wardMatch) mods.ward = wardMatch[1];

  return Object.keys(mods).length > 0 ? mods : null;
}

// Colour-code ability types
const abilityTypeColors = {
  activated: "#e8a848",
  passive: "#68b8e8",
  spell: "#b888dd",
  prayer: "#e86868",
  other: C.fGold,
};

const abilityTypeLabels = {
  activated: "ACT",
  passive: "PASSIVE",
  spell: "SPELL",
  prayer: "PRAYER",
  other: "OTHER",
};

export default function UnitPanel({ label, unit, setUnit, atkMods, setAtkMods, defMods, setDefMods, options, setOptions, opponentHealth, bsdataUnits, showLegacy, customPresets, onSavePreset, onDeletePreset, onUpdateBsdataUnit }) {
  const [showCrit, setShowCrit] = useState(false);
  const [showMortals, setShowMortals] = useState(false);
  const [showAbilities, setShowAbilities] = useState(false);
  const [preReinforce, setPreReinforce] = useState(null);
  const [libSaved, setLibSaved] = useState(false);
  const uW = (i, w) => { const ws = [...unit.weapons]; ws[i] = w; setUnit({ ...unit, weapons: ws }); };
  const lbl = { fontSize: 10, color: C.dGold, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 2 };
  const sc = C.gold;
  const myHealth = parseDice(unit.health);
  const canPT = myHealth > (opponentHealth || 0) && (opponentHealth || 0) > 0;
  const isReinforced = !!preReinforce;
  const canReinforce = (unit.modelCount || 1) > 1;

  const handleImport = useCallback((imported) => {
    const hasChamp = (imported.keywords || []).some(k => k.toUpperCase() === "CHAMPION");
    // Restore saved combat config if the unit has one, otherwise reset to defaults
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
    setDefMods(prev => ({ ...prev, ward: imported.ward || saved?.ward || "" }));
    setPreReinforce(null);
    setUnit(imported);
  }, [setUnit, setDefMods, setAtkMods]);

  // Snapshot combat config onto unit for persistence
  const unitWithConfig = useCallback(() => {
    const config = {
      critOn: atkMods.critOn,
      critBuff: atkMods.critBuff,
      onXThreshold: atkMods.onXThreshold,
      onXDamage: atkMods.onXDamage,
      onXTiming: atkMods.onXTiming,
      perModelThreshold: atkMods.perModelThreshold,
      ward: defMods.ward,
    };
    // Only store if anything is non-default
    const hasConfig = config.critOn !== 6 || config.critBuff || config.onXThreshold ||
      config.onXDamage || config.perModelThreshold || config.ward;
    return { ...unit, savedCombatConfig: hasConfig ? config : undefined };
  }, [unit, atkMods, defMods.ward]);

  const abilities = unit.abilities || [];
  const combatAbilities = abilities.filter(a => a.combatRelevant);

  return <div style={{ background: "linear-gradient(180deg, rgba(30,26,20,0.95) 0%, rgba(20,18,14,0.98) 100%)", border: `1px solid ${sc}33`, borderRadius: 8, padding: 16, flex: 1, minWidth: 340 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${sc}44`, paddingBottom: 8, marginBottom: 12 }}>
      <span style={{ color: sc, fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 14, letterSpacing: 2 }}>{label}</span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
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
        {unit.__key && <button onClick={() => {
          const toSave = unitWithConfig();
          const originalKey = unit.__key;
          const newKey = onUpdateBsdataUnit(toSave, originalKey);
          // If name changed, a new entry was created — update our __key to track it
          if (newKey && newKey !== originalKey) {
            setUnit(prev => ({ ...prev, __key: newKey }));
          }
          setLibSaved(true);
          setTimeout(() => setLibSaved(false), 2000);
        }} title="Save changes back to BSData library" style={{
          background: libSaved ? "rgba(92,204,136,0.2)" : "rgba(74,158,222,0.1)",
          border: `1px solid ${libSaved ? "rgba(92,204,136,0.5)" : "rgba(74,158,222,0.3)"}`,
          color: libSaved ? "#5cc888" : "#4a9ede", borderRadius: 4, cursor: "pointer", fontSize: 10,
          padding: "3px 8px", fontFamily: "'Cinzel', serif", whiteSpace: "nowrap"
        }}>{libSaved ? "Saved!" : "Save to Library"}</button>}
        <button onClick={() => onSavePreset(unitWithConfig())} title="Save current unit as custom preset" style={{
          background: "rgba(92,204,136,0.1)", border: "1px solid rgba(92,204,136,0.3)",
          color: "#5cc888", borderRadius: 4, cursor: "pointer", fontSize: 10,
          padding: "3px 8px", fontFamily: "'Cinzel', serif", whiteSpace: "nowrap"
        }}>Save Preset</button>
        {customPresets.some(p => p.name === unit.name) && <button onClick={() => onDeletePreset(unit.name)} title="Delete saved preset" style={{
          background: "rgba(180,40,40,0.15)", border: "1px solid rgba(180,40,40,0.3)",
          color: "#e88", borderRadius: 4, cursor: "pointer", fontSize: 10,
          padding: "3px 6px", fontFamily: "'Cinzel', serif"
        }}>&#x2715;</button>}
      </div>
    </div>

    <UnitSelector units={bsdataUnits} showLegacy={showLegacy} onSelectUnit={handleImport} />

    <div style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 8, marginBottom: 8 }}>
      <div><div style={lbl}>Unit Name</div><input value={unit.name} onChange={e => setUnit({ ...unit, name: e.target.value })} style={bI} /></div>
      <div><div style={lbl}>Points</div><input type="number" value={unit.points} onChange={e => setUnit({ ...unit, points: parseInt(e.target.value) || 0 })} style={{ ...bI, textAlign: "center" }} /></div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <button onClick={() => {
          if (!canReinforce) return;
          if (!isReinforced) {
            setPreReinforce({ modelCount: unit.modelCount || 1, points: unit.points || 0, weaponCounts: unit.weapons.map(w => w.modelCount || 1) });
            const newWeapons = unit.weapons.map(w => ({ ...w, modelCount: (w.modelCount || 1) * 2 }));
            setUnit({ ...unit, modelCount: (unit.modelCount || 1) * 2, points: (unit.points || 0) * 2, weapons: newWeapons });
          } else {
            const orig = preReinforce;
            const newWeapons = unit.weapons.map((w, i) => ({ ...w, modelCount: i < orig.weaponCounts.length ? orig.weaponCounts[i] : w.modelCount }));
            setUnit({ ...unit, modelCount: orig.modelCount, points: orig.points, weapons: newWeapons });
            setPreReinforce(null);
          }
        }} disabled={!canReinforce} title={
          isReinforced ? "Click to remove reinforcement" :
          (unit.modelCount || 1) <= 1 ? "Cannot reinforce a unit with minimum size 1" : "Double models and points (3.3 Reinforced Units)"
        } style={{
          background: isReinforced ? "rgba(92,204,136,0.15)" : canReinforce ? "rgba(92,204,136,0.1)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${isReinforced ? "rgba(92,204,136,0.5)" : canReinforce ? "rgba(92,204,136,0.3)" : "rgba(255,255,255,0.08)"}`,
          color: isReinforced ? "#5cc888" : canReinforce ? "#5cc888" : "#555",
          borderRadius: 4, cursor: canReinforce ? "pointer" : "default", fontSize: 10,
          padding: "5px 8px", fontFamily: "'Cinzel', serif", letterSpacing: 0.5,
          textTransform: "uppercase", whiteSpace: "nowrap", opacity: canReinforce ? 1 : 0.6,
        }}>{isReinforced ? "\u2713 Reinforced" : "Reinforce"}</button>
      </div>
    </div>

    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
      {[["modelCount", "Models", "number"], ["health", "Health"], ["save", "Save"], ["control", "Control", "number"]].map(([k, l, t]) =>
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

    {/* UNIT ABILITIES */}
    {abilities.length > 0 && <div style={{ marginBottom: 10 }}>
      <button onClick={() => setShowAbilities(!showAbilities)} style={{
        background: showAbilities ? "rgba(104,184,232,0.08)" : "transparent",
        border: `1px solid ${showAbilities ? "rgba(104,184,232,0.25)" : "rgba(255,255,255,0.06)"}`,
        color: showAbilities ? "#68b8e8" : C.fGold, borderRadius: 4, cursor: "pointer", fontSize: 10,
        padding: "4px 10px", fontFamily: "'Cinzel', serif", letterSpacing: 1, textTransform: "uppercase",
        width: "100%", textAlign: "left", transition: "all 0.15s",
      }}>
        {showAbilities ? "▾" : "▸"} Unit Abilities ({abilities.length})
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
              {mods.extraAttacks && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(201,168,76,0.15)", color: C.gold }}>
                +{mods.extraAttacks} Attacks
              </span>}
              {mods.damageMod && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(201,168,76,0.15)", color: C.gold }}>
                +{mods.damageMod} Damage
              </span>}
              {mods.rendMod && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(201,168,76,0.15)", color: C.gold }}>
                +{mods.rendMod} Rend
              </span>}
              {mods.hitMod && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(201,168,76,0.15)", color: C.gold }}>
                +{mods.hitMod} Hit
              </span>}
              {mods.woundMod && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(201,168,76,0.15)", color: C.gold }}>
                +{mods.woundMod} Wound
              </span>}
              {mods.strikeLast && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(232,104,104,0.15)", color: "#e86868" }}>
                Strike-last
              </span>}
              {mods.strikeFirst && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(92,204,136,0.15)", color: "#5cc888" }}>
                Strike-first
              </span>}
              {mods.ward && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(160,96,192,0.15)", color: "#a060c0" }}>
                Ward {mods.ward}
              </span>}
            </div>}
          </div>;
        })}
      </div>}
    </div>}

    <div style={{ borderTop: `1px solid ${sc}22`, paddingTop: 10, marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ ...lbl, marginBottom: 0, fontSize: 11 }}>WEAPONS</span>
        <button onClick={() => setUnit({ ...unit, weapons: [...unit.weapons, emptyWeapon()] })} style={{ background: `${sc}22`, border: `1px solid ${sc}44`, color: sc, borderRadius: 4, cursor: "pointer", fontSize: 11, padding: "2px 8px", fontFamily: "'Cinzel', serif" }}>+ Add</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "34px 1.4fr 40px 38px 38px 38px 38px 1fr 34px 28px", gap: 4, padding: "2px 0", borderBottom: "1px solid rgba(201,168,76,0.15)" }}>
        {["Type", "Name", "Atk", "Hit", "Wnd", "Rnd", "Dmg", "Ability", "#", ""].map(h => <span key={h} style={{ fontSize: 9, color: C.fGold, textTransform: "uppercase", textAlign: "center", letterSpacing: 0.8 }}>{h}</span>)}
      </div>
      {unit.weapons.map((w, i) => <WeaponRow key={i} w={w} onChange={w => uW(i, w)} onRemove={() => setUnit({ ...unit, weapons: unit.weapons.filter((_, j) => j !== i) })} canRemove={unit.weapons.length > 1} />)}
    </div>

    {/* ATTACK BUFFS */}
    <div style={{ borderTop: `1px solid ${C.gold}22`, paddingTop: 10, marginTop: 12 }}>
      <div style={{ fontSize: 11, color: C.gold, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, fontFamily: "'Cinzel', serif" }}>Attack Buffs</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        <Tog on={atkMods.allOutAttack} click={() => setAtkMods({ ...atkMods, allOutAttack: !atkMods.allOutAttack })} color={C.gold}>All-Out Attack</Tog>
        {(unit.keywords || []).some(k => k.toUpperCase() === "CHAMPION") &&
          <Tog on={atkMods.champion} click={() => setAtkMods({ ...atkMods, champion: !atkMods.champion })} color={C.gold}>Champion</Tog>
        }
        <Tog on={options.charged} click={() => setOptions({ ...options, charged: !options.charged })} color="#c87828">Charged</Tog>
        <Tog on={options.wasCharged} click={() => setOptions({ ...options, wasCharged: !options.wasCharged })} color="#d88820">Was Charged</Tog>
        {canPT
          ? <Tog on={options.powerThrough} click={() => setOptions({ ...options, powerThrough: !options.powerThrough })} color="#d06040">Power Through</Tog>
          : <Tog on={false} click={() => {}} color="#444">Power Through</Tog>
        }
        <Tog on={options.fightTwice} click={() => setOptions({ ...options, fightTwice: !options.fightTwice })} color="#b888dd">Fight Twice</Tog>
      </div>
      {options.fightTwice && <div style={{ fontSize: 9, color: "#887755", fontStyle: "italic", marginTop: 2, marginBottom: 4 }}>
        2 FIGHT abilities this phase. After the first, this unit has STRIKE-LAST.
      </div>}
      {!canPT && <div style={{ fontSize: 9, color: "#665", fontStyle: "italic", marginTop: 2, marginBottom: 4 }}>
        Power Through requires higher Health than opponent ({myHealth} vs {opponentHealth || "?"})
      </div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "flex-start" }}>
        <Stepper label="Hit" value={atkMods.hitMod} onChange={v => setAtkMods({ ...atkMods, hitMod: v })} min={-3} max={2} capMin={-1} capMax={1} color={C.gold}
          badges={[{ label: "AoA", value: atkMods.allOutAttack ? 1 : 0, color: C.green }]} />
        <Stepper label="Wound" value={atkMods.woundMod} onChange={v => setAtkMods({ ...atkMods, woundMod: v })} min={-3} max={2} capMin={-1} capMax={1} color={C.gold} />
        <Stepper label="Rend" value={atkMods.rendMod} onChange={v => setAtkMods({ ...atkMods, rendMod: v })} color={C.gold} />
        <Stepper label="Dmg" value={atkMods.damageMod} onChange={v => setAtkMods({ ...atkMods, damageMod: v })} color={C.gold} />
        <Stepper label="Atk" value={atkMods.extraAttacks} onChange={v => setAtkMods({ ...atkMods, extraAttacks: v })} color={C.gold} />
      </div>

      {/* CRIT BUFFS */}
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
            {showCrit ? "▾" : "▸"} Crit Buffs
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
            <div style={{ fontSize: 9, color: "#887755", fontStyle: "italic", alignSelf: "center", maxWidth: 180 }}>
              Only affects non-Companion weapons without a profile crit ability
            </div>
          </div>}
        </div>;
      })()}

      {/* MORTAL WOUND ABILITIES */}
      {(() => {
        const hasOnX = !!atkMods.onXThreshold;
        const hasPM = !!atkMods.perModelThreshold;
        const hasAny = hasOnX || hasPM;
        // Auto-expand when something is active
        const isOpen = showMortals || hasAny;
        return <div style={{ marginTop: 6 }}>
          <button onClick={() => setShowMortals(!isOpen)} style={{
            background: hasAny ? "rgba(232,104,104,0.1)" : "transparent",
            border: `1px solid ${hasAny ? "rgba(232,104,104,0.3)" : "rgba(255,255,255,0.06)"}`,
            color: hasAny ? "#e86868" : C.fGold, borderRadius: 4, cursor: "pointer",
            fontSize: 10, padding: "4px 10px", fontFamily: "'Cinzel', serif",
            letterSpacing: 1, textTransform: "uppercase", width: "100%", textAlign: "left"
          }}>
            {isOpen ? "▾" : "▸"} Mortal Wound Abilities
            {hasAny && <span style={{ marginLeft: 8, fontSize: 9, opacity: 0.8 }}>
              {hasOnX ? `${atkMods.onXDamage || "D3"} on ${atkMods.onXThreshold} (${atkMods.onXTiming || "after"})` : ""}
              {hasOnX && hasPM ? " + " : ""}
              {hasPM ? `Per model ${atkMods.perModelThreshold}` : ""}
            </span>}
          </button>
          {isOpen && <div style={{ padding: "8px 0 4px", borderLeft: "2px solid rgba(232,104,104,0.15)", paddingLeft: 8, marginTop: 4 }}>

            {/* D3 ON X+ MORTALS — on/off toggle + config */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Tog on={hasOnX} click={() => {
                  if (!hasOnX) {
                    setAtkMods({ ...atkMods, onXThreshold: "2+", onXDamage: atkMods.onXDamage || "D3" });
                  } else {
                    setAtkMods({ ...atkMods, onXThreshold: "" });
                  }
                }} color="#e86868">Roll for Mortals</Tog>
                <span style={{ fontSize: 9, color: C.fGold, fontStyle: "italic" }}>(Breath attacks, impact mortals, etc)</span>
              </div>
              {hasOnX && <>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
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
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 8, color: C.fGold, textTransform: "uppercase", letterSpacing: 0.8 }}>Timing</span>
                    <button onClick={() => {
                      const cycle = ["before", "during", "after"];
                      const idx = cycle.indexOf(atkMods.onXTiming || "after");
                      setAtkMods({ ...atkMods, onXTiming: cycle[(idx + 1) % cycle.length] });
                    }} style={{
                      background: "rgba(232,104,104,0.12)", border: "1px solid rgba(232,104,104,0.3)",
                      color: "#e86868", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 700,
                      padding: "4px 10px", fontFamily: "'Cinzel', serif", minWidth: 60, textTransform: "capitalize"
                    }}>{atkMods.onXTiming || "after"}</button>
                  </div>
                  <span style={{ fontSize: 10, color: C.fGold, fontStyle: "italic", alignSelf: "center" }}>
                    = {(probPass(parseThreshold(atkMods.onXThreshold)) * parseDice(atkMods.onXDamage || "D3")).toFixed(2)} avg mortals
                  </span>
                </div>
                <div style={{ fontSize: 9, color: "#886655", fontStyle: "italic", marginTop: 4 }}>
                  {(atkMods.onXTiming || "after") === "before" ? "Applied before combat — reduces enemy models before they attack" :
                   (atkMods.onXTiming || "after") === "during" ? "Applied during combat — added to weapon damage total" :
                   "Applied after combat — extra damage on top of combat results"}
                </div>
              </>}
            </div>

            {/* PER-MODEL MORTALS */}
            <div>
              <div style={{ fontSize: 9, color: "#e86868", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                Per enemy model, on X+ deal 1 mortal <span style={{ color: C.fGold, fontStyle: "italic" }}>(Lightning Bolts, etc)</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
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
                {hasPM && <span style={{ fontSize: 10, color: C.fGold, fontStyle: "italic", alignSelf: "center" }}>
                  x enemy models (calculated in results)
                </span>}
              </div>
            </div>
          </div>}
        </div>;
      })()}
    </div>

    {/* DEFENCE BUFFS */}
    <div style={{ borderTop: `1px solid ${C.red}22`, paddingTop: 10, marginTop: 12 }}>
      <div style={{ fontSize: 11, color: C.red, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, fontFamily: "'Cinzel', serif" }}>Defence Buffs</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        <Tog on={defMods.allOutDefence} click={() => setDefMods({ ...defMods, allOutDefence: !defMods.allOutDefence })} color={C.red}>All-Out Defence</Tog>
        <Tog on={!!defMods.ward} click={() => {
          const ws = ["", "6+", "5+", "4+"];
          setDefMods({ ...defMods, ward: ws[(ws.indexOf(defMods.ward || "") + 1) % ws.length] });
        }} color={defMods.ward ? "#a060c0" : C.fGold}>Ward {defMods.ward || "None"}</Tog>
        <Tog on={options.save6Reflect} click={() => setOptions({ ...options, save6Reflect: !options.save6Reflect })} color="#60a0d0">Save 6 Reflect</Tog>
      </div>
      {options.save6Reflect && <div style={{ fontSize: 9, color: "#607888", fontStyle: "italic", marginTop: -4, marginBottom: 4 }}>
        Save reflect: unmodified save of 6 in combat = 1 mortal back to attacker
      </div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <Stepper label="Save" value={defMods.saveMod} onChange={v => setDefMods({ ...defMods, saveMod: v })} min={-3} max={2} color={C.red}
          badges={[
            { label: "AoD", value: defMods.allOutDefence ? 1 : 0, color: C.green },
            { label: "AoA", value: atkMods.allOutAttack ? -1 : 0, color: "#e86868" }
          ]} />
      </div>
    </div>
  </div>;
}
