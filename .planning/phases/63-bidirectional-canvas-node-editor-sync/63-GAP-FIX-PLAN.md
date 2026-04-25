# Gap Fix Plan — Phase 63 (Revised v2)

> Checker revision v2 — addresses blocker (RPNode.text preservation) and warning (snippet edge filter symmetry).

---

## Gap 1: Snippet branch label outbound does not update edge labels

### Root Cause
`editor-panel-view.ts` `saveNodeEdits` has a dedicated path for `radiprotocol_displayLabel` (Answer nodes) that calls `collectIncomingEdgeEdits` to update all incoming Question→Answer edge labels in the same batch. There is no equivalent path for `radiprotocol_snippetLabel` (Snippet nodes). When the user edits the Snippet branch label in the Node Editor, only the node property is updated; the incoming Question→Snippet edge labels remain unchanged. The Phase 63 reconciler then runs with edge-wins semantics, sees the mismatch, and overwrites `snippetLabel` back to the old edge label, causing the observed "revert on blur" behavior.

### Fix
1. **Add `collectIncomingSnippetEdgeEdits` helper** in `src/canvas/edge-label-sync-service.ts`, symmetric to the existing `collectIncomingEdgeEdits` export:
   - Parse the canvas JSON with `CanvasParser`.
   - Find the snippet node by `nodeId`.
   - Filter edges where `toNodeId === nodeId` (no source-kind filter — matches existing answer path and reconciler semantics).
   - Return `Array<{ edgeId: string; label: string | undefined }>` with the new snippet label.

2. **Extend `saveNodeEdits` in `src/views/editor-panel-view.ts`**:
   - After the `isDisplayLabelEdit` block, add `isSnippetLabelEdit = 'radiprotocol_snippetLabel' in enrichedEdits`.
   - If true, call `collectIncomingSnippetEdgeEdits(parser, canvasContent, filePath, nodeId, newSnippetLabel)` and pass the resulting `edgeEdits` to `saveLiveBatch` alongside the node edits.
   - Re-use the same live-json / disk-read fallback already present for displayLabel.

3. **Test coverage**:
   - Add a test in `src/__tests__/views/editor-panel-canvas-sync.test.ts` (or a new file) that verifies: after `saveNodeEdits` with `radiprotocol_snippetLabel`, the canvas JSON contains the updated label on the incoming Question→Snippet edge.

### Acceptance Criteria
- Editing Snippet branch label in Node Editor updates the incoming edge label on canvas within one autosave debounce (~750 ms).
- Reconciler no longer reverts the snippetLabel because edge and node are now consistent.
- Existing Answer displayLabel outbound path remains untouched.
- Build stays green.

---

## Gap 2: Canvas node text edits do not sync inbound to form fields

### Root Cause
`EdgeLabelSyncService` builds a per-filePath `lastSnapshotByFilePath` baseline that diffs canonical node fields (`questionText`, `answerText`, `content`, `headerText`, `snippetLabel`, `displayLabel`). These fields are parsed from `radiprotocol_*` properties, with `text` as a fallback only when `radiprotocol_*` is absent. When a user edits the node text directly on the Obsidian canvas, Obsidian updates the generic `text` property but leaves `radiprotocol_*` unchanged. Because the snapshot diffs the canonical fields (which are unchanged), no `fieldUpdates` dispatch is emitted, so the open Node Editor form never receives the new text.

### Prerequisites already applied
- `graph-model.ts`: `text?: string` added to `RPNodeBase`.
- `canvas-parser.ts`: `text: typeof raw.text === 'string' ? raw.text : undefined` added to the shared `base` object so every parsed node carries the raw Obsidian `text`.

### Fix
1. **Extend `NodeFieldsSnapshot` in `src/canvas/edge-label-sync-service.ts`** to include:
   ```ts
   text?: string;
   ```

2. **Capture `text` in `buildSnapshot`**:
   - For every parsed node, store `text: n.text` alongside the other fields.

3. **Diff `text` in `diffSnapshot`**:
   - If `prev.text !== snap.text`, determine the canonical radiprotocol field key based on `nodeType`:
     - `question` → `radiprotocol_questionText`
     - `answer` → `radiprotocol_answerText`
     - `text-block` → `radiprotocol_content`
     - `loop` → `radiprotocol_headerText`
   - If the corresponding canonical field (`questionText`, etc.) did NOT change in the same pass, synthesize a `fieldUpdates` entry mapping the determined key to `snap.text`.
   - If the canonical field DID change (i.e., both `text` and `radiprotocol_*` changed), the canonical diff already emits the correct `fieldUpdates`; do not duplicate.
   - For `snippet` nodes, `text` changes are intentionally ignored because Snippet node visual text is not mapped to a canonical radiprotocol field (snippetLabel is set via the branch label field, not the node text).

4. **Test coverage**:
   - Add a test in `src/__tests__/edge-label-sync-service.test.ts` that simulates a snapshot where `text` changes but `radiprotocol_questionText` stays the same, and asserts that the dispatched `fieldUpdates` contains `radiprotocol_questionText` with the new text value.

### Acceptance Criteria
- Editing the text of a Question, Answer, Text-block, or Loop node directly on the canvas updates the corresponding field in the open Node Editor form within ~1 second.
- No duplicate dispatches when both `text` and `radiprotocol_*` change in the same reconcile pass.
- Existing edge-label-only dispatch behavior remains unchanged.
- Build stays green.

### Known Discrepancy (info only)
`LoopNode` parser fallback for `headerText` is `''` rather than `raw.text`. The Gap 2 logic will still work for plugin-created loop nodes (which always have `radiprotocol_headerText`), but a loop node created outside the plugin that only has `text` will show empty `headerText` until `radiprotocol_headerText` is set. This is pre-existing behavior and not changed by this fix.
