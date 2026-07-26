---
date: 2026-07-26T16:31:29+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 946c20f
topic: "Pin insert-snippet modal and stabilize picker body height"
source: .rpiv/artifacts/plans/2026-07-26_16-27-21_snippet-create-from-selection-and-insert-modal-ux.md
phase_n: 3
phase_title: "Pin insert-snippet modal and stabilize picker body height"
status: ready
tags: [elaboration]
---

## Phase 3: Pin insert-snippet modal and stabilize picker body height

### Changes

#### `src/views/insert-snippet-modal.ts`
Add `modalEl.addClass('rp-insert-snippet-modal')` as the **first** statement of `onOpen()` (before the `const { contentEl, titleEl } = this;` destructure and `contentEl.empty()`), using the protected-cast pattern that `SnippetEditorModal` already uses at `src/views/snippet-editor-modal.ts:151-153`. No other JS change — the existing body (root-path guard, picker host creation, `SnippetTreePicker` construction at `src/views/insert-snippet-modal.ts:31-43`, `mount()`) is untouched. Phase 5's later `hideSearchResultPath: true` edit lands on the options object at `:32`, disjoint from this top-of-method insert.

The current `onOpen()` head (`src/views/insert-snippet-modal.ts:23-25`):
```ts
  onOpen(): void {
    const { contentEl, titleEl } = this;
    contentEl.empty();
```
becomes:
```ts
  onOpen(): void {
    const modalEl = (this as unknown as { modalEl?: { addClass?: (cls: string) => void } }).modalEl;
    if (typeof modalEl?.addClass === 'function') {
      modalEl.addClass('rp-insert-snippet-modal');
    }

    const { contentEl, titleEl } = this;
    contentEl.empty();
```

#### `src/styles/snippet-tree-picker.css`
Append a new rule block immediately after the existing width-only host block at `src/styles/snippet-tree-picker.css:221-229` (the combined `.rp-stp-inline-host, .rp-stp-modal-host, .rp-insert-snippet-picker-host { width: 100%; … }` rule), extending the same `.rp-insert-snippet-picker-host` host scope. The block pins the modal to the top of `.modal-container` (opts out of Obsidian's flex `align-items: center`) and fixes the picker body + bare search-result list heights so the `renderSearchResults()` `removeBody` + bare `.rp-stp-list` rebuild (search-result list recreated directly on the host, not inside `.rp-stp-body`) does not recenter the modal on every keystroke.

No new CSS file — `snippet-tree-picker.css` is already wired into the build via `esbuild.config.mjs` `CSS_FILES` (entry at `esbuild.config.mjs:36`). The global `.rp-stp-list { max-height: 320px }` at `src/styles/snippet-tree-picker.css:148` still applies to the bare search-result list, so setting `min-height: 320px` fixes it to min==max==320px regardless of result count. The inner list inside `.rp-stp-body` (drill view) is governed by `.rp-stp-body .rp-stp-list { flex: 1 1 auto }` at `src/styles/snippet-tree-picker.css:40` and is **not** matched by the new `.rp-stp-root > .rp-stp-list` direct-child selector — verified by reading the CSS; the drill-view inner list lives inside `.rp-stp-body`, so the `>` direct-child combinator excludes it.

Insert this block immediately after the closing brace of the `.rp-stp-inline-host, .rp-stp-modal-host, .rp-insert-snippet-picker-host { … }` rule (i.e. as a new block starting right after `src/styles/snippet-tree-picker.css:229`):
```css
/* Slice 3 — Pin insert-snippet modal near the top + stabilize body height so the
   search-result rebuild (removeBody + bare .rp-stp-list on host) doesn't recenter
   the modal on every keystroke. The insert host previously had only width CSS. */
.rp-insert-snippet-modal {
  /* Opt out of .modal-container's align-items: center; anchor to top padding. */
  align-self: flex-start;
  margin-top: 0;
}

.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-body {
  /* Stabilize drill view outer height (matches .rp-stp-modal-host treatment). */
  height: 360px;
}

.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-list {
  /* Bare search-result list recreated on host by renderSearchResults().
     Global .rp-stp-list { max-height: 320px } (src/styles/snippet-tree-picker.css:148)
     still applies, so min==max==320px fixes the height regardless of result count. */
  min-height: 320px;
}
```

### Success Criteria
#### Automated Verification:
- [ ] `InsertSnippetModal.onOpen()` adds class `rp-insert-snippet-modal` to `modalEl` using the protected-cast pattern (mirrors `src/views/snippet-editor-modal.ts:151-153`).
- [ ] `src/styles/snippet-tree-picker.css` defines `.rp-insert-snippet-modal` with `align-self: flex-start` and `margin-top: 0` (opts out of Obsidian's flex vertical centering).
- [ ] `src/styles/snippet-tree-picker.css` sets `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-body { height: 360px }` (stabilizes the drill view).
- [ ] `src/styles/snippet-tree-picker.css` sets `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-list { min-height: 320px }` (stabilizes the bare search-result list; combined with the global `max-height: 320px` at `src/styles/snippet-tree-picker.css:148`, the height is fixed).
- [ ] The inner list inside `.rp-stp-body` (drill view) is **not** affected by the new `min-height` rule — the direct-child selector `> .rp-stp-list` targets only the bare search list (verified by reading the CSS — the inner list is governed by `.rp-stp-body .rp-stp-list { flex: 1 1 auto }` at `src/styles/snippet-tree-picker.css:40`).
- [ ] `npm run lint` (ESLint + Stylelint) passes on `src/views/insert-snippet-modal.ts` and `src/styles/snippet-tree-picker.css`.
- [ ] `npm run build` (type-check + esbuild) passes.
#### Manual Verification:
- [ ] Open the Insert snippet command, type a query that matches a varying number of snippets, then clear it — the modal does not move vertically on any keystroke (the search-result list grows/shrinks downward from the fixed top anchor).