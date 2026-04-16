---
phase: 35-markdown-snippets-in-protocol-runner
reviewed: 2026-04-16T07:18:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/views/runner-view.ts
  - src/__tests__/runner-extensions.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-04-16T07:18:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the Phase 35 changes that add Markdown snippet support to the protocol runner picker. The implementation in `runner-view.ts` is well-structured: the MD branch correctly discriminates on `snippet.kind === 'md'`, inserts content verbatim without opening the fill-in modal, and resets picker state after completion. The test file provides strong coverage of both source-contract assertions and runtime behavior.

Two warnings relate to a stale-result race condition in the async picker handler and a minor type-narrowing gap. Two info items flag test-only concerns.

## Warnings

### WR-01: Async race in handleSnippetPickerSelection for JSON modal path

**File:** `src/views/runner-view.ts:696-708`
**Issue:** The JSON snippet path in `handleSnippetPickerSelection` opens `SnippetFillInModal` and `await`s its result. During this await, the user could trigger another action (e.g., step-back via keyboard, canvas switch) that mutates the runner state. Unlike `renderSnippetPicker` (which has a stale-result guard at lines 569-575), `handleSnippetPickerSelection` performs no staleness check after the modal resolves. If the runner has moved on, `completeSnippet` is called on a state that no longer expects it, potentially corrupting the session.
**Fix:** Add a staleness guard after the modal await, mirroring the pattern already used in `renderSnippetPicker`:
```typescript
const rendered = await modal.result;
// Guard: runner may have moved on while modal was open
const currentState = this.runner.getState();
if (currentState.status !== 'awaiting-snippet-fill') {
  return;
}
if (rendered !== null) {
  this.runner.completeSnippet(rendered);
} else {
  this.runner.completeSnippet('');
}
```

### WR-02: handleSnippetFill filters out MD snippets loaded by legacy path

**File:** `src/views/runner-view.ts:719-729`
**Issue:** The `handleSnippetFill` method constructs a legacy `.json` path (`${snippetId}.json`) and loads it. The guard at line 722 rejects `snippet.kind === 'md'`, displaying a "not found" message. This is correct for the current flow (legacy snippet nodes only store JSON IDs), but the error message says "Snippet not found" which is misleading when the snippet does exist but is MD. If a future refactor passes an MD snippet ID through this legacy path, the user gets a confusing error.
**Fix:** Differentiate the error message:
```typescript
if (snippet === null) {
  questionZone.empty();
  questionZone.createEl('p', {
    text: `Snippet '${snippetId}' not found. The snippet may have been deleted. Use step-back to continue.`,
    cls: 'rp-empty-state-body',
  });
  return;
}
if (snippet.kind === 'md') {
  questionZone.empty();
  questionZone.createEl('p', {
    text: `Snippet '${snippetId}' is a Markdown snippet and cannot be loaded through the legacy fill-in path. Use step-back to continue.`,
    cls: 'rp-empty-state-body',
  });
  return;
}
```

## Info

### IN-01: Source-level assertions read own source file at test time

**File:** `src/__tests__/runner-extensions.test.ts:74-77`
**Issue:** The test suite reads `runner-view.ts` source code via `fs.readFileSync` and asserts on regex patterns (e.g., `snippet.kind === 'md'`). While creative for asserting view-layer contracts without mounting the DOM, these assertions are brittle -- they will break if the code is reformatted (e.g., extra whitespace, string quote changes) or if the pattern appears in a comment. Consider whether these source-contract tests should be replaced with integration tests once a DOM harness is available.
**Fix:** No immediate action needed. Add a comment near the `runnerViewSource` declaration noting that these are interim contract tests until a proper view-layer test harness is introduced.

### IN-02: Intentionally RED test stubs will fail in CI

**File:** `src/__tests__/runner-extensions.test.ts:18-57`
**Issue:** Three tests in the `ProtocolRunner extensions` describe block are marked as "RED until Plan 02" -- they test `setAccumulatedText` and `start(graph, startNodeId)` features that do not yet exist. These tests currently fail (confirmed by test run). If CI enforces a green suite, these will block merges.
**Fix:** If these are intended to remain RED as TDD stubs, mark them with `it.skip` or `it.todo` until the implementing plan lands, or ensure CI is configured to tolerate known failures in this block.

---

_Reviewed: 2026-04-16T07:18:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
