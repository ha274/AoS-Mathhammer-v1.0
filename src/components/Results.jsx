import { useState } from 'react';
import { C } from '../styles';
import { parseDice } from '../engine/combat';
import StatBadge from './ui/StatBadge';
import WBreak from './WBreak';

const timingLabels = { before: "Pre-Combat", during: "During Combat", after: "Post-Combat" };

export default function Results({ firstR, secondR, firstShoot, secondShoot, combatMode, firstUnit, secondUnit, firstLabel, secondLabel, firstOpts, secondOpts, firstDefMods, secondDefMods, firstAtkMods, secondAtkMods, firstSurvAfterShoot, secondSurvAfterShoot, secondSurvForFightback, firstFT, secondFT, firstSurvForFT, secondSurvForFT, extraMortals, aFirst, onToggleFirst }) {
  const pF = firstUnit.points || 1, pS = secondUnit.points || 1;
  const defHealthFirst = parseDice(firstUnit.health);
  const defHealthSecond = parseDice(secondUnit.health);
  const cBlue = "#4a9ede";

  // All extra mortal calculations come from the engine (single source of truth)
  const {
    fPTDmg, sPTDmg, fOnXDmg, sOnXDmg, fPMDmg, sPMDmg,
    reflectToFirst, reflectToSecond,
    fOnXBefore, fOnXDuring, fOnXAfter,
    sOnXBefore, sOnXDuring, sOnXAfter,
    fOnXTiming, sOnXTiming,
  } = extraMortals;

  // Pre-combat kills (before-timing mortals reduce enemy models before combat)
  const fPreCombatDmg = fOnXBefore;
  const sPreCombatDmg = sOnXBefore;
  const fPreCombatKills = defHealthSecond > 0 ? Math.min(Math.floor(fPreCombatDmg / defHealthSecond), secondUnit.modelCount) : 0;
  const sPreCombatKills = defHealthFirst > 0 ? Math.min(Math.floor(sPreCombatDmg / defHealthFirst), firstUnit.modelCount) : 0;

  // During-combat mortals add to melee total
  const fMeleePlusDuring = firstR.totalDamage + fOnXDuring;
  const sMeleePlusDuring = secondR.totalDamage + sOnXDuring;

  // After-combat extras (post-combat timing + power through + per-model + reflect)
  const fAfterExtras = fOnXAfter + fPMDmg + fPTDmg + reflectToSecond;
  const sAfterExtras = sOnXAfter + sPMDmg + sPTDmg + reflectToFirst;

  // Fight twice damage
  const fFTDmg = firstFT ? firstFT.totalDamage : 0;
  const sFTDmg = secondFT ? secondFT.totalDamage : 0;

  // Grand totals
  const fShootDmg = firstShoot ? firstShoot.totalDamage : 0;
  const sShootDmg = secondShoot ? secondShoot.totalDamage : 0;
  const fDmg = fPreCombatDmg + fShootDmg + fMeleePlusDuring + fAfterExtras + fFTDmg;
  const sDmg = sPreCombatDmg + sShootDmg + sMeleePlusDuring + sAfterExtras + sFTDmg;

  const fK = defHealthSecond > 0 ? Math.min(Math.floor(fDmg / defHealthSecond), secondUnit.modelCount) : 0;
  const sK = defHealthFirst > 0 ? Math.min(Math.floor(sDmg / defHealthFirst), firstUnit.modelCount) : 0;

  const surv = combatMode === "shoot" ? secondUnit.modelCount : secondSurvForFightback;

  const fDmg100 = pF > 0 ? fDmg / pF * 100 : 0;
  const sDmg100 = pS > 0 ? sDmg / pS * 100 : 0;
  const fPPK = fK > 0 ? pF / fK : Infinity;
  const sPPK = sK > 0 ? pS / sK : Infinity;
  const fPD = secondUnit.modelCount > 0 ? (fK / secondUnit.modelCount) * pS : 0;
  const sPD = firstUnit.modelCount > 0 ? (sK / firstUnit.modelCount) * pF : 0;
  const fROI = pF > 0 ? fPD / pF * 100 : 0;
  const sROI = pS > 0 ? sPD / pS * 100 : 0;
  const net = fPD - sPD;
  const winner = net > 0.5 ? "first" : net < -0.5 ? "second" : "draw";

  // Display sides: left always = unitA panel position, right always = unitB
  const lUnit = aFirst ? firstUnit : secondUnit;
  const rUnit = aFirst ? secondUnit : firstUnit;
  const lCol = aFirst ? C.gold : C.red;
  const rCol = aFirst ? C.red : C.gold;
  const fSum = { pre: fPreCombatDmg, shoot: fShootDmg, melee: firstR.totalDamage, ft: fFTDmg, during: fOnXDuring, after: fAfterExtras, total: fDmg, kills: fK, d100: fDmg100, ppk: fPPK, pd: fPD, roi: fROI };
  const sSum = { pre: sPreCombatDmg, shoot: sShootDmg, melee: secondR.totalDamage, ft: sFTDmg, during: sOnXDuring, after: sAfterExtras, total: sDmg, kills: sK, d100: sDmg100, ppk: sPPK, pd: sPD, roi: sROI };
  const lD = aFirst ? fSum : sSum;
  const rD = aFirst ? sSum : fSum;

  const hasPreCombat = fPreCombatDmg > 0 || sPreCombatDmg > 0;
  const hasAfterExtras = fAfterExtras > 0 || sAfterExtras > 0;
  const hasDuringExtras = fOnXDuring > 0 || sOnXDuring > 0;
  const hasFT = fFTDmg > 0 || sFTDmg > 0;

  // Collapsible sections (all collapsed by default)
  const [showAttackDetail, setShowAttackDetail] = useState(false);
  const [showTotalDetail, setShowTotalDetail] = useState(false);
  const [showEffDetail, setShowEffDetail] = useState(false);

  const modeDesc = combatMode === "shoot" ? "Shooting Phase"
    : combatMode === "shootCharge" ? "Shoot + Charge + Melee + Fight Back"
    : `${firstLabel} Strikes + Casualties + ${secondLabel} Fights Back`;

  const eff = (label, d100, ppk, pd, roi, col, align = "left") => <div style={{ textAlign: align }}>
    <div style={{ fontSize: 10, color: C.dGold, marginBottom: 6, fontWeight: 600 }}>{label}</div>
    {[[d100.toFixed(1), "dmg / 100pts"], [ppk === Infinity ? "\u221E" : ppk.toFixed(0), "pts / kill"], [pd.toFixed(0), "pts destroyed"], [`${roi.toFixed(0)}%`, "ROI"]].map(([v, l], i) =>
      <div key={i} style={{ display: "flex", justifyContent: align === "right" ? "flex-end" : "flex-start", fontSize: 12, padding: "2px 0", gap: 6 }}>
        {align === "right" ? <>
          <span style={{ color: C.fGold, fontSize: 10 }}>{l}</span>
          <span style={{ color: i === 3 && roi >= 100 ? C.green : col, fontWeight: 600 }}>{v}</span>
        </> : <>
          <span style={{ color: i === 3 && roi >= 100 ? C.green : col, fontWeight: 600 }}>{v}</span>
          <span style={{ color: C.fGold, fontSize: 10 }}>{l}</span>
        </>}
      </div>
    )}
  </div>;

  const dmgCol = (unit, d, col, align) => {
    const rows = [
      [d.pre, "Pre-combat mortals", "#e86868"],
      [d.shoot, "Shooting", cBlue],
      [d.melee, "Melee", col],
      [d.ft, "Fight Twice", "#b888dd"],
      [d.during, "During-combat mortals", "#e86868"],
      [d.after, "Post-combat extras", "#d06040"],
    ];
    const R = align === "right";
    return <div>
      <div style={{ fontSize: 11, color: col, fontWeight: 700, marginBottom: 4, textAlign: align }}>{unit.name}</div>
      {rows.map(([v, l, c], i) => v > 0 ? <div key={i} style={{ display: "flex", justifyContent: R ? "flex-end" : "flex-start", fontSize: 10, color: C.dGold, padding: "1px 0", gap: 8 }}>
        {R ? <>
          <span style={{ color: c, fontWeight: 600 }}>{v.toFixed(1)}</span>
          <span style={{ minWidth: 130, textAlign: "right" }}>{l}</span>
        </> : <>
          <span style={{ minWidth: 130 }}>{l}</span>
          <span style={{ color: c, fontWeight: 600 }}>{v.toFixed(1)}</span>
        </>}
      </div> : null)}
      <div style={{ display: "flex", justifyContent: R ? "flex-end" : "flex-start", fontSize: 12, color: col, fontWeight: 700, borderTop: `1px solid ${col}33`, paddingTop: 3, marginTop: 3, gap: 8 }}>
        {R ? <>
          <span>{d.total.toFixed(1)} dmg, {d.kills} kills</span>
          <span style={{ minWidth: 130, textAlign: "right" }}>Total</span>
        </> : <>
          <span style={{ minWidth: 130 }}>Total</span>
          <span>{d.total.toFixed(1)} dmg, {d.kills} kills</span>
        </>}
      </div>
    </div>;
  };

  const PhaseBlock = ({ title, icon, color, result, subtitle = null, extraDmg = 0, extraLabel = null }) => {
    if (!result || (result.weapons.length === 0 && extraDmg <= 0)) return null;
    const pCrit = result.weapons.reduce((s, w) => s + (w.critDamage || 0), 0);
    const totalWithExtra = result.totalDamage + extraDmg;
    return <div style={{ background: `${color}0a`, border: `1px solid ${color}20`, borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>{icon} {title}</div>
          {subtitle && <div style={{ fontSize: 10, color: C.fGold, marginBottom: 4, fontStyle: "italic" }}>{subtitle}</div>}
          <div style={{ fontSize: 32, fontFamily: "'Cinzel', serif", fontWeight: 700, color }}>
            {totalWithExtra.toFixed(1)} <span style={{ fontSize: 14, fontWeight: 400, color: C.dGold }}>avg dmg</span>
          </div>
          {pCrit > 0 && <div style={{ fontSize: 11, color: "#b888dd", fontWeight: 600, marginTop: 2 }}>
            {pCrit.toFixed(1)} from crits <span style={{ fontWeight: 400, fontSize: 10, color: C.fGold }}>({(pCrit / (totalWithExtra || 1) * 100).toFixed(0)}% of total)</span>
          </div>}
          {extraDmg > 0 && extraLabel && <div style={{ fontSize: 11, color: "#e86868", fontWeight: 600, marginTop: 2 }}>
            +{extraDmg.toFixed(1)} {extraLabel}
          </div>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatBadge label="Kills" value={result.modelsKilled} color={color} />
          <StatBadge label="% Unit" value={`${result.percentUnitKilled.toFixed(0)}%`} color={color} />
        </div>
      </div>
      {result.weapons.length > 0 && <WBreak weapons={result.weapons} color={color} />}
    </div>;
  };

  // Mortal line item renderer
  const MortalLine = ({ label, value, color = "#e86868" }) => value > 0 ? (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "1px 8px", color: C.dGold }}>
      <span>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value.toFixed(2)}</span>
    </div>
  ) : null;

  // Mortal section for a direction (attacker -> defender)
  const MortalSection = ({ unitName, color, onXDmg, onXLabel, pmDmg, pmCount, pmThreshold, ptDmg, reflectDmg, timing }) => {
    const hasAny = onXDmg > 0 || pmDmg > 0 || ptDmg > 0 || reflectDmg > 0;
    if (!hasAny) return null;
    return <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 2 }}>{unitName}</div>
      {onXDmg > 0 && <MortalLine label={`${onXLabel} (${timingLabels[timing]})`} value={onXDmg} />}
      {pmDmg > 0 && <MortalLine label={`Per model (${pmCount}) on ${pmThreshold}`} value={pmDmg} />}
      {ptDmg > 0 && <MortalLine label="Power Through (D3)" value={ptDmg} color="#d06040" />}
      {reflectDmg > 0 && <MortalLine label="Save 6 Reflect" value={reflectDmg} color="#60a0d0" />}
    </div>;
  };

  return <div style={{ background: "linear-gradient(180deg, rgba(25,22,18,0.97) 0%, rgba(15,13,10,0.99) 100%)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 8, padding: 20 }}>
    <div style={{ textAlign: "center", marginBottom: 16 }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 700, color: C.gold, letterSpacing: 3, textTransform: "uppercase" }}>Combat Results</div>
      <div style={{ fontSize: 11, color: C.fGold, marginTop: 2 }}>
        {hasPreCombat ? "Pre-Combat Mortals + " : ""}{modeDesc}{hasFT ? " + Fight Twice" : ""}{hasAfterExtras ? " + Extra Mortals" : ""}
      </div>
    </div>

    {/* VS */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginBottom: 12, gap: 12 }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 15, color: lCol, fontWeight: 700 }}>{lUnit.name}</div>
        <div style={{ fontSize: 11, color: C.fGold }}>{lUnit.points || 0} pts | {lUnit.modelCount} models</div>
      </div>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 22, color: "#555", fontWeight: 700 }}>VS</div>
      <div>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 15, color: rCol, fontWeight: 700 }}>{rUnit.name}</div>
        <div style={{ fontSize: 11, color: C.fGold }}>{rUnit.points || 0} pts | {rUnit.modelCount} models</div>
      </div>
    </div>
    {/* Strikes First indicator */}
    {combatMode !== "shoot" && <div
      onClick={onToggleFirst}
      style={{ textAlign: "center", marginBottom: 16, cursor: onToggleFirst ? "pointer" : "default", padding: "5px 0", fontSize: 11, borderRadius: 4, background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.08)", transition: "background 0.15s" }}
      title={onToggleFirst ? "Click to swap who strikes first" : undefined}
    >
      <span style={{ color: aFirst ? lCol : rCol, fontWeight: 700, fontFamily: "'Cinzel', serif" }}>{firstUnit.name}</span>
      <span style={{ color: C.fGold }}> strikes first</span>
      {onToggleFirst && <span style={{ fontSize: 9, marginLeft: 6, color: C.dGold, opacity: 0.6 }}>(click to swap)</span>}
    </div>}

    {/* ATTACK SEQUENCE — collapsible */}
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setShowAttackDetail(!showAttackDetail)} style={{
        background: showAttackDetail ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.04)",
        border: `1px solid ${showAttackDetail ? "rgba(201,168,76,0.25)" : "rgba(201,168,76,0.12)"}`,
        color: C.gold, borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "8px 12px",
        fontFamily: "'Cinzel', serif", letterSpacing: 1.5, textTransform: "uppercase",
        width: "100%", textAlign: "center", transition: "all 0.15s"
      }}>
        <span style={{ fontSize: 18, lineHeight: 1, verticalAlign: "middle", marginRight: 6 }}>{showAttackDetail ? "\u25BE" : "\u25B8"}</span>
        Attack Sequence
      </button>

      {!showAttackDetail && <div style={{
        background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.10)",
        borderTop: "none", borderRadius: "0 0 6px 6px", padding: "10px 14px"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: C.fGold, marginBottom: 2 }}>{firstUnit.name}</div>
            <div style={{ fontSize: 20, fontFamily: "'Cinzel', serif", fontWeight: 700, color: C.gold }}>
              {fDmg.toFixed(1)} <span style={{ fontSize: 10, fontWeight: 400, color: C.dGold }}>dmg</span>
            </div>
            <div style={{ fontSize: 10, color: C.lRed }}>{fK} kill{fK !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ textAlign: "center", padding: "0 4px" }}>
            <div style={{ fontSize: 10, color: C.fGold }}>
              {surv > 0 ? <>{surv} fight{surv === 1 ? "s" : ""} back</> : <span style={{ color: C.green }}>WIPED</span>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.fGold, marginBottom: 2 }}>{secondUnit.name}</div>
            <div style={{ fontSize: 20, fontFamily: "'Cinzel', serif", fontWeight: 700, color: C.red }}>
              {sDmg.toFixed(1)} <span style={{ fontSize: 10, fontWeight: 400, color: C.dGold }}>dmg</span>
            </div>
            <div style={{ fontSize: 10, color: C.lRed }}>{sK} kill{sK !== 1 ? "s" : ""}</div>
          </div>
        </div>
      </div>}

      {showAttackDetail && <div style={{ marginTop: 8 }}>
        {/* PRE-COMBAT MORTALS */}
        {hasPreCombat && <div style={{
          background: "rgba(232,104,104,0.08)", border: "1px solid rgba(232,104,104,0.2)", borderRadius: 6, padding: 12, marginBottom: 12
        }}>
          <div style={{ fontSize: 10, color: "#e86868", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, fontFamily: "'Cinzel', serif" }}>Pre-Combat Mortal Wounds</div>
          {fPreCombatDmg > 0 && <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 600, marginBottom: 2 }}>{firstUnit.name} &rarr; {secondUnit.name}</div>
            <MortalLine label={`${firstAtkMods.onXDamage || "D3"} on ${firstAtkMods.onXThreshold}`} value={fPreCombatDmg} />
            {fPreCombatKills > 0 && <div style={{ fontSize: 10, color: "#e86868", padding: "2px 8px", fontStyle: "italic" }}>
              {fPreCombatKills} model{fPreCombatKills !== 1 ? "s" : ""} slain before combat begins
            </div>}
          </div>}
          {sPreCombatDmg > 0 && <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: C.red, fontWeight: 600, marginBottom: 2 }}>{secondUnit.name} &rarr; {firstUnit.name}</div>
            <MortalLine label={`${secondAtkMods.onXDamage || "D3"} on ${secondAtkMods.onXThreshold}`} value={sPreCombatDmg} />
            {sPreCombatKills > 0 && <div style={{ fontSize: 10, color: "#e86868", padding: "2px 8px", fontStyle: "italic" }}>
              {sPreCombatKills} model{sPreCombatKills !== 1 ? "s" : ""} slain before combat begins
            </div>}
          </div>}
        </div>}

        {/* SHOOTING PHASE */}
        {combatMode !== "melee" && (firstShoot?.weapons.length > 0 || secondShoot?.weapons.length > 0) && <>
          <div style={{ textAlign: "center", padding: "4px 0 8px" }}>
            <span style={{ fontFamily: "'Cinzel', serif", fontSize: 12, color: cBlue, letterSpacing: 2, textTransform: "uppercase" }}>Shooting Phase</span>
            <div style={{ fontSize: 10, color: C.fGold, marginTop: 2 }}>Both units fire simultaneously</div>
          </div>
          <PhaseBlock title={`${firstLabel} Shoots`} icon="" color={cBlue} result={firstShoot} />
          <PhaseBlock title={`${secondLabel} Shoots`} icon="" color="#de6a4a" result={secondShoot} />
          {combatMode === "shootCharge" && <div style={{ textAlign: "center", padding: "8px 12px", marginBottom: 12, background: "rgba(74,158,222,0.08)", border: "1px solid rgba(74,158,222,0.2)", borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: cBlue }}>
              After shooting: {firstLabel} <strong>{firstSurvAfterShoot}</strong>/{firstUnit.modelCount} alive
              {" | "}{secondLabel} <strong>{secondSurvAfterShoot}</strong>/{secondUnit.modelCount} alive
              {firstSurvAfterShoot > 0 ? " - Charge!" : ""}
            </span>
          </div>}
        </>}

        {combatMode !== "melee" && !firstShoot?.weapons.length && !secondShoot?.weapons.length && <div style={{
          textAlign: "center", padding: "16px 12px", marginBottom: 12, background: "rgba(74,158,222,0.05)",
          border: "1px solid rgba(74,158,222,0.15)", borderRadius: 6, color: C.fGold, fontSize: 12, fontStyle: "italic"
        }}>Neither unit has ranged weapons enabled</div>}

        {/* MELEE PHASE */}
        {combatMode !== "shoot" && <>
          {combatMode === "shootCharge" && <div style={{ textAlign: "center", padding: "4px 0 8px" }}>
            <span style={{ fontFamily: "'Cinzel', serif", fontSize: 12, color: C.gold, letterSpacing: 2, textTransform: "uppercase" }}>Melee Phase</span>
          </div>}
          <PhaseBlock title={`${firstLabel} Strikes`} icon="" color={C.gold} result={firstR}
            subtitle={combatMode === "shootCharge" && firstSurvAfterShoot < firstUnit.modelCount ? `${firstSurvAfterShoot} models after shooting casualties` : null}
            extraDmg={fOnXDuring} extraLabel={fOnXDuring > 0 ? `${firstAtkMods.onXDamage || "D3"} on ${firstAtkMods.onXThreshold} mortals (during)` : null} />
          <div style={{ textAlign: "center", padding: "8px 12px", marginBottom: 12, background: "rgba(139,76,76,0.1)", border: "1px solid rgba(139,76,76,0.2)", borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: C.lRed }}>
              {firstR.modelsKilled} model{firstR.modelsKilled !== 1 ? "s" : ""} slain in melee
              {surv > 0
                ? <> - <strong style={{ color: "#e8dcc4" }}>{surv}</strong> fight{surv === 1 ? "s" : ""} back</>
                : <> - <strong style={{ color: C.green }}>UNIT WIPED!</strong></>}
            </span>
          </div>
          <div style={{ opacity: surv === 0 ? 0.35 : 1 }}>
            <PhaseBlock title={`${surv} Survivor${surv !== 1 ? "s" : ""} Fight Back`} icon="" color={C.red} result={secondR}
              extraDmg={sOnXDuring} extraLabel={sOnXDuring > 0 ? `${secondAtkMods.onXDamage || "D3"} on ${secondAtkMods.onXThreshold} mortals (during)` : null} />
          </div>

          {/* FIGHT TWICE — second fights (strike-last) */}
          {(firstFT || secondFT) && <div style={{ textAlign: "center", padding: "4px 0 8px" }}>
            <span style={{ fontFamily: "'Cinzel', serif", fontSize: 12, color: "#b888dd", letterSpacing: 2, textTransform: "uppercase" }}>Fight Twice (Strike-Last)</span>
          </div>}
          {firstFT && <div style={{ opacity: firstSurvForFT === 0 ? 0.35 : 1 }}>
            <PhaseBlock title={`${firstLabel} Fights Again`} icon="" color="#b888dd" result={firstFT}
              subtitle={`${firstSurvForFT} model${firstSurvForFT !== 1 ? "s" : ""} after counterattack (STRIKE-LAST)`} />
          </div>}
          {secondFT && <div style={{ opacity: secondSurvForFT === 0 ? 0.35 : 1 }}>
            <PhaseBlock title={`${secondLabel} Fights Again`} icon="" color="#b888dd" result={secondFT}
              subtitle={`${secondSurvForFT} model${secondSurvForFT !== 1 ? "s" : ""} remaining (STRIKE-LAST)`} />
          </div>}
        </>}

        {/* Post-Combat Extra Mortal Wounds */}
        {hasAfterExtras && <div style={{
          background: "rgba(208,96,64,0.08)", border: "1px solid rgba(208,96,64,0.2)", borderRadius: 6, padding: 12, marginBottom: 16
        }}>
          <div style={{ fontSize: 10, color: "#d06040", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, fontFamily: "'Cinzel', serif" }}>Post-Combat Extra Mortal Wounds</div>
          <MortalSection unitName={`${firstUnit.name} \u2192 ${secondUnit.name}`} color={C.gold}
            onXDmg={fOnXAfter} onXLabel={`${firstAtkMods.onXDamage || "D3"} on ${firstAtkMods.onXThreshold}`}
            pmDmg={fPMDmg} pmCount={secondUnit.modelCount} pmThreshold={firstAtkMods.perModelThreshold}
            ptDmg={fPTDmg} reflectDmg={reflectToSecond} timing="after" />
          <MortalSection unitName={`${secondUnit.name} \u2192 ${firstUnit.name}`} color={C.red}
            onXDmg={sOnXAfter} onXLabel={`${secondAtkMods.onXDamage || "D3"} on ${secondAtkMods.onXThreshold}`}
            pmDmg={sPMDmg} pmCount={firstUnit.modelCount} pmThreshold={secondAtkMods.perModelThreshold}
            ptDmg={sPTDmg} reflectDmg={reflectToFirst} timing="after" />
        </div>}
      </div>}
    </div>

    {/* Total Damage — collapsible */}
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setShowTotalDetail(!showTotalDetail)} style={{
        background: showTotalDetail ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.04)",
        border: `1px solid ${showTotalDetail ? "rgba(201,168,76,0.25)" : "rgba(201,168,76,0.12)"}`,
        color: C.gold, borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "8px 12px",
        fontFamily: "'Cinzel', serif", letterSpacing: 1.5, textTransform: "uppercase",
        width: "100%", textAlign: "center", transition: "all 0.15s"
      }}>
        <span style={{ fontSize: 18, lineHeight: 1, verticalAlign: "middle", marginRight: 6 }}>{showTotalDetail ? "\u25BE" : "\u25B8"}</span>
        Total Damage
      </button>

      {/* Collapsed: just totals + kills */}
      {!showTotalDetail && <div style={{
        background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.10)",
        borderTop: "none", borderRadius: "0 0 6px 6px", padding: "10px 14px"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: C.fGold, marginBottom: 2 }}>{lUnit.name}</div>
            <div style={{ fontSize: 22, fontFamily: "'Cinzel', serif", fontWeight: 700, color: lCol }}>
              {lD.total.toFixed(1)} <span style={{ fontSize: 10, fontWeight: 400, color: C.dGold }}>dmg</span>
            </div>
            <div style={{ fontSize: 11, color: C.lRed, fontWeight: 600 }}>{lD.kills} kill{lD.kills !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.fGold, marginBottom: 2 }}>{rUnit.name}</div>
            <div style={{ fontSize: 22, fontFamily: "'Cinzel', serif", fontWeight: 700, color: rCol }}>
              {rD.total.toFixed(1)} <span style={{ fontSize: 10, fontWeight: 400, color: C.dGold }}>dmg</span>
            </div>
            <div style={{ fontSize: 11, color: C.lRed, fontWeight: 600 }}>{rD.kills} kill{rD.kills !== 1 ? "s" : ""}</div>
          </div>
        </div>
      </div>}

      {/* Expanded: source breakdown + per-weapon */}
      {showTotalDetail && <div style={{
        background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.10)",
        borderTop: "none", borderRadius: "0 0 6px 6px", padding: "12px 14px", marginTop: 0
      }}>
        {/* Source breakdown */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
          {dmgCol(lUnit, lD, lCol, "left")}
          {dmgCol(rUnit, rD, rCol, "right")}
        </div>

        {/* Per-weapon breakdown */}
        {(() => {
          const lWeapons = [];
          const rWeapons = [];
          const lResults = aFirst
            ? [firstShoot, firstR, firstFT]
            : [secondShoot, secondR, secondFT];
          const rResults = aFirst
            ? [secondShoot, secondR, secondFT]
            : [firstShoot, firstR, firstFT];
          const lPhases = ["Shooting", "Melee", "Fight Twice"];
          lResults.forEach((r, i) => { if (r?.weapons) r.weapons.forEach(w => lWeapons.push({ ...w, phase: lPhases[i] })); });
          rResults.forEach((r, i) => { if (r?.weapons) r.weapons.forEach(w => rWeapons.push({ ...w, phase: lPhases[i] })); });
          if (lWeapons.length === 0 && rWeapons.length === 0) return null;
          const wpnList = (weapons, col, align) => <div>
            {weapons.map((w, i) => {
              const R = align === "right";
              return <div key={i} style={{ padding: "3px 0", borderBottom: `1px solid ${col}10` }}>
                <div style={{ display: "flex", justifyContent: R ? "flex-end" : "flex-start", fontSize: 11, gap: 6 }}>
                  {R ? <>
                    <span style={{ color: col, fontWeight: 700 }}>{w.avgDamage.toFixed(2)}</span>
                    <span style={{ color: C.dGold, fontWeight: 600 }}>{w.name}</span>
                  </> : <>
                    <span style={{ color: C.dGold, fontWeight: 600 }}>{w.name}</span>
                    <span style={{ color: col, fontWeight: 700 }}>{w.avgDamage.toFixed(2)}</span>
                  </>}
                </div>
                <div style={{ fontSize: 9, color: C.fGold, textAlign: align }}>
                  {w.phase}{w.isComp ? " · Companion" : ""} · {w.attacks.toFixed(1)} atk · Dmg {w.dmg.toFixed(1)}
                </div>
              </div>;
            })}
          </div>;
          return <>
            <div style={{ borderTop: `1px solid rgba(201,168,76,0.12)`, paddingTop: 10, marginTop: 4 }}>
              <div style={{ fontSize: 10, color: C.gold, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, fontFamily: "'Cinzel', serif", textAlign: "center" }}>Weapon Breakdown</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {lWeapons.length > 0 ? wpnList(lWeapons, lCol, "left") : <div style={{ fontSize: 10, color: C.fGold, fontStyle: "italic" }}>No weapons</div>}
                {rWeapons.length > 0 ? wpnList(rWeapons, rCol, "right") : <div style={{ fontSize: 10, color: C.fGold, fontStyle: "italic", textAlign: "right" }}>No weapons</div>}
              </div>
            </div>
          </>;
        })()}
      </div>}
    </div>

    {/* Efficiency — collapsible */}
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 6, padding: 12 }}>
      <button onClick={() => setShowEffDetail(!showEffDetail)} style={{
        background: showEffDetail ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.04)",
        border: `1px solid ${showEffDetail ? "rgba(201,168,76,0.25)" : "rgba(201,168,76,0.12)"}`,
        color: C.gold, borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "8px 12px",
        fontFamily: "'Cinzel', serif", letterSpacing: 1.5, textTransform: "uppercase",
        width: "100%", textAlign: "center", transition: "all 0.15s",
        marginBottom: showEffDetail ? 10 : 0
      }}>
        <span style={{ fontSize: 18, lineHeight: 1, verticalAlign: "middle", marginRight: 6 }}>{showEffDetail ? "\u25BE" : "\u25B8"}</span>
        Points Efficiency
      </button>

      {!showEffDetail && <div style={{
        display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center",
        marginTop: 8, padding: "4px 0"
      }}>
        <div>
          <div style={{ fontSize: 10, color: C.fGold, marginBottom: 2 }}>{lUnit.name}</div>
          <div style={{ fontSize: 16, fontFamily: "'Cinzel', serif", fontWeight: 700, color: lCol }}>
            {lD.d100.toFixed(1)} <span style={{ fontSize: 9, fontWeight: 400, color: C.dGold }}>dmg / 100pts</span>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, color: C.fGold, letterSpacing: 1, marginBottom: 2 }}>VERDICT</div>
          {winner === "draw"
            ? <div style={{ fontFamily: "'Cinzel', serif", fontSize: 12, color: C.dGold }}>DRAW</div>
            : <div style={{ fontFamily: "'Cinzel', serif", fontSize: 12, color: winner === "first" ? C.gold : C.red }}>
                {winner === "first" ? firstUnit.name : secondUnit.name} +{Math.abs(net).toFixed(0)}
              </div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: C.fGold, marginBottom: 2 }}>{rUnit.name}</div>
          <div style={{ fontSize: 16, fontFamily: "'Cinzel', serif", fontWeight: 700, color: rCol }}>
            {rD.d100.toFixed(1)} <span style={{ fontSize: 9, fontWeight: 400, color: C.dGold }}>dmg / 100pts</span>
          </div>
        </div>
      </div>}

      {showEffDetail && <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "start" }}>
        {eff(lUnit.name, lD.d100, lD.ppk, lD.pd, lD.roi, lCol, "left")}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", alignSelf: "center", padding: "0 10px", borderLeft: "1px solid rgba(201,168,76,0.08)", borderRight: "1px solid rgba(201,168,76,0.08)", minHeight: 70 }}>
          <div style={{ fontSize: 9, color: C.fGold, letterSpacing: 1, marginBottom: 4 }}>VERDICT</div>
          {winner === "draw"
            ? <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, color: C.dGold }}>DRAW</div>
            : <>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, color: winner === "first" ? C.gold : C.red, textAlign: "center", lineHeight: 1.2 }}>
                {winner === "first" ? firstUnit.name : secondUnit.name}
              </div>
              <div style={{ fontSize: 18, fontFamily: "'Cinzel', serif", color: winner === "first" ? C.gold : C.red, fontWeight: 700, marginTop: 2 }}>
                +{Math.abs(net).toFixed(0)}
              </div>
              <div style={{ fontSize: 9, color: C.fGold }}>pts value</div>
            </>}
        </div>
        {eff(rUnit.name, rD.d100, rD.ppk, rD.pd, rD.roi, rCol, "right")}
      </div>}
    </div>
  </div>;
}
