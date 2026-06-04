# Runner Render Sub-Layer Architecture

## Responsibility
Maps each `RunnerState` variant to DOM output. Each render function is a pure projection: it receives data (state, graph) and a host interface (for behavior), creates DOM elements, and delegates all event binding and state mutation to the host. The sole production consumer is `InlineRunnerModal`.

## Dependencies
- **runner/runner-state**: `RunnerState` union — each render narrows via `Extract`
- **runner/snippet-label**: `isFileBoundSnippetNode`, `snippetBranchLabel`
- **graph/graph-model**: `ProtocolGraph`, `RPEdge`, node types (read-only)
- **graph/node-label**: `isExitEdge`, `nodeLabel`, `stripExitPrefix`
- **utils/dom-helpers**: `createButton` (typed Obsidian DOM helper)
- **constants/css-classes**: `CSS_CLASS` shared class names
- **i18n** (type only): `Translator` — optional parameter, defaults to identity function
- **obsidian**: `setIcon` (footer only), `App` type (snippet-picker only)
- **views/snippet-tree-picker**: `SnippetTreePicker` (snippet-picker only — documented cross-layer exception)

## Consumers
- **views/inline-runner-modal.ts**: Sole production consumer — calls all 7 render functions

## Module Structure
```
src/runner/render/
├── render-complete.ts          # Completion heading → returns HTMLElement
├── render-error.ts             # Error title + <ul> list → void
├── render-footer.ts            # Shared Back/Redo/Skip icon row → void
├── render-loop-picker.ts       # Loop branch buttons (exit + body) → boolean
├── render-question.ts          # Question text + answer/snippet buttons → 'rendered' | 'not-question' | 'error'
├── render-snippet-fill.ts      # Loading/not-found placeholders → void
└── render-snippet-picker.ts   # Snippet tree browser → SnippetTreePicker (async-adjacent)
```

## Host-Dependency-Injection (Render Never Owns Behavior)

```typescript
// Each render function needing interaction defines a Host interface
export interface QuestionBranchHost {
  bindClick(el: HTMLElement, handler: (ev: MouseEvent) => void): void;
  renderError(messages: string[]): void;
  onChooseAnswer(answerNode: AnswerNode): void | Promise<void>;
  onChooseSnippetBranch(snippetNode: SnippetNode, isFileBound: boolean): void;
}

// Render function delegates ALL clicks and errors through the host
export function renderQuestionAtNode(
  textZone: HTMLElement,      // passive content
  actionZone: HTMLElement,    // interactive elements
  graph: ProtocolGraph | null,
  state: AtNodeState,         // Extract<RunnerState, { status: 'at-node' }>
  host: QuestionBranchHost,  // behavior injection
): 'rendered' | 'not-question' | 'error'
```

- **Never** call `addEventListener` — use `host.bindClick()`.
- **Never** call `ProtocolRunner` methods — host provides callbacks.
- **Never** access `this` — render functions are standalone, not methods.

## Two-Zone Render Pattern

Interactive renderers receive `textZone` (read-only content) and `actionZone` (buttons/pickers). Simple renderers receive a single `zone`.

```typescript
// 2-zone: question, loop picker
renderQuestionAtNode(textZone, actionZone, graph, state, host)
// 1-zone: complete, error, snippet-fill, footer
renderCompleteHeading(zone): HTMLElement
renderErrorList(zone, messages, options?): void
```

## State Narrowing via Extract

```typescript
type AtNodeState = Extract<RunnerState, { status: 'at-node' }>;
type AwaitingLoopPickState = Extract<RunnerState, { status: 'awaiting-loop-pick' }>;
```

Guarantees type-safe access to status-specific fields (`currentNodeId` on `AtNodeState`, `nodeId` on `AwaitingLoopPickState`).

## Async-Guarded Picker (Stale-State + Detached-DOM)

```typescript
const capturedNodeId = state.nodeId;  // capture before async
const snippet = await snippetService.load(absPath);
if (options.getCurrentNodeId() !== capturedNodeId) return;  // stale-state guard
if (options.isStillMounted?.() === false) return;             // detached-DOM guard
```

## Double-Click-Guard Footer

```typescript
host.bindClick(backBtn, () => {
  backBtn.disabled = true;   // synchronous disable before handler runs
  options.onBack();
});
// Skip button does NOT need the guard — it's idempotent
```

## Architectural Boundaries
- **Render layer never imports `ProtocolRunner`** — all state mutation flows through host callbacks.
- **Graph is read-only** — render functions never mutate `ProtocolGraph`.
- **Only `render-snippet-picker.ts` imports from `views/`** — `SnippetTreePicker` is a documented cross-layer exception.
- **Only `render-footer.ts` and `render-snippet-picker.ts` import `obsidian`** — all other render modules are pure DOM.

<important if="you are adding a new render mode to the runner">
## Adding a New Render Mode
1. Create `src/runner/render/render-<state>.ts`
2. Define Host interface with `bindClick`, `renderError`, and action callbacks
3. Narrow state: `type NarrowState = Extract<RunnerState, { status: 'your-state' }>`
4. Decide signature: 1-zone `(zone, state, host)` or 2-zone `(textZone, actionZone, graph, state, host)`
5. Decide return: `void`, `boolean`, or discriminated `'rendered' | 'not-<kind>' | 'error'`
6. Add guard clauses for null graph / wrong node kind
7. Use `createButton` from `dom-helpers`, `CSS_CLASS` from constants
8. If localization needed, accept `t?: Translator` defaulting to `(key) => key`
9. Wire in `views/inline-runner-modal.ts` under matching `case`
10. Test with MockEl class + `vi.fn()` host spies in `__tests__/runner/render-<state>.test.ts`
</important>