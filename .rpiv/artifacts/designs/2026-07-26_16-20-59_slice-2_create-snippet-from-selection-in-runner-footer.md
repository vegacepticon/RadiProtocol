---
date: 2026-07-26T16:20:59+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 946c20f
topic: "Create snippet from selection in Runner footer"
source: .rpiv/artifacts/slices/2026-07-26_16-13-35_snippet-create-from-selection-and-insert-modal-ux.md
slice_n: 2
slice_title: "Create snippet from selection in Runner footer"
depends_on: [1]
status: ready
tags: [design, slice]
---

# Design — Slice 2: Create snippet from selection in Runner footer

## Approach

Add an always-visible create-snippet icon button to the `InlineRunnerModal`
footer that opens `SnippetEditorModal` pre-filled with the runner's currently
selected text. Two architecture decisions, both grounded in the existing
lifecycle of the inline runner:

1. **Button lives in the render() footer-teardown block, not buildContainer().**
   The footer row (`footerBtnRowEl`) is torn down and rebuilt on every
   `render()` — `this.footerBtnRowEl.empty()` then the close button is
   recreated at `inline-runner-modal.ts:426-434`. Any button added only in
   `buildContainer()` would be destroyed on the first render and never come
   back. So the create-snippet button must be recreated inside that same
   `if (this.footerBtnRowEl !== null)` block, alongside the close button. The
   current button instance is held in a new `createSnippetBtnEl` field so the
   selection listener can toggle it; the field is reassigned every render and
   nulled in `close()`. This mirrors exactly how `closeBtn` is already rebuilt
   each render — no new lifecycle mechanism, just one more button in the same
   block.

2. **Selection detection via a document-scoped `selectionchange` + contentEl
   `mouseup` listener, on the existing add/remove lifecycle.** The slice brief
   names `mouseup`/`selectionchange` "on `contentEl`", but `selectionchange` is
   a `Document`-level event — it does not fire on individual elements and does
   not bubble to them. So the faithful, working combo is: `mouseup` on
   `contentEl` (catches mouse-release after a drag selection inside the
   content), plus `selectionchange` on `document` (catches keyboard
   Shift+Arrow selections and any programmatic selection change). Both call a
   single `updateCreateSnippetButtonState()` helper that reads
   `window.getSelection()`, verifies the selection's anchor node is contained
   in `contentEl` (so selecting text elsewhere in the app does not enable the
   runner's button), and toggles `createSnippetBtnEl.disabled` accordingly. The
   pair is wired with the same add-in-`open()` / remove-in-`close()` pattern as
   `boundKeyHandler` (`inline-runner-modal.ts:226-227` add,
   `inline-runner-modal.ts:251-254` remove + null-out), via a new
   `boundSelectionHandler` field. `handleKeydown()` already bails for
   `INPUT`/`TEXTAREA` targets (`inline-runner-modal.ts:672-695`), so the
   selection listener does not interfere with the runner's keyboard
   shortcuts — and conversely the runner's keydown handler does not consume
   selection keystrokes that occur inside `contentEl` (which is a plain div,
   not an input).

The click handler constructs
`new SnippetEditorModal(this.app, this.plugin, { mode: 'create', initialFolder:
this.plugin.settings.snippetFolderPath, initialTemplate: template })` and
`open()`s it — consuming the `SnippetEditorOptions.initialTemplate` contract
decided and published by Slice 1 (upstream `## Key Interfaces`). Because
`SnippetEditorModal` is a real Obsidian `Modal` that mounts to `document.body`
(unlike `InlineRunnerModal`, which is a plain floating div), it stacks above
the inline runner overlay by Obsidian's default modal z-index — no custom
stacking code needed. The selection text is captured *before* opening the
modal, so the selection being visually cleared by focus moving to the modal
does not lose the pre-fill content.

No runner-state, graph, or render-layer changes. The button is purely a view
affordance that reads the live DOM selection and delegates to the existing
snippet editor.

## File Map

- `src/views/inline-runner-modal.ts` — change — import `SnippetEditorModal`;
  add `createSnippetBtnEl: HTMLButtonElement | null = null` and
  `boundSelectionHandler: (() => void) | null = null` fields; in the `render()`
  footer-teardown block (`:426-434`) wrap the close + create-snippet buttons in
  a left-side flex group, create the create-snippet button (disabled initially),
  store it in `createSnippetBtnEl`, call `updateCreateSnippetButtonState()`;
  in `open()` attach `mouseup` on `contentEl` + `selectionchange` on `document`
  to `boundSelectionHandler` (after the `boundKeyHandler` attach);
  in `close()` detach both and null `createSnippetBtnEl` + `boundSelectionHandler`;
  add `handleCreateSnippetFromSelection()`, `getSelectedContentText()`, and
  `updateCreateSnippetButtonState()` private methods.
- `src/styles/inline-runner.css` — change — add `.rp-runner-icon-btn:disabled`
  greyed style (opacity + not-allowed cursor + no hover background) so the
  disabled create-snippet button reads as inactive; add `.rp-runner-footer-left`
  flex group (align-items center, gap, justify-content flex-start) that holds
  close + create-snippet on the left of the `space-between` footer row.
- `src/i18n/locales/en.json` — change — add `protocolRunner.createSnippetFromSelection`
  ("Create snippet from selection") for the create-snippet button's aria-label.
- `src/i18n/locales/ru.json` — change — add `protocolRunner.createSnippetFromSelection`
  (Russian translation) for the same aria-label.

## Key Interfaces

```ts
// src/views/inline-runner-modal.ts — new private fields
private createSnippetBtnEl: HTMLButtonElement | null = null;
private boundSelectionHandler: (() => void) | null = null;

// New private methods
/** Read the current text selection iff it lies inside contentEl; else ''. */
private getSelectedContentText(): string {
  if (this.contentEl === null) return '';
  const sel = window.getSelection();
  if (sel === null || sel.isCollapsed || sel.rangeCount === 0) return '';
  const anchor = sel.anchorNode;
  if (anchor === null || !this.contentEl.contains(anchor)) return '';
  return sel.toString();
}

/** Enable createSnippetBtnEl iff getSelectedContentText() is non-empty. */
private updateCreateSnippetButtonState(): void {
  if (this.createSnippetBtnEl === null) return;
  this.createSnippetBtnEl.disabled = this.getSelectedContentText().length === 0;
}

/** Footer button handler — open SnippetEditorModal pre-filled with selection. */
private async handleCreateSnippetFromSelection(): Promise<void> {
  const template = this.getSelectedContentText();
  if (template.length === 0) return; // defensive — button should be disabled
  const modal = new SnippetEditorModal(this.app, this.plugin, {
    mode: 'create',
    initialFolder: this.plugin.settings.snippetFolderPath,
    initialTemplate: template,
  });
  modal.open();
  await modal.result;
}
```

```ts
// render() footer-teardown block — the close + create-snippet buttons are
// wrapped in a left-side group, recreated every render:
if (this.footerBtnRowEl !== null) {
  this.footerBtnRowEl.empty();
  const leftGroup = this.footerBtnRowEl.createDiv({ cls: 'rp-runner-footer-left' });
  // Close button (unchanged shape, reparented into leftGroup)
  const closeBtn = leftGroup.createEl('button', { cls: 'rp-inline-runner-close-btn rp-runner-icon-btn' });
  setIcon(closeBtn, 'x');
  closeBtn.setAttribute('aria-label', this.plugin.i18n.t('protocolRunner.closeProtocol'));
  closeBtn.addEventListener('click', () => this.close());
  // Create-snippet button — always present, disabled until text is selected
  const createBtn = leftGroup.createEl('button', { cls: 'rp-inline-runner-create-snippet-btn rp-runner-icon-btn' });
  setIcon(createBtn, 'file-plus');
  createBtn.setAttribute('aria-label', this.plugin.i18n.t('protocolRunner.createSnippetFromSelection'));
  createBtn.disabled = true;
  createBtn.addEventListener('click', () => void this.handleCreateSnippetFromSelection());
  this.createSnippetBtnEl = createBtn;
  this.updateCreateSnippetButtonState();
}
```

```ts
// open() — selection listener attach (after boundKeyHandler attach)
this.boundSelectionHandler = () => this.updateCreateSnippetButtonState();
this.contentEl?.addEventListener('mouseup', this.boundSelectionHandler);
document.addEventListener('selectionchange', this.boundSelectionHandler);

// close() — selection listener detach (mirrors boundKeyHandler cleanup)
if (this.boundSelectionHandler !== null) {
  this.contentEl?.removeEventListener('mouseup', this.boundSelectionHandler);
  document.removeEventListener('selectionchange', this.boundSelectionHandler);
}
this.boundSelectionHandler = null;
this.createSnippetBtnEl = null;
```

```jsonc
// src/i18n/locales/en.json — protocolRunner namespace (additive)
"createSnippetFromSelection": "Create snippet from selection"
// src/i18n/locales/ru.json — protocolRunner namespace (additive)
"createSnippetFromSelection": "Создать сниппет из выделения"
```

```css
/* src/styles/inline-runner.css — additive */
.rp-runner-footer-left {
  display: flex;
  align-items: center;
  gap: var(--size-4-2);
  justify-content: flex-start;
}

.rp-runner-icon-btn:disabled,
.rp-runner-icon-btn:disabled:hover {
  opacity: 0.4;
  cursor: not-allowed;
  background: transparent;
  color: var(--text-muted);
}
```

## Integration Points

- `src/views/inline-runner-modal.ts:18` (import block) — add
  `import { SnippetEditorModal } from './snippet-editor-modal';`. The modal is
  already a dependency of the views layer; no new layering violation.
- `src/views/inline-runner-modal.ts:54-60` (class fields) — add
  `createSnippetBtnEl` and `boundSelectionHandler` fields next to the existing
  `boundKeyHandler` field.
- `src/views/inline-runner-modal.ts:226-227` (`open()` — `boundKeyHandler`
  attach) — immediately after, attach `boundSelectionHandler` to
  `contentEl`'s `mouseup` and `document`'s `selectionchange`. `contentEl` is
  created in `buildContainer()` (`:325-326`) which runs earlier in `open()`, so
  it is non-null here.
- `src/views/inline-runner-modal.ts:251-254` (`close()` — `boundKeyHandler`
  detach + null-out) — mirror for `boundSelectionHandler` and null
  `createSnippetBtnEl`, placed in the same listener-cleanup region.
- `src/views/inline-runner-modal.ts:426-434` (`render()` footer teardown +
  close-button recreation) — this is the block the slice names as the button's
  home. Wrap close + create-snippet in a `rp-runner-footer-left` group and
  recreate both each render. The existing `renderFooterIcons(state.canStepBack,
  …)` call sites (`:571`, `:583`, `:672`-area) are untouched — they still create
  the right-side `rp-runner-footer-row` group; the parent
  `justify-content: space-between` (`inline-runner.css:198`) keeps the left
  group left and the icons group right.
- `src/views/inline-runner-modal.ts:672-695` (`handleKeydown` INPUT/TEXTAREA
  bail) — no change; confirms the runner's keydown handler will not consume
  selection keystrokes inside `contentEl` (a plain div, not an input), so the
  new `selectionchange` listener is the sole owner of selection-driven button
  state.
- `src/views/snippet-editor-modal.ts:30-48` — **upstream contract from Slice 1**:
  `SnippetEditorOptions.initialTemplate?: string`. Consumed as fixed — this
  slice passes `initialTemplate: template` into `new SnippetEditorModal(...)`
  exactly as Slice 1's `handleCreateSnippet()` does. No redesign of that
  contract.
- `src/views/snippet-manager-view.ts:258-267` (`openCreateModal` await-result
  pattern) — the reference pattern for constructing + opening +
  `await modal.result`; this slice's `handleCreateSnippetFromSelection()`
  follows it but does not rebuild any tree (the runner owns no snippet tree).
- `src/styles/inline-runner.css:198-217` (footer row + close button) — the
  footer row is `display: flex; justify-content: space-between`; the new
  `rp-runner-footer-left` group becomes the left child, `renderFooterIcons`'s
  `rp-runner-footer-row` group remains the right child.
- `src/styles/inline-runner.css:297-317` (`.rp-runner-icon-btn` base) — reused
  unchanged by the create-snippet button; the new `:disabled` rule is additive
  and also applies to the Back/Redo/Skip buttons' disabled state (currently
  set via `.disabled = true` at `:571`/`:583` but previously unstyled).
- `src/i18n/locales/en.json` + `src/i18n/locales/ru.json` — `protocolRunner`
  namespace gains `createSnippetFromSelection` in both locales (i18n rule: keys
  added to both en and ru). Used only for the create-snippet button's
  aria-label.
- This slice couples to Slice 1 only through the published
  `SnippetEditorOptions.initialTemplate` contract. It does **not** couple to
  Slices 3–5 (modal UX fixes), which touch `InsertSnippetModal` /
  `SnippetTreePicker`, not the inline runner footer.

## Success Criteria

- [ ] `InlineRunnerModal` renders an always-visible create-snippet icon button
  in the footer row, to the left of (inside the same left group as) the close
  button, on every `render()` — including after `at-node`/`awaiting-loop-pick`
  re-renders that tear down and rebuild the footer.
- [ ] The create-snippet button is created with `disabled = true` on every
  render, then `updateCreateSnippetButtonState()` re-evaluates it against the
  live selection so an existing selection at render time enables it
  immediately.
- [ ] Selecting text inside `contentEl` (mouse drag then release) enables the
  create-snippet button within one `mouseup`/`selectionchange` tick; clearing
  the selection (clicking elsewhere in `contentEl`) disables it again.
- [ ] Selecting text *outside* `contentEl` (e.g. in the note editor behind the
  runner) does **not** enable the runner's create-snippet button —
  `getSelectedContentText()` returns `''` when the selection's anchor node is
  not contained in `contentEl`.
- [ ] Keyboard Shift+Arrow selection inside `contentEl` enables the button via
  the `document` `selectionchange` listener (covers non-mouse selection).
- [ ] Clicking the enabled create-snippet button opens `SnippetEditorModal` in
  create mode with the template textarea pre-filled verbatim with the selected
  text (verifiable via the chip editor's `templateArea.value`, the pre-fill
  path at `snippet-chip-editor.ts:125`).
- [ ] Clicking the create-snippet button when disabled does nothing (the
  browser-suppressed disabled button + the `if (template.length === 0) return`
  defensive guard both block action).
- [ ] `SnippetEditorModal` opens *above* the inline runner overlay (Obsidian
  modal z-index on `document.body`), confirming the stacking precedent
  `c0bb3ee` — the inline runner remains visible behind the modal.
- [ ] After `SnippetEditorModal` resolves (save or cancel), the inline runner
  is still open and functional; the create-snippet button reflects the
  then-current selection state.
- [ ] Closing the inline runner (`close()`) detaches both `mouseup` and
  `selectionchange` listeners and nulls `createSnippetBtnEl` and
  `boundSelectionHandler` — no leaked listeners or stale DOM refs (verifiable
  by re-opening the runner and confirming no double-fire of selection events).
- [ ] The runner's keyboard shortcuts (Ctrl/Alt+Left = step back,
  Ctrl/Alt+Right = redo, Escape = close) still work while the create-snippet
  button is present; the selection listener does not intercept keydown.
- [ ] The create-snippet button's aria-label uses
  `protocolRunner.createSnippetFromSelection` from the active locale (en or
  ru); the key exists in both `src/i18n/locales/en.json` and
  `src/i18n/locales/ru.json`.
- [ ] `npm run build` (type-check + esbuild) passes; `npm test` passes with no
  regressions in existing inline-runner / snippet-editor suites.

## Notes / Deferred

- **`selectionchange` attaches to `document`, not `contentEl`.** The slice
  brief names `mouseup`/`selectionchange` "on `contentEl`", but `selectionchange`
  is a `Document`-level event — it does not fire on or bubble to individual
  elements. The working combo is `mouseup` on `contentEl` (mouse-release after
  drag selection) + `selectionchange` on `document` (keyboard/programmatic
  selection). Both handlers are the same `boundSelectionHandler` and both are
  removed in `close()`, preserving the add/remove lifecycle symmetry with
  `boundKeyHandler`. `contentEl`'s `contains(anchorNode)` check keeps the
  button scoped to in-runner selections only.
- **Button placed only in the `render()` footer block, not `buildContainer()`.**
  The slice explicitly requires re-adding in the render-teardown block ("not
  just in `buildContainer()`"). The existing close button is created in both
  `buildContainer()` and `render()`; the `buildContainer()` instance is
  immediately replaced by the first `render()` at `inline-runner-modal.ts:192`.
  To avoid duplicating the create-snippet button's creation logic in two places,
  it is created only in `render()`. There is a sub-frame window between
  `buildContainer()` and the first `render()` where the footer has only the
  close button — but `render()` runs synchronously at the end of `open()` before
  the user can interact, so this is not observable.
- **Icon choice `file-plus`.** The create-snippet button uses Obsidian's
  `file-plus` icon (create new file/snippet). This is an assumption; if the
  design review prefers a different glyph (e.g. `square-pen`, `clipboard-plus`,
  `scissors`), it is a one-line `setIcon` change in the render block — no
  structural impact.
- **Left group introduced for stable layout.** The footer row uses
  `justify-content: space-between`. Without a left group, adding the
  create-snippet button as a direct child would push it to the right when the
  `renderFooterIcons` group is absent (only two children) and to the middle when
  it is present (three children) — the button would jump position across
  states. Wrapping close + create-snippet in `rp-runner-footer-left` (and
  keeping `renderFooterIcons`'s `rp-runner-footer-row` group as the right
  child) keeps the create-snippet button anchored next to close in every
  runner state.
- **No save-confirmation Notice.** The slice scope is the footer button +
  selection detection + pre-fill hand-off. `SnippetEditorModal` does not emit
  a Notice on plain create (only on move/rename), so saving from the runner
  button gives no toast. If product wants confirmation, that belongs in a
  follow-up slice and would need its own i18n key — reusing Slice 1's
  command-owned `snippetEditor.createdNotice` would couple this slice to an
  unpublished detail of Slice 1, so it is deliberately not done here.
- **Selection not collapsed after capture.** When the modal opens, the
  `contentEl` selection may remain visually highlighted until focus shifts. The
  pre-fill text is captured before `modal.open()`, so this is cosmetic only;
  the next `selectionchange` tick re-evaluates the button state. Actively
  collapsing the selection is out of scope.
- **No selection-length cap.** A multi-megabyte selection would pre-fill a very
  large textarea; consistent with Slice 1's deferred hardening, bounding input
  belongs to a future hardening slice.
- **Cross-slice contract consumed, not published.** This slice depends on
  Slice 1's `SnippetEditorOptions.initialTemplate?: string` (decided, not
  parked). It publishes no contract of its own — no downstream slice depends on
  the runner footer button.