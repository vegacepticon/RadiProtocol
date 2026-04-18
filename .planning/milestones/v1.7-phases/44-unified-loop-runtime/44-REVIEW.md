---
phase: 44-unified-loop-runtime
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/__tests__/canvas-parser.test.ts
  - src/__tests__/runner/protocol-runner-loop-picker.test.ts
  - src/__tests__/runner/protocol-runner-session.test.ts
  - src/__tests__/runner/protocol-runner.test.ts
  - src/__tests__/settings-tab.test.ts
  - src/__tests__/snippet-service-move.test.ts
  - src/__tests__/snippet-service.test.ts
  - src/graph/canvas-parser.ts
  - src/graph/graph-model.ts
  - src/runner/protocol-runner.ts
  - src/runner/runner-state.ts
  - src/sessions/session-model.ts
  - src/settings.ts
  - src/styles/loop-support.css
  - src/views/editor-panel-view.ts
  - src/views/runner-view.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 44: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

The Phase 44 unified-loop-runtime implementation is overall well-engineered and tightly aligned with the locked plan. The state machine in `ProtocolRunner` cleanly threads the new `awaiting-loop-pick` status, the B1 re-entry guard at `case 'loop'` correctly increments iteration in-place without pushing a duplicate frame, the dead-end-return helper (`advanceOrReturnToLoop`) keeps iteration semantics consistent across back-edge and dead-end body returns, and the picker UI in `RunnerView` honours the locked `edge.id` dispatch contract and the exact-match `«выход»` string. Tests in the new `protocol-runner-loop-picker.test.ts` and `protocol-runner-session.test.ts` give thorough coverage of B1, B2, I1, W4, RUN-03, and the session JSON round-trip. The legacy `maxLoopIterations` setting has been excised cleanly and the test that asserts its absence (`settings-tab.test.ts`) is in place.

The findings below are all warnings or info — no critical bugs or security issues. The most material item is **WR-01**, a type-shape drift between `PersistedSession.undoStack` and `ProtocolRunner.getSerializableState().undoStack` that is silently masked by structural typing. Two warnings (WR-02, WR-03) cover defensive-coding gaps in the new RunnerView loop arm and the new `chooseLoopBranch` dispatcher. WR-04 flags a missing-edge edge case in the picker render. Info items document smaller hygiene opportunities: a stray non-null assertion, a dead test branch, a CSS class collision risk, an unguarded `node.headerText` read, and two long inline type signatures that should be extracted to named types.

## Warnings

### WR-01: Type-shape drift — `PersistedUndoEntry` is missing the `returnToBranchList` field

**File:** `src/sessions/session-model.ts:23-27`
**Issue:** The runtime `UndoEntry` type (`runner-state.ts:95-107`) carries the optional `returnToBranchList?: boolean` flag (Phase 31 D-08). `ProtocolRunner.getSerializableState()` writes it (`protocol-runner.ts:431-436`) and `restoreFrom()` reads it (`protocol-runner.ts:480-485`). However `PersistedUndoEntry` in `session-model.ts` declares only `nodeId / textSnapshot / loopContextStack` — the flag is omitted entirely. Three knock-on problems:
1. The session-roundtrip test "Test 1: chooseSnippetBranch then round-trip preserves returnToBranchList flag" (`protocol-runner-session.test.ts:142-145`) only passes because TypeScript's structural assignability lets the runner-shape JSON object be passed where the planner-declared `PersistedSession` is expected — the property survives at runtime but is invisible to type-checking.
2. Anyone reading `PersistedSession` in isolation cannot infer that the flag is part of the on-disk format.
3. A future contributor sanitising `PersistedSession` (e.g. `Object.keys(persisted.undoStack[0]).filter(...)`) would silently drop the flag and re-introduce the Phase 31 D-08 step-back regression, which is exactly the kind of accumulation-file regression the project's CLAUDE.md warns about.

**Fix:**
```typescript
// src/sessions/session-model.ts
export interface PersistedUndoEntry {
  nodeId: string;
  textSnapshot: string;
  loopContextStack: PersistedLoopContext[];
  /** Phase 31 D-08: marks the entry as a chooseSnippetBranch return-to-branch-list
   *  marker. Mirrors the runtime UndoEntry.returnToBranchList field. */
  returnToBranchList?: boolean;
}
```
After this fix, also tighten the inline `restoreFrom` and `getSerializableState` signatures in `protocol-runner.ts:413-417` and `467-475` to import `PersistedSession` / `PersistedUndoEntry` rather than re-declaring the shape inline (see IN-05).

---

### WR-02: `chooseLoopBranch` does not validate the source-node kind before dispatching

**File:** `src/runner/protocol-runner.ts:166-202`
**Issue:** Guard at line 167 only checks `runnerStatus !== 'awaiting-loop-pick'`. Once that passes, the dispatcher trusts that `currentNodeId` still resolves to a `loop` node. In the current code-paths this is true (`awaiting-loop-pick` is only entered from `case 'loop'`), but if `restoreFrom()` is given a hand-crafted or corrupt session whose `runnerStatus === 'awaiting-loop-pick'` and `currentNodeId` references e.g. a deleted node or a node of a different kind, the runner will silently mutate (push undo, pop frame, advance) without ever surfacing an error. The corresponding `awaiting-snippet-pick` arm at `pickSnippet` similarly trusts state, so this is a pattern-wide gap rather than a Phase 44 regression — but Phase 44 is the right place to harden the new arm because the dispatcher does more state mutation (loop frame pop) than `pickSnippet`.

**Fix:**
```typescript
chooseLoopBranch(edgeId: string): void {
  if (this.runnerStatus !== 'awaiting-loop-pick') return;
  if (this.graph === null || this.currentNodeId === null) return;

  const loopNode = this.graph.nodes.get(this.currentNodeId);
  if (loopNode === undefined || loopNode.kind !== 'loop') {
    this.transitionToError(
      `chooseLoopBranch called when current node '${this.currentNodeId}' is not a loop node.`,
    );
    return;
  }

  const edge = this.graph.edges.find(e => e.id === edgeId);
  // ... rest unchanged
}
```

---

### WR-03: Inner-«выход» path can pop a frame that does not belong to the current loop

**File:** `src/runner/protocol-runner.ts:185-188`
**Issue:** When the user clicks the «выход» branch, the code unconditionally pops the top frame:
```typescript
if (edge.label === 'выход') {
  this.loopContextStack.pop();
}
```
This is correct in normal flows because the top frame's `loopNodeId` always equals `currentNodeId` after `advanceThrough` halted at this loop — both `case 'loop'` first-entry and B1 re-entry write `currentNodeId = cursor` immediately before halting. But the invariant is implicit. If a future refactor changes how `currentNodeId` is set on resume from a serialised session (or if a corrupt session restores a top frame whose `loopNodeId` differs from `currentNodeId`), this `pop()` could discard the wrong frame and irreparably corrupt nested-loop iteration accounting. Hardening with an explicit invariant check is cheap and makes the contract self-documenting.

**Fix:**
```typescript
if (edge.label === 'выход') {
  const top = this.loopContextStack[this.loopContextStack.length - 1];
  if (top === undefined || top.loopNodeId !== this.currentNodeId) {
    this.transitionToError(
      'Loop frame stack is out of sync with current loop node — refuse to pop.',
    );
    return;
  }
  this.loopContextStack.pop();
}
```

---

### WR-04: Picker renders zero buttons silently when a loop node has no outgoing edges

**File:** `src/views/runner-view.ts:473-488`
**Issue:** `outgoing = this.graph.edges.filter(e => e.fromNodeId === state.nodeId)` may legitimately return `[]` if the user is somehow halted at a loop node with no outgoing edges (the validator should reject such a graph at parse time, but `validate()` enforcement is upstream and could be bypassed if a session is restored against an edited canvas where edges were deleted but the node still exists — `validateSessionNodeIds` only checks node IDs, not edge presence). When `outgoing.length === 0` the user sees an empty picker with no exit and no body buttons, only a possible "Step back" button. There is no error message and no diagnostic telling them why no buttons are rendered.

**Fix:**
```typescript
const outgoing = this.graph.edges.filter(e => e.fromNodeId === state.nodeId);
if (outgoing.length === 0) {
  questionZone.createEl('p', {
    text: 'This loop node has no outgoing edges. The protocol cannot continue from here.',
    cls: 'rp-empty-state-body',
  });
} else {
  const list = questionZone.createDiv({ cls: 'rp-loop-picker-list' });
  for (const edge of outgoing) {
    // ... existing button rendering
  }
}
```

## Info

### IN-01: Stray non-null assertion in `case 'start'` / `'text-block'` / `'answer'` after `advanceOrReturnToLoop`

**File:** `src/runner/protocol-runner.ts:561, 577, 594`
**Issue:** Each branch that calls `advanceOrReturnToLoop(next)` then writes `cursor = next!` to silence the TS non-null check. The bang is correct because the helper returns `'continue'` only when `next !== undefined` — but the connection is non-obvious to a reader. The helper would be clearer if it returned a discriminated union that carries the asserted node id.

**Fix:** Either inline a small comment at the call site explaining the invariant, or refactor `advanceOrReturnToLoop` to return `{ kind: 'continue', next: string } | { kind: 'halted' }` so the caller can do `if (r.kind === 'halted') return; cursor = r.next;` without the bang.

---

### IN-02: Dead test path in "returns null when runner has completed the protocol"

**File:** `src/__tests__/runner/protocol-runner-session.test.ts:39-44`
**Issue:** The test's else branch asserts `expect(true).toBe(true)` if the linear fixture does not reach `complete`. Either the fixture is guaranteed to complete (in which case the else branch is dead and should be deleted) or it is not (in which case the test is silently passing on a false negative). Inspect `linear.canvas`: `start → n-q1 (question) → n-a1 (answer terminal)`, so after `chooseAnswer('n-a1')` the runner reaches `complete`. The else branch is dead code.

**Fix:** Replace lines 39-44 with an unconditional assertion:
```typescript
expect(finalState.status).toBe('complete');
expect(runner.getSerializableState()).toBeNull();
```

---

### IN-03: `headerText !== ''` rendering check assumes parser normalisation

**File:** `src/views/runner-view.ts:465-470`
**Issue:** The render arm relies on `CanvasParser.parseNode` normalising missing `radiprotocol_headerText` to `''` (canvas-parser.ts:289 `getString(props, 'radiprotocol_headerText', '')`). The parser does this correctly today, but if the type ever became `headerText?: string`, this code would render the literal string "undefined" — the `!== ''` check would pass for `undefined`. The model contract (`graph-model.ts:67-70`) declares `headerText: string` (not optional), so the runtime invariant holds, but a defensive `node.headerText && node.headerText !== ''` is one extra character of insurance against a future graph-model relaxation.

**Fix (optional):** Either keep as-is (relying on the parser/model contract) or harden to `if (node.headerText)`. Choosing the explicit-empty-string check or the truthy check should be a project-wide convention, not an ad-hoc per-site call.

---

### IN-04: CSS class `.rp-loop-body-btn` is brand new but `.rp-loop-again-btn` is the legacy class — comment the relationship

**File:** `src/styles/loop-support.css:18-45, 47-90`
**Issue:** The Phase 6 block (lines 1-45) defines `.rp-loop-iteration-label`, `.rp-loop-btn-row`, `.rp-loop-again-btn`, `.rp-loop-done-btn`. The Phase 44 block (lines 47-90) adds `.rp-loop-header-text`, `.rp-loop-picker-list`, `.rp-loop-body-btn`, `.rp-loop-exit-btn`. None of the Phase 6 classes appear to be referenced by the new RunnerView code anymore (the picker uses `.rp-loop-body-btn` / `.rp-loop-exit-btn`). Per CLAUDE.md "Never remove existing code you didn't add", the Phase 6 block must stay — but a one-line comment at line 1 documenting that the older classes are kept for legacy `loop-start/loop-end` runtime paths (or are now actually orphaned and should be cleaned up in a future phase) would prevent future agents from being confused. A grep for `rp-loop-again-btn` and `rp-loop-done-btn` across `src/views/` will confirm whether they are still referenced.

**Fix:** Add a short comment block above line 47 noting that Phase 6 classes coexist with Phase 44 picker classes, and tag any genuinely orphaned Phase 6 selectors with `/* TODO: Phase ?: confirm orphaned and remove */` if a quick grep shows no remaining users.

---

### IN-05: Inline duplicated type signatures for `getSerializableState` / `restoreFrom`

**File:** `src/runner/protocol-runner.ts:409-417, 467-475`
**Issue:** Both methods declare a fully inlined object literal type for the persisted runner snapshot, including `loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>` repeated three times across the two signatures. This duplication is a maintenance hazard — if `LoopContext` gains a field (e.g. an iteration cap, a label), three places need to change in sync, and the linter cannot catch a divergence. `PersistedLoopContext` and `PersistedUndoEntry` already exist in `sessions/session-model.ts` for exactly this purpose.

**Fix:** After applying WR-01, import the shapes:
```typescript
import type { PersistedSession, PersistedLoopContext, PersistedUndoEntry } from '../sessions/session-model';

// Then:
getSerializableState(): Omit<PersistedSession, 'version' | 'canvasFilePath' | 'canvasMtimeAtSave' | 'savedAt'> | null { ... }

restoreFrom(session: Omit<PersistedSession, 'version' | 'canvasFilePath' | 'canvasMtimeAtSave' | 'savedAt'>): void { ... }
```
Alternatively define a `RunnerSnapshot` type in `runner-state.ts` and have `PersistedSession` extend it.

---

### IN-06: Comment in `case 'loop'` is excellent but the JSDoc on `chooseLoopBranch` does not mention the I1 invariant or the iteration-counter rationale

**File:** `src/runner/protocol-runner.ts:156-202`
**Issue:** The JSDoc explains the dispatch (выход vs body) and the `edgeId` rationale, but the deep comment about *why* `chooseLoopBranch` does not increment iteration (lines 191-198) is hidden inside the implementation. A future caller reading only the JSDoc might assume both code-paths increment, leading them to add a stray `frame.iteration += 1` thinking they are "fixing" a bug. Promote the iteration-semantic comment block into the JSDoc.

**Fix:** Add to the JSDoc block:
```
* Iteration semantics: this method NEVER increments frame.iteration. The B1
* re-entry guard inside case 'loop' (advanceThrough) is the single point of
* increment — fires on body back-edge re-entry AND inner-«выход» landing on
* the outer loop. This keeps "iteration = number of picker views for this
* frame" — see RUN-02 / RUN-04 / W4 tests for invariants.
```

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
