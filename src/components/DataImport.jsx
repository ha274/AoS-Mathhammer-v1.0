import { useState, useCallback, useMemo, useEffect } from 'react';
import { C, bI } from '../styles';
import { parseCatalogue } from '../parser/catalogue';
import { parsePointsCatalogue, applyPointsToLibraryUnits } from '../parser/points';

const GITHUB_REPO = "https://github.com/BSData/age-of-sigmar-4th";
const GITHUB_API_TREE = "https://api.github.com/repos/BSData/age-of-sigmar-4th/git/trees/main?recursive=1";
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/BSData/age-of-sigmar-4th/main/";

const BACKUP_KEY = 'aos-mathhammer-bsdata-backup';

function mergePointsMaps(base, add) {
  if (!add) return base;
  for (const [k, v] of add.pointsBySharedId.entries()) base.pointsBySharedId.set(k, v);
  for (const [k, v] of add.pointsByName.entries()) if (!base.pointsByName.has(k)) base.pointsByName.set(k, v);
  base.total = base.pointsBySharedId.size + base.pointsByName.size;
  return base;
}

async function mapWithConcurrency(items, limit, worker) {
  const out = new Array(items.length);
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      out[cur] = await worker(items[cur], cur);
    }
  });
  await Promise.all(runners);
  return out;
}

const isLegacyPath = (path) => /legacy/i.test(path);

/**
 * Shared BSData importer — lives at App level, fetches once, feeds both panels.
 * Props:
 *   units / setUnits — lifted state (array of parsed unit objects)
 *   showLegacy / setShowLegacy — legacy filter toggle
 */
export default function DataImport({ units, setUnits, showLegacy, setShowLegacy }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [fileName, setFileName] = useState("");
  const [pointsMaps, setPointsMaps] = useState(null);
  const [pointsFileName, setPointsFileName] = useState("");
  const [pointsMatched, setPointsMatched] = useState(0);
  const [pointsError, setPointsError] = useState("");

  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState("");
  const [importStats, setImportStats] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null); // { phase, done, total }

  // Local backup state
  const [backupMeta, setBackupMeta] = useState(null);
  const [backupStatus, setBackupStatus] = useState("");

  // Check for existing backup on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (raw) {
        const backup = JSON.parse(raw);
        setBackupMeta({ timestamp: backup.timestamp, unitCount: backup.units?.length || 0, factions: backup.factions || 0 });
      }
    } catch { /* corrupt backup, ignore */ }
  }, []);

  const handleSaveBackup = useCallback(() => {
    if (units.length === 0) return;
    try {
      const factions = new Set(units.map(u => u.faction).filter(Boolean));
      const backup = {
        timestamp: new Date().toISOString(),
        factions: factions.size,
        units,
      };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
      setBackupMeta({ timestamp: backup.timestamp, unitCount: units.length, factions: factions.size });
      setBackupStatus("saved");
      setTimeout(() => setBackupStatus(""), 3000);
    } catch (e) {
      setBackupStatus("error");
      setError(`Backup failed: ${e.message}`);
    }
  }, [units]);

  const handleRestoreBackup = useCallback(() => {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return;
      const backup = JSON.parse(raw);
      if (!backup.units?.length) { setError("Backup is empty"); return; }
      setUnits(backup.units);
      setFileName(`Restored from local backup (${new Date(backup.timestamp).toLocaleDateString()})`);
      const matched = backup.units.filter(u => (u.points || 0) > 0).length;
      setPointsMatched(matched);
      setBackupStatus("restored");
      setTimeout(() => setBackupStatus(""), 3000);
    } catch (e) {
      setError(`Restore failed: ${e.message}`);
    }
  }, [setUnits]);

  const handleDeleteBackup = useCallback(() => {
    localStorage.removeItem(BACKUP_KEY);
    setBackupMeta(null);
    setBackupStatus("deleted");
    setTimeout(() => setBackupStatus(""), 3000);
  }, []);

  const handleFile = useCallback(async (file) => {
    setError(""); setUnits([]); setFileName(file.name);
    if (!file.name.endsWith(".cat") && !file.name.endsWith(".xml")) {
      setError("Please select a .cat file from BSData"); return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      const parsed = parseCatalogue(text);
      const faction = file.name.replace(" - Library.cat", "").replace(".cat", "");
      for (const [i, u] of parsed.entries()) {
        u.faction = faction;
        u.legacy = isLegacyPath(file.name) || /legacy/i.test(u.name) || /legacy/i.test(faction);
        u.__key = `${u.faction}::${u.id || u.name}::${i}`;
      }
      if (pointsMaps) {
        const matched = applyPointsToLibraryUnits(parsed, pointsMaps);
        setPointsMatched(matched);
      }
      setUnits(parsed);
      if (!parsed.length) setError("No units found — make sure this is a Library .cat file");
    } catch (e) { setError(e.message || "Failed to parse"); }
    finally { setLoading(false); }
  }, [pointsMaps, setUnits]);

  const handlePointsFile = useCallback(async (file) => {
    setPointsError(""); setPointsFileName(file.name);
    if (!file.name.endsWith(".cat") && !file.name.endsWith(".xml")) {
      setPointsError("Please select a .cat file"); return;
    }
    try {
      const text = await file.text();
      const maps = parsePointsCatalogue(text);
      setPointsMaps(maps);
      if (units.length > 0) {
        const updated = units.map(u => ({ ...u }));
        const matched = applyPointsToLibraryUnits(updated, maps);
        setUnits(updated);
        setPointsMatched(matched);
      }
      if (maps.total === 0) setPointsError("No points found — make sure this is the faction .cat (not Library)");
    } catch (e) { setPointsError(e.message || "Failed to parse points file"); }
  }, [units, setUnits]);

  const handleLoadAllOnline = useCallback(async () => {
    setOnlineError("");
    setOnlineLoading(true);
    setLoading(true);
    setError("");
    setImportStats(null);
    setSyncProgress({ phase: "Fetching file list...", done: 0, total: 0 });

    const stats = { pointsFiles: 0, pointsFailed: 0, libraryFiles: 0, libraryFailed: 0, unitsParsed: 0, pointsEntries: 0, factions: new Set() };

    try {
      const treeRes = await fetch(GITHUB_API_TREE);
      if (!treeRes.ok) throw new Error(`GitHub tree fetch failed (${treeRes.status})`);
      const treeJson = await treeRes.json();
      const allPaths = (treeJson.tree || []).filter(n => n.type === 'blob').map(n => n.path);
      const catPaths = allPaths.filter(p => p.toLowerCase().endsWith('.cat'));
      const libraryPaths = catPaths.filter(p => /library\.cat$/i.test(p));
      const pointsPaths = catPaths.filter(p => !/library\.cat$/i.test(p));

      let ptsDone = 0;
      setSyncProgress({ phase: "Fetching points files", done: 0, total: pointsPaths.length });
      const merged = { pointsBySharedId: new Map(), pointsByName: new Map(), total: 0 };
      await mapWithConcurrency(pointsPaths, 8, async (path) => {
        try {
          const res = await fetch(`${GITHUB_RAW_BASE}${path}`);
          if (!res.ok) { stats.pointsFailed++; return; }
          const text = await res.text();
          const m = parsePointsCatalogue(text);
          mergePointsMaps(merged, m);
          stats.pointsFiles++;
        } catch {
          stats.pointsFailed++;
        } finally {
          ptsDone++;
          setSyncProgress({ phase: "Fetching points files", done: ptsDone, total: pointsPaths.length });
        }
      });
      stats.pointsEntries = merged.pointsBySharedId.size + merged.pointsByName.size;

      let libDone = 0;
      setSyncProgress({ phase: "Fetching library files", done: 0, total: libraryPaths.length });
      const unitChunks = await mapWithConcurrency(libraryPaths, 8, async (path) => {
        try {
          const res = await fetch(`${GITHUB_RAW_BASE}${path}`);
          if (!res.ok) { stats.libraryFailed++; return []; }
          const text = await res.text();
          const parsed = parseCatalogue(text);
          const filePart = path.split('/').pop() || '';
          const faction = filePart.replace(' - Library.cat', '').replace('.cat', '').trim();
          const legacy = isLegacyPath(path);
          applyPointsToLibraryUnits(parsed, merged);
          stats.libraryFiles++;
          if (parsed.length > 0) stats.factions.add(faction);
          return parsed.map((u, i) => ({
            ...u,
            faction,
            legacy: legacy || /legacy/i.test(u.name) || /legacy/i.test(faction),
            __key: `${faction}::${u.id || u.name}::${path}::${i}`,
          }));
        } catch {
          stats.libraryFailed++;
          return [];
        } finally {
          libDone++;
          setSyncProgress({ phase: "Fetching library files", done: libDone, total: libraryPaths.length });
        }
      });

      const flat = unitChunks.flat().sort((a, b) => {
        const f = a.faction.localeCompare(b.faction);
        return f !== 0 ? f : a.name.localeCompare(b.name);
      });

      stats.unitsParsed = flat.length;
      const matched = flat.filter(u => (u.points || 0) > 0).length;

      setUnits(flat);
      setPointsMaps(merged);
      setPointsMatched(matched);
      setFileName('Online sync: all Library.cat files');
      setPointsFileName('Online sync: all faction .cat files');
      setImportStats({ ...stats, pointsMatched: matched, factions: stats.factions.size });
      if (!flat.length) setOnlineError('No units were parsed from the online repository.');
    } catch (e) {
      setOnlineError(e.message || 'Failed to load BSData from GitHub');
    } finally {
      setOnlineLoading(false);
      setLoading(false);
      setSyncProgress(null);
    }
  }, [setUnits]);

  return <div style={{ marginBottom: 14 }}>
    <button onClick={() => setExpanded(!expanded)} style={{
      background: expanded ? "rgba(92,204,136,0.12)" : "rgba(92,204,136,0.10)",
      border: `1px solid ${expanded ? "rgba(92,204,136,0.4)" : "rgba(92,204,136,0.35)"}`,
      color: "#5cc888", borderRadius: 4, cursor: "pointer", fontSize: 11,
      padding: "6px 10px", fontFamily: "'Cinzel', serif", letterSpacing: 1, textTransform: "uppercase",
      width: "100%", textAlign: "left", transition: "all 0.15s", fontWeight: 600,
    }}>
      {expanded ? "▾" : "▸"} BSData Import (shared)
      {units.length > 0 && !loading && <span style={{ marginLeft: 8, fontSize: 9, color: "#5cc888" }}>
        ✓ {units.length} units{pointsMaps ? ` · ${pointsMatched} pts matched` : ""}
      </span>}
    </button>
    {expanded && <div style={{ padding: "8px 0 4px", borderLeft: "2px solid rgba(92,204,136,0.15)", paddingLeft: 10, marginTop: 4 }}>

      {/* One-button online sync */}
      <div style={{ marginBottom: 10, padding: "8px", background: "rgba(92,204,136,0.04)", border: "1px solid rgba(92,204,136,0.18)", borderRadius: 6 }}>
        <div style={{ fontSize: 9, color: "#5cc888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>One-click online import</div>
        <button onClick={handleLoadAllOnline} disabled={onlineLoading} style={{
          width: "100%", padding: "8px 10px", borderRadius: 6, cursor: onlineLoading ? "default" : "pointer",
          background: onlineLoading ? "rgba(92,204,136,0.15)" : "rgba(92,204,136,0.12)",
          border: "1px solid rgba(92,204,136,0.35)", color: "#5cc888", fontSize: 12,
          fontFamily: "'Cinzel', serif", letterSpacing: 0.8,
        }}>{onlineLoading ? "Syncing all factions from GitHub..." : "Pull all units for all factions from GitHub"}</button>
        <div style={{ fontSize: 10, color: C.fGold, marginTop: 4, lineHeight: 1.4 }}>
          Pulls every <code>Library.cat</code> and faction points catalogue from <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" style={{ color: "#5cc888" }}>BSData/age-of-sigmar-4th</a>.
          Both attacker and defender panels can select from the imported data.
        </div>
        {syncProgress && <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 10, color: "#5cc888", marginBottom: 3 }}>
            {syncProgress.phase}{syncProgress.total > 0 ? ` (${syncProgress.done}/${syncProgress.total})` : ""}
          </div>
          {syncProgress.total > 0 && <div style={{
            height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(92,204,136,0.15)", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${(syncProgress.done / syncProgress.total) * 100}%`,
              background: "linear-gradient(90deg, #5cc888aa, #5cc888)",
              transition: "width 0.15s ease",
            }} />
          </div>}
        </div>}
        {onlineError && <div style={{ fontSize: 10, color: "#e86868", marginTop: 4 }}>! {onlineError}</div>}
        {importStats && <div style={{
          marginTop: 8, padding: "8px 10px", borderRadius: 4,
          background: "rgba(92,204,136,0.04)", border: "1px solid rgba(92,204,136,0.15)",
          fontSize: 10, lineHeight: 1.6,
        }}>
          <div style={{ color: "#5cc888", fontWeight: 600, marginBottom: 3, letterSpacing: 0.5, textTransform: "uppercase", fontSize: 9 }}>Import Summary</div>
          {[
            ["Factions", importStats.factions],
            ["Library files fetched", importStats.libraryFiles],
            ["Points files fetched", importStats.pointsFiles],
            ["Units parsed", importStats.unitsParsed],
            ["Points entries", importStats.pointsEntries],
            ["Points matched to units", importStats.pointsMatched],
          ].map(([label, val], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", color: C.fGold }}>
              <span>{label}</span>
              <span style={{ color: "#5cc888", fontWeight: 600 }}>{val}</span>
            </div>
          ))}
          {(importStats.libraryFailed > 0 || importStats.pointsFailed > 0) && <>
            <div style={{ borderTop: "1px solid rgba(232,104,104,0.2)", marginTop: 4, paddingTop: 4 }}>
              {importStats.libraryFailed > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#e86868" }}>
                <span>Library files failed</span>
                <span style={{ fontWeight: 600 }}>{importStats.libraryFailed}</span>
              </div>}
              {importStats.pointsFailed > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#e86868" }}>
                <span>Points files failed</span>
                <span style={{ fontWeight: 600 }}>{importStats.pointsFailed}</span>
              </div>}
            </div>
          </>}
        </div>}
      </div>

      {/* Local Backup */}
      <div style={{ marginBottom: 10, padding: "8px", background: "rgba(74,158,222,0.04)", border: "1px solid rgba(74,158,222,0.18)", borderRadius: 6 }}>
        <div style={{ fontSize: 9, color: "#4a9ede", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Local Backup</div>
        {backupMeta && <div style={{ fontSize: 10, color: C.fGold, marginBottom: 6, lineHeight: 1.5 }}>
          Saved: <span style={{ color: "#4a9ede" }}>{new Date(backupMeta.timestamp).toLocaleString()}</span>
          {" — "}{backupMeta.unitCount} units across {backupMeta.factions} factions
        </div>}
        {!backupMeta && units.length === 0 && <div style={{ fontSize: 10, color: C.fGold, marginBottom: 6, fontStyle: "italic" }}>
          No backup found. Import units above, then save a local backup to skip GitHub fetches next time.
        </div>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {units.length > 0 && <button onClick={handleSaveBackup} style={{
            flex: 1, padding: "6px 10px", borderRadius: 4, cursor: "pointer",
            background: "rgba(74,158,222,0.12)", border: "1px solid rgba(74,158,222,0.35)",
            color: "#4a9ede", fontSize: 11, fontFamily: "'Cinzel', serif", letterSpacing: 0.5,
          }}>{backupMeta ? "Update Local Backup" : "Save Local Backup"}</button>}
          {backupMeta && units.length === 0 && <button onClick={handleRestoreBackup} style={{
            flex: 1, padding: "6px 10px", borderRadius: 4, cursor: "pointer",
            background: "rgba(92,204,136,0.12)", border: "1px solid rgba(92,204,136,0.35)",
            color: "#5cc888", fontSize: 11, fontFamily: "'Cinzel', serif", letterSpacing: 0.5,
          }}>Restore from Backup</button>}
          {backupMeta && <button onClick={handleDeleteBackup} style={{
            padding: "6px 10px", borderRadius: 4, cursor: "pointer",
            background: "rgba(232,104,104,0.08)", border: "1px solid rgba(232,104,104,0.25)",
            color: "#e86868", fontSize: 11, fontFamily: "'Cinzel', serif", letterSpacing: 0.5,
          }}>Delete</button>}
        </div>
        {backupStatus === "saved" && <div style={{ fontSize: 10, color: "#5cc888", marginTop: 4 }}>Backup saved successfully</div>}
        {backupStatus === "restored" && <div style={{ fontSize: 10, color: "#5cc888", marginTop: 4 }}>Restored from backup</div>}
        {backupStatus === "deleted" && <div style={{ fontSize: 10, color: "#e86868", marginTop: 4 }}>Backup deleted</div>}
        {backupStatus === "error" && <div style={{ fontSize: 10, color: "#e86868", marginTop: 4 }}>Backup failed — storage may be full</div>}
      </div>

      {/* Instructions */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: "#5cc888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>Manual file import (optional fallback)</div>
        <div style={{ fontSize: 11, color: C.dGold, lineHeight: 1.5 }}>
          Go to <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" style={{ color: "#5cc888", textDecoration: "underline" }}>BSData/age-of-sigmar-4th</a> on GitHub.
          Download <strong>both</strong> files for your faction:
        </div>
        <div style={{ fontSize: 10, color: C.fGold, marginTop: 3, lineHeight: 1.6 }}>
          <span style={{ color: "#5cc888" }}>Stats:</span> "Faction - Library.cat" <span style={{ opacity: 0.5 }}> &rarr; units, weapons, keywords, abilities</span><br/>
          <span style={{ color: "#c9a84c" }}>Points:</span> "Faction.cat" <span style={{ opacity: 0.5 }}> &rarr; point costs</span>
        </div>
      </div>

      {/* Library file upload */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 9, color: "#5cc888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>
          Load Library file (stats)
          {fileName && units.length > 0 && <span style={{ color: "#5cc888", marginLeft: 6 }}>✓</span>}
        </div>
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "8px 12px", borderRadius: 6, cursor: "pointer",
          background: fileName && units.length > 0 ? "rgba(92,204,136,0.04)" : "rgba(92,204,136,0.06)",
          border: `2px dashed ${fileName && units.length > 0 ? "rgba(92,204,136,0.4)" : "rgba(92,204,136,0.25)"}`,
          color: "#5cc888", fontSize: 12, fontFamily: "'Crimson Text', serif", transition: "all 0.15s",
        }}>
          {fileName || "Click to select Library .cat file..."}
          <input type="file" accept=".cat,.xml" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} style={{ display: "none" }} />
        </label>
      </div>

      {/* Points file upload */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 9, color: C.gold, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>
          Load Faction points file (optional)
          {pointsMaps && <span style={{ color: "#5cc888", marginLeft: 6 }}>✓ {pointsMaps.total} entries</span>}
        </div>
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "8px 12px", borderRadius: 6, cursor: "pointer",
          background: pointsMaps ? "rgba(201,168,76,0.04)" : "rgba(201,168,76,0.06)",
          border: `2px dashed ${pointsMaps ? "rgba(92,204,136,0.4)" : "rgba(201,168,76,0.25)"}`,
          color: C.gold, fontSize: 12, fontFamily: "'Crimson Text', serif", transition: "all 0.15s",
        }}>
          {pointsFileName || "Click to select Faction .cat file..."}
          <input type="file" accept=".cat,.xml" onChange={e => { const f = e.target.files?.[0]; if (f) handlePointsFile(f); }} style={{ display: "none" }} />
        </label>
        {pointsError && <div style={{ fontSize: 10, color: "#e86868", marginTop: 3 }}>! {pointsError}</div>}
      </div>

      {loading && <div style={{ fontSize: 11, color: "#5cc888", padding: "8px 0", textAlign: "center", fontStyle: "italic" }}>Parsing catalogue...</div>}
      {error && <div style={{ fontSize: 11, color: "#e86868", background: "rgba(232,104,104,0.08)", border: "1px solid rgba(232,104,104,0.2)", borderRadius: 4, padding: "6px 8px", marginBottom: 6 }}>! {error}</div>}

      {/* Legacy toggle */}
      {units.length > 0 && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, gap: 8 }}>
        <div style={{ fontSize: 9, color: C.fGold, fontStyle: "italic", opacity: 0.8 }}>
          {units.filter(u => showLegacy || !u.legacy).length}/{units.length} units available{showLegacy ? ' (legacy included)' : ' (legacy hidden)'}.
          Select units in each panel below.
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.fGold, whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={showLegacy} onChange={(e) => setShowLegacy(e.target.checked)} />
          Include Legacy
        </label>
      </div>}
    </div>}
  </div>;
}
