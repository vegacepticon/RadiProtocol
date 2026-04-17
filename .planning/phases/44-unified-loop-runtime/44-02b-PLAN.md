---
phase: 44
plan: 02b
type: execute
wave: 3
depends_on: [44-02a]
files_modified:
  - src/__tests__/runner/protocol-runner.test.ts
  - src/__tests__/runner/protocol-runner-loop-picker.test.ts
  - src/__tests__/fixtures/unified-loop-long-body.canvas
autonomous: true
requirements:
  - RUN-01
  - RUN-02
  - RUN-03
  - RUN-04
  - RUN-05
user_setup: []
tags: [runtime, loop, test-rewrites, fixture]

must_haves:
  truths:
    - "All 7 tests inside the legacy describe.skip('loop support (LOOP-01..05, RUN-09)') are deleted together with the preceding TODO Phase 44 comment block — grep for 'TODO Phase 44' in the test file returns 0"
    - "The describe.skip('loop-start missing continue edge (RUN-08)') is PRESERVED byte-identical; only the 1–3 comment lines immediately above it are updated to 'TODO Phase 45'"
    - "protocol-runner-loop-picker.test.ts has 5 passing tests covering RUN-01, RUN-02, RUN-03, RUN-04, RUN-05 + assertions that verify B1 single-frame invariant (loopContextStack.length === 1) and I1 strengthened iteration-stack-length check"
    - "A new long-body integration test (W4) exists against a new fixture unified-loop-long-body.canvas and exercises 10 iterations × 10-text-block body to prove Pitfall 10 cycle-guard behaviour"
    - "All tests green on npm test -- --run; no regressions"
  artifacts:
    - path: "src/__tests__/runner/protocol-runner.test.ts"
      provides: "Rewritten loop-support describe block — 7 skipped tests DELETED together with 'TODO Phase 44' comment; RUN-08 describe.skip preserved with updated 'TODO Phase 45' comment marker (user decision 3)"
    - path: "src/__tests__/runner/protocol-runner-loop-picker.test.ts"
      provides: "Concrete RUN-01/02/03/04/05 tests against unified-loop-valid.canvas + unified-loop-nested.canvas, with B1 stack-length assertions and I1 strengthened checks; plus W4 long-body integration test"
    - path: "src/__tests__/fixtures/unified-loop-long-body.canvas"
      provides: "New fixture for W4 long-body integration test — loop with 10 text-blocks in body"
  key_links:
    - from: "src/__tests__/runner/protocol-runner-loop-picker.test.ts"
      to: "src/runner/protocol-runner.ts"
      via: "new ProtocolRunner() + chooseLoopBranch"
      pattern: "chooseLoopBranch"
    - from: "src/__tests__/runner/protocol-runner-loop-picker.test.ts"
      to: "src/__tests__/fixtures/unified-loop-long-body.canvas"
      via: "loadGraph('unified-loop-long-body.canvas')"
      pattern: "unified-loop-long-body"
---

<objective>
Fill in the test half of Phase 44 Plan 02 (split from the original single plan per checker W1 — runtime edits in 02a, test rewrites here).

Replace the 7 skipped loop-runtime tests inside `describe.skip('loop support (LOOP-01..05, RUN-09)')` with real coverage in `protocol-runner-loop-picker.test.ts`. Preserve the RUN-08 `describe.skip` byte-identical per user-locked decision 3, updating ONLY the preceding comment block to `TODO Phase 45`. Add a new long-body integration test (W4) proving the per-call cycle guard does not trip across 10 picker iterations.

Purpose: Pin the Plan 02a runtime behaviours (B1 re-entry guard, B2 previousCursor threading, chooseLoopBranch, dead-end helper, case 'loop' entry) behind green tests. Without these tests the behaviours drift unverified.

Output: 5 green `protocol-runner-loop-picker.test.ts` tests + 1 long-body integration test + clean `protocol-runner.test.ts` with only the RUN-08 skip remaining (Phase 45 scope).
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
@.planning/phases/44-unified-loop-runtime/44-02a-SUMMARY.md
@src/runner/runner-state.ts
@src/runner/protocol-runner.ts
@src/__tests__/runner/protocol-runner.test.ts
@src/__tests__/runner/protocol-runner-loop-picker.test.ts
@src/__tests__/fixtures/unified-loop-valid.canvas
@src/__tests__/fixtures/unified-loop-nested.canvas

<interfaces>
<!-- Runtime contracts available from Plan 02a (already merged at Wave 2). -->

From src/runner/protocol-runner.ts (post-02a):
```typescript
chooseLoopBranch(edgeId: string): void;  // edgeId per locked decision
stepBack(): void;                         // existing — pops undoStack, restores state
getSerializableState(): { runnerStatus, currentNodeId, accumulatedText, undoStack, loopContextStack, snippetId, snippetNodeId } | null;
restoreFrom(saved): void;                 // accepts awaiting-loop-pick
// B1 re-entry guard inside case 'loop': re-entry via back-edge or inner-«выход» does NOT push a second frame
// B2 previousCursor threading: canStepBack=true even when loop is first node after start()
```

From src/runner/runner-state.ts (post-02a):
```typescript
export interface AwaitingLoopPickState {
  status: 'awaiting-loop-pick';
  nodeId: string;
  accumulatedText: string;
  canStepBack: boolean;
}
```

From src/__tests__/fixtures/unified-loop-valid.canvas (structure — for reference):
- n-start (start), n-loop (loop), n-q1 (question), n-a1 (answer), n-end (text-block)
- e1 n-start→n-loop; e2 n-loop→n-q1 label "проверка"; e3 n-loop→n-end label "выход"
- e4 n-q1→n-a1; e5 n-a1→n-loop (back-edge — triggers B1 re-entry)

From src/__tests__/fixtures/unified-loop-nested.canvas (structure — Plan 01 produced):
- n-start, n-outer (loop), n-inner (loop), n-inner-q, n-inner-a, n-end (text-block)
- e1 n-start→n-outer; e2 n-outer→n-inner label "проверка"; e3 n-outer→n-end label "выход"
- e4 n-inner→n-inner-q label "проверка"; e5 n-inner→n-outer label "выход"
- e6 n-inner-q→n-inner-a; e7 n-inner-a→n-inner
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create unified-loop-long-body.canvas fixture for W4 long-body integration test</name>
  <files>src/__tests__/fixtures/unified-loop-long-body.canvas</files>
  <read_first>
    - src/__tests__/fixtures/unified-loop-valid.canvas (full — structural twin; copy shape)
    - .planning/phases/44-unified-loop-runtime/44-PATTERNS.md — confirm fixture JSON conventions (camelCase `fromNode`/`toNode`, `radiprotocol_nodeType`, literal 6-char Cyrillic «выход»)
  </read_first>
  <action>
    Create `src/__tests__/fixtures/unified-loop-long-body.canvas`. Structure: a single loop whose body chains through 10 text-blocks before looping back.

    Nodes (13 total):
    - `n-start` — `radiprotocol_nodeType: "start"`
    - `n-loop` — `radiprotocol_nodeType: "loop"`, `radiprotocol_headerText: "Long body"`
    - `n-t01` … `n-t10` — 10 text-blocks, each with `radiprotocol_nodeType: "text-block"` and `radiprotocol_content: "T01"` … `"T10"` respectively
    - `n-end` — `radiprotocol_nodeType: "text-block"`, `radiprotocol_content: "Done"`

    Edges (13 total):
    - `e1`: n-start → n-loop (no label)
    - `e2`: n-loop → n-t01, `label: "проверка"` (body branch entry)
    - `e3`: n-loop → n-end, `label: "выход"` (literal 6-char Cyrillic — the ONLY exit)
    - `e4`: n-t01 → n-t02 (no label)
    - `e5`: n-t02 → n-t03
    - `e6`: n-t03 → n-t04
    - `e7`: n-t04 → n-t05
    - `e8`: n-t05 → n-t06
    - `e9`: n-t06 → n-t07
    - `e10`: n-t07 → n-t08
    - `e11`: n-t08 → n-t09
    - `e12`: n-t09 → n-t10
    - `e13`: n-t10 → n-loop (back-edge — triggers B1 re-entry on each iteration)

    Copy native canvas fields (`type`, `text`, `x`, `y`, `width`, `height`) from `unified-loop-valid.canvas` — `type: "text"`, dummy `text`, `"x": 0, "y": <i*80>, "width": 200, "height": 60`. Keep JSON readable.

    CRITICAL:
    - «выход» is the literal 6-char Cyrillic `в-ы-х-о-д`. Exactly ONE edge carries this label (e3).
    - One body branch — e2 «проверка» (Cyrillic; does NOT have to match `выход`, can be any Cyrillic word).
    - `e13` — back-edge from last text-block to the loop node — MUST have no label so the loop node is reached via auto-advance re-entry path (exercises B1 guard on each iteration).
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'),p=require('path');const raw=fs.readFileSync(p.join('src/__tests__/fixtures','unified-loop-long-body.canvas'),'utf8');const j=JSON.parse(raw);const loops=j.nodes.filter(n=>n.radiprotocol_nodeType==='loop');if(loops.length!==1)throw new Error('expected 1 loop node, got '+loops.length);const textBlocks=j.nodes.filter(n=>n.radiprotocol_nodeType==='text-block');if(textBlocks.length!==11)throw new Error('expected 11 text-blocks (10 body + 1 end), got '+textBlocks.length);const out=j.edges.filter(e=>e.fromNode==='n-loop');const exit=out.filter(e=>e.label==='выход');if(exit.length!==1)throw new Error('loop exit count='+exit.length);const back=j.edges.find(e=>e.fromNode==='n-t10'&&e.toNode==='n-loop');if(!back)throw new Error('missing back-edge from n-t10 to n-loop');console.log('OK');"</automated>
  </verify>
  <done>
    - File `src/__tests__/fixtures/unified-loop-long-body.canvas` exists, valid JSON
    - `rg -c '"radiprotocol_nodeType": "loop"' src/__tests__/fixtures/unified-loop-long-body.canvas` returns 1
    - `rg -c 'выход' src/__tests__/fixtures/unified-loop-long-body.canvas` returns 1
    - `rg -c '"n-t' src/__tests__/fixtures/unified-loop-long-body.canvas` returns ≥10
    - Inline node -e verification script prints OK
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Rewrite skipped loop-runtime tests in protocol-runner.test.ts + fill protocol-runner-loop-picker.test.ts with 5 RUN-0x tests + long-body integration test</name>
  <files>src/__tests__/runner/protocol-runner.test.ts, src/__tests__/runner/protocol-runner-loop-picker.test.ts</files>
  <read_first>
    - src/__tests__/runner/protocol-runner.test.ts (full — confirm current positions of `describe.skip('loop-start missing continue edge (RUN-08)')` at ~line 260 and `describe.skip('loop support (LOOP-01..05, RUN-09)')` at ~line 458; also confirm the TODO Phase 44 comment block immediately above the loop-support describe.skip is 1–3 lines — B3 deletion scope)
    - src/__tests__/runner/protocol-runner-loop-picker.test.ts (skeleton produced by Plan 01 — 3 `it.todo` entries to replace)
    - src/__tests__/fixtures/unified-loop-valid.canvas (target fixture — has 1 loop, edge e2 «проверка», edge e3 «выход», back-edge e5)
    - src/__tests__/fixtures/unified-loop-nested.canvas (Plan 01 artifact — outer/inner with e3 outer-exit, e5 inner-exit-to-outer)
    - src/__tests__/fixtures/unified-loop-long-body.canvas (this plan's Task 1 artifact — 10 text-block body)
    - .planning/phases/44-unified-loop-runtime/44-PATTERNS.md section "src/__tests__/runner/protocol-runner.test.ts — rewrite 7 `.skip` tests"
    - .planning/phases/44-unified-loop-runtime/44-RESEARCH.md Pitfall 10 (cycle guard per-call reset)
  </read_first>
  <behavior>
    - `protocol-runner.test.ts` has zero `chooseLoopAction` references
    - `protocol-runner.test.ts` has exactly ONE describe.skip remaining — the RUN-08 block preserved with its comment retargeted to `TODO Phase 45` (user decision 3); the `loop support (LOOP-01..05, RUN-09)` describe.skip block is DELETED TOGETHER WITH the preceding `TODO Phase 44` comment block (B3 scope).
    - `protocol-runner-loop-picker.test.ts` has 5 RUN-0x tests + 1 long-body integration test = 6 passing tests
    - All tests green on `npm test -- --run`
  </behavior>
  <action>
    **Step A — Update RUN-08 skip marker in `src/__tests__/runner/protocol-runner.test.ts` (PER USER-LOCKED DECISION 3):**

    The block `describe.skip('loop-start missing continue edge (RUN-08)', () => { ... })` (currently lines ~256-271, preceded by a 1–3-line `// TODO Phase 44` comment) MUST BE PRESERVED — the user-locked decision explicitly says to keep it because RUN-08 is NOT in Phase 44's requirement list.

    Edit ONLY the `// TODO Phase 44` comment block directly above the describe.skip. Replace the 'Phase 44' reference with 'Phase 45' (future phase owns RUN-08 rewrite). The describe.skip body stays BYTE-IDENTICAL — do NOT rewrite the test, do NOT un-skip, do NOT delete. Example new comment block:

    ```typescript
    // TODO Phase 45: rewrite for unified loop if a runtime-level missing-«выход» check is desired.
    // GraphValidator already covers this via LOOP-04 (see graph-validator.test.ts). RUN-08 is not
    // in Phase 44's requirement list; scheduled for a future phase only if validator-level coverage
    // proves insufficient. Phase 43 D-CL-05 variant b keeps legacy kinds parseable so this skip compiles.
    describe.skip('loop-start missing continue edge (RUN-08)', () => {
      // ... body unchanged ...
    });
    ```

    **Step B — Delete obsolete loop-support describe.skip in `src/__tests__/runner/protocol-runner.test.ts` (B3 DELETION SCOPE):**

    Remove the ENTIRE block including the 1–3 comment lines immediately above the `describe.skip('loop support ...')`. The deletion range starts at the FIRST line of the `// TODO Phase 44: rewrite for unified loop ...` comment block (currently ~line 452-454, may be 1, 2, or 3 comment lines — count them first with a grep, then delete ALL of them together with the describe.skip below) and ends at the closing `});` of the `describe.skip('loop support (LOOP-01 through LOOP-05, RUN-09)', () => { ... })` block (currently ~line 539 including its helper function `reachLoopEnd` and all 6 `it` tests).

    B3 scope: the deletion MUST remove the comment block AS WELL AS the describe.skip body. This is mandatory because the final grep in the done criterion is `grep -c 'TODO Phase 44' src/__tests__/runner/protocol-runner.test.ts` returns 0 — that grep hits the comment, not the describe. If only the describe.skip is deleted, the grep still returns >0 and the done criterion fails.

    Rationale: these tests called `chooseLoopAction('again')`/`chooseLoopAction('done')` on legacy `loop-body.canvas` — both the method and the fixture semantics are gone. Equivalent coverage is added in `protocol-runner-loop-picker.test.ts` (Step C) against the unified fixture.

    Do NOT touch any other describe block in this file. Especially leave `describe('iteration cap (RUN-09, D-08)')` at ~line 273 intact — that test covers `ProtocolRunner.maxIterations` (auto-advance cycle guard) and MUST stay green per the user-locked RUN-07 decision.

    **Step C — Fill `src/__tests__/runner/protocol-runner-loop-picker.test.ts` with concrete tests (RUN-01..RUN-05) + B1 stack-length assertions + I1 strengthened checks.**

    Replace the full contents of the file. The skeleton's `loadGraph` helper stays — remove the `eslint-disable-next-line` comment (helper is now used). Add `import { ProtocolRunner } from '../../runner/protocol-runner';` and augment the vitest import to include `expect`.

    Replace the 3 `it.todo` entries with 5 concrete tests, inside the existing `describe(...)` block (rename to cover RUN-01..RUN-05):

    ```typescript
    import { describe, it, expect } from 'vitest';
    import * as fs from 'node:fs';
    import * as path from 'node:path';
    import { CanvasParser } from '../../graph/canvas-parser';
    import { ProtocolRunner } from '../../runner/protocol-runner';
    import type { ProtocolGraph } from '../../graph/graph-model';

    const fixturesDir = path.join(__dirname, '..', 'fixtures');

    function loadGraph(name: string): ProtocolGraph {
      const json = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
      const parser = new CanvasParser();
      const result = parser.parse(json, name);
      if (!result.success) throw new Error(`Fixture ${name} failed to parse: ${result.error}`);
      return result.graph;
    }

    describe('ProtocolRunner loop picker (RUN-01..RUN-05)', () => {

      it('RUN-01: halts at awaiting-loop-pick with loop node id after start() on unified-loop-valid.canvas', () => {
        const runner = new ProtocolRunner();
        runner.start(loadGraph('unified-loop-valid.canvas'));
        const state = runner.getState();
        expect(state.status).toBe('awaiting-loop-pick');
        if (state.status !== 'awaiting-loop-pick') return;
        expect(state.nodeId).toBe('n-loop');
        expect(state.accumulatedText).toBe('');
      });

      it('RUN-02: body-branch walks the branch; back-edge re-entry increments top frame iteration to 2 via the B1 guard WITHOUT pushing a second frame (B1 + I1 — single-point-increment semantic)', () => {
        const graph = loadGraph('unified-loop-valid.canvas');
        const runner = new ProtocolRunner();
        runner.start(graph);
        // Pick the body edge e2 ("проверка") — walks to n-q1
        runner.chooseLoopBranch('e2');
        let state = runner.getState();
        expect(state.status).toBe('at-node');
        if (state.status !== 'at-node') return;
        expect(state.currentNodeId).toBe('n-q1');
        // Answer n-a1 → e5 back-edge → re-enter n-loop → B1 re-entry guard fires
        runner.chooseAnswer('n-a1');
        state = runner.getState();
        expect(state.status).toBe('awaiting-loop-pick');
        // B1 invariant: ONLY one frame on the stack — re-entry did NOT push a second frame.
        // I1 strengthened: stack length assertion alongside iteration assertion.
        const serialized = runner.getSerializableState();
        expect(serialized).not.toBeNull();
        if (serialized === null) return;
        expect(serialized.loopContextStack.length).toBe(1);
        expect(serialized.loopContextStack[0]?.iteration).toBe(2);
      });

      it('RUN-03: choosing «выход» pops frame and advances along exit edge', () => {
        const runner = new ProtocolRunner();
        runner.start(loadGraph('unified-loop-valid.canvas'));
        // e3 is the «выход» edge (n-loop → n-end, text-block terminal)
        runner.chooseLoopBranch('e3');
        const state = runner.getState();
        expect(state.status).toBe('complete');
        const serialized = runner.getSerializableState();
        // After complete, getSerializableState returns null — verify via getState shape only
        expect(serialized).toBeNull();
      });

      it('RUN-04: nested loops — inner «выход» returns to outer picker with SINGLE outer frame (B1 — loopContextStack.length === 1, not 2)', () => {
        const graph = loadGraph('unified-loop-nested.canvas');
        const runner = new ProtocolRunner();
        runner.start(graph);
        let state = runner.getState();
        expect(state.status).toBe('awaiting-loop-pick');
        if (state.status !== 'awaiting-loop-pick') return;
        expect(state.nodeId).toBe('n-outer');
        // After first-halt at outer, exactly 1 frame on stack
        let serialized = runner.getSerializableState();
        expect(serialized?.loopContextStack.length).toBe(1);
        // Enter outer body (e2: n-outer → n-inner, «проверка»)
        runner.chooseLoopBranch('e2');
        state = runner.getState();
        expect(state.status).toBe('awaiting-loop-pick');
        if (state.status !== 'awaiting-loop-pick') return;
        expect(state.nodeId).toBe('n-inner');
        // After walking into inner, 2 frames on stack (outer + inner).
        serialized = runner.getSerializableState();
        expect(serialized?.loopContextStack.length).toBe(2);
        // Inner «выход» (e5) points back to n-outer — inner frame pops, advanceThrough re-enters
        // n-outer, B1 re-entry guard fires on the existing outer frame (iteration increments).
        runner.chooseLoopBranch('e5');
        state = runner.getState();
        expect(state.status).toBe('awaiting-loop-pick');
        if (state.status !== 'awaiting-loop-pick') return;
        expect(state.nodeId).toBe('n-outer');
        // B1 invariant: a single outer frame (NOT 2 — no duplicate outer from re-entry).
        serialized = runner.getSerializableState();
        expect(serialized).not.toBeNull();
        if (serialized === null) return;
        expect(serialized.loopContextStack.length).toBe(1);
        expect(serialized.loopContextStack[0]?.loopNodeId).toBe('n-outer');
        // Re-entry incremented outer's iteration to 2 (first entry: iteration=1; after re-entry: 2)
        expect(serialized.loopContextStack[0]?.iteration).toBe(2);
        // Outer «выход» (e3) → n-end → complete
        runner.chooseLoopBranch('e3');
        state = runner.getState();
        expect(state.status).toBe('complete');
      });

      it('RUN-05: step-back from loop picker restores pre-loop currentNodeId and accumulatedText; canStepBack=true via B2 even at first halt', () => {
        const graph = loadGraph('unified-loop-valid.canvas');
        const runner = new ProtocolRunner();
        runner.start(graph);
        // B2: first halt after start() on a loop — canStepBack is true because the loop-entry
        // pushes an undo entry regardless of previousCursor. (previousCursor was 'n-start' here
        // because start-node auto-advances through — but even in a start→loop-direct edge case
        // the entry would be pushed with nodeId=cursor as a no-op.)
        const picker = runner.getState();
        expect(picker.status).toBe('awaiting-loop-pick');
        if (picker.status !== 'awaiting-loop-pick') return;
        expect(picker.canStepBack).toBe(true);
        // Step back → restores to pre-loop state, loopContextStack cleared
        runner.stepBack();
        const serialized = runner.getSerializableState();
        expect(serialized).not.toBeNull();
        if (serialized === null) return;
        expect(serialized.loopContextStack.length).toBe(0);
        expect(serialized.accumulatedText).toBe('');
      });

      // W4 — long-body integration test. Exercises Pitfall 10 (per-advanceThrough steps counter
      // resets each picker halt). 10 iterations × 10 text-blocks body should NOT trip the RUN-09
      // guard (ProtocolRunner.maxIterations default — typically 50). Each picker-halt round-trip
      // is one advanceThrough call; steps ≈ 11 per call (loop re-entry + 10 text-blocks) — well
      // under the 50 threshold because the steps counter resets every time advanceThrough is
      // re-entered via chooseLoopBranch.
      it('W4: long-body loop iterates 10 times without tripping RUN-09 auto-advance guard', () => {
        const graph = loadGraph('unified-loop-long-body.canvas');
        const runner = new ProtocolRunner();
        runner.start(graph);
        let state = runner.getState();
        expect(state.status).toBe('awaiting-loop-pick');
        // Initial halt — iteration=1 (first loop-entry).
        // Iterate 10 times via chooseLoopBranch('e2') = the body branch.
        // Each call: body walk → 10 text-blocks auto-append → back-edge e13 → B1 re-entry → picker.
        // B1 increments iteration each re-entry; chooseLoopBranch body-branch does NOT increment.
        // After i picks: iteration = i + 1 (1 from initial entry + i increments from re-entries).
        for (let i = 1; i <= 10; i++) {
          runner.chooseLoopBranch('e2');
          state = runner.getState();
          expect(state.status).toBe('awaiting-loop-pick');
          if (state.status !== 'awaiting-loop-pick') return;
          // B1 invariant throughout — single frame only
          const serialized = runner.getSerializableState();
          expect(serialized?.loopContextStack.length).toBe(1);
          // Single-point-increment semantic — iteration = i + 1 after i picks.
          expect(serialized?.loopContextStack[0]?.iteration).toBe(i + 1);
        }
        // Exit cleanly on «выход» (e3)
        runner.chooseLoopBranch('e3');
        state = runner.getState();
        expect(state.status).toBe('complete');
      });
    });
    ```

    Note on the W4 iteration-count formula (`i + 1`): only the B1 re-entry guard increments the iteration (per Plan 02a Step D, `chooseLoopBranch`'s body-branch arm does NOT increment — it only advances the cursor). The initial `start()` push contributes iteration=1; each of the `i` picks triggers exactly one B1 re-entry (back-edge e13 → case 'loop' → top-of-stack guard fires → +1). So after `i` picks, iteration = 1 + i. This matches the assertion `toBe(i + 1)` at the end of each iteration.

    CLAUDE.md DISCIPLINE: do NOT touch other test files in this plan; Plan 03 owns `protocol-runner-session.test.ts` rewrites and RunnerView.test.ts changes.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/runner/protocol-runner-loop-picker.test.ts src/__tests__/runner/protocol-runner.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `grep -cE 'describe\.skip|it\.skip|it\.todo' src/__tests__/runner/protocol-runner.test.ts` returns exactly 1 (the RUN-08 describe.skip is PRESERVED per user-locked decision 3 — RUN-08 deferred to Phase 45)
    - `grep -c 'TODO Phase 45' src/__tests__/runner/protocol-runner.test.ts` returns ≥1 (updated marker above the preserved RUN-08 skip)
    - **B3 done-criterion**: After Steps A AND B complete: `grep -c 'TODO Phase 44' src/__tests__/runner/protocol-runner.test.ts` returns 0
    - `grep -c 'chooseLoopAction' src/__tests__/runner/protocol-runner.test.ts` returns 0
    - `grep -c 'chooseLoopBranch' src/__tests__/runner/protocol-runner-loop-picker.test.ts` returns ≥5 (one per non-W4 test + loop body of W4)
    - `grep -cE "\bit\(" src/__tests__/runner/protocol-runner-loop-picker.test.ts` returns 6 (RUN-01..05 + W4 long-body)
    - **I1 done-criterion**: `grep -c 'loopContextStack.length' src/__tests__/runner/protocol-runner-loop-picker.test.ts` returns ≥4 (one in RUN-02, three in RUN-04, one in W4 loop, one in RUN-05 — at least 4)
    - `grep -c 'unified-loop-long-body.canvas' src/__tests__/runner/protocol-runner-loop-picker.test.ts` returns ≥1 (W4 test loads the fixture)
    - `npx vitest run src/__tests__/runner/protocol-runner.test.ts src/__tests__/runner/protocol-runner-loop-picker.test.ts` exits 0 with all non-skipped tests green
    - RUN-09 iteration-cap test still passes: `npx vitest run src/__tests__/runner/protocol-runner.test.ts -t "iteration cap"` exits 0
  </done>
</task>

</tasks>

<verification>
Full-plan verification:
- `npx tsc --noEmit --skipLibCheck` exits 0
- `npm test -- --run` exits 0 — net count of .skip tests in protocol-runner.test.ts drops by 7 (7 tests inside the removed `describe.skip('loop support ...')` block gone; RUN-08 describe.skip preserved with Phase 45 TODO per user-locked decision 3)
- `npm run build` exits 0
- `grep -rn 'chooseLoopAction\|loopIterationLabel\|isAtLoopEnd' src/runner/ src/views/ src/__tests__/runner/protocol-runner.test.ts src/__tests__/runner/protocol-runner-loop-picker.test.ts` returns 0 matches
- B1 coverage in tests: every test that walks a back-edge or nested exit asserts `loopContextStack.length === 1` (RUN-02) or `.length === 1` after inner-exit (RUN-04)
- W4 coverage: long-body test runs 10 iterations without RUN-09 guard tripping
</verification>

<success_criteria>
- [ ] RUN-01: Picker halt after start() — test passes
- [ ] RUN-02: body-branch walk + back-edge re-entry → iteration=2, stack.length=1 (B1 + I1) — test passes
- [ ] RUN-03: «выход» → complete — test passes
- [ ] RUN-04: nested — inner exit returns to single outer frame (B1) — test passes
- [ ] RUN-05: step-back from picker → empty stack, canStepBack=true at first halt (B2) — test passes
- [ ] W4: 10-iteration long-body loop does not trip RUN-09 guard — test passes
- [ ] `describe.skip('loop-start missing continue edge (RUN-08)')` PRESERVED with updated `TODO Phase 45` marker (user-locked decision 3)
- [ ] `describe.skip('loop support (LOOP-01 through LOOP-05, RUN-09)')` and its preceding `TODO Phase 44` comment block deleted TOGETHER (B3 scope)
- [ ] `grep -c 'TODO Phase 44' src/__tests__/runner/protocol-runner.test.ts` returns 0
</success_criteria>

<output>
After completion, create `.planning/phases/44-unified-loop-runtime/44-02b-SUMMARY.md` documenting:
- 6 new tests in protocol-runner-loop-picker.test.ts (5 RUN-0x + W4 long-body)
- B1 stack-length invariant verified in RUN-02 and RUN-04
- B2 canStepBack=true verified in RUN-05
- B3 TODO Phase 44 comment block removed from protocol-runner.test.ts — grep returns 0
- I1 strengthened RUN-02 test with loopContextStack.length check
- W4 long-body integration test confirms Pitfall 10 per-call cycle guard behaviour
- Handoff note for Plan 03: runtime + tests are live; session round-trip + picker UI can now land
</output>
</context>
