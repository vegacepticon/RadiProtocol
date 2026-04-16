# RadiProtocol

## What This Is

An Obsidian community plugin that turns Canvas files into interactive protocol generators for medical imaging reports (CT, X-ray, MRI, Ultrasound). The user builds a question-and-answer algorithm visually on the Obsidian Canvas, then runs it through the plugin's protocol runner — which steps through questions, assembles the report text piece by piece, supports dynamic snippets with fill-in placeholders, repeating loops for multi-lesion workflows, and saves/resumes sessions across Obsidian restarts.

## Core Value

A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code to build that algorithm.

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

### Active

## Current Milestone: v1.6 Polish & Canvas Workflow

**Goal:** Clean up dead code, fix UI bugs, add snippet editor improvements, and accelerate canvas authoring with programmatic node creation from the node editor sidebar.

**Target features:**
- Dead code audit and cleanup across the entire project
- Fix "ТипJSON" → "Тип JSON" spacing in snippet create/edit modal
- Create folder button in snippet editor (next to create snippet)
- Sync canvas node path when directory is renamed in snippet editor
- Canvas API research + quick node creation buttons in node editor sidebar
- Duplicate node with preserved settings

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

**Shipped:** v1.5 Snippet Editor Refactoring (2026-04-16)
**Current milestone:** v1.6 Polish & Canvas Workflow

## Context

- Shipped v1.0 (7 phases, 28 plans) + v1.2 (8 phases, 11 plans) + v1.3 (1 phase, 1 plan) + v1.4 (4 phases, 12 plans) + v1.5 (4 phases, 18 plans); ~18.7K LOC TypeScript in src/
- Tech stack: TypeScript + Obsidian Plugin API + esbuild + Vitest
- Target: public release on Obsidian Community Plugins
- Primary author: radiologist (CT focus), designed for all imaging modalities
- All phases human-UAT approved; v1.5 milestone audit passed 34/34 requirements, 4/4 phases, 20/20 integration, 5/5 flows
- All engine code (parser, runner, snippets, sessions) has zero Obsidian imports and is fully unit-testable
- 356 tests passing (26 test files), build green
- Known tech debt: Nyquist VALIDATION.md draft for phases 12–19, 28–31, and 32–35; dead CSS (.rp-legend*); 3 RED test stubs in runner-extensions.test.ts (Phase 26); Node Editor stale subfolderPath display after folder move/rename (cosmetic); chip editor labels in English (Phase 27 legacy)

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

## Evolution

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-16 — v1.6 milestone started*
