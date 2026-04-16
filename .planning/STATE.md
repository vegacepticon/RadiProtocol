---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: "Polish & Canvas Workflow"
status: Defining requirements
stopped_at: null
last_updated: "2026-04-16T12:00:00.000Z"
last_activity: 2026-04-16
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# RadiProtocol — Project State

**Updated:** 2026-04-16
**Milestone:** v1.6 — Polish & Canvas Workflow
**Status:** Defining requirements
**Last session:** 2026-04-16
**Stopped at:** —

---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-16 — Milestone v1.6 started

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-16)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.
**Current focus:** v1.6 — Polish & Canvas Workflow

---

## Accumulated Context

### v1.0–v1.5 Shipped

- v1.0: 7 phases — foundation (parser, runner, UI, editor panel, snippets, loops, sessions)
- v1.2: 8 phases — runner UX and bug fixes (layout, selectors, separators, read-back fixes)
- v1.3: 1 phase — interactive placeholder chip editor
- v1.4: 4 phases — auto node coloring, snippet node (8th kind), mixed answer+snippet branching
- v1.5: 4 phases — snippet editor refactoring (tree UI, modal create/edit, DnD, rename, MD snippets in runner)

### Standing Pitfalls

1. Never modify `.canvas` while open in Canvas view (Strategy A) unless Pattern B live-editor is used
2. `vault.modify()` race conditions — use `WriteMutex` (async-mutex) per file path
3. No `innerHTML` — use DOM API and Obsidian helpers
4. No `require('fs')` — use `app.vault.*` exclusively
5. `loadData()` returns null on first install — always merge with defaults
6. Infinite loop cycles — validate protocol graph before running; hard iteration cap (default 50)
7. `console.log` forbidden in production — use `console.debug()` during dev
8. CSS files are append-only per phase — edit only the relevant feature file in `src/styles/`; never delete rules from earlier phases
9. Shared files (main.ts, editor-panel-view.ts, snippet-manager-view.ts) — only modify code relevant to the current phase; never remove code you didn't add
10. Real-DOM vs mock-DOM parent lookup: always use `parentElement` first, `.parent` mock fallback second — mock-only lookup paths silently break in real Obsidian (Phase 34 post-UAT fix 77b62c1)

### Known Follow-ups (non-blocking)

- **Node Editor panel stale `subfolderPath` display** after folder move/rename — see `.planning/phases/34-.../34-VERIFICATION.md` § Follow-up work. Cosmetic refresh gap in adjacent component, not a Phase 34 regression.

---

## Repository

- Branch: `gsd/phase-26-auto-switch-to-node-editor-tab`
- Main: `main`
- Last shipped: v1.5 (2026-04-16)
