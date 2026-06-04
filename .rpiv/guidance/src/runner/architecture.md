# Runner Layer Architecture

## Responsibility
Pure protocol-traversal state machine and DOM render functions. The core (`protocol-runner.ts`, `runner-state.ts`, `text-accumulator.ts`, `snippet-label.ts`) is a pure FSM with zero Obsidian imports (NFR-01). The `render/` sub-layer maps each runner state to DOM output, delegating all behavior to injected host interfaces.

## Dependencies
- **graph/graph-model**: Runtime graph types (`ProtocolGraph`, `LoopContext`, node types)
- **graph/node-label**: `isExitEdge`, `nodeLabel`, `stripExitPrefix` for loop edge dispatch
- **constants/runner-states**: `RUNNER_STATUS` const object
- **constants/css-classes**: `CSS_CLASS` shared class names
- **i18n**: `defaultT`, `Translator` (injected, not imported at module scope)

## Consumers
- **views/inline-runner-modal.ts**: Primary host — calls `ProtocolRunner` methods and all 7 render functions

## Module Structure
```
src/runner/
├── protocol-runner.ts    # FSM orchestrator: start, chooseAnswer, stepBack, redo, skip, etc.
├── runner-state.ts       # Discriminated union (RunnerState), UndoEntry, RedoEntry types
├── text-accumulator.ts   # Append-only text buffer with snapshot/restore for O(1) undo
├── snippet-label.ts      # Snippet node classification + display label helpers
└── render/               # State→DOM projection functions (one file per runner state)
    ├── render-complete.ts          # Completion heading
    ├── render-error.ts             # Error list (title + <ul>)
    ├── render-footer.ts            # Shared Back/Redo/Skip icon row — see render sub-layer guidance
    ├── render-loop-picker.ts       # Loop branch buttons (exit + body)
    ├── render-question.ts          # Question text + answer/snippet buttons
    ├── render-snippet-fill.ts      # Loading/not-found placeholders
    └── render-snippet-picker.ts    # Snippet tree browser (async) — see render sub-layer guidance
```

## Discriminated-Union State Machine (Immutable Snapshots)

```typescript
// Each status has its own interface with ONLY relevant fields
export type RunnerState = IdleState | AtNodeState | AwaitingSnippetPickState
  | AwaitingLoopPickState | AwaitingSnippetFillState | CompleteState | ErrorState;

// getState() returns one variant — callers narrow with switch(state.status)
// Exhaustiveness: default branch assigns this.runnerStatus to `never`
```

- `getState()` is the **only** way for external code to read state — internal fields are `private`.
- Each state interface carries only the data that status needs (no `currentNodeId` on `IdleState`).

## Undo-Before-Mutate (Snapshot Sequence Invariant)

Every user-driven forward action follows this exact sequence:

```typescript
someAction(id: string): void {
  if (this.runnerStatus !== RUNNER_STATUS.AT_NODE) return;     // 1. Guard
  this.redoStack = [];                                          // 2. Clear redo
  this.undoStack.push({                                         // 3. Snapshot BEFORE mutation
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: this.loopContextStack.map(f => ({ ...f })), // deep copy!
  });
  // 4. Mutate state...
  // 5. advanceThrough() or set status directly
}
```

- `advanceThrough()` (internal auto-advance) **never** pushes undo entries.
- `loopContextStack` must be deep-copied with `.map(f => ({ ...f }))`.

## TextAccumulator (O(1) Snapshots)

```typescript
export class TextAccumulator {
  append(text: string): void;
  appendWithSeparator(text: string, sep: 'newline' | 'space'): void; // no sep before first chunk
  snapshot(): string;        // immutable string copy
  restoreTo(s: string): void;   // O(1) undo
  overwrite(text: string): void; // manual edit injection (BUG-01)
}
```

## Loop Context Stack (Nested Re-Entry)

```typescript
interface LoopContext {
  loopNodeId: string;      // which loop node we're inside
  iteration: number;       // 1-based: times user has seen the picker
  textBeforeLoop: string;  // snapshot before entering loop body
}
```

- First entry: push new frame. Re-entry (B1 guard): increment `iteration` in-place, do NOT push a second frame.
- Exit edge: `pop()` the frame. Only normal path that shrinks the stack.

## Architectural Boundaries
- **Pure core, Obsidian-aware shell**: `protocol-runner.ts`, `runner-state.ts`, `text-accumulator.ts`, `snippet-label.ts` have **zero** Obsidian imports. Only `render/` touches Obsidian APIs.
- **Runner never imports views**: The exception is `render-snippet-picker.ts` importing `SnippetTreePicker` — documented and sanctioned.
- **Error is terminal**: `transitionToError()` sets status + message. Recovery requires `start()` or `restoreFrom()`.

<important if="you are adding a new runner state">
## Adding a New Runner State
1. **`constants/runner-states.ts`** — Add key to `RUNNER_STATUS`
2. **`runner/runner-state.ts`** — Define interface with `status` literal, add to `RunnerState` union
3. **`protocol-runner.ts`** — Add private field, case in `getState()`, transition method with undo-before-mutate
4. **If resumable**: Add to `getSerializableState()` and `restoreFrom()`
5. **If interactive**: Create `render/render-<state>.ts` with Host interface — see `.rpiv/guidance/src/runner/render/architecture.md`
6. **`views/inline-runner-modal.ts`** — Add case to `switch(state.status)` in render method
7. **Tests**: state transition, stepBack round-trip, redo, serialization round-trip
</important>

<important if="you are writing or modifying tests for the runner layer">
## Testing Conventions
- **Core runner**: Construct `ProtocolRunner` directly — no arguments, no mocking
- **Render layer**: Use `MockEl` class (local per test file) + `vi.fn()` host spies
- **State narrowing**: `if (state.status !== 'at-node') return;` is TypeScript narrowing, not assertion
- **Test graphs**: Construct inline with `new Map<string, RPNode>()` — no fixture for simple cases
- **Complex fixtures**: `__tests__/fixtures/*.canvas` for loops, multi-branch
</important>