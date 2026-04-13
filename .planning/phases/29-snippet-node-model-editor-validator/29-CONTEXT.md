# Phase 29: Snippet Node — Model, Editor, Validator - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `snippet` as a first-class 8th node kind: extend the graph model, canvas parser, EditorPanel form, node type dropdown, and NODE_COLOR_MAP. GraphValidator requires no new checks — missing subfolder is valid (fallback to root). Runner integration is Phase 30.

</domain>

<decisions>
## Implementation Decisions

### Graph Model
- **D-01:** Add `'snippet'` to `RPNodeKind` union in `graph-model.ts`.
- **D-02:** `SnippetNode` interface: `kind: 'snippet'`, `subfolderPath?: string` (optional — empty/absent means root `.radiprotocol/snippets`).
- **D-03:** Canvas property name: `radiprotocol_subfolderPath` (follows `radiprotocol_*` namespace convention).

### Canvas Parser
- **D-04:** Add `'snippet'` to `validKinds[]` array in `canvas-parser.ts`.
- **D-05:** Parse `radiprotocol_subfolderPath` as optional string in the `switch` case for `'snippet'`.

### EditorPanel Form
- **D-06:** Add `'snippet'` option to the node type dropdown (label: `"Snippet"`).
- **D-07:** `buildKindForm` case for `'snippet'`: async dropdown (Obsidian `Setting.addDropdown`) populated by recursively listing all subfolders of `.radiprotocol/snippets/` via `vault.adapter.list()`. Shows full relative sub-paths (e.g., `CT/adrenal`, `CT/lung/nodes`).
- **D-08:** Empty state (no subfolders exist): dropdown shows a single disabled placeholder option `"No subfolders found"`.
- **D-09:** First option in dropdown: `""` → `"— root (all snippets) —"` — selecting this saves `subfolderPath: undefined`, which means fallback to root at runtime.
- **D-10:** `text` field on the canvas node mirrors only the subfolder path value (e.g., `CT/adrenal`). If root is selected, `text` is set to `""` or omitted (no prefix label like "Snippet:").

### Node Color
- **D-11:** `NODE_COLOR_MAP['snippet'] = '6'` (purple — the only unused palette slot). Consistent with Phase 28 auto-coloring.

### GraphValidator
- **D-12:** No new validation rule for missing subfolder. Absence of `subfolderPath` is valid — runtime falls back to root snippets folder. SNIPPET-NODE-08 requirement is superseded by this fallback design.

### Claude's Discretion
- Implementation of the recursive folder listing helper (whether to inline in `buildKindForm` or extract to a shared utility).
- Exact async loading pattern in EditorPanel (e.g., immediately populate on `loadNode`, or populate lazily when form renders).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Graph model and parser
- `src/graph/graph-model.ts` — `RPNodeKind`, `RPNode` union, all node interfaces — add `SnippetNode` here
- `src/graph/canvas-parser.ts` — `validKinds[]`, `parseNode` switch — extend both for `'snippet'`
- `src/graph/graph-validator.ts` — validate() — no changes needed for Phase 29

### EditorPanel
- `src/views/editor-panel-view.ts` — type dropdown (`addOption`), `buildKindForm` switch, `pendingEdits` pattern, `scheduleAutoSave`

### Color map
- `src/canvas/node-color-map.ts` — `NODE_COLOR_MAP: Record<RPNodeKind, string>` — add `'snippet': '6'`

### Snippet service (reference for folder listing pattern)
- `src/snippets/snippet-service.ts` — `vault.adapter.list(folderPath)` usage — reuse this pattern for subfolder enumeration

### Requirements
- `.planning/REQUIREMENTS.md` §SNIPPET-NODE — SNIPPET-NODE-01, SNIPPET-NODE-02 (SNIPPET-NODE-08 superseded by D-12)

### Prior phase context
- `.planning/phases/28-auto-node-coloring/28-CONTEXT.md` — color injection pattern, NODE_COLOR_MAP contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `vault.adapter.list(path)` in `SnippetService` — returns `{ files, folders }` — use same API for subfolder enumeration in EditorPanel form
- `buildKindForm` switch in `editor-panel-view.ts` — each case uses `new Setting(container)` + `pendingEdits` + `scheduleAutoSave()` — new `'snippet'` case follows same pattern
- `NODE_COLOR_MAP` — typed as `Record<RPNodeKind, string>` — adding `'snippet'` will cause a TS compile error until both the type and the map are updated together

### Established Patterns
- All canvas properties use `radiprotocol_*` namespace — `radiprotocol_subfolderPath` follows this
- `text` field mirrors human-readable content (question text, answer text, etc.) — snippet node mirrors the subfolder path
- `pendingEdits` accumulates field changes; `scheduleAutoSave()` fires after 800ms debounce
- `onTypeDropdownChange` triggers immediate save without debounce (existing behavior — preserved)

### Integration Points
- `RPNodeKind` type is used in `NODE_COLOR_MAP`, `canvas-parser.ts`, `editor-panel-view.ts`, `graph-validator.ts`, `runner-state.ts` — adding `'snippet'` will surface TS errors in each exhaustive switch/Record — use these as a checklist
- Phase 30 will consume `SnippetNode.subfolderPath` from the graph model — field name `radiprotocol_subfolderPath` must be stable

</code_context>

<specifics>
## Specific Ideas

- Subfolder dropdown uses full recursive paths from root (e.g., `CT/adrenal`, `CT/lung/nodes`) — not just immediate children
- First dropdown option is `"— root (all snippets) —"` (value `""`), saving `subfolderPath: undefined`
- `text` field: only the raw path value, no "Snippet:" prefix

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 29-snippet-node-model-editor-validator*
*Context gathered: 2026-04-13*
