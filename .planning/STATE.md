---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Runner UX & Bug Fixes
status: planning
last_updated: "2026-04-08T00:00:00.000Z"
last_activity: 2026-04-08 -- Milestone v1.2 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# RadiProtocol — Project State

**Updated:** 2026-04-08
**Milestone:** v1.2 — Runner UX & Bug Fixes
**Status:** Defining requirements

---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-08 — Milestone v1.2 started

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-08)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.
**Current focus:** v1.2 — Runner UX improvements and bug fixes

---

## Critical Pitfalls (Standing Reminders)

1. **Never modify `.canvas` while open in Canvas view** — Phase 11 added live path (CanvasLiveEditor); Strategy A fallback still used when canvas is closed
2. **`vault.modify()` race conditions** — use write mutex (async-mutex) per file path
3. **No `innerHTML`** — use DOM API and Obsidian helpers; blocks community review if violated
4. **No `require('fs')`** — use `app.vault.*` exclusively
5. **`loadData()` returns null on first install** — always merge with defaults
6. **Infinite loop cycles** — validate protocol graph before running; hard iteration cap (default 50)
7. **`console.log` forbidden in production** — use `console.debug()` during dev; remove before release
8. **Canvas selector destroyed on re-render** — render in `onOpen()` header, not `contentEl`
9. **`requestSave()` race with canvas dirty cycle** — debounce 500ms in CanvasLiveEditor
10. **vitest `resolve.alias` for `obsidian`** — required in vitest.config.ts; obsidian package has empty `main` field

---

## Accumulated Context

- v1.0 shipped 2026-04-07: 7 phases, 28 plans, ~43K LOC, all UAT approved
- v1.1 shipped 2026-04-08: 4 phases, 9 plans, +7350/-120 lines, all UAT approved
- CanvasLiveEditor uses Canvas internal API (getData/setData Pattern B) with requestSave() debounce 500ms
- Strategy A (vault.modify when canvas closed) still the fallback path in saveNodeEdits()
- 3 pre-existing RED stubs in runner-extensions.test.ts — known debt, deferred to future milestone
- Canvas selector (CanvasSelectorWidget) currently rendered in RunnerView headerEl only in tab mode
- RunnerView textarea is already editable but accumulated text state overwrites user edits on each step
- free-text-input / text-block node bug: nodes created manually on canvas + configured via Node Editor not appearing in runner — likely radiprotocol_nodeType not being written correctly
- Snippet placeholder bug: label field clears on "Add" click without adding placeholder — event handler or state issue
