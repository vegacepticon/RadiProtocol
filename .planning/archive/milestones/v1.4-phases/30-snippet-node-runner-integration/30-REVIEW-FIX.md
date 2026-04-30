---
phase: 30
fixed_at: 2026-04-14T00:00:00Z
review_path: .planning/phases/30-snippet-node-runner-integration/30-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 2
skipped: 1
status: partial
---

# Phase 30: Code Review Fix Report

**Fixed at:** 2026-04-14
**Source review:** `.planning/phases/30-snippet-node-runner-integration/30-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 3
- Fixed: 2
- Skipped: 1

Info findings (IN-01 through IN-07) were out of scope for this fix pass
(fix_scope = critical_warning) and are left for a follow-up.

## Fixed Issues

### WR-01: Event listener leak in renderOutputToolbar

**Files modified:** `src/views/runner-view.ts`
**Commit:** `9872f60`
**Applied fix:** Moved the `workspace.on('active-leaf-change', ...)` registration
out of `renderOutputToolbar()` (which runs on every render cycle) into
`onOpen()`, so the listener is registered exactly once per view lifetime. The
handler still updates `this.insertBtn.disabled` whenever the active leaf
changes, and it guards against `insertBtn === null` so it is safe to fire
before the first render completes or during transient states where the
toolbar is not mounted. Replaced the old block in `renderOutputToolbar` with
a short comment pointer.

Note: the review suggested switching `addEventListener` → `onclick` on the
Copy/Save toolbar buttons, but those buttons are created fresh via
`createEl` on every render and bound through `registerDomEvent`, which ties
the listener to the DOM element lifetime — they do not accumulate. The real
leak was the workspace-level listener, which is what this fix addresses.

### WR-03: Duplicate autoSaveSession race

**Files modified:** `src/views/runner-view.ts`
**Commit:** `b0d7075`
**Applied fix:** Removed the intermediate
`void this.autoSaveSession()` call that ran right after
`runner.pickSnippet(snippet.id)` in `handleSnippetPickerSelection`. Both code
paths (zero-placeholder and modal) still call `autoSaveSession()` after
`completeSnippet(...)`, so the final persisted state is identical but only
one fire-and-forget write hits disk instead of two racing writes. Added an
inline comment explaining the rationale.

(Clarification vs. review text: `render()` does not call `autoSaveSession()`
in this codebase — the comment at line 677 explicitly forbids it. The
race was between the two sequential `void autoSaveSession()` calls inside
the handler, not between the handler and the render pipeline. The fix still
applies: collapsing to a single save eliminates the race.)

## Skipped Issues

### WR-02: stepBack from snippet node leaves unactionable state

**File:** `src/runner/protocol-runner.ts:147-158`
**Reason:** skipped — code context differs from review; documented bug does
not reproduce against current source.
**Original issue:** Reviewer claimed `stepBack()` restores the previous node
but does not clear the snippet-pick flags, leaving the runner stuck waiting
for a snippet choice after stepping back.

**Why skipped:**

1. The current `stepBack()` implementation (lines 147-158) already does all
   three cleanups the review asks for:
   ```ts
   this.runnerStatus = 'at-node';   // clears awaiting-snippet-pick / fill
   this.snippetId = null;
   this.snippetNodeId = null;
   ```
2. The field names in the review's suggested fix
   (`awaitingSnippetPick`, `pendingSnippetNodeId`, `snippetCandidates`) do
   not exist anywhere in `src/` — a repo-wide grep returned zero matches.
   The runner uses a single `runnerStatus` string union plus `snippetId` /
   `snippetNodeId`, all of which are already reset on stepBack.
3. Calling `stepBack()` from `'awaiting-snippet-pick'` pops the undoStack
   entry for the node that preceded the snippet node, restores
   `currentNodeId` + `accumulator` + `loopContextStack` from that snapshot,
   and sets `runnerStatus = 'at-node'`. The resulting state is a normal
   at-node state with `canStepForward` enabled — no stuck state observed.

Recommend the reviewer re-validate against `99241e7` (current Phase 30-02
runner). If a concrete reproducer is found, this finding should be re-raised
with a failing test case.

---

_Fixed: 2026-04-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
