---
phase: 46-free-text-input-removal
verified: 2026-04-18T16:05:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 46: free-text-input-removal Verification Report

**Phase Goal:** The `free-text-input` node kind is gone from every layer of the plugin — model, parser, validator, runner, editor, picker, colour map, and test fixtures — restoring the original v1.0 decision after the v1.2 regression.

**Verified:** 2026-04-18T16:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (roadmap SC + merged plan must-haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | TypeScript graph model no longer exports `FreeTextInputNode` and `free-text-input` is absent from `RPNodeKind`; build is green with no broken imports (CLEAN-01) | VERIFIED | `src/graph/graph-model.ts:9-17` — `RPNodeKind` union has 8 members, no `free-text-input`; `grep -c "FreeTextInputNode" src/graph/graph-model.ts` = 0; `npx tsc --noEmit --skipLibCheck` exit 0 |
| SC-2 | Parsing a canvas node with `radiprotocol_nodeType = "free-text-input"` produces a validator error — no longer silently accepted (CLEAN-02) | VERIFIED | `src/graph/canvas-parser.ts:168-170` rejection branch returns `{ parseError }` with Russian text containing «устаревший», «free-text-input», raw.id; `free-text-input-migration.test.ts` 3/3 green |
| SC-3 | `EditorPanelView`, `NodePickerModal`, `NODE_COLOR_MAP`, and the runner state machine contain no remaining references to `free-text-input`; Node Editor dropdown no longer offers it (CLEAN-03) | VERIFIED | Grep sweep across src/runner/, src/views/, src/canvas/, src/graph/ returns only the whitelisted comment at `editor-panel-view.ts:346` and the 3-line rejection branch in canvas-parser.ts. Node Editor dropdown (lines 339-345) lists `start, question, answer, text-block, snippet, loop` — no free-text-input |
| SC-4 | `src/__tests__/fixtures/free-text.canvas` and every free-text-input-specific test case are removed or rewritten; `npm test` is green with no skipped or orphaned free-text-input tests (CLEAN-04) | VERIFIED | Fixture retained per D-46-01-C and rewritten-by-role (ROADMAP "removed or rewritten" satisfied); 4 dead tests deleted in `protocol-runner.test.ts`; D-06 exclusion test narrowed in `node-picker-modal.test.ts`; `npm test -- --run` → 419 passed + 1 skipped / 0 failed; 0 skipped free-text-input tests |
| P-1 | `GraphValidator` emits Russian rejection with three mandatory tokens (D-46-01-B) | VERIFIED | Error text at canvas-parser.ts:169 contains all three tokens («устаревший» / «free-text-input» / node-id interpolation); migration test verifies tokens for fixture id `n-ft1` and inline id `ft-x` |
| P-2 | `ProtocolRunner` has no `enterFreeText()` method, no `case 'free-text-input':`, and no reference in any comment | VERIFIED | `grep "enterFreeText" src/runner/protocol-runner.ts` = 0; `grep "free-text-input" src/runner/protocol-runner.ts` = 0; advanceThrough compile-clean with exhaustive switch |
| P-3 | `.rp-free-text-input` CSS class removed; generated CSS regenerated | VERIFIED | `grep "rp-free-text-input"` returns 0 in `src/styles/runner-view.css`, `styles.css`, `src/styles.css` |
| P-4 | Fixture `free-text.canvas` retained with byte-identical content; semantic role flipped to CLEAN-02 rejection proof | VERIFIED | Fixture file intact, contains legacy `"radiprotocol_nodeType": "free-text-input"` at node `n-ft1`; consumed only by `free-text-input-migration.test.ts` (Test 1) as rejection fixture; ROADMAP SC #4 wording "removed or rewritten" satisfied via rewrite-by-role path (D-46-01-C honored) |
| P-5 | `npm run build` exits 0 | VERIFIED | `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production` completes successfully, copies to dev vault |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/graph/graph-model.ts` | Union without free-text-input; interface deleted; RPNode shrunk | VERIFIED | RPNodeKind (lines 9-17) has 8 members; no FreeTextInputNode interface; RPNode union has 8 arms |
| `src/graph/canvas-parser.ts` | No FreeTextInputNode import; rejection branch with Russian error | VERIFIED | Grep `FreeTextInputNode` = 0; rejection branch at lines 165-170 fires before validKinds.includes |
| `src/graph/graph-validator.ts` | No free-text-input case in nodeLabel() switch | VERIFIED | Grep `free-text-input` = 0 |
| `src/canvas/node-color-map.ts` | `Record<RPNodeKind,string>` without free-text-input key | VERIFIED | 8 keys in NODE_COLOR_MAP matching the shrunk RPNodeKind; TS exhaustiveness enforced |
| `src/runner/protocol-runner.ts` | No enterFreeText, no case arm, no FreeTextInputNode import | VERIFIED | Grep count = 0 for all three patterns |
| `src/runner/runner-state.ts` | JSDoc scrubbed of enterFreeText / free-text-input | VERIFIED | Grep count = 0 |
| `src/views/runner-view.ts` | No render arm for free-text-input | VERIFIED | Grep count = 0 |
| `src/views/editor-panel-view.ts` | No `'free-text-input'` literal; refreshed comment only | VERIFIED | `grep "'free-text-input'"` = 0; one comment at line 346 (whitelisted per D-46-02-C) |
| `src/views/node-picker-modal.ts` | Exclusion comments trimmed | VERIFIED | Grep count = 0; line 76 comment reads `// answer, start, loop-start, loop-end — сознательно исключены (D-06)` |
| `src/styles/runner-view.css` | No .rp-free-text-input rule | VERIFIED | Grep count = 0 |
| `styles.css` / `src/styles.css` | Regenerated, no .rp-free-text-input | VERIFIED | Grep count = 0 in both; .rp-answer-btn + .rp-step-back-btn preserved |
| `src/__tests__/fixtures/free-text.canvas` | Retained, one free-text-input node present (D-46-01-C) | VERIFIED | File intact (10 lines), id `n-ft1` with legacy kind; only consumer is the migration test |
| `src/__tests__/free-text-input-migration.test.ts` | New test file, 3 rejection tests | VERIFIED | 3 tests: fixture rejection, inline JSON rejection, negative control on text-block.canvas; all green |
| `src/__tests__/runner/protocol-runner.test.ts` | Dead tests deleted | VERIFIED | Grep count = 0 for free-text-input / FreeTextInputNode / enterFreeText |
| `src/__tests__/node-picker-modal.test.ts` | Import + factory removed; D-06 narrowed | VERIFIED | Grep count = 0 for free-text-input / FreeTextInputNode / freeText(; LoopStartNode/LoopEndNode still imported (Phase 43 @deprecated) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| TypeScript exhaustiveness over RPNodeKind | Each consumer file | Compile-time forcing function | WIRED | `npx tsc --noEmit --skipLibCheck` exits 0 — no orphan case arms, no missing arms |
| src/styles/runner-view.css | styles.css / src/styles.css | esbuild CSS_FILES concatenation | WIRED | Generated files regenerated; grep audit confirms class-absence parity across source and generated CSS |
| CanvasParser rejection branch | RunnerView error panel | `{ success: false; error }` contract already surfaced by existing MIGRATE-01 rendering (Phase 43) | WIRED | Migration test verifies parseResult.success === false with Russian error tokens; existing RunnerView error rendering handles the same `{ success: false }` shape |
| Phase 46 migration test | free-text.canvas fixture | fs.readFileSync + CanvasParser.parse | WIRED | Test 1 consumes the fixture and asserts Russian error tokens |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TS compile clean (production + tests) | `npx tsc --noEmit --skipLibCheck` | exit 0 | PASS |
| Production build end-to-end | `npm run build` | exit 0; copies to dev vault | PASS |
| Full test suite green | `npm test -- --run` | 419 passed + 1 skipped / 0 failed across 32 files | PASS |
| Migration test green | Included in full run | 3/3 passed (CanvasParser Phase 46 CLEAN-02 block) | PASS |
| No free-text-input skipped tests | `grep "it.skip\|describe.skip" src/__tests__` filtered by /free.*text/i | 0 matches | PASS |
| Grep sweep bounded | `grep -rn "free-text-input|FreeTextInputNode|enterFreeText|rp-free-text-input" src/` | 16 matches in 4 expected files only (canvas-parser.ts×3, editor-panel-view.ts×1, migration test×11, fixture×1) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CLEAN-01 | 46-01 | `free-text-input` removed from `RPNodeKind`; `FreeTextInputNode` interface deleted | SATISFIED | graph-model.ts verified; tsc exit 0; REQUIREMENTS.md line confirms complete |
| CLEAN-02 | 46-01 | Canvas parser rejects `radiprotocol_nodeType="free-text-input"` with a GraphValidator-surface error | SATISFIED | Rejection branch at canvas-parser.ts:168-170; migration test 3/3 green; Russian error contains all three mandatory tokens (D-46-01-B) |
| CLEAN-03 | 46-02 | Runner, Node Editor, NodePickerModal, NODE_COLOR_MAP cleaned; CSS rule deleted | SATISFIED | All 7 consumer files verified; only whitelisted comment in editor-panel-view.ts:346; Node Editor dropdown does not offer free-text-input |
| CLEAN-04 | 46-03 | Fixture removed-or-rewritten and free-text-input tests removed/rewritten | SATISFIED | 4 dead tests deleted in protocol-runner.test.ts (RUN-04 describe + D-02 + Test 6); D-06 exclusion test narrowed in node-picker-modal.test.ts; fixture retained with semantic-role flip (D-46-01-C, ROADMAP "rewrite" path); 3 new CLEAN-02 tests added; 419 passed + 1 skipped |

No orphaned requirement IDs — REQUIREMENTS.md maps Phase 46 to exactly CLEAN-01..04 and all four are claimed by plans 46-01..03.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

Sweep across modified files (graph-model.ts, canvas-parser.ts, graph-validator.ts, protocol-runner.ts, runner-state.ts, runner-view.ts, editor-panel-view.ts, node-picker-modal.ts, runner-view.css, protocol-runner.test.ts, node-picker-modal.test.ts, free-text-input-migration.test.ts) returned no TODO/FIXME/placeholder/console.log stubs introduced by Phase 46.

Review report (46-REVIEW.md) flagged 2 info-level findings (IN-01 dead `|| id` branch in node-picker-modal.ts:71 — PRE-EXISTING, not a Phase 46 regression; IN-02 `validKinds` array duplicates `RPNodeKind` — refactor suggestion, not a correctness issue). Neither blocks goal achievement; both are out-of-scope cleanup opportunities for future phases.

### Human Verification Required

None. All ROADMAP success criteria are machine-verifiable through grep, TypeScript exhaustiveness, and the new migration test. The runtime side-effect (legacy canvases with `radiprotocol_nodeType="free-text-input"` show a Russian error panel to the user) is already covered by the migration test asserting `{ success: false; error }` with the mandatory Russian tokens, and the existing RunnerView error-rendering path (Phase 43 MIGRATE-02) is unchanged and already validated.

### Gaps Summary

No gaps. Phase 46 achieves its goal fully:

- All four requirements (CLEAN-01..04) closed at every named layer (type, parse, runtime, view, CSS, test).
- TypeScript exhaustiveness served as the mechanical forcing function for the consumer sweep — no hidden consumers remain.
- Fixture retention decision D-46-01-C is honored: the `.canvas` file content is byte-identical to its pre-Phase-46 state; only its semantic role (happy-path → rejection-proof) was flipped. ROADMAP SC #4 wording "removed or rewritten" is satisfied through the rewrite-by-role path.
- Build, compile, and test gates all exit green.
- Grep audit returns the exact 16-match bounded footprint predicted by Plan 46-03 SUMMARY, distributed across only 4 intentional sites (rejection branch, whitelisted comment, migration test, retained fixture).
- No skipped or orphaned free-text-input tests.

---

*Verified: 2026-04-18T16:05:00Z*
*Verifier: Claude (gsd-verifier)*
