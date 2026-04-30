# Pitfalls Research

**Domain:** Obsidian plugin -- v1.6 features: programmatic canvas node creation, dead code cleanup, path sync, UI fixes
**Researched:** 2026-04-16
**Confidence:** HIGH (based on codebase analysis of existing Pattern B/Strategy A implementation + community knowledge)

## Critical Pitfalls

### Pitfall 1: Node ID Collision on Programmatic Canvas Node Creation

**What goes wrong:**
Creating new canvas nodes with non-unique IDs causes silent data corruption. Obsidian canvas uses node IDs as edge endpoints (`fromNode`/`toNode`). A duplicate ID means edges connect to the wrong node, `getData()` returns unpredictable results, and canvas rendering breaks silently -- no error, just wrong behavior.

**Why it happens:**
There is no official Canvas API for node creation. The plugin must generate IDs when injecting nodes into the JSON. Developers use incrementing counters, timestamps, or short random strings that collide.

**How to avoid:**
Use `crypto.randomUUID()` (available in all Obsidian-supported Electron versions) or replicate Obsidian's 16-char lowercase hex ID format. Verify uniqueness against existing `canvasData.nodes` IDs before insertion. Never use sequential counters.

**Warning signs:**
Edges pointing to wrong nodes after creation; duplicate node IDs in `.canvas` JSON; nodes "stacking" visually.

**Phase to address:**
Canvas node creation phase (programmatic node buttons in node editor sidebar).

---

### Pitfall 2: Race Condition Between vault.modify() and Canvas Auto-Save (Strategy A Violation on Node Creation)

**What goes wrong:**
Strategy A requires the canvas to be closed before writing via `vault.modify()`. For node creation, if the canvas is open, `vault.modify()` writes to disk but the in-memory canvas state overwrites the file on its next auto-save cycle (within ~2 seconds). The newly created node silently disappears.

**Why it happens:**
Obsidian's Canvas View holds an in-memory copy and auto-saves periodically. `vault.modify()` updates the file but NOT the in-memory state. The in-memory state (without the new node) wins on the next save. This is the same race documented in the existing pitfalls but now applies to a NEW use case: adding nodes, not just editing existing node properties.

**How to avoid:**
For node creation with canvas OPEN, use Pattern B exclusively: `getData()` to get current data, add new node to the `nodes` array, `setData()` to push back, then `requestSave()`. For canvas CLOSED, Strategy A is safe. The existing `CanvasLiveEditor.isLiveAvailable()` check determines which path -- reuse this same fork logic. The `saveNodeEdits` method in `EditorPanelView` already implements this fork correctly for edits; the node creation code must follow the same pattern.

**Warning signs:**
Nodes appear momentarily then vanish on canvas reload; nodes exist in JSON but not in canvas view.

**Phase to address:**
Canvas node creation phase. Must implement the same Pattern B / Strategy A fork that `saveNodeEdits` already uses.

---

### Pitfall 3: Dead Code False Positive -- Removing Obsidian API Callbacks and Event Handlers

**What goes wrong:**
During dead code cleanup, static analysis and manual grep flag Obsidian API callbacks as "unused" because they are only referenced via registration patterns: `this.registerEvent(app.workspace.on('active-leaf-change', ...))`, `this.addCommand({ callback: ... })`, `this.registerDomEvent(el, 'click', ...)`. Removing these causes silent feature breakage -- no compile error, no runtime error, just missing functionality.

**Why it happens:**
Obsidian's plugin lifecycle uses registration-based patterns where callbacks are passed as arguments to framework methods. The callback has zero call sites in plugin code -- it is only called by Obsidian internals. Standard "find all references" misses them. The codebase has ~18.7K LOC with numerous such registrations across `main.ts`, `editor-panel-view.ts`, `runner-view.ts`, `snippet-manager-view.ts`.

**How to avoid:**
Before removing ANY function or method, verify it is not:
1. Passed to `this.registerEvent()`, `this.registerDomEvent()`, `this.addCommand()`, `this.registerView()`
2. An override of an Obsidian base class method (`onOpen`, `onClose`, `getState`, `setState`, `onload`, `onunload`)
3. Called from within a callback registered in any of the above
4. Referenced in test files (removing source code without updating tests breaks CI)

Use a two-pass approach: first flag candidates, then manually verify each one is not transitively reachable from any registration site.

**Warning signs:**
Features that "stop working" after cleanup with no compile errors; event handlers that no longer fire; views that fail to restore state on restart.

**Phase to address:**
Dead code audit phase -- must be the FIRST phase in v1.6 so subsequent phases build on a clean codebase.

---

### Pitfall 4: Dead Code Removal Breaks Append-Only CSS Rule

**What goes wrong:**
The project has a strict "append-only per phase" CSS rule (CLAUDE.md). Dead CSS cleanup (e.g., removing `.rp-legend*` rules listed as known dead in PROJECT.md) can accidentally remove CSS still in use if the developer greps for class usage in TypeScript but misses classes applied via Obsidian's DOM, `Setting` API, or third-party themes.

**Why it happens:**
CSS class names may be referenced in: (a) TypeScript `createEl`/`createDiv` calls, (b) Obsidian's internal DOM for `Setting` components, (c) third-party themes targeting plugin classes, (d) canvas node `color` styling. Grepping `.ts` files alone misses (b), (c), and (d). The `styles.css` is generated from `src/styles/` -- removing rules from source files is permanent.

**How to avoid:**
For each CSS class targeted for removal:
1. Grep all `.ts` files for the class name
2. Check if any Obsidian API (`Setting`, `Modal`, `ItemView`) generates elements with that class
3. The `.rp-legend*` classes are confirmed dead (LAYOUT-04 in Phase 22 removed the legend; PROJECT.md lists them as known dead CSS) -- safe to remove
4. When uncertain, comment out, build, and test visually in the dev vault before deleting
5. Run the build after any CSS change to regenerate `styles.css`

**Warning signs:**
UI elements losing styling after cleanup; layout shifts; elements appearing unstyled.

**Phase to address:**
Dead code audit phase.

---

### Pitfall 5: Node Position Overlap on Programmatic Creation

**What goes wrong:**
Creating nodes at fixed coordinates (e.g., 0,0) or at the same offset causes nodes to stack on top of existing nodes. Overlapping nodes cannot be individually selected in the canvas UI. Users report "nodes disappeared" when they actually stacked.

**Why it happens:**
Unlike Obsidian's native "Add card" which uses viewport-aware placement, programmatic creation via `setData()` or `vault.modify()` has no access to the layout engine. The developer picks arbitrary coordinates without checking for overlaps.

**How to avoid:**
When creating a node relative to a selected node, offset by at least `selectedNode.width + 40` horizontally or `selectedNode.height + 40` vertically. For duplicate operations, offset by (+30, +30) from the source. If Pattern B is available, read existing node positions from `getData()` and check for overlaps. Document offset constants for future tuning.

**Warning signs:**
Canvas JSON showing nodes at identical coordinates; users unable to select new nodes.

**Phase to address:**
Canvas node creation phase and duplicate node phase.

---

### Pitfall 6: rewriteCanvasRefs Race with Open Canvas (Directory Rename Path Sync)

**What goes wrong:**
`rewriteCanvasRefs` uses `vault.read()` + `vault.modify()` to rewrite snippet node `subfolderPath` across all `.canvas` files. If a canvas is currently open, the in-memory state does NOT reflect the `vault.modify()` write. The open canvas auto-saves its stale state, overwriting the path fix. Broken `subfolderPath` values persist.

**Why it happens:**
The current `rewriteCanvasRefs` does not check whether each canvas is open before modifying it. This was acceptable in v1.5 because rename/move operations from the snippet manager typically happened while the user was focused on the snippet tree, not actively editing canvas in a split view. But v1.6 adds a new trigger: directory rename from the snippet editor, which is more likely to happen alongside an open canvas.

**How to avoid:**
Two options (choose one):
1. **Hybrid approach:** For each canvas being rewritten, check `CanvasLiveEditor.isLiveAvailable(canvasPath)`. If live, use Pattern B (`getData()` -> mutate -> `setData()` -> `requestSave()`). If closed, use existing `vault.read()`/`vault.modify()`.
2. **Accept limitation:** Document that "Close canvas files before renaming snippet folders" and show a Notice if open canvases are detected. This is simpler and matches the existing Strategy A contract.

Option 2 is recommended for v1.6 -- it is simpler, matches existing behavior, and the edge case (renaming folder while canvas is open) is rare.

**Warning signs:**
Canvas shows old snippet folder paths after a folder rename; snippet nodes point to nonexistent folders after rename.

**Phase to address:**
Path sync on directory rename phase.

---

### Pitfall 7: Duplicate Node Missing radiprotocol_* Fields or Creating Invalid Edge State

**What goes wrong:**
When duplicating a node, copying only visible properties (text, color) but missing `radiprotocol_*` custom fields results in a plain canvas node, not a RadiProtocol node. Separately, naively duplicating edges creates edges pointing to/from the original node ID, not the duplicate.

**Why it happens:**
Canvas nodes have two layers of data: standard fields (`id`, `x`, `y`, `width`, `height`, `type`, `text`, `color`) and custom `radiprotocol_*` fields. A developer who reads the standard canvas spec but not the RadiProtocol property namespace will miss the custom fields. Edge duplication is architecturally ambiguous -- there is no "right" answer for what edges a duplicate should have.

**How to avoid:**
For duplication, iterate ALL keys on the source node and copy them to the new node, excluding only `id` (generate new), `x`, `y` (offset from source). This automatically captures current and future `radiprotocol_*` fields without maintaining a whitelist. For edges: do NOT duplicate edges in v1.6. The mental model is "copy this node's settings" not "clone its graph position." Add tooltip: "Duplicates node settings. Connections are not copied."

**Warning signs:**
Duplicated nodes appearing as plain canvas nodes (no color, no type); edges connecting to wrong nodes after duplication.

**Phase to address:**
Duplicate node phase.

---

### Pitfall 8: "Tип JSON" Spacing Fix Applied Inconsistently

**What goes wrong:**
The "ТипJSON" -> "Тип JSON" spacing fix is applied in one code path (e.g., create modal) but the same string appears in other paths (edit modal, type badge). The bug appears fixed in testing but users encounter it in a different UI flow.

**Why it happens:**
The string may be constructed in multiple places: the `SnippetEditorModal` create path, the edit path, and any type badge/label renderer. A developer fixes the most visible instance and misses others.

**How to avoid:**
Grep the entire codebase for the Cyrillic string "Тип" and all variations ("ТипJSON", "ТипMD", "Тип JSON"). Fix all occurrences. Better: extract the label into a constant or helper function so it is defined once.

**Warning signs:**
Fix works in create modal but not in edit modal, or vice versa.

**Phase to address:**
UI fixes phase (small task, any phase).

---

### Pitfall 9: Folder Create Button Without Vault Watcher Integration

**What goes wrong:**
Adding a "create folder" button in the snippet editor that calls `vault.adapter.mkdir()` but the tree UI does not update because the vault watcher does not fire for `mkdir()` calls, or fires but the debounce window causes a visible lag.

**Why it happens:**
The existing vault watcher (Phase 33) listens for `vault.on('create'/'delete'/'rename')` events with a 120ms debounce. `vault.adapter.mkdir()` may or may not trigger a `create` event (it depends on Obsidian's internal event routing for folders vs files). If it does not fire, the tree shows stale state.

**How to avoid:**
After `vault.adapter.mkdir()`, explicitly trigger a tree refresh rather than relying on the vault watcher. Use the same `refreshTree()` method the watcher calls, but invoke it directly after the mkdir succeeds. The watcher remains as a safety net for external changes.

**Warning signs:**
Folder created on disk but not visible in tree until user navigates away and back; empty-state message remains after creating the first folder.

**Phase to address:**
Snippet editor folder button phase.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-coded node position offsets for creation/duplication | Quick implementation | Nodes overlap in cramped canvases | v1.6 -- revisit if users report overlap issues |
| Node creation via Strategy A only (require canvas closed) | Avoids Pattern B complexity for creation | Users must close canvas to use sidebar creation buttons | Never -- Pattern B is proven and already implemented; Strategy A-only for creation is too restrictive for the UX goal |
| Skipping WriteMutex for canvas writes during node creation | Slightly faster | Race condition if two rapid creations fire | Never -- WriteMutex is already in the codebase and trivial to use |
| Dead code audit without running test suite after each removal | Faster cleanup | Removing code that tests depend on breaks CI silently | Never -- run `npm test` after each batch of removals |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Pattern B `setData()` for node creation | Adding node to old `getData()` snapshot after another edit occurred -- loses the other edit | Call `getData()` immediately before `setData()`; minimize window between read and write |
| `rewriteCanvasRefs` + open canvas | Modifying canvas via `vault.modify()` while open -- auto-save overwrites | Accept limitation and warn user, or use Pattern B for open canvases |
| Snippet editor folder button + vault watcher | Relying on vault watcher to detect `mkdir()` | Explicitly refresh tree after `mkdir()`; watcher is backup |
| Node editor creation buttons + no canvas context | Buttons enabled when `currentFilePath` is null | Check `currentFilePath` and `currentNodeId`; disable buttons with tooltip when no canvas context |
| `CanvasLiveEditor.saveLive()` for new node creation | Using `saveLive()` which finds node by ID -- new node has no ID in canvas yet | Cannot use `saveLive()` for creation; must build new `getData()`/`setData()` flow or extend `CanvasLiveEditor` with a `createNode()` method |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Calling `getData()` repeatedly for bulk creation | Canvas re-serializes entire JSON on each call | Batch: call once, add all nodes, call `setData()` once | Canvases with 500+ nodes |
| `rewriteCanvasRefs` scanning all canvas files on every rename | Noticeable lag in large vaults | Already has early-exit on no-match; acceptable at current scale | Vaults with 500+ canvas files |
| Dead code grep scanning entire `node_modules` | Audit takes minutes instead of seconds | Scope grep to `src/` only | Always -- never scan node_modules |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Node creation buttons visible but disabled without explanation when no canvas is open | User clicks repeatedly, nothing happens | Disabled state with tooltip: "Open a canvas to create nodes" |
| "Duplicate" copies node but user expects it to appear adjacent | Duplicate at arbitrary position, user cannot find it | Offset +30/+30 from source; consider brief visual feedback |
| Folder create in snippet editor creates folder but user does not see it | "Did it work?" confusion | Explicit tree refresh + auto-expand parent + scroll to new folder |
| Dead code cleanup changes behavior silently | "Feature X stopped working" after update | Full UAT after dead code phase before proceeding |

## "Looks Done But Isn't" Checklist

- [ ] **Node creation via Pattern B:** Often missing `requestSave()` after `setData()` -- node appears in UI but lost on canvas close/reopen
- [ ] **Node creation Strategy A fallback:** Often missing the Pattern B attempt first -- creates nodes only when canvas is closed, breaking the UX when canvas is open
- [ ] **Node duplication:** Often missing `radiprotocol_*` field copy -- duplicate appears as plain node without type/color
- [ ] **Dead code removal:** Often missing test file updates -- tests import removed functions, CI breaks
- [ ] **Dead code removal:** Often missing the "transitively used via callback" check -- function looks unused but is passed to `registerEvent()`
- [ ] **Path sync on rename:** Often missing prefix-match case -- direct subfolder paths update but nested paths do not (already handled by `applyMapping` but verify for new triggers)
- [ ] **Folder create button:** Often missing empty-state dismissal -- creating first folder does not update "no folders" message
- [ ] **"Tип JSON" fix:** Often fixed in one modal path but not the other (create vs edit)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Node ID collision | MEDIUM | Parse canvas JSON, find duplicates, regenerate one ID, fix edge references |
| Auto-save overwrites vault.modify() | LOW | Close and reopen canvas -- file on disk is correct |
| Dead code false positive (removed callback) | LOW | Git revert the specific deletion, re-add the callback |
| Overlapping nodes | LOW | Manually drag apart in canvas, or edit JSON coordinates |
| Broken snippet folder paths | MEDIUM | Re-run `rewriteCanvasRefs` with all canvases closed |
| Duplicate missing radiprotocol fields | LOW | Open duplicate in Node Editor, re-set the node type -- auto-color will apply |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Dead code false positives (P3) | Dead code audit (Phase 1 of v1.6) | `npm test` passes; full manual UAT of all features |
| Dead CSS regression (P4) | Dead code audit (Phase 1 of v1.6) | Build succeeds; visual check of all UI panels |
| Node ID collision (P1) | Canvas node creation phase | Unit test: create 100 nodes, assert all IDs unique |
| Strategy A race on creation (P2) | Canvas node creation phase | Create node with canvas open (Pattern B) and closed (Strategy A); verify persistence across reload |
| Node overlap (P5) | Canvas node creation + duplication phase | Create/duplicate next to existing node; verify no overlap |
| rewriteCanvasRefs race (P6) | Path sync on rename phase | Rename folder while canvas open; verify paths update (or warning shown) |
| Duplicate missing fields (P7) | Duplicate node phase | Duplicate a typed node; verify duplicate has correct radiprotocol_* fields and color |
| "Тип JSON" inconsistency (P8) | UI fixes phase | Check both create and edit modals |
| Folder button no refresh (P9) | Snippet editor folder button phase | Create folder; verify tree updates without manual refresh |

## Sources

- Codebase analysis: `src/canvas/canvas-live-editor.ts` (Pattern B implementation), `src/views/editor-panel-view.ts` (Strategy A/Pattern B fork in `saveNodeEdits`), `src/snippets/canvas-ref-sync.ts` (`rewriteCanvasRefs` implementation), `src/types/canvas-internal.d.ts` (internal API type declarations)
- [Obsidian Canvas API type definitions](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) -- official; no runtime API for node creation
- [Obsidian Forum: Canvas API discussion](https://forum.obsidian.md/t/any-details-on-the-canvas-api/57120) -- confirms no public Canvas manipulation API
- [Obsidian Forum: Creating canvas programmatically](https://forum.obsidian.md/t/creating-a-canvas-programmatically/101850)
- [obsidian-advanced-canvas](https://github.com/Developer-Mike/obsidian-advanced-canvas) -- community reference for Pattern B usage
- [Canvas System DeepWiki](https://deepwiki.com/obsidianmd/obsidian-api/4.1-canvas-system) -- data schema documentation
- PROJECT.md -- known dead code (`.rp-legend*`, RED test stubs), Strategy A decision rationale, Pattern B history
- CLAUDE.md -- append-only CSS rule, build constraints

---
*Pitfalls research for: RadiProtocol v1.6 -- Canvas node creation, dead code cleanup, path sync, UI fixes*
*Researched: 2026-04-16*
