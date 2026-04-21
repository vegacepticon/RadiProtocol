# RadiProtocol

## What This Is

An Obsidian community plugin that turns Canvas files into interactive protocol generators for medical imaging reports (CT, X-ray, MRI, Ultrasound). The user builds a question-and-answer algorithm visually on the Obsidian Canvas, then runs it through the plugin's protocol runner — which steps through questions, assembles the report text piece by piece, supports dynamic snippets with fill-in placeholders, repeating loops for multi-lesion workflows, and saves/resumes sessions across Obsidian restarts.

## Core Value

A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code to build that algorithm.

## Current Milestone: v1.8 UX Polish & Snippet Picker Overhaul

**Status:** ✅ SHIPPED 2026-04-21

## Requirements

### Validated (v1.0)

**Canvas Parser:**
- ✓ Parse any `.canvas` JSON into a typed `ProtocolGraph` (Map-based adjacency list) — v1.0
- ✓ Recognise all 7 RadiProtocol node kinds from `radiprotocol_nodeType` — v1.0
- ✓ Silently skip plain canvas nodes in mixed-content canvases — v1.0
- ✓ `radiprotocol_*` property namespace — no collisions with native canvas — v1.0
- ✓ `GraphValidator` checks 6 error classes in plain English before session opens — v1.0
- ✓ `CanvasParser` is a pure module with zero Obsidian API imports — v1.0

**Protocol Runner:**
- ✓ Step-through Q&A state machine: preset answers, free-text input, text-block auto-advance — v1.0
- ✓ Step-back (undo) with full snapshot of navigation state and accumulated text — v1.0
- ✓ Loop support: loop-start/loop-end node pair, iteration counter display, undo across loop boundaries — v1.0
- ✓ Mid-session save/resume: auto-save after every step, resume prompt, canvas modification warning — v1.0
- ✓ Discriminated union state machine (idle / at-node / awaiting-snippet-fill / complete / error) — v1.0
- ✓ Configurable hard iteration cap (default 50) to prevent infinite loops — v1.0

**Runner UI:**
- ✓ `RunnerView` ItemView in right sidebar with live protocol preview — v1.0
- ✓ Copy to clipboard + save to new note output buttons — v1.0
- ✓ Validation error panel with plain-language guidance — v1.0
- ✓ `getState()`/`setState()` workspace persistence — v1.0
- ✓ All DOM via `createEl`/`createDiv`; all events via `registerDomEvent()` — v1.0
- ✓ Settings tab: output destination, output folder, max loop iterations — v1.0
- ✓ Start-from-node command via `NodePickerModal` — v1.0

**Canvas Node Editor:**
- ✓ `EditorPanelView` ItemView side panel with per-node forms for all 7 node kinds — v1.0
- ✓ Write-back to `.canvas` file requires canvas to be closed (Strategy A) — v1.0
- ✓ Context menu integration on canvas nodes — v1.0

**Snippet System:**
- ✓ `SnippetService` full CRUD for per-file JSON snippets in `.radiprotocol/snippets/` — v1.0
- ✓ Four placeholder types: free-text, choice, multi-choice, number — v1.0
- ✓ `SnippetFillInModal` with live preview and tab navigation — v1.0
- ✓ Runner `awaiting-snippet-fill` integration — v1.0
- ✓ `WriteMutex` (async-mutex) on all snippet/session `vault.modify()` calls — v1.0
- ✓ `SnippetManagerView` full CRUD UI — v1.0

**Dev Workflow:**
- ✓ `npm run dev` hot-reload with esbuild watch + auto-copy to dev vault — v1.0
- ✓ ESLint flat config: all 23 `eslint-plugin-obsidianmd` rules, strict TS, no-console, no-innerHTML — v1.0
- ✓ Vitest for pure engine modules with zero Obsidian imports — v1.0

### Validated (v1.2)

**Runner UX:**
- ✓ Auto-grow preview textarea (LAYOUT-01) — v1.2
- ✓ Question zone always below text area in layout (LAYOUT-02) — v1.2
- ✓ Copy/Save/Insert buttons equal-size (LAYOUT-03) — v1.2
- ✓ Node legend removed from runner view (LAYOUT-04) — v1.2
- ✓ Canvas selector widget in sidebar runner mode (SIDEBAR-01) — v1.2
- ✓ Run Again button after protocol completion (RUNNER-01) — v1.2

**Node Editor:**
- ✓ Click canvas node → auto-load in EditorPanel (EDITOR-01) — v1.2
- ✓ Unsaved edit guard modal on node switch (EDITOR-02) — v1.2

**Settings & Separator:**
- ✓ Global text separator setting with per-protocol default (SEP-01) — v1.2
- ✓ Per-node separator override in EditorPanel dropdowns (SEP-02) — v1.2

**Bug Fixes:**
- ✓ Manual textarea edits preserved across step advances (BUG-01) — v1.2
- ✓ free-text-input node type read-back when canvas open (BUG-02) — v1.2
- ✓ text-block node type read-back when canvas open (BUG-03) — v1.2
- ✓ Add button in snippet placeholder mini-form (BUG-04) — v1.2

### Validated (v1.3)

**Snippet Placeholder Editor:**
- ✓ Chip-based placeholder list with type-colour bars, human-readable labels, type badge, drag handle, remove button (CHIP-01) — v1.3
- ✓ HTML5 drag-and-drop reorder with correct splice pattern and dragleave child-flicker guard (CHIP-02) — v1.3
- ✓ `autoSaveAfterDrop()` persists reordered array to disk — SnippetFillInModal tab order follows persisted order (CHIP-03) — v1.3

### Validated (v1.4)

**Auto Node Coloring:**
- ✓ Saving any node via EditorPanel writes the correct type color to canvas JSON (Pattern B + Strategy A) — v1.4 (NODE-COLOR-01)
- ✓ Color is always overwritten on save regardless of prior state — v1.4 (NODE-COLOR-02)
- ✓ Programmatically created test canvases include the correct color per node type — v1.4 (NODE-COLOR-03)

**Snippet Node (8th kind):**
- ✓ Parser/graph-model/validator recognize `snippet` as first-class node kind — v1.4 (SNIPPET-NODE-01, SNIPPET-NODE-08)
- ✓ EditorPanel subfolder picker form with BFS traversal of `.radiprotocol/snippets/` — v1.4 (SNIPPET-NODE-02)
- ✓ Runner `awaiting-snippet-pick` state with folder drill-down picker — v1.4 (SNIPPET-NODE-03, SNIPPET-NODE-04)
- ✓ SnippetFillInModal wiring for placeholder snippets; direct append for non-placeholder snippets — v1.4 (SNIPPET-NODE-05, SNIPPET-NODE-06)
- ✓ Terminal + non-terminal snippet node graph positions — v1.4 (SNIPPET-NODE-07)

**Mixed Answer + Snippet Branching (Phase 31):**
- ✓ Question nodes support mixed outgoing edges to answer and snippet nodes — v1.4
- ✓ Per-node `snippetLabel` and separator override in Node Editor — v1.4
- ✓ Step-back from open snippet picker returns to branch list — v1.4

### Validated (v1.5)

**SnippetService Refactor (Phase 32):**
- ✓ `Snippet = JsonSnippet | MdSnippet` discriminated union with extension-based routing (MD-05) — v1.5
- ✓ Snippet delete via `vault.trash()` — Obsidian trash, not permanent delete (DEL-01) — v1.5
- ✓ `rewriteCanvasRefs` vault-wide canvas reference sync utility with WriteMutex — v1.5

**Snippet Tree UI (Phase 33):**
- ✓ Folder tree view in SnippetManagerView replaces master-detail layout (TREE-01..04) — v1.5
- ✓ Unified create/edit modal with JSON↔MD toggle, folder dropdown, unsaved-changes guard (MODAL-01..08) — v1.5
- ✓ Folder create/delete via context menu with contents listing confirm (FOLDER-01..03) — v1.5
- ✓ Vault watcher with 120ms debounce + prefix filter, teardown on close (SYNC-01..03) — v1.5
- ✓ Snippet delete confirm modal, removed from tree and runner picker (DEL-02..03) — v1.5

**Drag-and-Drop, Rename, Move (Phase 34):**
- ✓ DnD moves files and folders in tree (MOVE-01..02) — v1.5
- ✓ Context menu "Move to…" with folder picker; modal folder field moves on save (MOVE-03..04) — v1.5
- ✓ Move/rename auto-rewrites Canvas SnippetNode references (MOVE-05, RENAME-03) — v1.5
- ✓ F2/context-menu inline rename for files and folders (RENAME-01..02) — v1.5

**Markdown Snippets in Protocol Runner (Phase 35):**
- ✓ Runner snippet picker lists both `.md` and `.json` files with type-indicator glyphs (MD-01) — v1.5
- ✓ Selecting `.md` snippet inserts raw content verbatim without fill-in modal (MD-02) — v1.5
- ✓ `.md` snippets work in full drill-down and step-back flow (MD-03) — v1.5
- ✓ Mixed answer+snippet branching routes to `.md` snippet branches (MD-04) — v1.5

### Validated (v1.6)

**Cleanup & Polish:**
- ✓ Dead code audit: 8 unused TS exports internalized, 2 dead files deleted, 3 legend CSS rules + 3 RED test stubs removed (CLEAN-01) — v1.6
- ✓ "Тип JSON" spacing fix in snippet create/edit modal via CSS flex gap (CLEAN-02) — v1.6
- ✓ "Создать папку" button in snippet editor header (CLEAN-03) — v1.6

**Data Sync:**
- ✓ Folder rename updates canvas SnippetNode `subfolderPath` + `text` fields across vault (SYNC-01) — v1.6

**Canvas Node Creation:**
- ✓ `CanvasNodeFactory` service with Pattern B `createTextNode` internal API + runtime probing + auto-color (CANVAS-01, CANVAS-04) — v1.6
- ✓ Quick-create "Create question node" button from Node Editor sidebar with auto-positioning (CANVAS-02) — v1.6
- ✓ Quick-create "Create answer node" button linked to current question (CANVAS-03) — v1.6
- ✓ Quick-create "Create snippet node" button (fourth button, Phase 42) — v1.6
- ✓ Clear Obsidian Notice when canvas is not open (CANVAS-05) — v1.6

**Node Duplication:**
- ✓ Duplicate selected canvas node — preserves all `radiprotocol_*` properties, new ID, offset position (DUP-01) — v1.6
- ✓ Duplicated node does NOT copy edges (DUP-02) — v1.6

**Live Canvas Update on Folder Rename:**
- ✓ `canvasLiveEditor.saveLive()` Pattern B updates snippet node `text` + `subfolderPath` in real-time when canvas open (LIVE-01) — v1.6
- ✓ `vault.modify()` fallback preserved when canvas not open (LIVE-02) — v1.6
- ✓ Mid-iteration `saveLive()` failure falls back to vault.modify() per-file (LIVE-03) — v1.6

**Bug Fixes:**
- ✓ Double-click-created node now loads in Node Editor via in-memory canvas fallback (`renderNodeForm`) + `setTimeout(0)` deferred selection read + `dblclick` listener wiring — v1.6
- ✓ Empty-type node shows "Select a node type to configure this node" hint and `— unset —` dropdown — v1.6
- ✓ Quick-create toolbar wraps at narrow sidebar widths via `flex-wrap: wrap` — v1.6

### Validated (v1.7)

**Loop Node Unification:**
- ✓ Unified `loop` node kind in graph model (LOOP-01) — v1.7
- ✓ `LoopNode.headerText` editable field rendered above picker (LOOP-02) — v1.7
- ✓ Canvas parser recognizes `radiprotocol_nodeType = "loop"` (LOOP-03) — v1.7
- ✓ `GraphValidator` enforces «выход» edge + ≥1 body edge (LOOP-04) — v1.7
- ✓ Node Editor form edits `headerText`, no `maxIterations` control (LOOP-05) — v1.7
- ✓ `NODE_COLOR_MAP` + `NodePickerModal` list `loop` as first-class kind with red color and Russian badge «Цикл» (LOOP-06) — v1.7

**Loop Runtime:**
- ✓ Single picker combining body-branch labels + «выход» above `headerText` (RUN-01) — v1.7
- ✓ Body-branch dead-end returns to same loop picker (RUN-02) — v1.7
- ✓ «выход» pops loop frame and exits (RUN-03) — v1.7
- ✓ Nested loops preserve parent state via `LoopContext` stack with B1 re-entry guard (RUN-04) — v1.7
- ✓ Step-back from picker unwinds to pre-loop state via B2 `previousCursor` threading (RUN-05) — v1.7
- ✓ Session save/resume preserves loop-node state at `awaiting-loop-pick` (RUN-06) — v1.7
- ✓ `maxIterations` field + settings UI removed; no runtime iteration cap (RUN-07) — v1.7

**Migration:**
- ✓ Legacy `loop-start`/`loop-end` canvases fail `GraphValidator` with plain-language rebuild instruction (MIGRATE-01) — v1.7
- ✓ Migration error surfaces in existing RunnerView error panel (MIGRATE-02) — v1.7

**Free-Text-Input Removal:**
- ✓ `free-text-input` removed from `RPNodeKind`; `FreeTextInputNode` interface deleted (CLEAN-01) — v1.7
- ✓ Parser rejects legacy `free-text-input` canvases with Russian error via MIGRATE-02 surface (CLEAN-02) — v1.7
- ✓ All consumer references excised from runner, views, color map, CSS (CLEAN-03) — v1.7
- ✓ Fixture + tests removed or rewritten; full suite green (CLEAN-04) — v1.7

### Validated (v1.8)

**Runner Regressions:**
- ✓ Manual textarea edits preserved across loop transitions (RUNFIX-01) — v1.8
- ✓ Scroll position preserved on choice insert (RUNFIX-02) — v1.8
- ✓ Choice button padding/line-height for Cyrillic descenders (RUNFIX-03) — v1.8

**Node Editor UX:**
- ✓ Snippet ID field removed from Text block (NODEUI-01) — v1.8
- ✓ New nodes anchor below last node (NODEUI-02) — v1.8
- ✓ Answer fields reordered: Display label above Answer text (NODEUI-03) — v1.8
- ✓ Question textarea auto-grow + label repositioning (NODEUI-04) — v1.8
- ✓ Create buttons bottom vertical stack (NODEUI-05) — v1.8

**Edge Semantics:**
- ✓ Loop exit derived from sole labeled outgoing edge (EDGE-01, historical) — v1.8
- ✓ Answer displayLabel ↔ incoming edge label bidirectional sync (EDGE-02) — v1.8
- ✓ Loop exit "+"-prefix convention (EDGE-03, active) — v1.8

**Snippet System:**
- ✓ Snippet node binding to specific file + hierarchical picker (PICKER-01/02) — v1.8
- ✓ JSON placeholders collapsed to free text + unified choice (PHLD-01) — v1.8

**Runner Features:**
- ✓ Skip button: advances without text append + undo roundtrip (RUNNER-SKIP-01..03) — v1.8
- ✓ Close button: unloads canvas with confirmation + teardown (RUNNER-CLOSE-01..03) — v1.8
- ✓ Inline protocol display mode: floating modal over active note (INLINE-01..05) — v1.8

**Distribution:**
- ✓ BRAT-ready: manifest/versions aligned, GitHub Release v1.8.0 published (BRAT-01) — v1.8

### Active (v1.9 — to be defined in next milestone)

### Deferred (Future Milestones)

- [ ] Canvas selector dropdown in runner view — choose protocol without reopening command
- [ ] Full-tab runner view — open as editor tab instead of sidebar panel
- [ ] Protocol authoring documentation / example canvases for community submission
- [ ] Community plugin submission checklist (README, LICENSE, manifest review, plugin review)
- [ ] Node templates — save frequently-used node structures for reuse
- [ ] Configurable output destination: insert into current note
- [ ] UI hint when global separator change requires canvas reopen to take effect
- [ ] Retroactive Nyquist VALIDATION.md for phases 12–19 (tech debt)

### Out of Scope

- AI/LLM-generated text — manual algorithm authoring only; not in v1
- PACS/RIS direct integration — clipboard/note output is sufficient for v1
- Mobile support (Obsidian mobile) — desktop-first; mobile later
- Multi-user / shared vaults — single-user local vault only for v1
- Version history for snippets — file system handles backups
- Linked placeholders across report sections — deferred after core snippet system validated
- Optional sections in snippets — deferred to v2
- Automatic impression generation — requires NLP/AI

## Current State

**Shipped:** v1.8 UX Polish & Snippet Picker Overhaul (2026-04-21)
**Active milestone:** None — ready for next milestone planning
**v1.8 shipped:** 14 phases (47–58), 50 plans, 26/26 requirements satisfied

**Key v1.8 deliverables:**
- Runner regressions closed (textarea preservation, scroll, button typography)
- Node Editor UX polish (form layout, auto-grow, bottom-stacked buttons)
- Edge semantics: loop exit "+"-prefix convention, Answer↔edge label sync
- Snippet picker overhaul: hierarchical tree + specific-file binding + button UX
- JSON placeholders collapsed to 2 types with working options editor
- Inline protocol display mode (floating modal over active note)
- BRAT distribution readiness (GitHub Release v1.8.0)

## Context

- Shipped v1.0 (7 phases) + v1.2 (8 phases) + v1.3 (1 phase) + v1.4 (4 phases) + v1.5 (4 phases) + v1.6 (7 phases) + v1.7 (4 phases) + v1.8 (14 phases); ~18K+ LOC TypeScript in src/
- Tech stack: TypeScript + Obsidian Plugin API + esbuild + Vitest
- Target: public release on Obsidian Community Plugins (BRAT-ready)
- Primary author: radiologist (CT focus), designed for all imaging modalities
- All v1.8 phases human-UAT approved; milestone audit passed — 26/26 requirements, 14/14 phases, 5/5 E2E flows verified
- All engine code (parser, runner, snippets, sessions) has zero Obsidian imports and is fully unit-testable
- 648+ tests passing + 1 skipped, build green, `npx tsc --noEmit --skipLibCheck` exit 0
- Known tech debt: Nyquist VALIDATION.md gaps for older phases, 1 legacy debug session (phase-27-regressions), stale todo files for delivered work, `@deprecated` LoopStartNode/LoopEndNode retained for Migration Check

## Constraints

- **Tech Stack**: TypeScript + Obsidian Plugin API + esbuild (standard plugin toolchain)
- **Canvas Format**: Must stay compatible with Obsidian's native `.canvas` JSON format — cannot break existing canvas files
- **UX**: Non-technical users (radiologists) must be able to build algorithms without reading documentation
- **File Safety**: Snippets and sessions stored as plain files in vault — never silently deleted or overwritten by plugin updates

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Obsidian Canvas as algorithm storage | Leverages built-in visual editor; no custom graph renderer needed | ✓ Good — worked cleanly |
| File-based snippet storage (not plugin data) | Survives plugin reinstalls, easy to back up | ✓ Good — no issues |
| English-only UI for v1 | Standard for Obsidian Community; i18n adds complexity | ✓ Good |
| Hot-reload dev script | Eliminates manual build+copy friction during development | ✓ Good |
| Read-only Canvas contract during sessions | No official Canvas runtime API; never modify `.canvas` while open | ✓ Good — avoids overwrite race |
| TypeScript + esbuild + plain DOM | Standard Obsidian plugin toolchain; zero framework overhead | ✓ Good — keeps bundle small |
| Vitest for engine tests | Pure engine modules have no Obsidian imports; fully unit-testable | ✓ Good — fast, reliable |
| One-file-per-snippet storage | Minimizes `vault.modify()` race conditions and sync conflicts | ✓ Good |
| Discriminated union on `kind` for node types | Type-safe graph model; 7 node types | ✓ Good — zero runtime type errors |
| Snapshot undo stack | Simplest correct approach for step-back; protocol text is small (<5KB) | ✓ Good |
| `radiprotocol_*` property namespace | Avoids collisions with other plugins and future Obsidian updates | ✓ Good |
| Canvas write-back Strategy A (require canvas closed) | Simple and safe; avoids undocumented internals (A4 resolved) | ✓ Good — no version fragility |
| Session files in `.radiprotocol/sessions/` | Vault-visible, survives plugin reinstalls | ✓ Good |
| `WriteMutex` (async-mutex) per file path | Prevents race-condition corruption on snippet/session writes | ✓ Good — required fix in Phase 7 code review |
| `onLayoutReady` deferral for session restore | Prevents Obsidian startup hang on workspace restore | ✓ Good — caught in Phase 7 UAT |
| `capture-before-advance` pattern (BUG-01) | syncManualEdit() before each advance action — undo snapshot includes textarea edit | ✓ Good — simple, 4 call sites |
| `resolveSeparator(node)` single resolution point | node.radiprotocol_separator ?? defaultSeparator — avoids duplication across 5 call sites | ✓ Good |
| RunnerView reconstructs ProtocolRunner at openCanvas() | Picks up textSeparator from settings; no lazy init or observer needed | ✓ Good — mid-session setting change requires reopen (by design) |
| Live textarea read in complete-state toolbar | previewTextarea?.value ?? capturedText — honours final edits before copy/save/insert | ✓ Good — fixed stale closure bug |
| getCanvasJSON() for runner read path (Phases 17+) | Reads live in-memory canvas data; vault.read() retained only in EditorPanel form load | ✓ Good — BUG-02/03 resolved |
| Single injection point in `saveNodeEdits` for auto-coloring (Phase 28) | `enrichedEdits` spread at top of function — one fork-point before Pattern B / Strategy A; two-priority type resolution (edits first, then existing canvas node) | ✓ Good — eliminates color drift |
| BFS via `vault.adapter.list()` for snippet subfolder discovery (Phase 29) | Simple recursive directory walk, practical vault sizes don't need depth limit; visited set added post-review (WR-01) | ✓ Good |
| Pre-I/O path-safety gate in `SnippetService.listFolder` (Phase 30) | Rejects `..`, absolute paths, sibling-prefix matches before any disk access — defense-in-depth over vault adapter | ✓ Good |
| `awaiting-snippet-pick` as new runner state (Phase 30) | Routes through existing `awaiting-snippet-fill`/`completeSnippet` flow — no duplication; session serialize/restore support | ✓ Good |
| `returnToBranchList` flag on UndoEntry (Phase 31) | Step-back from open snippet picker returns to branch selection, not previous node — preserves user mental model | ✓ Good |
| Per-node `snippetLabel` + separator override on SnippetNode (Phase 31) | `v \|\| undefined` normalization; author can customize mixed-branch presentation per question | ✓ Good |
| `Snippet = JsonSnippet \| MdSnippet` discriminated union (Phase 32) | Extension-based routing in `listFolder`/`load`; single `kind` discriminant; no enum overhead | ✓ Good — clean type narrowing everywhere |
| `rewriteCanvasRefs` as standalone utility with WriteMutex (Phase 32) | Vault-wide canvas rewrite decoupled from SnippetService; prefix-match + exact-match + best-effort error handling | ✓ Good — reused by Phases 33 and 34 |
| `vault.trash()` instead of `vault.delete()` for snippet removal (Phase 32) | Obsidian trash is recoverable; permanent delete too destructive for user-authored content | ✓ Good — matches user expectation |
| Unified SnippetEditorModal for create + edit (Phase 33) | Single modal with mode flag; avoids duplicating JSON/MD toggle, folder dropdown, unsaved guard logic | ✓ Good — 548 lines, 3 entry points converge |
| 120ms debounced vault watcher with prefix filter (Phase 33) | Coalesces rapid vault events; ignores non-snippet paths; `registerEvent` auto-detach in `onClose` | ✓ Good — no leaks, no flicker |
| `parentElement` first, `.parent` mock fallback for DOM lookup (Phase 34) | Mock-only `.parent` silently breaks in real Obsidian; `parentElement` is the DOM standard | ✓ Good — caught in post-UAT fix 77b62c1 |
| File-level move/rename does NOT call `rewriteCanvasRefs` (Phase 34) | SnippetNode stores `subfolderPath` (folder), not filename — file moves are canvas-invisible by design (D-03) | ✓ Good — avoids unnecessary rewrites |
| MD snippet bypasses `handleSnippetFill` via direct `completeSnippet()` (Phase 35) | No placeholders to fill; content inserted verbatim; avoids `.json` suffix assumption in legacy path | ✓ Good — minimal change, 2-method edit |
| Knip for dead-code analysis (Phase 36) | Standard tool; clear unused-export reports; integrates with npm scripts | ✓ Good — 8 exports + 2 files safely removed |
| CSS flex `gap: var(--size-4-2)` for label-control row (Phase 36) | Replaces brittle margin hacks; uses Obsidian CSS variables for theme consistency | ✓ Good — fixed "ТипJSON" without breaking other modals |
| `rewriteCanvasRefs` updates both `radiprotocol_subfolderPath` AND `text` field (Phase 37) | UAT discovered canvas nodes kept showing old folder name after rename — text field is what the user sees | ✓ Good — same applyMapping, two targets |
| `CanvasNodeFactory` via Pattern B `createTextNode` internal API + runtime probing (Phase 38) | Pattern B is the only way to create nodes on live canvas; runtime probe guards against API removal in future Obsidian versions | ✓ Good — degrades gracefully with Notice |
| Factory sets `radiprotocol_nodeType` + `NODE_COLOR_MAP[kind]` at creation time (Phase 38) | Eliminates a post-creation color fixup; reuses Phase 28 color map | ✓ Good — no drift between creation and save |
| `onQuickCreate(kind)` in-memory `getData()` workaround instead of 150ms setTimeout (Phase 39) | `canvas.requestSave()` is async fire-and-forget; reading `result.canvasNode.getData()` directly bypasses stale-disk-read race | ✓ Good — no arbitrary timer, documented pattern |
| `registerDomEvent` instead of raw `addEventListener` for quick-create buttons (Phase 39 WR-01) | Obsidian lifecycle cleanup; caught in code review, not verification | ✓ Good — standard plugin pattern |
| `onDuplicate` copies only `radiprotocol_*` + `text`, factory handles ID/offset (Phase 40) | Single source of truth for node creation; duplicate is just create + property overlay | ✓ Good — 60 lines, zero edge logic |
| `rewriteCanvasRefs` hybrid live+disk with optional `CanvasLiveEditor` param + liveFailed fallback (Phase 41) | Live path for open canvases (no reopen needed); mid-iteration failure degrades to vault.modify() for entire file to avoid partial updates | ✓ Good — both paths covered by tests |
| Per-file WriteMutex around live canvas writes (Phase 41 WR-01/WR-03) | Prevents interleaved live writes on the same canvas; batch `saveLiveBatch` to minimize round-trips | ✓ Good — post-review fix |
| `queueMicrotask` + `pendingEdits` merge for re-entrant renderForm (Phase 42 WR-01/WR-02) | Stale closure + re-entrancy hazard when synchronous re-render fires from dropdown onChange | ✓ Good — defers re-render off the event stack |
| In-memory canvas fallback `canvas.nodes.get(id).getData()` in renderNodeForm (Phase 42) | Obsidian debounced save may not have flushed disk when freshly double-click-created node is selected; fallback reads live state | ✓ Good — fixed "Node not found in canvas" UAT gap |
| `setTimeout(0)` deferred `canvas.selection` read + `dblclick` listener (Phase 42 Plan 03) | Canvas-internal contract: selection updates AFTER pointer event; reading inside handler returns stale set | ✓ Good — auto-select on double-click works |
| `flex-wrap: wrap` + `row-gap` appended rule for responsive toolbar (Phase 42 Plan 04) | Narrow sidebar pushes Duplicate button off-screen; equal-specificity source-order cascade preserves Phase 39 defaults | ✓ Good — no regression at wide width |
| Break-compatibility over auto-migration for loop rework (Phase 43) | Auto-migration semantics ambiguous (which edge becomes «выход», how to collapse body); explicit author action safer than silent rewriting | ✓ Good — Migration Check gives plain-language rebuild instructions via existing error panel |
| Cyrillic edge label «выход» as loop exit discriminator (Phase 43) | Matches domain-authoring language; avoids a second special edge property | ✓ Good — 5-char case-sensitive; no collisions with body-branch labels in practice |
| `@deprecated` `LoopStartNode`/`LoopEndNode` kinds retained in `RPNodeKind` (Phase 43 D-CL-05b) | Migration Check enumerates legacy nodes via `nodeLabel()` — deletion would orphan the error path | ⚠️ Revisit — removal blocked until Migration Check can be rewritten to not require the kinds |
| `LoopContext.loopStartId → loopNodeId` rename with D-13 graceful-reject (Phase 43) | Rename eliminated confusing field name when unified node replaced two-node pair; D-13 guards legacy sessions without adding new load-path schema | ✓ Good — legacy sessions flow through existing missing-id path, RunnerView clears via `sessionService.clear()` |
| One-step picker (body labels + «выход» together) over two-step iterate-then-branch (Phase 44) | Simpler mental model; every iteration re-presents the same picker; matches how authors describe loops verbally | ✓ Good |
| B1 re-entry guard on `loopContextStack` top (Phase 44) | Handles both back-edge re-entry AND inner-«выход» landing on outer loop without pushing a second frame — one mechanism, two concerns | ✓ Good — verified by RUN-04 nested tests |
| B2 `previousCursor` threading through `advanceThrough` (Phase 44) | Step-back from picker must restore predecessor (or loop node itself if no predecessor) — symmetric `canStepBack` across all picker states | ✓ Good |
| `maxIterations` retired entirely (RUN-07, Phase 44) | Author responsibility, not engine policy; `ProtocolRunner.maxIterations` RUN-09 cycle guard preserved separately | ✓ Good — no per-loop or global cap in v1.7 |
| Kind-order sort in NodePickerModal: question → loop → text-block → snippet (Phase 45) | Semantic priority: questions drive most protocols, loops are structural, text-blocks/snippets are leaves | ✓ Good |
| `start-from-node` command without plugin prefix (Phase 45 NFR-06) | Bare id per Obsidian convention; prefix would produce `radiprotocol:radiprotocol-start-from-node` collision | ✓ Good — confirmed by integration checker |
| TypeScript exhaustiveness as free-text-input excision forcing function (Phase 46) | `Record<RPNodeKind, string>` + switch exhaustiveness finds every residual reference mechanically; grep sweeps are fallible | ✓ Good — 16 residual matches bounded to 4 intentional sites |
| Fixture retention with semantic-role flip (Phase 46 D-46-01-C) | Kept `free-text.canvas` byte-identical but flipped role from happy-path to CLEAN-02 rejection proof; satisfies ROADMAP SC#4 "removed or rewritten" via rewrite path | ✓ Good — avoids churn in git history, preserves audit trail |
| Parser-level rejection reuses existing MIGRATE-02 surface (Phase 46 CLEAN-02) | `{ success: false; error }` contract from Phase 43 already rendered by RunnerView `renderError` — no new UI path | ✓ Good — cross-phase contract preserved |
| Loop exit edge = sole labeled edge (Phase 49) | Matches domain-authoring language; avoids a second special edge property | ⚠️ Revisit — superseded by "+"-prefix convention (Phase 50.1) |
| Loop exit "+"-prefix convention (Phase 50.1) | `+` prefix distinguishes exit from labeled body edges; resolves Phase 49↔50 conflict | ✓ Good — clean separation from `isLabeledEdge` |
| Inline mode = floating modal over active note (Phase 54) | Command-palette only; note-as-buffer; append to end; source-note binding | ✓ Good — additive to sidebar/tab modes |
| File-bound Snippet = button click → direct insert (Phase 56) | Reversed Phase 51 D-13 auto-insert; directory-bound = button→picker | ✓ Good — user UAT preference |

## Evolution

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-21 — v1.8 UX Polish & Snippet Picker Overhaul milestone shipped*
