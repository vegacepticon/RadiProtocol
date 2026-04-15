---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 35-01-PLAN.md
last_updated: "2026-04-15T19:08:24.568Z"
last_activity: 2026-04-15
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 18
  completed_plans: 17
  percent: 94
---

# RadiProtocol — Project State

**Updated:** 2026-04-15
**Milestone:** v1.5 — Snippet Editor Refactoring
**Status:** Ready to execute
**Last session:** 2026-04-15T19:08:24.565Z
**Stopped at:** Completed 35-01-PLAN.md

---

## Current Position

Phase: 35 (markdown-snippets-in-protocol-runner) — EXECUTING
Plan: 2 of 2
Next: Phase 35 — Markdown Snippets in Protocol Runner
Last activity: 2026-04-15

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-15)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.
**Current focus:** Phase 35 — markdown-snippets-in-protocol-runner

### v1.5 Phases

- Phase 32: SnippetService Refactor — MD Support, Trash Delete, Canvas Reference Sync ✅
- Phase 33: Tree UI, Modal Create/Edit, Folder Operations, Vault Watcher ✅
- Phase 34: Drag-and-Drop, Context Menu, Rename, Move with Canvas Reference Updates ✅
- Phase 35: Markdown Snippets in Protocol Runner

---

## Accumulated Context

### v1.0–v1.4 Shipped

- v1.0: 7 phases — foundation (parser, runner, UI, editor panel, snippets, loops, sessions)
- v1.2: 8 phases — runner UX and bug fixes (layout, selectors, separators, read-back fixes)
- v1.3: 1 phase — interactive placeholder chip editor
- v1.4: 4 phases — auto node coloring, snippet node (8th kind), mixed answer+snippet branching

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
- Last shipped: v1.4 (2026-04-15)
