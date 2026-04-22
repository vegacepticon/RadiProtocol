---
phase: 47
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/runner/protocol-runner.ts
  - src/__tests__/runner/protocol-runner-loop-picker.test.ts
autonomous: true
requirements:
  - RUNFIX-01
must_haves:
  truths:
    - "User manual textarea edits made while halted at a loop-pick survive every loop transition (body-branch entry, «выход» exit, dead-end return, B1 re-entry)"
    - "syncManualEdit() writes to the accumulator when runnerStatus is awaiting-loop-pick, not only at-node"
    - "The undo snapshot captured inside chooseLoopBranch() contains the manual edit, not the pre-edit text"
  artifacts:
    - path: "src/runner/protocol-runner.ts"
      provides: "syncManualEdit accepts awaiting-loop-pick status"
      contains: "runnerStatus !== 'at-node' && this.runnerStatus !== 'awaiting-loop-pick'"
    - path: "src/__tests__/runner/protocol-runner-loop-picker.test.ts"
      provides: "RUNFIX-01 regression coverage"
      contains: "RUNFIX-01"
  key_links:
    - from: "src/views/runner-view.ts:479"
      to: "ProtocolRunner.syncManualEdit"
      via: "click handler on loop-pick button (body + exit)"
      pattern: "syncManualEdit\\(this\\.previewTextarea"
    - from: "ProtocolRunner.syncManualEdit"
      to: "TextAccumulator.overwrite"
      via: "accumulator mutation before chooseLoopBranch snapshots undo entry"
      pattern: "this\\.accumulator\\.overwrite"
---

<objective>
Close RUNFIX-01: manual textarea edits entered while the runner is halted at an `awaiting-loop-pick` state must survive every loop-node transition — body-branch entry, «выход» exit, dead-end return to picker, and B1 back-edge re-entry.

Purpose: the v1.2 BUG-01 capture-before-advance pattern is already wired from the view (`runner-view.ts:479` calls `syncManualEdit` before `chooseLoopBranch`), but the runtime gates `syncManualEdit` on `runnerStatus === 'at-node'` only, so the call is a silent no-op during loop-pick. The undo snapshot captured inside `chooseLoopBranch` (line 190, `this.accumulator.snapshot()`) therefore records the pre-edit text, and the next render shows the stale accumulator value.

Output: a one-line gate relaxation in `syncManualEdit` plus a vitest regression test that drives every loop-transition flavour with a manual edit and asserts the edit appears in `accumulatedText` after the transition.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/todos/pending/bug-runner-textarea-edits-lost-on-loop-transition.md
@./CLAUDE.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from src/runner/protocol-runner.ts during planning. -->

From src/runner/protocol-runner.ts (current, lines 301-310 — the bug site):
```typescript
/**
 * Inject a manual textarea edit into the accumulator before an advance action (BUG-01, D-01).
 * Must be called BEFORE chooseAnswer() / chooseLoopBranch() so that
 * the undo snapshot captured inside those methods includes the manual edit.
 * No-op if runner is not in 'at-node' state.
 */
syncManualEdit(text: string): void {
  if (this.runnerStatus !== 'at-node') return;   // <-- BUG: excludes awaiting-loop-pick
  this.accumulator.overwrite(text);
}
```

From src/runner/protocol-runner.ts (chooseLoopBranch, lines 175-211 — takes snapshot AFTER syncManualEdit should have fired):
```typescript
chooseLoopBranch(edgeId: string): void {
  if (this.runnerStatus !== 'awaiting-loop-pick') return;
  // ...
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),   // <-- must contain manual edit
    loopContextStack: [...this.loopContextStack],
  });
  // ...
  this.runnerStatus = 'at-node';
  this.advanceThrough(edge.toNodeId);
}
```

From src/views/runner-view.ts:479 (view already calls syncManualEdit before chooseLoopBranch — no view change needed):
```typescript
this.registerDomEvent(btn, 'click', () => {
  this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // Pitfall 7
  this.runner.chooseLoopBranch(edge.id);
  // ...
});
```

From src/runner/text-accumulator.ts:62:
```typescript
overwrite(text: string): void { /* replaces the buffer */ }
```

From src/__tests__/runner/protocol-runner-loop-picker.test.ts:1-23 (existing test patterns + loadGraph helper):
```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../../graph/canvas-parser';
import { ProtocolRunner } from '../../runner/protocol-runner';
// loadGraph('unified-loop-valid.canvas') — fixture already used by RUN-01..RUN-05 tests
// loadGraph('unified-loop-nested.canvas') — nested-loop fixture
```

Available loop fixtures under src/__tests__/fixtures/:
- unified-loop-valid.canvas (single loop, exit edge label «выход»)
- unified-loop-nested.canvas (nested loops)
- unified-loop-long-body.canvas (multi-step body branch)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Relax syncManualEdit gate to include awaiting-loop-pick, add RUNFIX-01 regression tests first</name>
  <files>src/runner/protocol-runner.ts, src/__tests__/runner/protocol-runner-loop-picker.test.ts</files>
  <read_first>
    - src/runner/protocol-runner.ts (focus lines 175-310: chooseLoopBranch + syncManualEdit)
    - src/runner/text-accumulator.ts (overwrite / current / snapshot semantics)
    - src/__tests__/runner/protocol-runner-loop-picker.test.ts (existing patterns, loadGraph helper, fixture naming)
    - src/__tests__/fixtures/unified-loop-valid.canvas (understand edge ids e2 body / e-exit or «выход» edge id — inspect the canvas JSON to find real edge ids)
    - src/__tests__/fixtures/unified-loop-nested.canvas (for dead-end-return + nested coverage)
    - .planning/todos/pending/bug-runner-textarea-edits-lost-on-loop-transition.md
  </read_first>
  <behavior>
    RED — add these tests first, all must fail before the gate fix:
    - Test 1 (body-branch entry preserves manual edit):
      * Start runner on unified-loop-valid.canvas → state is awaiting-loop-pick with accumulatedText=''.
      * Call runner.syncManualEdit('MANUAL_EDIT_TEXT').
      * Call runner.chooseLoopBranch with the body-branch edge id (the unlabeled or non-«выход» outgoing edge from n-loop).
      * Assert getState().status === 'at-node' AND getState().accumulatedText starts with 'MANUAL_EDIT_TEXT' (the body-branch target may append, but the manual text must be present).
    - Test 2 (exit «выход» preserves manual edit):
      * Start runner on unified-loop-valid.canvas, syncManualEdit('EXIT_EDIT'), chooseLoopBranch with the «выход» edge id, assert accumulatedText contains 'EXIT_EDIT' in the resulting state (at-node or complete, depending on fixture post-exit topology).
    - Test 3 (dead-end return re-enters loop-pick with manual edit retained):
      * Start runner, choose body branch, walk to a dead-end answer that triggers advanceOrReturnToLoop, syncManualEdit('DEADEND_EDIT') at that at-node state, chooseAnswer to end the body, re-enter awaiting-loop-pick, assert accumulatedText contains 'DEADEND_EDIT'. (This already works via chooseAnswer's at-node gate — asserts existing contract is not regressed.)
    - Test 4 (undo snapshot contains the manual edit, not pre-edit):
      * Start runner, syncManualEdit('PRE_EXIT_EDIT'), chooseLoopBranch on «выход», call stepBack(), assert getState().accumulatedText contains 'PRE_EXIT_EDIT' (proves the undo entry captured the edited text, not the original).

    GREEN — relax the gate in syncManualEdit:
    - Change line 308 from `if (this.runnerStatus !== 'at-node') return;` to
      `if (this.runnerStatus !== 'at-node' && this.runnerStatus !== 'awaiting-loop-pick') return;`
    - Update the JSDoc above (lines 301-306) to read "No-op if runner is not in 'at-node' or 'awaiting-loop-pick' state." and add a Phase 47 RUNFIX-01 note: "Phase 47 RUNFIX-01: loop-pick transitions also capture manual edits — the view calls syncManualEdit before chooseLoopBranch (runner-view.ts:479); without the awaiting-loop-pick gate the call was a no-op and the undo snapshot in chooseLoopBranch (line 190) recorded pre-edit text."
    - Run the four tests above and the existing RUN-01..RUN-05 suite; all must pass.
  </behavior>
  <action>
    Step 1 (RED): add a new `describe('ProtocolRunner RUNFIX-01 — manual edits survive loop transitions', ...)` block at the bottom of src/__tests__/runner/protocol-runner-loop-picker.test.ts containing Tests 1-4 above. Use the existing loadGraph helper and unified-loop-valid.canvas fixture. For Test 3 use unified-loop-nested.canvas or unified-loop-long-body.canvas as appropriate — inspect the fixture JSON to pick an edge id that leads to a dead-end answer so advanceOrReturnToLoop fires. Run `npm test -- protocol-runner-loop-picker.test.ts` and confirm the four new tests FAIL (Tests 1, 2, 4 fail because syncManualEdit no-ops; Test 3 should pass pre-fix — keep it as a non-regression guard).

    Step 2 (GREEN): in src/runner/protocol-runner.ts edit the syncManualEdit method (lines 301-310 as of current HEAD — search for the method signature `syncManualEdit(text: string): void {` to locate it reliably):
    - Replace the single gate line
      `if (this.runnerStatus !== 'at-node') return;`
      with
      `if (this.runnerStatus !== 'at-node' && this.runnerStatus !== 'awaiting-loop-pick') return;`
    - Update the JSDoc "No-op if runner is not in 'at-node' state." to
      "No-op if runner is not in 'at-node' or 'awaiting-loop-pick' state."
    - Append a new JSDoc paragraph: "Phase 47 RUNFIX-01: the awaiting-loop-pick gate extension keeps the BUG-01 capture-before-advance invariant alive on every loop transition — runner-view.ts:479 calls syncManualEdit before chooseLoopBranch, and chooseLoopBranch (line 190) takes the undo snapshot from the accumulator the instant after this call returns."

    Step 3: re-run `npm test -- protocol-runner-loop-picker.test.ts` and confirm all RUN-01..RUN-05 + RUNFIX-01 tests pass.

    Step 4: run the full test suite (`npm test`) and confirm no unrelated regressions.

    Do NOT modify any other method, do NOT touch runner-view.ts (the view already calls syncManualEdit at the right spot — lines 479). Do NOT widen the gate to include awaiting-snippet-pick or awaiting-snippet-fill (those states own the picker UI, have no textarea, and are out of scope for RUNFIX-01).
  </action>
  <verify>
    <automated>npm test -- protocol-runner-loop-picker.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "this.runnerStatus !== 'at-node' && this.runnerStatus !== 'awaiting-loop-pick'" src/runner/protocol-runner.ts` returns exactly 1 match inside the syncManualEdit method.
    - `grep -n "RUNFIX-01" src/runner/protocol-runner.ts` returns >=1 match (the JSDoc update).
    - `grep -n "RUNFIX-01" src/__tests__/runner/protocol-runner-loop-picker.test.ts` returns >=4 matches (the new test names or block header).
    - `npm test -- protocol-runner-loop-picker.test.ts` exits 0; new RUNFIX-01 describe block reports 4 passing tests; the 5 existing RUN-01..RUN-05 tests still pass.
    - `npm test` (full suite) exits 0.
    - `git diff src/runner/protocol-runner.ts` shows ONLY: (a) the single-line gate change inside syncManualEdit, (b) the JSDoc edit/append above it. No other method, field, or import is added, removed, or reordered.
    - git diff confirms no pre-Phase 47 functions or fields deleted from src/runner/protocol-runner.ts.
    - No edits to src/views/runner-view.ts (this plan does not touch the view; 47-02 does).
  </acceptance_criteria>
  <done>
    The four RUNFIX-01 regression tests pass; syncManualEdit now writes through in both at-node and awaiting-loop-pick states; the full vitest suite is green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user textarea → ProtocolRunner | User-typed text crosses from DOM input into the runner's accumulator via syncManualEdit. Existing pre-Phase 47 boundary; no new surface. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-47-01-01 | Tampering | syncManualEdit accumulator overwrite | accept | Existing behaviour: the user is authoring their own output; there is no adversary model where the user tampers with their own buffer. Extending the valid-state set from {at-node} to {at-node, awaiting-loop-pick} does not change who can call the method — only when. |
| T-47-01-02 | Information Disclosure | textSnapshot captured in undoStack | accept | The snapshot already contained accumulator contents pre-Phase 47; including manual edits in that snapshot is the intended fix, not a new leak. undoStack stays in-memory per runner instance. |

No new attack surface; changes are confined to a state-gate relaxation inside an existing method + vitest coverage. No user-supplied data enters new code paths. ASVS L1 — no relevant threats.
</threat_model>

<verification>
- `npm test` passes with no skipped or failing tests.
- `grep -n "awaiting-loop-pick" src/runner/protocol-runner.ts | grep "syncManualEdit\|at-node.*awaiting-loop-pick"` shows the relaxed gate.
- Manual smoke (optional): load a canvas where a Snippet node feeds into a Loop node, run, edit the inserted text, pick a body branch, observe edit survives on the next at-node render.
</verification>

<success_criteria>
- RUNFIX-01 closed: manual textarea edits survive body-branch entry, «выход» exit, dead-end return, and B1 re-entry.
- Four new vitest cases in protocol-runner-loop-picker.test.ts exercise each transition type.
- No other runtime behaviour changes.
</success_criteria>

<output>
After completion, create `.planning/phases/47-runner-regressions/47-01-SUMMARY.md` using the standard summary template. Reference RUNFIX-01 in the summary's requirements-closed section.
</output>
