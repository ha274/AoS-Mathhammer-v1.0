import { C } from '../../styles';

export default function StatBadge({ label, value, color = C.gold }) {
  return <div style={{
    display: "flex", flexDirection: "column", alignItems: "center",
    background: "rgba(0,0,0,0.4)", borderRadius: 6, padding: "6px 10px",
    border: `1px solid ${color}33`, minWidth: 48,
  }}>
    <span style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
    <span style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'Cinzel', serif" }}>{value}</span>
  </div>;
}
