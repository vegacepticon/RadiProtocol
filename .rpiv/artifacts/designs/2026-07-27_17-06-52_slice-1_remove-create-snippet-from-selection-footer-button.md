---
date: 2026-07-27T17:06:52+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 9c4452e
topic: "Remove create-snippet-from-selection footer button"
source: .rpiv/artifacts/slices/2026-07-27_16-38-57_runner-cleanup-nodes-snippets-modal-ux.md
slice_n: 1
slice_title: "Remove create-snippet-from-selection footer button"
depends_on: []
status: ready
tags: [design, slice]
---

# Design — Slice 1: Remove create-snippet-from-selection footer button

## Approach

This slice deletes the "create snippet from selection" feature from the inline runner footer entirely, plus all of its private machinery. The decision is mechanical — the slice map enumerates every symbol to remove — so the architecture decision here is **only** about how the close button re-homes itself once its `leftGroup` flex wrapper is gone.

**Close button re-parenting.** Today the footer row (`footerBtnRowEl`, `justify-content: space-between`) holds exactly two flex items: `leftGroup` (close + create-snippet, `flex-start`) and `iconsGroup` (Back/Redo/Skip, `rp-runner-footer-row` with `flex-end`). Removing the create-snippet button makes `leftGroup` a wrapper around a single child, which is pointless. So `leftGroup` is removed and the close button becomes a **direct child of `footerBtnRowEl`**, mirroring the already-existing close-button creation in `buildContainer()` (`inline-runner-modal.ts:170-173`). The `space-between` row still has two items — close button (start) and `iconsGroup` (end) — so the visual layout is unchanged: close stays left, Back/Redo/Skip stay right. `buildContainer()`'s footer is only the initial shell (it gets `empty()`-ed on first `render()`), so the only render path that matters is `render()`'s footer rebuild, which this slice rewrites.

**What stays.** `SnippetEditorModal` (the class and file) is untouched — it has three other callers (`main.ts:110-113` `handleCreateSnippet`, `snippet-manager-view.ts:241-262` create/edit, `snippet-chip-editor.ts`). Only the `inline-runner-modal.ts` import becomes unused and is dropped. The `.rp-runner-icon-btn:disabled` CSS rule (`inline-runner.css:351-358`) is kept — it still styles the Back/Redo/Skip buttons whose `disabled` state is toggled in `renderFooterIcons`. No tests reference the button (verified: `grep` across `src/__tests__/` returns nothing), so no test edits are needed.

**i18n.** The `protocolRunner.createSnippetFromSelection` key is removed from both `en.json` and `ru.json`. It has no remaining consumers after the button's `aria-label` is deleted (the only read site was `inline-runner-modal.ts:464`).

## File Map

- `src/views/inline-runner-modal.ts` — change — Drop the `SnippetEditorModal` import (line 12); delete the two `Phase 2` field declarations `createSnippetBtnEl` and `boundSelectionHandler` (lines 79-81); delete the selection-listener wiring block in `open()` (lines 234-239, the comment + `boundSelectionHandler` assignment + the two `addEventListener` calls); delete the selection-listener teardown block in `close()` (lines 269-275, the `boundSelectionHandler` null-guard + `removeEventListener` pair + the `createSnippetBtnEl = null` line); rewrite the footer rebuild in `render()` (lines 446-474) to create the close button as a direct child of `footerBtnRowEl` (no `leftGroup` div, no `createSnippetBtn`); delete the three private methods `getSelectedContentText`, `updateCreateSnippetButtonState`, `handleCreateSnippetFromSelection` (lines 739-775).
- `src/styles/inline-runner.css` — change — Delete the `.rp-runner-footer-left` rule and its `Phase 2` comment (lines 341-347). Keep `.rp-runner-icon-btn:disabled` (lines 351-358) — shared disabled styling for Back/Redo/Skip.
- `src/i18n/locales/en.json` — change — Remove the `"createSnippetFromSelection": "Create snippet from selection"` entry (line 313) from the `protocolRunner` object.
- `src/i18n/locales/ru.json` — change — Remove the `"createSnippetFromSelection": "Создать сниппет из выделения"` entry (line 313) from the `protocolRunner` object.

## Key Interfaces

No new types or exports are introduced — this slice is purely subtractive. The only public-surface change is on `InlineRunnerModal`'s private members (no external caller reads them):

- `InlineRunnerModal.createSnippetBtnEl: HTMLButtonElement | null` — **removed**
- `InlineRunnerModal.boundSelectionHandler: (() => void) | null` — **removed**
- `InlineRunnerModal.getSelectedSelectedContentText(): string` — **removed** (private)
- `InlineRunnerModal.updateCreateSnippetButtonState(): void` — **removed** (private)
- `InlineRunnerModal.handleCreateSnippetFromSelection(): Promise<void>` — **removed** (private)

The footer rebuild in `render()` retains the close-button shape already used in `buildContainer()`:

```ts
// render(): footer rebuild after this slice (replaces lines 446-474)
if (this.footerBtnRowEl !== null) {
  this.footerBtnRowEl.empty();
  const closeBtn = this.footerBtnRowEl.createEl('button', {
    cls: 'rp-inline-runner-close-btn rp-runner-icon-btn',
  });
  setIcon(closeBtn, 'x');
  closeBtn.setAttribute('aria-label', this.plugin.i18n.t('protocolRunner.closeProtocol'));
  closeBtn.addEventListener('click', () => {
    this.close();
  });
}
// renderFooterIcons() appends the rp-runner-footer-row (Back/Redo/Skip) as before.
```

## Integration Points

- `src/views/inline-runner-modal.ts:12` — `SnippetEditorModal` import removed; the symbol is still imported and used by `src/main.ts`, `src/views/snippet-manager-view.ts`, `src/views/snippet-chip-editor.ts`, so removing this single import line is safe (no other code in this file references `SnippetEditorModal` after the three methods are deleted).
- `src/views/inline-runner-modal.ts:234-239` — selection-listener wiring in `open()` deleted; `open()` ends after the `boundKeyHandler` attach block, so no dangling references.
- `src/views/inline-runner-modal.ts:269-275` — selection-listener teardown in `close()` deleted; `close()` retains the `boundKeyHandler` teardown immediately above (lines 263-268) and the event-ref cleanup below, preserving the parity pattern. `createSnippetBtnEl` no longer nulled (field gone).
- `src/views/inline-runner-modal.ts:446-474` — footer rebuild in `render()` rewritten: close button becomes a direct `footerBtnRowEl` child. `renderFooterIcons` (called later in the `at-node`/`awaiting-loop-pick` arms at `:578` and `:619`) still appends `iconsGroup` to `footerBtnRowEl` — the `space-between` row continues to place close left / icons right.
- `src/views/inline-runner-modal.ts:739-775` — three private methods deleted; no external caller (they were only invoked from the deleted button handler and `open()`/`close()` wiring).
- `src/styles/inline-runner.css:341-347` — `.rp-runner-footer-left` rule deleted; the class is no longer emitted by any TS (the only `createDiv({ cls: 'rp-runner-footer-left' })` was at `:451`, also deleted). No other CSS rule references `.rp-runner-footer-left`.
- `src/i18n/locales/en.json:313` and `src/i18n/locales/ru.json:313` — `protocolRunner.createSnippetFromSelection` key removed from both locales (i18n guidance requires both stay in sync; the only read site `inline-runner-modal.ts:464` is deleted in the same change).
- No coupling to sibling slices: Slice 2 touches the runner's snippet-resolution path (`inline-runner-modal.ts:1063-1075`) and the snippet model — disjoint from the footer button. Slice 3/4/5 touch graph/editor/CSS for other components. This slice's `inline-runner-modal.ts` edits are confined to the footer button + selection machinery (lines 12, 79-81, 234-239, 269-275, 446-474, 739-775) and do not overlap Slice 2's snippet-resolution lines.

## Success Criteria

- [ ] `npm run build` (tsc + esbuild) passes with no errors — confirms the `SnippetEditorModal` import removal leaves no unused-symbol reference and the deleted methods/fields have no remaining callers.
- [ ] `npm run lint` (ESLint + Stylelint) passes — confirms no unused-variable / unused-CSS-rule violations from the deletions.
- [ ] `npm test` (Vitest) passes unchanged — the existing inline-runner test suites still pass with no edits (no test referenced the button or the three private methods).
- [ ] `grep -rn "createSnippetFromSelection\|createSnippetBtn\|boundSelectionHandler\|getSelectedContentText\|updateCreateSnippetButtonState\|handleCreateSnippetFromSelection\|rp-runner-footer-left\|rp-inline-runner-create-snippet-btn" src/` returns no matches — every symbol named in the slice scope is gone from the source tree.
- [ ] `grep -rn "createSnippetFromSelection" src/i18n/locales/` returns no matches — the i18n key is removed from both `en.json` and `ru.json`.
- [ ] In the running inline runner, the footer shows only the close (×) button on the left and Back/Redo/Skip on the right when applicable; no `file-plus` icon is present and no create-snippet-from-selection affordance exists.
- [ ] Selecting text inside the inline runner content area produces no console errors and no state changes (the `mouseup`/`selectionchange` listeners are gone), confirming the listener wiring was fully removed rather than orphaned.

## Notes / Deferred

- Assumed (in lieu of a blocker question): the close button as a direct `footerBtnRowEl` child under `justify-content: space-between` preserves the existing left/right split because `renderFooterIcons`' `iconsGroup` (`rp-runner-footer-row`, `justify-content: flex-end`) remains the second flex item. This is the same two-item layout `buildContainer()` already establishes for the initial shell, so no new CSS is needed.
- Assumed: `file-plus` Lucide icon has no other import-side coupling here (it is resolved by `setIcon` at call time); removing the single `setIcon(createSnippetBtn, 'file-plus')` call is the only `file-plus` reference in this file and its deletion is safe.
- Deferred to Slice 2: the runner's snippet-resolution path and `SnippetEditorModal`'s own behavior are untouched by this slice. Slice 2 will further edit `inline-runner-modal.ts` around the snippet-resolution lines (`:1063-1075`), which are disjoint from the footer edits here.
- No migration/UX note is needed for users: the create-snippet-from-selection feature is simply removed from the inline runner; the same create flow remains available via the snippet manager view and the `main.ts` command palette entry (`handleCreateSnippet`), which are out of scope and untouched.