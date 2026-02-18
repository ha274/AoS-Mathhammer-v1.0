import { C } from '../../styles';

export default function WeaponBreakdown({ weapons, color }) {
  if (!weapons.length) return null;
  return <div style={{ marginTop: 8, borderTop: `1px solid ${color}15`, paddingTop: 6 }}>
    {weapons.map((w, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "2px 0", gap: 4 }}>
      <span style={{ color: C.dGold, flex: 1 }}>
        {w.name}
        {w.isComp && <span style={{ fontSize: 8, color: "#b888dd", marginLeft: 4, background: "rgba(184,136,221,0.12)", padding: "1px 5px", borderRadius: 3, border: "1px solid rgba(184,136,221,0.25)" }}>COMPANION</span>}
      </span>
      <span style={{ color: C.fGold, fontSize: 10, minWidth: 50, textAlign: "center" }}>{w.attacks.toFixed(1)} atk</span>
      <span style={{ color, fontWeight: 600, minWidth: 50, textAlign: "right" }}>{w.avgDamage.toFixed(2)}</span>
      {w.critSource && <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 9, marginLeft: 4, padding: "1px 5px", borderRadius: 3, background: `${w.hasCM ? "#e86868" : w.hasCW ? "#e8a848" : "#68b8e8"}12` }}>
        <span style={{ color: w.hasCM ? "#e86868" : w.hasCW ? "#e8a848" : "#68b8e8", fontWeight: 700 }}>
          {w.hasCM ? "\u2620" : w.hasCW ? "\u26A1" : "\u2726"} Crit ({w.critSource})
        </span>
        <span style={{ color: C.fGold }}>on {w.critTh}+</span>
        <span style={{ color: w.hasCM ? "#e86868" : w.hasCW ? "#e8a848" : "#68b8e8", fontWeight: 600 }}>
          {w.critDamage.toFixed(2)} crit dmg
        </span>
        {w.critFromBuff && <span style={{
          fontSize: 8, color: "#b888dd", background: "rgba(184,136,221,0.12)",
          padding: "1px 5px", borderRadius: 3, border: "1px solid rgba(184,136,221,0.25)",
        }}>BUFF</span>}
      </div>}
    </div>)}
  </div>;
}
