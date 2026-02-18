# AoS Mathhammer – Project Context

## Purpose
Tabletop wargame combat probability simulator.
Focus: accurate average damage, alternating activations, buffs, crit logic, mortal wounds.

## Tech Stack
- React (Vite)
- Single file main engine inside App.jsx
- No backend
- No database
- Pure client-side calculations

## Core Engine
File: src/App.jsx

Main functions:
- simulateCombat()
- parseDice()
- resolveAnti()
- calcPFailSave()
- calcEffSave()

Do NOT change engine math without explicit instruction.

## UI Structure
- UnitPanel component
- Results component
- WBreak component

## Current Working Version
v0.11 (Rolled back stable build)

## Known Rules Implemented
- All-Out Attack
- All-Out Defence
- Companion restrictions
- Crit Buffs
- Power Through
- Save 6 Reflect
- Mortal wound abilities

## Current Goal
- Stable build
- Clean modifier system
- Optional: BSData import

## Important
If app black screens:
- Check main.jsx
- Check JSX validity
- Check Vite console errors

Never refactor entire file unless explicitly requested.
