# Milestones

## v1.1 UX & Community Release (Shipped: 2026-04-08)

**Phases completed:** 4 phases, 9 plans
**Timeline:** 2026-04-07 → 2026-04-08 (2 days)
**Git:** ~115 commits, 47 files, +7350 / -120 lines

**Key accomplishments:**

- Phase 8: `runnerViewMode` setting + `activateRunnerView()` D-04 deduplication — runner now opens as full editor tab or sidebar panel, deduplicated across mode changes (RUNTAB-01, RUNTAB-02, RUNTAB-03)
- Phase 9: `CanvasSelectorWidget` drill-down dropdown + `protocolFolderPath` setting — switch canvas/scenario from within the runner without re-invoking the command (SELECTOR-01–04)
- Phase 10: `insertIntoCurrentNote()` + "Insert into note" button with `active-leaf-change` listener — protocol output appended to the active markdown note with `WriteMutex` guard (OUTPUT-01–03)
- Phase 11: `CanvasLiveEditor` using Canvas internal API (getData/setData) + live-first/Strategy-A-fallback pattern in `saveNodeEdits()` — canvas node edits appear immediately while canvas is open; no "close canvas" blocking notice (LIVE-01–04)

**Archive:** `.planning/milestones/v1.1-ROADMAP.md`

---

## v1.0 Community Plugin Release (Shipped: 2026-04-07)

**Phases completed:** 7 phases, 28 plans  
**Timeline:** 2026-04-05 → 2026-04-07 (3 days)  
**Git:** 158 commits, 167 files, ~43K LOC

**Key accomplishments:**

- Phase 1: Plugin scaffold with esbuild, strict TypeScript, hot-reload dev script, and full ESLint flat config (23 obsidianmd rules) — all 14 tests green
- Phase 2: Pure traversal state machine with discriminated union (5 states), TextAccumulator with snapshot undo, ProtocolRunner covering all node types and iteration cap — all runner tests green
- Phase 3: End-to-end RunnerView ItemView — two-zone live preview layout, all question types rendered, copy/save output, NodePickerModal, main.ts fully wired — UAT approved on all 13 checks
- Phase 4: EditorPanelView side panel with per-node forms for all 7 node kinds, canvas write-back with closed-canvas guard, context menu integration — UAT approved, all 7 tests passed
- Phase 5: Full snippet system — SnippetService CRUD, WriteMutex, SnippetManagerView master-detail UI, SnippetFillInModal with live preview, runner awaiting-snippet-fill integration — UAT approved
- Phase 6: Loop engine with LoopContext stack, undo across loop boundaries, RunnerView loop-end UI with iteration label and loop again/done buttons — 3-lesion protocol confirmed end-to-end
- Phase 7: SessionService auto-save/resume, ResumeSessionModal, canvas mtime check, snippet content snapshot, Set→Array serialization, onLayoutReady deferral fix — all SESSION requirements verified

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

---
