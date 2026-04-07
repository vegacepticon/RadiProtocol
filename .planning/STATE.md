---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: UX & Community Release
status: in_progress
last_updated: "2026-04-07T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# RadiProtocol — Project State

**Updated:** 2026-04-07
**Milestone:** v1.1 — UX & Community Release
**Status:** Defining requirements

---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-07 — Milestone v1.1 started

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-07)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.
**Current focus:** v1.1 — UX improvements + community plugin submission

---

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| Read-only Canvas contract during sessions | No official Canvas runtime API; never modify `.canvas` while open |
| TypeScript + esbuild + plain DOM | Standard Obsidian plugin toolchain; zero framework overhead for v1 |
| Vitest for engine tests | Pure engine modules (parser, runner) have no Obsidian imports; fully unit-testable |
| One-file-per-snippet storage | Minimizes vault.modify() race conditions and sync conflicts |
| Discriminated union on `kind` for node types | Type-safe graph model; 7 node types |
| Snapshot undo stack | Simplest correct approach for step-back; protocol text is small (<5KB) |
| `radiprotocol_*` property namespace | Avoids collisions with other plugins and future Obsidian updates |
| Canvas write-back Strategy A | Require canvas closed before any vault.modify() — simple and safe |
| Live canvas editing via internal Canvas View API | v1.1 decision: use canvas.requestSave() / internal API to allow node edits while canvas is open |

---

## Critical Pitfalls (Standing Reminders)

1. **Never modify `.canvas` while open in Canvas view** — Canvas view will overwrite on next interaction (Strategy A; v1.1 explores internal API to lift this restriction)
2. **`vault.modify()` race conditions** — use write mutex (async-mutex) per file path
3. **No `innerHTML`** — use DOM API and Obsidian helpers; blocks community review if violated
4. **No `require('fs')`** — use `app.vault.*` exclusively
5. **`loadData()` returns null on first install** — always merge with defaults
6. **Infinite loop cycles** — validate protocol graph before running; hard iteration cap (default 50)
7. **`console.log` forbidden in production** — use `console.debug()` during dev; remove before release

---

## Accumulated Context

- v1.0 shipped 2026-04-07: 7 phases, 28 plans, ~43K LOC, all UAT approved
- Session restore uses `onLayoutReady` deferral to prevent startup hang
- WriteMutex (async-mutex) required on all vault.modify() calls
- Canvas editor (EditorPanelView) currently uses Strategy A: requires canvas closed before write
