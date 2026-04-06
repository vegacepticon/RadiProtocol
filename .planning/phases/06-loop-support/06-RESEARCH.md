# Phase 6: Loop Support — Research

**Researched:** 2026-04-06
**Domain:** TypeScript state machine — loop traversal, context stack, undo across iteration boundaries, Obsidian ItemView UI
**Confidence:** HIGH (all key findings are verified directly from the codebase)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOOP-01 | `LoopStartNode` and `LoopEndNode` fully supported in parser, validator, and runner | Parser and validator already handle both node types — only runner needs implementation (Phase 2 stub exists) |
| LOOP-02 | Loop-start has two outgoing edges: `continue` (body) and `exit` (past loop); "loop again / done" prompt at loop-end node | `LoopStartNode` model has `loopLabel`/`exitLabel` fields; edge routing by label needed in runner |
| LOOP-03 | Loop context stack tracks iteration number and pre-loop text for correct undo | New `LoopContext` type and `loopContextStack` field on runner needed |
| LOOP-04 | Iteration counter shown in runner UI (e.g., "Lesion 2") | `AtNodeState` must expose iteration context; `RunnerView` renders it |
| LOOP-05 | Undo entries snapshot full loop context stack | `UndoEntry` type must be extended with `loopContextStack` snapshot |
| LOOP-06 | Validator detects orphaned loop-end (already implemented) and accidental cycles not through loop-end (already implemented) | Both checks exist in `GraphValidator` — verify they survive the loop fixture additions |
</phase_requirements>

---

## Summary

Phase 6 replaces the two-line Phase 2 stub in `ProtocolRunner.advanceThrough()` with full loop support. The data model (`LoopStartNode`, `LoopEndNode`, `ProtocolGraph`) is complete and correct. The validator already enforces both loop-related error classes (orphaned loop-end, accidental cycles). The parser already produces correct node objects for both loop types. **The entire Phase 6 implementation surface is the runner state machine and its UI rendering branch.**

The central challenge is the loop context stack. When the runner enters a loop-start node it must push a frame (`{ loopStartId, iteration, textBeforeLoop }`). When it reaches the loop-end node it must present a "loop again / done" binary choice. Each `UndoEntry` must capture a snapshot of the full `loopContextStack` so that `stepBack()` can restore the correct iteration state, not just the node and text.

The `AtNodeState` public interface must be extended to carry the active loop iteration label (e.g., "Lesion 2") so `RunnerView` can display it without coupling to internal runner fields. The `RunnerView.render()` already has a `default:` branch in the `at-node` switch that gracefully handles unknown node kinds — the `loop-end` node will need an explicit case there that renders a two-button "loop again / done" prompt.

**Primary recommendation:** Implement and fully test the runner loop logic (context stack, undo, iteration cap) in isolation with Vitest before touching any UI code. The runner changes are the risk; the UI changes are mechanical once the runner API is stable.

---

## Standard Stack

### Core (already installed — no new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.0.2 | Primary language | [VERIFIED: package.json] |
| Vitest | ^4.1.2 | Unit testing pure engine modules | [VERIFIED: package.json] |
| obsidian | 1.12.3 | ItemView, createEl, registerDomEvent | [VERIFIED: package.json] |

**No new npm packages are required for Phase 6.** [VERIFIED: codebase inspection — loop support is purely a state machine extension]

### Supporting (already in place)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| async-mutex | ^0.5.0 | Write mutex for vault.modify() | Not needed for loop logic; already used for snippet files |

**Installation:** Nothing to install.

---

## Architecture Patterns

### Recommended Project Structure (no new directories)
```
src/
├── graph/
│   └── graph-model.ts       # LoopContext type added here
├── runner/
│   ├── runner-state.ts      # UndoEntry extended; AtNodeState extended; LoopAtEndState added
│   └── protocol-runner.ts   # loop-start and loop-end cases in advanceThrough()
├── views/
│   └── runner-view.ts       # loop-end node rendering in at-node case
└── __tests__/
    ├── fixtures/
    │   ├── loop-body.canvas          # Wave 0: simple loop with one question inside
    │   └── loop-accidental-cycle.canvas  # already exists as cycle.canvas — reuse
    └── runner/
        └── protocol-runner.test.ts   # loop-specific test cases added
```

### Pattern 1: Loop Context Stack Frame

**What:** A value-type record pushed onto `loopContextStack` when a loop-start node is entered.

**When to use:** Every time `advanceThrough()` processes a `loop-start` node.

```typescript
// Source: graph-model.ts — add alongside existing node types
export interface LoopContext {
  /** ID of the loop-start node that opened this frame */
  loopStartId: string;
  /** 1-based iteration counter */
  iteration: number;
  /** Full text snapshot captured immediately before entering the loop body.
   *  Used to restore text if the user steps back past the loop entry point. */
  textBeforeLoop: string;
}
```

### Pattern 2: Extended UndoEntry (LOOP-05)

**What:** `UndoEntry` must carry a snapshot of the full `loopContextStack` at the moment the entry is pushed — not a reference to the live array.

```typescript
// Source: runner-state.ts — extend existing UndoEntry
export interface UndoEntry {
  nodeId: string;
  textSnapshot: string;
  /** Deep snapshot of the loop context stack — array copy, not reference (LOOP-05) */
  loopContextStack: LoopContext[];
}
```

**Critical:** The snapshot must be `[...this.loopContextStack]` (shallow array copy of value-type records), NOT `this.loopContextStack` (which would be a live reference). Because `LoopContext` contains only primitives and strings (all value types), a shallow array copy is sufficient — no deep clone needed.

### Pattern 3: Loop-Start Node Handling in `advanceThrough()`

**What:** Replace the Phase 2 stub for `loop-start` case.

```typescript
// Source: protocol-runner.ts — replace the stub inside advanceThrough() switch
case 'loop-start': {
  // Push a new loop frame
  this.loopContextStack.push({
    loopStartId: cursor,
    iteration: 1,
    textBeforeLoop: this.accumulator.snapshot(),
  });

  // Follow the 'continue' edge (edge labeled 'continue') into the loop body
  const continueNeighbor = this.edgeByLabel(cursor, 'continue');
  if (continueNeighbor === undefined) {
    this.transitionToError(`Loop-start node '${cursor}' has no 'continue' edge.`);
    return;
  }
  cursor = continueNeighbor;
  break;
}
```

### Pattern 4: Loop-End Node Handling — Halt for User Choice (LOOP-02)

**What:** The loop-end node is a decision point. Unlike answer/text-block which auto-advance, loop-end must HALT and wait for the user to choose "loop again" or "done". This is analogous to a question node.

```typescript
// Source: protocol-runner.ts — replace the stub inside advanceThrough() switch
case 'loop-end': {
  // Halt here — set currentNodeId and let RunnerView render the "loop again / done" prompt
  this.currentNodeId = cursor;
  this.runnerStatus = 'at-node';
  return;
}
```

A new public API method `chooseLoopAction(action: 'again' | 'done')` handles the user's choice after halting at the loop-end node:

```typescript
chooseLoopAction(action: 'again' | 'done'): void {
  if (this.runnerStatus !== 'at-node') return;
  if (this.graph === null || this.currentNodeId === null) return;

  const node = this.graph.nodes.get(this.currentNodeId);
  if (node === undefined || node.kind !== 'loop-end') return;

  // Push undo entry BEFORE mutation (same invariant as chooseAnswer)
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack], // shallow copy of value-type records
  });

  const frame = this.loopContextStack[this.loopContextStack.length - 1];

  if (action === 'again') {
    if (frame === undefined) {
      this.transitionToError('Loop context stack is empty at loop-end node.');
      return;
    }
    // Enforce iteration cap (RUN-09)
    const loopStartNode = this.graph.nodes.get(frame.loopStartId);
    if (loopStartNode?.kind === 'loop-start' && frame.iteration >= loopStartNode.maxIterations) {
      this.transitionToError(
        `Maximum iterations (${loopStartNode.maxIterations}) reached for loop "${loopStartNode.loopLabel}".`
      );
      return;
    }
    // Increment iteration on the stack frame (replace top frame)
    this.loopContextStack[this.loopContextStack.length - 1] = {
      ...frame,
      iteration: frame.iteration + 1,
    };
    // Re-enter the loop body via the loop-start's 'continue' edge
    const continueNeighbor = this.edgeByLabel(frame.loopStartId, 'continue');
    if (continueNeighbor === undefined) {
      this.transitionToError(`Loop-start '${frame.loopStartId}' has no 'continue' edge for re-entry.`);
      return;
    }
    this.advanceThrough(continueNeighbor);
  } else {
    // 'done' — pop the loop frame and follow the loop-start's 'exit' edge
    this.loopContextStack.pop();
    const loopStartId = node.loopStartId;
    const exitNeighbor = this.edgeByLabel(loopStartId, 'exit');
    if (exitNeighbor === undefined) {
      this.transitionToError(`Loop-start '${loopStartId}' has no 'exit' edge.`);
      return;
    }
    this.advanceThrough(exitNeighbor);
  }
}
```

### Pattern 5: Edge-by-Label Lookup Helper

**What:** The runner currently uses `firstNeighbour()` which takes the first outgoing edge regardless of label. Loop-start nodes require label-aware routing.

```typescript
// Source: protocol-runner.ts — new private helper
private edgeByLabel(nodeId: string, label: string): string | undefined {
  if (this.graph === null) return undefined;
  return this.graph.edges.find(
    e => e.fromNodeId === nodeId && e.label === label
  )?.toNodeId;
}
```

### Pattern 6: Extended `AtNodeState` — Iteration Label (LOOP-04)

**What:** The public `AtNodeState` must carry enough information for `RunnerView` to display the iteration counter and to know whether to render "loop again / done" buttons vs. answer buttons.

```typescript
// Source: runner-state.ts — extend AtNodeState
export interface AtNodeState {
  status: 'at-node';
  currentNodeId: string;
  accumulatedText: string;
  canStepBack: boolean;
  /** Set when the runner is halted at a loop-end node; undefined otherwise (LOOP-04) */
  loopIterationLabel?: string;
  /** true when currentNodeId refers to a loop-end node (drives UI branch) */
  isAtLoopEnd?: boolean;
}
```

**RunnerView rendering for loop-end:** Add a case in the `at-node` switch (inside the node-kind inner switch):

```typescript
case 'loop-end': {
  // Show iteration label if available
  if (state.loopIterationLabel !== undefined) {
    questionZone.createEl('p', {
      text: state.loopIterationLabel,
      cls: 'rp-loop-iteration-label',
    });
  }
  const loopEndNode = node; // kind === 'loop-end', already narrowed
  const loopStartNode = this.graph.nodes.get(loopEndNode.loopStartId);
  const againLabel = loopStartNode?.kind === 'loop-start'
    ? loopStartNode.loopLabel
    : 'Loop again';
  const doneLabel = loopStartNode?.kind === 'loop-start'
    ? loopStartNode.exitLabel
    : 'Done';

  const againBtn = questionZone.createEl('button', {
    cls: 'rp-loop-again-btn',
    text: againLabel,
  });
  const doneBtn = questionZone.createEl('button', {
    cls: 'rp-loop-done-btn',
    text: doneLabel,
  });
  this.registerDomEvent(againBtn, 'click', () => {
    this.runner.chooseLoopAction('again');
    void this.renderAsync();
  });
  this.registerDomEvent(doneBtn, 'click', () => {
    this.runner.chooseLoopAction('done');
    void this.renderAsync();
  });
  break;
}
```

### Pattern 7: `stepBack()` Restoration of Loop Context (LOOP-05)

**What:** `stepBack()` must restore `loopContextStack` from the snapshot in `UndoEntry`, not just `nodeId` and `accumulatedText`.

```typescript
// Source: protocol-runner.ts — extend existing stepBack()
stepBack(): void {
  const entry = this.undoStack.pop();
  if (entry === undefined) return;

  this.currentNodeId = entry.nodeId;
  this.accumulator.restoreTo(entry.textSnapshot);
  this.loopContextStack = [...entry.loopContextStack]; // restore from snapshot
  this.runnerStatus = 'at-node';
  this.errorMessage = null;
  this.snippetId = null;
  this.snippetNodeId = null;
}
```

### Pattern 8: Iteration Label Computation for `getState()`

**What:** When the runner is at any node inside a loop body (or at a loop-end node), the public `AtNodeState.loopIterationLabel` should reflect the current iteration.

```typescript
// Source: protocol-runner.ts — inside getState() at-node branch
case 'at-node': {
  const topFrame = this.loopContextStack[this.loopContextStack.length - 1];
  const loopStartNode = topFrame !== undefined
    ? this.graph?.nodes.get(topFrame.loopStartId)
    : undefined;
  const loopLabel = loopStartNode?.kind === 'loop-start'
    ? loopStartNode.loopLabel
    : undefined;
  const loopIterationLabel = topFrame !== undefined && loopLabel !== undefined
    ? `${loopLabel} ${topFrame.iteration}`
    : undefined;

  return {
    status: 'at-node',
    currentNodeId: this.currentNodeId ?? '',
    accumulatedText: this.accumulator.current,
    canStepBack: this.undoStack.length > 0,
    loopIterationLabel,
    isAtLoopEnd: this.graph?.nodes.get(this.currentNodeId ?? '')?.kind === 'loop-end',
  };
}
```

### Anti-Patterns to Avoid

- **Storing `loopContextStack` reference in UndoEntry:** `undoStack.push({ ..., loopContextStack: this.loopContextStack })` stores a live reference. After the push, mutations to `this.loopContextStack` corrupt the snapshot. Always spread: `[...this.loopContextStack]`.
- **Routing loop-end → loop-start via adjacency edge directly:** The graph model stores the `loopStartId` on the `LoopEndNode` as a metadata field, NOT as a graph edge. The edge from loop-end back to loop-start's body IS a canvas edge (and passes through the DFS as intentional because it passes through loop-end). Routing must use `edgeByLabel(frame.loopStartId, 'continue')` to re-enter the body, NOT `adjacency.get(loopEndNodeId)[0]`.
- **Calling `advanceThrough()` from inside `advanceThrough()` for loop re-entry:** This can deepen the call stack across iterations and hit the JavaScript stack limit for high iteration counts. Use the `cursor = ...` pattern within the while loop instead. However, `chooseLoopAction()` calling `advanceThrough()` from a non-loop traversal context is safe because `chooseLoopAction()` is not called from within the while loop.
- **Not enforcing the iteration cap on re-entry:** The per-loop-start `maxIterations` field must be checked when `action === 'again'` before re-entering. The global `maxIterations` in `advanceThrough()` is per-`advanceThrough()` call, not per loop iteration.
- **Rendering the loop-end node in the `default:` branch of the RunnerView switch:** The current `default:` shows "Processing..." which is wrong for loop-end. Add an explicit `case 'loop-end':` branch.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Array snapshot for loop context stack | Custom deep-clone utility | `[...array]` spread (shallow copy) | LoopContext contains only primitives — spread is correct and sufficient |
| Edge label lookup | Secondary adjacency map keyed by label | `graph.edges.find(e => ...)` | Edge count per node is small (≤2 for loop-start); O(n) find is fine |
| Iteration counter display | Complex formatter | String template: `` `${loopLabel} ${iteration}` `` | The data is already structured; no library needed |

---

## Common Pitfalls

### Pitfall 1: Live Reference in UndoEntry
**What goes wrong:** `loopContextStack` mutations after the push corrupt all prior undo entries simultaneously.
**Why it happens:** JavaScript arrays are reference types; assignment copies the pointer.
**How to avoid:** Always spread when snapshotting: `[...this.loopContextStack]`. Write a Vitest test that mutates the stack after a push and asserts the undo entry is unchanged.
**Warning signs:** `stepBack()` restores the wrong iteration number, or stepping back past a loop boundary shows the wrong text.

### Pitfall 2: `UndoEntry` Created at Loop-End Without Context Snapshot
**What goes wrong:** Stepping back from iteration 2's first question goes to iteration 1's last question correctly (text ok), but the loop context stack is wrong (shows iteration 2 still active) because the undo entry captured the stack by reference.
**Why it happens:** See Pitfall 1, but harder to notice because the symptom is the loop counter being wrong rather than the text.
**How to avoid:** Test `stepBack()` from a mid-loop-body node and assert `loopIterationLabel` is correct after step-back.
**Warning signs:** Iteration counter in UI does not decrement on step-back.

### Pitfall 3: Incorrect Edge Routing on Loop Re-entry
**What goes wrong:** On "loop again", the runner follows the first outgoing edge of the loop-start node rather than the `continue`-labeled edge, accidentally taking the `exit` path.
**Why it happens:** `firstNeighbour()` is order-dependent; canvas edge order is not guaranteed.
**How to avoid:** Always use `edgeByLabel(loopStartId, 'continue')` for body re-entry and `edgeByLabel(loopStartId, 'exit')` for done. Test with a fixture where the exit edge is listed first in the canvas JSON.
**Warning signs:** Clicking "loop again" immediately exits the loop.

### Pitfall 4: Global `maxIterations` Counter Resets Between User Actions
**What goes wrong:** The step counter in `advanceThrough()` resets to 0 on each call, so a protocol with 60 text-blocks inside a loop body could exceed the cap on first entry but pass on re-entry (if split across two `advanceThrough()` calls).
**Why it happens:** `steps` is a local variable in `advanceThrough()`; it counts auto-advance steps within one traversal pass, not total loop iterations.
**How to avoid:** The loop iteration cap (`loopStartNode.maxIterations`) is separate from and in addition to the traversal iteration cap. Both must be enforced independently. The per-loop cap guards against infinite loop user errors; the traversal cap guards against infinite graph cycles.
**Warning signs:** A protocol with many nodes inside a loop body hits the traversal cap even for legitimate iteration counts.

### Pitfall 5: `isAtLoopEnd` Missing from State — RunnerView Falls Through to Default
**What goes wrong:** RunnerView renders "Processing..." instead of the "loop again / done" prompt because `node.kind === 'loop-end'` hits the existing `default:` branch.
**Why it happens:** The existing `switch (node.kind)` in `RunnerView.render()` has no `case 'loop-end':` branch.
**How to avoid:** Add the explicit case. Write a manual test plan checkpoint covering the loop UI before merging.
**Warning signs:** Runner shows "Processing..." and hangs when reaching a loop-end node.

### Pitfall 6: Validator Loop Pairing Check is Asymmetric
**What goes wrong:** The existing validator checks that loop-end references a valid loop-start. It does NOT check that every loop-start has a corresponding reachable loop-end. A loop-start with only an `exit` edge and no loop body would not be caught.
**Why it happens:** The validation in `graph-validator.ts` (Check 6) only iterates `loop-end` nodes.
**How to avoid:** Phase 6 Wave 0 should add a test for a loop-start with no reachable loop-end. Consider adding a Check 6b in the validator that for every loop-start, confirms a loop-end with matching `loopStartId` exists and is reachable.
**Warning signs:** A malformed canvas with a dangling loop-start passes validation and then produces an error state at runtime.

---

## Code Examples

Verified patterns from the existing codebase:

### Existing UndoEntry push (before Phase 6 extension)
```typescript
// Source: src/runner/protocol-runner.ts line 78-81
this.undoStack.push({
  nodeId: this.currentNodeId,
  textSnapshot: this.accumulator.snapshot(),
});
```

### Existing stepBack() (before Phase 6 extension)
```typescript
// Source: src/runner/protocol-runner.ts line 139-148
stepBack(): void {
  const entry = this.undoStack.pop();
  if (entry === undefined) return;
  this.currentNodeId = entry.nodeId;
  this.accumulator.restoreTo(entry.textSnapshot);
  this.runnerStatus = 'at-node';
  this.errorMessage = null;
  this.snippetId = null;
  this.snippetNodeId = null;
}
```

### Existing Phase 2 stub being replaced
```typescript
// Source: src/runner/protocol-runner.ts lines 295-302
case 'loop-start':
case 'loop-end': {
  // D-05: Phase 2 stub — this exact block is replaced in Phase 6
  this.transitionToError(
    'Loop nodes are not yet supported — upgrade to Phase 6',
  );
  return;
}
```

### Existing loop-start fixture (for test reference)
```json
// Source: src/__tests__/fixtures/loop-start.canvas
{
  "nodes": [
    { "id": "n-start", ..., "radiprotocol_nodeType": "start" },
    { "id": "n-ls1", ..., "radiprotocol_nodeType": "loop-start",
      "radiprotocol_loopLabel": "Lesion loop",
      "radiprotocol_exitLabel": "Done",
      "radiprotocol_maxIterations": 10 }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-ls1" }
  ]
}
```

### Existing `chooseAnswer()` pattern for new `chooseLoopAction()` to mirror
```typescript
// Source: src/runner/protocol-runner.ts lines 67-93
// New chooseLoopAction() must follow the same invariants:
// 1. Guard: runnerStatus must be 'at-node'
// 2. Guard: current node must be the expected kind
// 3. Push UndoEntry BEFORE any mutation
// 4. Mutate state
// 5. Call advanceThrough() for the next node
```

---

## What Already Works (No Phase 6 Changes Needed)

| Component | What's Ready | Notes |
|-----------|-------------|-------|
| `CanvasParser` | Fully parses `loop-start` and `loop-end` nodes with all fields | [VERIFIED: canvas-parser.ts lines 229-251] |
| `GraphValidator` | Detects orphaned loop-end (Check 6), accidental cycles not through loop-end (Check 4) | [VERIFIED: graph-validator.ts lines 73-83, 128-185] |
| `LoopStartNode` type | `loopLabel`, `exitLabel`, `maxIterations` fields present | [VERIFIED: graph-model.ts lines 51-56] |
| `LoopEndNode` type | `loopStartId` field present | [VERIFIED: graph-model.ts lines 58-61] |
| `ProtocolGraph` | `edges` array preserved (needed for `edgeByLabel` helper) | [VERIFIED: graph-model.ts lines 79-86] |
| Runner iteration cap | `maxIterations` option on `ProtocolRunnerOptions`, enforced in `advanceThrough()` | [VERIFIED: protocol-runner.ts lines 8-10, 229-234] |
| Test infrastructure | Vitest config, fixtures dir, runner test pattern established | [VERIFIED: vitest.config.ts, existing test files] |

---

## What Phase 6 Must Build

| Component | Change Type | Location |
|-----------|-------------|----------|
| `LoopContext` interface | New type | `graph-model.ts` |
| `UndoEntry.loopContextStack` field | Extend existing | `runner-state.ts` |
| `AtNodeState.loopIterationLabel` and `isAtLoopEnd` fields | Extend existing | `runner-state.ts` |
| `ProtocolRunner.loopContextStack` private field | New field | `protocol-runner.ts` |
| `loop-start` case in `advanceThrough()` | Replace stub | `protocol-runner.ts` |
| `loop-end` case in `advanceThrough()` | Replace stub | `protocol-runner.ts` |
| `chooseLoopAction()` public method | New method | `protocol-runner.ts` |
| `edgeByLabel()` private helper | New helper | `protocol-runner.ts` |
| Extended `getState()` for `at-node` case | Extend existing | `protocol-runner.ts` |
| Extended `stepBack()` | Extend existing | `protocol-runner.ts` |
| `loop-end` case in `RunnerView` node-kind switch | New case | `runner-view.ts` |
| Iteration label rendering in `RunnerView` | New UI element | `runner-view.ts` |
| `loop-body.canvas` test fixture | New fixture | `src/__tests__/fixtures/` |
| Loop runner Vitest tests | New test cases | `src/__tests__/runner/protocol-runner.test.ts` |
| CSS for loop UI elements | New rules | `src/styles.css` |
| Optional: Check 6b (loop-start has reachable loop-end) | New validator check | `graph-validator.ts` |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Loop nodes produce immediate `error` state | Loop nodes drive full context stack traversal | Phase 6 (now) | Removes Phase 2 stub; enables real loop protocols |
| `UndoEntry` has 2 fields | `UndoEntry` has 3 fields (adds `loopContextStack`) | Phase 6 (now) | All existing undo tests still pass; no behavior change for non-loop protocols |
| `AtNodeState` has 4 fields | `AtNodeState` has 6 fields (adds `loopIterationLabel?`, `isAtLoopEnd?`) | Phase 6 (now) | New fields are optional — no breaking change to existing RunnerView code paths |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Loop-start node uses two outgoing edges labeled exactly `"continue"` and `"exit"` (not arbitrary labels, not positional) — confirmed by REQUIREMENTS.md Assumption A1 and `LoopStartNode.exitLabel` field naming convention | Architecture Patterns | If labels are positional (first = continue, second = exit), `edgeByLabel()` lookup breaks; fallback to index-based `adjacency` lookup needed |
| A2 | Edge label is stored on `RPEdge.label` which is populated from the canvas JSON `label` field — confirmed in `canvas-parser.ts` line 108 | Pattern 5: Edge-by-Label | [VERIFIED — no assumption] |
| A3 | The "loop again / done" prompt is rendered at the loop-END node (not loop-start) — per LOOP-02 | Pattern 4 | If prompt should be at loop-start, the halt point changes; graph model also changes |
| A4 | A `loopContextStack` snapshot is a shallow array copy of `LoopContext[]` and no deep clone is needed because `LoopContext` contains only primitives | Pattern 2 | If `LoopContext` gains a non-primitive field, deep clone is required |

**Note on A1:** The `LoopStartNode` model fields are `loopLabel` (shown on the "loop again" button) and `exitLabel` (shown on the "done" button). These are button display labels, NOT the canvas edge labels. The canvas edge labels that the graph uses for routing must be the literal strings `"continue"` and `"exit"` — this is an architectural assumption from REQUIREMENTS.md A1 that has not been changed. The planner should confirm with the user whether canvas edge labels are user-visible or fixed routing strings before implementation.

---

## Open Questions

1. **Canvas edge labels: user-defined or fixed strings?**
   - What we know: `LoopStartNode` has `loopLabel` (button text) and `exitLabel` (button text). The routing must use canvas edge labels.
   - What's unclear: Must the protocol author label their canvas edges exactly `"continue"` and `"exit"`? Or will any two edges work positionally (first = continue, second = exit)?
   - Recommendation: Fix edge labels to `"continue"` and `"exit"` as internal routing strings. Surface this requirement in the node editor UI (Phase 4 already built) and in documentation. Positional routing is fragile — canvas edge order is not guaranteed.

2. **Validator Check 6b: should every loop-start require a reachable loop-end?**
   - What we know: Current validator only checks the reverse (loop-end references a valid loop-start).
   - What's unclear: Is a loop-start with no body and no loop-end a valid protocol (degenerate loop) or always an error?
   - Recommendation: Add Check 6b. A loop-start with no reachable loop-end referencing it is almost certainly a protocol authoring error and should be reported before session start.

3. **Multi-iteration text formatting: concatenated or per-iteration sections?**
   - What we know: Text from each iteration is appended to the same `accumulatedText` buffer. LOOP-03 says the stack tracks "text accumulated before loop entry" — implying each iteration appends to the same buffer.
   - What's unclear: Should iteration text be separated (e.g., newlines between "Lesion 1" and "Lesion 2" sections)?
   - Recommendation: Use the `text-block` nodes inside the loop body for any separator text the protocol author wants. The runner should not inject any implicit formatting between iterations. The `textBeforeLoop` snapshot in `LoopContext` is for undo correctness, not for formatting boundaries.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 6 is a pure TypeScript code extension with no new external dependencies, CLI tools, databases, or services beyond those already verified in prior phases.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOOP-01 | Parser produces correct `LoopStartNode`/`LoopEndNode` from canvas JSON | unit | `npm test` (canvas-parser.test.ts) | ✅ exists (loop-start.canvas fixture covers parse) |
| LOOP-01 | Validator accepts valid loop-paired graph | unit | `npm test` (graph-validator.test.ts) | ❌ Wave 0: add `loop-body.canvas` fixture + valid-loop test |
| LOOP-02 | Runner halts at loop-end, "loop again" re-enters body, "done" exits | unit | `npm test` (protocol-runner.test.ts) | ❌ Wave 0: new test cases |
| LOOP-03 | Loop context stack frame tracks iteration and pre-loop text | unit | `npm test` (protocol-runner.test.ts) | ❌ Wave 0: new test cases |
| LOOP-04 | `AtNodeState.loopIterationLabel` equals "Lesion 2" on second iteration | unit | `npm test` (protocol-runner.test.ts) | ❌ Wave 0: new test cases |
| LOOP-04 | RunnerView renders iteration label in UI | manual | manual test: 3-lesion protocol | — |
| LOOP-05 | `stepBack()` from iteration 2 restores iteration 1 state | unit | `npm test` (protocol-runner.test.ts) | ❌ Wave 0: new test cases |
| LOOP-06 | Validator rejects accidental cycle not through loop-end | unit | `npm test` (graph-validator.test.ts) | ✅ exists (cycle.canvas fixture) |
| LOOP-06 | Validator rejects orphaned loop-end | unit | `npm test` (graph-validator.test.ts) | ✅ exists |
| RUN-09 | Per-loop iteration cap enforced | unit | `npm test` (protocol-runner.test.ts) | ❌ Wave 0: loop cap test |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (`npm test`) + manual 3-lesion UAT before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/fixtures/loop-body.canvas` — full loop fixture: start → loop-start → question → answer → loop-end → exit-text-block; covers LOOP-01 through LOOP-05
- [ ] New Vitest test cases in `src/__tests__/runner/protocol-runner.test.ts`:
  - Runner reaches loop-end and halts (LOOP-02)
  - `chooseLoopAction('again')` re-enters loop body, increments iteration (LOOP-02, LOOP-03, LOOP-04)
  - `chooseLoopAction('done')` exits loop, advances past it (LOOP-02)
  - `stepBack()` from iteration 2 restores iteration 1 context (LOOP-05)
  - Per-loop `maxIterations` cap triggers error (RUN-09)
- [ ] New Vitest test in `src/__tests__/graph-validator.test.ts`:
  - Valid loop-paired graph passes validation (LOOP-01)
  - (Optional) Loop-start with no reachable loop-end fails (Check 6b)

---

## Security Domain

Security enforcement: not applicable to this phase. Phase 6 extends pure engine logic (no Obsidian API calls, no file I/O, no network, no user-supplied data paths). No new attack surface is introduced. The existing constraints (no innerHTML, no console.log, no require('fs')) remain enforced by ESLint and are not altered by loop support.

---

## Sources

### Primary (HIGH confidence)
- `src/runner/protocol-runner.ts` — current runner implementation, Phase 2 stub location
- `src/runner/runner-state.ts` — `UndoEntry`, `AtNodeState`, `RunnerState` union
- `src/graph/graph-model.ts` — `LoopStartNode`, `LoopEndNode`, `ProtocolGraph`, `RPEdge`
- `src/graph/graph-validator.ts` — existing cycle detection and loop-end orphan check
- `src/graph/canvas-parser.ts` — loop node parsing (lines 229-251)
- `src/views/runner-view.ts` — `at-node` rendering pattern, `registerDomEvent` usage
- `src/__tests__/runner/protocol-runner.test.ts` — test patterns, fixture loading, inline graph construction
- `src/__tests__/fixtures/loop-start.canvas` — existing loop fixture structure
- `src/__tests__/fixtures/cycle.canvas` — cycle detection fixture (intentional cycle template)
- `package.json` — confirmed: no new dependencies needed
- `vitest.config.ts` — test runner configuration
- `.planning/REQUIREMENTS.md` — LOOP-01 through LOOP-06 complete definitions, Assumption A1

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` — Phase 6 risk flags and success criteria
- `.planning/STATE.md` — confirmed Phase 5 complete, open assumption A1 on loop edge design

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already installed and in use
- Architecture: HIGH — all types and extension points verified directly from current source
- Pitfalls: HIGH — derived from direct code inspection of the existing undo/traversal logic
- UI patterns: HIGH — `RunnerView` pattern established in Phase 5 (`awaiting-snippet-fill` branch is the exact same pattern as `loop-end` branch)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable TypeScript/Vitest/Obsidian stack; no external API changes)
