---
phase: 42
plan: 01
subsystem: node-editor
tags: [editor-panel, canvas, race-condition, ui]

requires:
  - phase: 39-02
    provides: "in-memory canvas.nodes.get(nodeId).getData() fallback pattern"
provides:
  - "renderNodeForm disk-read miss fallback to live canvas state"
  - ".rp-editor-type-hint empty-type helper hint component (UI-SPEC locked copy)"
  - "Full renderForm re-render on node-type dropdown change so the hint disappears after selection"
affects: []

tech-stack:
  added: []
  patterns:
    - "Disk-miss → canvas.nodes.get(nodeId).getData() fallback (reused from Phase 39 Plan 02)"
    - "Full renderForm re-render on type-select to re-evaluate hint visibility"

key-files:
  created:
    - .planning/phases/42-snippet-node-creation-button-and-double-click-node-selection-fix/42-01-SUMMARY.md
  modified:
    - src/views/editor-panel-view.ts
    - src/styles/editor-panel.css
    - src/styles.css
    - styles.css
    - src/__tests__/editor-panel-create.test.ts

key-decisions:
  - "In-memory fallback reuses the already-established Phase 39 Plan 02 pattern — no new type surface, no new API probe"
  - "UI-SPEC Option A (full renderForm re-run) chosen over Option B (node.remove()) — simpler, idempotent, and keeps the hint declarative"
  - "Setting.prototype patched per-describe-block in tests rather than rewriting the global vi.mock('obsidian') factory, preserving existing quick-create + duplicate test behavior"

patterns-established:
  - "Phase-42 test pattern: manually inject view.contentEl fake + patch Setting.prototype when a test needs to execute renderForm end-to-end under vi.mock('obsidian')"

requirements-completed: [PHASE42-DOUBLECLICK-FIX, PHASE42-EMPTY-TYPE-HINT]

metrics:
  duration: "13min"
  completed: 2026-04-17
  tasks_completed: 3
  files_modified: 5
---

# Phase 42 Plan 01: Double-Click Node-Select Fix + Empty-Type Helper Hint Summary

**renderNodeForm now falls back to live canvas state when Obsidian's debounced save hasn't flushed yet, and empty-type nodes show the "Select a node type to configure this node" hint locked by the UI-SPEC.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-04-17T05:00:13Z
- **Completed:** 2026-04-17T05:13:07Z
- **Tasks:** 3 (all auto)
- **Files modified:** 5

## Accomplishments

- **Double-click bug fix:** `renderNodeForm` (src/views/editor-panel-view.ts) now falls back to `canvas.nodes.get(nodeId).getData()` when the disk read misses the node. Double-clicking the canvas, then single-clicking the new node, no longer shows "Node not found in canvas — it may have been deleted." The fix reuses the exact in-memory pattern that Phase 39 Plan 02 established for `onQuickCreate`.
- **Empty-type helper hint:** `renderForm` now emits `<p class="rp-editor-type-hint">Select a node type to configure this node</p>` whenever `currentKind === null`. The copy is byte-identical to the UI-SPEC contract.
- **Hint disappears on type select:** The Node-type dropdown's `onChange` now calls `this.renderForm(nodeRecord, ...)` after `onTypeDropdownChange(value)`, so picking any type re-renders the form without the hint (UI-SPEC Option A).
- **CSS:** Appended `.rp-editor-type-hint` rule at the bottom of `src/styles/editor-panel.css` under a `/* Phase 42 */` banner. Existing Phase 4, 39, 40 blocks are byte-identical. Root `styles.css` + `src/styles.css` regenerated via `npm run build`.
- **Test coverage:** Added a third describe block with 4 tests covering (A) disk-miss / in-memory-hit fallback, (B) disk-miss / in-memory-miss renderError with em-dash preservation, (C) hint rendered when `currentKind === null`, (D) hint NOT rendered when `currentKind = 'question'`. Full suite passes 389/389.

## Task Commits

1. **Task 1 — Add in-memory canvas fallback + helper hint + re-render on type change:** `92d1d3d` (fix)
   - `renderNodeForm`: 5 lines → 15 lines with canvas fallback
   - `renderForm`: 4-line hint emission block added immediately before `kindFormSection`
   - Dropdown `onChange`: 1-line `this.renderForm(...)` call appended after `onTypeDropdownChange`
2. **Task 2 — Append Phase 42 CSS block for .rp-editor-type-hint:** `280dc0a` (style)
   - 9-line CSS block appended to `src/styles/editor-panel.css`
   - `npm run build` regenerated `styles.css` + `src/styles.css`
3. **Task 3 — Add vitest coverage for fallback and hint render path:** `c3131e3` (test)
   - New describe block "EditorPanelView double-click fallback + empty-type hint" with 4 tests
   - Injects minimal `contentEl` fake + patches `Setting.prototype` locally to satisfy automock
4. **Follow-up — satisfy TFile 0-arg ctor in Phase 42 tests:** `567bf93` (fix)
   - Replaced `new TFile('test.canvas')` with `Object.assign(new TFile(), { path: 'test.canvas' })` so `tsc --noEmit` is clean while the runtime `instanceof TFile` check still succeeds

## Files Created/Modified

- `src/views/editor-panel-view.ts` — 3 surgical additions (fallback, hint emission, re-render) totaling 26 lines; no existing code deleted or reordered.
- `src/styles/editor-panel.css` — 10-line Phase 42 block appended at EOF; existing rules byte-identical.
- `styles.css` — auto-regenerated (append of same block in its Phase-42 position).
- `src/styles.css` — auto-regenerated convenience copy.
- `src/__tests__/editor-panel-create.test.ts` — new describe block with 4 tests; existing 12 tests unchanged.

## Decisions Made

- **Option A for hint lifecycle** — UI-SPEC offered both `renderForm` full re-render (Option A) and hint-element `.remove()` (Option B). Chose A because `renderForm` is already idempotent and keeps the hint declarative inside one function, matching the "reuse existing renders" principle.
- **Patch Setting.prototype per-describe-block instead of replacing global `vi.mock('obsidian')`** — Changing the global mock to a `vi.importActual` factory would restore `Setting` chaining but also unwrap `Notice`, breaking the existing `expect(Notice).toHaveBeenCalledWith(...)` assertions in the quick-create block. Patching the prototype only in the Phase 42 block's `beforeEach` is surgical and isolated.
- **Attach path to TFile via `Object.assign(new TFile(), { path })`** — Real Obsidian's TFile has a 0-arg constructor; our mock accepts an optional path. Object.assign keeps tsc --noEmit clean without editing the mock file (which is out of this plan's scope).

## Deviations from Plan

**1. [Rule 1 - Bug] Adjusted canvas fallback to non-optional `canvas.nodes.get(...)` form**
- **Found during:** Task 1 verification
- **Issue:** The plan's suggested code used `canvas?.nodes.get(nodeId)` with optional chaining, but the acceptance criterion grep pattern was literal `canvas\.nodes\.get` which does not match `canvas?.nodes.get`. This would fail the acceptance criterion despite semantic equivalence.
- **Fix:** Restructured the fallback block so the canvas-truthiness check is an explicit `if (canvas)` guard and the subsequent call uses non-optional `canvas.nodes.get(nodeId)`, matching the onDuplicate pattern on line 820.
- **Files modified:** src/views/editor-panel-view.ts
- **Commit:** 92d1d3d (part of Task 1 — edit applied before commit)

**2. [Rule 3 - Blocker] Patched Setting.prototype + injected contentEl fake in Phase 42 tests**
- **Found during:** Task 3 RED/GREEN cycle
- **Issue:** `vi.mock('obsidian')` at the top of the file triggers automock, replacing `Setting.prototype.setName/setDesc/addDropdown` with `vi.fn()` stubs that return `undefined` (breaking the `.setName(...).setDesc(...).addDropdown(...)` chain used by `renderForm`), and auto-stubbing the `ItemView` constructor so `view.contentEl` is `undefined`. The plan's skeleton had a note acknowledging this: "Priority: tests must PASS, not match this skeleton verbatim."
- **Fix:** In the Phase 42 `beforeEach`, (a) set `view.contentEl = { empty: () => {} }` manually, and (b) patch `Setting.prototype.setName/setDesc/setHeading/addDropdown` to restore the chain and invoke the dropdown callback with a chainable mock. Existing quick-create + duplicate describe blocks are unaffected because they never exercise `renderForm` directly.
- **Files modified:** src/__tests__/editor-panel-create.test.ts
- **Commit:** c3131e3

**3. [Rule 1 - Bug] Fixed TFile 0-arg constructor type error**
- **Found during:** Final `npm run build` verification
- **Issue:** `new TFile('test.canvas')` passes in the mock but fails `tsc --noEmit` against the real Obsidian d.ts (TFile has no constructor, TypeScript infers 0-arg).
- **Fix:** `Object.assign(new TFile(), { path: 'test.canvas' })` — no-arg constructor is valid against real types, and the path is attached post-construction so the runtime instanceof check still passes.
- **Files modified:** src/__tests__/editor-panel-create.test.ts
- **Commit:** 567bf93

## Issues Encountered

None beyond the deviations above. Build, type-check, and full test suite all green.

## User Setup Required

None — pure code + CSS changes, no external services or secrets.

## Verification Evidence

- `npx vitest run src/__tests__/editor-panel-create.test.ts` — 16 tests pass (12 existing + 4 new)
- `npx vitest run` — full suite 389/389 pass (was 385 before; +4 new tests, zero regressions)
- `npm run build` — exit 0, regenerates `styles.css` + `src/styles.css` + `main.js`
- Acceptance greps all match:
  - `canvas\.nodes\.get` in editor-panel-view.ts: 2 (onDuplicate line 820 + new renderNodeForm line 295)
  - `rp-editor-type-hint` in editor-panel-view.ts: 1 (new renderForm hint)
  - `rp-editor-type-hint` in editor-panel.css: 1
  - `rp-editor-type-hint` in styles.css: 1
  - `Select a node type to configure this node` in editor-panel-view.ts: 1
  - `Phase 42` in editor-panel-view.ts: 3 banners
  - `Phase 42` in editor-panel.css: 1 banner
  - `describe(` in test file: 3

## Next Phase Readiness

- Phase 42 Plan 02 (Create snippet node button) can proceed — this plan left `onQuickCreate`'s signature unchanged and `renderToolbar` untouched, so Plan 02 is free to widen the kind union and insert the new button.
- UAT-ready: the visible scenario "double-click canvas → single-click new node → see hint, not error" is now backed by unit tests and a clean build.

---
*Phase: 42-snippet-node-creation-button-and-double-click-node-selection-fix*
*Completed: 2026-04-17*

## Self-Check: PASSED

- All 6 file paths referenced in key-files exist on disk.
- All 4 commit hashes (92d1d3d, 280dc0a, c3131e3, 567bf93) are present in `git log`.
