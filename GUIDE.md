# AoS Mathhammer - Guide

A combat simulator for Age of Sigmar. No dice - just average expected results.

## Before You Start

Download the **BSData** file first. The simulator uses this to power the unit import library. Without it, you will need to enter all unit stats and weapons manually.

## Quick Start

1. Fill in each unit's **Name**, **Points**, **Models**, **Health**, and **Save**
2. Click **+ Add Weapon** and fill in the weapon profile
3. Pick a combat mode and hit simulate

Or use **Import** to load a unit from the library with stats and weapons pre-filled.

## What Gets Imported vs What Doesn't

The import pulls in **base stats and weapon profiles** from the unit card. That covers attacks, hit, wound, rend, damage, save, health, etc.

**Unit special abilities need to be added manually** using the modifier buttons. Things like extra mortal wounds on a threshold, ward saves, fight twice, rerolls - if it is not a base stat or weapon ability, you need to toggle it yourself.

## Combat Modes

| Mode | What It Does |
|------|-------------|
| **Melee** | Both units fight in combat, casualties removed between strikes |
| **Shoot Only** | Shooting phase only |
| **Shoot + Charge** | Attacking unit shoots, then both units fight in melee |

Click the **"strikes first"** bar to swap who swings first.

## Dice Notation

Anywhere you see a number field, you can use:

`1`, `2`, `3` - flat values
`D3`, `D6` - single die
`2D6`, `3D3` - multiple dice
`D6+3`, `2D6+1` - dice plus bonus
`-` - zero / none

## Weapon Options

| Field | Format | Example |
|-------|--------|---------|
| Attacks | dice notation | `2D6`, `4` |
| Hit | threshold | `3+`, `4+` |
| Wound | threshold | `3+`, `4+` |
| Rend | number | `0`, `1`, `2` |
| Damage | dice notation | `D3`, `2` |

**Checkboxes:**
- **Companion** - mount/beast attacks (only All-out Attack and negative mods apply)
- **Ranged** - marks weapon as shooting

**Weapon Abilities (text field):**
- `Crit (Mortal)` - crits bypass saves
- `Crit (Auto-wound)` - crits skip wound roll
- `Crit (2 Hits)` - crits generate 2 wound rolls
- `Charge (+1 Damage)` - bonus damage on charge
- `Anti-KEYWORD (+X Rend)` - bonus rend vs keyword (e.g. `Anti-INFANTRY (+1 Rend)`)
- `Anti-KEYWORD (+X Damage)` - bonus damage vs keyword (e.g. `Anti-MONSTER (+1 Damage)`)

## Modifier Buttons

These are for adding bonuses and abilities that are not part of the base stats or weapon profiles. Use these to represent unit special abilities, command abilities, and buffs.

### Attack Modifiers

| Modifier | What It Does |
|----------|-------------|
| All-out Attack | +1 to hit, -1 to your own save |
| Hit Modifier | +1 or -1 to hit rolls |
| Wound Modifier | +1 or -1 to wound rolls |
| Extra Rend | Adds rend to all weapons |
| Extra Damage | Adds damage to all weapons |
| Extra Attacks | Adds attacks to all weapons |
| Champion | +1 attack to the weapon with the most models |
| Hit Reroll | `ones` or `full` reroll |
| Wound Reroll | `ones` or `full` reroll |
| Crit Buff | `2 hits`, `auto-wound`, or `mortal` |
| Crit On | `5` or `6` (default 6) |
| On X Mortals | Deal mortals on a threshold (e.g. D3 on 5+), timing: `before`, `during`, or `after` |
| Per Model Mortals | Mortals based on enemy models in range |
| Power Through | D3 wounds at the end of combat |
| Fight Twice | Full second activation at strike-last |

### Defence Modifiers

| Modifier | What It Does |
|----------|-------------|
| All-out Defence | +1 to save |
| Save Modifier | +1 or -1 to saves |
| Ward | Ward save (e.g. `5+`, `4+`) |
| Save Reroll | `ones` or `full` reroll |
| Save 6 Reflect | Unmodified 6s on saves reflect 1 mortal back |

### Combat Options

| Option | What It Does |
|--------|-------------|
| Charged | Unit charged this turn (triggers Charge weapon abilities) |
| Was Charged | Activates Anti-CHARGE bonuses |

## Unit Keywords

Units can have keywords like `INFANTRY`, `MONSTER`, `HERO`, `CAVALRY`, `FLY`, etc. These are used for Anti-ability matching.

## Importing Units

- **Import** - load a unit from the built-in library with stats and weapons pre-filled
- After importing, edit anything you want - it is just a starting point
- Change **Models** to simulate different unit sizes
- Your changes are saved locally in your browser

## Reading Results

- **Attack Sequence** - step-by-step combat breakdown
- **Total Damage** - headline damage and kills, expandable per-weapon breakdown
- **Points Efficiency** - damage per 100pts, points per kill, ROI, and a verdict on who won the trade
