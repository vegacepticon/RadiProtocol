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

### Active (v1.4)

- [ ] Auto-color canvas nodes by type on save — always overwrite color when `radiprotocol_nodeType` is written (EditorPanel + programmatic canvas creation)
- [ ] New "snippet" node type — 8th node kind; EditorPanel form with subfolder picker; Runner presents snippet list with subfolder navigation; SnippetFillInModal for placeholders; supports terminal or non-terminal graph position

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

## Current Milestone: v1.4 Snippets and Colors, Colors and Snippets

**Goal:** Автоматическая раскраска узлов канваса по типу и новый тип узла для динамического выбора сниппетов в Protocol Runner.

**Target features:**
- Auto-color nodes by type — color written on every save based on `radiprotocol_nodeType`, always overwrite
- New "snippet" node type — subfolder-scoped snippet picker in Runner with SnippetFillInModal integration

## Context

- Shipped v1.0 (7 phases, 28 plans) + v1.2 (8 phases, 11 plans) + v1.3 (1 phase, 1 plan); ~7K LOC TypeScript in src/
- Tech stack: TypeScript + Obsidian Plugin API + esbuild + Vitest
- Target: public release on Obsidian Community Plugins
- Primary author: radiologist (CT focus), designed for all imaging modalities
- All phases human-UAT approved; 8/8 v1.2 UAT tests passed in live Obsidian
- All engine code (parser, runner, snippets, sessions) has zero Obsidian imports and is fully unit-testable
- Known tech debt: Nyquist VALIDATION.md missing for phases 12–19; pre-existing TS errors in editor-panel-view.ts; dead CSS (.rp-legend*); 3 RED test stubs in runner-extensions.test.ts

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

## Evolution

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-13 — milestone v1.4 started*
