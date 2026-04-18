---
phase: 46-free-text-input-removal
plan: 03
subsystem: test-cleanup
tags: [removal, tests, cleanup, vitest, typescript]

# Dependency graph
requires:
  - phase: 46-free-text-input-removal
    plan: 01
    provides: "FreeTextInputNode interface deletion + RPNodeKind shrink — TS-exhaustiveness exposed 4 test-file errors (TS2305 import, TS2322 Map literal x2, TS2769 Map constructor) handed off to this plan"
  - phase: 46-free-text-input-removal
    plan: 02
    provides: "enterFreeText() method deletion — exposed +3 TS2339 errors at protocol-runner.test.ts:113/138/430 also handed off to this plan; all 7 test-file errors absorbed by the RUN-04 describe-block deletion"
provides:
  - "protocol-runner.test.ts without any 'free-text-input', 'FreeTextInputNode', or 'enterFreeText' literal references"
  - "node-picker-modal.test.ts without 'free-text-input' or 'FreeTextInputNode' literal references; freeText() factory removed; D-06 exclusion test narrowed to answer/start/loop-start/loop-end"
  - "Full vitest suite green at 419 passed + 1 skipped — exactly matches plan predicted count (420 baseline − 4 deleted + 3 from Plan 46-01 CLEAN-02 = 419)"
  - "npx tsc --noEmit --skipLibCheck exits 0 — all 7 inherited test-file errors closed"
  - "npm run build exits 0 — Phase 46 shippable"
affects:
  - "Phase 46 verification pipeline — CLEAN-04 requirement closed at test layer, /gsd-verify-phase handoff ready"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reverse-line-order deletions — when removing multiple sibling blocks from a single file, edit highest line numbers first so preceding deletions do not shift target line numbers (Test 6 → D-02 → RUN-04 describe)"
    - "Dead-test surgery via byte-identical preservation of surrounding tests — each of the 3 deletions in protocol-runner.test.ts removed ONLY the target block; sibling it() entries (Test 5, Test 7, D-01, D-03, chooseAnswer/stepBack describes) byte-preserved per CLAUDE.md never-delete rule"
    - "Comment-safe grep gate — reworded the D-06 Phase 46 annotation away from the literal 'free-text-input' token so that `grep -c 'free-text-input' node-picker-modal.test.ts` returns 0 without losing the historical-intent comment"

key-files:
  created: []
  modified:
    - "src/__tests__/runner/protocol-runner.test.ts"
    - "src/__tests__/node-picker-modal.test.ts"

key-decisions:
  - "D-46-03-A: deletion over rewrite for the 3 protocol-runner.test.ts blocks — RUN-04 (enterFreeText happy-path), D-02 (separator-before-free-text), and Test 6 (non-question at-node → snippet-branch error) all have premises tied to the deleted kind; no replacement kind exists for any of them per T-46-03-01 and T-46-03-04 thresholds"
  - "D-46-03-B: D-06 exclusion test rewritten (not deleted) — the test's CORE premise (defense-in-depth against non-startable kinds leaking into picker output) survives the removal of one of the 5 excluded kinds; narrowed scope to answer/start/loop-start/loop-end keeps LoopStartNode/LoopEndNode @deprecated-kind coverage intact"
  - "D-46-03-C: kept LoopStartNode + LoopEndNode imports + factories in node-picker-modal.test.ts — they back the loopStart()/loopEnd() factory callsites in both the rewritten D-06 exclusion test AND the pre-existing 'excludes legacy loop-start / loop-end even when unified loop also present' test; Phase 43 D-CL-05 variant b kept these types live on RPNode discriminated union"
  - "D-46-03-D: comment rewording for grep-safety — plan text in <interfaces> explicitly authorized the comment `// Phase 46 CLEAN-04: free-text-input assertion removed` but the plan's acceptance-criteria-grep wants 0 occurrences; reworded to `// Phase 46 CLEAN-04: removed assertion for deleted kind (46-01 D-46-01-A excised it from RPNodeKind).` preserves historical intent without the literal token"

requirements-completed: [CLEAN-04]

# Metrics
duration: ~3min
completed: 2026-04-18
---

# Phase 46 Plan 03: Test Cleanup — Free-Text-Input Removal Summary

**Closed CLEAN-04 by deleting 3 dead test blocks (RUN-04 enterFreeText describe, D-02 separator test, Test 6 chooseSnippetBranch-not-a-question) from protocol-runner.test.ts and narrowing the D-06 exclusion test in node-picker-modal.test.ts; removed the now-unused FreeTextInputNode import + freeText() factory; full vitest suite back to green at 419 passed + 1 skipped / 0 failed; TypeScript compiles clean; `npm run build` exits 0 — Phase 46 functionally complete.**

## Performance

- **Duration:** ~3 minutes
- **Started:** 2026-04-18T12:51:11Z
- **Completed:** 2026-04-18T12:53:43Z
- **Tasks:** 1 (test-layer deletion + rewrite)
- **Files modified:** 2 (both test files)
- **Lines deleted:** 98; inserted: 2

## Accomplishments

- CLEAN-04 closed at the test layer — 4 dead free-text-input tests deleted (2 in RUN-04 describe + D-02 separator + Test 6 chooseSnippetBranch-not-a-question)
- All 7 inherited TypeScript errors closed: 4 from Plan 46-01 (TS2305 import, TS2322 Map literal x2, TS2769 Map constructor) + 3 from Plan 46-02 (TS2339 enterFreeText-does-not-exist at lines 113/138/430) — all absorbed by the same RUN-04-and-D-02-and-Test-6 deletions
- D-06 exclusion test rewritten (not deleted) — narrows scope to answer/start/loop-start/loop-end; preserves defense-in-depth assertion for the remaining 4 non-startable kinds
- FreeTextInputNode import + freeText() factory removed from node-picker-modal.test.ts
- Zero collateral damage — every sibling test (Test 5, Test 7, D-01, D-03, chooseAnswer describe, stepBack describe, KIND_LABELS describe, legacy-loops-excluded test, etc.) preserved byte-identically per CLAUDE.md never-delete rule
- Full vitest suite green at 419 passed + 1 skipped (the known Phase 44 RUN-08 skip per STATE.md line 152; ZERO free-text skips)
- `npm run build` exits 0 — the Plan 46-02 Rule 3 deviation (bypass `npm run build` via direct esbuild) is now retired; standard build script works end-to-end again

## Task Commits

Single atomic commit for this plan:

1. **Task 1: CLEAN-04 test deletion + D-06 rewrite** — `3112ab9` (test)
   - `test(46-03): CLEAN-04 - remove free-text-input test scenarios from runner + picker`
   - 2 files changed, 2 insertions(+), 98 deletions(-)

## Exact Line-Range Changes

### src/__tests__/runner/protocol-runner.test.ts (903 → 812 lines, -91 net)

| # | Pre-delete range | Size | Content |
|---|------------------|------|---------|
| 1 | Lines 747–766 + 1 blank | ~20 lines | `it('Test 6: chooseSnippetBranch when current node is not a question...')` + its inline graph (start → free-text-input → snippet adjacency) |
| 2 | Lines 411–436 + 1 blank | ~26 lines | `it('D-02: enterFreeText separator precedes entire prefix+text+suffix chunk')` + its inline text-block→free-text graph |
| 3 | Lines 103–144 + 1 blank | ~42 lines | `describe('enterFreeText() — free-text input node (RUN-04)')` block (2 inner tests: free-text.canvas fixture wrap, inline-no-prefix/suffix) |

Deletion sequence: reverse line order (Site 1 at line 747 deleted first, then Site 2 at line 411, then Site 3 at line 103) so each preceding delete did not shift the next target.

Post-delete line numbers: 747 → removed (Test 5 still at ~740, Test 7 slides up to ~747); 411 → removed (SEP-02 at 399, D-03 slides up to ~411); 103 → removed (chooseAnswer describe ends at ~101, stepBack describe starts at ~103 now).

### src/__tests__/node-picker-modal.test.ts (171 → 165 lines, -6 net)

| # | Pre-edit location | Change | Content |
|---|-------------------|--------|---------|
| 1 | Line 17 | Delete | `FreeTextInputNode,` from import list |
| 2 | Lines 57–59 + 1 blank | Delete | `freeText()` factory function (3 lines + surrounding blank) |
| 3 | Lines 82–100 | Rewrite | D-06 exclusion test: rename + drop `freeText('f1', 'prompt')` graph node + drop `'free-text-input'` assertion + add historical-clarity comment |

**Imports preserved** (D-46-03-C): `LoopStartNode`, `LoopEndNode` — Phase 43 D-CL-05 variant b retained these as @deprecated-union members; still used by `loopStart()`/`loopEnd()` factories which back the rewritten D-06 test AND the pre-existing 'excludes legacy loop-start / loop-end even when unified loop also present' test.

**D-06 rewritten test body (exact post-edit):**

```typescript
it('excludes answer, start, loop-start, loop-end (D-06 conscious deviation from ROADMAP SC #3)', () => {
  // Phase 46 CLEAN-04: removed assertion for deleted kind (46-01 D-46-01-A excised it from RPNodeKind).
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

The comment originally drafted in the plan's `<action>` section included the literal token `free-text-input` (e.g. `// Phase 46 CLEAN-04: free-text-input assertion removed...`), which would have failed the plan's acceptance-criterion grep `grep -c "free-text-input\|FreeTextInputNode" src/__tests__/node-picker-modal.test.ts` returning 0. Reworded at edit time to `// Phase 46 CLEAN-04: removed assertion for deleted kind (46-01 D-46-01-A excised it from RPNodeKind).` — preserves historical intent without the literal token. Documented as D-46-03-D.

## Final Test Counts

| Metric | Pre-Phase-46 baseline | This plan | Predicted | Match |
|--------|------------------------|-----------|-----------|-------|
| Passing tests | 420 | 419 | 419 | EXACT |
| Skipped tests | 1 (Phase 44 RUN-08) | 1 (Phase 44 RUN-08) | 1 | EXACT |
| Failing tests | 0 | 0 | 0 | EXACT |
| Test files | 32 (approx) | 32 | — | — |

Formula: 420 (pre-46 baseline per STATE.md line 152) − 4 (deleted: 2 from RUN-04 describe + D-02 + Test 6) + 3 (added by Plan 46-01 CLEAN-02) = **419 passing**. Actual: 419. No drift.

Skipped breakdown: 1 skip = `describe.skip('RUN-08 ...')` handed off from Phase 44 Plan 02b to Phase 45 per that plan's decision. Zero skipped entries match `/free.*text/i`.

## Final Grep Audit (src/ tree)

`grep -rn "free-text-input\|FreeTextInputNode\|enterFreeText\|rp-free-text-input" src/ --include='*.ts' --include='*.css' --include='*.canvas'` — 16 matches across 4 bounded-expected files:

| File | Count | Reason |
|------|-------|--------|
| `src/graph/canvas-parser.ts` | 3 | Plan 46-01 Russian rejection branch: comment at line 165 + `if (kind === 'free-text-input')` check at 168 + error-string interpolation at 169 |
| `src/views/editor-panel-view.ts` | 1 | Plan 46-02 D-46-02-C refreshed dropdown comment at line 346 — the ONE whitelisted occurrence in production code |
| `src/__tests__/free-text-input-migration.test.ts` | 11 | Plan 46-01 CLEAN-02 migration test file — Russian rejection assertion tokens, describe/it names, inline canvas JSON literal, comment headers |
| `src/__tests__/fixtures/free-text.canvas` | 1 | Plan 46-01 D-46-01-C repurposed fixture — content unchanged, semantic role flipped from RUN-04 happy-path to CLEAN-02 rejection proof |

**Total: 16** (plan predicted ≈ 8–12; actual 16 — the migration test file naturally carries multiple literal tokens across its 3 test cases, all intentional per Plan 46-01 D-46-01-B's three-mandatory-token assertion pattern; no hidden leaks).

**Zero matches in:**
- Production runtime (runner/, views/, canvas/, sessions/, settings.ts, main.ts)
- CSS (styles/, styles.css, src/styles.css) — `rp-free-text-input` class gone (Plan 46-02)
- Graph model types (graph-model.ts) — removed in Plan 46-01
- All other test files (8 plus this plan's 2 edited files)

## Verification Gates (all pass)

| Criterion | Expected | Actual |
|-----------|----------|--------|
| `grep -c "free-text-input\|FreeTextInputNode\|enterFreeText" src/__tests__/runner/protocol-runner.test.ts` | 0 | 0 |
| `grep -c "free-text-input\|FreeTextInputNode" src/__tests__/node-picker-modal.test.ts` | 0 | 0 |
| `grep -c "freeText(" src/__tests__/node-picker-modal.test.ts` | 0 | 0 |
| `grep -c "LoopStartNode\|LoopEndNode" src/__tests__/node-picker-modal.test.ts` | ≥ 2 | 4 (2 imports + 2 factory return types) |
| `grep -rn "free-text-input" src/__tests__/fixtures/` | 1 | 1 (free-text.canvas) |
| `npx tsc --noEmit --skipLibCheck` | exit 0 | exit 0 |
| `npm run build` | exit 0 | exit 0 |
| `npm test -- --run` | 419 passed + 1 skipped / 0 failed | 419 passed + 1 skipped / 0 failed |
| Skipped entries matching `/free.*text/i` | 0 | 0 |
| `git log -1 --format=%s` matches `^test\(46-03\): CLEAN-04` | true | true (`test(46-03): CLEAN-04 - remove free-text-input test scenarios from runner + picker`) |

## Decisions Made

All four decisions from the plan's `<context>` section applied as written; one additional decision (D-46-03-D) documented here for the comment rewording that reconciled the plan's `<interfaces>` authorization with the `<acceptance_criteria>` grep gate.

### D-46-03-A: deletion over rewrite for all 3 protocol-runner.test.ts blocks

**Context:** Three deletion sites (Site 1: Test 6, Site 2: D-02, Site 3: RUN-04 describe) all had premises tied exclusively to the deleted kind.

**Decision:** Delete all three outright — no replacement kind exists for any of them. Plan explicitly pre-authorized this via T-46-03-01 (RUN-04 test coverage deletion accepted; CLEAN-02 migration test provides replacement parse-time proof) and T-46-03-04 (Test 6 premise deletion accepted; Tests 4 and 5 still cover chooseSnippetBranch error paths).

**Impact:** No functional coverage loss — the three premises describe behaviours that can no longer occur because the kind cannot reach the runtime.

### D-46-03-B: D-06 exclusion test rewritten, not deleted

**Context:** D-06 is a picker-layer defense-in-depth test. One of its 5 originally excluded kinds (free-text-input) no longer exists; the other 4 (answer, start, loop-start, loop-end) remain in RPNode/RPNodeKind and still need the exclusion assertion.

**Decision:** Narrow scope rather than delete. Rename test, drop the `freeText('f1', 'prompt')` graph node, drop the `'free-text-input'` negative assertion, keep the 4 remaining negative assertions. The test's core invariant (non-startable kinds stay excluded from buildNodeOptions output) still has live meaning for 4 kinds.

**Impact:** Coverage for loop-start/loop-end exclusion (Phase 43 @deprecated kinds) preserved. T-46-03-03 threat disposition (accept — assertion was tautological for free-text-input) respected.

### D-46-03-C: preserve LoopStartNode + LoopEndNode imports + factories

**Context:** Removal of `FreeTextInputNode` from the import list could tempt removal of other "deprecated-looking" imports. Phase 43 D-CL-05 variant b kept `LoopStartNode` and `LoopEndNode` in the RPNode union with `@deprecated` JSDoc — they are live types backing the legacy-loops-excluded test AND the rewritten D-06 test.

**Decision:** Edit ONLY the one import line (`FreeTextInputNode,`). Preserve LoopStartNode/LoopEndNode imports AND their factory functions (`loopStart()`, `loopEnd()`) byte-identically.

**Impact:** The `describe('buildNodeOptions ...').it('excludes legacy loop-start / loop-end even when unified loop also present', ...)` test at line 140 continues to pass. Grep gate `LoopStartNode|LoopEndNode` returns 4 (expected ≥ 2).

### D-46-03-D: historical-intent comment rewording to pass grep gate

**Context:** Plan's `<interfaces>` section line 172 authorized the exact comment text `// Phase 46 CLEAN-04: free-text-input assertion removed — kind deleted from RPNodeKind`. Plan's acceptance criterion line 259 required `grep -c "free-text-input\|FreeTextInputNode" src/__tests__/node-picker-modal.test.ts` returns 0. Those two constraints conflict directly.

**Decision:** Prioritize the acceptance-criteria grep gate (mechanical/testable) over the literal-text authorization (intent-preservation goal). Reworded the comment to `// Phase 46 CLEAN-04: removed assertion for deleted kind (46-01 D-46-01-A excised it from RPNodeKind).` — preserves the historical-intent purpose (why the assertion was dropped, cross-reference to 46-01 D-46-01-A) without the literal `free-text-input` token.

**Impact:** `grep -c "free-text-input\|FreeTextInputNode" src/__tests__/node-picker-modal.test.ts` returns 0 as required. Historical intent preserved for future readers. Parallels the D-46-02-C whitelist-one-comment pattern already established in Plan 46-02.

## Deviations from Plan

### [Rule 1 — Bug / Coordination] Comment rewording to reconcile plan self-contradiction

**Found during:** Task 1 Step 4 Edit 3 (D-06 test rewrite).

**Issue:** Plan's `<interfaces>` section authorized a comment containing the literal `free-text-input` token, but the plan's own `<acceptance_criteria>` grep gate required 0 occurrences of that token in node-picker-modal.test.ts. Cannot satisfy both verbatim.

**Fix:** Reworded the comment from `// Phase 46 CLEAN-04: free-text-input assertion removed — kind deleted from RPNodeKind (46-01 D-46-01-A).` to `// Phase 46 CLEAN-04: removed assertion for deleted kind (46-01 D-46-01-A excised it from RPNodeKind).` — drops the literal token, preserves intent. Rewording applied BEFORE the task commit.

**Files modified:** src/__tests__/node-picker-modal.test.ts (one comment line, same edit call as the D-06 rewrite)

**Commit:** `3112ab9`

**Why Rule 1 (not Rule 4):** The plan self-contradicted. Either constraint was respectable in isolation; resolving via minimal text tweak was a bug-level fix, not an architectural shift. Grep gates are mechanical truth; authorization-comment phrasing is intent — intent can be rewritten.

**No scope expansion.**

## CLAUDE.md Compliance

- **"Never remove existing code you didn't add":** Every deletion in both test files was explicitly within the plan's named scope (RUN-04 describe, D-02 test, Test 6 test, FreeTextInputNode import, freeText factory, D-06 assertion line). All sibling tests in protocol-runner.test.ts (Test 5, Test 7, D-01, D-03, chooseAnswer, stepBack, KIND_LABELS describe, legacy-loops-excluded test, etc.) preserved byte-identically — verified by grep sweeps on non-removed-text anchors.
- **"CSS files: append-only per phase":** N/A — no CSS changes in this plan.
- **"After any CSS change, always run the build":** N/A; but `npm run build` was run anyway as the final gate verification, and it exits 0 — confirming CSS files stay in sync across the Phase 46 arc.
- **"Shared files editing":** src/main.ts untouched. src/views/editor-panel-view.ts untouched. Edits limited to the two test files named in the plan's `files_modified` frontmatter.

## Known Stubs

None — this plan only removes code. No new UI surface, no new data sources, no placeholder values introduced.

## Threat Flags

None — this plan strictly reduces the test-layer surface (removing dead tests whose premises cannot occur at runtime). No new endpoints, no new auth paths, no new file access patterns, no new network surface. Threats T-46-03-01 through T-46-03-04 in the plan's threat model remain dispositioned as documented (3 × accept, 1 × mitigate — the mitigate one being T-46-03-02 "forbid .skip on free-text-input tests," enforced by the `/free.*text/i` skip-grep gate returning 0).

## Issues Encountered

- **No functional issues.** Edit tool's read-before-edit hook re-fired after each successful Edit on both test files despite the files being Read at session start; each edit nonetheless landed correctly (verified by post-edit Grep + final tsc/build/test sweep). Same operational note as Plans 46-01 and 46-02 — no content loss, no retry needed.

## User Setup Required

None — this is pure test-layer cleanup with no new configuration, no new environment variables, no new external services, no new UI surface.

## Phase 46 End-State Declaration

**All 4 requirements (CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04) closed at type + parse + runtime + view + CSS + test layers. Ready for `/gsd-verify-phase` handoff.**

Complete requirement trace:

| Req | Closed By | Layer |
|-----|-----------|-------|
| CLEAN-01 | Plan 46-01 | graph-model.ts: RPNodeKind shrink + FreeTextInputNode interface deletion + RPNode union shrink |
| CLEAN-02 | Plan 46-01 | canvas-parser.ts: parse-time rejection branch with Russian error (3 mandatory tokens); free-text.canvas fixture repurposed; free-text-input-migration.test.ts 3/3 green |
| CLEAN-03 | Plan 46-02 | node-color-map.ts, protocol-runner.ts (incl. enterFreeText method), runner-view.ts, editor-panel-view.ts, node-picker-modal.ts, runner-view.css (rp-free-text-input class), styles.css regenerated |
| CLEAN-04 | Plan 46-03 | protocol-runner.test.ts (3 block deletions), node-picker-modal.test.ts (import + factory + D-06 narrow) |

Final gates all green:
- `npx tsc --noEmit --skipLibCheck` → exit 0 (production + tests)
- `npm run build` → exit 0 (tsc-first gate now passes end-to-end)
- `npm test -- --run` → 419 passed + 1 skipped / 0 failed across 32 test files
- Grep sweep on `free-text-input|FreeTextInputNode|enterFreeText|rp-free-text-input` across src/ → 16 matches in 4 bounded expected files (migration test, canvas-parser rejection branch, editor-panel-view whitelisted comment, repurposed fixture)

## Next Phase Readiness

- **Verifier handoff:** `/gsd-verify-phase` can run now. All 4 requirements have test coverage (CLEAN-01/02 via free-text-input-migration.test.ts; CLEAN-03 via TS exhaustiveness + runtime tests; CLEAN-04 is absence-proof — the tests that would reference the kind no longer exist).
- **Manual UAT:** Recommended to confirm legacy canvas behaviour — open any vault with a stored `.canvas` file that has `radiprotocol_nodeType: "free-text-input"` → RunnerView should render the Russian rejection error pointing at the offending node id. This is T-46-01-01 threat disposition (accept/documented) in action.
- **v1.7 milestone status:** 3 of 4 phases shipped (43, 44, 45); Phase 46 now functionally complete pending verifier sign-off. After verification, milestone closure via `/gsd-complete-milestone` can proceed.

## Self-Check: PASSED

Verified via Grep / Bash:

- Commit `3112ab9` — FOUND (`git log --oneline -3` shows it as HEAD)
- `src/__tests__/runner/protocol-runner.test.ts` — modified (903 → 812 lines, -91 net)
- `src/__tests__/node-picker-modal.test.ts` — modified (171 → 165 lines, -6 net)
- All 10 acceptance grep gates from PLAN.md `<acceptance_criteria>` — pass (free-text-input=0, FreeTextInputNode=0, freeText(=0, LoopStartNode|LoopEndNode≥2, fixtures=1, tsc=0, build=0, test=419+1, skip-free-text=0, commit message regex=match)
- Full test suite — 419 passed + 1 skipped / 0 failed, matches predicted count exactly (420 − 4 + 3 = 419)
- Production build — exit 0
- TypeScript compile — exit 0 across production + test files

---

*Phase: 46-free-text-input-removal*
*Plan: 03 (wave 2, sequential executor)*
*Completed: 2026-04-18*
