---
date: 2026-07-27T17:08:06+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 9c4452e
topic: "Insert-snippet modal CSS: stronger keyboard highlight + top margin and vertical extension"
source: .rpiv/artifacts/slices/2026-07-27_16-38-57_runner-cleanup-nodes-snippets-modal-ux.md
slice_n: 5
slice_title: "Insert-snippet modal CSS: stronger keyboard highlight + top margin and vertical extension"
depends_on: []
status: ready
tags: [design, slice]
---

# Design — Slice 5: Insert-snippet modal CSS: stronger keyboard highlight + top margin and vertical extension

## Approach

Both changes are CSS-only and confined to `src/styles/snippet-tree-picker.css`. No TS
edit — the keyboard-highlight machinery (`highlightedIndex` / `moveHighlight` / live-DOM
`querySelectorAll` / reset after `removeBody`) introduced by the prior slice-4 design
(`.rpiv/artifacts/designs/2026-07-26_16-19-09_slice-4_snippettree-picker-keyboard-navigation.md`)
stays exactly as-is. The pinning invariant from the prior slice-3 design
(`.rpiv/artifacts/designs/2026-07-26_16-19-09_slice-3_insert-snippet-modal-pinning-no-jumping-on-keystroke.md`)
— `align-self: flex-start` so content-height changes don't recenter the modal, plus
fixed `min==max` list height so the per-keystroke `removeBody` rebuild doesn't jump — is
preserved; this slice only shifts *where* the pin sits and *how tall* the fixed box is.

### (a) Stronger keyboard highlight — `src/styles/snippet-tree-picker.css:301-304`

The current `.rp-stp-row-highlighted` uses `--background-modifier-hover`, which is the
**same** token applied to `.rp-stp-crumb:hover` / `.rp-stp-up-btn:hover`
(`snippet-tree-picker.css:138-141`) and to `.radi-snippet-tree-row:hover`
(`snippet-manager.css:202-204`). Mouse hover and keyboard highlight are therefore
visually identical, so a user mousing over the list while a row is keyboard-highlighted
cannot tell the two states apart (coverage `c7`). The established active-row pattern in
this codebase is `snippet-manager.css:214-217`:

```css
.radi-snippet-tree-row[data-editing="true"] {
  border-left: 2px solid var(--interactive-accent);
  background: var(--background-modifier-active-hover);
}
```

Reuse that exact treatment — swap the background token to
`--background-modifier-active-hover` (distinct from plain hover) and add a `2px` left
accent stripe in `--interactive-accent`. The left-stripe needs `border-left` (currently
the rule sets `border-color` on an already-`1px transparent` border from
`.rp-stp-folder-row`/`.rp-stp-file-row` at `:111-112`; changing `border-color` alone kept
it a faint 1px outline). Concretely: set `border-left: 2px solid var(--interactive-accent)`
and adjust the row's `padding-left` by `-1px` so the 2px stripe doesn't shift content
(the base rows already carry `padding: var(--size-2-3)` with a 1px transparent border; the
net left inset grows by 1px, acceptable, but offset is the cleaner choice — keep it
simple and just set the border-left, since a 1px content nudge on a transient highlight
is imperceptible and matches the `[data-editing="true"]` precedent which makes no
padding adjustment). A secondary `font-weight: var(--font-semibold)` bump on
`.rp-stp-row-title` inside the highlighted row sharpens the distinction further; it is
optional polish and scoped to `.rp-stp-row-highlighted .rp-stp-row-title` so it never
affects un-highlighted rows.

### (b) Top margin + vertical extension — `src/styles/snippet-tree-picker.css:232-247`

The insert modal is currently pinned flush to the top (`margin-top: 0`) and capped at a
fixed 360px body / 320px list, which leaves it floating in the upper-left with a short
height regardless of viewport (coverage `c8`). Four scoped edits, all under
`.rp-insert-snippet-modal` / `.rp-insert-snippet-picker-host` so the inline-runner
picker and the Snippet Manager move-to modal are untouched (the slice map's
"shared caps caused that regression before" warning — `inline-runner.css:71,92` and the
prior regression note in slice-3's design — is honored by host-scoping every override):

1. `.rp-insert-snippet-modal { margin-top: var(--size-4-6); }` — shift the pin down from
   the container's top padding to a deliberate top margin. `--size-4-6` is the same token
   used by `protocol-editor.css:97` for top inset, so it reads as a consistent Obsidian
   UI offset. `align-self: flex-start` is kept (content still grows downward from the
   pin).
2. `.rp-insert-snippet-modal { max-height: calc(100vh - var(--size-4-12)); }` — safety
   cap so the taller modal can never overflow a short viewport. The
   `calc(100vh - var(--size-4-N))` form is the established tall-modal precedent
   (`inline-runner.css:71,92`). `--size-4-12` leaves a larger bottom margin than the
   `--size-4-8` used by the runner, matching the slice's "small bottom margin" intent.
3. Raise the drill-view body height `360px → 480px` on
   `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-body` (proportional ×1.33). The
   inner list is `flex: 1 1 auto` (`:40`), so it fills the taller body automatically.
4. Raise the bare search-result list height `320px → 440px` on
   `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-list` by setting **both**
   `min-height: 440px` and `max-height: 440px` (host-scoped, overriding the global
   `max-height: 320px` at `:148`). min==max keeps the slice-3 pinning invariant — the
   per-keystroke `removeBody` + bare-list rebuild still sees a fixed-height box, so no
   recenter. The `> .rp-stp-list` direct-child selector still avoids the inner list
   inside `.rp-stp-body` (governed by `.rp-stp-body .rp-stp-list { flex: 1 1 auto }`).

The body (480px) and bare list (440px) track each other within the same ~40px delta the
original 360/320 pair kept, so drill view and search view stay visually consistent.

## File Map

- `src/styles/snippet-tree-picker.css` — change — (1) rewrite the `.rp-stp-row-highlighted`
  rule at `:301-304` to use `--background-modifier-active-hover` plus a `2px` left accent
  stripe in `--interactive-accent`; (2) add a scoped
  `.rp-stp-row-highlighted .rp-stp-row-title { font-weight: var(--font-semibold); }`
  enhancement; (3) edit the `.rp-insert-snippet-modal` rule at `:232-235` to set
  `margin-top: var(--size-4-6)` and add `max-height: calc(100vh - var(--size-4-12))`,
  keeping `align-self: flex-start`; (4) raise
  `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-body { height: 480px; }`
  (was `360px`); (5) raise
  `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-list` to
  `{ min-height: 440px; max-height: 440px; }` (was `min-height: 320px`, with the global
  `max-height: 320px` now overridden host-scoped). No other file changes —
  `snippet-tree-picker.css` is already in `CSS_FILES` in `esbuild.config.mjs`, and no
  TS/i18n/test files are touched.

## Key Interfaces

No new types, exports, or CSS class names. The only contracts touched are existing class
selectors already applied by `InsertSnippetModal.onOpen()` (`rp-insert-snippet-modal`,
applied to `modalEl` at `insert-snippet-modal.ts:22-25`) and by `SnippetTreePicker`
keyboard-nav (`rp-stp-row-highlighted`, toggled by `moveHighlight`). No selector is
renamed or re-scoped; only the declarations inside the rules change.

```css
/* src/styles/snippet-tree-picker.css — final shape of the edited rules. */

/* Slice 5 — keyboard highlight distinct from mouse hover. Mirrors the
   [data-editing="true"] active-row pattern in snippet-manager.css:214-217. */
.rp-stp-row-highlighted {
  background: var(--background-modifier-active-hover);
  border-left: 2px solid var(--interactive-accent);
}

.rp-stp-row-highlighted .rp-stp-row-title {
  font-weight: var(--font-semibold);
}

/* Slice 3 + Slice 5 — pin near the top with a deliberate margin, cap to viewport,
   and grow the fixed body/list height so the modal extends downward. */
.rp-insert-snippet-modal {
  /* Opt out of .modal-container's align-items: center; anchor below the top padding. */
  align-self: flex-start;
  margin-top: var(--size-4-6);
  max-height: calc(100vh - var(--size-4-12));
}

.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-body {
  /* Stabilize + extend drill view outer height (was 360px). */
  height: 480px;
}

.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-list {
  /* Bare search-result list recreated on host by renderSearchResults().
     min==max==440px fixes AND extends the height regardless of result count,
     overriding the global max-height: 320px (line 148) host-scoped. */
  min-height: 440px;
  max-height: 440px;
}
```

## Integration Points

- `src/styles/snippet-tree-picker.css:232-247` — the `.rp-insert-snippet-modal` and
  `.rp-insert-snippet-picker-host .rp-stp-root > …` rules. Consumed by
  `InsertSnippetModal.onOpen()` (`src/views/insert-snippet-modal.ts:22-25`), which
  applies `rp-insert-snippet-modal` to `modalEl` and mounts the picker into
  `rp-insert-snippet-picker-host`. No TS change; the class application already exists
  from the prior slice-3 design.
- `src/styles/snippet-tree-picker.css:301-304` — the `.rp-stp-row-highlighted` rule.
  Consumed by `SnippetTreePicker.moveHighlight()` (from the prior slice-4 design), which
  toggles this class on the keyboard-focused row. No TS change.
- Sibling-slice isolation: no override leaks to `.rp-stp-modal-host` (Snippet Manager
  move-to modal, `:248-256`), `.rp-stp-inline-host` (inline runner picker, `:28-32`),
  or `.rp-stp-editor-host` (node editor inline mount, `:249-262`), because every height
  override in (b) is scoped under `.rp-insert-snippet-picker-host` / `.rp-insert-snippet-modal`
  only. The `.rp-stp-row-highlighted` change in (a) is global to all picker hosts, which
  is correct — keyboard nav runs in every host that mounts `SnippetTreePicker`, and a
 stronger highlight is desirable everywhere; the mouse-hover token it diverges from
  (`--background-modifier-hover`) is per-rule, not global, so no other rule changes
  behavior.

## Success Criteria

- [ ] `.rp-stp-row-highlighted` declares `background: var(--background-modifier-active-hover)` and `border-left: 2px solid var(--interactive-accent)` — verified by reading the rule in `src/styles/snippet-tree-picker.css`.
- [ ] A keyboard-highlighted row in the Insert Snippet modal is visually distinct from a mouse-hovered row (different background token + accent stripe) — manual check: open the modal, arrow-down to highlight a row, hover a different row with the mouse, the two states look different.
- [ ] `.rp-insert-snippet-modal` sets `margin-top: var(--size-4-6)`, keeps `align-self: flex-start`, and adds `max-height: calc(100vh - var(--size-4-12))`.
- [ ] `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-body` height is `480px` (was `360px`).
- [ ] `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-list` sets both `min-height: 440px` and `max-height: 440px` (was `min-height: 320px` + global `max-height: 320px`).
- [ ] The Insert Snippet modal sits with a visible top margin below the workspace top edge and extends further toward the bottom of the viewport than before, with a small bottom margin remaining — manual check on a normal-height viewport.
- [ ] The modal never overflows a short viewport — manual check: shrink the Obsidian window height until it's shorter than the modal's natural height; the `max-height: calc(100vh - var(--size-4-12))` cap clamps it and the list scrolls.
- [ ] The per-keystroke pinning invariant from slice 3 still holds — typing in the insert-modal search box does not recenter or jump the modal (the `min==max` list height is preserved at 440px).
- [ ] The inline-runner picker and the Snippet Manager «Переместить в…» modal are unaffected — their body/list heights are unchanged (no override leaks outside `.rp-insert-snippet-modal` / `.rp-insert-snippet-picker-host`).
- [ ] `npm run lint` (Stylelint) passes with no new warnings on `src/styles/snippet-tree-picker.css`.
- [ ] No TS file is modified — `git diff --name-only` shows only `src/styles/snippet-tree-picker.css`.

## Notes / Deferred

- The exact proportional heights (480px body / 440px list) are this design's concrete
  choice; the slice map specified "raise proportionally" without mandating numbers. The
  +120px / +120px lift preserves the original 40px delta between body and bare list, and
  both stay within the `max-height: calc(100vh - var(--size-4-12))` safety cap on any
  viewport ≥ ~540px tall. If a taller modal is later wanted, the two numbers are the
  only knobs.
- A `font-weight` bump on `.rp-stp-row-title` is taken as the "secondary enhancement"
  the slice map names; it is scoped to `.rp-stp-row-highlighted .rp-stp-row-title` so it
  never bleeds into un-highlighted rows or other hosts.
- No padding adjustment is made for the 2px left stripe (matches the
  `[data-editing="true"]` precedent in `snippet-manager.css:214-217`, which also makes
  none); the 1px net content nudge on a transient highlight is imperceptible.
- Out of scope, per the slice map: any change to the keyboard-navigation TS logic; the
  inline-runner-host picker CSS; and the folder-select committed-button accent style
  (`.rp-stp-select-folder-btn.is-committed`, `:283-293`), which stays visually distinct
  from the new keyboard-highlight accent.