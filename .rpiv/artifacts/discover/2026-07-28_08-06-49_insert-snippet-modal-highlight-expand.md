---
date: 2026-07-28T08:06:49+0300
author: Roman Shulgha
commit: d873dac
branch: main
repository: RadiProtocol
topic: "Insert snippet modal — clearer keyboard highlight and expand-to-fill height"
tags: [intent, frd, views, styles, snippet-tree-picker, insert-snippet-modal]
status: ready
last_updated: 2026-07-28T08:06:49+0300
last_updated_by: Roman Shulgha
---

# FRD: Insert snippet modal — clearer keyboard highlight and expand-to-fill height

## Summary
Strengthen the keyboard-selected highlight in the "Insert snippet" modal so the active snippet is unambiguous during arrow-key navigation, and change the modal/list sizing from fixed caps (320px drill / 440px search, content-sized modal) to a flex-fill layout that grows the modal downward — leaving a bottom margin equal to the top margin — and lets the scrollable list span the full available modal height. All changes are CSS-only, scoped to the Insert-snippet modal selectors.

## Problem & Intent
In the developer's words:

> In the modal that appears after running the **"Insert snippet"** command, make the selected snippet more clearly highlighted when navigating with the keyboard arrow keys. The current highlight color is too faint, so it is not always obvious which snippet is selected at a given moment.
>
> I would also like this modal—the one that appears after running **"Insert snippet"**, where users navigate through the list and select a snippet to insert—to be able to expand further downward, leaving the same margin at the bottom of the screen as it has at the top.
>
> The scrollbar should not be constrained as it is now. It should extend across the full available height of the modal. At the moment, the modal and scrollbar appear to have a fixed height, so when a folder contains many snippets, users often have to scroll down even though there is still plenty of unused screen space. The modal should expand downward to use that space, and the scrollable list area should grow accordingly.

Who hits it: the **end-user radiologist** running protocols day-to-day. They struggle to see which snippet is selected and to reach snippets in large folders without unnecessary scrolling. Success looks like: the active row is immediately obvious during keyboard navigation, and a folder with many snippets uses the available screen space before forcing a scroll.

## Goals
- The keyboard-selected snippet row in the Insert-snippet modal is visually unmistakable against the surrounding rows (high-contrast accent fill + on-accent text).
- The modal expands downward to use available viewport height, leaving a bottom margin equal to its top margin (`var(--size-4-6)`).
- The scrollable list area grows to fill the modal height, so the scrollbar spans the full available modal height instead of a fixed 320px/440px cap.
- The fix applies uniformly to both the drill-view (folder navigation) list and the bare search-results list.

## Non-Goals
- No changes to other `SnippetTreePicker` consumers (protocol-editor picker at `protocol-editor.css:509-516`, generic `.rp-stp-modal-host`). The shared `.rp-stp-list` generic `max-height: 320px` rule is left untouched.
- No JS/markup changes to the highlight mechanism — `.rp-stp-row-highlighted` class toggling in `snippet-tree-picker.ts:573-586` is preserved.
- No JS-computed pixel heights; sizing is CSS flex-fill only.
- No always-fill behavior — when a folder has few snippets the modal stays compact (height auto, capped by `max-height`); it only grows toward the cap when content needs it.
- Adding `aria-selected`/`aria-activedescendant` to the highlighted row is deferred (out of scope for this feature).

## Functional Requirements
1. The system SHALL style `.rp-stp-row-highlighted` inside the Insert-snippet modal with an `--interactive-accent` background and `--text-on-accent` text color (retaining the inset accent stripe), so the keyboard-selected row is high-contrast in both light and dark themes.
2. The system SHALL make the Insert-snippet modal (`.rp-insert-snippet-modal`) grow to fill available viewport height up to a cap of `calc(100vh - 2 * var(--size-4-6))`, while reserving a bottom margin equal to its existing top margin (`var(--size-4-6)`).
3. The system SHALL size the modal with `height: auto` (content-sized) bounded by the viewport-relative `max-height`, so a short list yields a compact modal and a long list expands toward the cap.
4. The system SHALL make the drill-view scrollable list (`.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-body .rp-stp-list`) flex-grow to fill the body height, overriding the generic `max-height: 320px` cap inside the Insert host only.
5. The system SHALL make the bare search-results list (`.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-list`) flex-grow to fill the modal height, replacing the fixed `height: min(440px, calc(100vh - 12.5rem))` cap.
6. The system SHALL preserve the existing keyboard-navigation behavior (`scrollIntoView({ block: 'nearest' })` at `snippet-tree-picker.ts:586`, wrap-around, highlight reset on re-render) unchanged.
7. The system SHALL scope all changes to selectors rooted at `.rp-insert-snippet-modal` / `.rp-insert-snippet-picker-host` and SHALL NOT modify the generic `.rp-stp-list`, `.rp-stp-modal-host`, or protocol-editor picker rules.

## Non-Functional Requirements
- **Performance**: No JS height computation or resize listeners; pure CSS — no runtime cost beyond layout recalculation the browser already performs.
- **Security**: N/A — pure presentation; no data, auth, or network surface.
- **UX / Accessibility**: High-contrast selection must remain readable in both light and dark themes; the existing `aria-live` status span (`snippet-tree-picker.ts:161-168, 591-596`) continues to announce the highlighted item. No layout shift on highlight (preserve the base 1px transparent border geometry so adding the stripe/strength does not reflow row content).
- **Reliability**: Short-viewport fallback preserved — the modal's `max-height` + `overflow-y: auto` safety net keeps it clamping/scrolling on small screens without recentering.

## Constraints & Assumptions
- **Technical**: Obsidian Modal container uses `align-items: center` by default; the plugin already opts out via `align-self: flex-start` (`snippet-tree-picker.css:232-240`). The flex-fill approach must work within Obsidian's `.modal-container` flex context.
- **Technical**: `--interactive-accent` and `--text-on-accent` are standard Obsidian theme tokens expected to pair correctly across stock themes; custom themes that redefine these tokens inherit the behavior.
- **Assumption**: The generic `.rp-stp-list` `max-height: 320px` cap can be overridden inside the Insert host via a more-specific scoped rule without affecting other consumers. (Research should verify selector specificity wins against `.rp-stp-body .rp-stp-list { flex: 1 1 auto }` at `snippet-tree-picker.css:40-42` and the generic cap at `:142-153`.)
- **Assumption**: No JS change is needed to make the body/list flex-grow — the existing DOM structure (`.rp-stp-root` → `.rp-stp-body` → `.rp-stp-list`, and bare `.rp-stp-list` for search) supports CSS flex sizing.

## Acceptance Criteria
- [ ] Running `npm run lint` exits 0 (stylelint governs the changed CSS).
- [ ] Running `npm test` exits 0 (existing keyboard-navigation tests at `src/__tests__/views/snippet-tree-picker.test.ts:1160-1344` still pass — no JS/markup change).
- [ ] Opening the Insert-snippet modal and pressing ArrowDown/ArrowUp: the active row shows a clearly visible accent-colored background with on-accent text, distinct from non-highlighted rows, in both default light and dark themes.
- [ ] In a folder containing more snippets than the old 320px cap could show: the modal/list expands downward so all rows up to the viewport cap are visible without scrolling; the scrollbar (when present) spans the full modal list height.
- [ ] In a folder with only a few snippets: the modal is compact (not forced to full viewport height), with no empty space below the last row.
- [ ] The modal's visible bottom margin equals its top margin (`var(--size-4-6)`) when the list grows to the viewport cap.
- [ ] Typing in the search box (search-results view): the bare results list also expands to fill available height (no longer fixed at 440px), with the same highlight strength on the active row.
- [ ] Opening the protocol-editor snippet picker (the other `SnippetTreePicker` consumer): its sizing and list height are unchanged (still capped at 320px / per `protocol-editor.css:509-516` and `.rp-stp-modal-host` rules).
- [ ] `npm run knip` reports no new dead code (no JS files added).

## Recommended Approach
CSS-only edits in `src/styles/snippet-tree-picker.css`, scoped to `.rp-insert-snippet-modal` and `.rp-insert-snippet-picker-host` selectors: (1) strengthen `.rp-stp-row-highlighted` to `background: var(--interactive-accent); color: var(--text-on-accent)` retaining the inset stripe; (2) raise the modal `max-height` to reserve equal top/bottom `var(--size-4-6)` margins and let the body/list flex-grow (`flex: 1 1 auto; min-height: 0`) to fill the modal, overriding the generic 320px/440px caps via more-specific Insert-host selectors only. No JS, no markup, no shared-rule changes.

## Decisions

### Highlight mechanism — CSS-only strengthen
**Question**: Pre-resolved from codebase evidence — the faint highlight comes from `.rp-stp-row-highlighted` styled with `--background-modifier-active-hover` + a 2px inset accent stripe + semibold title (`snippet-tree-picker.css:313-321`), toggled by JS at `snippet-tree-picker.ts:573-586`. Keep the JS class mechanism and strengthen only CSS, or also change JS/markup?
**Recommended**: CSS-only strengthen (keep `.rp-stp-row-highlighted` class mechanism).
**Chosen**: CSS-only strengthen.
**Rationale**: JS already toggles the class correctly and tests assert that behavior; the faintness is purely a CSS-value problem, so changing CSS is the minimal-risk fix.

### Modal sizing approach — CSS flex-fill
**Question**: Pre-resolved from codebase evidence — modal is content-sized (`align-self:flex-start; margin-top:var(--size-4-6); max-height:calc(100vh - var(--size-4-12))`, no `height`) and the list is hard-capped at 320px (drill) / 440px (search). Use CSS flex-fill or JS-computed heights?
**Recommended**: CSS flex-fill (no JS dimension computation).
**Chosen**: CSS flex-fill.
**Rationale**: Sizing is already CSS-owned (no `style.height` assignments in `insert-snippet-modal.ts` or `snippet-tree-picker.ts`); flex-fill avoids resize listeners and theme-switch recompute bugs.

### Change scope — Insert-modal only
**Question**: Pre-resolved from codebase evidence — `SnippetTreePicker` is shared with the protocol-editor picker (`protocol-editor.css:509-516`, `.rp-stp-modal-host`). Scope changes to the Insert-snippet modal only, or also modify the shared `.rp-stp-list` rule?
**Recommended**: Insert-modal only — scope to `.rp-insert-snippet-modal` / `.rp-insert-snippet-picker-host`, leave generic `.rp-stp-list` and other consumers untouched.
**Chosen**: Insert-modal only.
**Rationale**: The feature targets the Insert command's UX; touching the shared 320px cap risks re-laying-out the protocol editor and other pickers, expanding blast radius for no user-reported benefit.

### Highlight strength — accent background + on-accent text
**Question**: How strong should the keyboard-selected highlight become? Today: faint `--background-modifier-active-hover` bg + 2px inset accent stripe + semibold title, no text color change (`snippet-tree-picker.css:313-321`).
**Recommended**: Accent bg + on-accent text (`--interactive-accent` background, `--text-on-accent` text, keep inset stripe).
**Chosen**: Accent bg + on-accent text.
**Rationale**: Maximizes contrast (the stated problem is "not always obvious which snippet is selected") and matches Obsidian's native selected-item convention (`--interactive-accent`/`--text-on-accent` pairing), staying theme-portable across light/dark.

### Fill behavior — grow only as needed
**Question**: When a folder has only a few snippets, should the modal still expand to full viewport height, or grow only as needed up to the viewport cap?
**Recommended**: Grow only as needed — `height: auto` bounded by viewport-relative `max-height`; list flex-grows within the modal.
**Chosen**: Grow only as needed.
**Rationale**: The complaint is many-snippet folders forcing scroll; a small list should not produce a tall modal with empty space — content-sized height with a high cap gives both compactness and max-area-when-needed.

### Search-results list — apply expansion too
**Question**: The bare search-results list has its own cap (`height: min(440px, calc(100vh - 12.5rem))` at `snippet-tree-picker.css:249-257`). Apply the same expand-to-fill behavior there too, or only fix the drill-view list?
**Recommended**: Apply to search list too.
**Chosen**: Apply to search list too.
**Rationale**: Search results use the same keyboard navigation and can also be long; an inconsistent cap between drill and search views would re-introduce the scroll-when-space-remains problem mid-workflow.

### Accessibility (aria-selected) — deferred
**Question**: The probe found no `aria-selected` on the highlighted row (only an `aria-live` status at `snippet-tree-picker.ts:161-168, 591-596`). Add `aria-selected`/`aria-activedescendant` in scope, or defer?
**Recommended**: Defer aria to follow-ups — the existing `aria-live` status already announces the highlighted item; aria-selected is a separate a11y enhancement.
**Chosen**: Defer to follow-ups (out of scope).
**Rationale**: The feature is a visual-strength + sizing fix; mixing in ARIA semantics expands scope into markup/JS changes the CSS-only decision explicitly excluded. Routed to Suggested Follow-ups.

## Open Questions
- None explicitly deferred beyond the accessibility item below — all branches resolved with a Decision.

## Suggested Follow-ups
- Add `aria-selected` (or `aria-activedescendant` + row `id`s) to the highlighted row in `SnippetTreePicker` for stronger screen-reader semantics — currently only an `aria-live` status span announces the active item (`snippet-tree-picker.ts:161-168, 591-596`). Out of scope per the CSS-only decision; would require JS/markup changes.
- Audit the other `SnippetTreePicker` consumers (protocol-editor picker at `protocol-editor.css:509-516`, `.rp-stp-modal-host` at `snippet-tree-picker.css:26-28, 275-283`) for the same faint-highlight / fixed-height issues if reported — the Insert-only scope here deliberately leaves them untouched.

## References
- Input: free-text feature description (this `/skill:discover` invocation).
- `src/views/insert-snippet-modal.ts` — modal definition, host class `.rp-insert-snippet-picker-host` (`:36`), container class `.rp-insert-snippet-modal` (`:23`).
- `src/views/snippet-tree-picker.ts` — shared picker; keyboard highlight JS at `:532-605`, class toggle at `:573-586`, `aria-live` status at `:161-168` and `:591-596`.
- `src/styles/snippet-tree-picker.css` — modal sizing `:232-240`, drill body `:242-247`, search list `:249-257`, generic list cap `:142-153`, highlight styling `:313-321`.
- `src/__tests__/views/snippet-tree-picker.test.ts:1160-1344` — keyboard-navigation test suite (must stay green).
- `src/main.ts:97-101, 292-308` — "Insert snippet" command registration and `handleInsertSnippet()`.