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

### Active (Next Milestone)

- [ ] Canvas selector dropdown in runner view — choose protocol without reopening command
- [ ] Full-tab runner view — open as editor tab instead of sidebar panel
- [ ] Protocol authoring documentation / example canvases for community submission
- [ ] Community plugin submission checklist (README, LICENSE, manifest review, plugin review)
- [ ] Node templates — save frequently-used node structures for reuse
- [ ] Configurable output destination: insert into current note

### Out of Scope

- AI/LLM-generated text — manual algorithm authoring only; not in v1
- PACS/RIS direct integration — clipboard/note output is sufficient for v1
- Mobile support (Obsidian mobile) — desktop-first; mobile later
- Multi-user / shared vaults — single-user local vault only for v1
- Version history for snippets — file system handles backups
- Linked placeholders across report sections — deferred after core snippet system validated
- Optional sections in snippets — deferred to v2
- Automatic impression generation — requires NLP/AI

## Context

- Shipped v1.0 with 7 phases, 28 plans, ~43K LOC across TypeScript + planning docs
- Tech stack: TypeScript + Obsidian Plugin API + esbuild + Vitest
- Target: public release on Obsidian Community Plugins
- Primary author: radiologist (CT focus), designed for all imaging modalities
- All 7 phases human-UAT approved; loop and session features verified end-to-end
- All engine code (parser, runner, snippets, sessions) has zero Obsidian imports and is fully unit-testable

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

## Evolution

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-07 after v1.0 milestone*
