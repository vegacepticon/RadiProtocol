# Runner Engine Layer

## Responsibility
Pure traversal state machine for protocol sessions. Walks a parsed `ProtocolGraph`, auto-advances through trivial nodes (start, text-block, answer), halts at interaction points (questions, snippet pickers, loop pickers). Supports undo/redo, text accumulation, serializable snapshots.

## Dependencies
- **graph-model / node-label**: Runtime types, `isExitEdge`, label formatting
- **runner-state / text-accumulator**: State union, O(1) snapshot undo
- **constants/runner-states**: Status literal constants
- **i18n**: Translator injection, test-safe `defaultT`

## Consumers
- `views/inline-runner-modal.ts` — sole production consumer
- `__tests__/runner/` — pure Node.js tests (no Obsidian needed)

## Module Structure
```
runner/
├── protocol-runner.ts           # ProtocolRunner class — entry point
├── runner-state.ts              # RunnerState discriminated union (7 states)
├── text-accumulator.ts          # O(1) snapshot undo via string immutability
├── snippet-label.ts             # Branch label formatting (📄/📁)
└── render/                      # One file per render step type
    ├── render-complete.ts, render-error.ts, render-footer.ts
    ├── render-question.ts, render-loop-picker.ts
    ├── render-snippet-fill.ts, render-snippet-picker.ts
```

## Discriminated-Union State Machine

```typescript
// getState() returns a discriminated union — switch on `status` to narrow
type RunnerState = IdleState | AtNodeState | AwaitingSnippetPickState
  | AwaitingLoopPickState | AwaitingSnippetFillState | CompleteState | ErrorState;

// Exhaustive switch with `never` catch-all catches missing cases
```

## Undo-Before-Mutate (Critical)

```typescript
chooseAnswer(id: string): void {
  this.redoStack = [];                               // Clear redo on forward action
  this.undoStack.push({ nodeId: this.currentNodeId,  // Push BEFORE mutation
    textSnapshot: this.accumulator.snapshot(),        // O(1) — string copy
    loopContextStack: this.loopContextStack.map(f => ({ ...f })),
  });
  this.currentNodeId = id;  // Then mutate
}
```

## 2-Zone Rendering + Host Callback Decoupling

```typescript
// Render functions receive textZone + actionZone + Host interface
// Host provides bindClick, renderError, onChooseAnswer — abstracting Obsidian
renderQuestionAtNode(textZone, actionZone, graph, state, host): 'rendered' | 'not-question' | 'error'
```

## Architectural Boundaries
- **NO Obsidian imports in core** (NFR-01): `protocol-runner.ts`, `runner-state.ts`, `text-accumulator.ts`, `snippet-label.ts` are pure. Exception: `render-footer.ts` uses `setIcon` (documented intentional leak)
- **NO direct vault I/O**: Runner works on in-memory `ProtocolGraph` only
- **NO throws**: Errors transition to `ErrorState`, never throw

<important if="you are adding a new render step">
## Adding a New Render Step
1. Add status constant in `constants/runner-states.ts`
2. Add state interface in `runner-state.ts` + add to `RunnerState` union
3. Add `case` to `getState()` switch and serialization gate in `protocol-runner.ts`
4. Create `render/render-{name}.ts` — pure function + Host interface + Options bag
5. Wire into `InlineRunnerModal.render()` switch
6. Add tests in `__tests__/runner/`
</important>
