---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Node Editor Overhaul & Snippet Node
status: defining_requirements
stopped_at: Milestone v1.3 started — defining requirements
last_updated: "2026-04-10T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# RadiProtocol — Project State

**Updated:** 2026-04-10  
**Milestone:** v1.3 — Node Editor Overhaul & Snippet Node  
**Status:** Defining requirements  
**Last session:** 2026-04-10  
**Stopped at:** Milestone v1.3 started — defining requirements

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-10)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.  
**Current focus:** v1.3 — Node Editor auto-save, Snippet node type, UX fixes

---

## Phase Progress

*(No phases yet — roadmap in progress)*

---

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| Read-only Canvas contract (Strategy A) | No official Canvas runtime API; never modify `.canvas` while open — fallback when canvas closed |
| CanvasLiveEditor Pattern B | getData/setData/requestSave for live edits when canvas is open — undocumented but widely used |
| TypeScript + esbuild + plain DOM | Standard Obsidian plugin toolchain; zero framework overhead |
| Vitest for engine tests | Pure engine modules (parser, runner) have no Obsidian imports; fully unit-testable |
| One-file-per-snippet storage | Minimizes vault.modify() race conditions and sync conflicts |
| Discriminated union on `kind` for node types | Type-safe graph model; node types being revised in v1.3 |
| Snapshot undo stack | Simplest correct approach for step-back; protocol text is small (<5KB) |
| `radiprotocol_*` property namespace | Avoids collisions with other plugins and future Obsidian updates |

---

## Critical Pitfalls (Standing Reminders)

1. **Never modify `.canvas` while open in Canvas view** — use CanvasLiveEditor Pattern B instead
2. **`vault.modify()` race conditions** — use write mutex (async-mutex) per file path
3. **No `innerHTML`** — use DOM API and Obsidian helpers
4. **No `require('fs')`** — use `app.vault.*` exclusively
5. **`loadData()` returns null on first install** — always merge with defaults
6. **Infinite loop cycles** — validate protocol graph before running; hard iteration cap (default 50)
7. **`console.log` forbidden in production** — use `console.debug()` during dev; remove before release
8. **CanvasLiveEditor color field** — `color` is currently in PROTECTED_FIELDS; must be removed to support node type color coding

---

## Repository

- Branch: `main`
- Remote: (not yet configured)
- Last commit: `5308b1d` — chore: archive phase directories from completed milestones
