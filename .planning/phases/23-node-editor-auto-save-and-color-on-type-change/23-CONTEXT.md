# Phase 23: Node Editor Auto-Save and Color-on-Type-Change — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the "Save changes" button in `EditorPanelView` with debounced auto-save (~1 second); save immediately (no debounce) when the node-type dropdown changes, including color write; remove the dirty-guard modal (`NodeSwitchGuardModal`) and all references to it; prevent cross-node write corruption when switching nodes while a debounce is pending; show a transient "Saved ✓" inline indicator after each successful auto-save.

This phase does NOT change the save path logic inside `saveNodeEdits()` — the live/Strategy A dual path stays intact. Only the trigger mechanism (button → timer) and UX surface (modal guard → no guard, button → inline indicator) change.

</domain>

<decisions>
## Implementation Decisions

### "Saved" Indicator
- **D-01:** The transient indicator is inline text — "Saved ✓" rendered in the area where the Save button used to be. It appears after each successful `saveNodeEdits()` call and fades out (CSS opacity transition or a short timeout → hide). Duration ~2 seconds. No Obsidian `Notice()` for auto-saves — the inline placement is intentional to keep feedback local to the editor.

### Debounce on Node Switch (Cross-Node Corruption Guard)
- **D-02:** When the user clicks a different canvas node while a debounce timer is pending, the pending save is **flushed synchronously** before switching: call `saveNodeEdits()` immediately with the first node's captured filePath/nodeId/edits, cancel the pending timer, then call `loadNode()` for the new node. Slight latency on switch is acceptable; it guarantees SC-3 without relying on async timer capture.
- **D-03:** If the flush save fails (e.g. canvas file not found), the switch still proceeds — do not block node navigation on save errors.

### Type-Change Immediate Save Scope
- **D-04:** When the node-type dropdown changes, the immediate save includes **ALL currently pending edits** (`{ ...this.pendingEdits }`) — not just the type and color. This means any field the user has already edited before changing the type is also persisted immediately. The debounce timer (if running) is cancelled at this point since the save already fired.

### NodeSwitchGuardModal Cleanup
- **D-05:** Delete `src/views/node-switch-guard-modal.ts` entirely. Remove its import from `editor-panel-view.ts`. The guard logic in `handleNodeClick()` (lines 103–110) is removed — no modal, no `confirmed` check, no `pendingEdits = {}` pre-clear. The `handleNodeClick()` early-return for same-node stays.

### Debounce Architecture
- **Claude's Discretion:** Exact debounce implementation (instance field `private _debounceTimer: ReturnType<typeof setTimeout> | null = null`, a tiny helper, or a library). The key invariant: the callback captures `filePath`, `nodeId`, and the edits snapshot at schedule time — not `this.currentFilePath`/`this.currentNodeId` at fire time (prevents D-02 race even in the async-capture path, though D-02 uses flush).
- **Claude's Discretion:** Exact CSS/DOM approach for the "Saved ✓" indicator fade (CSS class toggle, inline style transition, or `setTimeout` + `remove()`).
- **Claude's Discretion:** Whether `saveNodeEdits()` returns a boolean/result that the auto-save path uses to conditionally show the indicator, or whether the indicator always shows on call completion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ROADMAP Phase 23 detail
- `.planning/ROADMAP.md` — Phase 23 goal, success criteria (SC-1 through SC-5), dependencies on Phase 21 and Phase 22

### Source files to modify
- `src/views/editor-panel-view.ts` — primary file: remove Save button, add debounce timer, add flush-on-switch logic, remove dirty-guard, add "Saved ✓" indicator, update type-dropdown `onChange` to trigger immediate save
- `src/views/node-switch-guard-modal.ts` — **DELETE this file entirely** (D-05)

### Prior phase context
- `.planning/phases/21-color-infrastructure/21-CONTEXT.md` — D-04 (color write via `saveLive()` standard path, no separate `writeColor()`), D-05 (color write skipped silently if live unavailable)
- `.planning/phases/22-snippet-node-graph-and-runner-layer/22-CONTEXT.md` — no decisions directly relevant to Phase 23

### Existing patterns to preserve
- `saveNodeEdits()` dual-path logic (live → Strategy A fallback) — unchanged
- Color lookup from `NODE_COLOR_MAP` on save (already in `onClick` handler, move to auto-save trigger)
- `pendingEdits` accumulation from `onChange` handlers — unchanged

</canonical_refs>

<code_context>
## Existing Code Insights

### Current Save Trigger (to replace)
- `renderForm()` lines 294–321: creates a `saveRow` div with a "Save changes" button; `onClick` builds `edits = { ...this.pendingEdits }`, adds color, calls `saveNodeEdits()`. This entire block is replaced by the auto-save timer setup and "Saved ✓" indicator area.

### Dirty Guard (to remove)
- `handleNodeClick()` lines 103–110: checks `currentNodeId !== null && Object.keys(pendingEdits).length > 0`, opens `NodeSwitchGuardModal`, awaits `modal.result`. Replace with synchronous flush (D-02).
- Import at line 4: `import { NodeSwitchGuardModal } from './node-switch-guard-modal';` — remove.

### Type Dropdown onChange (to extend)
- `renderForm()` lines 277–287: `onChange(value => { this.pendingEdits['radiprotocol_nodeType'] = value || undefined; rebuild kindFormSection })`. Add: cancel debounce timer, build full edits with color, call `saveNodeEdits()` immediately (D-04).

### Integration Points
- `loadNode()` line 125: sets `currentFilePath`, `currentNodeId`, clears `pendingEdits`, calls `renderNodeForm()`. Before setting new node, flush-on-switch logic goes here (D-02).
- `saveNodeEdits()` — add return value or post-call hook to trigger "Saved ✓" indicator (D-01).

</code_context>

<specifics>
## User Decisions (verbatim)

- "Saved" indicator: fade-out inline text "Saved ✓" where the button was (no Notice)
- Node switch with pending debounce: synchronous flush before switching (Option A)
- Type-change immediate save: save ALL pendingEdits (Option A)
- NodeSwitchGuardModal: delete file and imports entirely

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-node-editor-auto-save-and-color-on-type-change*
*Context gathered: 2026-04-11*
