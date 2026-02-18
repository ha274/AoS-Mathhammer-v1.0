import { C } from '../styles';

export default function WBreak({ weapons, color }) {
  return <div style={{ marginTop: 10, borderTop: `1px solid ${color}18`, paddingTop: 6 }}>
    {weapons.map((w, i) => <div key={i} style={{ padding: "3px 0", borderBottom: `1px solid ${color}08` }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.dGold }}>
        <span style={{ fontWeight: 600 }}>
          {w.name}
          {w.isComp && <span style={{ fontSize: 9, color: "#a08040", background: "rgba(160,128,64,0.15)", padding: "1px 5px", borderRadius: 3, marginLeft: 6, border: "1px solid rgba(160,128,64,0.25)" }}>🐉 Companion</span>}
        </span>
        <span style={{ color, fontWeight: 700 }}>{w.avgDamage.toFixed(2)} dmg</span>
      </div>
      {w.isComp && <div style={{ fontSize: 9, color: "#887755", fontStyle: "italic", marginTop: 1 }}>
        Only AoA &amp; negative mods apply — other buffs ignored
      </div>}
      <div style={{ display: "flex", gap: 8, fontSize: 10, color: C.fGold, marginTop: 1, flexWrap: "wrap" }}>
        <span>{w.attacks.toFixed(1)} atk</span>
        <span>Hit:{w.effHit}+ ({(w.pHit * 100).toFixed(0)}%)</span>
        <span>Wnd:{w.effWnd}+ ({(w.pWound * 100).toFixed(0)}%)</span>
        <span>Sv:{w.effSave}+ (fail {(w.pFailSave * 100).toFixed(0)}%)</span>
        <span>Rnd:{w.rend}</span>
        <span>Dmg:{w.dmg.toFixed(1)}</span>
      </div>
      {w.critSource && <div style={{ display: "flex", gap: 6, fontSize: 10, marginTop: 2, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: w.hasCM ? "#e86868" : w.hasCW ? "#e8a848" : "#68b8e8", fontWeight: 700 }}>
          {w.hasCM ? "☠" : w.hasCW ? "⚡" : "✦"} Crit ({w.critSource})
        </span>
        <span style={{ color: C.fGold }}>on {w.critTh}+</span>
        <span style={{ color: w.hasCM ? "#e86868" : w.hasCW ? "#e8a848" : "#68b8e8", fontWeight: 600 }}>
          {w.critDamage.toFixed(2)} crit dmg
        </span>
        {w.critFromBuff && <span style={{
          fontSize: 8, color: "#b888dd", background: "rgba(184,136,221,0.12)",
          padding: "1px 5px", borderRadius: 3, border: "1px solid rgba(184,136,221,0.25)"
        }}>BUFF</span>}
      </div>}
    </div>)}
  </div>;
}
