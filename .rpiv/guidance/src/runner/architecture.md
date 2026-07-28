# Runner Layer Architecture

## Responsibility
Pure protocol-traversal state machine + output text accumulation. Core (`protocol-runner.ts`, `runner-state.ts`, `text-accumulator.ts`, `snippet-label.ts`) is a pure FSM with zero Obsidian imports (NFR-01). The `render/` sub-layer maps each state to DOM — see `.rpiv/guidance/src/runner/render/architecture.md`.

## Dependencies
- **graph/graph-model**: `ProtocolGraph`, `LoopContext`, node types
- **graph/node-label**: `isExitEdge`, `nodeLabel`, `stripExitPrefix`
- **constants/runner-states**: `RUNNER_STATUS` const · **constants/css-classes**: `CSS_CLASS` (render only)
- **i18n**: `defaultT`, `Translator` (injected, not imported at module scope)

## Consumers
- **views/inline-runner-modal.ts**: sole host — calls `ProtocolRunner` methods + all 7 render functions

## Module Structure
```
src/runner/
├── protocol-runner.ts    # FSM orchestrator: start, chooseAnswer, stepBack, redo, skip, syncManualEdit…
├── runner-state.ts       # Discriminated union (RunnerState), UndoEntry, RedoEntry
├── text-accumulator.ts   # Append-only buffer with O(1) snapshot/restore
└── snippet-label.ts      # Snippet classification + display label helpers
```

## Discriminated-Union State Machine (Immutable Snapshots)

```typescript
export type RunnerState = IdleState | AtNodeState | AwaitingSnippetPickState
  | AwaitingLoopPickState | AwaitingSnippetFillState | CompleteState | ErrorState;
// getState() is the ONLY public read — internal fields are private.
// Each state interface carries ONLY the data that status needs (no currentNodeId on IdleState).
// Exhaustiveness: default branch assigns status to `never`.
```

## Undo-Before-Mutate (Snapshot Sequence Invariant)

Every user-driven forward action follows this exact sequence:

```typescript
chooseAnswer(id: string): void {
  if (this.runnerStatus !== RUNNER_STATUS.AT_NODE) return;     // 1. Guard
  this.redoStack = [];                                          // 2. Clear redo
  this.undoStack.push({                                         // 3. Snapshot BEFORE mutation
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: this.loopContextStack.map(f => ({ ...f })), // deep copy!
    restoreStatus: RUNNER_STATUS.AT_NODE,                        // optional: non-default undo target
  });
  // 4. Mutate state…  5. advanceThrough() or set status
}
```

- `advanceThrough()` (internal auto-advance) **never** pushes undo entries (one explicit exception: first loop entry).
- `loopContextStack` must be deep-copied with `.map(f => ({ ...f }))`.
- `completeSnippet()` reuses the earlier snippet-selection undo entry — does not push a new one.
- `stepBack()` has a **microtask reentrancy guard** (`stepBackInFlight`) — tests await `Promise.resolve()` between repeated calls.

## TextAccumulator (O(1) Snapshots)

```typescript
export class TextAccumulator {
  append(text: string): void;
  appendWithSeparator(text: string, sep: 'newline' | 'space'): void; // no sep before first chunk
  snapshot(): string;        // immutable string copy (primitives already safe)
  restoreTo(s: string): void;   // O(1) undo — full replacement
  overwrite(text: string): void; // manual edit injection (syncManualEdit)
}
```
Caller resolves per-node separator override (`??` runner default); skips truly empty answer text before `appendWithSeparator`.

## Loop Context Stack (Nested Re-Entry)

```typescript
interface LoopContext { loopNodeId: string; iteration: number; textBeforeLoop: string; }
```
- First entry: push new frame. Re-entry (top frame matches): increment `iteration` in-place, do NOT push.
- Exit edge: `pop()` (only normal path that shrinks the stack).
- Answer "quick exit": if the answer's next target is also a loop exit target, pop the top frame.
- Dead-end inside a loop → return to owning loop picker (increment iteration). Dead-end outside → `COMPLETE`.

## Cursor-Based Traversal (Per-Call Step Cap)

`advanceThrough(initialNodeId)` uses an iterative cursor + `maxSteps` counter that **resets on every call** (not a cumulative limit). Exceeding the cap → `transitionToError('Possible graph cycle')`. Auto-advances: start, text-block, answer. Halts: question, loop, snippet (file-bound → fill; directory/unbound → picker). Terminal error: legacy loop-start/loop-end.

**Ordered adjacency**: `adjacency.get(id)?.[0]` is the "first outgoing edge"; scan in order for first-semantic-match. Use stable **edge IDs** for loop-branch selection (labels/targets can collide).

## Serialization (4 Resumable States) + Manual-Edit Ordering

```typescript
getSerializableState(): SessionSnapshot | null  // null for idle/complete/error
restoreFrom(snapshot): void                       // requires setGraph() first; clears redo + error
```

**4 resumable statuses**: `at-node`, `awaiting-snippet-pick`, `awaiting-loop-pick`, `awaiting-snippet-fill`. (Source comment claims only 2 — stale; treat all 4 as canonical.) Serialized undo preserves `returnToBranchList` but omits `restoreStatus` (missing defaults to `at-node` on undo); verify with `JSON.stringify`/`JSON.parse` round trips. Host MUST call `syncManualEdit(text)` BEFORE the forward action so manual text lands in that action's undo snapshot — accepted only at `at-node`/`awaiting-loop-pick`, does not itself push history.

## Architectural Boundaries
- **Pure core, Obsidian-aware shell**: `protocol-runner`, `runner-state`, `text-accumulator`, `snippet-label` have zero Obsidian imports.
- **Runner never imports views**: documented exception is `render-snippet-picker.ts` → `SnippetTreePicker`.
- **Error is terminal**: `transitionToError(msg)` sets status + localized message. Recovery requires `start()` or `restoreFrom()`.

<important if="you are adding a new runner state">
## Adding a New Runner State
1. **`constants/runner-states.ts`** — add key to `RUNNER_STATUS`
2. **`runner/runner-state.ts`** — define interface with `status` literal, add to `RunnerState` union
3. **`protocol-runner.ts`** — add private field, `getState()` case, transition method with undo-before-mutate
4. **If resumable**: add to `getSerializableState()` + `restoreFrom()` unions (4 states currently resumable)
5. **If interactive**: create `render/render-<state>.ts` — see `.rpiv/guidance/src/runner/render/architecture.md`
6. **`views/inline-runner-modal.ts`** — add case to `switch(state.status)` (preserve `never` exhaustiveness)
7. **Tests**: transition, stepBack round-trip, redo, serialization round-trip
</important>

<important if="you are writing or modifying tests for the runner layer">
## Testing Conventions
- **Core runner**: construct `ProtocolRunner` directly — no arguments, no mocking
- **State narrowing**: `if (state.status !== 'at-node') return;` is TS narrowing, not assertion
- **Test graphs**: inline `new Map<string, RPNode>()` for simple cases; `__tests__/fixtures/*.canvas` for loops
- **stepBack microtask guard**: `await Promise.resolve()` between intentional repeated calls
- **Serialization**: assert a real `JSON.stringify`/`JSON.parse` round trip, not just `getSerializableState()` shape
</important>