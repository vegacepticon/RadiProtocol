---
date: 2026-07-28T17:25:36+0300
author: Roman Shulgha
commit: 122d2ae
branch: main
repository: RadiProtocol
topic: "Fix validation findings: restoreStatus serialization gap, whitespace-only exit caption aria-label, stale test title"
status: ready
parent: ".rpiv/artifacts/validation/2026-07-28_17-12-07_merge-loop-node-type-into-question-via-a-loop-toggle-explicit-isloopexit-edge-flag.md"
phase_count: 3
phases:
  - { n: 1, title: Runner session serialization preserves restoreStatus }
  - { n: 2, title: Trimmed-empty exit captions get target-derived aria-label }
  - { n: 3, title: Reword stale non-plus answer branch test title }
unresolved_phase_count: 0
last_updated: 2026-07-28T17:25:36+0300
last_updated_by: Roman Shulgha
tags: [plan, runner, serialization, render, accessibility, tests, validation-fix]
---

# Validation Findings Fix Implementation Plan

## Overview

Three localized, additive fixes addressing the findings from the merge-loop validation artifact: (1) thread `UndoEntry.restoreStatus` through `getSerializableState()`/`restoreFrom()` so a save/restore round-trip preserves loop-picker restoration on `stepBack()`; (2) gate the loop-picker exit-button `aria-label` fallback on `caption.trim() === ''` so whitespace-only exit labels stay accessible; (3) reword one stale `non-plus answer branch` test title to structural `isLoopExit` wording.

## Requirements

- Preserve `UndoEntry.restoreStatus` across `getSerializableState()` → JSON → `restoreFrom()` so `stepBack()` after a restored session restores `awaiting-loop-pick` (not `at-node`) when the popped entry was pushed by `chooseLoopBranch`/first loop-entry.
- Add a JSON round-trip + `stepBack()` regression test proving the restored-session undo path re-enters the loop picker.
- Treat trimmed-empty exit captions as unlabeled when assigning the target-derived `aria-label`; keep the verbatim visible text (whitespace preserved).
- Add a render test proving a whitespace-only `edge.label` produces the target-derived `aria-label`.
- Reword the stale `non-plus answer branch` test title to reference `isLoopExit` structural wording.
- All fixes are additive and backwards-compatible; existing tests stay green.

## Current State Analysis

- `UndoEntry.restoreStatus` is declared optional in `src/runner/runner-state.ts:66-73` and is pushed by `chooseLoopBranch` (`src/runner/protocol-runner.ts:235-240`) and the first loop-entry path in `advanceThrough` (`src/runner/protocol-runner.ts:720-730`). `stepBack()` consumes it at `src/runner/protocol-runner.ts:284` (`this.runnerStatus = entry.restoreStatus ?? RUNNER_STATUS.AT_NODE`).
- The serialization seam drops it: `getSerializableState()` (`src/runner/protocol-runner.ts:543-585`) maps only `{ nodeId, textSnapshot, loopContextStack, returnToBranchList }`; `restoreFrom()` (`src/runner/protocol-runner.ts:605-633`) mirrors the same omission. Both inline type signatures also omit `restoreStatus` on the undoStack element.
- The loop picker aria-label fallback gates on `caption === ''` (`src/runner/render/render-loop-picker.ts:57`), so a whitespace-only `edge.label` renders a visually blank button with no accessible name. `accessibleTargetCaption` is already computed via `.trim() !== ''` at `src/runner/render/render-loop-picker.ts:51`.
- One stale test title at `src/__tests__/runner/protocol-runner-loop-picker.test.ts:671` still says `non-plus answer branch` after exit semantics moved to the explicit `isLoopExit` edge flag.

### Key Discoveries

- `src/runner/runner-state.ts:66-73` — `UndoEntry.restoreStatus?: RunnerState['status']` already exists; only the serialization seams need threading, no new types.
- `src/runner/protocol-runner.ts:559-585,617-633` — the two mapping literals and their inline type signatures are the exact edit sites for Finding 2.
- `src/runner/render/render-loop-picker.ts:51,57` — `accessibleTargetCaption` already trims; only the `attr:` gate needs to switch from `caption === ''` to `caption.trim() === ''`.
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts:671` — stale title string; the test body already uses `isLoopExit: true` edges, only the prose title is stale.
- `src/__tests__/runner/render-loop-picker.test.ts` — existing `an unlabeled exit edge renders empty visible text but a target-derived aria-label` test is the template for the new whitespace-only variant.

## Desired End State

```typescript
// Serialization preserves restoreStatus — restored session stepBack re-enters the loop picker
runner.start(loopGraph);
runner.chooseLoopBranch('e2');           // pushes restoreStatus: 'awaiting-loop-pick'
// ... host persists via getSerializableState(); later session restores:
const snap = JSON.parse(JSON.stringify(runner.getSerializableState()));
const restored = new ProtocolRunner();
restored.setGraph(loopGraph);
restored.restoreFrom(snap);
// advance to a state with an undo entry pushed by chooseLoopBranch, then round-trip + stepBack
restored.stepBack();
expect(restored.getState().status).toBe('awaiting-loop-pick'); // NOT 'at-node'
```

```typescript
// Whitespace-only exit caption keeps verbatim visible text but gains target-derived aria-label
const exitBtn = findByClass(actionZone, 'rp-loop-exit-btn')[0]!;
expect(exitBtn.text).toBe('   ');                 // verbatim whitespace preserved
expect(exitBtn.attrs.get('aria-label')).toBe('Done'); // target-derived fallback
```

## What We're NOT Doing

- Not changing `UndoEntry`/`RedoEntry` type definitions in `runner-state.ts` — `restoreStatus` already exists there.
- Not altering `stepBack()`/`redo()` consumption logic — only the serialization seams.
- Not collapsing whitespace in the visible exit-button text — only the `aria-label` fallback gate changes.
- Not reworking loop-picker rendering structure, exit classification, or edge filtering.
- Not touching the migration transform, parser, validator, editor, picker, or i18n layers — those validation findings were already resolved.
- Not re-running `/skill:validate` as part of this plan — that is the developer's follow-up after implementation.

## Decisions

### Decision 1: Thread restoreStatus through both serialization seams (additive)

The `UndoEntry.restoreStatus` field already carries the desired post-stepBack status. `getSerializableState()` and `restoreFrom()` simply omit it from their mapping literals and inline type signatures. Decision: add `restoreStatus?: RunnerState['status']` to both inline undoStack element types and both `.map(e => ({ ... }))` literals. Modeled after the existing `returnToBranchList` threading at `src/runner/protocol-runner.ts:567,624`. Backwards-compatible: snapshots persisted before this change lack the field, so `entry.restoreStatus ?? RUNNER_STATUS.AT_NODE` still resolves to `at-node` (identical to pre-fix behavior). No persisted protocol-document schema change — only runner session state, which is additive.

### Decision 2: Gate aria-label fallback on trimmed-empty caption

`caption === ''` misses whitespace-only `edge.label`. Decision: change the gate to `caption.trim() === ''` at `src/runner/render/render-loop-picker.ts:57`. The visible `text: caption` stays verbatim (whitespace preserved per the verbatim-caption contract); only the `aria-label` assignment broadens. `accessibleTargetCaption` already computes the correct fallback target via the same `.trim()` check at line 51, so no new helper is needed.

### Decision 3: Reword stale test title only

The test body at `src/__tests__/runner/protocol-runner-loop-picker.test.ts:671-715` already constructs `isLoopExit: true` edges and asserts structural behavior; only the prose title `non-plus answer branch` is stale. Decision: reword to `isLoopExit answer branch` (or equivalent structural wording) without touching the test body. Cosmetic only — no behavioral change.

## Phase 1: Runner session serialization preserves restoreStatus

### Overview
Depends on nothing (foundation — the substantive fix). Thread `UndoEntry.restoreStatus` through `getSerializableState()` and `restoreFrom()` and add a JSON round-trip + `stepBack()` regression test.

### Changes Required:

#### 1. src/runner/protocol-runner.ts
**File**: src/runner/protocol-runner.ts
**Changes**: MODIFY — add `restoreStatus?: RunnerState['status']` to both inline undoStack element types and both mapping literals in `getSerializableState()` and `restoreFrom()`.

```typescript
// === getSerializableState() — inline return type (undoStack element) ===
// BEFORE:
//   undoStack: Array<{ nodeId: string; textSnapshot: string; loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>; returnToBranchList?: boolean }>;
// AFTER:
    undoStack: Array<{ nodeId: string; textSnapshot: string; loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>; returnToBranchList?: boolean; restoreStatus?: RunnerState['status'] }>;

// === getSerializableState() — mapping literal ===
// BEFORE:
//       undoStack: this.undoStack.map(e => ({
//         nodeId: e.nodeId,
//         textSnapshot: e.textSnapshot,
//         loopContextStack: e.loopContextStack.map(f => ({ ...f })),
//         returnToBranchList: e.returnToBranchList,
//       })),
// AFTER:
      undoStack: this.undoStack.map(e => ({
        nodeId: e.nodeId,
        textSnapshot: e.textSnapshot,
        loopContextStack: e.loopContextStack.map(f => ({ ...f })),
        returnToBranchList: e.returnToBranchList,
        restoreStatus: e.restoreStatus,
      })),

// === restoreFrom(session) — inline param type (undoStack element) ===
// BEFORE:
//     undoStack: Array<{ nodeId: string; textSnapshot: string; loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>; returnToBranchList?: boolean }>;
// AFTER:
    undoStack: Array<{ nodeId: string; textSnapshot: string; loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>; returnToBranchList?: boolean; restoreStatus?: RunnerState['status'] }>;

// === restoreFrom(session) — mapping literal ===
// BEFORE:
//     this.undoStack = session.undoStack.map(e => ({
//       nodeId: e.nodeId,
//       textSnapshot: e.textSnapshot,
//       loopContextStack: e.loopContextStack.map(f => ({ ...f })),
//       returnToBranchList: e.returnToBranchList,
//     }));
// AFTER:
    this.undoStack = session.undoStack.map(e => ({
      nodeId: e.nodeId,
      textSnapshot: e.textSnapshot,
      loopContextStack: e.loopContextStack.map(f => ({ ...f })),
      returnToBranchList: e.returnToBranchList,
      restoreStatus: e.restoreStatus,
    }));
```

Note: `RunnerState` is already imported at `src/runner/protocol-runner.ts:4` (`import type { RunnerState, UndoEntry, RedoEntry } from './runner-state';`). `UndoEntry.restoreStatus?: RunnerState['status']` is already declared in `runner-state.ts`. `stepBack()` already consumes it via `this.runnerStatus = entry.restoreStatus ?? RUNNER_STATUS.AT_NODE`. Backwards-compatible: snapshots persisted before this fix lack the field, so `entry.restoreStatus ?? RUNNER_STATUS.AT_NODE` still resolves to `at-node`.

#### 2. src/__tests__/runner/protocol-runner-snapshot.test.ts
**File**: src/__tests__/runner/protocol-runner-snapshot.test.ts
**Changes**: MODIFY — insert a JSON round-trip + `stepBack()` regression test inside the `describe('snapshot — awaiting-loop-pick (RUN-06)')` block (after the existing `loopContextStack with iteration=2 survives JSON round-trip` test). This suite owns `getSerializableState()`/`restoreFrom()` round-trip coverage and already imports `unifiedLoopValidGraph` + `ProtocolRunner`.

```typescript
  it('SESSION-RT: restored session stepBack re-enters awaiting-loop-pick (restoreStatus survives JSON round-trip)', () => {
    const graph = unifiedLoopValidGraph();
    const runner = new ProtocolRunner();
    runner.start(graph);
    // start() → first loop-entry pushes UndoEntry{restoreStatus:'awaiting-loop-pick'} at n-loop
    expect(runner.getState().status).toBe('awaiting-loop-pick');
    // chooseLoopBranch body pushes a second UndoEntry{restoreStatus:'awaiting-loop-pick'}, advances to n-q1
    runner.chooseLoopBranch('e2');
    let state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('n-q1');

    // Persist via getSerializableState and round-trip through JSON (host persistence boundary).
    // Cast as `typeof saved` to catch type drift in the serialized shape (snapshot-suite convention).
    const saved = runner.getSerializableState();
    expect(saved).not.toBeNull();
    if (saved === null) return;
    // restoreStatus MUST survive the round-trip — this is the regression.
    expect(saved.undoStack[saved.undoStack.length - 1]?.restoreStatus).toBe('awaiting-loop-pick');
    const json = JSON.stringify(saved);
    const deserialized = JSON.parse(json) as typeof saved;

    const restored = new ProtocolRunner();
    restored.setGraph(graph);
    restored.restoreFrom(deserialized);
    let rState = restored.getState();
    expect(rState.status).toBe('at-node');
    if (rState.status !== 'at-node') return;
    expect(rState.currentNodeId).toBe('n-q1');
    expect(rState.canStepBack).toBe(true);

    // stepBack on the restored session re-enters the loop picker (NOT at-node) —
    // proves restoreStatus was preserved through the serialization seam.
    restored.stepBack();
    rState = restored.getState();
    expect(rState.status).toBe('awaiting-loop-pick');
    if (rState.status !== 'awaiting-loop-pick') return;
    expect(rState.nodeId).toBe('n-loop');
  });
```

### Success Criteria:

#### Automated Verification:
- [x] Phase 1 focused tests pass: `npx vitest run src/__tests__/runner/protocol-runner-snapshot.test.ts`
- [x] Grep guard: `grep -n "restoreStatus" src/runner/protocol-runner.ts` shows matches in both `getSerializableState` and `restoreFrom` mapping literals
- [x] New `SESSION-RT` test asserts `saved.undoStack[...].restoreStatus === 'awaiting-loop-pick'` and `restored.stepBack()` re-enters `awaiting-loop-pick` (not `at-node`)

#### Manual Verification:
- [ ] Existing serialization tests stay green (additive optional field, backwards-compatible)

## Phase 2: Trimmed-empty exit captions get target-derived aria-label

### Overview
Depends on nothing (independent of Phase 1). Gate the loop-picker exit-button `aria-label` fallback on `caption.trim() === ''` and add a whitespace-only caption render test.

### Changes Required:

#### 1. src/runner/render/render-loop-picker.ts
**File**: src/runner/render/render-loop-picker.ts
**Changes**: MODIFY — change the `attr:` gate from `caption === ''` to `caption.trim() === ''` so a whitespace-only `edge.label` still gets the target-derived `aria-label`. Visible `text: caption` stays verbatim.

```typescript
// BEFORE (around src/runner/render/render-loop-picker.ts:53-59):
//     const btn = createButton(list, {
//       cls: exit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn',
//       text: caption,
//       attr: caption === '' ? { 'aria-label': accessibleTargetCaption } : undefined,
//     });
// AFTER:
    const btn = createButton(list, {
      cls: exit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn',
      text: caption,
      attr: caption.trim() === '' ? { 'aria-label': accessibleTargetCaption } : undefined,
    });
```

Note: `accessibleTargetCaption` is already computed at `src/runner/render/render-loop-picker.ts:51` as `targetCaption.trim() !== '' ? targetCaption : edge.toNodeId`, so the trim semantic is reused. No new helper. Visible text stays verbatim (whitespace preserved); only the aria-label fallback broadens.

#### 2. src/__tests__/runner/render-loop-picker.test.ts
**File**: src/__tests__/runner/render-loop-picker.test.ts
**Changes**: MODIFY — add a test inside the `describe('shared loop picker renderer')` block (after the existing `an unlabeled exit edge renders empty visible text but a target-derived aria-label` test) asserting a whitespace-only `edge.label` keeps verbatim visible text but gains the target-derived `aria-label`.

```typescript
  it('a whitespace-only exit label renders verbatim visible text but a target-derived aria-label', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const whitespaceExit = { id: 'e-exit', fromNodeId: 'loop', toNodeId: 'exit', label: '   ', isLoopExit: true };
    const onChooseLoopBranch = vi.fn();
    renderLoopPicker(asHtml(textZone), asHtml(actionZone), graph([whitespaceExit]), {
      status: 'awaiting-loop-pick', nodeId: 'loop', accumulatedText: '', canStepBack: false, canRedo: false, undoStackSize: 0,
    }, {
      bindClick: (el, handler) => { (el as unknown as MockEl).clickHandler = handler; },
      renderError: vi.fn(),
      onChooseLoopBranch,
    });
    const exitBtn = findByClass(actionZone, 'rp-loop-exit-btn')[0]!;
    // Verbatim whitespace preserved as visible text
    expect(exitBtn.text).toBe('   ');
    // Trimmed-empty caption is treated as unlabeled → target-derived aria-label
    expect(exitBtn.attrs.get('aria-label')).toBe('Done');
  });
```

### Success Criteria:

#### Automated Verification:
- [x] Phase 2 focused tests pass: `npx vitest run src/__tests__/runner/render-loop-picker.test.ts`
- [x] New whitespace-only test asserts `exitBtn.text === '   '` (verbatim) and `exitBtn.attrs.get('aria-label') === 'Done'`
- [x] Existing `an unlabeled exit edge renders empty visible text but a target-derived aria-label` test stays green

#### Manual Verification:
- [ ] A whitespace-only exit label no longer renders a visually blank button without an accessible name

## Phase 3: Reword stale non-plus answer branch test title

### Overview
Depends on Phase 1 (same file; incremental subsection). Reword the stale `non-plus answer branch` test title to structural `isLoopExit` wording.

### Changes Required:

#### 1. src/__tests__/runner/protocol-runner-loop-picker.test.ts
**File**: src/__tests__/runner/protocol-runner-loop-picker.test.ts
**Changes**: MODIFY — reword the `it(...)` title string only (no body change). The test body already constructs `isLoopExit: true` edges; only the prose title still uses the stale `+`-prefix label terminology. Incremental subsection — same file as Phase 1 but textually disjoint (Phase 1 inserted the SESSION-RT test before the first describe-block close; Phase 3 renames an unrelated title further down).

```typescript
// BEFORE (unique stale title string; line shifts after Phase 1's insertion):
//   it('v1.17.3: back after a non-plus answer branch exits a loop through the loop exit target without loop-node-not-found errors', async () => {
// AFTER:
  it('v1.17.3: back after a non-isLoopExit body branch exits a loop through the loop exit target without loop-node-not-found errors', async () => {
```

Rationale: exit semantics now key on the explicit `edge.isLoopExit` flag, not the former `+`-prefix label convention. The chosen `e-body` edge is a body branch (no `isLoopExit`); the runner quick-exits via the answer wired to the same target as the `isLoopExit` exit edge. Cosmetic only — no behavioral change.

### Success Criteria:

#### Automated Verification:
- [x] Grep guard: `grep -n "non-plus" src/__tests__/runner/protocol-runner-loop-picker.test.ts` returns no matches
- [x] Grep guard: `grep -n "non-isLoopExit body branch" src/__tests__/runner/protocol-runner-loop-picker.test.ts` returns 1 match
- [x] Phase 3 focused tests pass: `npx vitest run src/__tests__/runner/protocol-runner-loop-picker.test.ts`
- [x] Project baseline: `npm run check` (build + lint + tests + planning + consistency + agent-docs) passes

#### Manual Verification:
- [ ] The reworded title accurately describes the test's structural (isLoopExit) semantics

## Ordering Constraints

- Phase 1 and Phase 2 are independent (different files) and could run in parallel.
- Phase 3 rewords a title in `protocol-runner-loop-picker.test.ts`; after the Step-9 review move, Phase 1's regression test lives in `protocol-runner-snapshot.test.ts`, so Phase 3 no longer overlaps Phase 1's files. Phases may run in any order, though Phase 1 remains the substantive foundation.

## Verification Notes

- `npm run check` — build + lint + tests + planning + consistency + agent-docs (project baseline; run on the terminal phase).
- `npx vitest run src/__tests__/runner/protocol-runner-snapshot.test.ts` — Phase 1 regression (restored-session stepBack restores `awaiting-loop-pick`) plus existing snapshot round-trip tests stay green.
- `npx vitest run src/__tests__/runner/render-loop-picker.test.ts` — Phase 2 whitespace-only caption aria-label test plus existing render tests stay green.
- Grep guard: `grep -n "non-plus" src/__tests__/runner/protocol-runner-loop-picker.test.ts` returns no matches after Phase 3.
- Grep guard: `grep -n "restoreStatus" src/runner/protocol-runner.ts` shows matches in both `getSerializableState` and `restoreFrom` mapping literals after Phase 1.
- Risk-bearing: the serialization change is additive and backwards-compatible (old snapshots without `restoreStatus` still restore to `at-node`); verify no existing serialization test asserts the absence of the field.

## Performance Considerations

Negligible. Threading one optional string field through two `.map()` literals adds a per-undo-entry property copy at save/restore time — already O(n) over the undo stack with deep-copied arrays dominating. No new hot path; loop picker renders one extra `.trim()` per exit edge (already computed for `accessibleTargetCaption`).

## Migration Notes

No persisted protocol-document schema change. Runner session snapshots serialized before this fix lack `restoreStatus`; `restoreFrom()` copies `undefined` into the restored `UndoEntry`, and `stepBack()` resolves `undefined ?? RUNNER_STATUS.AT_NODE` to `at-node` — identical to pre-fix behavior. No rollback strategy needed; no migration step required for existing saved sessions.

## Pattern References

- `src/runner/protocol-runner.ts:567,624` — `returnToBranchList` threading through the same two mapping literals; the `restoreStatus` threading mirrors this exactly.
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts:54-78` (RUN-02) — existing `getSerializableState()` + `loopContextStack` assertions; template for the new round-trip test's narrowing pattern.
- `src/__tests__/runner/render-loop-picker.test.ts` `an unlabeled exit edge renders empty visible text but a target-derived aria-label` — template for the whitespace-only variant.
- `src/runner/render/render-loop-picker.ts:51` — `accessibleTargetCaption` already uses `.trim() !== ''`; the fix reuses the same trim semantic.
- `src/__tests__/runner/protocol-runner-snapshot.test.ts:117` — `JSON.parse(json) as typeof saved` cast pattern; the new SESSION-RT test mirrors this to catch serialized-shape type drift.

## Developer Context

- Step 4 design summary confirmed: three localized additive fixes, no ambiguities (all dimensions simple). User selected "Proceed (Recommended)".
- Step 5 decomposition confirmed: 3 slices (restoreStatus serialization, aria-label trim, stale title reword). User selected "Approve (Recommended)".
- Inherited from validation artifact: "Preserve `UndoEntry.restoreStatus` through `getSerializableState()` / `restoreFrom()` and add a JSON round-trip + stepBack regression." / "Treat trimmed-empty exit captions as unlabeled when assigning the target-derived `aria-label`." / "Replace 'non-plus answer branch' with structural `isLoopExit` wording."

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source   | plan-loc  | codebase-loc                                  | severity   | dimension     | finding                                                                                                                                       | recommendation                                                                                                  | resolution                                                                                                    |
| -------- | --------- | --------------------------------------------- | ---------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| code     | Phase 1 §2 | src/__tests__/runner/protocol-runner-snapshot.test.ts:117 | suggestion | codebase-fit  | The JSON serialization regression was added to the loop-picker suite despite the dedicated snapshot suite owning `getSerializableState()`/`restoreFrom()` round-trip coverage | Move the regression test to `protocol-runner-snapshot.test.ts` and update the focused verification command     | applied: moved test into `describe('snapshot — awaiting-loop-pick (RUN-06)')` block + updated Phase 1 focused command |
| code     | Phase 1 §2 | src/__tests__/runner/protocol-runner-snapshot.test.ts:117 | suggestion | code-quality  | The proposed `JSON.parse(...)` result remained `any`, whereas existing snapshot round-trip tests cast parsed data to `typeof saved`, so type drift in the serialized shape would be hidden | Narrow the saved snapshot before serialization and cast the parsed value as `typeof saved`                      | applied: split into `const json = JSON.stringify(saved); const deserialized = JSON.parse(json) as typeof saved;`      |

_coverage reviewer: no findings — all Verification Notes and Pattern References entries land in a phase's Success Criteria or as a visible code mirror._

## Plan History

- Phase 1: Runner session serialization preserves restoreStatus — approved as generated; revised at Step 9 (regression test moved to `protocol-runner-snapshot.test.ts` awaiting-loop-pick block + `typeof saved` cast per reviewer suggestions)
- Phase 2: Trimmed-empty exit captions get target-derived aria-label — approved as generated
- Phase 3: Reword stale non-plus answer branch test title — approved as generated

## References

- Validation artifact: `.rpiv/artifacts/validation/2026-07-28_17-12-07_merge-loop-node-type-into-question-via-a-loop-toggle-explicit-isloopexit-edge-flag.md`
- Parent plan: `.rpiv/artifacts/plans/2026-07-28_11-40-42_merge-loop-into-question.md`
- `src/runner/protocol-runner.ts` — serialization seams (getSerializableState, restoreFrom)
- `src/runner/render/render-loop-picker.ts` — aria-label fallback gate
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts` — loop-picker + serialization tests
- `src/__tests__/runner/render-loop-picker.test.ts` — render tests