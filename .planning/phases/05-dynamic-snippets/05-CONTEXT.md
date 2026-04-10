# Phase 5: Dynamic Snippets — Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Protocol authors can attach reusable text snippets with labeled placeholder fields to any
text-block node. During a session the runner opens a fill-in modal with live preview, and the
completed text is appended to the accumulated report.

Delivers: `SnippetService` CRUD, per-snippet JSON files, `SnippetFillInModal`, `SnippetManagerView`
full UI, runner integration (`awaiting-snippet-fill` → `completeSnippet`), `WriteMutex`.

Does NOT include: loop support (Phase 6), session save/resume (Phase 7), linked placeholders
across sections, optional sections, or mandatory field enforcement.

</domain>

<decisions>
## Implementation Decisions

### Snippet Manager Layout (SnippetManagerView)
- **D-01:** Master-detail two-column layout. Left column: scrollable list of snippet names with a
  **[+ New snippet]** button at the top. Right column: edit form for the selected snippet —
  Name field, Template textarea, Placeholders section with [+ Add placeholder], and
  **[Save] [Delete]** buttons at the bottom.
- **D-02:** When no snippet is selected (empty state or brand-new vault), the right column shows
  a prompt: *"Select a snippet to edit, or click + New snippet to create one."* No blank form.
- **D-03:** [+ New snippet] creates an unsaved draft entry in the list (e.g., "Untitled") and
  immediately selects it so the user can start filling in the name and template.

### Placeholder Authoring Flow
- **D-04:** Under the Template textarea, a **[+ Add placeholder]** button opens a mini-form
  (inline, not a separate modal) with two fields: Label (human-readable, e.g. "Age") and Type
  (dropdown: free-text / choice / multi-choice / number). On confirm, the button:
  1. Auto-generates an `id` by slugifying the label (e.g. "Patient age" → `patient-age`)
  2. Inserts `{{patient-age}}` at the current cursor position in the Template textarea
  3. Appends a new placeholder row to the Placeholders list below the textarea
  Raw `id` values are never shown to users — only the human-readable label is visible
  in the manager and in the fill-in modal (SNIP-03).
- **D-05:** Existing placeholder rows in the list show: label, type, and an inline **[×]** remove
  button. For `choice`/`multi-choice` types, clicking the row expands options input inline
  (not a separate screen). Removing a placeholder does NOT auto-remove `{{id}}` from the
  template — a warning badge highlights orphaned references so the author can fix them manually.

### Choice/Multi-choice Options Input
- **D-06:** Options for `choice` and `multi-choice` placeholders are entered as **individual text
  fields with [×] remove buttons** and a **[+ Add option]** button at the bottom of the list.
  One field per option, rendered vertically. No textarea/comma-separated approach — individual
  fields prevent ambiguity in options that contain commas and make reordering intent clear.
- **D-07:** `multi-choice` placeholders have an additional **Join separator** field (default: `", "`)
  that defines how selected values are concatenated into the final text. Visible only for
  `multi-choice` type.
- **D-08:** `number` placeholders show a single **Unit** text field (optional, e.g. `mm`, `cm`).
  When unit is provided, the rendered output is `{value} {unit}` (e.g. `12 mm`).

### SNIP-09: Free-text Override for Choice Fields (included)
- **D-09:** During snippet fill-in, every `choice` and `multi-choice` field shows the predefined
  options (radio buttons for `choice`, checkboxes for `multi-choice`) **plus** a
  **"Custom: [text input]"** field at the bottom of the option list. Typing in the custom field
  auto-deselects any radio/checkbox selection. The custom value is used as-is in the rendered
  output, exactly like a selected predefined option (SNIP-09 "Should have" — included).

### Fill-in Modal (SnippetFillInModal)
- **D-10:** `SnippetFillInModal` extends Obsidian's `Modal` class. It is opened by `RunnerView`
  when `runner.getState().status === 'awaiting-snippet-fill'`. After the user confirms,
  `RunnerView` calls `runner.completeSnippet(renderedText)` with the fully-rendered string.
  The modal has zero knowledge of the runner — it receives a `SnippetFile` and returns a
  rendered string (or null on cancel).
- **D-11:** Cancel behavior: if the user closes/cancels the fill-in modal, the snippet is **skipped**
  (runner advances past the text-block node without appending any text). This mirrors the existing
  `awaiting-snippet-fill → at-node` cancel transition defined in ARCHITECTURE.md.
- **D-12:** Tab-navigation between placeholder fields uses standard HTML tab order — fields are
  rendered in `placeholders[]` array order. A visible **[Confirm]** button is the last tab stop
  (SNIP-04).
- **D-13:** Live preview is a read-only textarea at the bottom of the modal, updated on every
  keystroke/selection change. Shows the full rendered snippet text with current placeholder
  values substituted (SNIP-05).

### SnippetService
- **D-14:** `SnippetService` receives `this.app` and `settings` in its constructor (standard
  service pattern — no Obsidian imports in the module itself; vault calls go through the `app`
  parameter). Implements: `list()`, `load(id)`, `save(snippet)`, `delete(id)`, `exists(id)`.
- **D-15:** Snippet files stored at `.radiprotocol/snippets/{snippet.id}.json`. Folder ensured
  via `vault.createFolder()` before every write (SNIP-08). `WriteMutex` (per-file key = full
  path) wraps every `vault.modify()` call (SNIP-07). `async-mutex` is the backing library
  (already listed in STACK.md).
- **D-16:** `SnippetPlaceholder` interface in `snippet-model.ts` needs three new optional fields
  added: `options?: string[]` (for choice/multi-choice), `unit?: string` (for number),
  `joinSeparator?: string` (for multi-choice, default `", "`). The `SnippetFile` interface
  already has the correct shape — no other changes needed.

### Runner Integration
- **D-17:** `RunnerView` already handles `awaiting-snippet-fill` state detection (Phase 3 stub
  renders a placeholder message). Phase 5 replaces that stub with the real `SnippetFillInModal`
  open call. No structural changes to `ProtocolRunner` — `completeSnippet()` is already
  implemented and tested (Phase 2 D-06/D-07).

### Claude's Discretion
- Exact styling (padding, colors, font sizes) for the snippet manager and fill-in modal
- Whether [Save] triggers on every field change (auto-save) or only on explicit button click
- Error message wording for missing snippet folder, corrupt JSON, or save failures
- Exact tab-stop order within the snippet manager form

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §SNIP — SNIP-01 through SNIP-09 (all snippet requirements)

### Architecture and research
- `.planning/research/ARCHITECTURE.md` §4 (Snippet Data Model — SnippetFile schema, template
  syntax `{{id}}`, placeholder types, file naming convention)
- `.planning/research/SUMMARY.md` §Phase 5 (rationale, scope, avoids list, research flag on
  Modal vs inline)
- `.planning/research/STACK.md` — `async-mutex` dependency entry

### Existing stubs to implement
- `src/snippets/snippet-model.ts` — `SnippetFile` + `SnippetPlaceholder` interfaces (extend
  with `options`, `unit`, `joinSeparator` fields in Phase 5)
- `src/snippets/snippet-service.ts` — `SnippetService` class (full implementation needed)
- `src/utils/write-mutex.ts` — `WriteMutex` class (full implementation needed)
- `src/utils/vault-utils.ts` — `ensureFolderPath()` (implement with `vault.createFolder()`)
- `src/views/snippet-manager-view.ts` — `SnippetManagerView` (full UI needed)

### Existing integration points (read-only — do not change)
- `src/runner/runner-state.ts` — `AwaitingSnippetFillState` interface (snippetId, nodeId)
- `src/runner/protocol-runner.ts` — `completeSnippet(renderedText)` already implemented
- `src/graph/graph-model.ts` — `TextBlockNode.snippetId?: string` already in model
- `src/views/runner-view.ts` — needs `awaiting-snippet-fill` branch wired to modal (stub exists)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SnippetFile` + `SnippetPlaceholder` interfaces already typed correctly in
  `src/snippets/snippet-model.ts` — Phase 5 only adds three optional fields to `SnippetPlaceholder`
- `AwaitingSnippetFillState` interface already defined in `src/runner/runner-state.ts`
- `runner.completeSnippet(renderedText)` already implemented and tested in Phase 2
- `SnippetManagerView` stub already registered as an ItemView — just needs `onOpen()` filled in
- `WriteMutex` stub class exists at `src/utils/write-mutex.ts` — ready for implementation
- `ensureFolderPath()` stub in `src/utils/vault-utils.ts` — needs vault.createFolder() implementation
- Obsidian `Modal` class: extend with `onOpen()` to build the fill-in UI (no plugin registration needed)
- `registerDomEvent()` pattern already used throughout `runner-view.ts` and `editor-panel-view.ts`

### Established Patterns
- Services receive `(app: App, settings: RadiProtocolSettings)` — views receive `(leaf, plugin)`
- All DOM construction uses `createEl()`/`createDiv()`/`createSpan()` — no `innerHTML` ever
- Plugin as service locator: views reach `SnippetService` via `this.plugin.snippetService`
- `vault.modify()` always preceded by `vault.adapter.exists()` or `vault.create()` guard
- `async-mutex` already listed as a dependency in STACK.md — import `Mutex` from `'async-mutex'`

### Integration Points
- `RunnerView.render()` switch on `runner.getState().status`: add `case 'awaiting-snippet-fill'`
  branch that calls `new SnippetFillInModal(this.app, snippet).open()` and awaits the result
- `SnippetService` instantiated in `main.ts` `onload()` and stored as `this.snippetService`
- Snippet folder path comes from `settings.snippetFolderPath` (default `.radiprotocol/snippets`)
- `open-snippet-manager` command already wired in ARCHITECTURE.md `main.ts` diagram — needs
  implementation in Phase 5

</code_context>

<specifics>
## Specific Ideas

- Master-detail layout confirmed: list left, form right (standard IDE/settings panel feel)
- "Add placeholder" button inserts `{{id}}` at cursor + appends row — single gesture, no manual
  syntax typing required for non-technical users (radiologists)
- Choice options: individual +/- fields, not textarea — avoids comma ambiguity in medical terms
- Free-text override field (Custom:) shown below all choice options during fill-in — always
  visible, doesn't require a separate "Other" option in the list
- Cancel fill-in = skip snippet (no text appended) — matches existing runner cancel semantics

</specifics>

<deferred>
## Deferred Ideas

- Linked placeholders across report sections — out of scope, noted in REQUIREMENTS.md Out of Scope
- Optional sections in snippets (conditional blocks) — deferred to v2
- Snippet preview in `SnippetManagerView` with sample values — could be added as a stretch goal
  but is not required; SNIP-05 covers preview in the fill-in modal, not the manager
- Drag-to-reorder placeholder rows — nice UX, deferred; not required by any SNIP requirement
- Mandatory field enforcement (warn if placeholder left blank) — policy deferred per
  REQUIREMENTS.md Out of Scope ("Plugin should warn, never block")

</deferred>

---

*Phase: 05-dynamic-snippets*
*Context gathered: 2026-04-06*
