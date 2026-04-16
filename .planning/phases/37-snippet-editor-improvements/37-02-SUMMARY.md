---
phase: 37-snippet-editor-improvements
plan: 02
subsystem: snippets/canvas-ref-sync
tags: [bugfix, tdd, canvas-sync, gap-closure]
dependency_graph:
  requires: [37-01]
  provides: [SYNC-01-text-field-sync]
  affects: [canvas-ref-sync]
tech_stack:
  added: []
  patterns: [applyMapping-reuse-for-text-field]
key_files:
  created: []
  modified:
    - src/snippets/canvas-ref-sync.ts
    - src/__tests__/canvas-ref-sync.test.ts
decisions:
  - Reuse existing applyMapping function for text field sync (DRY, consistent matching rules)
  - Text field only updated when subfolderPath is also updated (safe for non-path text content)
metrics:
  duration: 3min
  completed: 2026-04-16
  tasks: 1
  files: 2
---

# Phase 37 Plan 02: Canvas Node Text Field Sync Summary

**One-liner:** Fix UAT gap where folder rename updated subfolderPath but not the canvas node text field, leaving stale visual labels

## What Was Done

### Task 1: TDD - Add test for text field sync and fix rewriteCanvasRefs

**RED:** Added two failing tests verifying that `rewriteCanvasRefs` updates the `text` field alongside `radiprotocol_subfolderPath`:
- Exact-match rename: text "a/b" becomes "a/c"
- Prefix-match rename: text "a/b/sub" becomes "a/c/sub"

**GREEN:** Added 8 lines to `canvas-ref-sync.ts` inside the existing rewrite block (after line 80). The fix applies `applyMapping()` to the node `text` field using the same mapping used for `subfolderPath`. Only updates text when it matches a mapping key (safe for non-path text content).

**Commits:**
- `3690c8a` test(37-02): add failing tests for text field sync on canvas rename
- `94895e5` feat(37-02): sync text field alongside subfolderPath in rewriteCanvasRefs

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED gate: `3690c8a` (test commit, both tests failed as expected)
- GREEN gate: `94895e5` (feat commit, all 12 tests pass)
- REFACTOR gate: not needed (8-line addition, no cleanup required)

## Verification

- `npm test -- --run canvas-ref-sync`: 12/12 passed (10 existing + 2 new)
- `npm run build`: clean, no errors
- No regressions in existing test suite

## Known Stubs

None.
