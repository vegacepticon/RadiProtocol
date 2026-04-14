---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Snippets and Colors, Colors and Snippets
status: executing
stopped_at: Completed 30-01-PLAN.md
last_updated: "2026-04-14T05:41:26.155Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 8
  completed_plans: 6
  percent: 75
---

# RadiProtocol — Project State

**Updated:** 2026-04-13
**Milestone:** v1.4 — Snippets and Colors, Colors and Snippets
**Status:** Executing Phase 30
**Last session:** 2026-04-14T05:41:26.150Z
**Stopped at:** Completed 30-01-PLAN.md

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-13)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.  
**Current focus:** Phase 30 — snippet-node-runner-integration

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
| 27 | Interactive Placeholder Editor | Complete |
| 28 | Auto Node Coloring | Complete |
| 29 | Snippet Node — Model, Editor, Validator | Complete |
| 30 | Snippet Node — Runner Integration | Not started |

---

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| Read-only Canvas contract | No official Canvas runtime API; never modify `.canvas` while open (unless Pattern B path is used via CanvasLiveEditor) |
| TypeScript + esbuild + plain DOM | Standard Obsidian plugin toolchain; zero framework overhead for v1 |
| Vitest for engine tests | Pure engine modules (parser, runner) have no Obsidian imports; fully unit-testable |
| One-file-per-snippet storage | Minimizes vault.modify() race conditions and sync conflicts |
| Discriminated union on `kind` for node types | Type-safe graph model; 8 node types: start, question, answer, text-block, free-text, loop-start, loop-end, snippet |
| Snapshot undo stack | Simplest correct approach for step-back; protocol text is small (<5KB) |
| `radiprotocol_*` property namespace | Avoids collisions with other plugins and future Obsidian updates |
| Canvas write-back Strategy A | Require canvas closed before any vault.modify() — simple and safe; avoids undocumented internals (A4 resolved) |
| Pattern B (CanvasLiveEditor) | Live write via internal getData/setData/requestSave when canvas is open; falls back to Strategy A |
| plugin.saveSettings() not saveData() directly | Consistent with main.ts wrapper; all settings call sites use the wrapper |
| RunnerView reconstructs ProtocolRunner at openCanvas() start | Simplest way to pick up textSeparator from settings; no lazy init or observer needed |
| resolveSeparator(node) single resolution point | node.radiprotocol_separator ?? defaultSeparator — avoids duplicated logic across 5 call sites |
| capture-before-advance pattern (BUG-01) | syncManualEdit() called before each advance action so undo snapshot includes manual textarea edit |
| live textarea read in complete-state toolbar (D-03) | previewTextarea?.value ?? capturedText replaces stale closure to honour final edits before copy/save/insert |
| getCanvasJSON() for runner read path | Reads live in-memory canvas data; vault.read() retained only in EditorPanel form load (pre-existing gap) |
| HTML5 native DnD for chip reorder (Phase 27) | Chips recreated on re-render so addEventListener is correct; no drag library overhead |
| UUID guard in autoSaveAfterDrop() (Phase 27) | Prevents saving snippets with unsaved placeholder IDs |
| SnippetNode subfolderPath optional string (Phase 29) | Absence = root `.radiprotocol/snippets/`; consistent with D-02, D-03 |
| NODE_COLOR_MAP snippet = '6' purple (Phase 29) | Semantic color per D-11; purple distinguishes snippet nodes from all other kinds |
| void IIFE for async inside sync buildKindForm (Phase 29) | Preserves synchronous signature throughout; consistent with existing loadNode → renderNodeForm pattern |

---

## Critical Pitfalls (Standing Reminders)

1. **Never modify `.canvas` while open in Canvas view** — Canvas view will overwrite on next interaction (unless Pattern B path is used via CanvasLiveEditor)
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
- Last commit: `8d16b94` — feat(29-02): add snippet case to EditorPanel — dropdown option, subfolder picker, listSnippetSubfolders
