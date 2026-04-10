# Phase 18: CSS Gap Fixes — Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Three pure CSS additions to `src/styles.css`. No TypeScript changes. Closes three gaps identified by the v1.2 milestone audit:
- **LAYOUT-03:** `.rp-insert-btn` missing `flex: 1` — Insert button narrower than Copy/Save
- **SIDEBAR-01:** All `rp-selector-*` classes emitted by `canvas-selector-widget.ts` but absent from `styles.css`
- **RUNNER-01:** `.rp-run-again-btn` emitted in complete state but has no CSS rule

</domain>

<decisions>
## Implementation Decisions

### LAYOUT-03: Insert button equal width
- **D-01:** Extend the existing `.rp-copy-btn, .rp-save-btn { flex: 1; }` selector group (lines 61–64) to include `.rp-insert-btn` as a third selector. Single declaration for all three buttons — no separate rule.
  ```css
  .rp-copy-btn,
  .rp-save-btn,
  .rp-insert-btn {
    flex: 1;
  }
  ```

### SIDEBAR-01: Canvas selector bar separator
- **D-02:** `.rp-selector-bar` gets `border-bottom: 1px solid var(--background-modifier-border)` as a visual separator between the selector and the runner content below. Standard Obsidian sidebar panel convention.
  ```css
  .rp-selector-bar {
    flex: 0 0 auto;
    padding: var(--size-2-1) var(--size-4-2);
    border-bottom: 1px solid var(--background-modifier-border);
  }
  ```
- **D-03:** Full selector block per research recommendation — `rp-selector-bar`, `rp-selector-wrapper`, `rp-selector-trigger` (+ `:hover`), `rp-selector-trigger-label`, `rp-selector-placeholder`, `rp-selector-chevron`, `rp-selector-popover`, `rp-selector-row` (+ `:hover`, `.is-selected`), `rp-selector-row-icon`, `rp-selector-row-label`, `rp-selector-row-arrow`, `rp-selector-empty-hint`.
- **D-04:** Inserted as a new `/* Phase 13: CanvasSelectorWidget ── */` comment block, placed between the end of the Phase 3 RunnerView section and the Phase 4 comment.

### RUNNER-01: Run Again button style
- **D-05:** `.rp-run-again-btn` matches `.rp-loop-again-btn` accent styling **plus** two additions:
  - `width: 100%` — button is alone in the complete zone, should fill the width
  - `:disabled { opacity: 0.5; cursor: not-allowed; }` — visual feedback when `canvasFilePath === null` (runner-view.ts:441 sets `disabled = true` in that case)
  ```css
  .rp-run-again-btn {
    margin-top: var(--size-4-1);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: var(--radius-s);
    padding: var(--size-2-2) var(--size-4-2);
    cursor: pointer;
    font-size: var(--font-ui-small);
    width: 100%;
  }
  .rp-run-again-btn:hover {
    background: var(--interactive-accent-hover);
  }
  .rp-run-again-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  ```
- **D-06:** Inserted after `.rp-complete-heading` in the Phase 3 RunnerView section.

### General constraints (carried forward)
- All color values must use Obsidian CSS variables — no hard-coded `#hex` or `rgb()` (community review requirement)
- Edit `src/styles.css` only — root `styles.css` is the build output copy, never the source
- No TypeScript changes for this phase

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core source files to read before planning
- `src/styles.css` — source stylesheet; edit here only (not root `styles.css`)
  - Lines 54–64: `.rp-output-toolbar`, `.rp-copy-btn, .rp-save-btn` — extend selector for LAYOUT-03
  - Lines 151–155: `.rp-complete-heading` — insert `.rp-run-again-btn` block after this for RUNNER-01
  - Lines 464–474: `.rp-loop-again-btn` — reference style for RUNNER-01
- `src/views/runner-view.ts`
  - Line 158: `selectorBarEl` prepended to `contentEl` (SIDEBAR-01 placement context)
  - Lines 436–452: `rp-run-again-btn` emitted in complete branch (RUNNER-01)
  - Lines 560–568: `rp-copy-btn`, `rp-save-btn`, `rp-insert-btn` emitted (LAYOUT-03)
- `src/views/canvas-selector-widget.ts` — full class inventory for SIDEBAR-01 (all `rp-selector-*` classes)
- `.planning/phases/18-css-gap-fixes/18-RESEARCH.md` — full CSS blocks ready to use; pitfalls documented

</canonical_refs>

<code_context>
## Existing Code Insights

- `src/styles.css` uses phase-comment section headers; new SIDEBAR-01 block goes between Phase 3 and Phase 4 sections
- `contentEl` in RunnerView is a block-level container — `selectorBarEl` stacks naturally above `.rp-runner-view` without extra flex declarations needed
- `.rp-loop-again-btn` (lines 464–474) is the direct style reference for RUNNER-01; Run Again uses the same accent pattern plus `width: 100%` and `:disabled`

</code_context>
