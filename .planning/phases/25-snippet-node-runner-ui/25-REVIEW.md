---
phase: 25-snippet-node-runner-ui
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/graph/graph-model.ts
  - src/graph/canvas-parser.ts
  - src/graph/graph-validator.ts
  - src/runner/runner-state.ts
  - src/runner/protocol-runner.ts
  - src/views/snippet-file-picker-modal.ts
  - src/views/runner-view.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-04-11
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

All seven files reviewed. The core model (`graph-model.ts`, `runner-state.ts`), the parser
(`canvas-parser.ts`), the validator (`graph-validator.ts`), and the modal
(`snippet-file-picker-modal.ts`) are clean with no issues found.

Three issues require attention in `protocol-runner.ts` and `runner-view.ts`:

1. `completeSnippetFile` does not verify the provided `snippetNodeId` matches the current
   runner position, opening a path to state corruption if called out-of-turn.
2. The `advanceThrough` safety step-counter shares its cap value with the per-loop
   iteration cap, which can cause false "iteration cap exceeded" errors in long linear
   protocols.
3. Each `render()` call in `runner-view.ts` registers a fresh `active-leaf-change` listener
   without removing the previous one, causing accumulation across renders.

Two lower-severity items are also noted.

---

## Warnings

### WR-01: `completeSnippetFile` does not validate caller-supplied `snippetNodeId`

**File:** `src/runner/protocol-runner.ts:198-223`

**Issue:** `completeSnippetFile(text, snippetNodeId)` accepts a `snippetNodeId` parameter and
uses it both to look up the node and as the key to advance from. It never asserts that
`snippetNodeId === this.currentNodeId`. If the view calls this method with a stale node ID
(e.g., after the user has stepped back and the runner is now on a different node), the method
will silently pass the `kind === 'snippet'` guard (the stale node is still in the graph), push
an undo entry anchored to the wrong position, append text, and advance from the wrong location.

Unlike `chooseAnswer` and `enterFreeText`, which both implicitly use `this.currentNodeId`, this
method allows the caller to supply any node ID — breaking the invariant that mutations always
apply to the current node.

**Fix:** Add a guard at the top of the method that rejects calls where `snippetNodeId` does
not match `this.currentNodeId`:

```typescript
completeSnippetFile(text: string, snippetNodeId: string): void {
  if (this.runnerStatus !== 'at-node') return;
  if (this.graph === null) return;

  // Guard: only valid when snippetNodeId is the current node (same invariant as chooseAnswer)
  if (snippetNodeId !== this.currentNodeId) return;

  const snippetNode = this.graph.nodes.get(snippetNodeId);
  if (snippetNode === undefined || snippetNode.kind !== 'snippet') return;
  // ... rest unchanged
```

---

### WR-02: `advanceThrough` step-counter cap conflated with per-loop iteration cap

**File:** `src/runner/protocol-runner.ts:456-465`

**Issue:** `advanceThrough` uses `this.maxIterations` (default 50) as the safety cap for
the number of auto-advance steps within a single traversal call. The same field is also used
in `chooseLoopAction` (line 264) as the per-loop iteration limit for user-visible loop
repetitions. These are conceptually different limits:

- `advanceThrough` step count: number of auto-advance nodes processed in one call (guards
  against structural cycles, needs to be large enough for any linear chain of text-blocks).
- Loop iteration count: number of times a user can re-enter a loop body (a user-visible
  protocol constraint).

A protocol with more than 50 sequential auto-advancing nodes (text-blocks, answers, or
loop-start nodes) will erroneously transition to error state with "Iteration cap reached"
even when there is no actual cycle, because both limits default to 50.

**Fix:** Decouple the two caps by introducing a separate private constant for the traversal
step guard:

```typescript
// Top of ProtocolRunner class:
private static readonly MAX_ADVANCE_STEPS = 500; // structural safety cap

// In advanceThrough:
if (steps > ProtocolRunner.MAX_ADVANCE_STEPS) {
  this.transitionToError(
    `Traversal step cap reached (${ProtocolRunner.MAX_ADVANCE_STEPS}). Possible cycle in protocol.`,
  );
  return;
}
```

The per-loop iteration cap (`this.maxIterations`, configurable via `ProtocolRunnerOptions`)
remains unchanged and is checked in `chooseLoopAction`.

---

### WR-03: `active-leaf-change` listener accumulates across `render()` calls

**File:** `src/views/runner-view.ts:718-728`

**Issue:** `renderOutputToolbar` registers a new `active-leaf-change` workspace event
listener via `this.registerEvent(...)` every time it is called. `renderOutputToolbar` is
called by `render()`, which is invoked after every user interaction. Since `registerEvent`
appends to the component's internal listener list without deduplicating, each render cycle
adds another handler. After N user interactions, N concurrent listeners are active.

While the writes to `this.lastActiveMarkdownFile` are idempotent and the `insertBtn`
reference is always the most recently rendered element (stale handlers write to a valid
ref), the accumulation is unbounded for a long session and represents a resource and
correctness risk. If `insertBtn` were ever nulled between renders, the stale handlers
would attempt a null property set.

**Fix:** Move the `active-leaf-change` registration to `onOpen()`, where it runs exactly
once per view lifetime. Update `this.insertBtn` directly in the handler as it does today:

```typescript
// In onOpen(), after creating the selectorBarEl:
this.registerEvent(
  this.app.workspace.on('active-leaf-change', () => {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view !== null && view.file !== null) {
      this.lastActiveMarkdownFile = view.file;
    }
    if (this.insertBtn !== null) {
      this.insertBtn.disabled = this.lastActiveMarkdownFile === null;
    }
  })
);
```

Remove the `this.registerEvent(...)` block from `renderOutputToolbar` (lines 718-728).
`this.insertBtn` is already a class field that is updated on every render, so the handler
will always reference the current button.

---

## Info

### IN-01: Redundant type cast in `runner-view.ts` snippet branch

**File:** `src/views/runner-view.ts:397`

**Issue:** `const snippetNode = node as SnippetNode;` is unnecessary. The enclosing
`case 'snippet':` branch of the `switch (node.kind)` statement already narrows `node` to
`SnippetNode`. TypeScript knows the type without the assertion.

**Fix:** Remove the cast:

```typescript
case 'snippet': {
  // node is already SnippetNode here — no cast needed
  const resolvedLabel = node.buttonLabel ?? 'Select file';
```

---

### IN-02: Trailing slash in `snippetNodeFolderPath` silently produces empty file list

**File:** `src/views/runner-view.ts:534-537`

**Issue:** The folder filter uses `f.path.startsWith(folderPath + '/')`. If a user
configures `snippetNodeFolderPath` with a trailing slash (e.g. `"Snippets/"`), the
constructed prefix becomes `"Snippets//"`, matching nothing. The code trims leading/trailing
whitespace (line 525) but does not normalise trailing slashes. The result is a silent `Notice`
saying "No files found" with no hint about the misconfiguration.

**Fix:** Strip trailing slashes when normalising `folderPath`:

```typescript
const folderPath = (rawFolder !== '' ? rawFolder : globalFolder).replace(/\/+$/, '');
```

This is a one-line change that makes the feature robust to the most common user error when
entering folder paths.

---

_Reviewed: 2026-04-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
