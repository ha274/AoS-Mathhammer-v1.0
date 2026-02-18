// ============================================================
// BSData Faction Points Parser
// Parses "Faction.cat" files for point costs
// Matches to Library units via sharedSelectionEntryId or name
// ============================================================

export function parsePointsCatalogue(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML parse error in points file");
  const pointsBySharedId = new Map();
  const pointsByName = new Map();

  // Scan entryLinks — these reference shared library entries
  for (const link of doc.querySelectorAll("entryLink")) {
    const targetId = link.getAttribute("targetId") || "";
    const name = (link.getAttribute("name") || "").trim();
    let pts = 0;
    const costEl = link.querySelector("costs > cost[name='pts']")
      || link.querySelector("costs > cost[name='points']");
    if (costEl) pts = parseInt(costEl.getAttribute("value")) || 0;
    if (!pts) {
      for (const c of link.querySelectorAll("cost")) {
        const v = parseInt(c.getAttribute("value")) || 0;
        if (v > 0) { pts = v; break; }
      }
    }
    if (pts > 0) {
      if (targetId) pointsBySharedId.set(targetId, pts);
      if (name) pointsByName.set(name.toLowerCase(), pts);
    }
  }

  // Also scan direct selectionEntry elements
  for (const entry of doc.querySelectorAll("selectionEntry")) {
    const eType = entry.getAttribute("type");
    if (eType !== "unit" && eType !== "model") continue;
    const name = (entry.getAttribute("name") || "").trim();
    const sharedId = entry.getAttribute("id") || "";
    let pts = 0;
    const costEl = entry.querySelector(":scope > costs > cost[name='pts']")
      || entry.querySelector(":scope > costs > cost[name='points']");
    if (costEl) pts = parseInt(costEl.getAttribute("value")) || 0;
    if (pts > 0) {
      if (sharedId) pointsBySharedId.set(sharedId, pts);
      if (name && !pointsByName.has(name.toLowerCase())) pointsByName.set(name.toLowerCase(), pts);
    }
  }

  return { pointsBySharedId, pointsByName, total: pointsBySharedId.size + pointsByName.size };
}

export function applyPointsToLibraryUnits(units, pointsMaps) {
  if (!pointsMaps) return 0;
  const { pointsBySharedId, pointsByName } = pointsMaps;
  let matched = 0;
  for (const u of units) {
    if (u.id && pointsBySharedId.has(u.id)) {
      u.points = pointsBySharedId.get(u.id);
      matched++;
    } else if (pointsByName.has(u.name.toLowerCase())) {
      u.points = pointsByName.get(u.name.toLowerCase());
      matched++;
    }
  }
  return matched;
}
