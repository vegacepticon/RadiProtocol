---
date: 2026-07-26T16:19:09+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 946c20f
topic: "SnippetTreePicker name-only display via hideSearchResultPath"
source: .rpiv/artifacts/slices/2026-07-26_16-13-35_snippet-create-from-selection-and-insert-modal-ux.md
slice_n: 5
slice_title: "SnippetTreePicker name-only display via hideSearchResultPath"
depends_on: []
status: ready
tags: [design, slice]
---

# Design — Slice 5: SnippetTreePicker name-only display via hideSearchResultPath

## Approach

A pure display-flag addition, orthogonal to keyboard navigation (Slice 4) and modal geometry (Slice 3). The slice introduces one optional `hideSearchResultPath?: boolean` field on `SnippetTreePickerOptions` (default `false`), and narrows the existing path-div gate in `renderFileRow()` so the secondary `.rp-stp-result-path` line is suppressed when the flag is set.

**Why a flag, not a separate renderer or a new mode:** the path-div gate is already localized to one `if (isSearchResult)` block (`snippet-tree-picker.ts:381-384`). The drill-view branch never renders the path line (the gate is search-only by construction), so the flag only affects search-result rows — exactly where the insert modal wants name-only display. Defaulting to `false` preserves the existing disambiguation behavior in the Snippet Manager move-to modal (where same-named snippets in different folders need the path line), so no existing caller changes. Only `InsertSnippetModal.onOpen()` opts in by passing `hideSearchResultPath: true`.

**Why only `renderFileRow`, not `renderFolderRow`:** the slice scope explicitly bounds the change to the file-row gate (`snippet-tree-picker.ts:381`). The insert modal runs in `file-only` mode, and in `file-only` mode `renderSearchResults` sets `showFolders = this.options.mode !== 'file-only'` → `false`, so no folder search-result rows are ever rendered there. Folder path display in the move-to modal (which uses `both`/`folder-only` mode and relies on the secondary path line for disambiguation) is therefore untouched. Touching the folder-row gate would be out of scope and would regress move-to disambiguation.

**Composability with Slice 4:** Slice 4 adds keyboard navigation that resets highlight state on every re-render (old DOM removed via `removeBody`). Slice 5 only changes *whether* the path-div element is appended inside the file row — it does not alter row identity, the click `onSelect` callback, the row's class list, or the re-render lifecycle. The two slices share the `renderFileRow` cite but operate on disjoint concerns (highlight/keydown mechanics vs. path-line visibility), so they compose without coupling.

## File Map

- `src/views/snippet-tree-picker.ts` — change — Add `hideSearchResultPath?: boolean` to the `SnippetTreePickerOptions` interface (documented as default `false`, search-result-only). Narrow the `renderFileRow()` path-div gate from `if (isSearchResult)` to `if (isSearchResult && !this.options.hideSearchResultPath)`. No change to `renderFolderRow`, no change to the drill-view branch, no new fields/listeners/state.
- `src/views/insert-snippet-modal.ts` — change — Pass `hideSearchResultPath: true` in the `SnippetTreePicker` options object constructed in `onOpen()` (alongside the existing `mode: 'file-only'`). No other change to the modal.
- `src/__tests__/views/snippet-tree-picker.test.ts` — change — Add one test asserting `hideSearchResultPath: true` suppresses the `.rp-stp-result-path` element in search results (file-only mode), and keep the existing "result row secondary text = full relative path from rootPath" test (`:647-654`) as the default-`false` regression guard.

## Key Interfaces

```ts
// src/views/snippet-tree-picker.ts — extended option (additive, optional, default false)
export interface SnippetTreePickerOptions {
  app: App;
  snippetService: SnippetService;
  container: HTMLElement;
  mode: SnippetTreePickerMode;
  rootPath: string;
  initialSelection?: string;
  onSelect: (result: SnippetTreePickerResult) => void;
  t?: Translator;
  /** When true, file search-result rows render name-only (no `.rp-stp-result-path`
   *  secondary line). Default false — preserves path disambiguation in the
   *  Snippet Manager move-to modal. Drill-view rows never render the path line
   *  regardless of this flag. */
  hideSearchResultPath?: boolean;
}

// renderFileRow — narrowed gate (the only behavioural change)
//   before:  if (isSearchResult) {
//   after:   if (isSearchResult && !this.options.hideSearchResultPath) {
//              const pathEl = row.createEl('div', { cls: 'rp-stp-result-path' });
//              pathEl.setText(relativePath);
//            }
```

No new exports, no new types, no signature changes. The flag is read via the existing `this.options` reference already used throughout the class.

## Integration Points

- `src/views/snippet-tree-picker.ts:62` — `SnippetTreePickerOptions` interface gains the optional `hideSearchResultPath` field. Every existing caller (`makePicker` test factory at `src/__tests__/views/snippet-tree-picker.test.ts:235`, `InsertSnippetModal` at `src/views/insert-snippet-modal.ts:32`, Snippet Manager move-to, Snippet Editor folder field, Runner snippet-pick at `src/runner/render/render-snippet-picker.ts:90`) compiles unchanged because the field is optional and defaults to `false`.
- `src/views/snippet-tree-picker.ts:381` — the `renderFileRow()` `if (isSearchResult)` path-div gate becomes `if (isSearchResult && !this.options.hideSearchResultPath)`. This is the single behavioural edit; it is read-only on `this.options` and touches no state shared with Slice 4's `highlightedIndex`/`highlightedRowEl` or keydown listener.
- `src/views/insert-snippet-modal.ts:32` — `new SnippetTreePicker({...})` options object gains `hideSearchResultPath: true` next to `mode: 'file-only'` (`:36`). This is the sole opt-in site; it couples only to the new option, not to any sibling slice's surface.
- `src/__tests__/views/snippet-tree-picker.test.ts:647-654` — existing "result row secondary text = full relative path from rootPath" test remains green as the default-`false` regression guard; a new sibling test under the same `describe` block asserts the flag suppresses the path element.

## Success Criteria

- [ ] `SnippetTreePickerOptions` exports a `hideSearchResultPath?: boolean` field; `tsc --noEmit` (via `npm run build`) passes with no type errors.
- [ ] With `hideSearchResultPath` unset (default), a search-result file row still renders the `.rp-stp-result-path` element containing the full relative path from `rootPath` — verified by the existing test at `src/__tests__/views/snippet-tree-picker.test.ts:647-654` remaining green.
- [ ] With `hideSearchResultPath: true` passed to `SnippetTreePicker`, a search-result file row renders the `.rp-stp-result-name` (glyph + basename) but no `.rp-stp-result-path` element — verified by a new test asserting `findFirst(container, el => el.classList.has('rp-stp-result-path'))` returns `null` while `.rp-stp-result-name` is present.
- [ ] Drill-view file rows never render the path line regardless of the flag (the gate stays search-only) — covered by the existing drill-view glyph tests which assert only `.rp-stp-result-name` content and never observe a path element.
- [ ] `InsertSnippetModal.onOpen()` passes `hideSearchResultPath: true` to `SnippetTreePicker`; in the insert modal, typing a query that matches a snippet shows name-only rows (no path line).
- [ ] Snippet Manager move-to modal (`both`/`folder-only` mode, does not pass the flag) still shows the secondary path line on search-result rows — verified by the default-`false` test remaining green; no regression to folder-row path display.
- [ ] `npm test` passes (no new failures); `npm run lint` passes for the touched files.

## Notes / Deferred

- Assumption: the flag is read as `this.options.hideSearchResultPath` (optional, `undefined`-falsy) rather than normalized in the constructor. This matches the established pattern in the class (`this.options.mode`, `this.options.rootPath`, `this.options.t` are read directly off `options`), and `undefined`/`false` both short-circuit the `!` test identically, so no constructor normalization is needed.
- Assumption: no i18n keys are required. The flag only *removes* a DOM element; it introduces no new user-visible copy. (Slice 4 owns any new i18n keys for keyboard-nav aria labels.) If future consumers want a tooltip explaining the path is hidden, that key would be added under `snippetTreePicker.*` to both `en.json` and `ru.json` — out of scope here.
- Assumption: the existing test "result row secondary text = full relative path from rootPath" (`:647-654`) doubles as the default-`false` regression guard and needs no modification — only a new test is added for the `true` case.
- Deferred to Slice 4: keyboard navigation mechanics (highlight class, keydown listener, `removeListenersExceptSearch` broadening) — this slice does not alter any of those. The two slices share the `renderFileRow` cite but operate on disjoint concerns.
- Deferred to Slice 3: modal pinning/geometry CSS — this slice is logic-only (`hideSearchResultPath` is a render flag, not a style override); the `.rp-stp-result-path` CSS rule at `src/styles/snippet-tree-picker.css:197` is unchanged.