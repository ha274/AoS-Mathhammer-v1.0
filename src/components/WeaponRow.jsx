import { C, bI } from '../styles';

export default function WeaponRow({ w, onChange, onRemove, canRemove }) {
  const f = (k, v) => {
    const update = { ...w, [k]: v };
    // Auto-detect companion from ability text changes
    if (k === "ability") {
      update.companion = (v || "").toLowerCase().includes("companion");
    }
    onChange(update);
  };
  const isRanged = (w.type || "melee") === "ranged";
  const isComp = w.companion ?? (w.ability || "").toLowerCase().includes("companion");

  return <div style={{
    display: "grid",
    gridTemplateColumns: "34px 1.4fr 40px 38px 38px 38px 38px 1fr 26px 34px 28px",
    gap: 4, alignItems: "center", padding: "6px 0",
    borderBottom: "1px solid rgba(201,168,76,0.08)",
  }}>
    <button onClick={() => f("type", isRanged ? "melee" : "ranged")} style={{
      background: isRanged ? "rgba(74,158,222,0.15)" : "rgba(201,168,76,0.1)",
      border: `1px solid ${isRanged ? "rgba(74,158,222,0.3)" : "rgba(201,168,76,0.2)"}`,
      color: isRanged ? "#4a9ede" : C.dGold, borderRadius: 3, cursor: "pointer",
      fontSize: 12, padding: "3px 2px", fontFamily: "'Cinzel', serif", fontWeight: 600,
      lineHeight: 1, textAlign: "center",
    }} title={isRanged ? "Ranged (click for melee)" : "Melee (click for ranged)"}>
      {isRanged ? "\uD83C\uDFF9" : "\u2694"}
    </button>
    <input value={w.name} onChange={e => f("name", e.target.value)} style={{ ...bI, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={w.name} />
    <input value={w.attacks} onChange={e => f("attacks", e.target.value)} style={{ ...bI, textAlign: "center" }} />
    <input value={w.hit} onChange={e => f("hit", e.target.value)} style={{ ...bI, textAlign: "center" }} />
    <input value={w.wound} onChange={e => f("wound", e.target.value)} style={{ ...bI, textAlign: "center" }} />
    <input value={w.rend} onChange={e => f("rend", e.target.value)} style={{ ...bI, textAlign: "center" }} />
    <input value={w.damage} onChange={e => f("damage", e.target.value)} style={{ ...bI, textAlign: "center" }} />
    <input value={w.ability} onChange={e => f("ability", e.target.value)} style={{ ...bI, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={w.ability} />
    <button onClick={() => onChange({ ...w, companion: !isComp })} style={{
      background: isComp ? "rgba(160,128,64,0.2)" : "transparent",
      border: `1px solid ${isComp ? "rgba(160,128,64,0.4)" : "rgba(255,255,255,0.08)"}`,
      color: isComp ? "#a08040" : "#555", borderRadius: 3, cursor: "pointer",
      fontSize: 11, padding: "2px 0", lineHeight: 1, textAlign: "center",
    }} title={isComp ? "Companion weapon (click to toggle off)" : "Mark as Companion weapon (ignores most buffs)"}>
      {isComp ? "\uD83D\uDC32" : "\u00B7"}
    </button>
    <input type="number" value={w.modelCount} onChange={e => f("modelCount", parseInt(e.target.value) || 1)} style={{ ...bI, textAlign: "center" }} min={1} />
    {canRemove
      ? <button onClick={onRemove} style={{ background: "rgba(180,40,40,0.3)", border: "1px solid rgba(180,40,40,0.4)", color: "#e88", borderRadius: 4, cursor: "pointer", fontSize: 14, padding: "2px 4px" }}>{"\u2715"}</button>
      : <div />
    }
  </div>;
}
