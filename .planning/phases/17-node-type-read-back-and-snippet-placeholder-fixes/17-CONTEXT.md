# Phase 17: Node Type Read-Back and Snippet Placeholder Fixes - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix three known bugs:
- **BUG-02**: A free-text-input node configured via Node Editor does not prompt for text input when the runner reaches it.
- **BUG-03**: A text-block node configured via Node Editor does not auto-advance with its text appended when the runner reaches it.
- **BUG-04**: In the snippet creator, clicking "Add" after entering a placeholder label has no effect (button does not react at all).

No new capabilities. Scope is strictly these three bug fixes.

</domain>

<decisions>
## Implementation Decisions

### BUG-02/03: Node Type Read-Back Root Cause
- **D-01:** The bug occurs when the canvas is **open** during Node Editor save (i.e., the `saveLive()` live-edit path is used).
- **D-02:** `saveLive()` calls `setData()` to update the canvas view's in-memory state and then schedules a debounced `requestSave()` (500 ms). If the runner is opened before the debounce fires, `vault.read()` in `openCanvas()` reads the stale on-disk file — the `radiprotocol_nodeType` property is absent — and the canvas parser silently skips the node as a plain canvas node.
- **D-03:** Node Editor still shows the correct type because the user typically waits long enough for the debounce to flush (or re-opens the node editor after the flush). The runner reads at the moment of opening, which may be within the 500 ms window.
- **D-04:** Observable symptom (as described by user): the free-text-input / text-block node "does not appear alongside other nodes that go from the answer node" — i.e., the node is absent from the parsed graph, so runner execution skips it or cannot find the next node.

### BUG-02/03: Fix Approach
- **D-05:** Add a **public** method to `CanvasLiveEditor` — e.g., `getCanvasJSON(filePath: string): string | null` — that returns `JSON.stringify(canvas.getData())` when the canvas view is open, or `null` when it is closed.
- **D-06:** In `RunnerView.openCanvas()`, before calling `vault.read()`, check `this.plugin.canvasLiveEditor.getCanvasJSON(filePath)`. If it returns a non-null string, use that as `content` for parsing. If null, fall back to `vault.read()` as today.
- **D-07:** The canvas parser receives the JSON string regardless of source — no changes to `CanvasParser.parse()` signature or behavior.
- **D-08:** `getCanvasView()` in `CanvasLiveEditor` stays private; only the new public `getCanvasJSON()` method is added to the public API.

### BUG-04: Snippet Placeholder Add Button Root Cause
- **D-09:** Observable behavior: clicking the "Add" button in the snippet creator mini-form has **no effect** — no handler fires, form stays open, label field is not cleared, placeholder is not added.
- **D-10:** Root cause investigation delegated to the researcher: the handler is registered in `snippet-manager-view.ts` around line 244 (`this.registerDomEvent(miniAddBtn, 'click', ...)`). Researcher must determine why the handler does not fire — likely candidates: event capture/propagation issue, element reference stale after `renderFormPanel()` re-render, or a DOM hierarchy problem with the button type defaulting to `type="submit"` in an unexpected context.
- **D-11:** Fix must ensure: (a) click handler fires reliably, (b) placeholder is appended to `draft.placeholders`, (c) `{{slug}}` is inserted into the template textarea, (d) the mini-form is hidden after Add, (e) the label input is cleared before or upon hiding the form (consistent with success criteria).

### Test Approach
- **D-12:** TDD — RED then GREEN (established pattern from Phases 12 and 14).
  - BUG-02/03: write unit tests against `CanvasParser` and/or a test harness for `openCanvas()` data-source selection (pure module, zero Obsidian imports) that fail first, then fix.
  - BUG-04: `SnippetManagerView` involves DOM and Obsidian APIs — unit tests may be limited; focus on a structural test or rely on UAT verification if pure-module test is not feasible.

### Claude's Discretion
- Exact method name for the new `CanvasLiveEditor` public method (`getCanvasJSON` or similar) — Claude's choice as long as it's descriptive.
- Whether to also update `EditorPanelView.renderNodeForm()` to read from `getCanvasJSON()` (so the Node Editor always shows live data when canvas is open) — Claude may include this as a consistency improvement if it's low-risk.
- Internal implementation of the BUG-04 fix (event delegation, re-attaching handler, explicit `type="button"` attribute on the button element, etc.) — Claude's choice based on root cause found in research.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Core source files to read before planning
- `src/views/runner-view.ts` — `openCanvas()` method: where `vault.read()` is called (lines ~57–100); this is where D-05/D-06 wiring goes
- `src/canvas/canvas-live-editor.ts` — `saveLive()`, `getCanvasView()` (private); new public `getCanvasJSON()` method goes here
- `src/views/snippet-manager-view.ts` — `renderFormPanel()`, `miniAddBtn` handler (~line 244); root of BUG-04
- `src/graph/canvas-parser.ts` — `parse()` and `parseNode()`: no changes expected but read to confirm `radiprotocol_nodeType` read path
- `src/types/canvas-internal.d.ts` — `CanvasNodeData`, `CanvasInternal.getData()` — type reference for `getCanvasJSON()` implementation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CanvasLiveEditor.getCanvasView(filePath)` (private) — same logic, just wrapped in a new public method that serializes the result to JSON.
- `CanvasParser.parse(content: string, filePath: string)` — takes a JSON string; no interface change needed when switching from `vault.read()` to `getData()`.
- `this.registerDomEvent()` — Obsidian's lifecycle-safe event registration used throughout `SnippetManagerView`; the fix for BUG-04 must use the same mechanism.

### Established Patterns
- `openCanvas()` already constructs a new `ProtocolRunner` to pick up the latest `textSeparator` setting (Phase 15 pattern). The `getCanvasJSON()` fallback fits into the same early-read section.
- `saveLive()` → `setData()` → `debouncedRequestSave()` is the established live-edit path — this is NOT changed by the fix. The fix is on the READ side (runner), not the WRITE side (editor).
- `CanvasNodeData` has `[key: string]: unknown` index signature, so `radiprotocol_*` fields survive `getData()` / `setData()` round-trips (verified in `canvas-internal.d.ts`).

### Integration Points
- `RunnerView` has access to `this.plugin.canvasLiveEditor` (confirmed by Phase 15/16 code patterns) — the new `getCanvasJSON()` call fits there directly.
- BUG-04 fix is self-contained within `snippet-manager-view.ts`; no cross-file integration needed.

</code_context>

<specifics>
## Specific Ideas

- User described BUG-02/03 symptom as: "не отображается вместе с другими узлами, которые отходят от узла ответа" (doesn't appear with other nodes that go from the answer node) — the free-text-input/text-block node is absent from the parsed graph because the parser skips it (no `radiprotocol_nodeType` in stale disk data).
- Canvas is open during the repro — confirmed by user. Strategy A (canvas closed + `vault.modify()`) path is NOT affected by this bug.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-node-type-read-back-and-snippet-placeholder-fixes*
*Context gathered: 2026-04-09*
