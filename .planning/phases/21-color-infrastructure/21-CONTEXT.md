# Phase 21: Color Infrastructure - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement canvas node color coding by type: when a node's type is assigned in the Node Editor, the corresponding Obsidian palette color is written to the canvas node's `color` field in real-time via `CanvasLiveEditor`. Clearing a node's type removes the color. Both `PROTECTED_FIELDS` copies are updated to permit color writes. A new `src/canvas/node-color-map.ts` constant defines the type→palette mapping for all 7 node types.

This phase does NOT add the `snippet` node type to `RPNodeKind` (that is Phase 22) — it only defines the color mapping constant for snippet in anticipation of Phase 22.

</domain>

<decisions>
## Implementation Decisions

### Palette Mapping
- **D-01:** Fixed palette assignments (Obsidian color strings `"1"`–`"6"`):
  - `start` → `"4"` (green)
  - `question` → `"5"` (cyan)
  - `answer` → `"2"` (orange)
  - `text-block` → `"3"` (yellow)
  - `snippet` → `"6"` (purple)
  - `loop-start` → `"1"` (red)
  - `loop-end` → `"1"` (red) — loop pair shares red; this is intentional
- **D-02:** `node-color-map.ts` defines all 7 types including `snippet` immediately, so Phase 22 does not need to touch this file.

### PROTECTED_FIELDS
- **D-03:** Remove `'color'` from **both** `PROTECTED_FIELDS` instances:
  - `src/canvas/canvas-live-editor.ts:14` (module-level constant)
  - `src/views/editor-panel-view.ts:181` (local variable inside save method)
- **D-04:** No separate `writeColor()` method — color is written through the standard `saveLive()` / Strategy A path like any other field once removed from `PROTECTED_FIELDS`.

### Color Write Path
- **D-05:** Color is written **only via the live path** (`CanvasLiveEditor.saveLive()`). When the canvas is closed and live API is unavailable, color write is silently skipped — the rest of the node's `radiprotocol_*` fields still save normally via Strategy A. Color will appear on next canvas open.
- **D-06:** The **unmark path** in `saveLive()` (when `radiprotocol_nodeType` is set to `''` or `undefined`) must also **clear the canvas node's `color` field** (set to `undefined` / delete the key) — this satisfies COLOR-02. Currently this path only removes `radiprotocol_*` fields and does not touch `color`.

### Claude's Discretion
- Test structure for `node-color-map.ts` (what tests to write, how many assertions per type)
- Whether to export `NODE_COLOR_MAP` as a `const` record or a `Map<RPNodeKind, string>`
- Integration point details in `editor-panel-view.ts` (which existing save call gets the color append)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/milestones/v1.2-phases/` — archived v1.2 phases (context only)
- v1.3 requirements: COLOR-01, COLOR-02, COLOR-03, COLOR-04 (defined in commit `78d28e6` — run `git show 78d28e6:.planning/REQUIREMENTS.md` to read)

### ROADMAP Phase 21 detail
- `.planning/ROADMAP.md` — Phase 21 success criteria and dependency on Phase 20

### Source files to modify
- `src/canvas/canvas-live-editor.ts` — `PROTECTED_FIELDS` at line 14; `saveLive()` unmark path at ~line 80
- `src/views/editor-panel-view.ts` — local `PROTECTED_FIELDS` at line 181; save method that calls `saveLive()`
- `src/graph/graph-model.ts` — `RPNodeKind` union (reference only — not modified in Phase 21)

### New file to create
- `src/canvas/node-color-map.ts` — new constant mapping all 7 `RPNodeKind` values to palette strings

### Tests to update/create
- `src/__tests__/canvas-live-editor.test.ts` — PROTECTED_FIELDS test at line 57 currently asserts `color` is protected; must be updated
- `src/__tests__/canvas-write-back.test.ts` — may need color write assertions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CanvasLiveEditor.saveLive(filePath, nodeId, edits)` — already handles the edit→getData→setData→requestSave cycle; color just needs to be passed in `edits` once removed from PROTECTED_FIELDS
- `CanvasLiveEditor.isLiveAvailable(filePath)` — use to gate color write (D-05 fallback)
- `RPNodeBase.color?: string` in `graph-model.ts` — model field already exists

### Established Patterns
- PROTECTED_FIELDS pattern exists in two places independently (not a shared import) — both must be updated
- Strategy A fallback (vault.modify with canvas closed) handles `radiprotocol_*` fields already — color fallback is a deliberate skip, not a Strategy A extension
- Unmark path in `saveLive()` (lines ~80–90) removes all `radiprotocol_*` fields — needs an additional `delete node.color` step for COLOR-02

### Integration Points
- `editor-panel-view.ts` save method currently builds an `edits` object and calls `saveLive()` — color write is appended to this edits object based on the selected type from `node-color-map.ts`
- On unmark (type cleared to `''`), the same save method must pass `{ radiprotocol_nodeType: '', color: undefined }` so the unmark path in `saveLive()` also clears color

</code_context>

<specifics>
## Specific Ideas

- User chose "По смыслу" for palette — semantic grouping was the deciding factor (loop pair shares one color, which is conceptually clean)
- Two types sharing `"1"` (red) is acceptable and intentional for loop-start/loop-end

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-color-infrastructure*
*Context gathered: 2026-04-11*
