import { useState, useCallback, useMemo } from 'react';
import { C, bI } from '../styles';

// Category definitions — priority order (first match wins)
const CATEGORIES = [
  { key: "heroes", label: "Heroes", test: kw => kw.includes("HERO") },
  { key: "monsters", label: "Monsters", test: kw => kw.includes("MONSTER") },
  { key: "cavalry", label: "Cavalry", test: kw => kw.includes("CAVALRY") },
  { key: "infantry", label: "Infantry", test: kw => kw.includes("INFANTRY") },
  { key: "warmachine", label: "War Machines", test: kw => kw.includes("WAR MACHINE") },
];
const OTHER_KEY = "other";
const OTHER_LABEL = "Other Units";

function categorize(unit) {
  const kw = (unit.keywords || []).map(k => k.toUpperCase());
  for (const cat of CATEGORIES) {
    if (cat.test(kw)) return cat.key;
  }
  return OTHER_KEY;
}

/**
 * Per-panel unit selector — picks a unit from the shared BSData pool.
 * Groups units by keyword category (Hero, Infantry, Cavalry, etc.)
 */
export default function UnitSelector({ units, showLegacy, onSelectUnit }) {
  const [selectedFaction, setSelectedFaction] = useState("");
  const [selectedUnitKey, setSelectedUnitKey] = useState("");

  const filteredUnits = useMemo(() => units.filter(u => showLegacy || !u.legacy), [units, showLegacy]);

  const factions = useMemo(() => {
    const counts = new Map();
    for (const u of filteredUnits) counts.set(u.faction || 'Unknown', (counts.get(u.faction || 'Unknown') || 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredUnits]);

  // Group faction units by category
  const groupedUnits = useMemo(() => {
    if (!selectedFaction) return [];
    const factionList = filteredUnits.filter(u => (u.faction || 'Unknown') === selectedFaction);

    const groups = new Map();
    for (const cat of CATEGORIES) groups.set(cat.key, []);
    groups.set(OTHER_KEY, []);

    for (const u of factionList) {
      const cat = categorize(u);
      groups.get(cat).push(u);
    }

    // Sort units within each group alphabetically
    for (const arr of groups.values()) arr.sort((a, b) => a.name.localeCompare(b.name));

    // Build ordered result, skipping empty groups
    const result = [];
    for (const cat of CATEGORIES) {
      const arr = groups.get(cat.key);
      if (arr.length) result.push({ label: `${cat.label} (${arr.length})`, units: arr });
    }
    const other = groups.get(OTHER_KEY);
    if (other.length) result.push({ label: `${OTHER_LABEL} (${other.length})`, units: other });

    return result;
  }, [filteredUnits, selectedFaction]);

  const handleUnitByKey = useCallback((key) => {
    setSelectedUnitKey(key);
    const u = units.find(x => x.__key === key);
    if (u) {
      const { __matched, ...clean } = u;
      onSelectUnit(JSON.parse(JSON.stringify(clean)));
    }
  }, [units, onSelectUnit]);

  if (!units.length) return null;

  const selectStyle = {
    ...bI,
    fontSize: 14,
    cursor: "pointer",
    borderColor: "rgba(92,204,136,0.3)",
    color: "#e8dcc4",
    background: "#1a1814",
  };

  return <div style={{ marginBottom: 8 }}>
    <div style={{ fontSize: 9, color: "#5cc888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
      Select from BSData
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      <select value={selectedFaction} onChange={e => {
        setSelectedFaction(e.target.value);
        setSelectedUnitKey('');
      }} style={selectStyle}>
        <option value="">Choose faction...</option>
        {factions.map(([f, count]) => <option key={f} value={f}>{f} ({count})</option>)}
      </select>

      <select value={selectedUnitKey} disabled={!selectedFaction} onChange={e => handleUnitByKey(e.target.value)} style={{ ...selectStyle, cursor: selectedFaction ? "pointer" : "default", opacity: selectedFaction ? 1 : 0.65 }}>
        <option value="">{selectedFaction ? "Choose unit..." : "Select a faction first"}</option>
        {groupedUnits.map(group => (
          <optgroup key={group.label} label={group.label}>
            {group.units.map(u => (
              <option key={u.__key} value={u.__key}>{u.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  </div>;
}
