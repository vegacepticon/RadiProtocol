---
phase: 44
plan: 02a
type: execute
wave: 2
depends_on: [44-01]
files_modified:
  - src/runner/runner-state.ts
  - src/runner/protocol-runner.ts
  - src/sessions/session-model.ts
autonomous: true
requirements:
  - RUN-01
  - RUN-02
  - RUN-03
  - RUN-04
  - RUN-05
user_setup: []
tags: [runtime, loop, state-machine, session]

must_haves:
  truths:
    - "Running a protocol reaches a loop node and halts with status 'awaiting-loop-pick' pointing at the loop node id"
    - "Public method chooseLoopBranch(edgeId) exists on ProtocolRunner with exact signature `chooseLoopBranch(edgeId: string): void`"
    - "Choosing a body-branch edge walks the branch; on dead-end (firstNeighbour returns undefined) runner auto-returns to the owning loop's picker with iteration incremented"
    - "Re-entering a loop node via a back-edge or an inner «выход» does NOT push a new frame — the existing top-of-stack frame is reused and its iteration is incremented"
    - "Choosing the edge whose label === 'выход' pops loopContextStack and advances along the exit edge"
    - "Nested loops work: inner loop's «выход» returns to outer loop's picker without touching outer frame"
    - "Step-back from the loop picker restores pre-loop currentNodeId and pre-loop accumulatedText via the existing undoStack — canStepBack is true EVEN when the loop is the first node after start() (no predecessor case), because an undo entry is still pushed"
    - "PersistedSession.runnerStatus union includes 'awaiting-loop-pick'; getSerializableState returns non-null at that status"
    - "AtNodeState deprecated fields loopIterationLabel and isAtLoopEnd are removed"
    - "chooseLoopAction stub method is removed from ProtocolRunner"
    - "ProtocolRunner.maxIterations (RUN-09 auto-advance cycle guard) remains intact; its test stays green"
  artifacts:
    - path: "src/runner/runner-state.ts"
      provides: "AwaitingLoopPickState interface + RunnerState union extended"
      contains: "interface AwaitingLoopPickState"
    - path: "src/runner/protocol-runner.ts"
      provides: "case 'loop' with re-entry guard + chooseLoopBranch + advanceOrReturnToLoop helper + widened getSerializableState/restoreFrom + previousCursor threading for undo snapshot at first-halt"
      exports: ["ProtocolRunner"]
    - path: "src/sessions/session-model.ts"
      provides: "PersistedSession.runnerStatus union widened to 'awaiting-loop-pick'"
      contains: "'awaiting-loop-pick'"
  key_links:
    - from: "src/runner/protocol-runner.ts"
      to: "src/runner/runner-state.ts"
      via: "import type { RunnerState, UndoEntry }"
      pattern: "runnerStatus: RunnerState\\['status'\\]"
    - from: "src/runner/protocol-runner.ts"
      to: "src/sessions/session-model.ts"
      via: "runnerStatus assignment in getSerializableState"
      pattern: "'awaiting-loop-pick'"
---

<objective>
Wire the runtime state machine for the unified loop node (Phase 44 Plan 02 was split into 02a + 02b; this is the runtime half). Add a new discriminated-union variant `AwaitingLoopPickState`, replace the Phase 43 `transitionToError` stub in `advanceThrough()` with a real loop-entry sequence (undo snapshot → frame push/reuse → halt at picker), add public method `chooseLoopBranch(edgeId)` dispatching on «выход» vs body label, extract a dead-end-return helper so any terminal in a loop body returns to the owning picker, widen the session serialization union to include the new status, and remove the Phase 43 D-14 deprecated relics (`chooseLoopAction` stub, `loopIterationLabel`, `isAtLoopEnd`).

This plan is SPLIT from the original Plan 02 (rev 1) per checker W1: original Plan 02 grew past its context budget after incorporating B1 (re-entry guard), B2 (previousCursor threading), and B3/I1/W4 test updates. Runtime edits live here; all test rewrites live in Plan 02b.

Purpose: This plan delivers the state-machine half of Phase 44. All of RUN-01..RUN-05 are satisfied at the pure-logic level. Plan 02b fills tests for RUN-01..RUN-05 + adds a long-body integration test (W4). Plan 03 adds the RunnerView picker UI and session round-trip tests.

Output: Runtime that compiles clean. All downstream tests in Plan 02b and Plan 03 pin this runtime's behaviour.
</objective>

<execution_context>
@.planning/phases/44-unified-loop-runtime/44-RESEARCH.md
@.planning/phases/44-unified-loop-runtime/44-PATTERNS.md
@.planning/phases/44-unified-loop-runtime/44-VALIDATION.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/44-unified-loop-runtime/44-01-SUMMARY.md
@src/runner/runner-state.ts
@src/runner/protocol-runner.ts
@src/sessions/session-model.ts
@src/graph/graph-model.ts
@src/__tests__/fixtures/unified-loop-valid.canvas
@src/__tests__/fixtures/unified-loop-nested.canvas

<interfaces>
<!-- Exact contracts — no codebase exploration needed. -->

From src/runner/runner-state.ts (current state — BEFORE this plan's edits):
```typescript
export interface AtNodeState {
  status: 'at-node';
  currentNodeId: string;
  accumulatedText: string;
  canStepBack: boolean;
  /** @deprecated Phase 43 D-14 — DELETE in Phase 44 (Pitfall 9) */
  loopIterationLabel?: string;
  /** @deprecated Phase 43 D-14 — DELETE in Phase 44 (Pitfall 9) */
  isAtLoopEnd?: boolean;
}

export interface AwaitingSnippetPickState {  // ANALOG — mirror shape for new variant
  status: 'awaiting-snippet-pick';
  nodeId: string;
  subfolderPath: string | undefined;
  accumulatedText: string;
  canStepBack: boolean;
}

export type RunnerState =
  | IdleState
  | AtNodeState
  | AwaitingSnippetPickState
  | AwaitingSnippetFillState
  | CompleteState
  | ErrorState;   // ← extend with | AwaitingLoopPickState

export interface UndoEntry {
  nodeId: string;
  textSnapshot: string;
  loopContextStack: LoopContext[];
  returnToBranchList?: boolean;
}
```

From src/graph/graph-model.ts:
```typescript
export interface LoopNode extends RPNodeBase { kind: 'loop'; headerText: string; }
export interface LoopContext {
  loopNodeId: string;   // renamed Phase 43 D-04 from loopStartId
  iteration: number;
  textBeforeLoop: string;
}
```

From src/runner/protocol-runner.ts (current shapes — AFTER Phase 43):
```typescript
// Current getSerializableState return type — WIDEN runnerStatus union
getSerializableState(): {
  runnerStatus: 'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill'; // ← add | 'awaiting-loop-pick'
  currentNodeId: string;
  accumulatedText: string;
  undoStack: Array<{ nodeId: string; textSnapshot: string; loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>; returnToBranchList?: boolean }>;
  loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>;
  snippetId: string | null;
  snippetNodeId: string | null;
} | null {

// Current status gate — WIDEN
if (
  this.runnerStatus !== 'at-node' &&
  this.runnerStatus !== 'awaiting-snippet-fill' &&
  this.runnerStatus !== 'awaiting-snippet-pick'  // ← add && this.runnerStatus !== 'awaiting-loop-pick'
) { return null; }

// restoreFrom parameter type — WIDEN same way

// Phase 43 stub at case 'loop' inside advanceThrough — REPLACE
case 'loop': {
  this.transitionToError('Loop runtime ещё не реализован (запланировано в Phase 44 — см. ROADMAP v1.7).');
  return;
}

// @deprecated stub method — DELETE
chooseLoopAction(action: 'again' | 'done'): void {
  void action;
  this.transitionToError('chooseLoopAction устарел (Phase 43 D-18). Loop runtime реализуется в Phase 44.');
}

// getState() case 'at-node' — DROP loopIterationLabel and isAtLoopEnd properties

// Three sites in advanceThrough using firstNeighbour → transitionToComplete on undefined:
//   case 'start' (lines ~507-515)
//   case 'text-block' non-snippet branch (lines ~527-533)
//   case 'answer' (lines ~546-552)
// Refactor all three to use new helper advanceOrReturnToLoop.
```

From src/sessions/session-model.ts (WIDEN):
```typescript
runnerStatus: 'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill'; // ← add | 'awaiting-loop-pick'
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add AwaitingLoopPickState, widen session union, remove Phase 43 deprecated fields</name>
  <files>src/runner/runner-state.ts, src/sessions/session-model.ts</files>
  <read_first>
    - src/runner/runner-state.ts (full file, 105 lines — confirm current state of AtNodeState deprecated fields and RunnerState union)
    - src/sessions/session-model.ts (full file, 65 lines — confirm PersistedSession.runnerStatus literal union)
    - .planning/phases/44-unified-loop-runtime/44-PATTERNS.md section "src/runner/runner-state.ts (model: new AwaitingLoopPickState)" — literal shape to mirror
    - .planning/phases/44-unified-loop-runtime/44-RESEARCH.md Pitfall 5 (widen both unions together to avoid TS break) and Pitfall 9 (remove deprecated fields)
  </read_first>
  <behavior>
    - Test 1: `RunnerState` type accepts a value with `status: 'awaiting-loop-pick'`, `nodeId: string`, `accumulatedText: string`, `canStepBack: boolean` (compile-time — enforced by Task 2 tests)
    - Test 2: `AtNodeState` type rejects `loopIterationLabel` and `isAtLoopEnd` property assignments (compile-time)
    - Test 3: `PersistedSession.runnerStatus` accepts the literal 'awaiting-loop-pick'
  </behavior>
  <action>
    Edit `src/runner/runner-state.ts`:

    1. In `interface AtNodeState` (currently lines 17-33) DELETE these two properties (Pitfall 9):
       ```typescript
       /** @deprecated Phase 43 D-14 ... */
       loopIterationLabel?: string;
       /** @deprecated Phase 43 D-14 ... */
       isAtLoopEnd?: boolean;
       ```
       Keep `status`, `currentNodeId`, `accumulatedText`, `canStepBack`. Delete both JSDoc comments describing those deleted fields.

    2. After `AwaitingSnippetPickState` (currently lines 40-46) ADD the new interface, mirroring its shape:
       ```typescript
       /**
        * Phase 44 (RUN-01): runner paused at a unified loop node, presenting a picker
        * over all outgoing edges (body branches + «выход»). Transitions back to
        * 'at-node' via chooseLoopBranch(edgeId).
        */
       export interface AwaitingLoopPickState {
         status: 'awaiting-loop-pick';
         nodeId: string;                 // loop node id — RunnerView looks up headerText from graph
         accumulatedText: string;
         canStepBack: boolean;
       }
       ```

    3. Extend the `RunnerState` discriminated union (currently lines 77-83) — add `| AwaitingLoopPickState` between `AwaitingSnippetPickState` and `AwaitingSnippetFillState` so picker-variants stay adjacent:
       ```typescript
       export type RunnerState =
         | IdleState
         | AtNodeState
         | AwaitingSnippetPickState
         | AwaitingLoopPickState
         | AwaitingSnippetFillState
         | CompleteState
         | ErrorState;
       ```

    Edit `src/sessions/session-model.ts`:

    4. On the `runnerStatus` line (currently line 51) widen the literal union by appending `| 'awaiting-loop-pick'`. Exact new line:
       ```typescript
       runnerStatus: 'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill' | 'awaiting-loop-pick';
       ```

    5. Update the JSDoc above that field (currently lines 46-50) to list `'awaiting-loop-pick'` among valid resume states. Replace the text "Only 'at-node', 'awaiting-snippet-pick' and 'awaiting-snippet-fill' are valid" with "Only 'at-node', 'awaiting-snippet-pick', 'awaiting-snippet-fill', and 'awaiting-loop-pick' are valid".

    CLAUDE.md DISCIPLINE: Do NOT touch `IdleState`, `AwaitingSnippetFillState`, `CompleteState`, `ErrorState`, `UndoEntry`, `PersistedLoopContext`, `PersistedUndoEntry`, or any other field on `PersistedSession`. Zero code deletions outside the two `@deprecated` fields in `AtNodeState`.
  </action>
  <verify>
    <automated>npx tsc --noEmit --skipLibCheck 2>&1 | grep -E 'error TS' | grep -v -E 'loopIterationLabel|isAtLoopEnd|AwaitingLoopPickState' | (! grep -q .)</automated>
  </verify>
  <done>
    - `grep -n 'awaiting-loop-pick' src/runner/runner-state.ts` shows ≥1 match (AwaitingLoopPickState.status literal)
    - `grep -n 'awaiting-loop-pick' src/sessions/session-model.ts` shows exactly 1 match (PersistedSession.runnerStatus union)
    - `grep -cn 'loopIterationLabel\|isAtLoopEnd' src/runner/runner-state.ts` returns 0
    - W2 fix: the `npx tsc ... | grep ... | (! grep -q .)` pipeline negates final grep and exits non-zero if ANY unexpected TS error (outside the three allow-listed names `loopIterationLabel|isAtLoopEnd|AwaitingLoopPickState`) remains. Only errors referencing those three names are tolerated; those are fixed by Task 2. No errors in runner-state.ts or session-model.ts themselves.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Replace 'loop' stub with real runtime + chooseLoopBranch + dead-end helper + re-entry guard + previousCursor threading + remove chooseLoopAction + widen session serialization</name>
  <files>src/runner/protocol-runner.ts</files>
  <read_first>
    - src/runner/protocol-runner.ts (full file, ~607 lines — confirm line anchors for case 'loop' stub, chooseLoopAction, getState case 'at-node', getSerializableState return type, restoreFrom param type, three firstNeighbour/transitionToComplete sites, top of advanceThrough where `let cursor = nodeId; let steps = 0;` is declared)
    - .planning/phases/44-unified-loop-runtime/44-PATTERNS.md sections:
      · "src/runner/protocol-runner.ts — new `case 'loop':` in `advanceThrough()`" (literal loop-entry code — to be AUGMENTED per B1 + B2)
      · "src/runner/protocol-runner.ts — new public method `chooseLoopBranch(edgeId)`" (literal method body — mirrors chooseSnippetBranch)
      · "src/runner/protocol-runner.ts — dead-end return helper in `advanceThrough()`" (advanceOrReturnToLoop prescription)
      · "src/runner/protocol-runner.ts — widen `getSerializableState` / `restoreFrom`" (three-site widening)
    - .planning/phases/44-unified-loop-runtime/44-RESEARCH.md Pitfalls 1 (undo push order), 2 (dead-end helper), 3 (nested pop), 4 (edge filter not adjacency), 8 (delete chooseLoopAction only after rewriting tests), 10 (auto-advance cycle guard — reset `steps = 0` when halting at picker)
    - src/graph/graph-model.ts interface Edge (to confirm `edge.id`, `edge.fromNodeId`, `edge.toNodeId`, `edge.label?: string` shape)
    - src/__tests__/fixtures/unified-loop-valid.canvas — CRITICAL EVIDENCE for B1: edge `e5: n-a1 → n-loop` is the back-edge that triggers loop re-entry. Without the B1 guard, the RUN-02 answer→back-edge path would push a second frame and break RUN-02 iteration assertion + RUN-04 outer-return assertion.
  </read_first>
  <behavior>
    - Test 1 (RUN-01, in Plan 02b): `runner.start(loadGraph('unified-loop-valid.canvas'))` → `runner.getState().status === 'awaiting-loop-pick'` and `state.nodeId === 'n-loop'`
    - Test 2 (RUN-02, in Plan 02b): after `chooseLoopBranch('e2')` walks to question, `chooseAnswer('n-a1')` → n-a1 auto-appends → e5 back-edge → re-enter n-loop → runner returns to picker with `loopContextStack[0].iteration === 2` AND `loopContextStack.length === 1` (single frame — verifies B1 re-entry guard, I1 assertion strengthened)
    - Test 3 (RUN-03, in Plan 02b): `chooseLoopBranch('e3')` (the «выход» edge) → `loopContextStack.length === 0` and state transitions to `'complete'` (or next node)
    - Test 4 (RUN-04, in Plan 02b): on nested fixture, inner «выход» edge `e5` points to `n-outer` → inner frame popped, advanceThrough re-enters n-outer, B1 re-entry guard fires, top-of-stack (outer frame) iteration increments from 1 to 2; state becomes `awaiting-loop-pick` with `nodeId === 'n-outer'` AND `loopContextStack.length === 1` (single outer frame, not two — B1 assertion)
    - Test 5 (RUN-05, in Plan 02b): step-back from picker restores pre-loop state (empty loopContextStack, original accumulatedText). `canStepBack === true` EVEN on the first halt after `runner.start(loadGraph('unified-loop-valid.canvas'))` because B2 threading ensures an undo entry is pushed even when the loop node has no predecessor (previousCursor === null → entry.nodeId = loop node itself, restoring it just re-runs advanceThrough and lands back at the picker — step-back is a logical no-op but the button shows enabled).
    - Test 6: `chooseLoopAction` method no longer exists on `ProtocolRunner.prototype`
    - Test 7: `getSerializableState()` at `awaiting-loop-pick` returns non-null with `runnerStatus === 'awaiting-loop-pick'`
  </behavior>
  <action>
    Edit `src/runner/protocol-runner.ts` in this exact order:

    **Step A — replace the `case 'loop':` stub inside `advanceThrough()`** with a re-entry-safe loop-entry sequence (B1 + B2 fixes).

    The current `case 'loop':` stub lives at lines ~554-563 (preceded by the `case 'answer':` block ending at line ~553). Before editing the case itself, you MUST introduce a local `previousCursor` variable at the TOP of `advanceThrough` and thread it through each case that updates `cursor`. This is the B2 fix.

    B2 threading — at the top of `advanceThrough` (currently lines ~482-484):

    BEFORE:
    ```typescript
    private advanceThrough(nodeId: string): void {
      let cursor = nodeId;
      let steps = 0;
    ```

    AFTER:
    ```typescript
    private advanceThrough(nodeId: string): void {
      let cursor = nodeId;
      // B2 — previousCursor records the node we were at BEFORE the current cursor was assigned.
      // Used by case 'loop' below to push an undo entry with nodeId=<predecessor> so step-back
      // from the picker restores the predecessor. When advanceThrough is called directly from
      // start() or chooseLoopBranch() and the first node IS the loop itself, previousCursor stays
      // null; the loop-entry undo push then falls back to nodeId=cursor (step-back becomes a
      // logical no-op — re-running advanceThrough lands back at the same picker).
      let previousCursor: string | null = null;
      let steps = 0;
    ```

    Then update every case that re-assigns `cursor = next;` to FIRST snapshot the old cursor into `previousCursor` — this is the threading B2 requires. Inside the while-loop, AFTER the case-dispatch updates cursor, `previousCursor = <old-cursor-before-reassignment>` MUST be set. Because there are three auto-advance cases (`start`, `text-block` non-snippet, `answer`) that reassign cursor, the cleanest shape is to perform the assignment INSIDE each case, just before `cursor = next!`. See Step B refactor below — `previousCursor = cursor;` goes on the line immediately above `cursor = next!;` in each of the three cases.

    B1 re-entry guard — REPLACE the `case 'loop':` stub body (currently lines ~558-563):

    BEFORE (delete):
    ```typescript
    case 'loop': {
      this.transitionToError(
        'Loop runtime ещё не реализован (запланировано в Phase 44 — см. ROADMAP v1.7).',
      );
      return;
    }
    ```

    AFTER (write):
    ```typescript
    case 'loop': {
      // B1 re-entry guard — check top-of-stack BEFORE pushing a new frame.
      // If the top frame's loopNodeId === cursor, this call is a re-entry via a body
      // back-edge (e.g. n-a1 → n-loop in unified-loop-valid.canvas) OR an inner «выход»
      // that lands on the outer loop node (e.g. e5: n-inner → n-outer in
      // unified-loop-nested.canvas). In both cases the frame already exists — increment
      // iteration in-place and halt at the picker WITHOUT pushing a second frame and
      // WITHOUT pushing a second undo entry (preserves RUN-02 iteration semantics and
      // RUN-04 single-outer-frame invariant).
      const top = this.loopContextStack[this.loopContextStack.length - 1];
      if (top !== undefined && top.loopNodeId === cursor) {
        top.iteration += 1;
        this.currentNodeId = cursor;
        this.runnerStatus = 'awaiting-loop-pick';
        return;
      }

      // First-entry path — push undo snapshot + new frame + halt.
      // Undo-before-mutate (Pitfall 1) with B2 previousCursor threading:
      //   - If previousCursor !== null we came here via auto-advance from a real predecessor;
      //     push undo with nodeId=previousCursor so step-back restores that predecessor.
      //   - If previousCursor === null we entered advanceThrough directly at the loop node
      //     (e.g. start() on a graph whose start-edge points straight at a loop, or any other
      //     zero-auto-advance path). Push undo with nodeId=cursor so canStepBack=true. Step-back
      //     will restore currentNodeId=loopNode + empty loopContextStack; re-running advanceThrough
      //     from the loop node will fall through here again and re-halt at the picker. This is
      //     a logical no-op from the user's perspective (the button clicks but nothing visible
      //     changes) — acceptable because (a) consistent canStepBack behaviour in the union type,
      //     (b) keeps the UI "Step back" button enabled symmetrically, (c) no data loss.
      this.undoStack.push({
        nodeId: previousCursor !== null ? previousCursor : cursor,
        textSnapshot: this.accumulator.snapshot(),
        loopContextStack: [...this.loopContextStack],  // shallow spread — frames are primitive-only
      });
      this.loopContextStack.push({
        loopNodeId: cursor,
        iteration: 1,
        textBeforeLoop: this.accumulator.snapshot(),
      });
      this.currentNodeId = cursor;
      this.runnerStatus = 'awaiting-loop-pick';
      return;
    }
    ```

    LEAVE the merged `case 'loop-start': case 'loop-end':` defensive `transitionToError` arm (currently lines ~564-573) UNCHANGED — legacy kinds still parseable per Phase 43 D-CL-05 variant b; validator rejects the canvas so this arm is unreachable but must stay for TypeScript exhaustiveness.

    **Step B — add the dead-end return helper AND refactor the three auto-advance sites to use it + thread previousCursor.**

    New private method, place immediately above `private firstNeighbour(nodeId: string)` at current line ~591. CRITICAL nuance: each of the three callers uses a local `cursor` variable; the helper must update `this.currentNodeId` and `this.runnerStatus` for the halted case but cannot modify the caller's `cursor`:

    ```typescript
    /**
     * Phase 44 (RUN-02): helper for auto-advance dead-end handling.
     * When `next` is undefined (current node has no outgoing edge):
     *   - if inside a loop frame, increment the top frame's iteration, set
     *     currentNodeId to the top frame's loopNodeId, set runnerStatus to
     *     'awaiting-loop-pick', and return 'halted';
     *   - otherwise call transitionToComplete() and return 'halted'.
     * When `next` is defined, return 'continue' — caller updates its local cursor.
     *
     * Iteration semantic: dead-end bodies and back-edge bodies BOTH count as one
     * new iteration per return to the picker. Back-edge bodies hit B1 re-entry
     * guard inside case 'loop' (different code path); this helper is ONLY for the
     * true-dead-end case (node with zero outgoing edges).
     */
    private advanceOrReturnToLoop(next: string | undefined): 'continue' | 'halted' {
      if (next !== undefined) return 'continue';
      if (this.loopContextStack.length > 0) {
        const frame = this.loopContextStack[this.loopContextStack.length - 1];
        if (frame !== undefined) {
          // Dead-end body (no outgoing edge) returning to the owning picker counts as a new
          // iteration, same as a back-edge body would (via B1 re-entry guard). This keeps the
          // semantic consistent: EVERY return to a picker from a body pass increments iteration
          // exactly once. Note that back-edge bodies reach the loop node via cursor = next! →
          // case 'loop' → B1 guard, which is a different code path and NOT this helper.
          frame.iteration += 1;
          this.currentNodeId = frame.loopNodeId;
          this.runnerStatus = 'awaiting-loop-pick';
          return 'halted';
        }
      }
      this.transitionToComplete();
      return 'halted';
    }
    ```

    Refactor the three existing sites inside `advanceThrough()` that currently do `if (next === undefined) { this.transitionToComplete(); return; } cursor = next;`. Each site must:
    1. Call `advanceOrReturnToLoop(next)` — if it returns `'halted'`, return.
    2. Set `previousCursor = cursor;` BEFORE the cursor reassignment (B2 threading — REQUIRED).
    3. Reassign `cursor = next!`.

    - `case 'start'` (currently lines ~507-515):
      ```typescript
      case 'start': {
        const next = this.firstNeighbour(cursor);
        if (this.advanceOrReturnToLoop(next) === 'halted') return;
        previousCursor = cursor;   // B2 threading
        cursor = next!;
        break;
      }
      ```

    - `case 'text-block'` NON-snippet branch (currently lines ~525-533) — the snippet-awaiting branch at lines ~518-524 stays untouched:
      ```typescript
      // RUN-05: auto-append static text — no user interaction required
      this.accumulator.appendWithSeparator(node.content, this.resolveSeparator(node));
      const next = this.firstNeighbour(cursor);
      if (this.advanceOrReturnToLoop(next) === 'halted') return;
      previousCursor = cursor;   // B2 threading
      cursor = next!;
      break;
      ```

    - `case 'answer'` (currently lines ~542-552):
      ```typescript
      case 'answer': {
        this.accumulator.appendWithSeparator(node.answerText, this.resolveSeparator(node));
        const next = this.firstNeighbour(cursor);
        if (this.advanceOrReturnToLoop(next) === 'halted') return;
        previousCursor = cursor;   // B2 threading
        cursor = next!;
        break;
      }
      ```

    The `next!` non-null assertion is safe because `advanceOrReturnToLoop` returning `'continue'` implies `next !== undefined`.

    **Step C — reset the auto-advance cycle guard between picker halts + acknowledge W4 long-body coverage** (Pitfall 10):

    Inside `advanceThrough()`, `let steps = 0;` is declared once per call. When `advanceOrReturnToLoop` halts with `'halted'` to a picker, the next `chooseLoopBranch → advanceThrough(edge.toNodeId)` call starts a fresh `advanceThrough` with `steps = 0` again, so the counter IS naturally reset between picker halts. Verify this by inspection; add a one-line comment at the top of `advanceThrough` (directly above `let steps = 0;`) reading:

    ```typescript
    // steps counter resets on each advanceThrough entry (RUN-07 context: per-call cycle guard,
    // NOT per-loop cap). W4 — long-body integration test in Plan 02b Task 2 exercises a loop
    // body with 10 text-blocks × 10 iterations ≈ 110 nodes-per-call to confirm the guard does
    // NOT trip in realistic long-body cases. ProtocolRunner.maxIterations stays at its default.
    ```

    NO behavioural change needed.

    **Step D — add the public `chooseLoopBranch(edgeId)` method**. Insert immediately AFTER `chooseSnippetBranch` (currently ends at line ~153, before `enterFreeText` at line ~161):

    ```typescript
    /**
     * Phase 44 (RUN-01, RUN-03): user picks a branch at the loop picker.
     * Valid only in 'awaiting-loop-pick'. Dispatches by edge label:
     *   - 'выход'  → pop the current loop frame, advance along the exit edge
     *   - other    → increment iteration on top frame, advance along the body edge
     *
     * edgeId is the stable identifier per locked decision (planner D-02): labels
     * can duplicate and targetNodeIds can collide when two body branches point to
     * the same node. Only edgeId is unambiguous.
     */
    chooseLoopBranch(edgeId: string): void {
      if (this.runnerStatus !== 'awaiting-loop-pick') return;
      if (this.graph === null || this.currentNodeId === null) return;

      const edge = this.graph.edges.find(e => e.id === edgeId);
      if (edge === undefined || edge.fromNodeId !== this.currentNodeId) {
        this.transitionToError(
          `Loop picker edge '${edgeId}' not found or does not originate at current loop node.`,
        );
        return;
      }

      // Undo-before-mutate (Pitfall 1)
      this.undoStack.push({
        nodeId: this.currentNodeId,
        textSnapshot: this.accumulator.snapshot(),
        loopContextStack: [...this.loopContextStack],
      });

      if (edge.label === 'выход') {
        // RUN-03: pop frame (top-of-stack, nested-safe)
        this.loopContextStack.pop();
      }
      // Body branch: DO NOT increment iteration here. The B1 re-entry guard inside
      // case 'loop' is the sole site that increments iteration (fires on back-edge
      // re-entry AND on inner-«выход» landing on outer). This keeps the semantic
      // "iteration = number of times user has seen the picker for this loop node":
      //   - First loop-entry:         iteration = 1 (halts at picker)
      //   - Pick body → walk → return: B1 increments to 2 (2nd picker view)
      //   - Pick body again → return:  B1 increments to 3 (3rd picker view)
      // Without this rule, both chooseLoopBranch AND B1 would increment, giving
      // iteration = 2*N + 1 after N picks — confusing and out of line with the
      // Plan 02b RUN-02 assertion expect(iteration).toBe(2).

      this.runnerStatus = 'at-node';
      this.advanceThrough(edge.toNodeId);
    }
    ```

    CRITICAL: `edge.label === 'выход'` uses the literal 6-char Cyrillic string (per user-locked decision and Phase 43 D-08 contract). NO `.trim()`, NO `.toLowerCase()`.

    Interaction with B1 re-entry guard: when a body branch has a back-edge that eventually re-enters the same loop node (e.g. `e5: n-a1 → n-loop` in unified-loop-valid.canvas), `advanceThrough(edge.toNodeId)` in chooseLoopBranch walks: n-q1 (halt, await answer) → user clicks answer → n-a1 auto-appends → firstNeighbour(n-a1) returns 'n-loop' → cursor = 'n-loop' → next while-iteration dispatches case 'loop' → B1 guard detects top.loopNodeId === cursor → iteration increments from 1 to 2. Final iteration after ONE pick+answer cycle = 2 (incremented ONLY in case 'loop' re-entry guard; chooseLoopBranch does NOT increment — see note above). This matches the Plan 02b RUN-02 `expect(iteration).toBe(2)` assertion.

    **Step E — delete the `chooseLoopAction` @deprecated stub** (currently lines ~290-302 including JSDoc). Remove the entire method and its JSDoc block. This is safe because Plan 02b rewrites the tests that referenced it; Plan 02b depends on 02a so the delete-order is correct (delete here, rewrite tests there).

    **Step F — clean up `getState()` at `'at-node'`** (currently lines ~312-324): remove `loopIterationLabel` and `isAtLoopEnd` from the returned object. Final shape:
    ```typescript
    case 'at-node': {
      return {
        status: 'at-node',
        currentNodeId: this.currentNodeId ?? '',
        accumulatedText: this.accumulator.current,
        canStepBack: this.undoStack.length > 0,
      };
    }
    ```
    Also delete the surrounding Phase 43 D-14 comment block (`// Phase 43 D-14 — label assembly упрощён до undefined. ...`) — it described a state that no longer exists.

    **Step G — add a new `case 'awaiting-loop-pick':` arm inside `getState()`** (place between `case 'awaiting-snippet-pick'` and `case 'awaiting-snippet-fill'` — picker-variants adjacent). The exhaustiveness default will catch missing cases, but we still need to return the proper state shape:
    ```typescript
    case 'awaiting-loop-pick':
      return {
        status: 'awaiting-loop-pick',
        nodeId: this.currentNodeId ?? '',
        accumulatedText: this.accumulator.current,
        canStepBack: this.undoStack.length > 0,
      };
    ```

    **Step H — widen `getSerializableState` return type, status gate, and `restoreFrom` parameter type** (three sites):

    - `getSerializableState()` return-type annotation (currently line ~373): add `| 'awaiting-loop-pick'` to the `runnerStatus` literal.
    - Status gate (currently lines ~381-387): add the fourth condition:
      ```typescript
      if (
        this.runnerStatus !== 'at-node' &&
        this.runnerStatus !== 'awaiting-snippet-fill' &&
        this.runnerStatus !== 'awaiting-snippet-pick' &&
        this.runnerStatus !== 'awaiting-loop-pick'
      ) {
        return null;
      }
      ```
    - `restoreFrom()` parameter-type `runnerStatus` literal (currently line ~430): add `| 'awaiting-loop-pick'` same way.

    No changes to the deep-copy body of either method — `currentNodeId`, `accumulatedText`, `loopContextStack.map(f => ({ ...f }))` already carry picker state.

    CLAUDE.md DISCIPLINE:
    - Do NOT touch `chooseAnswer`, `enterFreeText`, `stepBack`, `pickSnippet`, `chooseSnippetBranch`, `completeSnippet`, `syncManualEdit`, `resolveSeparator`, `firstNeighbour`, `transitionToComplete`, `transitionToError`, `setGraph`, `start`, or the constructor.
    - Do NOT reset `ProtocolRunner.maxIterations` or its RUN-09 handling (locked decision: RUN-07 removes the per-loop cap only, NOT the auto-advance cycle guard).
    - Do NOT delete the `case 'loop-start': case 'loop-end':` defensive arm in `advanceThrough()` — still needed for TypeScript exhaustiveness (Phase 46 owns legacy-kind removal).
  </action>
  <verify>
    <automated>npx tsc --noEmit --skipLibCheck</automated>
  </verify>
  <done>
    - `grep -c 'awaiting-loop-pick' src/runner/protocol-runner.ts` returns ≥5 (getState arm, getSerializableState return type, status gate, restoreFrom param, case 'loop' halt × 2 — first-entry + re-entry)
    - `grep -c 'chooseLoopBranch' src/runner/protocol-runner.ts` returns ≥1 (method definition)
    - `grep -c 'chooseLoopAction' src/runner/protocol-runner.ts` returns 0 (stub deleted)
    - `grep -c 'loopIterationLabel\|isAtLoopEnd' src/runner/protocol-runner.ts` returns 0
    - `grep -c 'advanceOrReturnToLoop' src/runner/protocol-runner.ts` returns ≥4 (helper declaration + 3 call sites)
    - `grep -c 'previousCursor' src/runner/protocol-runner.ts` returns ≥5 (declaration at top of advanceThrough + 3 threading sites inside cases + usage inside case 'loop' — B2)
    - `grep -c 'B1' src/runner/protocol-runner.ts` returns ≥1 (re-entry guard comment) — optional sanity marker
    - `grep -c "this.maxIterations" src/runner/protocol-runner.ts` returns ≥3 (RUN-09 guard still present: constructor assignment + `if (steps > this.maxIterations)` + error message)
    - `npx tsc --noEmit --skipLibCheck` exits 0
    - Plan 02b tests are expected to pass against this runtime (but are NOT run from this plan — they live in Plan 02b).
  </done>
</task>

</tasks>

<verification>
Full-plan verification:
- `npx tsc --noEmit --skipLibCheck` exits 0
- `npm test -- --run` exits 0 overall (some Plan 02b-specific tests may still be `it.todo` from Plan 01; Plan 02b will replace them with passing assertions). No regression — existing passing tests remain green.
- `npm run build` exits 0
- `grep -c 'this.maxIterations' src/runner/protocol-runner.ts` returns ≥3 — RUN-09 guard intact
- Manual sanity: the RUN-09 iteration-cap test from `protocol-runner.test.ts` — `npx vitest run src/__tests__/runner/protocol-runner.test.ts -t "iteration cap"` exits 0
</verification>

<success_criteria>
- [ ] `AwaitingLoopPickState` interface exists in `runner-state.ts` with `status`, `nodeId`, `accumulatedText`, `canStepBack`
- [ ] `RunnerState` union extended with the new variant
- [ ] `AtNodeState` no longer has `loopIterationLabel` or `isAtLoopEnd`
- [ ] `PersistedSession.runnerStatus` union widened
- [ ] `case 'loop':` in `advanceThrough()` implements B1 re-entry guard — top-of-stack check before new-frame push
- [ ] `previousCursor` variable declared at top of `advanceThrough` and threaded through all three auto-advance cases (B2)
- [ ] `chooseLoopBranch(edgeId)` public method exists, dispatches by edge.label === 'выход'
- [ ] `advanceOrReturnToLoop(next)` helper exists and is called by the three firstNeighbour sites
- [ ] `chooseLoopAction` stub deleted
- [ ] `getState()` has `awaiting-loop-pick` arm and clean `at-node` arm (no deprecated fields)
- [ ] `getSerializableState()` + `restoreFrom()` accept `awaiting-loop-pick`
- [ ] `ProtocolRunner.maxIterations` (RUN-09 guard) untouched — test `describe('iteration cap (RUN-09, D-08)')` still green
</success_criteria>

<output>
After completion, create `.planning/phases/44-unified-loop-runtime/44-02a-SUMMARY.md` documenting:
- Which RUN-0x requirements are satisfied at state-machine level (RUN-01..05 green at runtime, tests in Plan 02b)
- The exact shape of `AwaitingLoopPickState` + `chooseLoopBranch(edgeId)` public API
- B1 re-entry guard placement (top-of-stack check before new-frame push inside `case 'loop'`)
- B2 `previousCursor` threading sites (top of `advanceThrough` + 3 case threading spots + 1 use inside case 'loop')
- Confirmation that RUN-06 (session resume) is type-widened but the round-trip test still belongs to Plan 03
- Confirmation that RUN-07 is NOT touched in this plan (owned by Plan 04)
- Confirmation that `ProtocolRunner.maxIterations` RUN-09 guard survives and its test remains green
- Handoff note for Plan 02b: runtime is live; test rewrites (B3 deletion scope, I1 stack-length assertion, W4 long-body integration) can now run green.
- Handoff note for Plan 03: `AwaitingLoopPickState.nodeId` is available; RunnerView can render picker via `graph.edges.filter(e => e.fromNodeId === state.nodeId)`
</output>
</context>
