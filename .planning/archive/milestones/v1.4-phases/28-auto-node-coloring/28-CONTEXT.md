# Phase 28: Auto Node Coloring - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Saving any node type always writes the correct color to the canvas node — regardless of prior color state and regardless of whether the canvas is open (Pattern B) or closed (Strategy A). Programmatically created test canvases also include the correct `color` field per node type. Color lookup lives in the existing `NODE_COLOR_MAP`.

</domain>

<decisions>
## Implementation Decisions

### Color injection point
- **D-01:** Color injection is centralized **inside `saveNodeEdits`** — callers do NOT pass `color` explicitly.
- **D-02:** `saveNodeEdits` resolves the node type internally and injects the correct color into the write payload before committing. Callers remain unchanged.
- **D-03:** The existing test at `canvas-write-back.test.ts:57` (old contract: "color cannot be written by callers") must be updated to reflect the new contract: "color is always written correctly for known types."

### Type resolution order
- **D-04:** Type is resolved with priority: `edits['radiprotocol_nodeType']` (if present and non-empty) → existing node's `radiprotocol_nodeType` from the canvas (live `getData()` for Pattern B, parsed JSON for Strategy A).
- **D-05:** If the resolved type is absent or not in `NODE_COLOR_MAP`, no color is written (node remains as-is). Unknown/custom types are not touched.
- **D-06:** On unmark path (`radiprotocol_nodeType === ''` or `undefined`), color is deleted — existing behavior is preserved and correct.

### Test canvas helper — NODE-COLOR-03
- **D-07:** A shared test helper `makeCanvasNode(type, overrides?)` is created (in a test utils file) that automatically derives `color` from `NODE_COLOR_MAP[type]`. All new and existing fixtures that need a typed node use this helper.
- **D-08:** The helper is the canonical source for colored node fixtures — prevents manual sync drift when `NODE_COLOR_MAP` changes in the future.

</decisions>

<specifics>
## Specific Ideas

No specific UI or UX references — this phase is purely a data-write concern. The color values and their semantics are already defined in `node-color-map.ts` and are not changing.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Color map and write paths
- `src/canvas/node-color-map.ts` — Authoritative mapping: `RPNodeKind → palette string ("1"–"6")`
- `src/views/editor-panel-view.ts` — `saveNodeEdits` (Strategy A path), `onTypeDropdownChange` (existing color write for type changes, Pattern B entry point)
- `src/canvas/canvas-live-editor.ts` — `saveLive` (Pattern B live write path, `PROTECTED_FIELDS`, unmark logic)

### Requirements
- `.planning/REQUIREMENTS.md` §NODE-COLOR — NODE-COLOR-01, NODE-COLOR-02, NODE-COLOR-03

### Existing tests to update
- `src/__tests__/canvas-write-back.test.ts` — Line 57: old "color never written" contract must be replaced with "color always written for known types" contract
- `src/__tests__/regression.test.ts` — Regression tests for color protection (verify still valid after change)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NODE_COLOR_MAP` (`src/canvas/node-color-map.ts`) — already maps all 7 known types; Phase 28 does not add new types, only ensures the map is used on every save path
- `onTypeDropdownChange` — already demonstrates the correct color-inject pattern; `saveNodeEdits` should replicate that lookup internally

### Established Patterns
- Pattern B (canvas open): `saveLive()` in `canvas-live-editor.ts` uses `getData()` / `setData()` / `debouncedRequestSave()`
- Strategy A (canvas closed): `vault.modify()` with parsed JSON in `editor-panel-view.ts`
- Both paths have unmark logic that deletes `color` — this must be preserved

### Integration Points
- `saveNodeEdits` in `editor-panel-view.ts` is the single entry point for all saves — the color injection should live here before the call forks into Pattern B or Strategy A
- `canvas-live-editor.ts:saveLive` receives `edits` and applies them — if color is in `edits` at this point, it will be written (color is not in `PROTECTED_FIELDS` since Phase 27)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 28-auto-node-coloring*
*Context gathered: 2026-04-13*
