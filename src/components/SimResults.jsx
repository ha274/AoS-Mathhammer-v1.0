import { useState, useCallback } from 'react';
import { C } from '../styles';
import { runSimulation } from '../engine/montecarlo';

// ============================================================
// Wipe flavour text — the important bit
// ============================================================

function wipeFlavorText(pct) {
  if (pct <= 0) return "Mathematically impossible. Bring a bigger army.";
  if (pct < 1) return "You'd need every dice god rolling for you at once.";
  if (pct < 5) return "Sacrifice a hero to the dark gods and pray.";
  if (pct < 15) return "Needs heroically hot dice. Channel your inner main character.";
  if (pct < 30) return "Possible if the dice gods are smiling.";
  if (pct < 50) return "Coin flip. Fortune favours the bold!";
  if (pct < 70) return "More likely than not. Send them in!";
  if (pct < 85) return "Solid odds. Don't roll like a goblin.";
  if (pct < 95) return "Near certain. Fumble this and uninstall.";
  if (pct < 100) return "Basically guaranteed. Don't you dare whiff.";
  return "DELETE BUTTON. Pack up their models.";
}

function wipeColor(pct) {
  if (pct <= 0) return C.fGold;
  if (pct < 15) return "#8b6a6a";
  if (pct < 30) return "#d4a84c";
  if (pct < 50) return "#d4a84c";
  if (pct < 70) return "#c08040";
  if (pct < 85) return "#e07848";
  return "#e86868";
}

// ============================================================
// Create a buffed clone of a unit (+1 hit, +1 wound, or +1 rend)
// Modifies weapon profiles directly to bypass modifier caps
// ============================================================

function buffUnit(unit, type) {
  const clone = JSON.parse(JSON.stringify(unit));
  for (const w of clone.weapons) {
    if (!w.enabled) continue;
    if (type === "hit") {
      const th = parseInt(w.hit) || 4;
      w.hit = `${Math.max(2, th - 1)}+`;
    } else if (type === "wound") {
      const th = parseInt(w.wound) || 4;
      w.wound = `${Math.max(2, th - 1)}+`;
    } else if (type === "rend") {
      const r = parseInt(w.rend) || 0;
      w.rend = String(r + 1);
    }
  }
  return clone;
}

// ============================================================
// SVG Histogram — damage or kill distribution
// ============================================================

function Histogram({ buckets, label, color, medianIdx = null, thresholdIdx = null, thresholdLabel = null }) {
  if (!buckets || buckets.length === 0) return null;
  const max = Math.max(...buckets, 1);
  const total = buckets.reduce((s, v) => s + v, 0) || 1;

  // Collapse leading/trailing zero buckets for readability
  let lo = 0, hi = buckets.length - 1;
  while (lo < hi && buckets[lo] === 0) lo++;
  while (hi > lo && buckets[hi] === 0) hi--;
  lo = Math.max(0, lo - 1);
  hi = Math.min(buckets.length - 1, hi + 1);

  const visible = buckets.slice(lo, hi + 1);
  const barCount = visible.length;
  if (barCount === 0) return null;

  const W = 320, H = 130, pad = 28, barGap = 1;
  const barW = Math.max(2, (W - pad * 2) / barCount - barGap);
  const chartH = H - pad - 16;

  // Calculate threshold line position (if within visible range)
  const thresholdVisible = thresholdIdx !== null && thresholdIdx >= lo && thresholdIdx <= hi;
  const thresholdX = thresholdVisible ? pad + (thresholdIdx - lo) * (barW + barGap) + barW / 2 : null;

  // Median position
  const medianVisible = medianIdx !== null && medianIdx >= lo && medianIdx <= hi;
  const medianX = medianVisible ? pad + (medianIdx - lo) * (barW + barGap) + barW / 2 : null;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: C.fGold, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block" }}>
        {/* Bars */}
        {visible.map((count, i) => {
          const h = chartH * (count / max);
          const x = pad + i * (barW + barGap);
          const y = H - pad - h;
          const idx = lo + i;
          const isMedian = medianIdx !== null && idx === medianIdx;
          const pct = ((count / total) * 100).toFixed(0);
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={Math.max(h, 0.5)} rx={1}
                fill={isMedian ? "#e8dcc4" : color} opacity={isMedian ? 0.95 : 0.65} />
              {isMedian && <rect x={x} y={y} width={barW} height={Math.max(h, 0.5)} rx={1}
                fill="none" stroke="#e8dcc4" strokeWidth={1} />}
              {barCount <= 30 && count > 0 && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle"
                  fill={C.dGold} fontSize={7} fontFamily="'Crimson Text', serif">{pct}%</text>
              )}
            </g>
          );
        })}
        {/* Wipe threshold dashed line */}
        {thresholdVisible && (
          <g>
            <line x1={thresholdX} y1={4} x2={thresholdX} y2={H - pad}
              stroke="#e86868" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8} />
            {thresholdLabel && (
              <text x={thresholdX + 3} y={12} fill="#e86868" fontSize={7}
                fontFamily="'Crimson Text', serif">{thresholdLabel}</text>
            )}
          </g>
        )}
        {/* Median marker triangle */}
        {medianVisible && (
          <g>
            <polygon
              points={`${medianX - 4},${H - pad + 6} ${medianX + 4},${H - pad + 6} ${medianX},${H - pad + 1}`}
              fill="#e8dcc4" opacity={0.9} />
          </g>
        )}
        {/* X-axis labels */}
        {visible.map((_, i) => {
          const idx = lo + i;
          const showLabel = barCount <= 20 || i % Math.ceil(barCount / 15) === 0 || i === barCount - 1;
          if (!showLabel) return null;
          return (
            <text key={`l${i}`} x={pad + i * (barW + barGap) + barW / 2} y={H - pad + 18}
              textAnchor="middle" fill={C.fGold} fontSize={8} fontFamily="'Crimson Text', serif">{idx}</text>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================
// Cumulative Kill Chart — "chance to kill >= X models"
// ============================================================

function CumulativeChart({ killCumulative, enemyModels, color, unitName }) {
  if (!killCumulative || killCumulative.length <= 1) return null;
  const W = 320, H = 100, pad = 28;
  const chartW = W - pad * 2;
  const chartH = H - pad - 10;
  const n = killCumulative.length;

  const points = killCumulative.map((pct, i) => {
    const x = pad + (i / Math.max(n - 1, 1)) * chartW;
    const y = H - pad - pct * chartH;
    return `${x},${y}`;
  });

  // Half-kill threshold line
  const halfIdx = Math.ceil(enemyModels / 2);
  const halfX = pad + (halfIdx / Math.max(n - 1, 1)) * chartW;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: C.fGold, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
        Chance to kill &ge; X of {unitName}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block" }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(pct => (
          <g key={pct}>
            <line x1={pad} y1={H - pad - pct * chartH} x2={W - pad} y2={H - pad - pct * chartH}
              stroke={`${C.fGold}33`} strokeWidth={0.5} />
            <text x={pad - 4} y={H - pad - pct * chartH + 3} textAnchor="end"
              fill={C.fGold} fontSize={7} fontFamily="'Crimson Text', serif">{(pct * 100).toFixed(0)}%</text>
          </g>
        ))}
        {/* Half-kill threshold line */}
        {halfIdx < n && (
          <line x1={halfX} y1={4} x2={halfX} y2={H - pad}
            stroke={C.dGold} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        )}
        {/* Area fill */}
        <polygon
          points={`${pad},${H - pad} ${points.join(" ")} ${pad + chartW},${H - pad}`}
          fill={color} opacity={0.15} />
        {/* Line */}
        <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={2} opacity={0.8} />
        {/* Wipe point (last entry) */}
        {killCumulative[n - 1] > 0 && (
          <circle cx={pad + chartW} cy={H - pad - killCumulative[n - 1] * chartH}
            r={3} fill="#e86868" stroke="#fff" strokeWidth={0.5} />
        )}
        {/* X-axis labels */}
        {killCumulative.map((_, i) => {
          const showLabel = n <= 20 || i % Math.ceil(n / 10) === 0 || i === n - 1;
          if (!showLabel) return null;
          return (
            <text key={i} x={pad + (i / Math.max(n - 1, 1)) * chartW} y={H - pad + 12}
              textAnchor="middle" fill={C.fGold} fontSize={8} fontFamily="'Crimson Text', serif">{i}</text>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================
// Stat card for key metrics
// ============================================================

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: `${color}0a`, border: `1px solid ${color}22`, borderRadius: 6,
      padding: "8px 10px", textAlign: "center", minWidth: 72, flex: "1 1 72px"
    }}>
      <div style={{ fontSize: 8, color: C.fGold, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontFamily: "'Cinzel', serif", fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 8, color: C.dGold, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ============================================================
// One side's simulation results
// ============================================================

function SideResults({ stats, unitName, enemyName, enemyModels, color }) {
  const wipePct = stats.wipeChance * 100;
  const whiffPct = stats.whiffChance * 100;
  const halfPct = stats.halfKillChance * 100;

  return (
    <div style={{ flex: "1 1 320px", minWidth: 280 }}>
      <div style={{ fontSize: 12, color, fontWeight: 700, fontFamily: "'Cinzel', serif", letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
        {unitName} &rarr; {enemyName}
      </div>

      {/* Primary metrics */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <MetricCard label="Avg Damage" value={stats.avgDamage.toFixed(1)} sub={`median ${stats.medianDamage.toFixed(1)}`} color={color} />
        <MetricCard label="Avg Kills" value={stats.avgKills.toFixed(1)} sub={`${stats.modelsRemaining.toFixed(1)} left`} color={color} />
        <MetricCard label="Wipe Enemy Unit" value={`${wipePct.toFixed(1)}%`}
          sub={null}
          color={wipeColor(wipePct)} />
      </div>

      {/* Wipe flavour text */}
      <div style={{ fontSize: 10, color: wipeColor(wipePct), fontStyle: "italic", marginBottom: 8, padding: "0 2px" }}>
        {wipeFlavorText(wipePct)}
      </div>

      {/* Secondary metrics */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <MetricCard label="Whiff (0 dmg)" value={`${whiffPct.toFixed(1)}%`}
          sub={whiffPct > 10 ? "ouch" : whiffPct > 0 ? "rare" : "never"}
          color={whiffPct > 10 ? "#e86868" : whiffPct > 0 ? C.dGold : C.fGold} />
        <MetricCard label="Kill 50%+" value={`${halfPct.toFixed(1)}%`}
          sub={`${Math.ceil(enemyModels / 2)}+ models`}
          color={halfPct >= 50 ? color : C.dGold} />
      </div>

      {/* Percentiles */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
        {Object.entries(stats.percentiles).map(([k, v]) => (
          <div key={k} style={{ fontSize: 9, color: C.dGold, background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 3 }}>
            <span style={{ color: C.fGold }}>{k.toUpperCase()}: </span>{v.toFixed(1)}
          </div>
        ))}
        <div style={{ fontSize: 9, color: C.dGold, background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 3 }}>
          <span style={{ color: C.fGold }}>RANGE: </span>{stats.min.toFixed(0)}&ndash;{stats.max.toFixed(0)}
        </div>
      </div>

      {/* Charts */}
      <Histogram buckets={stats.dmgBuckets} label="Damage Distribution" color={color}
        medianIdx={Math.round(stats.medianDamage)} />
      <Histogram buckets={stats.killBuckets} label="Kill Distribution" color={color}
        medianIdx={Math.round(stats.medianKills)}
        thresholdIdx={enemyModels} thresholdLabel="WIPE" />
      <CumulativeChart killCumulative={stats.killCumulative} enemyModels={enemyModels}
        color={color} unitName={enemyName} />
    </div>
  );
}

// ============================================================
// Buff Analysis — "+1 hit / wound / rend, what's the gain?"
// ============================================================

function BuffAnalysis({ buffData, firstUnit, secondUnit }) {
  if (!buffData) return null;

  const BuffRow = ({ label, data, baseStats, color, enemyName }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 4, fontFamily: "'Cinzel', serif" }}>
        {label} &rarr; {enemyName}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: "2px 12px", fontSize: 11 }}>
        <div style={{ color: C.fGold, fontWeight: 600 }}>Buff</div>
        <div style={{ color: C.fGold, fontWeight: 600 }}>Avg Dmg</div>
        <div style={{ color: C.fGold, fontWeight: 600 }}>Avg Kills</div>
        <div style={{ color: C.fGold, fontWeight: 600 }}>Wipe %</div>
        {/* Baseline */}
        <div style={{ color: C.dGold }}>Baseline</div>
        <div style={{ color: C.dGold }}>{baseStats.avgDamage.toFixed(1)}</div>
        <div style={{ color: C.dGold }}>{baseStats.avgKills.toFixed(1)}</div>
        <div style={{ color: C.dGold }}>{(baseStats.wipeChance * 100).toFixed(1)}%</div>
        {[["hit", "+1 To Hit"], ["wound", "+1 To Wound"], ["rend", "+1 Rend"]].map(([key, lbl]) => {
          const d = data[key];
          const dmgDelta = d.avgDamage - baseStats.avgDamage;
          const killDelta = d.avgKills - baseStats.avgKills;
          const wipeDelta = (d.wipeChance - baseStats.wipeChance) * 100;
          const best = Math.max(
            Math.abs(data.hit.avgDamage - baseStats.avgDamage),
            Math.abs(data.wound.avgDamage - baseStats.avgDamage),
            Math.abs(data.rend.avgDamage - baseStats.avgDamage)
          );
          const isBest = Math.abs(dmgDelta) >= best - 0.01 && best > 0.1;
          return [
            <div key={`${key}l`} style={{ color: isBest ? color : "#e8dcc4", fontWeight: isBest ? 700 : 400 }}>{lbl}{isBest ? " *" : ""}</div>,
            <div key={`${key}d`} style={{ color: dmgDelta > 0.1 ? "#5c8" : C.dGold }}>
              {d.avgDamage.toFixed(1)} <span style={{ fontSize: 9, color: dmgDelta > 0.1 ? "#5c8" : C.fGold }}>({dmgDelta >= 0 ? "+" : ""}{dmgDelta.toFixed(1)})</span>
            </div>,
            <div key={`${key}k`} style={{ color: killDelta > 0.05 ? "#5c8" : C.dGold }}>
              {d.avgKills.toFixed(1)} <span style={{ fontSize: 9, color: killDelta > 0.05 ? "#5c8" : C.fGold }}>({killDelta >= 0 ? "+" : ""}{killDelta.toFixed(2)})</span>
            </div>,
            <div key={`${key}w`} style={{ color: wipeDelta > 1 ? "#e86868" : C.dGold }}>
              {(d.wipeChance * 100).toFixed(1)}% <span style={{ fontSize: 9, color: wipeDelta > 1 ? "#e86868" : C.fGold }}>({wipeDelta >= 0 ? "+" : ""}{wipeDelta.toFixed(1)})</span>
            </div>,
          ];
        })}
      </div>
    </div>
  );

  return (
    <div style={{
      marginTop: 16, padding: 12, background: "rgba(92,204,136,0.04)",
      border: "1px solid rgba(92,204,136,0.15)", borderRadius: 6
    }}>
      <div style={{ fontSize: 10, color: "#5c8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10, fontFamily: "'Cinzel', serif", textAlign: "center" }}>
        Buff Analysis — What Would Help Most?
      </div>
      <div style={{ fontSize: 9, color: C.fGold, textAlign: "center", marginBottom: 10, fontStyle: "italic" }}>
        Simulated with modified weapon profiles (bypasses AoS modifier caps) &mdash; * marks biggest gain
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px" }}>
          <BuffRow label={firstUnit.name} data={buffData.first} baseStats={buffData.firstBase} color={C.gold} enemyName={secondUnit.name} />
        </div>
        <div style={{ flex: "1 1 280px" }}>
          <BuffRow label={secondUnit.name} data={buffData.second} baseStats={buffData.secondBase} color={C.red} enemyName={firstUnit.name} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN: SimResults panel
// ============================================================

export default function SimResults({ firstUnit, secondUnit, firstAtkMods, secondAtkMods, firstDefMods, secondDefMods, firstOpts, secondOpts, combatMode }) {
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const iterations = 10000;

  const handleRun = useCallback(() => {
    setRunning(true);
    // setTimeout lets the UI update with "Rolling dice..." before blocking
    setTimeout(() => {
      // Main simulation
      const res = runSimulation({
        firstUnit, secondUnit,
        firstAtkMods, secondAtkMods,
        firstDefMods, secondDefMods,
        firstOpts, secondOpts,
        combatMode, iterations,
      });

      // Buff analysis: 6 mini-sims (2k iterations each) with modified weapon profiles
      const buffIter = 2000;
      const buffTypes = ["hit", "wound", "rend"];
      const firstBuffs = {};
      const secondBuffs = {};
      for (const type of buffTypes) {
        const fBuff = runSimulation({
          firstUnit: buffUnit(firstUnit, type), secondUnit,
          firstAtkMods, secondAtkMods, firstDefMods, secondDefMods,
          firstOpts, secondOpts, combatMode, iterations: buffIter,
        });
        firstBuffs[type] = fBuff.first;

        const sBuff = runSimulation({
          firstUnit, secondUnit: buffUnit(secondUnit, type),
          firstAtkMods, secondAtkMods, firstDefMods, secondDefMods,
          firstOpts, secondOpts, combatMode, iterations: buffIter,
        });
        secondBuffs[type] = sBuff.second;
      }

      res.buffAnalysis = {
        first: firstBuffs,
        firstBase: res.first,
        second: secondBuffs,
        secondBase: res.second,
      };

      setResults(res);
      setRunning(false);
    }, 50);
  }, [firstUnit, secondUnit, firstAtkMods, secondAtkMods, firstDefMods, secondDefMods, firstOpts, secondOpts, combatMode]);

  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(20,18,14,0.97) 0%, rgba(12,10,8,0.99) 100%)",
      border: "1px solid rgba(201,168,76,0.2)", borderRadius: 8, padding: 20, marginTop: 16
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 700, color: C.gold, letterSpacing: 3, textTransform: "uppercase" }}>
          Monte Carlo Simulator
        </div>
        <div style={{ fontSize: 11, color: C.fGold, marginTop: 2 }}>
          Roll real dice {iterations.toLocaleString()} times &mdash; see the full probability spread
        </div>
      </div>

      {/* Run button */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <button onClick={handleRun} disabled={running} style={{
          padding: "10px 36px", cursor: running ? "wait" : "pointer",
          fontFamily: "'Cinzel', serif", fontSize: 14, fontWeight: 700, letterSpacing: 2,
          background: running ? "rgba(201,168,76,0.1)" : "linear-gradient(180deg, rgba(201,168,76,0.3) 0%, rgba(201,168,76,0.15) 100%)",
          color: running ? C.fGold : C.gold,
          border: `1px solid ${running ? "rgba(201,168,76,0.15)" : "rgba(201,168,76,0.4)"}`,
          borderRadius: 6, textTransform: "uppercase",
          transition: "all 0.2s",
        }}>
          {running ? "Rolling dice..." : "Run Simulation"}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div>
          <div style={{ fontSize: 10, color: C.fGold, textAlign: "center", marginBottom: 12 }}>
            {results.iterations.toLocaleString()} iterations completed
          </div>

          {/* Side-by-side results */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <SideResults stats={results.first} unitName={firstUnit.name} enemyName={secondUnit.name}
              enemyModels={secondUnit.modelCount || 1} color={C.gold} />
            <SideResults stats={results.second} unitName={secondUnit.name} enemyName={firstUnit.name}
              enemyModels={firstUnit.modelCount || 1} color={C.red} />
          </div>

          {/* Quick comparison */}
          <div style={{
            marginTop: 16, padding: 12, background: "rgba(201,168,76,0.06)",
            border: "1px solid rgba(201,168,76,0.2)", borderRadius: 6, textAlign: "center"
          }}>
            <div style={{ fontSize: 10, color: C.gold, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontFamily: "'Cinzel', serif" }}>
              Simulation Summary
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: C.gold, fontWeight: 600 }}>{firstUnit.name}</div>
                <div style={{ fontSize: 20, fontFamily: "'Cinzel', serif", fontWeight: 700, color: C.gold }}>
                  {results.first.avgKills.toFixed(1)} <span style={{ fontSize: 11, color: C.dGold }}>avg kills</span>
                </div>
                <div style={{ fontSize: 11, color: wipeColor(results.first.wipeChance * 100) }}>
                  {(results.first.wipeChance * 100).toFixed(1)}% wipe chance
                </div>
              </div>
              <div style={{ fontSize: 22, fontFamily: "'Cinzel', serif", color: "#555", fontWeight: 700, alignSelf: "center" }}>VS</div>
              <div>
                <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{secondUnit.name}</div>
                <div style={{ fontSize: 20, fontFamily: "'Cinzel', serif", fontWeight: 700, color: C.red }}>
                  {results.second.avgKills.toFixed(1)} <span style={{ fontSize: 11, color: C.dGold }}>avg kills</span>
                </div>
                <div style={{ fontSize: 11, color: wipeColor(results.second.wipeChance * 100) }}>
                  {(results.second.wipeChance * 100).toFixed(1)}% wipe chance
                </div>
              </div>
            </div>
          </div>

          {/* Buff Analysis */}
          <BuffAnalysis buffData={results.buffAnalysis} firstUnit={firstUnit} secondUnit={secondUnit} />
        </div>
      )}
    </div>
  );
}
