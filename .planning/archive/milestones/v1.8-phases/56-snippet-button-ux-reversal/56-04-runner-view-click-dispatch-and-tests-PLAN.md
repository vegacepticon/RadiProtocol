---
phase: 56-snippet-button-ux-reversal
plan: 04
type: execute
wave: 2
depends_on:
  - 01
files_modified:
  - src/views/runner-view.ts
  - src/__tests__/views/runner-snippet-autoinsert-fill.test.ts
  - src/__tests__/views/runner-snippet-sibling-button.test.ts
  - src/__tests__/views/runner-snippet-picker.test.ts
autonomous: true
requirements:
  - PICKER-01
  - RUNFIX-02

must_haves:
  truths:
    - "A Question with a sole outgoing file-bound Snippet now renders one 📄 click-button, not auto-advance"
    - "Clicking a file-bound Snippet button (single-edge or sibling) calls runner.pickFileBoundSnippet() directly — never chooseSnippetBranch"
    - "Directory-bound Snippet buttons continue to call chooseSnippetBranch → picker flow unchanged"
    - "capturePendingTextareaScroll() remains the FIRST line of every click handler touched in this plan (RUNFIX-02)"
  artifacts:
    - path: "src/views/runner-view.ts"
      provides: "binding-kind branching inside snippet-sibling-button click handler"
      contains: "pickFileBoundSnippet"
    - path: "src/__tests__/views/runner-snippet-autoinsert-fill.test.ts"
      provides: "inverted expectations — single-edge file-bound now renders button, not auto-advance"
      contains: "renders a single"
    - path: "src/__tests__/views/runner-snippet-sibling-button.test.ts"
      provides: "direct-dispatch assertions — file-bound click → pickFileBoundSnippet, dir-bound click → chooseSnippetBranch"
      contains: "pickFileBoundSnippet"
  key_links:
    - from: "rp-snippet-branch-btn click handler"
      to: "runner.pickFileBoundSnippet OR runner.chooseSnippetBranch"
      via: "isFileBound branch"
      pattern: "isFileBound"
---

<objective>
Rewire the RunnerView snippet-sibling-button click handler to branch on binding kind and dispatch file-bound snippets directly via `pickFileBoundSnippet` (from Plan 01), while leaving directory-bound dispatch on its existing `chooseSnippetBranch` path. Update the three affected test files to reflect the new contract.

Purpose: Close SC 1 (single-edge renders button), SC 2 (direct-dispatch click), SC 3 (directory-bound preserved), SC 5 (RUNFIX-02 preserved), and SC 8 (tests green, with expectations inverted on autoinsert-fill).

Output: Modified `src/views/runner-view.ts` click handler + three updated test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md
@.planning/phases/56-snippet-button-ux-reversal/56-01-runner-core-file-bound-dispatch-PLAN.md
@CLAUDE.md
@src/views/runner-view.ts
@src/runner/protocol-runner.ts
</context>

<interfaces>
Plan 01 defined:

```typescript
// src/runner/protocol-runner.ts
pickFileBoundSnippet(
  questionNodeId: string,
  snippetNodeId: string,
  snippetPath: string,
): void;
```

Current RunnerView render already computes `isFileBound` correctly (lines 532-534) for caption selection — reuse the same predicate for dispatch branching.

Existing handler shape (lines 524-566, to be edited):

```typescript
// For each snippetNode in snippetNeighbors:
const isFileBound =
  typeof snippetNode.radiprotocol_snippetPath === 'string' &&
  snippetNode.radiprotocol_snippetPath !== '';
// ...label computation...
const btn = snippetList.createEl('button', { cls: 'rp-snippet-branch-btn', text: label });
this.registerDomEvent(btn, 'click', () => {
  this.capturePendingTextareaScroll();                    // RUNFIX-02 — stays FIRST
  this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
  this.runner.chooseSnippetBranch(snippetNode.id);        // ← dispatch target branches on isFileBound
  void this.autoSaveSession();
  void this.renderAsync();
});
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Branch snippet-sibling-button dispatch on isFileBound</name>
  <files>src/views/runner-view.ts</files>
  <read_first>
    - `src/views/runner-view.ts` lines 524-566 — snippet-branch-list render + click handler (the only site that changes).
    - `src/views/runner-view.ts` lines 492-498 — answer-btn click handler (canonical 5-step prologue reference).
    - `.planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md` D-04.
    - `src/runner/protocol-runner.ts` — confirm `pickFileBoundSnippet` signature post-Plan-01.
  </read_first>
  <behavior>
    - Test 1: For a Question with single outgoing file-bound Snippet, RunnerView renders ONE `.rp-snippet-branch-btn` (not auto-advanced). Caption uses 📄 + Phase 51 D-16 three-step fallback (unchanged).
    - Test 2: Clicking that single button calls `runner.pickFileBoundSnippet(questionId, snippetId, snippetPath)` and does NOT call `runner.chooseSnippetBranch`.
    - Test 3: For a Question with a sibling pair (one file-bound + one directory-bound), file-bound click calls `pickFileBoundSnippet`, directory-bound click calls `chooseSnippetBranch` (unchanged path).
    - Test 4: For a Question with only directory-bound Snippet neighbours, all clicks call `chooseSnippetBranch` — Phase 51 behaviour preserved.
    - Test 5: `capturePendingTextareaScroll` is the FIRST statement of both dispatch branches (verified via spy call-order or by asserting it's invoked).
    - Test 6: `syncManualEdit`, `autoSaveSession`, `renderAsync` are each called exactly once per click on both branches (5-step prologue parity).
  </behavior>
  <action>
    Rewrite the existing `this.registerDomEvent(btn, 'click', ...)` block inside the `for (const snippetNode of snippetNeighbors)` loop (currently line 558) to:

    ```typescript
    this.registerDomEvent(btn, 'click', () => {
      this.capturePendingTextareaScroll();  // RUNFIX-02 — MUST be first (SC 5)
      this.runner.syncManualEdit(this.previewTextarea?.value ?? '');

      if (isFileBound) {
        // Phase 56 D-04 (PICKER-01 reversal): file-bound Snippet → direct dispatch,
        // bypassing chooseSnippetBranch → awaiting-snippet-pick → picker. Reverses
        // Phase 51 D-16 click routing. snippetPath is non-empty because isFileBound
        // gate above checked exactly that (line ~532-534).
        const snippetPath = snippetNode.radiprotocol_snippetPath as string;
        this.runner.pickFileBoundSnippet(state.currentNodeId, snippetNode.id, snippetPath);
      } else {
        // Directory-bound — Phase 51 path preserved (SC 3).
        this.runner.chooseSnippetBranch(snippetNode.id);
      }

      void this.autoSaveSession();
      void this.renderAsync();
    });
    ```

    Do NOT modify the render-side caption computation (lines 528-553) — the existing 📄/📁 + three-step fallback is already correct per Phase 51 D-16 (SC 1 glyph + fallback preserved).

    Do NOT modify the answer-btn handler (lines 492-498), the skip-btn handler (lines 515-522), or any other RunnerView click handler in this task. Touching those is out of scope and violates CLAUDE.md never-remove.

    Cite Phase 56 D-02/D-04 in the commit message.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/views/runner-snippet-sibling-button.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "pickFileBoundSnippet" src/views/runner-view.ts` returns ≥ 1
    - `grep -c "Phase 56 D-04" src/views/runner-view.ts` returns 1
    - `grep -c "chooseSnippetBranch" src/views/runner-view.ts` returns ≥ 1 (still present for directory-bound branch)
    - `grep -c "capturePendingTextareaScroll" src/views/runner-view.ts` returns the same count as before this task (no new handlers added, existing handlers untouched count-wise; new click body keeps it as first line)
    - Inside the edited block, `capturePendingTextareaScroll` appears on the line IMMEDIATELY after the `() => {` of the click callback (grep-verifiable by reading the block)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Snippet-sibling-button click dispatches to `pickFileBoundSnippet` for file-bound, `chooseSnippetBranch` for directory-bound, with RUNFIX-02 scroll capture as the first statement of both paths.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update runner-snippet-sibling-button.test.ts — direct-dispatch assertions</name>
  <files>src/__tests__/views/runner-snippet-sibling-button.test.ts</files>
  <read_first>
    - `src/__tests__/views/runner-snippet-sibling-button.test.ts` — full file; identify existing test cases and helper setup.
    - `.planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md` D-13 (test strategy).
  </read_first>
  <behavior>
    - Add tests asserting: file-bound single sibling click → `runner.pickFileBoundSnippet` called once with `(questionId, snippetId, snippetPath)`; `runner.chooseSnippetBranch` NOT called.
    - Add test: mixed file-bound + directory-bound siblings — file-bound btn click fires `pickFileBoundSnippet`; directory-bound btn click fires `chooseSnippetBranch`.
    - Add test: file-bound `.md` click → after `pickFileBoundSnippet` runtime lands in `awaiting-snippet-fill` (via Plan 01 semantics); .json-with-placeholders → same landing (modal opens from existing awaiting-snippet-fill arm); .json-no-placeholders → same landing. (Executor may use existing test helpers; assertion depth is the presence of the direct-dispatch call, not re-testing the awaiting-snippet-fill arm already covered by Phase 30/35 tests.)
  </behavior>
  <action>
    Extend this file with new `test('direct dispatch — file-bound sibling click calls pickFileBoundSnippet', ...)` and `test('mixed siblings — file-bound vs directory-bound dispatch split', ...)` and `test('file-bound .md single sibling click → awaiting-snippet-fill', ...)` cases. Use vi.spyOn or a test-double for `ProtocolRunner` methods as the file already does.

    Do NOT delete existing test cases — directory-bound coverage must remain. If any existing test was written assuming file-bound click routed through `chooseSnippetBranch`, update that specific assertion to `pickFileBoundSnippet` (cite D-04 in a comment); do NOT rewrite the test case wholesale.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/views/runner-snippet-sibling-button.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "pickFileBoundSnippet" src/__tests__/views/runner-snippet-sibling-button.test.ts` returns ≥ 3
    - Test file has at least 3 more `test(` or `it(` blocks than pre-edit
    - `npx vitest run src/__tests__/views/runner-snippet-sibling-button.test.ts` exits 0
  </acceptance_criteria>
  <done>
    Sibling-button test file covers direct-dispatch for file-bound + preserved chooseSnippetBranch for directory-bound; all green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Invert runner-snippet-autoinsert-fill.test.ts expectations</name>
  <files>src/__tests__/views/runner-snippet-autoinsert-fill.test.ts</files>
  <read_first>
    - `src/__tests__/views/runner-snippet-autoinsert-fill.test.ts` — full file; every existing case asserts Phase 51 D-13 auto-advance on single-edge file-bound.
    - `.planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md` D-02 and D-13.
  </read_first>
  <behavior>
    - Existing tests must be INVERTED, not deleted: single-edge file-bound Question now halts at at-node with one 📄 button rendered; clicking that button produces the awaiting-snippet-fill landing previously triggered automatically.
    - Post-inversion case counts stay the same (one-for-one rewrite) unless a test explicitly asserted "no button rendered" — in which case invert to "one button rendered and clickable".
  </behavior>
  <action>
    For each existing test case that asserts Phase 51 D-13 auto-advance (e.g. "single-edge file-bound .md auto-inserts"), rewrite the body as follows:

    - Replace the arrange step that advances the runner past the Question and expects `runnerStatus === 'awaiting-snippet-fill'` on first render with: arrange step advances to the Question; first render produces `.rp-snippet-branch-btn` × 1; simulate click; THEN assert `runnerStatus === 'awaiting-snippet-fill'` + downstream (.md insert, .json modal open, .json no-placeholder insert).

    - Rename test descriptions to replace "auto-inserts" / "auto-advances" with "renders single button that, when clicked, inserts" (or similar accurate wording).

    - Add an explanatory comment at top of file:

    ```typescript
    // Phase 56 D-02 (PICKER-01 reversal): Phase 51 D-13 auto-insert is REMOVED.
    // All single-edge file-bound Question → Snippet paths now render a button
    // and dispatch via ProtocolRunner.pickFileBoundSnippet on click.
    // See .planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md
    ```

    Do NOT delete test cases. Do NOT remove the file. If any test asserted a negative (e.g. "directory-bound single-edge does NOT auto-insert"), keep the assertion — it remains true (directory-bound never auto-inserted).
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/views/runner-snippet-autoinsert-fill.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Phase 56 D-02" src/__tests__/views/runner-snippet-autoinsert-fill.test.ts` returns 1
    - `grep -c "pickFileBoundSnippet\\|rp-snippet-branch-btn" src/__tests__/views/runner-snippet-autoinsert-fill.test.ts` returns ≥ 1 per existing test case
    - Total `test(` / `it(` blocks in the file is unchanged (one-for-one inversion, not removal)
    - `npx vitest run src/__tests__/views/runner-snippet-autoinsert-fill.test.ts` exits 0
  </acceptance_criteria>
  <done>
    All Phase 51 D-13 auto-advance expectations inverted to click-then-insert; file green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Add directory-bound regression cases to runner-snippet-picker.test.ts</name>
  <files>src/__tests__/views/runner-snippet-picker.test.ts</files>
  <read_first>
    - `src/__tests__/views/runner-snippet-picker.test.ts` — full file.
    - `.planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md` D-13 (regression coverage for directory-bound).
  </read_first>
  <behavior>
    - Add regression tests: directory-bound single-edge Question halts at at-node → renders one 📁 button → click calls `chooseSnippetBranch` → transitions to `awaiting-snippet-pick` → SnippetTreePicker (file-only mode) mounts.
    - Add regression test: sibling directory-bound Snippet click ALSO routes through `chooseSnippetBranch` even when a file-bound sibling exists — branching is per-click, not per-Question.
  </behavior>
  <action>
    Append 2 new test cases to the file exercising the above behaviours. Do NOT modify existing tests. Use existing fixtures or construct minimal inline graphs consistent with the file's style.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/views/runner-snippet-picker.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - Test file grows by ≥ 2 new `test(` / `it(` blocks
    - `grep -c "chooseSnippetBranch" src/__tests__/views/runner-snippet-picker.test.ts` returns ≥ (pre-edit count + 2)
    - `npx vitest run src/__tests__/views/runner-snippet-picker.test.ts` exits 0
  </acceptance_criteria>
  <done>
    Directory-bound dispatch path regression-guarded; SC 3 covered.
  </done>
</task>

<task type="auto">
  <name>Task 5: Full-suite gate — build + all tests green</name>
  <files></files>
  <read_first>
    - `.planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md` — confirm no SC left uncovered.
  </read_first>
  <action>
    Run:
      1. `npm run build` — must exit 0.
      2. `npm test` — full vitest run; all tests must be green.

    If any test outside Plans 01-04's touched files fails, STOP and escalate — do NOT patch unrelated files.

    Produce a one-line tally in the SUMMARY of the phase ("Tests: X passed / Y skipped / 0 failed").
  </action>
  <verify>
    <automated>npm run build &amp;&amp; npm test</automated>
  </verify>
  <acceptance_criteria>
    - `npm run build` exits 0
    - `npm test` exits 0 (full suite green)
    - `styles.css` contains both `rp-snippet-editor-unsaved-dot` (Plan 02) and `rp-stp-select-folder-btn.is-committed` (Plan 03)
  </acceptance_criteria>
  <done>
    Full phase suite green; ready for human UAT.
  </done>
</task>

</tasks>

<verification>
- Task 1: Click dispatch branches correctly; TS compiles.
- Tasks 2-4: Each test file passes independently.
- Task 5: Full `npm test` + `npm run build` gate green.
</verification>

<success_criteria>
SC 1 (single-button render — verified by Task 3 inversion), SC 2 (direct-dispatch — Task 2), SC 3 (directory-bound preserved — Task 4), SC 4 (undo preserved by construction from Plan 01 UndoEntry shape), SC 5 (RUNFIX-02 capture is first — Task 1 acceptance criterion), SC 8 (full suite green — Task 5).
</success_criteria>

<output>
After completion, create `.planning/phases/56-snippet-button-ux-reversal/56-04-SUMMARY.md`.
</output>
