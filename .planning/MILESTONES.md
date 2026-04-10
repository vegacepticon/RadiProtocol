# Milestones

## v1.2 Runner UX & Bug Fixes (Shipped: 2026-04-10)

**Phases completed:** 8 phases (12–19), 11 plans  
**Timeline:** 2026-04-07 → 2026-04-10 (3 days)  
**Git:** ~200 commits, ~7K LOC TypeScript in src/

**Key accomplishments:**

- Phase 12: Redesigned RunnerView layout — auto-grow textarea, correct zone ordering, equal-size buttons, legend removed (LAYOUT-01–04)
- Phase 13: Canvas selector widget in sidebar + Run Again button after protocol completion (SIDEBAR-01, RUNNER-01)
- Phase 14: Click-to-load node auto-switch in EditorPanel + unsaved edit guard modal (EDITOR-01, EDITOR-02)
- Phase 15–16: Global + per-node text separator settings; manual textarea edits preserved across step advances (SEP-01, SEP-02, BUG-01)
- Phase 17: Fixed free-text-input/text-block node type read-back when canvas open; fixed Add button in snippet placeholder mini-form (BUG-02, BUG-03, BUG-04)
- Phase 18–19: Closed 3 CSS styling gaps; wrote retroactive VERIFICATION.md for Phases 12–14; 8/8 UAT passed in live Obsidian

**Archive:** `.planning/milestones/v1.2-ROADMAP.md`, `.planning/milestones/v1.2-MILESTONE-AUDIT.md`

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
