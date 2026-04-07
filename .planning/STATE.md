---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: UX & Community Release
status: executing
last_updated: "2026-04-07T12:38:31.739Z"
last_activity: 2026-04-07 -- Phase 08 execution started
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# RadiProtocol — Project State

**Updated:** 2026-04-07
**Milestone:** v1.1 — UX & Community Release
**Status:** Executing Phase 08

---

## Current Position

Phase: 08 (settings-full-tab-runner-view) — EXECUTING
Plan: 1 of 2
Status: Executing Phase 08
Last activity: 2026-04-07 -- Phase 08 execution started

```
v1.1 Progress: [░░░░░░░░░░░░░░░░░░░░] 0% (0/4 phases)
```

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-07)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.
**Current focus:** Phase 08 — settings-full-tab-runner-view

---

## v1.1 Phase Overview

| Phase | Goal | Requirements |
|-------|------|--------------|
| 8 | Runner opens as sidebar or full editor tab per Settings toggle | RUNTAB-01, RUNTAB-02, RUNTAB-03 |
| 9 | Canvas selector dropdown — switch canvases without re-invoking command | SELECTOR-01, SELECTOR-02, SELECTOR-03, SELECTOR-04 |
| 10 | Insert into current note output destination | OUTPUT-01, OUTPUT-02, OUTPUT-03 |
| 11 | Live canvas editing while canvas is open (internal API + Strategy A fallback) | LIVE-01, LIVE-02, LIVE-03, LIVE-04 |

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
| Canvas selector header rendered in onOpen() | Must render into dedicated headerEl, never contentEl — contentEl is wiped by render() on every state transition |
| Live canvas editing deferred to Phase 11 | Highest risk feature (undocumented API); isolated last so it cannot block delivery of other features |

---

## Critical Pitfalls (Standing Reminders)

1. **Never modify `.canvas` while open in Canvas view** — Canvas view will overwrite on next interaction (Strategy A; Phase 11 lifts this with internal API + fallback)
2. **`vault.modify()` race conditions** — use write mutex (async-mutex) per file path
3. **No `innerHTML`** — use DOM API and Obsidian helpers; blocks community review if violated
4. **No `require('fs')`** — use `app.vault.*` exclusively
5. **`loadData()` returns null on first install** — always merge with defaults
6. **Infinite loop cycles** — validate protocol graph before running; hard iteration cap (default 50)
7. **`console.log` forbidden in production** — use `console.debug()` during dev; remove before release
8. **Canvas selector destroyed on re-render** — render in `onOpen()` header, not `contentEl`
9. **`requestSave()` race with canvas dirty cycle** — debounce 500ms in Phase 11

---

## Accumulated Context

- v1.0 shipped 2026-04-07: 7 phases, 28 plans, ~43K LOC, all UAT approved
- Session restore uses `onLayoutReady` deferral to prevent startup hang
- WriteMutex (async-mutex) required on all vault.modify() calls
- Canvas editor (EditorPanelView) currently uses Strategy A: requires canvas closed before write
- v1.1 engine unchanged: ProtocolRunner, CanvasParser, GraphValidator, SnippetService, SessionService all untouched
- No new npm dependencies required for v1.1
- New files expected: `src/canvas/canvas-live-editor.ts`, `src/types/canvas-internal.d.ts`
- Modified files expected: `settings.ts`, `main.ts`, `runner-view.ts`, `editor-panel-view.ts`
