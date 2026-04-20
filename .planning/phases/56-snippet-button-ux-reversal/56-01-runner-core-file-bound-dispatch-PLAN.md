---
phase: 56-snippet-button-ux-reversal
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/runner/protocol-runner.ts
autonomous: true
requirements:
  - PICKER-01
  - RUNFIX-02
user_setup: []

must_haves:
  truths:
    - "A Question node with a single outgoing file-bound Snippet edge halts at at-node (no auto-advance)"
    - "ProtocolRunner exposes a public pickFileBoundSnippet method that transitions to awaiting-snippet-fill"
    - "The new method pushes an UndoEntry BEFORE any state mutation (D-15 ordering preserved)"
  artifacts:
    - path: "src/runner/protocol-runner.ts"
      provides: "pickFileBoundSnippet public method + removal of Phase 51 D-13 auto-insert block"
      contains: "pickFileBoundSnippet("
  key_links:
    - from: "src/runner/protocol-runner.ts"
      to: "runnerStatus = 'awaiting-snippet-fill'"
      via: "pickFileBoundSnippet sets snippetId + snippetNodeId + currentNodeId then flips status"
      pattern: "pickFileBoundSnippet"
---

<objective>
Reverse Phase 51 D-13 in `ProtocolRunner` and introduce the click-driven entry point for file-bound Snippet insertion.

Purpose: Single-edge Question → file-bound Snippet must stop auto-advancing; the sole path to `awaiting-snippet-fill` for file-bound snippets becomes the new `pickFileBoundSnippet` method, invoked by RunnerView click handlers in Plan 02.

Output: Modified `src/runner/protocol-runner.ts` with the D-13 block deleted and `pickFileBoundSnippet` added, modelled on `pickSnippet` (:256).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md
@.planning/notes/snippet-node-binding-and-picker.md
@CLAUDE.md
@src/runner/protocol-runner.ts
</context>

<interfaces>
Existing shape (reference — do not reinvent):

```typescript
// src/runner/protocol-runner.ts :305
pickSnippet(snippetId: string): void {
  if (this.runnerStatus !== 'awaiting-snippet-pick') return;
  if (this.currentNodeId === null) return;
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });
  // ...sets snippetId, snippetNodeId, currentNodeId, then runnerStatus = 'awaiting-snippet-fill'
}
```

UndoEntry shape used above is the same one consumed by `stepBack()` (:271); no new entry variant is needed for D-06/D-07.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Remove Phase 51 D-13 auto-insert block from case 'question'</name>
  <files>src/runner/protocol-runner.ts</files>
  <read_first>
    - `.planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md` — D-02 explicitly authorises removal; cite in commit message.
    - `CLAUDE.md` — "Never remove existing code you didn't add" rule. Phase 56 D-02 is the EXPLICIT EXCEPTION; this task IS the reversal mandate.
    - `src/runner/protocol-runner.ts` lines 612-664 (the `case 'question':` block containing the D-13 short-circuit).
  </read_first>
  <behavior>
    - Test 1: When `case 'question'` is reached with a single outgoing file-bound Snippet neighbour, runner now halts at `at-node` (does NOT transition to `awaiting-snippet-fill`).
    - Test 2: `runnerStatus` equals `'at-node'` and `currentNodeId` equals the Question node id after the traversal loop halts on a single-edge file-bound Snippet Question.
    - Test 3: No UndoEntry is pushed at Question halt (push moved to new click path — Task 2).
    - Test 4: Directory-bound single-edge Question still halts at `at-node` (unchanged behaviour — regression guard).
  </behavior>
  <action>
    Delete the entire `if (neighbours !== undefined && neighbours.length === 1)` block inside `case 'question':` (lines ~612-658 — the block opens at the `// Phase 51 D-13/D-14/D-15 (PICKER-01)` comment and closes after the `return;` that follows `this.runnerStatus = 'awaiting-snippet-fill';`).

    After deletion, `case 'question':` body MUST consist of exactly:

    ```typescript
    case 'question': {
      // Default Question behaviour — halt at at-node.
      // Phase 56 D-02: Phase 51 D-13 auto-insert block removed per CONTEXT D-02
      // (explicit exception to CLAUDE.md never-remove rule — this is the phase mandate).
      // File-bound Snippet dispatch now flows through RunnerView click handler →
      // ProtocolRunner.pickFileBoundSnippet (see Task 2 of this plan).
      this.currentNodeId = cursor;
      this.runnerStatus = 'at-node';
      return;
    }
    ```

    Do NOT modify any other case arms. Do NOT touch `pickSnippet`, `chooseSnippetBranch`, `stepBack`, or any UndoEntry handling code.

    Update the existing `runner-snippet-autoinsert-fill.test.ts` expectations is OUT OF SCOPE for this plan (handled by Plan 04); the test file WILL fail against this change — that is expected and is the invariant Plan 04 inverts.
  </action>
  <verify>
    <automated>node -e "const s=require('fs').readFileSync('src/runner/protocol-runner.ts','utf8'); if(s.includes('Phase 51 D-13/D-14/D-15')) process.exit(1); if(!s.includes('Phase 56 D-02')) process.exit(2); process.exit(0);"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Phase 51 D-13/D-14/D-15" src/runner/protocol-runner.ts` returns 0
    - `grep -c "radiprotocol_snippetPath" src/runner/protocol-runner.ts` returns 0 (the only runtime reference to this field was inside the deleted block)
    - `grep -c "Phase 56 D-02" src/runner/protocol-runner.ts` returns 1 (the replacement comment)
    - `case 'question'` in the file contains exactly `this.currentNodeId = cursor;` followed by `this.runnerStatus = 'at-node';` followed by `return;`
    - `npx tsc --noEmit` exits 0 (no compile errors introduced)
  </acceptance_criteria>
  <done>
    Phase 51 D-13 short-circuit is fully removed from `case 'question'`; runner halts at at-node for all Question nodes regardless of neighbour shape; file compiles cleanly.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add pickFileBoundSnippet public method</name>
  <files>src/runner/protocol-runner.ts</files>
  <read_first>
    - `src/runner/protocol-runner.ts` lines 256-320 — `pickSnippet` canonical shape (undo-before-mutate, field assignments, status flip).
    - `src/runner/protocol-runner.ts` lines 271-295 — `stepBack` to confirm the UndoEntry shape used.
    - `.planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md` D-03 for the exact semantics required.
  </read_first>
  <behavior>
    - Test 1: Calling `pickFileBoundSnippet(qid, sid, '/path/x.md')` from `at-node` + `currentNodeId === qid` sets `snippetId='/path/x.md'`, `snippetNodeId=sid`, `currentNodeId=sid`, `runnerStatus='awaiting-snippet-fill'`.
    - Test 2: An UndoEntry is pushed BEFORE any mutation — verify by snapshotting `undoStack.length` pre-call and asserting length+1 post-call, with the entry's `nodeId===qid` and `textSnapshot` equal to the pre-call accumulator snapshot.
    - Test 3: Calling from `runnerStatus !== 'at-node'` is a no-op (no mutation, no undo push).
    - Test 4: Calling with a mismatched `questionNodeId !== currentNodeId` is a no-op.
    - Test 5: `stepBack()` immediately after `pickFileBoundSnippet` restores `currentNodeId === qid`, `runnerStatus === 'at-node'`, accumulator text equal to pre-pick snapshot (reuses existing stepBack path — no new branch).
  </behavior>
  <action>
    Add the following public method to `ProtocolRunner`, placed immediately AFTER the existing `pickSnippet` method (around line ~335, after `pickSnippet`'s closing brace):

    ```typescript
    /**
     * Phase 56 D-03 (PICKER-01 reversal) — click-driven entry point for file-bound
     * Snippet insertion. Called by RunnerView sibling-button click handler when the
     * clicked Snippet node is file-bound (radiprotocol_snippetPath non-empty,
     * radiprotocol_subfolderPath empty/absent). Mirrors pickSnippet's undo-before-mutate
     * pattern but is triggered from a user click at at-node instead of from
     * awaiting-snippet-pick.
     *
     * Semantics:
     *   1. Guard: runnerStatus must be 'at-node' and currentNodeId must equal questionNodeId.
     *   2. Push UndoEntry keyed on the Question node (D-15 undo-before-mutate).
     *   3. Set snippetId = snippetPath, snippetNodeId = snippetNodeId, currentNodeId = snippetNodeId.
     *   4. Flip runnerStatus to 'awaiting-snippet-fill' — existing arm in RunnerView
     *      dispatches .md insert / .json fill-in modal / .json no-placeholder insert.
     *
     * stepBack() from awaiting-snippet-fill restores the Question with pre-insertion
     * accumulator via the existing stepBack path (no new branch — reuses UndoEntry shape).
     */
    pickFileBoundSnippet(
      questionNodeId: string,
      snippetNodeId: string,
      snippetPath: string,
    ): void {
      if (this.runnerStatus !== 'at-node') return;
      if (this.currentNodeId !== questionNodeId) return;

      // D-15 undo-before-mutate — identical UndoEntry shape to pickSnippet (:305).
      this.undoStack.push({
        nodeId: questionNodeId,
        textSnapshot: this.accumulator.snapshot(),
        loopContextStack: [...this.loopContextStack],
      });

      this.snippetId = snippetPath;
      this.snippetNodeId = snippetNodeId;
      this.currentNodeId = snippetNodeId;
      this.runnerStatus = 'awaiting-snippet-fill';
    }
    ```

    Do NOT modify `pickSnippet`, `chooseSnippetBranch`, `stepBack`, `undoStack` entry shape, or the `UndoEntry` type. Do NOT introduce a new runnerStatus enum value. Do NOT add a new branch to `stepBack` — the existing non-`returnToBranchList` path handles the restore correctly.

    Create a new test file `src/__tests__/runner/protocol-runner-pick-file-bound-snippet.test.ts` with unit tests covering Behavior cases 1-5 above (D-14 Claude's discretion: new dedicated test file chosen for isolation).
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/runner/protocol-runner-pick-file-bound-snippet.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "pickFileBoundSnippet(" src/runner/protocol-runner.ts` returns ≥ 2 (declaration + JSDoc reference or usage)
    - `grep -c "Phase 56 D-03" src/runner/protocol-runner.ts` returns 1
    - Method signature matches `pickFileBoundSnippet(questionNodeId: string, snippetNodeId: string, snippetPath: string): void` exactly
    - `src/__tests__/runner/protocol-runner-pick-file-bound-snippet.test.ts` exists and covers Behavior cases 1-5
    - `npx vitest run src/__tests__/runner/protocol-runner-pick-file-bound-snippet.test.ts` exits 0
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    `pickFileBoundSnippet` exists with the locked signature, undo-before-mutate ordering matches `pickSnippet`, 5 unit tests pass, no other runner methods modified.
  </done>
</task>

</tasks>

<verification>
- Task 1: D-13 auto-insert block fully removed; `case 'question'` halts unconditionally.
- Task 2: `pickFileBoundSnippet` present, 5 unit tests green, stepBack semantics preserved by construction.
- Combined: `npx tsc --noEmit` exits 0; new test file passes; existing `runner-snippet-autoinsert-fill.test.ts` is expected to fail (Plan 04 inverts its expectations — not a regression).
</verification>

<success_criteria>
SC 1 (partial — runner side), SC 2 (partial — runner API), SC 4 (undo semantics preserved by shared UndoEntry shape), SC 5 (RUNFIX-02 not touched here — enforced in Plan 02).
</success_criteria>

<output>
After completion, create `.planning/phases/56-snippet-button-ux-reversal/56-01-SUMMARY.md`.
</output>
