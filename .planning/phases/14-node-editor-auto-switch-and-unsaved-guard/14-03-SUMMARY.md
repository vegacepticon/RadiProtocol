---
phase: 14-node-editor-auto-switch-and-unsaved-guard
plan: "03"
subsystem: canvas-node-editor
tags: [editor-panel, canvas-internal, auto-switch, click-event, listener-guard, gap-closure]
dependency_graph:
  requires:
    - phase: 14-02
      provides: [attachCanvasListener, pointerdown-listener, watchedCanvasContainer]
  provides:
    - EditorPanelView.attachCanvasListener — click event + early-return listener guard
  affects: [src/views/editor-panel-view.ts]
tech_stack:
  added: []
  patterns: [registerDomEvent-click, early-return-container-guard]
key_files:
  created: []
  modified:
    - src/views/editor-panel-view.ts
key_decisions:
  - "Switched from pointerdown+setTimeout(0) to click event — canvas commits selection Set in its own click handler, so reading selection inside click callback sees populated state on the first interaction"
  - "Early-return guard compares object references (watchedCanvasContainer === canvasLeaf.containerEl) before registering any listener — prevents accumulation when active-leaf-change fires on modal open/close"
  - "Field name canvasPointerdownHandler left unchanged — private field, harmless, minimises diff noise"
requirements-completed: [EDITOR-01, EDITOR-02]
duration: 5min
completed: "2026-04-09"
---

# Phase 14 Plan 03: attachCanvasListener Fix Summary

Two targeted fixes to `attachCanvasListener()` in `EditorPanelView` to close UAT gaps 1, 5, and 6 from 14-UAT.md.

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-04-09
- **Tasks:** 2 of 2 complete
- **Files modified:** 1

## Accomplishments

- **Fix B (click event):** Replaced `pointerdown` + `setTimeout(0)` with a direct `click` handler. The canvas selection Set is committed by Obsidian's own click handler before the plugin's click handler fires, so the first click reliably loads the node. Closes UAT test 1 (gap 1).
- **Fix A (early-return guard):** Added `if (this.watchedCanvasContainer === canvasLeaf.containerEl) return;` at the top of `attachCanvasListener()` before any `registerDomEvent` call. Prevents the `active-leaf-change` event (which fires on every modal open/close) from re-registering duplicate listeners. Closes UAT tests 5 & 6 (gaps 2 & 3).

## Task Commits

1. **Task 1: Apply both listener fixes** — `e56ef2d` (fix)

## Files Created/Modified

- `src/views/editor-panel-view.ts` — click event + early-return guard in `attachCanvasListener()`

## Verification

- `grep -n "watchedCanvasContainer === canvasLeaf.containerEl"` → 1 match (line 57)
- `grep -n "'click'"` → 1 match inside `registerDomEvent` (line 85)
- No `setTimeout` inside `attachCanvasListener`
- TypeScript: same pre-existing errors as before (vitest type resolution + containerEl cast) — no new errors introduced
- Vitest: 120 passing, 3 intentional RED (runner-extensions, pre-existing) — no regressions

## Deviations from Plan

None — both fixes applied exactly as specified in the plan.

## Self-Check

- [x] `src/views/editor-panel-view.ts` contains `this.watchedCanvasContainer === canvasLeaf.containerEl`
- [x] `src/views/editor-panel-view.ts` contains `'click'` as the registered DOM event
- [x] `src/views/editor-panel-view.ts` does NOT contain `setTimeout` inside `attachCanvasListener`
- [x] Commit `e56ef2d` — exists
- [x] Vitest: 120 passing, 0 new failures

## Self-Check: PASSED
