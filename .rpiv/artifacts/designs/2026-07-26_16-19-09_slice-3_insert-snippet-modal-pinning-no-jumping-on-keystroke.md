---
date: 2026-07-26T16:19:09+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 946c20f
topic: "Insert snippet modal pinning — no jumping on keystroke"
source: .rpiv/artifacts/slices/2026-07-26_16-13-35_snippet-create-from-selection-and-insert-modal-ux.md
slice_n: 3
slice_title: "Insert snippet modal pinning — no jumping on keystroke"
depends_on: []
status: ready
tags: [design, slice]
---

# Design — Slice 3: Insert snippet modal pinning — no jumping on keystroke

## Approach

`InsertSnippetModal extends Modal` (`src/views/insert-snippet-modal.ts:8`). Obsidian's
`Modal` base vertically centers `.modal` inside `.modal-container` (flex,
`align-items: center`). Because the picker rebuilds its body on every debounced
keystroke — `renderSearchResults()` calls `removeBody(host)` then recreates a **bare**
`.rp-stp-list` directly on `host` (not wrapped in `.rp-stp-body`,
`src/views/snippet-tree-picker.ts:416-473`) — the modal's content height changes per
keystroke, so Obsidian re-centers and the modal visibly jumps. The async-gap
blank-jump was already fixed by `fed8242`; the remaining symptom is purely the
height-recentering on result-count change.

The fix is **CSS-only** plus a single `addClass` call — no JS logic change in the
picker. Two parts, both scoped to a new `rp-insert-snippet-modal` class added to
`modalEl` in `onOpen()`:

1. **Pin the modal near the top.** Add `rp-insert-snippet-modal` to `modalEl`
   (using the protected-cast pattern from `snippet-editor-modal.ts:151-153`, since
   `modalEl` is protected on `Modal`). A scoped `.rp-insert-snippet-modal { align-self:
   flex-start; margin-top: 0; }` opts out of the container's `align-items: center`, so
   content-height changes no longer recenter. The container's top padding still gives
   a sensible near-top offset.

2. **Stabilize the picker body height in the insert host.** The insert host
   `.rp-insert-snippet-picker-host` currently gets only width CSS
   (`snippet-tree-picker.css:222-228`) — no height treatment — unlike
   `.rp-stp-modal-host .rp-stp-body { height: 360px }` (`:26`) and
   `.rp-stp-modal-host .rp-stp-list { min-height: 240px }` (`:249-250`) which apply only
   to the Snippet Manager move-to modal. Add the same height treatment scoped to the
   insert host so the rebuild never changes outer dimensions:
   - `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-body { height: 360px }` —
     stabilizes the drill view (breadcrumb + list).
   - `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-list { min-height: 320px }`
     — stabilizes the bare search-result list. The global `.rp-stp-list { max-height:
     320px }` (`:148`) still applies, so `min-height == max-height == 320px` fixes the
     search list at exactly 320px regardless of result count. The `> .rp-stp-list`
     direct-child selector avoids touching the inner list inside `.rp-stp-body` (which
     is governed by `.rp-stp-body .rp-stp-list { flex: 1 1 auto }`, `:40`).

This is intentionally CSS-only: it composes with Slice 4 (keyboard nav) and Slice 5
(name-only display) without coupling — both touch `snippet-tree-picker.ts` rendering,
not the modal geometry or host CSS.

## File Map

- `src/views/insert-snippet-modal.ts` — change — at the top of `onOpen()`, add
  `modalEl.addClass('rp-insert-snippet-modal')` via the same protected-cast pattern
  used by `SnippetEditorModal` (`snippet-editor-modal.ts:151-153`). No other JS
  change.
- `src/styles/snippet-tree-picker.css` — change — append scoped rules next to the
  existing `.rp-insert-snippet-picker-host` width-only block (`:222-228`): a
  `.rp-insert-snippet-modal` pin rule (`align-self: flex-start; margin-top: 0`) and
  two height-stabilization rules for `.rp-insert-snippet-picker-host .rp-stp-root >
  .rp-stp-body` (`height: 360px`) and `.rp-insert-snippet-picker-host .rp-stp-root >
  .rp-stp-list` (`min-height: 320px`). No new CSS file — `snippet-tree-picker.css` is
  already in `CSS_FILES` in `esbuild.config.mjs:46-56`.

## Key Interfaces

No new types or exports. The only new contract is the CSS class name
`rp-insert-snippet-modal` applied to the Obsidian `Modal.modalEl` by
`InsertSnippetModal.onOpen()`. Slice 4 and Slice 5 do not consume it.

```ts
// src/views/insert-snippet-modal.ts — onOpen() preamble (shape, not full body)
onOpen(): void {
  // Slice 3: scope modal geometry so search-result rebuilds don't recenter.
  const modalEl = (this as unknown as { modalEl?: { addClass?: (cls: string) => void } }).modalEl;
  if (typeof modalEl?.addClass === 'function') {
    modalEl.addClass('rp-insert-snippet-modal');
  }
  const { contentEl, titleEl } = this;
  // …existing body unchanged…
}
```

```css
/* src/styles/snippet-tree-picker.css — appended after the .rp-insert-snippet-picker-host
   width-only rule (lines 222-228). */
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
     Global .rp-stp-list { max-height: 320px } (line 148) still applies, so
     min==max==320px fixes the height regardless of result count. */
  min-height: 320px;
}
```

## Integration Points

- `src/views/insert-snippet-modal.ts:21` — `modalEl.addClass('rp-insert-snippet-modal')`
  inserted as the first statement of `onOpen()`, before `contentEl.empty()`. Mirrors
  the protected-cast pattern at `src/views/snippet-editor-modal.ts:151-153`.
- `src/styles/snippet-tree-picker.css:222-228` — the new `.rp-insert-snippet-modal`,
  `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-body`, and
  `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-list` rules are appended
  immediately after the existing `.rp-insert-snippet-picker-host` width-only block,
  extending the same host scope. `snippet-tree-picker.css` is already wired into the
  build via `esbuild.config.mjs` `CSS_FILES`.
- No coupling to Slices 1–2 (create-from-selection flows) or Slices 4–5 (picker render
  changes): those touch `snippet-tree-picker.ts` / `main.ts` / `snippet-editor-modal.ts`,
  not the insert modal's `modalEl` class or the insert-host height CSS.

## Success Criteria

- [ ] `InsertSnippetModal.onOpen()` adds class `rp-insert-snippet-modal` to `modalEl`
      using the protected-cast pattern (mirrors `snippet-editor-modal.ts:151-153`).
- [ ] `snippet-tree-picker.css` defines `.rp-insert-snippet-modal` with
      `align-self: flex-start` and `margin-top: 0` (opts out of Obsidian's flex
      vertical centering).
- [ ] `snippet-tree-picker.css` sets `.rp-insert-snippet-picker-host .rp-stp-root >
      .rp-stp-body { height: 360px }` (stabilizes the drill view).
- [ ] `snippet-tree-picker.css` sets `.rp-insert-snippet-picker-host .rp-stp-root >
      .rp-stp-list { min-height: 320px }` (stabilizes the bare search-result list;
      combined with the global `max-height: 320px` at `:148`, the height is fixed).
- [ ] The inner list inside `.rp-stp-body` (drill view) is **not** affected by the new
      `min-height` rule — direct-child selector `> .rp-stp-list` targets only the bare
      search list (verified by reading the CSS).
- [ ] Manual: open Insert snippet, type a query that matches a varying number of
      snippets, then clear it — the modal does not move vertically on any keystroke.
- [ ] `npm run lint` (ESLint + Stylelint) passes on the changed files.
- [ ] `npm run build` (type-check + esbuild) passes.

## Notes / Deferred

- **Assumption on Obsidian centering.** The pin rule assumes Obsidian centers `.modal`
  via flex `align-items: center` on `.modal-container` (current behavior); `align-self:
  flex-start` opts out. If a future Obsidian version switches `.modal` to
  absolute/fixed positioning, the pin would need `top: 0; bottom: auto` instead. This
  is a runtime/visual concern, deferred to re-validation if Obsidian bumps break the
  pin — not a blocker for this slice.
- **`fed8242` already fixed the async-gap blank-jump.** This slice does **not** touch
  `renderSearchResults()` JS (`snippet-tree-picker.ts:416-473`) — the "keep the current
  rendered body in place while the async vault scan runs" guard there stays intact.
  Slice 3 only addresses the remaining height-recentering symptom, via CSS + the
  `addClass` call.
- **No i18n strings.** The slice adds no user-visible text, so no keys are added to
  `src/i18n/locales/en.json` or `ru.json`.
- **Orthogonal to Slices 4 & 5.** Keyboard navigation (Slice 4) and name-only display
  (Slice 5) both modify `snippet-tree-picker.ts` rendering (`renderFileRow`, listeners)
  — they do not touch the insert modal's `modalEl` class or the insert-host height CSS,
  so the three slices compose without coupling.