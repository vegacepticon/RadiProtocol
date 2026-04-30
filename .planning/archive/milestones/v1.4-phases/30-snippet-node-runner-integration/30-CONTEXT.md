# Phase 30: Snippet Node — Runner Integration - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire snippet nodes into the runner: when ProtocolRunner reaches a snippet node, RunnerView shows a drill-down picker of subfolders/snippets rooted at the node's `subfolderPath` (or the snippet root if undefined). Selecting a snippet with placeholders opens the existing SnippetFillInModal; without placeholders the snippet text is appended directly. After insertion the runner advances along the first outgoing edge, or completes the protocol if there is none. Snippet model, parser, EditorPanel and color are out of scope — they were delivered in Phase 29.

</domain>

<decisions>
## Implementation Decisions

### Picker UI
- **D-01:** Picker is rendered inline in `questionZone` of RunnerView — same DOM pattern as the answer-list for question nodes. No new modal for browsing.
- **D-02:** Drill-down navigation: only direct children of the current folder are shown. Clicking a folder descends; a breadcrumb above the list lets the user climb back. Initial folder = `node.subfolderPath` (or snippet root if `subfolderPath` is undefined).
- **D-03:** Item ordering: folders first (alphabetical), then snippets (alphabetical). Folder rows visually distinguished from snippet rows (icon or prefix).
- **D-04:** Snippet button label = `snippet.name` (from SnippetFile). Requires reading every `.json` in the current folder when the picker renders.
- **D-05:** Folder navigation (drill-down + breadcrumb "Up") is local to the picker — it does NOT push UndoEntry on the runner. Only `pickSnippet()` mutates runner state and pushes undo.

### Runner state machine
- **D-06:** Add `'awaiting-snippet-pick'` as a new RunnerStatus in `runner-state.ts`. New `AwaitingSnippetPickState` interface carries `nodeId`, `subfolderPath: string | undefined`, `accumulatedText`, `canStepBack`. Added to the `RunnerState` discriminated union.
- **D-07:** `advanceThrough` in `protocol-runner.ts`: the existing `case 'snippet'` branch (currently sets `runnerStatus = 'at-node'` — Phase 29 placeholder) is replaced. New behavior: set `runnerStatus = 'awaiting-snippet-pick'`, store `currentNodeId = cursor`, return.
- **D-08:** New `pickSnippet(snippetId: string)` method on ProtocolRunner. Valid only in `'awaiting-snippet-pick'`. Pushes UndoEntry BEFORE mutation (same invariant as `chooseAnswer` — see Pitfall 1 in Phase 2). Then transitions to `'awaiting-snippet-fill'` carrying the picked `snippetId` and the current snippet `nodeId`. The existing `completeSnippet(text)` flow then takes over for both the placeholder and no-placeholder paths.
- **D-09:** RunnerView decides placeholder vs no-placeholder: after `pickSnippet`, RunnerView reads the SnippetFile (already loads via `snippetService.load`); if `placeholders.length === 0`, it calls `completeSnippet(snippet.template)` immediately (no modal). Otherwise it opens SnippetFillInModal as today. This keeps ProtocolRunner pure — no SnippetFile reads inside the runner.
- **D-10:** Terminal vs non-terminal behavior is delegated to existing `completeSnippet` logic — `firstNeighbour` after insertion already does the right thing (advance if outgoing edge exists, transitionToComplete otherwise). No new branching needed for SNIPPET-NODE-07.

### Step-back semantics
- **D-11:** Standard step-back is available from `'awaiting-snippet-pick'` whenever `canStepBack` is true (undoStack non-empty). Step-back exits the snippet node entirely and reverts to the prior at-node state (just like step-back from question/free-text). Drill-down breadcrumb "Up" is a separate control and does NOT consume undo.
- **D-12:** `stepBack()` in protocol-runner.ts must clear `snippetId`/`snippetNodeId` when reverting from `'awaiting-snippet-pick'` (same as the existing reset for `'awaiting-snippet-fill'` at line 156-157).

### Skip / Cancel
- **D-13:** No "skip snippet" button in the picker. Snippets at this node are mandatory — the radiologist either picks one or step-backs. Matches question / free-text-input behavior (no skip there either).
- **D-14:** Existing SnippetFillInModal cancel semantics are preserved (Phase 5 D-11): cancel = `completeSnippet('')`, runner advances with empty insertion. This applies whether the modal was opened from a text-block snippetId (existing flow) or from a snippet node pick (new flow).

### Empty / missing folder
- **D-15:** If `subfolderPath` is set but the folder does not exist on disk, the picker renders an empty state ("No snippets found in {path}") with the step-back button visible. NO transition to error state. NO automatic fallback to root. This matches Phase 29 D-12: missing subfolder is valid but contains nothing.
- **D-16:** If `subfolderPath` is undefined, the picker uses `settings.snippetFolderPath` as its root (Phase 29 D-09 fallback semantics).
- **D-17:** If the folder exists but is empty (no `.json`, no subfolders), same empty-state message — same step-back affordance.

### SnippetService
- **D-18:** New method `listFolder(folderPath: string): Promise<{ folders: string[]; snippets: SnippetFile[] }>`. Returns DIRECT children only — folder names (relative to the queried folder) and parsed SnippetFile objects for `.json` children. Corrupt JSON files are skipped silently (same as existing `list()`).
- **D-19:** `folderPath` argument convention: full vault-relative path (e.g. `.radiprotocol/snippets/CT/adrenal`). Caller composes `${snippetFolderPath}/${node.subfolderPath}` before calling. Researcher to confirm vs alternative (relative-to-root) during planning.
- **D-20:** Path safety: `listFolder` MUST validate that the resolved path is inside `settings.snippetFolderPath` after normalization (strip `..`, leading `/`, etc.). Reject (return empty) if the path escapes the snippet root. Defends against malicious or mistyped `radiprotocol_subfolderPath` values stored in `.canvas` files (ASVS V5 path traversal — T-30-01).
- **D-21:** Existing `list()` (root-only, recursive over `.json` files in root) is NOT changed — Snippet Manager still uses it.

### Session persistence
- **D-22:** `'awaiting-snippet-pick'` must be resumable. `getSerializableState()` and `restoreFrom()` both gain support for the new status. The serialized payload needs `currentNodeId` (already present) — no new fields, since `subfolderPath` is re-derived from the graph at restore time.
- **D-23:** Drill-down navigation position (current breadcrumb depth) is NOT persisted — on resume the picker starts at the snippet node's configured root again. The user re-navigates if they were deep in subfolders. Acceptable trade-off vs persistence complexity.

### Claude's Discretion
- Exact CSS class names for picker rows, breadcrumb, "Up" button (must live in `src/styles/runner-view.css`, append-only with `/* Phase 30: ... */` comment).
- Whether the breadcrumb is a single string of `/`-joined segments or individual clickable chips — both acceptable.
- Implementation of folder-row vs snippet-row distinction (icon vs prefix string).
- Whether `listFolder` is implemented inside SnippetService or a thin helper module — inside SnippetService preferred for consistency.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Runner state machine
- `src/runner/runner-state.ts` — RunnerStatus union, RunnerState union — add new `'awaiting-snippet-pick'` status + `AwaitingSnippetPickState` interface
- `src/runner/protocol-runner.ts` — `advanceThrough` `case 'snippet'` (currently lines ~513-518), `pickSnippet` (new method), `stepBack` reset (line 147-158), `getSerializableState` / `restoreFrom` (lines ~320-395)

### Runner UI
- `src/views/runner-view.ts` — `render()` switch (line 286), existing `case 'awaiting-snippet-fill'` (line 422), `handleSnippetFill` (line 475) — add new `case 'awaiting-snippet-pick'` rendering the drill-down picker
- `src/views/snippet-fill-in-modal.ts` — existing modal, no changes; reused as-is for the placeholder path

### Snippet service and model
- `src/snippets/snippet-service.ts` — add `listFolder(folderPath)` next to existing `list()`. Reuse `vault.adapter.list` and `vault.adapter.read` patterns
- `src/snippets/snippet-model.ts` — `SnippetFile` shape (id, name, template, placeholders[]) — read-only reference

### Graph model (already in place from Phase 29)
- `src/graph/graph-model.ts` — `SnippetNode` interface (`kind: 'snippet'`, `subfolderPath?: string`)
- `src/graph/canvas-parser.ts` — parses `radiprotocol_subfolderPath` into `SnippetNode.subfolderPath`

### Settings
- `src/settings.ts` — `snippetFolderPath` setting (root for all snippet operations and path-safety prefix)

### Styles
- `src/styles/runner-view.css` — append-only Phase 30 section for picker/breadcrumb/folder-row classes (CLAUDE.md rule)

### Requirements
- `.planning/REQUIREMENTS.md` §SNIPPET-NODE — SNIPPET-NODE-03, 04, 05, 06, 07

### Prior phase context (decisions that constrain Phase 30)
- `.planning/phases/29-snippet-node-model-editor-validator/29-CONTEXT.md` — D-02, D-03, D-09 (subfolderPath semantics), D-12 (missing subfolder is valid)
- `.planning/phases/05-dynamic-snippets/` — Phase 5 SnippetFillInModal cancel semantics (D-11), `completeSnippet('')` advance behavior
- `.planning/phases/07-mid-session-save-and-resume/` — SESSION-01 contract for serializable state

### Anti-patterns to honor
- CLAUDE.md — never delete unrelated rules in `runner-view.css`, `protocol-runner.ts`, `runner-view.ts`. Append-only CSS with phase comment.
- Phase 2 Pitfall 1 — UndoEntry MUST be pushed BEFORE any state mutation in `pickSnippet`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/views/snippet-fill-in-modal.ts` — already loads SnippetFile and resolves a string|null promise. Reused unchanged for the placeholder path.
- `RunnerView.handleSnippetFill` (line 475) — already encodes the load-snippet → open-modal → completeSnippet flow. The new picker handler follows the same shape but starts from a known snippetId picked by the user.
- `vault.adapter.list(path)` returns `{ files, folders }` — same API used by `EditorPanel.listSnippetSubfolders` (Phase 29) and `SnippetService.list()` (Phase 5). `listFolder` reuses it.
- `answer-list` rendering pattern in `runner-view.ts:314-330` — vertical list of `rp-answer-btn` buttons. Picker rows mirror this pattern with new CSS classes.
- Step-back rendering at `runner-view.ts:405-415` — driven by `state.canStepBack`. New picker reuses the same conditional block.

### Established Patterns
- ProtocolRunner is pure (NFR-01) — zero Obsidian imports. New `pickSnippet` MUST NOT touch SnippetService or `app.vault`.
- Status-discriminated `RunnerState` — RunnerView's render switch must remain exhaustive (TS `never` check at line 461).
- Auto-save after every mutation: `void this.autoSaveSession()` is called in every click handler in RunnerView.
- Phase comment convention in CSS: `/* Phase N: ... */` blocks appended to feature files.

### Integration Points
- `runner-state.ts` RunnerStatus union and RunnerState union — every status change cascades to `getState()` switch in `protocol-runner.ts:264`, the render switch in `runner-view.ts:286`, and the resumability check in `getSerializableState` (line 329) + `handleSelectorSelect` (line 230).
- `getSerializableState` whitelist of resumable statuses — must include the new status.
- Phase 28 `NODE_COLOR_MAP` already covers `'snippet'` — no changes here.

</code_context>

<specifics>
## Specific Ideas

- Drill-down picker is the canonical UX — radiologists already think of snippets as a folder tree from Phase 27 work.
- Breadcrumb shows the path RELATIVE to the snippet node's configured root (so radiologists do not see the `.radiprotocol/snippets/...` plumbing prefix).
- "Up" navigation lives in the breadcrumb, not in the row list — keeps the snippet/folder list clean.
- Empty-state copy: "No snippets found in {relative path}" — neutral, no error styling.

</specifics>

<deferred>
## Deferred Ideas

- **Search across all snippets in subfolder** — hybrid drill-down + filter input. Useful on large collections; defer until users report drill-down is too slow.
- **Persist drill-down breadcrumb position across session resume** — minor UX nicety, not worth the serialization complexity now.
- **Recently-used snippets shortcut row** — could surface frequent picks at the top. Defer pending real usage data.
- **"Skip snippet" affordance** — explicitly rejected for Phase 30; revisit only if radiologist feedback demands it.

</deferred>

---

*Phase: 30-snippet-node-runner-integration*
*Context gathered: 2026-04-14*
