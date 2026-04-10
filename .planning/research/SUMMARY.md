# Research Summary — v1.3 Node Editor Overhaul & Snippet Node

**Project:** RadiProtocolObsidian
**Domain:** Obsidian community plugin — canvas-driven medical imaging protocol runner
**Researched:** 2026-04-10
**Confidence:** HIGH (all four research areas verified against official Obsidian API source or direct codebase inspection)

---

## Executive Summary

v1.3 is a focused overhaul of the node editing experience combined with a new Snippet node type. The milestone performs a net-positive refactor: it removes one node type (free-text-input), simplifies another (text-block loses snippet insertion), retires a runner state (awaiting-snippet-fill), deletes the dirty-guard modal, and adds a cleaner replacement path for dynamic content insertion via the dedicated Snippet node. All four research areas — auto-save debounce, canvas color coding, snippet node, and drag-and-drop placeholder reordering — are solved using existing Obsidian built-ins or native browser APIs. No new runtime dependencies are needed.

The recommended implementation approach follows a strict layered order: remove dead code first (free-text-input, text-block snippet logic, awaiting-snippet-fill state), then build the color infrastructure, then extend the graph/runner layer with the snippet node type, then wire the UI. This order minimises the blast radius of changes to the RPNodeKind discriminated union and ensures each layer is testable in isolation before the next is added. Three previously made product decisions shape the requirements directly: node colors are fully plugin-controlled (always overwrite on type assignment), free-text-input in existing canvases degrades silently to text-block behaviour (no parse errors), and the in-textarea chip overlay is deferred in favour of drag-to-reorder of the placeholder list.

The dominant risk category is correctness at transition points: the auto-save debounce must capture node identity at schedule time (not fire time) to prevent cross-node data corruption; the unmark path must explicitly clear node.color or stale colors will persist on plain canvas cards; the awaiting-snippet-fill session state must be treated as stale on load and cleared rather than resumed; and free-text-input nodes in existing canvases must be silently skipped by the parser rather than errored. Each of these is well-understood and preventable with explicit requirements and a targeted UAT case.

---
## Key Findings

### Recommended Stack

No version bumps and no new packages. Every v1.3 capability maps directly to an already-present API or native browser primitive. HTML5 Drag-and-Drop handles placeholder chip reordering (dragstart/dragover/drop on the stable container via event delegation); FuzzySuggestModal<TFile> handles the snippet file picker (same pattern as the existing NodePickerModal); workspace.revealLeaf() handles programmatic tab switching (already used in main.ts); and palette string color writes to node.color flow through the existing CanvasLiveEditor.saveLive() once the color field is removed from PROTECTED_FIELDS.

**Core technologies (all existing — no additions):**
- TypeScript 6.0.2 — language
- obsidian npm 1.12.3 — plugin API types and runtime
- esbuild 0.28.0 — bundler
- Vitest ^4.1.2 — unit test runner
- Native HTML5 Drag-and-Drop API — zero-cost chip reorder; no library needed

### Expected Features

**Must have (table stakes):**
- Snippet node type visible in runner as a button (consistent with answer-button UX)
- File picker scoped to configured folder (unusable in large vaults without scoping)
- .json files route to existing SnippetFillInModal; .md files insert raw content
- Auto-save debounce on all node editor fields (no Save button means auto-save is the only save path)
- Canvas node color set automatically on type assignment; cleared on unmark
- Drag-to-reorder placeholder cards in SnippetManagerView (changes draft.placeholders[] order = changes SnippetFillInModal tab order)
- Graceful degradation: free-text-input in existing canvas files silently treated as text-block (no validator errors, no parse failures)

**Should have (differentiators):**
- Per-node snippet folder override (radiprotocol_snippetFolder) in addition to global snippetNodeFolderPath setting
- Display label on snippet runner button (buttonLabel field, falls back to file name)
- Auto-switch to Node Editor tab when canvas node is clicked (via workspace.revealLeaf())
- Transient inline Saved indicator after auto-save (no Notice() toast)
- Color update when node type changes, not just on first assignment

**Defer (post-v1.3):**
- In-textarea chip overlay for placeholder editor — HIGH complexity, fragile in Electron, marginal gain; DEFERRED PER PRODUCT DECISION
- Nested folder picker for snippet node — flat list from configured folder is sufficient for v1
### Architecture Approach

The existing architecture is a clean layered graph: pure modules (graph-model, canvas-parser, graph-validator, protocol-runner) with zero Obsidian imports sit below the canvas API layer (canvas-live-editor) which sits below Obsidian views and modals. v1.3 extends this without changing the boundary rules. New files: src/canvas/node-color-map.ts (pure constant, no Obsidian imports, immediately Vitest-testable) and src/views/snippet-picker-modal.ts (extends FuzzySuggestModal<TFile>). Deleted file: src/views/node-switch-guard-modal.ts (dirty guard replaced by auto-save). The awaiting-snippet-fill runner state is fully retired — removed from RunnerState union, protocol-runner.ts, and runner-view.ts. Snippet execution now lives entirely in the at-node halt + chooseSnippet() call pattern, keeping the runner state machine minimal.

**Major components and their v1.3 changes:**

1. graph-model.ts — add SnippetNode interface + snippet to RPNodeKind; remove FreeTextInputNode and free-text-input from union; remove snippetId from TextBlockNode
2. canvas-parser.ts — add snippet parse case; add DEPRECATED_KINDS silent-skip for free-text-input; remove snippetId from text-block case
3. protocol-runner.ts — add chooseSnippet(); add snippet halt case in advanceThrough(); remove enterFreeText(), completeSnippet(), awaiting-snippet-fill state, snippetId/snippetNodeId fields
4. editor-panel-view.ts — replace pendingEdits + Save button with debounced auto-save; remove NodeSwitchGuardModal call; add snippet form fields; apply color on type change; call revealLeaf() on node click
5. canvas-live-editor.ts — remove color field from PROTECTED_FIELDS Set (line 14); same change required in editor-panel-view.ts line 181
6. runner-view.ts — add snippet case to at-node render; add handleSnippetNodeClick(); remove handleSnippetFill()
7. snippet-manager-view.ts — add drag-to-reorder on placeholder list (event delegation on container, not per-chip listeners)
8. settings.ts — add snippetNodeFolderPath: string

**Critical architecture note: PROTECTED_FIELDS has two copies.** One in canvas-live-editor.ts (line 14) and one in editor-panel-view.ts (line 181). Both must be updated in the same phase or color writes silently fail on whichever save path uses the stale copy.

### Critical Pitfalls

1. **Auto-save debounce captures node identity at fire time, not schedule time** — if the user switches nodes before the timer fires, old node edits are silently written to the new node ID. Fix: scheduleAutoSave(filePath, nodeId, edits) must close over argument values, never over this.currentNodeId. This is the first design decision in the auto-save phase.

2. **Unmark path does not clear node.color** — isUnmarking removes all radiprotocol_* fields but currently leaves color set. A formerly-typed node reverts to an unmarked canvas card with a stale type color. Requirements must explicitly mandate: unmark path sets node.color = undefined.

3. **free-text-input removal breaks existing sessions and canvas files** — nodes with this type in existing canvases silently disappear from the parsed graph; sessions with currentNodeId pointing to one fail to resume. Fix: parser keeps a DEPRECATED_KINDS silent-skip set; session resume checks graph.nodes.has(currentNodeId) before restoring.

4. **awaiting-snippet-fill sessions become unresumable after retirement** — persisted sessions carrying this runnerStatus value are invalid in v1.3. Session load must treat unknown runnerStatus values as stale and start fresh (same code path as missing node IDs).

5. **Auto-save callback references stale DOM after node switch** — the callback is async (saveLive awaits); during the await, a node switch may destroy the form DOM. The callback must check this.currentNodeId === savedNodeId after the await before touching any DOM element.

6. **vault.modify conflict with pending requestSave debounce** — confirmed forum-reported Obsidian bug: vault.modify() within the 500ms requestSave debounce window silently fails or gets overwritten. For color coding: if isLiveAvailable() returns false, skip the color write entirely rather than falling through to Strategy A.

---
## Implications for Roadmap

Based on combined research, the build order must respect the layered architecture. Pure-model changes come before runner changes; runner changes come before view changes. Removals come before additions to keep the RPNodeKind union clean and TypeScript exhaustive-switch checks helpful.

### Phase 1: Housekeeping Removals

**Rationale:** Shrinks the surface area before adding the Snippet node. Every file touched for the new Snippet node also touches free-text-input and awaiting-snippet-fill removal — doing removals first means a single coherent diff per file.
**Delivers:** Clean codebase with no dead node type, no dead runner state, no dirty-guard modal. Parser silently skips legacy free-text-input nodes. Sessions with retired state values cleared gracefully.
**Addresses:** Table-stakes graceful degradation; product decision on free-text-input silent skip
**Avoids:** Pitfall 5 (free-text-input removal breaks existing canvases/sessions); Pitfall 12 (stale snippetId on text-block nodes)
**Files:** graph-model.ts, canvas-parser.ts, protocol-runner.ts, runner-state.ts, runner-view.ts, editor-panel-view.ts, graph-validator.ts; delete node-switch-guard-modal.ts
**Research flag:** Standard patterns — no deeper research needed

### Phase 2: Color Infrastructure

**Rationale:** Pure constant with zero UI risk. Validates that color writes through saveLive() before any UI or Snippet node work depends on it. Both PROTECTED_FIELDS copies must be updated atomically in this phase.
**Delivers:** src/canvas/node-color-map.ts; color field removed from both PROTECTED_FIELDS copies; Vitest coverage confirming color writes succeed.
**Addresses:** Canvas node auto-color; product decision that color is fully plugin-controlled (always overwrite)
**Avoids:** Pitfall 3 (vault.modify conflict — live path only; skip color write if live unavailable); Pitfall 8 (live path required — graceful skip with one-time Notice)
**Files:** new src/canvas/node-color-map.ts; canvas-live-editor.ts (line 14); editor-panel-view.ts (line 181) — both updated together
**Research flag:** Standard patterns — no deeper research needed

### Phase 3: Snippet Node — Graph and Runner Layer

**Rationale:** Extend the model before wiring any UI. Adding snippet to RPNodeKind triggers TypeScript exhaustive-switch errors that must be resolved before UI work starts. Running tsc --noEmit immediately after the union change is the first task.
**Delivers:** SnippetNode interface; parser produces SnippetNode from canvas JSON; runner halts at snippet nodes in at-node state; chooseSnippet() appends text and advances; undo works across snippet choices.
**Addresses:** Snippet node type (core graph/runner layer)
**Avoids:** Pitfall 10 (exhaustive switch gaps — compile check is first task); Pitfall 9 (unsafe file read — vault.read(TFile) only)
**Files:** graph-model.ts, canvas-parser.ts, graph-validator.ts, protocol-runner.ts
**Research flag:** Standard patterns — FuzzySuggestModal and vault.read(TFile) already proven in codebase

### Phase 4: Node Editor Auto-Save + Color-on-Type-Change

**Rationale:** Auto-save and color-on-type-change share the EditorPanelView.onChange pipeline. Building them together avoids touching that pipeline twice. Auto-save must be stable before Snippet node form fields are added.
**Delivers:** Debounced auto-save (800-1000ms, no Save button); inline Saved indicator; node.color written on type assignment and cleared on unmark; Snippet node form fields (buttonLabel, snippetFolder, separator).
**Addresses:** Auto-save table-stakes; color coding on type change; product decisions that colors are always overwritten and unmark clears color
**Avoids:** Pitfall 1 (wrong node saved — snapshot node ID at schedule time, never this.currentNodeId); Pitfall 2 (timer cancel policy — let timer fire, captured snapshot is correct); Pitfall 11 (stale DOM — check currentNodeId after async save returns)
**Files:** editor-panel-view.ts (primary)
**Research flag:** Standard patterns — debounce timer closure capture requirement is explicit in PITFALLS.md

### Phase 5: Settings — Snippet Node Folder

**Rationale:** Required before Snippet node UI can be tested end-to-end. Simple isolated change with safe migration path.
**Delivers:** snippetNodeFolderPath setting with default matching existing snippet folder path; Settings UI entry.
**Addresses:** Global folder setting for snippet file picker
**Avoids:** Pitfall 15 (settings migration — default falls back via existing Object.assign pattern in main.ts)
**Files:** settings.ts
**Research flag:** Standard patterns — no research needed
### Phase 6: Snippet Node Runner UI

**Rationale:** Runner UI depends on Phase 3 (graph/runner model) and Phase 5 (settings). SnippetPickerModal follows the FuzzySuggestModal<TFile> + Promise-wrapping pattern already used for ResumeSessionModal.
**Delivers:** Runner shows Choose snippet button at snippet nodes; SnippetPickerModal opens with correct scoped folder; .json routes to SnippetFillInModal; .md routes to vault.read() raw content insert; text appended; undo reverts snippet choice. syncManualEdit() called before chooseSnippet() (BUG-01 fix pattern).
**Addresses:** Snippet node runner integration; per-node folder override; .md vs .json dispatch; product decision on folder precedence (per-node over global)
**Avoids:** Pitfall 9 (unsafe file read — vault.read(TFile) only, no fs or adapter.read)
**Files:** new src/views/snippet-picker-modal.ts; runner-view.ts
**Research flag:** Standard patterns — FuzzySuggestModal already proven in this codebase

### Phase 7: Auto-Switch to Node Editor Tab

**Rationale:** Isolated three-line change in handleNodeClick() with one timing constraint. Deferred until after Phase 4 auto-save work so handleNodeClick() is not touched in overlapping phases.
**Delivers:** Clicking a canvas node while Runner tab is active brings Editor tab to front; if Editor panel is not open, creates it first.
**Addresses:** Auto-tab-switch differentiator feature
**Avoids:** Pitfall 7 (revealLeaf timing race — setTimeout(0) inside click handler; must not use deprecated workspace.activeLeaf)
**Files:** editor-panel-view.ts (handleNodeClick only)
**Research flag:** Standard patterns — revealLeaf is documented public API

### Phase 8: Interactive Placeholder Editor (Drag-to-Reorder)

**Rationale:** Fully independent of all other phases. No model changes, no runner changes. Scoped entirely to SnippetManagerView. Can be parallelised with Phases 5-7.
**Delivers:** Drag-to-reorder of placeholder cards in SnippetManagerView; reordering changes draft.placeholders[] array order; SnippetFillInModal tab order changes accordingly. In-textarea chip overlay NOT included — deferred per product decision.
**Addresses:** Drag-and-drop placeholder reorder; product decision on scope (list reorder only, not in-textarea)
**Avoids:** Pitfall 6 (event listener leak — event delegation on stable container, one listener not per-chip); Pitfall 13 (dragover performance — only preventDefault() in dragover handler)
**Files:** src/views/snippet-manager-view.ts
**Research flag:** Standard patterns — HTML5 DnD is MDN-documented; event delegation pattern is explicit in PITFALLS.md

### Phase Ordering Rationale

- **Removals before additions:** RPNodeKind exhaustive-switch errors are easier to reason about one change at a time. Removing dead code first keeps TypeScript errors signal-rich during Phase 3 union extension.
- **Color infrastructure before Snippet node UI:** validates the saveLive() color write path before the Snippet node depends on it for type-color assignment on first use.
- **Auto-save before Snippet node form fields:** the Snippet node form fields live inside the auto-save onChange pipeline; that pipeline must be stable first.
- **Settings before Runner UI:** snippetNodeFolderPath must be readable by the time SnippetPickerModal resolves folder scope.
- **revealLeaf last:** handleNodeClick() is touched in Phase 4; adding revealLeaf in a late separate phase avoids re-touching the same method in overlapping phases.

### Research Flags

All phases use well-documented patterns. No phase requires a /gsd-research-phase run.

The one MEDIUM-confidence finding (Pitfall 3: vault.modify + requestSave race — forum report only) is fully mitigated: skip color writes when live path is unavailable.

---
## Product Decisions (Pre-Resolved — Must Appear in Requirements)

These decisions were made before research and must be codified as hard requirements, not design options:

1. **Canvas node colors are fully plugin-controlled.** When radiprotocol_nodeType is written, color is always overwritten with the plugin color map value. No ownership flag, no user-color preservation, no opt-in setting.

2. **free-text-input nodes in existing canvas files are silently treated as text-block.** Parser keeps a DEPRECATED_KINDS silent-skip set that returns null for these nodes (no parse error, no user-facing message). Sessions referencing such nodes are cleared and start fresh.

3. **In-textarea chip overlay is deferred.** Scope for v1.3 is drag-and-drop reordering of placeholder cards in the list only. The reorder changes draft.placeholders[] array order, which is the complete and correct effect (drives SnippetFillInModal tab order).

4. **Snippet node file picker:** global snippetNodeFolderPath setting plus per-node radiprotocol_snippetFolder override. Supports .md (plain text insert, no modal) and .json (routes to SnippetFillInModal). Per-node override takes precedence. If neither is set, show a configuration notice rather than opening a root-vault picker.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All APIs verified against official obsidian-api source; HTML5 DnD from MDN; no new dependencies |
| Features | HIGH | Verified against direct codebase read at commit 5308b1d plus official Obsidian API docs |
| Architecture | HIGH | Derived entirely from direct source code inspection; all file paths and line numbers confirmed |
| Pitfalls | HIGH (mostly) | 14 of 15 pitfalls HIGH confidence; Pitfall 3 (vault.modify race) is MEDIUM — forum report only; prevention avoids the race entirely |

**Overall confidence:** HIGH

### Gaps to Address

- **awaiting-snippet-fill session handling:** The session load path in RunnerView.openCanvas() must be updated to treat unknown runnerStatus values as stale. This is not currently guarded. Requirements must include this as an explicit acceptance criterion with a UAT case using a pre-v1.3 session file.

- **syncManualEdit() before chooseSnippet():** ARCHITECTURE.md notes that chooseSnippet() needs the same runner.syncManualEdit() call that chooseAnswer() call sites already have (BUG-01 fix pattern). Requirements must carry this forward explicitly.

- **Color ownership resolved by product decision:** PITFALLS.md raised three options for handling user-set colors. Product decision chose always-overwrite. Requirements must state this explicitly so implementers do not re-introduce an ownership flag.

---

## Sources

### Primary (HIGH confidence)
- github.com/obsidianmd/obsidian-api — obsidian.d.ts (revealLeaf, FuzzySuggestModal, vault.getFiles, TFile.extension), canvas.d.ts (CanvasColor, CanvasNodeData.color)
- github.com/axtonliu/axton-obsidian-visual-skills/.../canvas-spec.md — canvas color palette 1-6 mapping confirmed
- deepwiki.com/obsidianmd/obsidian-api/4.1-canvas-system — palette colors adapt to theme; hex is fixed
- docs.obsidian.md/Reference/TypeScript+API/FuzzySuggestModal — FuzzySuggestModal public API
- docs.obsidian.md/Reference/TypeScript+API/Workspace/revealLeaf — revealLeaf public API
- developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API — DnD event lifecycle
- Direct codebase inspection at commit 5308b1d — all file paths, line numbers, and integration points

### Secondary (MEDIUM confidence)
- forum.obsidian.md — vault.modify + requestSave debounce race condition (forum report, not official docs; prevention avoids the race)
- github.com/obsidianmd/obsidian-releases review PRs 2025-2026 — workspace.activeLeaf deprecated; canvas:node-menu tolerated

### Tertiary (context, not implementation guidance)
- design.gitlab.com/patterns/saving-and-feedback/ — auto-save debounce timing guidance (800-1000ms range)
- docs.unity3d.com — node color conventions for type coding (confirmatory)

---

*Research completed: 2026-04-10*
*Ready for roadmap: yes*