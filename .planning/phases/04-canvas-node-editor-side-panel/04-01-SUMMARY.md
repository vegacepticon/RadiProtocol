---
phase: 04-canvas-node-editor-side-panel
plan: "01"
subsystem: editor-panel
tags: [obsidian, ItemView, Setting-API, canvas, form-ui]

requires:
  - phase: 04-00
    provides: "RED test stubs for EditorPanelView (editor-panel.test.ts) — Plan 01 makes them GREEN"

provides:
  - "src/views/editor-panel-view.ts — full EditorPanelView: idle state, loadNode(), renderNodeForm(), buildKindForm() for all 7 node kinds, pendingEdits collection"
  - "src/styles.css — 5 Phase 4 CSS classes: .rp-editor-panel, .rp-editor-idle, .rp-editor-form, .rp-editor-save-row, .rp-editor-start-note"
  - "src/__mocks__/obsidian.ts — extended mock: addTextArea, full-chain addDropdown, setCta button, TFile class, createDiv on contentEl"

affects:
  - 04-02 (write-back plan uses saveNodeEdits stub defined here)
  - main.ts (registers EDITOR_PANEL_VIEW_TYPE and calls view.loadNode from context menu)

tech-stack:
  added: []
  patterns:
    - "Setting API pattern for all form fields — setName/setDesc/addText/addTextArea/addDropdown; no innerHTML, no aria-label hacks"
    - "kindFormSection isolation — separate div for kind-specific fields so dropdown onChange can empty/rebuild without clearing the selector"
    - "pendingEdits Record<string, unknown> — in-memory edit accumulation before explicit Save; no auto-save on field change"
    - "void async pattern — loadNode() fires renderNodeForm() async but guards against uninitialized contentEl for test environment safety"

key-files:
  created: []
  modified:
    - "src/views/editor-panel-view.ts"
    - "src/styles.css"
    - "src/__mocks__/obsidian.ts"

key-decisions:
  - "saveNodeEdits is a no-op stub in Plan 01 — write-back with canvas-open guard implemented in Plan 02 per plan specification"
  - "Guard !this.contentEl in renderNodeForm — vi.mock('obsidian') auto-mocks ItemView so contentEl is undefined in async context; guard prevents spurious unhandled rejections without affecting real Obsidian runtime"
  - "Extended obsidian mock with full-chain addDropdown, addTextArea, setCta, TFile, and createDiv — required for EditorPanelView form construction to not throw in test environment"

patterns-established:
  - "Phase 4 CSS namespace: .rp-editor-* following .rp-runner-* pattern from Phase 3"
  - "All Obsidian CSS custom properties — no hardcoded hex colors or pixel values in Phase 4 CSS"

requirements-completed:
  - EDIT-01
  - EDIT-02

duration: 12min
completed: 2026-04-06
---

# Phase 04 Plan 01: EditorPanelView Implementation Summary

**Full EditorPanelView with idle state, loadNode(), Setting-API form for all 7 RPNodeKind values, and pendingEdits accumulation — all 7 Wave 0 test stubs go GREEN.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-06T17:14:00Z
- **Completed:** 2026-04-06T17:18:30Z
- **Tasks:** 2 (+ 1 auto-fix deviation)
- **Files modified:** 3

## Accomplishments

- `EditorPanelView` fully implemented: idle state on open, `loadNode()` public API, `renderNodeForm()` reading canvas JSON, `renderForm()` with Setting-based node-type dropdown, `buildKindForm()` switch over all 7 RPNodeKind values
- Phase 4 CSS classes added to `styles.css`: `.rp-editor-panel`, `.rp-editor-idle`, `.rp-editor-form`, `.rp-editor-save-row`, `.rp-editor-start-note` — all using Obsidian CSS custom properties
- All 7 `editor-panel.test.ts` tests GREEN; no regressions in other test suites; pre-existing RED stubs unchanged

## Task Commits

1. **Task 1: Implement EditorPanelView** — `a3250b2` (feat)
2. **Task 2: Add Phase 4 CSS classes** — `bd09028` (feat)
3. **Auto-fix: guard renderNodeForm against uninitialized contentEl** — `3690fd1` (fix)

## Files Created/Modified

- `src/views/editor-panel-view.ts` — Full EditorPanelView replacing stub: 7 node kind forms, pendingEdits, saveNodeEdits shell
- `src/styles.css` — Phase 4 section appended: 5 CSS classes for EditorPanelView layout and states
- `src/__mocks__/obsidian.ts` — Extended mock: addTextArea, full-chain addDropdown (8 options), setCta on button, TFile class, createDiv on contentEl mock

## Decisions Made

- `saveNodeEdits` is a no-op shell: `void filePath; void nodeId; void edits;` — full write-back with canvas-open guard deferred to Plan 02 as specified
- Extended the obsidian mock rather than modifying tests — tests are Wave 0 RED stubs and must not be altered
- Guard `!this.contentEl` at top of `renderNodeForm` — `vi.mock('obsidian')` auto-mocks `ItemView` causing `contentEl` to be `undefined` in async context; guard eliminates unhandled rejection without affecting real runtime

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended obsidian mock with addTextArea, full-chain addDropdown, setCta, TFile, createDiv**

- **Found during:** Task 1 (running tests after initial implementation)
- **Issue:** Mock's `Setting.addDropdown` only supported 2 chained `addOption` calls; no `addTextArea`, no `setCta` on button, no `TFile` class, no `createDiv` on contentEl
- **Fix:** Rewrote `src/__mocks__/obsidian.ts` with proper factory functions: `makeMockEl()` (with `createDiv`), `makeMockTextComponent()`, `makeMockDropdown()` (full infinite chain via self-reference), `makeMockButton()` (with `setCta`), and added `TFile` class export
- **Files modified:** `src/__mocks__/obsidian.ts`
- **Verification:** All 7 editor-panel tests GREEN, no new failures
- **Committed in:** `a3250b2` (included in Task 1 commit)

**2. [Rule 1 - Bug] Guard renderNodeForm against uninitialized contentEl in test environment**

- **Found during:** Task 1 verification — 1 unhandled async rejection appeared despite all 7 tests passing
- **Issue:** `vi.mock('obsidian')` auto-mocks `ItemView` so `this.contentEl` is `undefined` in async context; `renderNodeForm` called `this.contentEl.empty()` unconditionally causing spurious unhandled rejection
- **Fix:** Added `if (!this.contentEl) return;` guard at entry of `renderNodeForm`
- **Files modified:** `src/views/editor-panel-view.ts`
- **Verification:** Unhandled error count: 1 → 0; all 7 tests still GREEN
- **Committed in:** `3690fd1`

---

**Total deviations:** 2 auto-fixed (1 missing critical mock support, 1 async runtime bug)
**Impact on plan:** Both fixes necessary for tests to pass cleanly. No scope creep — all changes within editor-panel-view.ts and its test infrastructure.

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `src/views/editor-panel-view.ts` | `saveNodeEdits` is a no-op | Plan 01 scope ends at form UI; write-back with canvas-open guard implemented in Plan 02 |

The stub does not prevent the plan's goal (form UI with pendingEdits accumulation) from being achieved. Plan 02 replaces the no-op with full implementation.

## Threat Surface Scan

No new network endpoints or auth paths introduced. Two mitigations from the plan's threat register applied:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-04-01-01 | `try/catch` around `JSON.parse()` in `renderNodeForm`; on failure calls `renderError('Canvas file contains invalid JSON — cannot save.')` |
| T-04-01-04 | All field value casts use `as string \| undefined` with `?? ''` fallback — no unsafe coercions |

## Issues Encountered

- `vi.mock('obsidian')` with `resolve.alias` causes auto-mocking behavior (not manual mock pickup), so the obsidian mock needed to be extended to support all Setting API chains used by the implementation. Resolved via extended factory functions in the mock.

## Next Phase Readiness

- Plan 02 (canvas write-back) can proceed: `saveNodeEdits` shell is in place at the correct signature, `EDITOR_PANEL_VIEW_TYPE` and `EditorPanelView` are exported and ready for main.ts wiring
- The 5 canvas-write-back RED stubs remain RED as expected — Plan 02 makes them GREEN

---
*Phase: 04-canvas-node-editor-side-panel*
*Completed: 2026-04-06*
