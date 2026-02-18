import { C } from '../../styles';

export default function Stepper({ label, value, onChange, min = 0, max = 6, color = C.gold, badges = [], capMin = null, capMax = null }) {
  const hasBadges = badges.length > 0;
  const badgeDelta = badges.reduce((s, b) => s + b.value, 0);
  const dynMin = capMin == null ? min : Math.max(min, capMin - badgeDelta);
  const dynMax = capMax == null ? max : Math.min(max, capMax - badgeDelta);
  const clampedValue = Math.min(dynMax, Math.max(dynMin, value));
  const netVal = clampedValue + badgeDelta;
  const netColor = netVal > 0 ? C.green : netVal < 0 ? "#e86868" : color;
  const netDisplay = String(netVal);

  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 0,
      background: hasBadges ? `${color}08` : "rgba(0,0,0,0.2)",
      borderRadius: 5, border: `1px solid ${hasBadges ? `${color}22` : "rgba(255,255,255,0.06)"}`,
      overflow: "hidden", transition: "all 0.2s",
    }}>
      <button onClick={() => onChange(Math.max(dynMin, value - 1))} style={{
        width: 26, height: 28, background: "transparent", border: "none", borderRight: "1px solid rgba(255,255,255,0.06)",
        color: value > dynMin ? (dynMin < 0 ? "#e86868" : color) : "#333", cursor: value > dynMin ? "pointer" : "default", fontSize: 15, fontWeight: 700, lineHeight: 1,
      }}>-</button>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2px 6px", minWidth: 52 }}>
        <span style={{ fontSize: 8, color: C.fGold, textTransform: "uppercase", letterSpacing: 0.8, lineHeight: 1 }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: netColor, fontFamily: "'Cinzel', serif", lineHeight: 1.2 }}>
          {netDisplay}
        </span>
      </div>
      <button onClick={() => onChange(Math.min(dynMax, value + 1))} style={{
        width: 26, height: 28, background: "transparent", border: "none", borderLeft: "1px solid rgba(255,255,255,0.06)",
        color: value < dynMax ? color : "#333", cursor: value < dynMax ? "pointer" : "default", fontSize: 15, fontWeight: 700, lineHeight: 1,
      }}>+</button>
    </div>
    {hasBadges && <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
      {badges.filter(b => b.value !== 0).map((b, i) => <span key={i} style={{
        fontSize: 8, fontWeight: 700, fontFamily: "'Cinzel', serif",
        color: b.color || (b.value > 0 ? C.green : "#e86868"),
        background: `${b.color || (b.value > 0 ? C.green : "#e86868")}18`,
        padding: "1px 5px", borderRadius: 3,
        border: `1px solid ${b.color || (b.value > 0 ? C.green : "#e86868")}30`,
        letterSpacing: 0.5, lineHeight: 1.4,
      }}>{b.label} {b.value > 0 ? `+${b.value}` : b.value}</span>)}
    </div>}
  </div>;
}
