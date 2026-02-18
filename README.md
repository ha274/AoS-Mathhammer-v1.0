# AoS Mathhammer

**Combat Probability Simulator for rank-and-flank wargames**

A probability calculator for tabletop wargame combat using the Hit/Wound/Save/Ward pipeline. Compare units, model weapon profiles, and analyze the expected outcomes of shooting and melee exchanges.

## Features

- **Three Combat Modes**: Shoot Only, Shoot + Charge, Melee Only
- **Full rules support**: Hit/Wound/Save/Ward pipeline, Crit abilities (Mortal, Auto-wound, 2 Hits), Companion rules, Charge bonuses, Anti-X abilities
- **BSData Import**: Load unit stats directly from BSData .cat files — no manual data entry needed
- **Points Efficiency**: Damage per 100pts, Points per kill, ROI analysis, Points destroyed
- **Extra Mortals**: Power Through, Breath attacks (D3 on X+), Per-model mortals, Save 6 Reflect
- **Ranged + Melee**: Separate weapon pools, shooting casualties reduce melee model count, charge bonuses only apply to melee
- **Preset Units**: Quick-load example unit archetypes for testing

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Build for Production

```bash
npm run build
```

Output goes to `dist/` — deploy anywhere (GitHub Pages, Netlify, Vercel, etc.).

## BSData Import

1. Go to the BSData repository on GitHub for your game system
2. Download your faction's **Library .cat** file (stats + weapons)
3. Optionally download the **Faction .cat** file (points costs)
4. Use the "Import from BSData" panel in the app to load both files

## Project Structure

```
src/
  App.jsx                    — Main state management & layout
  styles.js                  — Shared colour palette & input styles
  engine/
    combat.js                — Combat math engine (pure functions, no React)
  parser/
    catalogue.js             — BSData Library .cat XML parser
    points.js                — BSData Faction .cat points parser
  components/
    UnitPanel.jsx            — Unit configuration panel
    WeaponRow.jsx            — Individual weapon editor row
    DataImport.jsx           — BSData file upload UI
    Results.jsx              — Combat results display
    WBreak.jsx               — Weapon breakdown in results
    ui/
      Tog.jsx                — Toggle button
      Stepper.jsx            — +/- numeric control
      StatBadge.jsx          — Stat display badge
      WeaponBreakdown.jsx    — Compact weapon breakdown
  data/
    presets.js               — Built-in preset units
    defaults.js              — Default mods, empty weapon template
```

## Tech Stack

- React 18
- Vite
- No external UI libraries — custom dark gold fantasy theme

## Version History

- **v0.13** — Three combat modes (Shoot Only / Shoot+Charge / Melee Only), ranged weapon support, weapon type toggle
- **v0.12** — Two-file BSData import (Library + Faction points), points matching
- **v0.11** — BSData .cat file import via local upload
- **v0.10** — Full combat engine with crits, companions, anti-abilities, extra mortals, save reflect

---

Built with dice and spreadsheets by people who should probably just play the game.
