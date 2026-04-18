---
phase: 44-unified-loop-runtime
verified: 2026-04-17T17:05:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Loop picker visual rendering in Obsidian"
    expected: "Open a canvas containing a `loop` node with `radiprotocol_headerText` set; start the protocol; verify picker shows headerText on top, body-branch button(s) labelled with edge labels (accent-coloured), `выход` button (border-modifier neutral-coloured), and step-back button when canStepBack is true. Required Obsidian theme variables resolve correctly."
    why_human: "Vitest does not load Obsidian; RunnerView extends ItemView. CSS variables (--interactive-accent, --background-modifier-border, --font-ui-medium, etc.) only resolve inside the live Obsidian DOM. Headless tests cannot assert visual rendering."
  - test: "Session resume across Obsidian restart (RUN-06 real-process)"
    expected: "Start a protocol inside a loop, halt at the picker, then close Obsidian completely. Reopen Obsidian and verify the runner resumes at the same picker with the same accumulated text and same loop iteration."
    why_human: "Automated tests simulate save/load via JSON round-trip but cannot validate the actual Obsidian process restart cycle (file persistence, plugin re-init, view re-attach). RUN-06 integration is pinned by 7 green tests but real-restart UAT is required for full sign-off."
  - test: "Step-back UX after loop entry (RUN-05 visual)"
    expected: "Start a protocol, enter the loop, pick a body branch, advance, then step back. Verify state visibly reverts to pre-loop accumulated text and the picker re-renders from the loop entry."
    why_human: "Step-back state restore is pinned by automated tests, but the visual feedback (preview textarea reset, button enable/disable transitions, picker re-render flicker) requires human observation of the live ItemView."
---

# Phase 44: Unified Loop Runtime Verification Report

**Phase Goal:** Running a protocol that contains a unified `loop` node produces the agreed single-step picker UX, walks branches correctly, returns to the loop on dead-ends, follows «выход» to leave, preserves nested-loop behaviour, and survives step-back and session restart — all without any iteration cap.

**Verified:** 2026-04-17T17:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                      | Status     | Evidence                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | RUN-01: Runner halts at `awaiting-loop-pick` and renders single picker with body labels + «выход» under headerText | VERIFIED   | `case 'loop'` arm in protocol-runner.ts:598-640 halts at `awaiting-loop-pick`; runner-view.ts:453-506 renders headerText + buttons-per-edge; 6 picker tests green; CSS classes present in styles.css |
| 2   | RUN-02: Body-branch dead-end returns to same loop picker (iteration++)                     | VERIFIED   | `advanceOrReturnToLoop` helper at protocol-runner.ts:691+ + B1 re-entry guard in case 'loop'; RUN-02 test asserts `loopContextStack.length === 1` AND `iteration === 2` after back-edge re-entry |
| 3   | RUN-03: Following «выход» pops loop frame and exits the loop                               | VERIFIED   | `chooseLoopBranch` at protocol-runner.ts:166-202 dispatches on `edge.label === 'выход'` → `loopContextStack.pop()` → advance along exit edge; RUN-03 test green    |
| 4   | RUN-04: Nested loops preserve parent state when inner loop exits                           | VERIFIED   | B1 re-entry guard ensures inner-«выход» landing on outer loop node increments outer iteration in-place WITHOUT pushing new frame; RUN-04 test asserts single outer frame after inner exit + iteration=2 |
| 5   | RUN-05: Step-back from loop picker restores pre-loop state                                 | VERIFIED   | Undo-before-mutate at protocol-runner.ts:627-631 captures pre-loop snapshot; B2 `previousCursor` threading ensures `canStepBack=true` even at first halt; RUN-05 test asserts `loopContextStack.length === 0` after stepBack |
| 6   | RUN-06: Saving and reloading session at picker resumes at same picker                      | VERIFIED   | `getSerializableState`/`restoreFrom` widened to accept `awaiting-loop-pick`; PersistedSession.runnerStatus union widened; 7 RUN-06 round-trip tests green (idempotent JSON, accumulatedText preserved, loopContextStack iteration=2 survives) |
| 7   | RUN-07: Legacy `maxLoopIterations` and per-loop `maxIterations` removed; RUN-09 cycle guard intact | VERIFIED   | `grep maxLoopIterations` returns 0 in src/settings.ts; `grep maxIterations` returns 0 in src/graph/graph-model.ts; `grep radiprotocol_maxIterations` returns 0 in src/graph/canvas-parser.ts; `this.maxIterations` returns 3 in protocol-runner.ts (RUN-09 guard); `iteration cap` test still passes |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                          | Expected                                                | Status      | Details                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `src/runner/runner-state.ts`                                      | `AwaitingLoopPickState` interface + extended union      | VERIFIED    | Lines 43-48: interface with status/nodeId/accumulatedText/canStepBack; line 83: union extended; deprecated fields removed |
| `src/runner/protocol-runner.ts`                                   | `case 'loop'` runtime + `chooseLoopBranch` + helpers    | VERIFIED    | 717 lines; case 'loop' at 598-640 with B1 guard + B2 threading; chooseLoopBranch at 166-202; advanceOrReturnToLoop helper; 11 hits awaiting-loop-pick, 4 hits chooseLoopBranch, 3 hits this.maxIterations |
| `src/sessions/session-model.ts`                                   | `runnerStatus` union widened                            | VERIFIED    | Line 51: union includes `'awaiting-loop-pick'`; JSDoc at line 48 lists it among valid resume states  |
| `src/views/runner-view.ts`                                        | `case 'awaiting-loop-pick'` render arm + needsConfirmation | VERIFIED  | Render arm at 453-506: graph guard, node lookup, headerText render, edge.filter, button-per-edge with click handler, step-back; line 255 needsConfirmation extended |
| `src/styles/loop-support.css`                                     | Phase 44 picker CSS appended (4 classes)                | VERIFIED    | Phase 6 block preserved at lines 1-45; Phase 44 marker at line 47 + 4 classes (header-text, picker-list, body-btn, exit-btn); regenerated styles.css contains all classes |
| `src/settings.ts`                                                 | `maxLoopIterations` field + UI Setting REMOVED          | VERIFIED    | 0 hits for `maxLoopIterations`, `Max loop iterations`, `Protocol engine`, or `Notice` in settings.ts |
| `src/graph/graph-model.ts`                                        | `LoopStartNode.maxIterations` REMOVED                   | VERIFIED    | 0 hits for `maxIterations` in graph-model.ts                                                         |
| `src/graph/canvas-parser.ts`                                      | `radiprotocol_maxIterations` parser line REMOVED        | VERIFIED    | 0 hits for `radiprotocol_maxIterations` or `maxIterations` in canvas-parser.ts                       |
| `src/views/editor-panel-view.ts`                                  | Legacy form arms REMOVED + informational stub present   | VERIFIED    | Lines 556-565: merged `case 'loop-start': case 'loop-end':` informational stub with 'Legacy loop node' heading |
| `src/__tests__/fixtures/unified-loop-nested.canvas`               | Nested-loop fixture for RUN-04                          | VERIFIED    | 19 lines; outer 'Organ' + inner 'Lesion'; e5 inner-«выход» points to n-outer (frame-pop semantic); 2 «выход» edges  |
| `src/__tests__/fixtures/unified-loop-long-body.canvas`            | Long-body fixture for W4 cycle-guard test               | VERIFIED    | 32 lines; 1 loop + 10 text-blocks + back-edge n-t10→n-loop                                           |
| `src/__tests__/runner/protocol-runner-loop-picker.test.ts`        | RUN-01..RUN-05 + W4 picker tests                        | VERIFIED    | 6 tests pass; covers RUN-01 halt, RUN-02 back-edge B1+I1, RUN-03 «выход» complete, RUN-04 nested B1, RUN-05 step-back B2, W4 long-body cycle-guard |
| `src/__tests__/runner/protocol-runner-session.test.ts`            | RUN-06 round-trip tests                                 | VERIFIED    | 14 tests pass; 7 new RUN-06 tests against `unified-loop-valid.canvas`; zero `.skip` markers          |

### Key Link Verification

| From                                       | To                                              | Via                                                                        | Status | Details                                                                                                |
| ------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `src/runner/protocol-runner.ts`            | `src/runner/runner-state.ts`                    | `import type { RunnerState, UndoEntry }`                                   | WIRED  | `awaiting-loop-pick` literal used 11× in protocol-runner.ts; getState arm returns matching shape       |
| `src/runner/protocol-runner.ts`            | `src/sessions/session-model.ts`                 | `runnerStatus` literal in `getSerializableState`/`restoreFrom`             | WIRED  | Both signatures contain `'awaiting-loop-pick'`; status gate widened to allow serialization at picker   |
| `src/views/runner-view.ts`                 | `src/runner/protocol-runner.ts`                 | `this.runner.chooseLoopBranch(edge.id)` in render arm click handler        | WIRED  | Line 484 dispatches on edge.id; precedes autoSaveSession + renderAsync                                 |
| `src/views/runner-view.ts`                 | `src/graph/graph-model.ts`                      | `this.graph.edges.filter(e => e.fromNodeId === state.nodeId)`              | WIRED  | Line 473: edge filter pattern (Pitfall 4); each outgoing edge becomes a button                         |
| `src/styles/loop-support.css`              | `styles.css`                                    | `npm run build` esbuild concatenation of CSS_FILES                         | WIRED  | All 4 Phase 44 classes present in regenerated styles.css; build exits 0                                |
| `src/__tests__/fixtures/unified-loop-nested.canvas` | `CanvasParser.parse`                  | `loadGraph('unified-loop-nested.canvas')` in tests                         | WIRED  | RUN-04 test loads fixture; parses cleanly; assertions pass                                             |
| `src/__tests__/fixtures/unified-loop-long-body.canvas` | `CanvasParser.parse`               | `loadGraph('unified-loop-long-body.canvas')` in W4 test                    | WIRED  | W4 test loads fixture; 10-iteration loop completes without RUN-09 trip                                 |

### Data-Flow Trace (Level 4)

| Artifact                  | Data Variable          | Source                                                          | Produces Real Data | Status |
| ------------------------- | ---------------------- | --------------------------------------------------------------- | ------------------ | ------ |
| `runner-view.ts` picker arm | `state.nodeId`        | `runner.getState()` → `case 'awaiting-loop-pick'` returns `currentNodeId` set by case 'loop' arm | Yes                | FLOWING |
| `runner-view.ts` picker arm | `outgoing` (edges)    | `this.graph.edges.filter(e => e.fromNodeId === state.nodeId)`   | Yes                | FLOWING (ProtocolGraph populated by CanvasParser; LOOP-04 validator guarantees ≥2 outgoing edges per loop node) |
| `runner-view.ts` picker arm | `node.headerText`     | `this.graph.nodes.get(state.nodeId)` → LoopNode.headerText     | Yes                | FLOWING (Phase 43 D-05: parser sets default '' when missing; render skips `<p>` when empty) |
| `runner-view.ts` picker arm | `state.accumulatedText` | `runner.accumulator.current` via `getState()`                 | Yes                | FLOWING |
| `runner-view.ts` picker arm | `state.canStepBack`   | `runner.undoStack.length > 0` in `getState()` arm              | Yes                | FLOWING (B2 fallback ensures undo entry pushed at first loop entry) |
| `protocol-runner.ts` `getSerializableState` | `loopContextStack` | runtime push/pop on case 'loop' + chooseLoopBranch        | Yes                | FLOWING (RUN-06 tests assert iteration=2 survives JSON round-trip) |

### Behavioral Spot-Checks

| Behavior                                                            | Command                                                                        | Result                                       | Status |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- | ------ |
| TypeScript compiles cleanly                                         | `npx tsc --noEmit --skipLibCheck`                                              | exit 0, no output                            | PASS   |
| Full test suite green                                               | `npm test -- --run`                                                            | 402 passed + 1 skipped / 0 failed (29 files) | PASS   |
| Production build succeeds                                           | `npm run build`                                                                | exit 0; production bundle generated; dev vault copy succeeded | PASS   |
| Picker tests pass (RUN-01..05 + W4)                                 | `npx vitest run src/__tests__/runner/protocol-runner-loop-picker.test.ts`      | 6 tests passed                               | PASS   |
| Session round-trip tests pass (RUN-06)                              | `npx vitest run src/__tests__/runner/protocol-runner-session.test.ts`          | 14 tests passed                              | PASS   |
| RUN-09 iteration cap guard intact (NOT removed by RUN-07)           | `npx vitest run -t "iteration cap"`                                            | 2 tests passed                               | PASS   |
| Settings + parser RUN-07 absence assertions pass                    | `npx vitest run src/__tests__/settings-tab.test.ts src/__tests__/canvas-parser.test.ts` | 19 tests passed                       | PASS   |
| Only `maxLoopIterations` reference is the absence-assertion in test | `grep -rn 'maxLoopIterations\|radiprotocol_maxIterations' src/`                | 1 hit (settings-tab.test.ts:14 absence assertion) | PASS |

### Requirements Coverage

| Requirement | Source Plans                       | Description                                                                                  | Status      | Evidence                                                                          |
| ----------- | ---------------------------------- | -------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| RUN-01      | 44-01, 44-02a, 44-02b, 44-03       | Picker combines body-branch labels + «выход» above headerText                                | SATISFIED   | runner-view.ts:453-506 render arm; RUN-01 test green; CSS Phase 44 classes shipped |
| RUN-02      | 44-02a, 44-02b                     | Body-branch dead-end returns to same loop picker                                              | SATISFIED   | advanceOrReturnToLoop helper + B1 re-entry guard; RUN-02 test asserts iteration=2, stack.length=1 |
| RUN-03      | 44-02a, 44-02b                     | «выход» pops loop frame and advances along exit edge                                          | SATISFIED   | chooseLoopBranch dispatches on `edge.label === 'выход'` → pop → advance; RUN-03 test green |
| RUN-04      | 44-01, 44-02a, 44-02b              | Nested loops preserve parent state via LoopContext stack                                      | SATISFIED   | B1 guard handles inner-«выход» landing on outer; RUN-04 test asserts single outer frame after inner exit |
| RUN-05      | 44-02a, 44-02b, 44-03              | Step-back from picker unwinds to pre-loop state                                               | SATISFIED   | Undo snapshot pushed at loop entry; B2 fallback ensures canStepBack=true at first halt; RUN-05 test green |
| RUN-06      | 44-02a, 44-03                      | Session save/resume preserves loop-node state                                                 | SATISFIED   | runnerStatus union widened (PersistedSession + getSerializableState + restoreFrom); 7 RUN-06 round-trip tests green |
| RUN-07      | 44-04                              | `LoopStartNode.maxIterations` and global setting removed; no runtime cap                      | SATISFIED   | All grep gates return 0; merged informational stub in editor; RUN-09 guard preserved |

All 7 phase requirements satisfied. No orphaned requirements (REQUIREMENTS.md maps RUN-01..RUN-07 to Phase 44; all 7 are covered by phase plans).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |

None. The "placeholder" string matches in protocol-runner.ts (lines 279-280) and runner-view.ts (lines 675, 691, 701-702) refer to legitimate snippet-fill modal placeholders (Phase 30 D-09), not phase 44 stubs.

### Human Verification Required

Per the 44-VALIDATION.md document (Manual-Only Verifications section), three behaviours cannot be exercised by the headless vitest suite — they require running the plugin inside Obsidian:

1. **Loop picker visual rendering in Obsidian (RUN-01)** — Open a canvas containing a `loop` node with `radiprotocol_headerText` set; start the protocol; verify the picker shows headerText on top, body-branch button(s) labelled with edge labels (accent-coloured), `выход` button (border-modifier neutral-coloured), and step-back button when `canStepBack` is true. Required Obsidian theme variables (`--interactive-accent`, `--background-modifier-border`, `--font-ui-medium`, etc.) must resolve correctly.

2. **Session resume across Obsidian restart (RUN-06)** — Start a protocol inside a loop, halt at the picker, then close Obsidian completely. Reopen Obsidian and verify the runner resumes at the same picker with the same accumulated text and same loop iteration. Automated tests simulate save/load via JSON round-trip (7 green tests) but cannot validate the actual Obsidian process restart cycle.

3. **Step-back UX after loop entry (RUN-05)** — Start a protocol, enter the loop, pick a body branch, advance, then step back. Verify state visibly reverts to pre-loop accumulated text and the picker re-renders from the loop entry. The visual feedback (preview textarea reset, button enable/disable transitions, picker re-render flicker) requires human observation of the live ItemView.

### Gaps Summary

No automated gaps. All 7 must-have observable truths verified, all artifacts present and substantive, all key links wired, all data flows trace to real sources, all behavioural spot-checks pass. Test suite green at 402 passed + 1 skipped (the 1 skip is RUN-08, explicitly deferred to Phase 45 per user-locked decision 3 — preserved with `TODO Phase 45` marker).

The status is `human_needed` solely because three RUN-01/RUN-05/RUN-06 behaviours require live Obsidian UAT that vitest cannot simulate (per the phase's own VALIDATION.md document). All other layers (runtime, type system, integration tests, build, CSS pipeline) verify clean.

---

_Verified: 2026-04-17T17:05:00Z_
_Verifier: Claude (gsd-verifier)_
