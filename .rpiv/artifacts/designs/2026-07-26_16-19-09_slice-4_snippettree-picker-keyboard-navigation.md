---
date: 2026-07-26T16:19:09+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 946c20f
topic: "SnippetTreePicker keyboard navigation (ArrowUp/Down + Enter)"
source: .rpiv/artifacts/slices/2026-07-26_16-13-35_snippet-create-from-selection-and-insert-modal-ux.md
slice_n: 4
slice_title: "SnippetTreePicker keyboard navigation (ArrowUp/Down + Enter)"
depends_on: []
status: ready
tags: [design, slice]
---

# Design — Slice 4: SnippetTreePicker keyboard navigation (ArrowUp/Down + Enter)

## Approach

Keyboard navigation lives **inside `SnippetTreePicker` itself**, so every consumer — the Insert snippet modal (`InsertSnippetModal.onOpen` mounts the picker file-only) and the Runner snippet-pick (`render-snippet-picker.ts:90`) — inherits it with zero wiring changes. The picker already owns its search input (`searchInputEl`, mounted in `mount()` at `snippet-tree-picker.ts:108-138`), so the keydown listener attaches there, beside the existing `input` listener at `:130`.

**Navigation model — query-on-keypress, not a cached row array.** Each Arrow/Enter handler queries the live `.rp-stp-list` rows via `rootEl().querySelectorAll('.rp-stp-folder-row, .rp-stp-file-row')`. This sidesteps the state-sync hazard created by the picker's re-render model: `renderDrillView()` and `renderSearchResults()` both call `removeBody(host)` (`:316`, `:416-473`), which tears down every list child. A cached `currentRows` array would go stale on every search debounce / drill / breadcrumb navigation and require careful reset hooks; querying the DOM at keypress time is always correct because it reflects whatever the last render produced. The only piece of highlight state kept on the instance is `highlightedIndex` (number) + `highlightedRowEl` (HTMLElement | null) — both reset to `-1`/`null` at the top of each re-render body, right after `removeBody`, since the prior highlighted element is now detached.

**Enter flows through the identical load/guard/close path both consumers already wire.** Enter does **not** call `options.onSelect` directly. Instead it calls `this.highlightedRowEl.click()`. Every row is a `<button>` built by `createButton` with a registered `click` listener (`renderFolderRow`, `renderFileRow`) that either drills (folder row) or invokes `this.options.onSelect({ kind: 'file', relativePath })`. The Runner's `onSelect` (`render-snippet-picker.ts:62-86`) then runs the same `snippetService.load` + `getCurrentNodeId()` stale guard + `isStillMounted()` detached-DOM guard + `onSnippetReady` flow; the Insert modal's `onSelect` runs its own insert path. Reusing `.click()` means keyboard Enter and mouse click are provably the same code path — no second implementation of the select semantics to drift.

**Listener preservation across re-renders.** `removeListenersExceptSearch()` (`:168`) currently keeps only the search input's `input` listener across the drill/search re-render. The new `keydown` listener on the same `searchInputEl` would be silently dropped on the first debounced search re-render without a change. Broaden the keep predicate to also preserve `entry.type === 'keydown'` when `entry.el === this.searchInputEl`. This is the minimal change — all other tracked listeners (row clicks, breadcrumb, select-folder button) still drop and re-bind on each render as today.

**No conflict with the Runner's container keydown.** `InlineRunnerModal.handleKeydown()` (`inline-runner-modal.ts:672-695`) bails immediately when `e.target` is an `INPUT` or `TEXTAREA`. Arrow/Enter keys pressed while focus is in the picker's search input never reach the runner's Ctrl+← / Ctrl+→ / Escape handling, so the two keydown layers compose without interference.

**Highlight is visual + accessible.** A `.rp-stp-row-highlighted` class is toggled on the highlighted row; CSS supplies the background/border. For screen-reader feedback, a visually-hidden `aria-live="polite"` status span is created once in `mount()` inside `.rp-stp-search`, and on each highlight move it is updated with the highlighted row's title text via a new i18n key `snippetTreePicker.highlightAria` (interpolated with `{name}`). This is the only new user-visible copy, added to both `en.json` and `ru.json`.

## File Map

- `src/views/snippet-tree-picker.ts` — change — Add two instance fields (`highlightedIndex`, `highlightedRowEl`, `highlightStatusEl`); add `keydown` listener on `searchInput` in `mount()` next to the existing `input` listener; broaden `removeListenersExceptSearch()` to preserve the `keydown` listener on `searchInputEl`; reset highlight state at the top of `renderDrillView()` and `renderSearchResults()` after `removeBody`; add private methods `handleSearchKeydown(e)`, `currentRows()`, `moveHighlight(rows, delta)`, `clearHighlight()`; create the aria-live status span in `mount()`.
- `src/styles/snippet-tree-picker.css` — add — `.rp-stp-row-highlighted` rule (background + border) and a visually-hidden `.rp-stp-sr-only` helper for the aria-live status span.
- `src/i18n/locales/en.json` — change — Add `snippetTreePicker.highlightAria` key (`"Highlighted: {name}"`).
- `src/i18n/locales/ru.json` — change — Add `snippetTreePicker.highlightAria` key (`"Подсвечено: {name}"`).
- `src/__tests__/snippet-tree-picker.test.ts` — add — Vitest suite using the `MockEl` class + `vi.fn()` host-spies pattern (per render-layer guidance), covering ArrowDown/ArrowUp traversal, wrap-around, Enter dispatches the row's click handler, highlight reset on re-render, and `removeListenersExceptSearch` preserving the keydown listener across a debounced search re-render.

## Key Interfaces

No public API change. `SnippetTreePickerOptions`, `SnippetTreePickerResult`, and the `SnippetTreePicker` class's public methods (`mount`, `unmount`, `constructor`) keep their existing signatures — consumers (`render-snippet-picker.ts:88-92`, `insert-snippet-modal.ts:21-43`) compile unchanged.

New private surface inside `SnippetTreePicker`:

```ts
// New instance fields (reset on each mount() and on each body re-render).
private highlightedIndex: number = -1;
private highlightedRowEl: HTMLElement | null = null;
private highlightStatusEl: HTMLElement | null = null; // aria-live polite span

// New keydown handler bound to the search input.
private handleSearchKeydown(e: KeyboardEvent): void {
  // ArrowDown / ArrowUp → moveHighlight; Enter → highlightedRowEl.click()
  // Only acts when e.target is the search input; ignores modifier-laden keys.
}

// Query live rows from the current .rp-stp-list (never cached across renders).
private currentRows(): HTMLElement[] {
  // rootEl().querySelectorAll<HTMLElement>('.rp-stp-folder-row, .rp-stp-file-row')
}

private moveHighlight(rows: HTMLElement[], delta: 1 | -1): void {
  // toggle .rp-stp-row-highlighted off the old row, on the new (wrap-around modulo
  // rows.length), scrollIntoView({ block: 'nearest' }), update aria-live status.
}

private clearHighlight(): void {
  // highlightedIndex = -1; highlightedRowEl = null; (the old element is detached
  // after removeBody, so no class removal needed).
}
```

New i18n key (both locales):

```ts
// snippetTreePicker.highlightAria — interpolated with {name} = the highlighted
// row's title text (basename for both folder and file rows).
```

New CSS:

```css
.rp-stp-row-highlighted { /* background + border to mark the keyboard cursor */ }
.rp-stp-sr-only        { /* visually-hidden but screen-reader-accessible */ }
```

## Integration Points

- `src/views/snippet-tree-picker.ts:130` — add `this.addListener(searchInput, 'keydown', (e) => this.handleSearchKeydown(e))` immediately after the existing `this.addListener(searchInput, 'input', …)`, reusing the same `addListener` tracking convention so `unmount()` / `clearContainer()` already tears it down.
- `src/views/snippet-tree-picker.ts:168` — broaden the keep predicate in `removeListenersExceptSearch()` to `entry.el === this.searchInputEl && (entry.type === 'input' || entry.type === 'keydown')`. Without this the keydown listener is dropped on the first debounced search re-render.
- `src/views/snippet-tree-picker.ts` (inside `renderDrillView`, right after `this.removeBody(host)`) — call `this.clearHighlight()` so a stale `highlightedIndex` never points at a detached element after a drill / breadcrumb navigation.
- `src/views/snippet-tree-picker.ts` (inside `renderSearchResults`, right after `this.removeBody(host)`) — call `this.clearHighlight()` for the same reason after each search re-render.
- `src/runner/render/render-snippet-picker.ts:90` — no change; the Runner snippet-pick consumer inherits keyboard nav for free because navigation is internal to `SnippetTreePicker`. Enter routes through the existing `onSelect` closure (`:62-86`) and its stale-state + detached-DOM guards.
- `src/views/inline-runner-modal.ts:672-695` — no change; `handleKeydown` already bails for `INPUT`/`TEXTAREA` targets, so arrow/Enter keys in the picker's search box are not consumed by the runner.
- `src/views/insert-snippet-modal.ts:21-43` — no change; the Insert modal inherits keyboard nav for free.

## Success Criteria

- [ ] Typing in the picker search box then pressing ArrowDown moves `.rp-stp-row-highlighted` onto the first row; ArrowDown again moves it to the second; ArrowUp moves it back; navigation wraps from the last row to the first and vice-versa.
- [ ] `row.scrollIntoView({ block: 'nearest' })` is called when the highlight moves, so highlighted rows off-screen are scrolled into view without recentering the surrounding modal (Slice 3 owns modal pinning; this slice only owns in-list scroll).
- [ ] Pressing Enter while a row is highlighted dispatches that row's registered `click` handler (asserted via a `vi.fn()` onSelect spy for file rows, and via a drill-path assertion for folder rows) — i.e. Enter and mouse click hit the same code path.
- [ ] Pressing Enter when no row is highlighted (`highlightedIndex === -1`, e.g. empty results) is a no-op and does not throw.
- [ ] After a debounced search re-renders the list, the `keydown` listener on `searchInputEl` is still active (ArrowDown moves the highlight on the freshly-rendered rows) — proves `removeListenersExceptSearch()` now preserves the keydown listener.
- [ ] After a drill / breadcrumb navigation re-renders the body, `highlightedIndex` is reset to `-1` and `highlightedRowEl` to `null` (no stale-reference `.click()` after re-render).
- [ ] Arrow keys pressed while focus is in the picker search input do not trigger `InlineRunnerModal` Ctrl+← / Ctrl+→ / Escape handling (the runner's `handleKeydown` INPUT/TEXTAREA bail holds).
- [ ] `InlineRunnerModal` and `InsertSnippetModal` consumers compile and mount unchanged — no public-surface signature change to `SnippetTreePickerOptions` or `SnippetTreePicker`.
- [ ] `snippetTreePicker.highlightAria` key exists in both `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`; the aria-live status span announces the highlighted row's title on each highlight move.
- [ ] `npm test`, `npm run lint`, and `npm run build` all pass.

## Notes / Deferred

- **Highlight scope is the current list only.** ArrowUp/Down navigate whatever the last render produced — drill-view rows when the search box is empty, search-result rows when a query is active. This matches user expectation (the visible list is navigable) and requires no separate "mode" handling.
- **Folder-row Enter drills in (drill view) / drills via search-result path (search view), it does not call `onSelect`.** This is the existing mouse-click semantics reused verbatim via `.click()`; the slice scope ("dispatch the highlighted row's `onSelect` callback, flowing through the identical load/guard/close path") is satisfied for file rows, and folder rows keep their drill behavior unchanged. No new folder-select-on-Enter behavior is introduced.
- **`aria-selected` vs `aria-current`** is intentionally not added to rows: the rows are `<button>` elements in a non-`listbox` container, and adding `role="listbox"`/`option` semantics would expand the slice into ARIA restructuring. The visually-hidden `aria-live="polite"` status span is the minimal accessible feedback channel.
- **No changes to `SnippetTreePickerOptions`.** Slice 5 adds `hideSearchResultPath` to the same options interface; this slice adds no option flag, so the two slices compose without touching each other's contract (Slice 5 alters the `renderFileRow` path-div gate at `:377-380`, which this slice cites but does not modify).
- **Test fixture**: the new `snippet-tree-picker.test.ts` uses inline `SnippetService` stubs (folders/snippets arrays) per the runner-core "construct directly, no mocking" convention; it does not need the `makeVault()`/`makeApp()` mock factory because `SnippetTreePicker` only depends on `snippetService.listFolder` / `listFolderDescendants` (both stubbed as plain async functions returning fixed arrays).