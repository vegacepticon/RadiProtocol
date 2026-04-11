# Phase 25: Snippet Node Runner UI - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

When the Protocol Runner halts at a `snippet` node (`at-node` state, `isAtSnippetNode: true`),
it renders a file-picker button. Pressing it opens a `FuzzySuggestModal` scoped to the
configured folder. Selecting a `.md` file reads its raw text and appends it; selecting a `.json`
SnippetFile opens `SnippetFillInModal`; both paths advance the runner on success.

Delivers: `SnippetFilePicker` modal, runner-view branch for `isAtSnippetNode`, folder resolution
logic (per-node override → global setting), `.md`/`.json` dispatch, all error/cancel states.

Does NOT include: Node Editor form for the `folderPath`/`buttonLabel` fields (separate phase),
changes to `SnippetFillInModal`, changes to `SnippetService`.

</domain>

<decisions>
## Implementation Decisions

### File Picker — Display Format
- **D-01:** Files displayed in `FuzzySuggestModal` by **filename only** (e.g., `findings.md`,
  `ct-liver.json`). No path prefix shown. Medical file names are self-descriptive; clean list
  is easier to scan with the eye.

### File Picker — Folder Scope
- **D-02:** Picker includes files **recursively** from the configured folder — `.md` and `.json`
  files in subfolders are included. Allows protocol authors to organise templates by category
  (e.g., `CT/`, `MRI/`). Displayed as filename only (D-01) regardless of depth.

### Cancel Behavior
- **D-03:** Pressing Esc (or otherwise dismissing the picker without selecting a file) **keeps
  the runner on the snippet node** — no advance, no text appended. User can pick again or
  step back. Consistent "cancel = stay" policy across all interactive runner modals in Phase 25.
  Note: this differs from Phase 5 `SnippetFillInModal` cancel (which advanced past the node) —
  that was a text-block node; here the snippet node itself is the halt point.

### Empty Folder
- **D-04:** If the configured folder contains zero `.md` or `.json` files (recursively),
  **do not open the modal** — instead show an Obsidian `Notice`: `"No files found in [folder]"`.
  Runner stays on the snippet node.

### Folder Not Configured
- **D-05:** If both global `snippetNodeFolderPath` (empty string) and per-node `folderPath`
  (undefined) are absent, **do not open the modal** — show Obsidian `Notice`:
  `"Snippet folder not configured. Set a path in plugin Settings → Storage."`.
  Runner stays on the snippet node.

### `.json` Dispatch — Validation
- **D-06:** A `.json` file is treated as a `SnippetFile` if its content parses as valid JSON
  **and** contains the required fields: `id` (string), `name` (string), `template` (string).
  Any `.json` that fails this check shows Notice `"Not a valid snippet file"` and keeps runner
  on the node. This prevents arbitrary JSON files in the folder from crashing the modal.

### `.json` Cancel (SnippetFillInModal)
- **D-07:** If the user cancels `SnippetFillInModal` (opened for a `.json` file), runner
  **stays on the snippet node** — consistent with D-03. This supersedes the Phase 5 D-11 policy
  (skip/advance) which applied to text-block nodes.

### Runner Advance Method
- **D-08:** Phase 25 adds a new `ProtocolRunner` method (e.g., `completeSnippetFile(text, nodeId)`)
  that appends `text` using the snippet node's separator and advances past the node.
  The node separator is resolved via the existing `resolveSeparator(node)` pattern.
  Implementation detail — exact name at Claude's discretion.

### Button Label
- **D-09:** The file-picker button label follows the fallback chain already established in
  Phase 22: `buttonLabel` field → canvas node text → `"Select file"`. No change needed to
  `SnippetNode` model.

### Claude's Discretion
- Exact `FuzzySuggestModal` subclass name (e.g., `SnippetFilePickerModal`)
- Whether to use `app.vault.getFiles()` + filter vs recursive traversal with `TFolder` walk
- Exact Notice wording (minor rewording of the patterns above is fine)
- Whether `ProtocolRunner` advance method is named `completeSnippetFile` or similar

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/ROADMAP.md` §Phase 25 — Success Criteria SC-1…SC-5 (authoritative acceptance criteria)
- `.planning/ROADMAP.md` §Phase 24 — SC-1, SC-2 (snippetNodeFolderPath sentinel behaviour — empty = not configured)

### Existing code to extend
- `src/graph/graph-model.ts` — `SnippetNode` interface (`folderPath?: string`, `buttonLabel?: string`)
- `src/runner/runner-state.ts` — `AtNodeState.isAtSnippetNode?: boolean` (Phase 22 addition)
- `src/runner/protocol-runner.ts` — `resolveSeparator(node)` pattern; `completeSnippet()` as reference for new advance method
- `src/views/runner-view.ts` — `case 'at-node'` switch; `rp-answer-btn` CSS class for button styling
- `src/settings.ts` — `RadiProtocolSettings.snippetNodeFolderPath: string` (Phase 24)

### Reference modals (read before implementing picker)
- `src/views/node-picker-modal.ts` — existing `SuggestModal<T>` pattern in this codebase
- `src/views/snippet-fill-in-modal.ts` — `SnippetFillInModal` for `.json` dispatch

### Architecture context
- `.planning/research/ARCHITECTURE.md` §4 — Snippet data model, `SnippetFile` schema

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NodePickerModal` (`src/views/node-picker-modal.ts`) — `SuggestModal<T>` subclass pattern; copy structure for `SnippetFilePickerModal`
- `SnippetFillInModal` (`src/views/snippet-fill-in-modal.ts`) — already handles `.json` SnippetFile rendering; Phase 25 just opens it
- `rp-answer-btn` CSS class — runner-view answer buttons; Phase 25 button must use this class (SC-1)
- `resolveSeparator(node)` in `protocol-runner.ts` — use for file content append separator
- `app.vault.getFiles()` — Obsidian API method returns all `TFile[]` in vault; filter by path prefix for folder scoping

### Established Patterns
- All DOM construction uses `createEl()`/`createDiv()` — no `innerHTML`
- Services receive `(app, settings)`; views reach services via `this.plugin.*`
- `registerDomEvent()` for all click handlers in `runner-view.ts`
- Error/notice path: `new Notice(...)` for transient user-facing messages
- `runner.syncManualEdit(this.previewTextarea?.value ?? '')` before every advance action (BUG-01 pattern)

### Integration Points
- `runner-view.ts` `case 'at-node'` inner switch: add `case 'snippet':` branch that renders the file-picker button
- `protocol-runner.ts`: add `completeSnippetFile(text, nodeId)` method (append + advance from snippet node)
- `main.ts`: no changes needed — `SnippetFilePickerModal` is constructed in `runner-view.ts` directly

</code_context>

<specifics>
## Specific Ideas

- File-picker button label fallback: `node.buttonLabel ?? canvasNodeText ?? "Select file"` — this
  mirrors the Phase 22 D-02 spec; canvas node text is already in `node` (RPNodeBase has no `text`
  field directly — check how canvas parser maps the canvas node label to `SnippetNode`)
- "Cancel = stay on node" is the consistent policy for ALL dismissals in Phase 25: Esc in picker,
  cancel in SnippetFillInModal, invalid file, empty folder, unconfigured folder
- `.json` validation is lightweight: parse JSON + check `typeof id === 'string'` etc. —
  not full schema validation

</specifics>

<deferred>
## Deferred Ideas

- Node Editor form fields for `folderPath` and `buttonLabel` on snippet nodes — separate phase
- Snippet node step-back semantics after file insertion — already handled by `resolveSeparator` +
  undo stack push in the advance method (implementation detail)
- Preview of `.md` file content before inserting — nice UX, not in SC

</deferred>

---

*Phase: 25-snippet-node-runner-ui*
*Context gathered: 2026-04-11*
