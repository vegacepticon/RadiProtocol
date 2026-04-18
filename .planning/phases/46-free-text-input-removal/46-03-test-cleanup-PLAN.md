---
phase: 46-free-text-input-removal
plan: 03
type: execute
wave: 2
depends_on: [46-01]
files_modified:
  - src/__tests__/runner/protocol-runner.test.ts
  - src/__tests__/node-picker-modal.test.ts
autonomous: true
requirements: [CLEAN-04]
tags: [removal, tests, cleanup]

must_haves:
  truths:
    - "No vitest `describe`, `it`, or `it.skip` block in src/__tests__/ references 'free-text-input', 'FreeTextInputNode', or 'enterFreeText' after this plan"
    - "`npm test -- --run` exits 0 with 0 failures, 0 orphaned free-text-input tests skipped, and a test count equal to the pre-Phase-46 baseline minus the deleted free-text-input RUN-04 scenarios plus the 3 new CLEAN-02 tests added by Plan 46-01"
    - "The Plan 46-01 CLEAN-02 migration test file (`src/__tests__/free-text-input-migration.test.ts`) remains the ONLY test file that references 'free-text-input' — and only in its Russian rejection assertions"
    - "`node-picker-modal.test.ts` no longer imports `FreeTextInputNode` or uses the `freeText()` factory; the D-06 exclusion test is either rewritten to drop the free-text-input assertion OR entirely dropped from its list"
    - "Test 6 at protocol-runner.test.ts:747 ('chooseSnippetBranch when current node is not a question') is DELETED because after CLEAN-01 there is no longer a non-question kind that halts at 'at-node' status — the test's premise is moot"
  artifacts:
    - path: "src/__tests__/runner/protocol-runner.test.ts"
      provides: "runner tests without any free-text-input scenarios — describe('enterFreeText() — free-text input node (RUN-04)') block deleted; D-02 separator test deleted; Test 6 snippet-branch-not-a-question test deleted"
      contains_not: "free-text-input\\|FreeTextInputNode\\|enterFreeText"
    - path: "src/__tests__/node-picker-modal.test.ts"
      provides: "picker unit tests without free-text-input references — FreeTextInputNode import removed, freeText factory removed, D-06 exclusion test rewritten OR pruned"
      contains_not: "FreeTextInputNode\\|free-text-input"
  key_links:
    - from: "Plan 46-01 type deletion"
      to: "these test files"
      via: "TypeScript errors on `kind: 'free-text-input'` literals and `FreeTextInputNode` import"
      pattern: "kind: 'free-text-input'"
    - from: "CLEAN-02 migration test"
      to: "free-text-input.canvas fixture"
      via: "Plan 46-01 already created the replacement test; this plan PRESERVES that test and only removes the now-dead RUN-04 happy-path tests"
      pattern: "free-text-input-migration.test.ts"
---

<objective>
Close CLEAN-04 by removing every remaining test-layer reference to `free-text-input` across the runner-test and picker-test files. These tests break the TS compile after Plan 46-01 (they reference deleted types); this plan deletes them (where the premise is dead) or rewrites them (where the premise survives the type deletion).

Purpose: Reach final green state for Phase 46 — `npm test -- --run` green, `npx tsc --noEmit --skipLibCheck` green, no orphaned `it.skip` blocks, no stale assertions on a kind that no longer exists.

Output:
- `src/__tests__/runner/protocol-runner.test.ts` with 3 deletions:
  1. The entire `describe('enterFreeText() — free-text input node (RUN-04)')` block (lines 103-144, ~42 lines, 2 tests)
  2. The `it('D-02: enterFreeText separator precedes entire prefix+text+suffix chunk', ...)` inside the separator describe block (lines 411-436, ~26 lines)
  3. The entire `it('Test 6: chooseSnippetBranch when current node is not a question transitions to error', ...)` at lines 747-766 (~20 lines) — premise dead after CLEAN-01
- `src/__tests__/node-picker-modal.test.ts` with 3 edits:
  1. Drop `FreeTextInputNode, LoopStartNode, LoopEndNode` imports that are no longer used after edits below — actually `LoopStartNode` / `LoopEndNode` REMAIN (Phase 43 `@deprecated` union members still exist), only `FreeTextInputNode` is deleted
  2. Delete the `freeText()` factory function (lines 57-59)
  3. Rewrite the D-06 exclusion test (lines 82-100) to drop the `freeText('f1', 'prompt')` node from the graph and the `expect(opts.find(o => (o.kind as string) === 'free-text-input')).toBeUndefined()` assertion — keep the test but narrow its scope to answer/start/loop-start/loop-end exclusion
- Full test suite green
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@CLAUDE.md
@.planning/phases/46-free-text-input-removal/46-01-graph-model-parser-validator-PLAN.md

<interfaces>
<!-- Test contracts to preserve or delete. Extracted from codebase. -->

From src/__tests__/runner/protocol-runner.test.ts:

**Deletion site 1 — lines 103-144** (`describe('enterFreeText() — free-text input node (RUN-04)')` + 2 inner tests):
```typescript
  describe('enterFreeText() — free-text input node (RUN-04)', () => {
    it('wraps user text with prefix/suffix and appends to accumulatedText', () => {
      // uses loadGraph('free-text.canvas') + runner.enterFreeText('enlarged spleen')
      // ... 17 lines
    });
    it('handles free-text node with no prefix/suffix — appends raw text', () => {
      // inline graph with kind: 'free-text-input'
      // ... 22 lines
    });
  });
```
Entire `describe` block + closing brace + trailing blank line — DELETE. Preserve the preceding `describe('chooseAnswer()'...)` block and the following `describe('stepBack()'...)` block byte-identically.

**Deletion site 2 — lines 411-436** (`it('D-02: enterFreeText separator precedes entire prefix+text+suffix chunk'...`):
```typescript
    it('D-02: enterFreeText separator precedes entire prefix+text+suffix chunk', () => {
      // Start with a text-block to fill the buffer, then a free-text node
      // inline graph with kind: 'free-text-input' as const
      // runner.enterFreeText('X')
      // ... ~26 lines
    });
```
This `it` block sits INSIDE a larger describe (separator tests). Delete ONLY this one `it` + its trailing blank line. Preserve the surrounding tests (D-01 above, D-03 below) byte-identically.

**Deletion site 3 — lines 747-766** (Test 6 of chooseSnippetBranch):
```typescript
    it('Test 6: chooseSnippetBranch when current node is not a question transitions to error', () => {
      // Inline graph: start → free-text-input (halts at-node but not question)
      // kind: 'free-text-input'
      // ... 20 lines
    });
```
This test's premise is: "some at-node status that is not a question transitions to error when chooseSnippetBranch is called." After CLEAN-01, `free-text-input` is gone, and the only RPNodeKind that transitions to `at-node` status is `question`. There is no replacement kind that fits the premise. Therefore the test is **deleted** (not rewritten). Preserve Test 5 above and Test 7 below byte-identically.

**Preserve (do not touch):**
- `loadGraph` helper at the top of the file — still used by every other test
- `describe('chooseAnswer()', ...)` block — no free-text-input references
- `describe('stepBack()', ...)` block — no free-text-input references
- `describe('separator (SEP-01..04)', ...)` block — keep D-01, D-03, D-04, etc. tests; only D-02 is deleted
- `describe('chooseSnippetBranch (SNIP-09, ...)'...)` block — keep Tests 1-5 and Test 7+; only Test 6 is deleted
- All other describe blocks (syncManualEdit, loop runtime, snippet-fill, RUN-09 cap, etc.)

From src/__tests__/node-picker-modal.test.ts:

**Edit site 1 — line 17** (imports from graph-model):
```typescript
import type {
  ProtocolGraph,
  RPNode,
  QuestionNode,
  TextBlockNode,
  SnippetNode,
  LoopNode,
  AnswerNode,
  StartNode,
  FreeTextInputNode,           // ← DELETE this import
  LoopStartNode,
  LoopEndNode,
} from '../graph/graph-model';
```
Delete ONLY `FreeTextInputNode,` — preserve `LoopStartNode` and `LoopEndNode` imports because Phase 43 kept those types in the union (Phase 43 D-CL-05 variant b, STATE.md line 131-132) and the existing `loopStart()` / `loopEnd()` factories still use them in the D-06 exclusion test.

**Edit site 2 — lines 57-59** (freeText factory):
```typescript
function freeText(id: string, promptLabel: string): FreeTextInputNode {
  return { ...baseNodeProps, id, kind: 'free-text-input', promptLabel };
}
```
Delete the entire function + its trailing blank line (3 lines).

**Edit site 3 — lines 82-100** (D-06 exclusion test):
Current:
```typescript
  it('excludes answer, start, free-text-input, loop-start, loop-end (D-06 conscious deviation from ROADMAP SC #3)', () => {
    const g = makeGraph([
      question('q1', 'Q'),
      answer('a1', 'A'),
      start('s1'),
      freeText('f1', 'prompt'),              // ← DELETE this line
      loopStart('ls1', 'inner', 'выход'),
      loopEnd('le1', 'ls1'),
    ]);
    const opts = buildNodeOptions(g);
    expect(opts).toHaveLength(1);
    expect(opts[0]?.kind).toBe('question');
    // Defensive — none of the non-startable kinds appeared
    expect(opts.find(o => (o.kind as string) === 'answer')).toBeUndefined();
    expect(opts.find(o => (o.kind as string) === 'start')).toBeUndefined();
    expect(opts.find(o => (o.kind as string) === 'free-text-input')).toBeUndefined();   // ← DELETE this line
    expect(opts.find(o => (o.kind as string) === 'loop-start')).toBeUndefined();
    expect(opts.find(o => (o.kind as string) === 'loop-end')).toBeUndefined();
  });
```
Rewrite with:
- `it()` name: `'excludes answer, start, loop-start, loop-end (D-06 conscious deviation from ROADMAP SC #3)'` (drops `free-text-input` from the name)
- graph body: drop the `freeText('f1', 'prompt'),` line
- assertions: drop the `expect(opts.find(o => (o.kind as string) === 'free-text-input')).toBeUndefined();` line
- comment `// Phase 46 CLEAN-04: free-text-input assertion removed — kind deleted from RPNodeKind` added above the remaining defensive assertions for historical clarity

**Preserve (do not touch):**
- All other `it()` blocks in both `describe` groups (D-07 fallback test, D-08 sort tests, legacy-loops test, empty graph test, KIND_LABELS tests)
- `question()`, `textBlock()`, `snippet()`, `loop()`, `answer()`, `start()`, `loopStart()`, `loopEnd()` factory functions
- `makeGraph` helper
- `baseNodeProps` constant
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete free-text-input test scenarios in protocol-runner.test.ts and rewrite picker exclusion test in node-picker-modal.test.ts</name>
  <files>
    - src/__tests__/runner/protocol-runner.test.ts
    - src/__tests__/node-picker-modal.test.ts
  </files>
  <read_first>
    - src/__tests__/runner/protocol-runner.test.ts (lines 100-150 for describe block 1, lines 400-440 for D-02 test, lines 740-770 for Test 6 — CRITICAL to read full line ranges before editing since line numbers shift with each delete)
    - src/__tests__/node-picker-modal.test.ts (full file, ~171 lines)
    - .planning/phases/46-free-text-input-removal/46-01-graph-model-parser-validator-PLAN.md (confirm D-46-01-C: free-text.canvas fixture is repurposed to CLEAN-02 rejection, NOT deleted — so the fixture still exists on disk after Plan 46-01)
    - CLAUDE.md never-delete-others-code rule — all three deletions in protocol-runner.test.ts are within-scope (all directly test `free-text-input` which is removed in Phase 46); all surrounding tests preserved byte-identical
  </read_first>
  <action>
    Execute deletions in REVERSE LINE ORDER for `protocol-runner.test.ts` to avoid line-number drift:

    **Protocol-runner.test.ts — Step 1 (delete Test 6 at lines 747-766 FIRST, highest line number):**
    Delete the entire `it('Test 6: chooseSnippetBranch when current node is not a question transitions to error', () => { ... });` block (~20 lines). Preserve the preceding `it('Test 5: ...')` and the following `it('Test 7 (D-04): ...')` byte-identically. After this delete, the `describe('chooseSnippetBranch (SNIP-09, ...)'...)` block has N-1 tests.

    **Protocol-runner.test.ts — Step 2 (delete D-02 separator test at lines 411-436):**
    Delete the entire `it('D-02: enterFreeText separator precedes entire prefix+text+suffix chunk', () => { ... });` block (~26 lines). Preserve D-01 above (SEP-04 answer separator override) and D-03 below (completeSnippet separator) byte-identically. The describe block name is unchanged; only one inner `it` is removed.

    **Protocol-runner.test.ts — Step 3 (delete describe block at lines 103-144):**
    Delete the entire `describe('enterFreeText() — free-text input node (RUN-04)', () => { ... });` block including the two inner `it` tests (~42 lines). Preserve the preceding `describe('chooseAnswer() - preset-text answer nodes (RUN-03)', ...)` block and the following `describe('stepBack() — undo last user action (RUN-06, RUN-07)', ...)` block byte-identically.

    Run:
    ```bash
    npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | grep "protocol-runner.test.ts" | wc -l
    ```
    Must return 0 (all references to deleted types removed from this test file).

    **node-picker-modal.test.ts — Step 4 (3 edits to this file):**
    - Edit 1: Delete `FreeTextInputNode,` from the import list at line 17. Preserve all other imports including `LoopStartNode` and `LoopEndNode` (they are Phase 43 `@deprecated` kinds still in `RPNodeKind` and still used by `loopStart()` / `loopEnd()` factories).
    - Edit 2: Delete the `freeText()` factory function (lines 57-59 — three lines, the function body is one line plus signature plus closing brace). Preserve surrounding `start()` and `loopStart()` factories byte-identically.
    - Edit 3: Rewrite the D-06 exclusion test (lines 82-100 pre-edit). Exact target text after edit:
      ```typescript
        it('excludes answer, start, loop-start, loop-end (D-06 conscious deviation from ROADMAP SC #3)', () => {
          // Phase 46 CLEAN-04: free-text-input assertion removed — kind deleted from RPNodeKind (46-01 D-46-01-A).
          const g = makeGraph([
            question('q1', 'Q'),
            answer('a1', 'A'),
            start('s1'),
            loopStart('ls1', 'inner', 'выход'),
            loopEnd('le1', 'ls1'),
          ]);
          const opts = buildNodeOptions(g);
          expect(opts).toHaveLength(1);
          expect(opts[0]?.kind).toBe('question');
          // Defensive — none of the non-startable kinds appeared
          expect(opts.find(o => (o.kind as string) === 'answer')).toBeUndefined();
          expect(opts.find(o => (o.kind as string) === 'start')).toBeUndefined();
          expect(opts.find(o => (o.kind as string) === 'loop-start')).toBeUndefined();
          expect(opts.find(o => (o.kind as string) === 'loop-end')).toBeUndefined();
        });
      ```
      Preserve the preceding `it('returns options for all 4 startable kinds ...')` and the following `it('label falls back to id ...')` byte-identically.

    Run:
    ```bash
    npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | wc -l
    ```
    Must return 0 across the entire codebase (production + tests).

    Run full suite:
    ```bash
    npm test -- --run
    ```
    Must exit 0 with 0 failures and 0 additional `.skip` entries beyond the known Phase 44 skip (RUN-08 — currently 1 skipped per STATE.md line 152).

    Single commit: `test(46-03): CLEAN-04 - remove free-text-input test scenarios from runner + picker`.
  </action>
  <verify>
    <automated>npm test -- --run</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "free-text-input\|FreeTextInputNode\|enterFreeText" src/__tests__/runner/protocol-runner.test.ts` returns 0
    - `grep -c "free-text-input\|FreeTextInputNode" src/__tests__/node-picker-modal.test.ts` returns 0
    - `grep -c "freeText(" src/__tests__/node-picker-modal.test.ts` returns 0 (factory deleted, no call sites remain)
    - `grep -c "LoopStartNode\|LoopEndNode" src/__tests__/node-picker-modal.test.ts` returns >= 2 (smoke — Phase 43 @deprecated imports preserved; factories still used by D-06 exclusion test and legacy-loops test)
    - `grep -rn "free-text-input\|FreeTextInputNode\|enterFreeText" src/ --include='*.ts'` returns matches ONLY in `src/__tests__/free-text-input-migration.test.ts` (Plan 46-01) AND `src/views/editor-panel-view.ts` (one refreshed comment from Plan 46-02 mentioning "free-text-input excised entirely") — total match count across the entire src/ tree: record actual count in commit body, expected ≈ 8-12 matches all from these two files
    - `grep -rn "free-text-input" src/__tests__/fixtures/` returns exactly 1 match (the repurposed free-text.canvas fixture per Plan 46-01 D-46-01-C)
    - `npx tsc --noEmit --skipLibCheck` exits 0
    - `npm run build` exits 0
    - `npm test -- --run` exits 0
    - `npm test -- --run 2>&1 | grep -iE "skipped|todo" | grep -v "^$"` shows ≤ 1 skipped entry total (the known Phase 44 RUN-08 skip); NO skipped entries match `/free.*text/i`
    - `git log -1 --format=%s` matches `^test\(46-03\): CLEAN-04`
    - Test count: `npm test -- --run 2>&1 | grep -E "Tests.*passed"` — record passing count. Expected formula: pre-Phase-46-baseline (420 passed per STATE.md line 152) minus 4 deleted tests (2 in RUN-04 describe + D-02 separator + Test 6) plus 3 new tests added by Plan 46-01 = 419 passing + 1 skipped. Executor records actual count.
  </acceptance_criteria>
  <done>CLEAN-04 closed — no orphan free-text-input tests anywhere in the suite, all tests green, build green, Phase 46 shippable.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| test suite → CI / local runner | Tests must not contain stale `.skip` entries on deleted code paths — those would rot and mask real regressions |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-46-03-01 | info | test coverage | accept | RUN-04 (free-text runtime) and the D-02 separator edge case are deleted tests — the behaviors they covered no longer exist. CLEAN-04 explicitly sanctions this deletion. Replacement coverage: Plan 46-01's `free-text-input-migration.test.ts` proves the kind is rejected at parse time. |
| T-46-03-02 | T (tampering) | test hygiene | mitigate | Forbid `.skip` on free-text-input tests — STATE.md Pitfall #10 spirit (Phase 44 Plan 02b deleted entire `describe.skip` block + TODO comment rather than leaving a skip). Acceptance criterion explicitly grep's for `free.*text` skipped entries = 0. |
| T-46-03-03 | R (repudiation) | node-picker-modal test scope | accept | D-06 exclusion test's "excludes free-text-input" assertion was a defense-in-depth check. After CLEAN-01 the kind cannot exist, so the assertion is tautological. Removing it does not reduce runtime safety — the picker cannot receive a free-text-input node because the parser rejects the canvas first (Plan 46-01). |
| T-46-03-04 | info | Test 6 premise | accept | `chooseSnippetBranch` error-case coverage: Tests 4 and 5 still cover the error path (nonexistent id, wrong kind). Test 6's specific "at-node but not a question" scenario has no post-CLEAN-01 equivalent in the type system — removing it is the correct response to the type deletion. |
</threat_model>

<verification>
- Entire codebase grep: `grep -rn "free-text-input\|FreeTextInputNode\|enterFreeText\|rp-free-text-input" src/ --include='*.ts' --include='*.css' --include='*.canvas'` returns a bounded, documented list:
  - `src/__tests__/fixtures/free-text.canvas` — 1 line (Plan 46-01 D-46-01-C: repurposed as CLEAN-02 rejection fixture)
  - `src/__tests__/free-text-input-migration.test.ts` — multiple lines (Plan 46-01 assertion tokens, Russian error-text grep)
  - `src/graph/canvas-parser.ts` — 2-4 lines (Plan 46-01 rejection branch: Russian comment + `if (kind === 'free-text-input')` check + error-string interpolation)
  - `src/views/editor-panel-view.ts` — 1 line (Plan 46-02 refreshed comment: "free-text-input excised entirely from RPNodeKind")
  - TOTAL expected match count across src/: record in SUMMARY; expected ≈ 8-12 matches
- `npm test -- --run` exits 0
- `npx tsc --noEmit --skipLibCheck` exits 0
- `npm run build` exits 0
- Single commit: `test(46-03): CLEAN-04 ...`
</verification>

<success_criteria>
- Plan 46-03 closes CLEAN-04 at the test layer.
- All free-text-input RUN-04 happy-path tests deleted (not skipped).
- All orphaned `it`/`describe` blocks referencing the kind deleted.
- `node-picker-modal.test.ts` D-06 exclusion test rewritten without the dead kind, preserving the exclusion semantics for answer/start/loop-start/loop-end.
- Full vitest suite green; build green; TS exhaustive compile green.
- Phase 46 ready for `/gsd-verify-phase` handoff.
</success_criteria>

<output>
After completion, create `.planning/phases/46-free-text-input-removal/46-03-test-cleanup-SUMMARY.md` documenting:
- Exact pre-delete and post-delete line ranges for each of the 3 deletions in `protocol-runner.test.ts`
- Exact pre-delete and post-delete line ranges for the 3 edits in `node-picker-modal.test.ts`
- Final test counts: passing / skipped / todo (expected: 419 passing + 1 skipped, ±3 depending on count drift across Plans 46-01/02/03)
- Final grep audit of all `free-text-input` / `FreeTextInputNode` / `enterFreeText` / `rp-free-text-input` matches across src/ with file:line breakdown (proves the bounded expected-pattern above)
- Commit hash
- Phase 46 end-state declaration: "All 4 requirements (CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04) closed at type + parse + runtime + view + CSS + test layers. Ready for /gsd-verify-phase handoff."
</output>
