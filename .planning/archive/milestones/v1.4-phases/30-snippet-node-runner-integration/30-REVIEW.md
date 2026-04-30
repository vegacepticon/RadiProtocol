---
status: issues_found
phase: 30
depth: standard
files_reviewed: 13
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
---

# Phase 30: Code Review Report

**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 30 snippet-node runner integration across runner view, protocol runner state machine, snippet service, tests, and styles. No critical security or correctness bugs found. Three warnings concern resource/state hygiene (event listener leak, stepBack landing in unactionable state, duplicated autosave race). Seven informational items cover dead-code, stale docs, and minor tidy-ups.

## Warnings

### WR-01: Event listener leak in renderOutputToolbar

**File:** `src/views/runner-view.ts:778-788`
**Issue:** Each call to `renderOutputToolbar` attaches a new `click` listener to toolbar buttons without removing previous ones. When the runner re-renders on state transitions (snippet pick, step, back), listeners accumulate on re-used DOM nodes and can fire duplicate handlers, causing double-copy/double-save behavior and memory pressure over long sessions.
**Fix:**
```ts
// Replace addEventListener with a single assignment so repeat renders overwrite:
copyBtn.onclick = () => this.handleCopyOutput();
saveBtn.onclick = () => this.handleSaveOutput();
// Or rebuild the toolbar element from scratch each render (empty() then createEl).
```

### WR-02: stepBack from snippet node leaves unactionable state

**File:** `src/core/protocol-runner.ts:147-158`
**Issue:** When the user invokes `stepBack()` while on a snippet node awaiting pick, the runner restores the previous node but does not clear the `awaitingSnippetPick` flag / pendingSnippet reference. The UI ends up showing the previous step while the runner still believes it is waiting for a snippet choice, so Next is disabled and the session is effectively stuck until a reload.
**Fix:**
```ts
stepBack() {
  // ...existing restore...
  this.state.awaitingSnippetPick = false;
  this.state.pendingSnippetNodeId = null;
  this.state.snippetCandidates = [];
}
```
Add a regression test in `protocol-runner-session.test.ts` that steps into a snippet node, calls `stepBack`, then asserts `canStepForward()` is true.

### WR-03: Duplicate autoSaveSession race

**File:** `src/views/runner-view.ts:614-623`
**Issue:** `handleSnippetPicked` calls `autoSaveSession()` and then immediately calls `renderAsync()`, which in turn calls `autoSaveSession()` again through the render pipeline. Two concurrent writes to the session file can interleave on slow disks and produce a truncated/partial JSON (observed once during manual UAT as an empty session file).
**Fix:** Remove the explicit `autoSaveSession()` call in `handleSnippetPicked` and rely on the render-path save, or gate the save behind an `isSaving` flag so overlapping writes become a single awaited operation.

## Info

### IN-01: Redundant type-narrowing in SnippetService.delete

**File:** `src/core/snippet-service.ts:160-163`
**Issue:** `if (file instanceof TFile)` check is redundant — `getAbstractFileByPath` was already asserted as TFile two lines above.
**Fix:** Drop the second `instanceof` check or collapse into a single guard.

### IN-02: isAtLoopEnd uses empty-string fallback

**File:** `src/core/protocol-runner.ts:309`
**Issue:** `const loopId = this.state.currentLoopId ?? '';` — using `''` as a sentinel for "no loop" is fragile; a malformed canvas with an empty-string id would match.
**Fix:** Use `null` explicitly and compare `if (loopId === null) return false;`.

### IN-03: Stale JSDoc on getSerializableState

**File:** `src/core/protocol-runner.ts:350-374`
**Issue:** JSDoc still documents only `currentNodeId` and `history`, but the method now also serializes `awaitingSnippetPick`, `pendingSnippetNodeId`, and `snippetCandidates`.
**Fix:** Update the JSDoc `@returns` block to list the Phase 30 fields.

### IN-04: Unused snippet-node-terminal.canvas fixture

**File:** `tests/fixtures/snippet-node-terminal.canvas`
**Issue:** Fixture was added in Task 2 but no test references it after the Task 3 refactor.
**Fix:** Either add a test that uses it (terminal snippet node case) or delete the fixture.

### IN-05: Skipped-assertion pattern in protocol-runner-session.test.ts

**File:** `tests/protocol-runner-session.test.ts`
**Issue:** Several tests use `if (state.awaitingSnippetPick) expect(...)` rather than asserting the flag directly, which silently passes when the setup is wrong.
**Fix:** Replace conditional expects with unconditional `expect(state.awaitingSnippetPick).toBe(true)` followed by the dependent assertions.

### IN-06: renderAsync no-op wrapper

**File:** `src/views/runner-view.ts:494-496`
**Issue:** `renderAsync` is a thin wrapper `async () => this.render()` with no awaited work; it exists only for callsite symmetry.
**Fix:** Inline `this.render()` at call sites or add a comment explaining why the async boundary is needed (e.g., to yield to the event loop before save).

### IN-07: listFolder traversal check comment

**File:** `src/core/snippet-service.ts:72-85`
**Issue:** Comment says "prevent path traversal" but the implementation only checks for `..` substring, not normalized path escape. Low risk because inputs come from Obsidian's vault, but comment overstates guarantees.
**Fix:** Soften comment to "reject obvious parent-directory references" or use `normalizePath` and compare prefixes.

---

_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
