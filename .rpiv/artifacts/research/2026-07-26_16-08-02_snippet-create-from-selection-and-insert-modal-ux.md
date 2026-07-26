---
date: 2026-07-26T16:08:02+0300
author: Roman Shulgha
commit: 946c20f
branch: main
repository: RadiProtocol
topic: "Create snippet from selected text (Runner footer + command) and Insert snippet modal UX fixes (jumping, keyboard nav, name-only display)"
tags: [research, codebase, snippet-editor-modal, inline-runner-modal, insert-snippet-modal, snippet-tree-picker, snippet-service, main]
status: ready
last_updated: 2026-07-26T16:08:02+0300
last_updated_by: Roman Shulgha
---

# Research: Create snippet from selected text (Runner footer + command) and Insert snippet modal UX fixes

## Research Question

The user wants two feature clusters:

1. **Create snippet from selected text** — both (a) from inside the Runner (an icon in the Runner modal that, after selecting text, opens the snippet editor pre-filled with the selection, so the user can add placeholders, edit, and save to a chosen directory) and (b) directly via a command-line command.

2. **Insert snippet modal UX fixes** — when running the "Insert snippet" command, the picker modal "jumps"/recenters on every keystroke; the user wants it pinned near the top with results expanding/shrinking downward. Additionally: arrow-key navigation + Enter to insert (in addition to mouse), and display only the snippet name (not name + path) in search results.

## Summary

The codebase already has every building block. The single biggest gap for the "create from selection" flow is that `SnippetEditorOptions` (`src/views/snippet-editor-modal.ts:30-48`) has **no field to pre-fill the template body** — `emptyMdTemplateDraft()` (`src/views/snippet-editor-modal.ts:71-83`) hard-codes `template: ''`. Adding an optional `initialTemplate?: string` option and threading it into the factory is the one change that lights up both the Runner icon flow and the standalone command, because the chip editor (`mountChipEditor`) reads `draft.template` directly (`src/views/snippet-chip-editor.ts` initializes its textarea from `draft.template`), and `handleSave()` spreads `this.draft` into the save payload (`src/views/snippet-editor-modal.ts:536-537`) which `SnippetService.save()` serializes via `serializeMarkdownTemplate` (`src/snippets/snippet-service.ts:228`). No chip-editor or save-pipeline changes are required.

The Insert snippet modal "jumping" has a documented prior fix (`fed8242` — DOM teardown moved AFTER the async `listFolderDescendants` await + staleness guard) that eliminated the *blank-jump-during-await*. However, the *height-change recentering* is still live: `InsertSnippetModal` uses host class `.rp-insert-snippet-picker-host` (`src/views/insert-snippet-modal.ts:31`), which gets only width CSS (`src/styles/snippet-tree-picker.css:222-228`) — it does **not** receive the `height: 360px` treatment that `.rp-stp-modal-host .rp-stp-body` gets (`src/styles/snippet-tree-picker.css:27`). After the await, `renderSearchResults()` calls `removeBody(host)` (`src/views/snippet-tree-picker.ts`) then rebuilds a bare `.rp-stp-list` directly on `host` (no `.rp-stp-body` wrapper), so the modal's content height shrinks then grows, and Obsidian's `Modal` vertical auto-centering recenters on every keystroke. The fix is to (a) pin the modal via a scoped `modalEl` CSS class (following the `SnippetEditorModal` pattern at `src/views/snippet-editor-modal.ts:151-153`) overriding Obsidian's vertical centering, and (b) stabilize the body height so removal+rebuild doesn't change outer dimensions.

Keyboard navigation and name-only display are both localized to `SnippetTreePicker`: there is no `keydown` listener anywhere (`src/views/snippet-tree-picker.ts` registers only an `'input'` listener on the search box), and the two-line name+path display is gated purely by the `isSearchResult` flag in `renderFileRow()` (`src/views/snippet-tree-picker.ts:377-380`).

## Detailed Findings

### SnippetEditorModal — Pre-filling the Template Field (Create Mode)

- `SnippetEditorOptions` (`src/views/snippet-editor-modal.ts:30-48`) defines `mode`, `initialFolder`, `snippet?` (edit only), `initialKind?: never` (deprecated), `snippetServiceOverride?`, `disableFolderPicker?`. **No `initialTemplate`/`initialContent` field exists.** Optional-field extension is the established pattern here (`snippetServiceOverride`, `disableFolderPicker`, `initialKind` were all added without breaking callers).
- `emptyMdTemplateDraft(folder, locale, cat)` (`src/views/snippet-editor-modal.ts:71-83`) returns an `MdTemplateSnippet` with `template: ''` and `placeholders: []`. The `path` is a placeholder (`folder + '/.md'`); the real path is computed at save time by `computeCandidatePath()` (`src/views/snippet-editor-modal.ts:280-284`).
- The constructor's create-mode branch (`src/views/snippet-editor-modal.ts:129-137`) sets `draftKind = 'md-template'`, `currentFolder = options.initialFolder`, then calls `emptyMdTemplateDraft(currentFolder, plugin.settings.locale ?? 'ru', basename(currentFolder))`. This is the single call site that must thread a new `initialTemplate` parameter through.
- `onOpen()` (`src/views/snippet-editor-modal.ts:152`) renders title, type row, folder dropdown, name input, validation banner, then creates `contentRegionEl` and calls `renderContentRegion()` (`src/views/snippet-editor-modal.ts:188-190`).
- `renderContentRegion()` (`src/views/snippet-editor-modal.ts`) branches on `draftKind`; for `md-template` it calls `mountChipEditor(this.contentRegionEl, templateDraft, onChangeCb, { skipName: true, t })`, passing the *same* `this.draft` object by reference. No copy.
- The existing production create-mode consumer is `SnippetManagerView.openCreateModal()` (`src/views/snippet-manager-view.ts:258-267`), invoked by the "+ New" button (`src/views/snippet-manager-view.ts:80`) with `this.plugin.settings.snippetFolderPath`. It passes only `{ mode: 'create', initialFolder }`. Because the new `initialTemplate` field will be optional, this caller compiles unchanged.

### Chip Editor — Pre-filled Text Flows Through With Zero Changes

- `mountChipEditor(container, draft, onChange, options)` (`src/views/snippet-chip-editor.ts`) initializes its textarea with `templateArea.value = draft.template` — the single initialization point. If `draft.template` is the selected text (set via the new factory parameter), the textarea displays it immediately on mount.
- Every keystroke writes back `draft.template = templateArea.value` and calls `onChange()` which sets `this.hasUnsavedChanges = true` in the modal — so the unsaved-changes guard (the `close()` override at `src/views/snippet-editor-modal.ts:167-173` running `ConfirmModal`) engages automatically when the user edits the pre-filled text.
- `insertAtCursor(textarea, text)` (`src/views/snippet-chip-editor.ts`) splices `{{placeholderId}}` tokens at the cursor and dispatches an `input` event. The user places the cursor inside the pre-filled text and clicks "Add placeholder" — the chip coexists with the free text in the same `template` string. The chip editor does not distinguish "user-typed" from "pre-filled" text.
- One behavioral note: `refreshOrphanBadges()` scans `draft.template` for `{{...}}` tokens and flags any whose id isn't in `draft.placeholders`. If the selected text already contains `{{someId}}` tokens, those will show as orphan badges on mount. Benign, but worth knowing.
- **Conclusion:** pre-filled text flows naturally through the existing chip editor. The only required change is upstream in `snippet-editor-modal.ts` (interface + factory + constructor call site). No changes to `snippet-chip-editor.ts`.

### Save Pipeline — `handleSave()` → `SnippetService.save()`

- `handleSave()` (`src/views/snippet-editor-modal.ts`) validates name non-empty, computes `newPath = this.computeCandidatePath()` (`currentFolder + '/' + normalizeSnippetBasename(name) + '.md'`), then builds `draftToSave` by spreading `this.draft` with `path: newPath` (`src/views/snippet-editor-modal.ts:536-537` for md-template). The pre-filled `template` propagates untouched via the spread.
- In create mode (`this.options.mode === 'create'`), it calls `await this.snippetService().save(draftToSave)` then `safeResolve({ saved: true, snippet: draftToSave, movedFrom: null })` + `super.close()`. The `snippetService()` accessor returns `this.options.snippetServiceOverride ?? this.plugin.snippetService`.
- `SnippetService.save(snippet)` (`src/snippets/snippet-service.ts:212-241`) validates the path via `assertInsideRoot()` (rejects traversal/out-of-root), acquires a per-path `WriteMutex`, `ensureFolderPath`s the root + parent, serializes (`md-template` → `serializeMarkdownTemplate(snippet)` at line 228), then `vault.adapter.write` if exists else `vault.create`. The save is idempotent for existing files and creates new ones; `ensureFolderPath` means folders need not be pre-created.
- `serializeMarkdownTemplate()` (`src/snippets/md-template.ts`) emits YAML frontmatter (`id`, `name`, `lang`, `category`, `placeholders`) then the template body. The pre-filled string becomes `snippet.template` and is appended after the closing `---`.
- A standalone command-line "create snippet" command should **delegate to the modal** (Approach A) rather than call `SnippetService.save()` directly (Approach B): Approach A reuses collision detection (`runCollisionCheck`), `computeCandidatePath()`, folder picker, and the chip editor for free. Approach B would reimplement slugification (`normalizeSnippetBasename` at `src/views/snippet-editor-modal.ts:68-70`) and would silently overwrite existing files (the modal's collision guard prevents this).

### `SnippetEditorModal.result` — Promise-Based Result Pattern

- `result: Promise<SnippetEditorResult>` is declared readonly and initialized in the constructor (`src/views/snippet-editor-modal.ts:85-86, 144-146`).
- `SnippetEditorResult` (`src/views/snippet-editor-modal.ts:28-30`) is a discriminated union: `{ saved: true; snippet: Snippet; movedFrom: string | null } | { saved: false; duplicatedTo?: string }`.
- `safeResolve()` (`src/views/snippet-editor-modal.ts:676-680`) is idempotent (`this.resolved` guard) — double-close (Esc + onClose) cannot double-resolve.
- Create-mode success resolves at `src/views/snippet-editor-modal.ts:553` with `{ saved: true, snippet: draftToSave, movedFrom: null }` then calls `super.close()`. The snippet is already on disk via `SnippetService.save()` before the resolve fires.
- Caller pattern (`SnippetManagerView.openCreateModal()` at `src/views/snippet-manager-view.ts:258-267`): `const modal = new SnippetEditorModal(...); modal.open(); const result = await modal.result; if (result.saved) { /* refresh tree */ }`. The Runner does NOT own a tree view, so its post-save handler only needs an optional `Notice` — the snippet is already persisted.

### InlineRunnerModal — Footer Structure & Where the Create-Snippet Icon Goes

- `InlineRunnerModal` (`src/views/inline-runner-modal.ts`) is a **plain class** (NOT an Obsidian `Modal` subclass) that builds its own DOM in `buildContainer()` (`src/views/inline-runner-modal.ts:301-344`) and re-renders on every state change via `render()`.
- `buildContainer()` creates: `containerEl` (`rp-inline-runner-container`), `headerEl` (drag handle + progress), `contentEl` (`rp-inline-runner-content`, scrollable text), `actionsEl` (answer buttons), `footerBtnRowEl` (`rp-inline-runner-footer-btn-row`). The close button is created here at `src/views/inline-runner-modal.ts:337-343`.
- **Critical:** `render()` (`src/views/inline-runner-modal.ts:426-434`) destroys ALL footer children and recreates the close button on every render. Any icon added only in `buildContainer()` would be wiped on the first re-render. The new create-snippet icon must be re-added in the `render()` footer-rebuild block (the close-button recreation at :426-434) to persist across renders.
- `renderFooterIcons()` (`src/views/inline-runner-modal.ts:554-596`) appends Back/Redo/Skip into a separate `iconsGroup` div, but only in `at-node` state. The footer thus has two zones: close (left, always) + iconsGroup (right, conditional).
- **Decision (recorded):** the create-snippet icon will be always-visible in the footer, recreated on every `render()` next to the close button, and disabled (greyed) until text is selected in `contentEl`.
- The icon-button pattern to copy is the Back button at `src/views/inline-runner-modal.ts:563-571`: `createButton(iconsGroup, { cls: 'rp-runner-icon-btn', attr: { 'aria-label': t(...) } })` + `setIcon(btn, 'lucide-name')` + `btn.addEventListener('click', ...)`.

### InlineRunnerModal — Text Selection Detection

- `contentEl` (`src/views/inline-runner-modal.ts:325-326`) is a plain `div`. Question text is rendered by `renderQuestionAtNode()` (`src/runner/render/render-question.ts`) as `<p class="rp-question-text">{node.questionText}</p>` via `textZone.createEl('p', { text: node.questionText, cls: 'rp-question-text' })`.
- There is currently no text-selection mechanism. `window.getSelection()` + `selection.toString()` is the browser API. A `mouseup` (and/or `selectionchange`) listener on `contentEl` detects selection. The existing listener add/remove lifecycle (e.g. `boundKeyHandler` at `src/views/inline-runner-modal.ts:196` added in `open()`, removed in `close()` at :213-216) is the pattern to follow for a `boundSelectionHandler`.
- `InlineRunnerModal.handleKeydown()` (`src/views/inline-runner-modal.ts:672-695`) bails immediately when the event target is `INPUT`/`TEXTAREA` (`src/views/inline-runner-modal.ts:674-676`), so it will not interfere with any new picker keyboard nav.
- Snippet folder root comes from `this.plugin.settings.snippetFolderPath` (used at `src/views/inline-runner-modal.ts:64, 837, 873`) — this is the `initialFolder` to pass to `SnippetEditorModal` in create mode.

### InsertSnippetModal — The Jumping Behavior

- Command registration: `addCommand({ id: 'insert-snippet', ... })` (`src/main.ts:96-100`) → `handleInsertSnippet()` (`src/main.ts`) constructs `new InsertSnippetModal(this.app, this)`, `modal.open()`, `await modal.result`, then `editor.replaceSelection(rendered)` + a success `Notice`.
- `InsertSnippetModal` (`src/views/insert-snippet-modal.ts:8`) **extends Obsidian's `Modal`**, which auto-centers `.modal` vertically based on content height. `onOpen()` (`src/views/insert-snippet-modal.ts:21-43`) creates `.rp-insert-snippet-picker-host` (`:31`) and mounts `SnippetTreePicker` in `file-only` mode.
- DOM structure: `.modal` (auto-centered) > `.modal-content` (= `contentEl`) > `.rp-insert-snippet-picker-host` > `.rp-stp-root` > `.rp-stp-search` (input) + `.rp-stp-body` (breadcrumb + list).
- Search path: `input` listener (`SnippetTreePicker.mount()` registers only an `'input'` listener on the search box) → `onSearchInput()` sets `currentQuery` + starts a 120ms debounce timer (`SEARCH_DEBOUNCE_MS = 120`) → `applySearch()` → `renderSearchResults(query)`.
- `renderSearchResults()` (`src/views/snippet-tree-picker.ts`) does: `await snippetService.listFolderDescendants(rootPath)` (BFS traversal, `src/snippets/snippet-service.ts` — async per-folder `vault.adapter.list` calls), stale-query guard, then `removeListenersExceptSearch()` + `removeBody(host)` (height **shrinks** — only `.rp-stp-search` remains, ~28px) then `host.createDiv({ cls: 'rp-stp-list' })` (height **grows** as rows render). The new list is created **directly on `host`**, NOT wrapped in `.rp-stp-body`, so the `min-height: 280px` rule does not apply to search results.
- The jump has two causes: (1) async gap between debounce fire and vault scan completion — **already mitigated** by the `fed8242` fix (DOM teardown moved after the await; the old body stays visible during the await per the comment at the top of `renderSearchResults()`); (2) body removal + rebuild after results arrive — **still live**, changes content height and triggers Obsidian's Modal recentering.

### InsertSnippetModal — CSS Layer & How to Pin

- `.rp-insert-snippet-picker-host` CSS (`src/styles/snippet-tree-picker.css:222-228`): width/max-width/min-width/box-sizing only — **no height constraint**.
- `.rp-stp-body { min-height: 280px }` (`src/styles/snippet-tree-picker.css:14-23`, value at :20) stabilizes the drill view, but search results are not wrapped in `.rp-stp-body` so this doesn't apply during search.
- `.rp-stp-modal-host .rp-stp-body { height: 360px }` (`src/styles/snippet-tree-picker.css:27`) and `.rp-stp-modal-host .rp-stp-list { min-height: 240px }` (`src/styles/snippet-tree-picker.css:249-250`) — these apply only to `.rp-stp-modal-host` (Snippet Manager "Move to…" modal). `InsertSnippetModal` uses `.rp-insert-snippet-picker-host`, so it gets **neither** fixed-height treatment. This is the key CSS gap.
- `.rp-stp-list { max-height: 320px; overflow-y: auto }` (`src/styles/snippet-tree-picker.css:148`) applies generically, but with no `min-height` in the insert-snippet context the list can collapse to ~0 rows then grow.
- The `SnippetEditorModal` pattern (`src/views/snippet-editor-modal.ts:151-153`) casts `this` to access the protected `modalEl` and adds `modalEl.addClass('rp-snippet-editor-modal')`, with CSS at `src/styles/snippet-manager.css` scoping width overrides to `.rp-snippet-editor-modal`. `SnippetFillInModal` follows the identical pattern (`src/views/snippet-fill-in-modal.ts:57-59`, CSS `src/styles/snippet-fill-modal.css`). `InsertSnippetModal` currently adds **no** `modalEl` class — this is the seam for pinning.
- **Fix shape:** add `modalEl.addClass('rp-insert-snippet-modal')` in `InsertSnippetModal.onOpen()`, add CSS overriding Obsidian's vertical centering (pin near top: `margin-top`/`top:0; bottom:auto`), and stabilize the body height (either add `.rp-insert-snippet-picker-host .rp-stp-list { min-height: <px> }` to prevent collapse during rebuild, or wrap search results in `.rp-stp-body` so `min-height: 280px` applies, or both).

### SnippetTreePicker — Name-Only Display

- `renderFileRow()` (`src/views/snippet-tree-picker.ts`) builds the row: a `.rp-stp-result-name` div (glyph + `.rp-stp-row-title` with `basename`), then **conditionally** creates `.rp-stp-result-path` with `relativePath` only when `isSearchResult === true` (`src/views/snippet-tree-picker.ts:377-380`). Drill-view rows (`isSearchResult: false`) are already name-only.
- `renderFolderRow()` mirrors this: a path div is created only for search-result folder rows.
- The two call-sites: `renderSearchResults()` calls `renderFileRow(listEl, m, /* isSearchResult */ true)` and `renderFolderRow(listEl, m.relativePath, true)` — always `true` for search results. `renderDrillView()` passes `false`. So the path is shown only in search results.
- `SnippetTreePickerOptions` (`src/views/snippet-tree-picker.ts:62-72`) has **no flag** to suppress the path line.
- CSS `.rp-stp-result-path` (`src/styles/snippet-tree-picker.css:197-208`) renders as muted, smaller-font text below the name; the parent row is `flex-direction: column` so name + path stack vertically.
- **Decision (recorded):** add a `hideSearchResultPath?: boolean` option flag to `SnippetTreePickerOptions` (default `false`), pass `true` from `InsertSnippetModal` only. Preserves disambiguation in Snippet Manager move-to (folder-only/both mode) where same-named snippets in different folders need the path to tell apart. The guard in `renderFileRow()` becomes `if (isSearchResult && !this.options.hideSearchResultPath)`. The unused `.rp-stp-result-path` CSS can be left in place.

### SnippetTreePicker — Keyboard Navigation

- `mount()` (`src/views/snippet-tree-picker.ts`) registers exactly **one** listener: `'input'` on the search box. There is **no `keydown` listener** on the search input, container, or root.
- Row click handlers are registered in `renderFolderRow()` and `renderFileRow()` via `addListener(row, 'click', ...)`. Rows are `<button>` elements (via `createButton`), so natively focusable, but `Enter`/`Space` only fire the row's own click handler when the **row itself** has DOM focus — not when the search input has focus.
- There is **no** highlighted-row state field, **no** `tabindex`/`aria-activedescendant`/`aria-selected` wiring, **no** `.is-highlighted` class. Instance fields (`drillPath`, `currentQuery`, `searchDebounceTimer`, `containerEl`, `listeners`, `searchInputEl`, `committedRelativePath`) track no row index.
- `removeListenersExceptSearch()` (`src/views/snippet-tree-picker.ts`) keeps only the search-input `'input'` listener across re-renders — it drops everything else. **A new `keydown` listener on the search input would be dropped** by this method unless the keep-condition is broadened to also preserve `entry.type === 'keydown'` on `searchInputEl`. This is the single listener-lifecycle intersection point.
- `InlineRunnerModal.handleKeydown()` (`src/views/inline-runner-modal.ts:672-695`) bails for `INPUT`/`TEXTAREA` targets, so arrow keys typed in the picker's search box won't be consumed by the runner's container-level handler. No conflict.
- Both picker consumers (`InsertSnippetModal.onOpen()` at `src/views/insert-snippet-modal.ts:32` and `renderSnippetPicker()` at `src/runner/render/render-snippet-picker.ts:90`) wire `onSelect` — keyboard `Enter` would dispatch the same `onSelect` callback, flowing through the identical load/guard/close path. No consumer-side changes needed.
- i18n: the `snippetTreePicker` namespace (`src/i18n/locales/en.json`) has no keyboard/aria-hint strings. The existing `selectSnippet` key is defined but unused. New keys (e.g. for highlight aria-label) must be added to **both** `en.json` and `ru.json`.
- **Decision (recorded):** implement keyboard nav **inside `SnippetTreePicker` itself** so every consumer gets it for free (Insert snippet modal + Runner snippet-pick). Add a `highlightedIndex`/`highlightedRowEl` field, a `keydown` listener on the search input handling `ArrowUp`/`ArrowDown`/`Enter`, `row.scrollIntoView({ block: 'nearest' })`, a `.rp-stp-row-highlighted` class, and reset the highlight on every re-render (the old DOM is removed via `removeBody`). Broaden `removeListenersExceptSearch()` to preserve the keydown listener.

## Code References

- `src/views/snippet-editor-modal.ts:28-30` — `SnippetEditorResult` discriminated union
- `src/views/snippet-editor-modal.ts:30-48` — `SnippetEditorOptions` interface (no `initialTemplate` field)
- `src/views/snippet-editor-modal.ts:71-83` — `emptyMdTemplateDraft()` factory hard-coding `template: ''`
- `src/views/snippet-editor-modal.ts:129-137` — constructor create-mode branch calling the factory
- `src/views/snippet-editor-modal.ts:144-146` — `result` promise initialization
- `src/views/snippet-editor-modal.ts:151-153` — `modalEl.addClass('rp-snippet-editor-modal')` CSS-scoping pattern
- `src/views/snippet-editor-modal.ts:280-284` — `computeCandidatePath()` (folder + slug + ext)
- `src/views/snippet-editor-modal.ts:536-537` — md-template `draftToSave` spread (carries pre-filled template)
- `src/views/snippet-editor-modal.ts:553` — create-mode success `safeResolve`
- `src/views/snippet-editor-modal.ts:676-680` — idempotent `safeResolve()`
- `src/views/snippet-chip-editor.ts` — `mountChipEditor`: `templateArea.value = draft.template` init + `draft.template = templateArea.value` write-back; `insertAtCursor()` splices `{{id}}` tokens
- `src/views/insert-snippet-modal.ts:8` — `InsertSnippetModal extends Modal`
- `src/views/insert-snippet-modal.ts:21-43` — `onOpen()`: creates `.rp-insert-snippet-picker-host`, mounts `SnippetTreePicker` `file-only`
- `src/views/inline-runner-modal.ts:301-344` — `buildContainer()` DOM shell
- `src/views/inline-runner-modal.ts:325-326` — `contentEl` plain div (selection source)
- `src/views/inline-runner-modal.ts:337-343` — close button (initial render, overwritten by `render()`)
- `src/views/inline-runner-modal.ts:426-434` — `render()` footer teardown + close-button recreation
- `src/views/inline-runner-modal.ts:554-596` — `renderFooterIcons()` icon-button pattern (Back/Redo/Skip)
- `src/views/inline-runner-modal.ts:672-695` — `handleKeydown()` bails for INPUT/TEXTAREA targets
- `src/views/snippet-tree-picker.ts:62-72` — `SnippetTreePickerOptions` (no `hideSearchResultPath`/keyboard flag)
- `src/views/snippet-tree-picker.ts` — `mount()`: only `'input'` listener on search box; `onSearchInput()` 120ms debounce; `applySearch()`; `renderSearchResults()` (await → stale guard → `removeBody` → rebuild bare `.rp-stp-list`); `renderFileRow()` path div gated by `isSearchResult` (`:377-380`); `removeListenersExceptSearch()` keeps only search-input `input`
- `src/snippets/snippet-service.ts:212-241` — `save()`: `assertInsideRoot` + `WriteMutex` + `ensureFolderPath` + serialize + write/create
- `src/snippets/snippet-service.ts:228` — `md-template` → `serializeMarkdownTemplate(snippet)`
- `src/styles/snippet-tree-picker.css:14-23` (value :20) — `.rp-stp-body { min-height: 280px }`
- `src/styles/snippet-tree-picker.css:27` — `.rp-stp-modal-host .rp-stp-body { height: 360px }`
- `src/styles/snippet-tree-picker.css:148` — `.rp-stp-list { max-height: 320px; overflow-y: auto }`
- `src/styles/snippet-tree-picker.css:197-208` — `.rp-stp-result-path` styling
- `src/styles/snippet-tree-picker.css:222-228` — `.rp-insert-snippet-picker-host` (width-only, no height)
- `src/styles/snippet-tree-picker.css:249-250` — `.rp-stp-modal-host .rp-stp-list { min-height: 240px }` (not applied to insert host)
- `src/views/snippet-manager-view.ts:74-81` — "+ New" button → `openCreateModal(snippetFolderPath)`
- `src/views/snippet-manager-view.ts:258-267` — `openCreateModal()` reference pattern (`new SnippetEditorModal` → `open()` → `await modal.result`)
- `src/main.ts:96-100` — `insert-snippet` command registration pattern
- `src/main.ts` — `handleInsertSnippet()`: `getActiveViewOfType(MarkdownView)` + `editor.replaceSelection` + `Notice` convention
- `src/runner/render/render-snippet-picker.ts:90` — Runner's snippet-pick consumer of `SnippetTreePicker`
- `src/runner/render/render-question.ts` — `textZone.createEl('p', { text: node.questionText, cls: 'rp-question-text' })`

## Integration Points

### Inbound References
- `src/views/snippet-manager-view.ts:80` — "+ New" button calls `openCreateModal(this.plugin.settings.snippetFolderPath)`
- `src/views/snippet-manager-view.ts:114` — tree-renderer create callback routes to `openCreateModal`
- `src/main.ts:96-100` — `insert-snippet` command → `handleInsertSnippet()` → `new InsertSnippetModal`
- `src/views/inline-runner-modal.ts:446` — `renderQuestionAtNode(this.contentEl, ...)` renders question text into the runner content zone
- `src/runner/render/render-snippet-picker.ts:90` — Runner's `awaiting-snippet-pick` state constructs `SnippetTreePicker` (`renderSnippetPicker`)

### Outbound Dependencies
- `SnippetEditorModal` → `mountChipEditor` (`src/views/snippet-chip-editor.ts`), `SnippetService.save`/`exists`/`moveSnippet`/`renameSnippet`/`duplicateSnippet`/`listFolderDescendants`, `ConfirmModal`, `FolderSuggest`
- `InsertSnippetModal` → `SnippetTreePicker`, `SnippetFillInModal`, `SnippetService.load`
- `InlineRunnerModal` → `ProtocolRunner`, `GraphValidator`, `SnippetTreePicker`, `SnippetFillInModal`, `renderQuestionAtNode`/`renderSnippetPicker`/`renderLoopPicker`/`renderCompleteHeading`/`renderErrorList`, `InlineRunnerLayoutManager`
- `SnippetService.save` → `assertInsideRoot`, `WriteMutex`, `ensureFolderPath`, `serializeMarkdownTemplate`

### Infrastructure Wiring
- `src/main.ts` `onload()` — command registration (`addCommand`), view registration (`registerView`), settings tab. New `create-snippet` command registers here alongside `insert-snippet` (`:96-100`).
- `this.plugin.settings.snippetFolderPath` — single source of truth for snippet root, used by `InlineRunnerModal` (`:64, 837, 873`), `SnippetManagerView` (`:80`), `SnippetEditorModal` folder dropdown root, and `SnippetService.save` `assertInsideRoot`.
- `this.plugin.i18n.t.bind(this.plugin.i18n)` — translator injection pattern for all views; new i18n keys must be added to both `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`.
- Promise-based modal result pattern (`readonly result: Promise<T>` + `safeResolve` double-guard) — shared by `SnippetEditorModal`, `InsertSnippetModal`, `SnippetFillInModal`, `ConfirmModal`.

## Architecture Insights

- **Optional-field extension is the established growth pattern for `SnippetEditorOptions`** — `snippetServiceOverride`, `disableFolderPicker`, and the deprecated `initialKind` were all added as optional fields without breaking existing callers. `initialTemplate?: string` follows the same pattern.
- **In-place draft mutation** — the chip editor mutates the caller's `draft` object directly (no copy/sync layer). `this.draft` serves three roles simultaneously: chip-editor backing store, the object `handleSave` spreads into the save payload, and the thing `emptyMdTemplateDraft` initializes. Modifying the factory to populate `.template` is the single intervention that lights up all three paths.
- **Footer per-render teardown** — `InlineRunnerModal.render()` (`:426-434`) destroys all footer children on every state change. Any persistent footer button must be re-added in this block, not just in `buildContainer()`. The close button is recreated every render for this reason.
- **CSS scoping via `modalEl.addClass`** — the pattern at `src/views/snippet-editor-modal.ts:151-153` (cast to access protected `modalEl`, add a class, scope CSS to `.rp-snippet-editor-modal`) is the canonical way to override Obsidian's Modal defaults. `InsertSnippetModal` currently does not do this — it's the seam for pinning the modal near the top.
- **Host-class CSS divergence** — `.rp-stp-modal-host`, `.rp-stp-inline-host`, `.rp-stp-editor-host`, and `.rp-insert-snippet-picker-host` each get different height treatments in `snippet-tree-picker.css`. The insert host getting only width CSS (no height) is the root cause of the jumping.
- **Listener-lifecycle via `removeListenersExceptSearch`** — `SnippetTreePicker` keeps the search-input `input` listener across re-renders and drops all others. Any new listener on the search input (e.g. `keydown`) must be added to the keep-condition, or it will be silently dropped on the first search re-render.
- **Approach A (delegate to modal) is preferred over Approach B (call `SnippetService.save` directly)** for the standalone command — the modal provides collision detection, folder picker, name validation, the chip editor, and the unsaved-changes guard for free; Approach B would silently overwrite existing files and reimplement slugification.

## Precedents & Lessons

7 similar past changes analyzed.

### Precedent: Snippet-selection UX fixes & regression fixes (picker layout, modal stacking, tooltip removal)
**Commit(s)**: `c0bb3ee` — "fix: address snippet-selection UX regressions and inline-runner picker resize" (2026-06-14); `164b8e6` — "fix: improve SnippetTreePicker layout sizing and remove tooltip-triggering attributes" (2026-06-14)
**Blast radius**: 8 files / 4 layers (c0bb3ee); 4 files / 2 layers (164b8e6)
  styles/ (snippet-tree-picker.css, inline-runner.css, protocol-editor.css) — width/min-height/flex chains
  views/ (snippet-tree-picker.ts, protocol-editor-view.ts) — removed `aria-label` from rows; replaced nested Modal Browse picker with parent-owned custom overlay

**Follow-up fixes**: this WAS the follow-up; the regression-fixes plan existed because the first plan used a standalone Obsidian `Modal` for Browse which stacked behind the custom Protocol Editor modal.

**Lessons from docs**:
- `.rpiv/artifacts/plans/2026-06-14_12-56-14_snippet-selection-regression-fixes.md` — Decision 1: when opening a picker from a custom (non-Modal) host, the parent must OWN the picker lifecycle; a standalone `Modal` stacks behind the custom backdrop.
- Same plan, Phase 1: `onSelect` must check `modalEl.isConnected` before applying selection, or stale callbacks fire on a dismissed parent.
- `.rpiv/artifacts/plans/2026-06-14_11-53-54_snippet-selection-ux-fixes.md` — Decision 2: snippet file rows already have glyph + title; `aria-label` triggers Obsidian hover tooltips and is redundant.

**Takeaway**: Picker-from-custom-modal is the single most painful pattern in this codebase. The create-snippet-from-selection flow opens `SnippetEditorModal` (a real Obsidian Modal) from `InlineRunnerModal` (a custom DOM overlay) — this is the risky stacking scenario. `SnippetEditorModal` is a proper `Modal` that mounts to `document.body` (not a child of the inline runner container), so it should stack ABOVE the inline runner, not behind it. Verify stacking behavior in validation.

### Precedent: Insert Snippet command (Beta B) — adding a command + modal
**Commit(s)**: `980cd51` — "feat(runner/editor): Beta B – insert snippet command..." (2026-05-15)
**Blast radius**: 9 files / 4 layers
  main.ts (+93), views/insert-snippet-modal.ts (NEW, +85), snippets/snippet-service.ts (+21), i18n en+ru (+17 each), tests

**Follow-up fixes**:
- `b7f6a9e` (2026-05-28) — `pickId` used `snippet.path` (with `.md`) for md-template kinds, not `id`/`name`; needed fallback scan trying `.json`/`.md`.
- `fed8242` (2026-05-20) — search flicker fix (see below).

**Takeaway**: Adding a snippet-related command follows a stable 4-touchpoint pattern: `main.ts` (command + callback), modal view hosting `SnippetTreePicker` in `file-only` mode, `snippet-service.ts` lookup support, i18n in **both** en + ru (~17 strings per locale typical). The new `create-snippet` command follows this pattern but delegates to the existing `SnippetEditorModal` rather than a new modal.

### Precedent: Search flicker / jumping during search in SnippetTreePicker
**Commit(s)**: `fed8242` — "fix: eliminate search flicker in SnippetTreePicker modal" (2026-05-20)
**Blast radius**: 2 files / 2 layers
  views/snippet-tree-picker.ts (+12/-4) — `renderSearchResults`: moved `removeBody`/`removeListenersExceptSearch` AFTER the async `listFolderDescendants` await; added `currentQuery` staleness guard
  tests (+26) — regression test: current results stay visible while next search loads

**Takeaway**: The async-gap blank-jump was already fixed. The **remaining** height-change recentering is a *different* symptom (Obsidian Modal recentering on content-height change after the await) and is NOT addressed by `fed8242`. The fix requires CSS (pin modal + stabilize body height), not the existing staleness-guard approach.

### Precedent: Inline runner layout — stable button anchors, no positional jump
**Commit(s)**: `182cbf4`, `43411e7`, `5cc7382`, `7e5bab4` (2026-05-16); follow-ups `93f04d4`, `0ff2587`
**Blast radius**: `43411e7` touched 10 files; `182cbf4` rewrote inline-runner.css (302 lines) + inline-runner-modal.ts (100 lines)

**Takeaway**: "Jumping" in the inline runner (historically) was caused by a variable-count actions zone with a fixed-position border, fixed structurally by collapsing to one scrollable content zone. The new create-snippet icon is in the **footer** (per the recorded decision), not the content zone, so it does not trigger this historical failure mode — but it IS recreated every render, so its presence/absence must be deterministic (always visible, disabled-when-no-selection) to avoid introducing a new height-shifting border.

### Precedent: Snippet names lost during create/rename
**Commit(s)**: `7919cb0` — "fix: preserve snippet names during create and rename" (2026-05-26); cause `2608163` — slugify-to-UUID
**Blast radius**: 4 files / 2 layers (snippet-editor-modal.ts, tree-renderer.ts, 2 tests)

**Takeaway**: Slugify-vs-basename tension. When creating a snippet from selected text, the user-typed name becomes the basename; derive the id/path from it but never discard the original name. Test create→reopen→rename round-trips. For the create-from-selection flow, do NOT auto-derive a name from the selected text in a way that loses user intent — let the user name the snippet in the editor's name field (which is empty by default and user-editable).

### Precedent: Snippet editor modal — folder tree picker replaced with path input
**Commit(s)**: `3bcc8ac`, `9d3cfc1` (2026-05-27); follow-up `57f3850`
**Blast radius**: `SnippetTreePicker` removed from `snippet-editor-modal.ts`; replaced by inline folder path input + `FolderSuggest` autocomplete. Modal expanded to 920px. Name input auto-focuses on open.

**Takeaway**: The snippet editor modal moved AWAY from `SnippetTreePicker` for folder selection toward a path-input + `FolderSuggest`. The create-snippet command inherits this — pre-fill `initialFolder` with `snippetFolderPath` and let the `FolderSuggest` handle subfolder selection; do not reintroduce a tree picker for the folder field.

### Precedent: SnippetTreePicker renderFileRow redundant setText
**Location**: `src/views/snippet-tree-picker.ts` — `renderFileRow()` calls `nameEl.setText(...)` then immediately `nameEl.empty()` before creating the glyph/title spans. Harmless dead code, but a sign that the row renderer has accreted. When modifying `renderFileRow()` for the name-only flag, be aware the first `setText` is discarded.

### Composite Lessons
1. **Modal stacking is the #1 recurring failure** — opening a picker/modal from a custom (non-Modal) backdrop consumed two full plan cycles. `SnippetEditorModal` is a real Obsidian `Modal` (mounts to `document.body`), so it should stack above the inline runner correctly — but verify in validation.
2. **Adding a new Obsidian import to a view breaks every `vi.mock('obsidian')` in tests importing that view.** When the create-snippet command adds imports to `main.ts` or views, audit all `vi.mock('obsidian')` blocks in `src/__tests__/` for missing exports (e.g. `MarkdownView` may need stubbing if not already present).
3. **"Jumping during search" is partially fixed — the remaining symptom is height-recentering, not async-gap.** The fix is CSS (pin modal via `modalEl` class + stabilize body height), not the existing staleness-guard approach.
4. **i18n must be updated in BOTH `en.json` and `ru.json` simultaneously.** Every snippet feature adds ~17 strings per locale; missing one is a recurring review finding.
5. **Listener-lifecycle is the hidden coupling.** `removeListenersExceptSearch()` drops everything except the search-input `input` listener; a new `keydown` listener on the search input must be added to the keep-condition or it silently disappears on the first search re-render.
6. **The footer per-render teardown means footer buttons must be deterministic across states.** The create-snippet icon is always-visible + disabled-when-no-selection (recorded decision) — its presence never varies, so no new height-shifting border is introduced.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/plans/2026-06-14_11-53-54_snippet-selection-ux-fixes.md` — first snippet picker UX plan (used standalone Modal for Browse — caused stacking regression)
- `.rpiv/artifacts/plans/2026-06-14_12-56-14_snippet-selection-regression-fixes.md` — follow-up regression fixes (parent-owned overlay pattern, `modalEl.isConnected` guard, scoped overflow clipping)

## Developer Context

**Q (`src/views/snippet-editor-modal.ts:30-48`): `SnippetEditorOptions` has no `initialTemplate` field — should pre-fill be added as a new optional field, and should `emptyMdTemplateDraft()` accept the initial template as a 4th parameter (default `''`)?**
A: Yes — add `initialTemplate?: string` to the interface and a 4th `initialTemplate: string = ''` parameter to `emptyMdTemplateDraft()`, threaded through the constructor create-mode branch. (Recommended option chosen; the field is optional so all existing callers compile unchanged. The chip editor reads `draft.template` directly so no downstream changes are needed.)

**Q (`src/views/inline-runner-modal.ts:426-434` + `:554-596`): The footer is rebuilt every render; the create-snippet icon must persist. Should it be always-visible in the footer (disabled until selection) or only in at-node state?**
A: Always-visible in the footer, recreated on every render next to the close button, disabled until text is selected in `contentEl`. Maximally discoverable. (Recommended option chosen.)

**Q (`src/main.ts:96-100` + `:285-310`): The standalone command should mirror `handleInsertSnippet()` which reads the active MarkdownView editor. Should it pre-fill from `editor.getSelection()` or open empty?**
A: Pre-fill from `editor.getSelection()` via `getActiveViewOfType(MarkdownView)`; if no selection or no active md, open empty. Reuses the same `initialTemplate` option the Runner flow needs. (Recommended option chosen.)

**Q (`src/views/snippet-tree-picker.ts` + `src/runner/render/render-snippet-picker.ts:90`): `SnippetTreePicker` is used by both `InsertSnippetModal` and the Runner snippet-pick. Should keyboard nav apply to both?**
A: Both consumers — implement keyboard nav inside `SnippetTreePicker` itself so every consumer gets it for free. Single implementation, consistent UX. (Recommended option chosen.)

**Q (`src/views/snippet-tree-picker.ts:377-380`): The search-result path line is shown for all search-result rows across all consumers. Should it be hidden everywhere or only in the Insert snippet modal?**
A: Insert modal only — add a `hideSearchResultPath?: boolean` option flag (default `false`), pass `true` from `InsertSnippetModal`. Preserves disambiguation in Snippet Manager move-to. (Recommended option chosen.)

## Related Research
- (none — first research artifact on this feature area)

## Open Questions
- None remaining from the checkpoint. The four recorded decisions fully bound the implementation shape. Implementation-phase questions (exact Lucide icon name for the create-snippet button, exact CSS values for `margin-top`/`min-height`) are deferred to design/blueprint.