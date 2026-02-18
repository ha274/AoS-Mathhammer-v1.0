// ============================================================
// BSData Library Catalogue Parser
// Parses "Faction - Library.cat" files for unit stats & weapons
// ============================================================

function normalizeEscapedUnicode(text) {
  if (!text || !text.includes("\\u")) return text;

  // Some catalogues arrive with a doubly-escaped form (e.g. "\\u2715").
  // Collapse that first so the unicode decoder can render a real glyph.
  return text
    .replace(/\\\\u/g, "\\u")
    .replace(/\\u\{([\da-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([\da-fA-F]{4})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function cleanText(text) {
  return normalizeEscapedUnicode(text || "").trim();
}

function getChar(profileEl, charName) {
  const chars = profileEl.querySelectorAll("characteristics > characteristic");
  for (const c of chars) { if (c.getAttribute("name") === charName) return cleanText(c.textContent); }
  return null;
}

function cleanVal(val) {
  return val
    ? val
      .replace(/&quot;/g, '"')
      .replace(/\u201d/g, '')
      .replace(/\u2033/g, '')
      .replace(/\u2212/g, '-')
      .replace(/"/g, '')
      .trim()
    : "";
}

function cleanAbility(raw) {
  if (!raw || raw === "-") return "-";
  return raw.replace(/\*\*/g, "").replace(/\^\^/g, "").replace(/&quot;/g, '"').replace(/\u2019/g, "'").replace(/\u2011/g, "-").trim();
}

function collectProfiles(el) {
  const results = [];
  const add = (container) => {
    for (const p of container.querySelectorAll(":scope > profiles > profile"))
      results.push({ profile: p, container });
  };
  add(el);
  for (const child of el.querySelectorAll(":scope > selectionEntries > selectionEntry")) {
    add(child);
    for (const gc of child.querySelectorAll(":scope > selectionEntries > selectionEntry")) add(gc);
  }
  for (const grp of el.querySelectorAll("selectionEntryGroups > selectionEntryGroup"))
    for (const ge of grp.querySelectorAll("selectionEntry")) add(ge);
  return results;
}

// Extract unit-level max selection constraint from a weapon's container.
// Returns null if no unit-level cap found (weapon available to all models).
// Distinguishes per-model limits (scope="parent") from per-unit caps
// (scope=<id>, shared="true") — only the latter matter for loadout math.
function getSelectionMax(container, unitEntry) {
  // Weapons defined directly on the unit entry are carried by all models
  if (container === unitEntry) return null;

  const isUnitLevelCap = (c) => {
    const scope = c.getAttribute("scope") || "";
    // scope="parent" + automatic="true" means per-model default, not a unit cap
    if (scope === "parent") return false;
    // scope referencing an ID (the unit) or shared + includeChildSelections = unit-level
    return true;
  };

  // Check direct constraints on the weapon's selectionEntry
  for (const c of container.querySelectorAll(":scope > constraints > constraint")) {
    if (c.getAttribute("type") === "max" && isUnitLevelCap(c)) {
      const v = parseInt(c.getAttribute("value"));
      if (!isNaN(v) && v >= 0) return v;
    }
  }
  // Check parent selectionEntryGroup constraints (for "1 in N" group limits)
  const parent = container.parentElement; // <selectionEntries>
  const grandparent = parent?.parentElement;
  if (grandparent?.tagName === "selectionEntryGroup") {
    for (const c of grandparent.querySelectorAll(":scope > constraints > constraint")) {
      if (c.getAttribute("type") === "max" && isUnitLevelCap(c)) {
        const v = parseInt(c.getAttribute("value"));
        if (!isNaN(v) && v >= 0) return v;
      }
    }
  }
  return null;
}

// After building weapons, adjust modelCounts so upgrade weapons don't
// inflate damage.  e.g. a 5-model unit: 4 hammers + 1 great-hammer = 5
function distributeWeaponLoadouts(weapons, unitModelCount) {
  for (const type of ["melee", "ranged"]) {
    const group = weapons.filter(w => w.type === type);
    if (group.length <= 1) continue;
    // Only adjust if at least one weapon has a BSData max constraint < unit size
    const upgrades = group.filter(w => w._bsdataMax !== null && w._bsdataMax < unitModelCount);
    if (upgrades.length === 0) continue;
    const upgradeSlots = upgrades.reduce((sum, w) => sum + w.modelCount, 0);
    // Reduce "default" weapons (those without a constraining max)
    const defaults = group.filter(w => w._bsdataMax === null || w._bsdataMax >= unitModelCount);
    if (defaults.length > 0) {
      const remaining = Math.max(1, unitModelCount - upgradeSlots);
      if (defaults.length === 1) {
        defaults[0].modelCount = remaining;
      } else {
        const each = Math.max(1, Math.floor(remaining / defaults.length));
        defaults.forEach(w => { w.modelCount = each; });
      }
    }
  }
  // Clean up temp field
  weapons.forEach(w => { delete w._bsdataMax; });
}

function collectKeywords(el) {
  const kw = new Set();
  const scan = (e) => {
    for (const cl of e.querySelectorAll(":scope > categoryLinks > categoryLink")) {
      const n = cleanText(cl.getAttribute("name") || "");
      if (n && n !== "unit" && !n.startsWith("New CategoryLink"))
        kw.add(n.replace(/^Faction:\s*/i, "").replace(/^Coalition:\s*/i, "").toUpperCase());
    }
  };
  scan(el);
  for (const child of el.querySelectorAll(":scope > selectionEntries > selectionEntry")) scan(child);
  return [...kw];
}

function detectWard(keywords, abilityProfiles) {
  for (const k of keywords) {
    const m = k.match(/WARD\s*\((\d+\+)\)/i);
    if (m) return m[1];
  }
  for (const p of abilityProfiles) {
    if ((p.getAttribute("typeName") || "").includes("Ability")) {
      const fx = getChar(p, "Effect") || "";
      const m = fx.match(/has\s+WARD\s*\((\d+\+)\)/i) || fx.match(/ward\s+save\s+of\s+(\d+\+)/i);
      if (m) return m[1];
    }
  }
  return "";
}

function detectModelCount(entry) {
  const models = entry.querySelectorAll(":scope > selectionEntries > selectionEntry[type='model']");
  if (models.length > 0) {
    let total = 0;
    for (const me of models) {
      let min = 0;
      for (const c of me.querySelectorAll(":scope > constraints > constraint"))
        if (c.getAttribute("type") === "min") min = Math.max(min, parseInt(c.getAttribute("value")) || 0);
      total += min || 1;
    }
    return total || 1;
  }
  for (const c of entry.querySelectorAll(":scope > constraints > constraint"))
    if (c.getAttribute("type") === "min" && c.getAttribute("field") === "selections") {
      const v = parseInt(c.getAttribute("value"));
      if (v > 1) return v;
    }
  return 1;
}

export function parseCatalogue(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML parse error");
  const units = [];
  const skipPrefixes = ["Battle Traits", "Battalion", "Allegiance", "Grand Strategy", "Triumph",
    "Spell", "Prayer", "Artefact", "Command Trait", "Mount Trait"];
  const skipContains = ["Manifestation", "Endless Spell", "Invocation", "Terrain", "Enhancement",
    "Heroic Trait", "Battle Formation", "Lore of"];

  for (const entry of doc.querySelectorAll("selectionEntry")) {
    const eType = entry.getAttribute("type");
    if (eType !== "unit" && eType !== "model") continue;
    const par = entry.parentElement;
    if (par?.tagName === "selectionEntries") {
      const gp = par.parentElement;
      if (gp?.tagName === "selectionEntry" && (gp.getAttribute("type") === "unit" || gp.getAttribute("type") === "model")) continue;
    }
    const name = cleanText(entry.getAttribute("name") || "");
    if (skipPrefixes.some(p => name.startsWith(p))) continue;
    if (skipContains.some(s => name.includes(s))) continue;

    const allP = collectProfiles(entry);
    if (!allP.length) continue;
    let unitP = null;
    const weaponPs = [];
    const abilityPs = [];
    for (const { profile: p, container } of allP) {
      const tn = p.getAttribute("typeName") || "";
      if (tn === "Unit") { if (!unitP) unitP = p; }
      else if (tn === "Melee Weapon" || tn === "Ranged Weapon") weaponPs.push({ profile: p, container });
      else if (tn.includes("Ability")) abilityPs.push(p);
    }
    if (!unitP || !weaponPs.length) continue;

    const keywords = collectKeywords(entry);
    const modelCount = detectModelCount(entry);
    const weapons = [];
    const seen = new Set();
    for (const { profile: wp, container: wpContainer } of weaponPs) {
      const isR = wp.getAttribute("typeName") === "Ranged Weapon";
      const wName = cleanText(wp.getAttribute("name") || "Weapon");
      const atk = cleanVal(getChar(wp, "Atk")) || "1";
      const hit = cleanVal(getChar(wp, "Hit")) || "4+";
      const wnd = cleanVal(getChar(wp, "Wnd")) || "4+";
      const rnd = cleanVal(getChar(wp, "Rnd")) || "-";
      const dmg = cleanVal(getChar(wp, "Dmg")) || "1";
      const ability = cleanAbility(getChar(wp, "Ability")) || "-";
      const rng = isR ? cleanVal(getChar(wp, "Rng")) : null;
      const key = `${wName}|${atk}|${hit}|${wnd}|${rnd}|${dmg}|${ability}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Use BSData max constraint to cap upgrade weapons (e.g. "1 in 5" grandhammers)
      const bsdataMax = getSelectionMax(wpContainer, entry);
      const weaponCount = (bsdataMax !== null && bsdataMax < modelCount)
        ? Math.max(1, bsdataMax)
        : modelCount;
      weapons.push({
        name: wName + (rng ? ` (${rng})` : ""),
        type: isR ? "ranged" : "melee",
        attacks: atk, hit, wound: wnd,
        rend: rnd === "0" ? "-" : rnd,
        damage: dmg, ability, modelCount: weaponCount, enabled: true,
        _bsdataMax: bsdataMax, // temp — used by distributeWeaponLoadouts then removed
      });
    }
    if (!weapons.length) continue;
    distributeWeaponLoadouts(weapons, modelCount);

    // Extract unit abilities (Activated + Passive)
    const abilities = [];
    for (const ap of abilityPs) {
      const tn = ap.getAttribute("typeName") || "";
      const aName = cleanText(ap.getAttribute("name") || "");
      if (!aName) continue;
      const isActivated = tn.includes("Activated");
      const isPassive = tn.includes("Passive");
      const isSpell = tn.includes("Spell");
      const isPrayer = tn.includes("Prayer");
      // For Activated abilities: Timing, Declare, Effect (typeIds differ from Passive)
      // For Passive abilities: just Effect
      const timing = isActivated ? (getChar(ap, "Timing") || "") : "";
      const declare = isActivated ? (getChar(ap, "Declare") || "") : "";
      // Effect field exists on both, but with different typeIds — getChar matches by name
      const effect = getChar(ap, "Effect") || "";
      const abilityKeywords = getChar(ap, "Keywords") || "";
      // Classify combat relevance from effect text
      const effectLower = effect.toLowerCase();
      const combatRelevant =
        /mortal damage/i.test(effect) ||
        /add \d+ to the (attacks|damage|rend|hit|wound)/i.test(effect) ||
        /strike-last/i.test(effect) ||
        /strike-first/i.test(effect) ||
        /\bdamage points\b/i.test(effect) ||
        /\bward\b/i.test(effect) ||
        /\bcharge roll\b/i.test(effect) ||
        /\bfight\b/i.test(effect) ||
        /\bcombat\b/i.test(effect);

      abilities.push({
        name: aName,
        type: isActivated ? "activated" : isPassive ? "passive" : isSpell ? "spell" : isPrayer ? "prayer" : "other",
        timing,
        declare,
        effect,
        keywords: abilityKeywords,
        combatRelevant,
      });
    }

    const sv = cleanVal(getChar(unitP, "Save")) || "6+";
    units.push({
      id: entry.getAttribute("id") || "",
      name, faction: "", modelCount,
      health: cleanVal(getChar(unitP, "Health")) || "1",
      save: sv.includes("+") ? sv : sv + "+",
      move: getChar(unitP, "Move") || "-",
      control: parseInt(cleanVal(getChar(unitP, "Control"))) || 1,
      ward: detectWard(keywords, abilityPs),
      keywords, weapons, abilities, points: 0,
    });
  }
  return units.sort((a, b) => a.name.localeCompare(b.name));
}
