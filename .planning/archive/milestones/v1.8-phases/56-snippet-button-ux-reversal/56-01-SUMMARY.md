# Plan 56-01 — Runner Core File-Bound Dispatch — SUMMARY

**Status:** ✅ Complete
**Date:** 2026-04-21
**Commits:** `721ac02` (Task 1), `571e08c` (Task 2)

## Tasks

### Task 1 — Remove Phase 51 D-13 auto-insert block (commit 721ac02)
- Deleted the `case 'question'` short-circuit block (~46 LOC) that auto-advanced single-edge file-bound Snippet Questions to `awaiting-snippet-fill`.
- Replaced with the canonical 3-line halt: `currentNodeId = cursor; runnerStatus = 'at-node'; return;` plus a Phase 56 D-02 citation comment that records the explicit reversal mandate (CLAUDE.md never-remove exception).
- Acceptance: `Phase 51 D-13/D-14/D-15` count = 0; `radiprotocol_snippetPath` count in runner = 0; `Phase 56 D-02` marker present.
- Expected fallout: `runner-snippet-autoinsert-fill.test.ts` now fails — Plan 04 inverts those expectations.

### Task 2 — Add `pickFileBoundSnippet` (commit 571e08c)
- New public method on `ProtocolRunner`, signature locked per D-03:
  `pickFileBoundSnippet(questionNodeId: string, snippetNodeId: string, snippetPath: string): void`
- Guards: returns no-op unless `runnerStatus === 'at-node'` and `currentNodeId === questionNodeId`.
- Pushes `UndoEntry` (same shape as `pickSnippet`) BEFORE mutation — D-15 ordering preserved.
- Sets `snippetId / snippetNodeId / currentNodeId`, then flips `runnerStatus = 'awaiting-snippet-fill'`.
- 5 unit tests in `src/__tests__/runner/protocol-runner-pick-file-bound-snippet.test.ts` — all green.

## Verification
- `npx vitest run src/__tests__/runner/protocol-runner-pick-file-bound-snippet.test.ts` → 5/5 passed.
- `npx tsc --noEmit` → no project-code errors (only pre-existing vitest/vite type-resolution warnings unrelated to this change).
- `pickSnippet`, `chooseSnippetBranch`, `stepBack`, `UndoEntry` shape — all untouched.

## Success Criteria coverage
- SC 1 (partial — runner side ✓), SC 2 (partial — runner API ✓), SC 4 (undo by shared shape ✓), SC 5 (RUNFIX-02 enforced in Plan 02/04, not here).
