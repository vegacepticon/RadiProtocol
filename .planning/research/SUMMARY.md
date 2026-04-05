# Project Research Summary

**Project:** RadiProtocol
**Domain:** Obsidian community plugin — Canvas-based interactive medical protocol/report generator
**Researched:** 2026-04-05
**Confidence:** MEDIUM-HIGH overall (HIGH for toolchain, plugin API patterns, and graph algorithms; MEDIUM for Canvas runtime behavior and RadiProtocol-specific design decisions that have no direct precedent)

---

## Executive Summary

RadiProtocol is a genuinely novel product in the Obsidian ecosystem. The closest analogs — ZettelFlow (canvas-as-workflow) and Cannoli (canvas-as-LLM-pipeline) — prove the canvas-as-directed-graph pattern is viable, but neither addresses the core problem: a non-technical domain expert building an interactive Q&A decision tree that assembles structured text. On the commercial side, RadioReport and rScriptor validate the market need for structured radiology reporting (RadioReport cuts breast MRI reporting time from 35 to 10 minutes), but they are proprietary, expensive, and closed. RadiProtocol's value proposition is the combination: visual canvas authoring accessible to individual radiologists, plus an interactive runner that produces clipboard-ready report text — open-source, local, and free.

The recommended implementation approach is a strict layered architecture that separates pure engine logic (canvas parsing, graph traversal, state machine, snippet processing) from all Obsidian API contact. The engine layer is fully unit-testable with Vitest and has no Obsidian runtime dependency. The Obsidian layer is thin: ItemViews that render engine state and call engine methods in response to user interaction, plus vault adapter wrappers for file I/O. This separation is not just a testing convenience — it is the primary defense against Obsidian's undocumented Canvas API and against the pattern of tight coupling that makes Obsidian plugins brittle across updates.

The single biggest risk is the absence of an official Canvas runtime API. Obsidian exposes the `.canvas` JSON format (the published JSON Canvas spec) but provides no programmatic way to interact with an open Canvas view. The correct mitigation is absolute: RadiProtocol must be read-only with respect to canvas files during a protocol session. Parse the file once at session start, build an in-memory graph model, run the session entirely against that model, and never write back to the canvas file. All plugin-specific metadata (node types, snippet references, loop markers) is stored as `radiprotocol_`-namespaced custom properties directly in the canvas JSON, which the spec explicitly supports. This read-only contract, combined with strict input validation before every run, eliminates the two highest-severity pitfalls identified in research.

---

## Key Findings

### Recommended Stack

The toolchain is non-negotiable and well-established: TypeScript + esbuild using the official `obsidian-sample-plugin` scaffold, with `eslint-plugin-obsidianmd` (already included in the 2026 template) enforcing community review requirements from day one. The tsconfig deliberately omits `"strict": true` as an umbrella flag — the Obsidian plugin class pattern (fields initialized in `onload()`, not the constructor) conflicts with `strictPropertyInitialization`. Individual strict checks are enabled manually.

For the UI layer, plain DOM manipulation using Obsidian's `createEl`/`createDiv`/`createSpan` helpers is recommended for v1. The plugin's UI surface — a runner panel, an editor side panel, and a settings tab — is entirely manageable with DOM helpers. Adding React costs ~44 KB gzipped with no benefit at this scale. Svelte (~2-5 KB) is the documented upgrade path if reactive component complexity grows in v2, particularly for the snippet manager's live-preview UI. For testing, Vitest targeting only the `src/engine/` directory (zero Obsidian imports) is the practical choice; `jest-environment-obsidian` was last updated in May 2023 and is effectively abandoned.

**Core technologies:**
- **TypeScript 5.8 + esbuild 0.28**: official scaffold, compiles to single `main.js` — no alternative exists for community plugins
- **Plain DOM + Obsidian helpers (`createEl`)**: zero bundle cost, security-compliant (no `innerHTML`), idiomatic — upgrade to Svelte if v2 complexity warrants
- **Vitest 4.1**: unit tests for pure engine modules only; Obsidian-touching code verified manually against a test vault
- **eslint-plugin-obsidianmd**: enforces 27 rules covering review rejections, memory leaks, and idiom violations — run from day one
- **async-mutex**: per-file write queue to prevent `vault.modify()` race conditions on snippet/session files
- **pjeby/hot-reload** (v0.3.0, actively maintained): standard hot-reload dev workflow
- **minAppVersion 1.5.7**: required for `onExternalSettingsChange()` support

### Expected Features

**Must have — table stakes (v1 must-ship):**
- One-question-at-a-time runner with preset answer buttons — the core promise; every clinical decision-tree tool does this
- Live protocol preview showing accumulating report text — radiologists need to see output forming; non-negotiable
- Free-text input fields alongside preset buttons — escape hatch for findings that cannot be enumerated
- Step back / undo last answer — must revert both navigation state AND accumulated text (the tricky part)
- Output to clipboard (primary) + output to new note (Obsidian-native) — one click each
- Canvas node types: start, question, answer, free-text-input, text-block — minimum semantic vocabulary
- Node color coding using `radiprotocol_`-namespaced canvas properties — visual differentiation without breaking native canvas
- Configurable output destination in settings

**Should have — differentiators (v1 if time allows):**
- Dynamic snippets with placeholder fill-in (choice + free-text types) — the "killer feature"; bridges VS Code snippet power with radiologist-friendly UX; no Obsidian plugin does this
- Side panel for node configuration (no raw JSON editing) — discoverability and speed; Modal Form plugin shows users expect this
- Start from any node — useful for re-running protocol sections

**Defer to v2:**
- Visual loop nodes (repeat sections for multi-lesion protocols) — highest complexity; needs loop context stack and iteration UX
- Mid-session save/resume — valuable for clinical interruptions but needs full session serialization model
- Snippet manager UI — snippets can be JSON files edited manually in v1
- Node templates (reusable structures)
- Linked placeholders across report sections
- Optional sections in snippets

**Explicit anti-features (do not build):**
- AI/LLM text generation — Cannoli fills that niche; radiologists need traceable output
- PACS/RIS integration — out of scope for v1 and v2; clipboard output is the established workaround
- Code/expression syntax in nodes — radiologists are not programmers; visual configuration only
- Mobile support — canvas authoring on mobile is unsupported; desktop-first

### Architecture Approach

The architecture follows a strict two-layer separation: a pure engine layer (`src/graph/`, `src/runner/`, `src/snippets/`, `src/sessions/`) with no Obsidian API imports, testable in isolation with Vitest; and a thin Obsidian adapter layer (`src/views/`, `src/main.ts`) that handles lifecycle, vault I/O, and DOM rendering. The `RadiProtocolPlugin` class in `main.ts` acts as a service locator — instantiating services (`CanvasParser`, `SnippetService`, `SessionService`) in `onload()` and passing `this` to views which access services through the plugin reference. This avoids circular dependencies while keeping wiring simple for a single-developer plugin. State flows unidirectionally: user action in View → runner method → state update → view re-render; vault events are not used to sync runner state.

**Major components:**
1. **CanvasParser** (`graph/canvas-parser.ts`) — pure module, no Obsidian dep; reads canvas JSON string → typed `ProtocolGraph` (Map-based adjacency list for O(1) node lookup)
2. **GraphValidator** (`graph/graph-validator.ts`) — pure; validates start node, reachability, cycles, loop pairing, dead ends; runs before every session start
3. **ProtocolRunner** (`runner/protocol-runner.ts`) — stateful traversal engine; discriminated union state machine (`idle` | `at-node` | `awaiting-snippet-fill` | `complete` | `error`); includes `TextAccumulator` (append-only with full snapshots for undo) and undo stack
4. **SnippetService** (`snippets/snippet-service.ts`) — CRUD for per-snippet JSON files in vault; uses write mutex; supports placeholder types: free-text, choice, multi-choice, number
5. **SessionService** (`sessions/session-service.ts`) — auto-saves `PersistedSession` after each step; validates node IDs and canvas mtime on resume; snapshots snippet content at save time
6. **RunnerView** (`views/runner-view.ts`) — ItemView in right sidebar; renders current node UI; implements `getState()`/`setState()` with session ID only (not full state)
7. **EditorPanelView** (`views/editor-panel-view.ts`) — ItemView side panel for node configuration; writes to canvas JSON (requires canvas to be closed or undocumented API with version guards)
8. **WriteMutex** (`utils/write-mutex.ts`) — per-file async lock using `async-mutex`; prevents concurrent `vault.modify()` calls on the same snippet/session file

### Critical Pitfalls

1. **No official Canvas runtime API — forced read-only approach**: Obsidian exposes the canvas file format but provides no API for interacting with an open Canvas view. Any attempt to modify a canvas file while it is open in the Canvas view will be silently overwritten when the Canvas view auto-saves its in-memory state. Mitigation: parse the canvas file once at session start via `vault.read()`, build a graph model in memory, run the session against the model, never call `vault.modify()` on a canvas file that is currently open. The side panel editor must either require the canvas to be closed first, or accept the maintenance burden of undocumented API access with explicit version guards and try/catch.

2. **Canvas file overwrites plugin changes**: If `vault.modify()` is called on an open canvas file, the Canvas view will overwrite the changes without warning. Mitigation: always check whether a canvas leaf of that file is open before writing; if so, prompt the user to close it first.

3. **Infinite loops from user-built cyclic protocols**: Users can accidentally (or intentionally) create cycles that do not have a proper exit condition. Naive traversal will hang the UI. Mitigation: three-color DFS cycle detection during validation before every run; hard iteration cap (default 50, configurable) on loop nodes; clear error messages in plain language for non-technical users.

4. **`vault.modify()` race conditions**: Auto-save and manual save could fire concurrently on the same session or snippet file, causing silent data corruption. Mitigation: `WriteMutex` with `async-mutex` wrapping every file write; one-file-per-snippet to reduce contention scope.

5. **Community review rejections**: `innerHTML`, `console.log`, `any` types, `require('fs')`, improper command naming, and unhandled promises are all automated rejection causes. Mitigation: configure `eslint-plugin-obsidianmd` plus additional ESLint rules (`no-console`, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-floating-promises`, `no-restricted-syntax` for innerHTML) from the first commit. These rules pay for themselves many times over.

---

## Implications for Roadmap

Based on the combined research, the natural phase structure follows hard dependencies: you cannot run a protocol before you can parse a canvas; you cannot validate before you have a graph model; you cannot render the runner before you have traversal; and the differentiating features (snippets, loops, sessions) layer on top of a working core.

### Phase 1: Project Scaffold and Canvas Parsing Foundation

**Rationale:** Everything else depends on being able to read a `.canvas` file and produce a typed, validated graph model. This phase has no Obsidian runtime dependencies in the pure engine modules, so it can be built and fully tested before touching ItemViews or the Obsidian lifecycle. Establishing the ESLint configuration and test infrastructure here prevents accumulating technical debt that is expensive to fix later.

**Delivers:** Working plugin scaffold (commands registered, settings tab, ribbon icon); `CanvasParser` producing `ProtocolGraph` from canvas JSON; `GraphValidator` with all six validation checks; Vitest suite for graph and validation modules; `WriteMutex` utility.

**Addresses:** Canvas node type differentiation, namespaced `radiprotocol_*` properties, start node requirement.

**Avoids:** Canvas file corruption (read-only from the start), community review rejections (ESLint from day one), `workspace.activeLeaf` deprecation.

**Research flag:** Standard patterns — skip phase research.

### Phase 2: Core Protocol Runner

**Rationale:** The runner state machine is the product's core value. It must be built and tested in isolation before any UI is added, because the UI depends on the runner's discriminated union states being correct. Step-back is more complex than it appears (must revert both navigation and accumulated text), and building it in isolation with unit tests is far safer than discovering the edge cases after the UI is wired.

**Delivers:** `ProtocolRunner` state machine covering all five states; `TextAccumulator` with snapshot-based undo; step-forward and step-back working correctly for question/answer and free-text-input nodes; full Vitest coverage of runner transitions including loop enter/exit.

**Addresses:** One-question-at-a-time runner, preset answer buttons, free-text input, step back/undo, live text accumulation.

**Avoids:** Infinite loop hang (max iteration cap built in from the start), snapshot vs. diff undo confusion (snapshots are correct for this use case).

**Research flag:** Standard patterns — skip phase research.

### Phase 3: Runner UI (ItemView)

**Rationale:** With the runner engine unit-tested, the UI layer is a rendering concern: map runner states to DOM updates. Plain DOM with Obsidian helpers is the right tool here. The most important invariant is that the View never owns state — it reads from the runner and calls runner methods.

**Delivers:** `RunnerView` ItemView in right sidebar rendering all node types; `getState()`/`setState()` with session ID; output to clipboard; output to new note; validation error display before run; settings tab with output destination configuration.

**Addresses:** Live protocol preview, output to clipboard and new note, configurable output destination, validation feedback, node color coding legend.

**Avoids:** ItemView state loss on workspace restore (implement `getState`/`setState` immediately), memory leaks (use `registerDomEvent` exclusively), `innerHTML` usage (use `createEl` throughout).

**Research flag:** Standard patterns for ItemView and settings tab — skip phase research. DOM rendering of the runner-specific UI (step-back button behavior, answer button layout) may benefit from lightweight phase research.

### Phase 4: Canvas Node Editor Side Panel

**Rationale:** Without this, users must edit raw canvas JSON to set `radiprotocol_*` properties, which violates the core design principle ("authoring must feel like visual design, not programming"). This phase enables protocol authoring. It comes after the runner because the side panel's field schema is derived directly from the runner's node type definitions — and those must be stable before building the editing UI.

**Delivers:** `EditorPanelView` with per-node-kind forms; write-back to canvas JSON (with canvas-closed guard or undocumented API approach — this decision needs user confirmation); node type selection; context menu integration for canvas nodes.

**Addresses:** Canvas-based algorithm authoring UX, node type differentiation without raw JSON editing.

**Avoids:** Canvas file corruption from writing while the Canvas view is open (requires explicit guard); temptation to use undocumented Canvas runtime APIs without version guards.

**Research flag:** Needs phase research. The side panel's write-back to canvas files is the most architecturally uncertain area. Whether to (a) require the canvas be closed before editing, (b) detect and use undocumented Canvas view internals, or (c) use a separate metadata file is an open design question that needs a decision before implementation.

### Phase 5: Dynamic Snippets

**Rationale:** Snippets are the differentiating feature that makes RadiProtocol compelling beyond a simple decision tree. They depend on the runner (snippets are triggered by `TextBlockNode` with a `snippetId`), on the vault file I/O infrastructure (one-file-per-snippet with write mutex), and on a fill-in UI that must integrate into the runner flow. This phase delivers the VS Code-style placeholder experience within the context of a running protocol.

**Delivers:** `SnippetService` with full CRUD; per-snippet JSON files in `.radiprotocol/snippets/`; all four placeholder types (free-text, choice, multi-choice, number); `SnippetFillInModal` with tab-navigation and live preview; runner integration (`awaiting-snippet-fill` state); basic snippet creation via settings or command palette.

**Addresses:** Dynamic snippets with placeholders (the v1 differentiator), `TextBlockNode` with snippet references, radiology variable types (laterality, measurements, classifications).

**Avoids:** Raw placeholder syntax visible to users (always render as labeled input fields), no free-text escape hatch (always allow override on choice fields), write mutex on snippet files (race condition prevention).

**Research flag:** The snippet fill-in UI pattern within an ItemView context (modal vs. inline panel) would benefit from a focused implementation spike before the full phase. Standard placeholder data model — skip research on that part.

### Phase 6: Loop Support

**Rationale:** Loop nodes are the most complex feature in the codebase. They require loop context stack management in the runner, a paired loop-start/loop-end node model, iteration tracking in the undo stack, and a specific UX for "loop again / done" prompts. Deferring this to its own phase, after snippets are stable, isolates the complexity.

**Delivers:** `LoopStartNode` and `LoopEndNode` support in parser, validator, and runner; loop context stack with correct undo behavior; iteration counter display ("Lesion #2"); exit-condition button; max-iteration safeguard; validation for orphaned loop-end nodes and loops without exit edges.

**Addresses:** Visual loop nodes, multi-lesion protocols, repeat-section pattern in radiology reporting.

**Avoids:** Infinite loop hang (max iterations + exit condition required), incorrect undo across loop boundaries (loop context must be snapshot in undo entries), accidental cycles vs. intentional loops (three-color DFS distinguishes them).

**Research flag:** Loop UX — specifically the "loop again?" decision point and how accumulated text from multiple iterations is formatted — has no direct Obsidian precedent. Needs phase research or a focused design spike before implementation.

### Phase 7: Mid-Session Save and Resume

**Rationale:** Auto-save adds significant value in clinical settings where interruptions are common. It depends on a stable runner state model (phases 2-3), stable snippet data model (phase 5), and mature session serialization. Building this after the core is stable ensures the serialization model reflects the final state structure, not a moving target.

**Delivers:** `SessionService` with auto-save after each step; `PersistedSession` JSON serialization; resume-session prompt on protocol launch; validation on resume (canvas mtime check, node ID existence check, snippet version check); graceful degradation when the canvas has changed between save and resume.

**Addresses:** Mid-session save/resume (v2 differentiator), `ItemView.getState()`/`setState()` wired to session IDs.

**Avoids:** Stale node ID references on resume (validate all IDs before resuming), snippet content drift (snapshot snippet content at save time, not just ID), `Set` serialization errors (convert to Array for JSON).

**Research flag:** Standard persistence patterns — skip phase research. The canvas-mtime change detection and graceful degradation logic are RadiProtocol-specific but well-reasoned from research.

### Phase Ordering Rationale

- Phases 1-2 establish the pure engine (parseable, traversable graph) before any Obsidian UI work. This means the most testable, most correctness-critical code is written and verified in isolation.
- Phase 3 adds the minimum viable UI on top of a verified engine. At this point the plugin is demonstrable end-to-end.
- Phase 4 (node editor) enables protocol authoring, which is the prerequisite for real-world use. It comes before snippets because users need to be able to build basic protocols before they need snippet references.
- Phase 5 (snippets) is the primary differentiator and is gated on both a working runner (to trigger snippets) and a working editor (to attach snippet IDs to nodes).
- Phases 6-7 (loops, sessions) are genuine v2 features that require a stable foundation. Their architectures are fully designed in research but the implementation complexity justifies isolation.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Canvas Node Editor):** The write-back strategy to canvas files is the most undocumented area in the Obsidian ecosystem. The three options (require closed, use undocumented internals, separate metadata file) have meaningfully different tradeoffs that require a targeted investigation or implementation spike before committing.
- **Phase 6 (Loop Support):** The "loop again / done" UX and the text formatting of multi-iteration output have no established precedent in Obsidian plugins. A design spike showing the flow for a 3-lesion protocol would surface edge cases before implementation.

Phases with standard patterns (skip research):
- **Phase 1:** Scaffold, esbuild config, ESLint setup, and JSON Canvas parsing are fully documented.
- **Phase 2:** Graph traversal, state machines, and undo stacks are standard computer science patterns with abundant reference material.
- **Phase 3:** ItemView lifecycle, `getState`/`setState`, settings tabs, and DOM-based UI are well-documented in the Obsidian API and community resources.
- **Phase 5 (snippet data model):** Placeholder types and snippet file structure are directly adapted from VS Code snippets and TextExpander patterns (both HIGH confidence).
- **Phase 7:** Session persistence serialization is standard; the Obsidian-specific parts are covered by research.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official sample plugin scaffold verified against npm registry 2026-04-05; all package versions confirmed; ESLint plugin rule set verified against GitHub source |
| Features | MEDIUM-HIGH | Table stakes features backed by multiple commercial analogs (RadioReport, rScriptor, CLICKVIEW) and Obsidian ecosystem precedents (ZettelFlow, Cannoli, Modal Form); differentiators are reasoned from gap analysis with no direct precedent |
| Architecture | HIGH | Plugin class patterns verified against DeepWiki and mature plugin source code (Obsidian Gemini, ZettelFlow, Cannoli); Canvas JSON format verified against jsoncanvas.org spec; graph/state machine patterns are standard |
| Pitfalls | MEDIUM-HIGH | Canvas API pitfalls confirmed by forum threads, Advanced Canvas plugin architecture, and DeepWiki; community review requirements verified against eslint-plugin-obsidianmd rule set; some Canvas behavior (custom property preservation across major upgrades) is MEDIUM confidence due to limited precedent |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Canvas side panel write-back strategy**: The three options (require canvas closed, undocumented internals, separate metadata file) are identified but not decided. This is the highest-priority open question before Phase 4 planning. Recommendation: prototype all three in a spike and choose based on user feedback on friction vs. simplicity.

- **`minAppVersion` selection**: Research recommends `"1.5.7"` for `onExternalSettingsChange()`. Confirm no other required API (e.g., specific vault or workspace methods) requires a higher minimum before writing `manifest.json`.

- **Svelte 5 compatibility with Obsidian lifecycle**: If Svelte is chosen for v2 UI work, the rune-based reactivity system (`$state`, `$derived`) has not been validated against Obsidian's `onOpen`/`onClose` component lifecycle pattern. The official docs were written for Svelte 4. Verify with an Obsidian + Svelte 5 example before committing.

- **Loop node UX confirmation**: The `loop-start`/`loop-end` paired-node design and the two-outgoing-edges convention (`continue` / `exit`) is a RadiProtocol-specific design decision flagged as an assumption in ARCHITECTURE.md. Validate this with the intended user before Phase 6 begins.

- **Custom property round-trip preservation**: The JSON Canvas spec allows extra keys, but there is no guarantee Obsidian's canvas editor preserves them across major version upgrades. This is a MEDIUM-confidence risk. Mitigation (namespace all properties, validate after round-trip) is defined, but should be explicitly tested against Obsidian Insider builds early in development.

---

## Sources

### Primary (HIGH confidence)
- `github.com/obsidianmd/obsidian-sample-plugin` — official scaffold, verified package.json, tsconfig.json, esbuild.config.mjs
- `npm registry` — all package versions verified 2026-04-05
- `jsoncanvas.org/spec/1.0/` — complete canvas data model and extensibility contract verified
- `github.com/pjeby/hot-reload` — maintenance status verified (v0.3.0, August 2025)
- `github.com/mProjectsCode/eslint-plugin-obsidianmd` — all 27 rules verified
- `deepwiki.com/obsidianmd/obsidian-api` — plugin development patterns, Canvas system, event system
- `deepwiki.com/allenhutchison/obsidian-gemini` — plugin-as-service-locator pattern
- `forum.obsidian.md/t/any-details-on-the-canvas-api/57120` — confirmed no official Canvas runtime API
- `forum.obsidian.md/t/how-to-correctly-open-an-itemview/60871` — ItemView activation pattern
- `radioreport.com` — commercial structured reporting analog (10 min vs 35 min for breast MRI)

### Secondary (MEDIUM confidence)
- `github.com/RafaelGB/Obsidian-ZettelFlow` — canvas-as-workflow pattern; root node convention
- `github.com/DeabLabs/cannoli` — canvas-as-directed-graph; color prefix conventions; core/plugin separation
- `github.com/Developer-Mike/obsidian-advanced-canvas` — canvas event limitations; monkey-patch pattern for canvas extension
- `pmc.ncbi.nlm.nih.gov/articles/PMC8921035/` — European Radiology systematic review: structured reporting adoption barriers (inflexibility is #1 reason)
- `radelement.org/about/` — RSNA/ACR Common Data Elements; structured reporting tiers
- `nngroup.com/articles/wizards/` — wizard UX guidelines (step-back, progress, validation)
- `code.visualstudio.com/docs/editing/userdefinedsnippets` — snippet placeholder syntax and tab-stop patterns
- `textexpander.com/learn/using/snippets/snippet-fill-ins` — fill-in types including optional sections
- `forum.obsidian.md/t/confused-about-the-setviewstate-and-state-management-of-the-itemview-class/66798` — ItemView state management
- `github.com/SilentVoid13/Templater/issues/1629` — vault.modify() race condition documentation

### Tertiary (LOW confidence — not independently verified)
- `obsimian` (github.com/motif-software/obsimian) — integration testing framework for Obsidian; limited coverage
- `obsidian-plugin-cli` npm package — alternative dev workflow tool; maintenance status unverified for 2026
- `scriptorsoftware.com` (rScriptor) — adaptive structured reporting; adaptive impression generation
- `clickview.com` (CLICKVIEW 9i) — voice-activated structured reporting tiles

---

*Research completed: 2026-04-05*
*Ready for roadmap: yes*
