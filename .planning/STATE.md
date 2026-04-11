---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Node Editor Overhaul & Snippet Node
status: in_progress
current_phase: "25"
current_phase_name: snippet-node-runner-ui
last_updated: "2026-04-11T21:17:00.000Z"
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# RadiProtocol — Project State

**Updated:** 2026-04-11
**Milestone:** v1.3 — Node Editor Overhaul & Snippet Node
**Status:** Phase 25 complete — snippet node runner UI delivered
**Last session:** 2026-04-11T21:17:00.000Z
**Stopped at:** Phase 25 complete (2/2 plans, SNIPPET-02/03/04/05/07 satisfied)

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-10)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.  
**Current focus:** Planning next milestone (run `/gsd-new-milestone`)

---

## Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 1 | Project Scaffold + Canvas Parsing Foundation | Complete |
| 2 | Core Protocol Runner Engine | Complete |
| 3 | Runner UI (ItemView) | Complete |
| 4 | Canvas Node Editor Side Panel | Complete |
| 5 | Dynamic Snippets | Complete |
| 6 | Loop Support | Complete |
| 7 | Mid-Session Save + Resume | Complete |
| 12 | Runner Layout Overhaul | Complete |
| 13 | Sidebar Canvas Selector and Run Again | Complete |
| 14 | Node Editor Auto-Switch and Unsaved Guard | Complete |
| 15 | Text Separator Setting | Complete |
| 16 | Runner Textarea Edit Preservation | Complete |
| 17 | Node Type Read-Back and Snippet Placeholder Fixes | Complete |
| 18 | CSS Gap Fixes (INSERTED) | Complete |
| 19 | Phase 12–14 Formal Verification | Complete |

---

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| Read-only Canvas contract | No official Canvas runtime API; never modify `.canvas` while open |
| TypeScript + esbuild + plain DOM | Standard Obsidian plugin toolchain; zero framework overhead for v1 |
| Vitest for engine tests | Pure engine modules (parser, runner) have no Obsidian imports; fully unit-testable |
| One-file-per-snippet storage | Minimizes vault.modify() race conditions and sync conflicts |
| Discriminated union on `kind` for node types | Type-safe graph model; 7 node types: start, question, answer, text-block, free-text, loop-start, loop-end |
| Snapshot undo stack | Simplest correct approach for step-back; protocol text is small (<5KB) |
| `radiprotocol_*` property namespace | Avoids collisions with other plugins and future Obsidian updates |
| Canvas write-back Strategy A | Require canvas closed before any vault.modify() — simple and safe; avoids undocumented internals (A4 resolved) |
| plugin.saveSettings() not saveData() directly | Consistent with main.ts wrapper; all settings call sites use the wrapper |
| maxLoopIterations moved into Runner section | D-07 groups related runner settings under one heading in Settings tab |
| RunnerView reconstructs ProtocolRunner at openCanvas() start | Simplest way to pick up textSeparator from settings; no lazy init or observer needed |
| resolveSeparator(node) single resolution point | node.radiprotocol_separator ?? defaultSeparator — avoids duplicated logic across 5 call sites |
| capture-before-advance pattern (BUG-01) | syncManualEdit() called before each advance action so undo snapshot includes manual textarea edit |
| overwrite() semantically separate from restoreTo() | restoreTo = undo revert of a snapshot; overwrite = inject caller's text — clearer intent at call sites |
| live textarea read in complete-state toolbar (D-03) | previewTextarea?.value ?? capturedText replaces stale closure to honour final edits before copy/save/insert |
| getCanvasJSON() for runner read path | Reads live in-memory canvas data; vault.read() retained only in EditorPanel form load (pre-existing gap) |

---

## Open Assumptions (Require User Confirmation Before Phases 5 + 6)

| ID | Assumption | Phase |
|----|-----------|-------|
| A1 | Loop-start node uses two outgoing edges (continue + exit) rather than a dedicated "loop again?" node | 6 |
| A2 | Snippet placeholder syntax uses `{{placeholder_id}}` double-curly-brace format | 5 |
| A3 | Session files stored vault-visible in `.radiprotocol/sessions/` (not hidden in plugin data.json) | 7 |

---

## Critical Pitfalls (Standing Reminders)

1. **Never modify `.canvas` while open in Canvas view** — Canvas view will overwrite on next interaction
2. **`vault.modify()` race conditions** — use write mutex (async-mutex) per file path
3. **No `innerHTML`** — use DOM API and Obsidian helpers; blocks community review if violated
4. **No `require('fs')`** — use `app.vault.*` exclusively
5. **`loadData()` returns null on first install** — always merge with defaults
6. **Infinite loop cycles** — validate protocol graph before running; hard iteration cap (default 50)
7. **`console.log` forbidden in production** — use `console.debug()` during dev; remove before release

---

## Repository

- Branch: `main`
- Remote: (not yet configured)
- Last commit: `209e285` — docs(audit): update v1.2 milestone audit — all 14 requirements satisfied
