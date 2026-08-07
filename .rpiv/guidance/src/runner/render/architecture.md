# Runner Render Sub-Layer Architecture

## Responsibility
Maps each `RunnerState` variant to DOM output. Each render function is a pure projection: receives data (state, graph) + a host interface (for behavior), creates DOM, and delegates all event binding and state mutation to the host. Sole production consumer is `InlineRunnerModal`.

## Dependencies
- **runner/runner-state**: `RunnerState` union — each render narrows via `Extract`
- **runner/snippet-label**: `isFileBoundSnippetNode`, `snippetBranchLabel`
- **graph/graph-model**: `ProtocolGraph`, `RPEdge`, node types (read-only)
- **graph/node-label**: `isExitEdge`, `nodeLabel`, `stripExitPrefix` · **graph/edge-order**: `orderedOutgoingEdges`
- **utils/dom-helpers**: `createButton` · **constants/css-classes**: `CSS_CLASS`
- **i18n** (type only): `Translator` — optional, defaults to identity
- **obsidian**: `setIcon` (footer only), `App` type (snippet-picker only)
- **views/snippet-tree-picker**: `SnippetTreePicker` (snippet-picker only — documented cross-layer exception)

## Consumers
- **views/inline-runner-modal.ts**: sole production consumer — calls all 7 render functions

## Module Structure
```
src/runner/render/
├── render-complete.ts         # Completion heading → HTMLElement
├── render-error.ts            # Error title + <ul> → void
├── render-footer.ts           # Shared Back/Redo/Skip icon row → void
├── render-loop-picker.ts      # Loop branch buttons (exit + body) → boolean
├── render-question.ts         # Question text + answer/snippet buttons → 'rendered'|'not-question'|'error'
├── render-snippet-fill.ts     # Loading/not-found/unsupported placeholders → void
└── render-snippet-picker.ts   # Snippet tree browser → SnippetTreePicker (async-adjacent)
```

## Host-Dependency-Injection (Render Never Owns Behavior)

```typescript
export interface QuestionBranchHost {
  bindClick(el: HTMLElement, handler: (ev: MouseEvent) => void): void;
  renderError(messages: string[]): void;
  onChooseAnswer(answerNode: AnswerNode): void | Promise<void>;
  onChooseSnippetBranch(snippetNode: SnippetNode, isFileBound: boolean): void;
}
export function renderQuestionAtNode(
  textZone: HTMLElement, actionZone: HTMLElement, graph: ProtocolGraph | null,
  state: AtNodeState, host: QuestionBranchHost,
): 'rendered' | 'not-question' | 'error'
```
- **Never** call `addEventListener` — use `host.bindClick()`. **Never** call `ProtocolRunner` methods — host callbacks. **Never** access `this` — standalone functions. **Graph is read-only**.

## Two-Zone vs One-Zone Signatures

```typescript
// 2-zone: text + actions occupy separate layout regions (question, loop picker)
renderQuestionAtNode(textZone, actionZone, graph, state, host)
renderLoopPicker(textZone, actionZone, graph, state, host)
// 1-zone: self-contained panel, heading, footer, or loading state
renderCompleteHeading(zone): HTMLElement
renderErrorList(zone, messages, options?): void   // does NOT clear — host clears + wraps
renderRunnerFooter(zone, options, host): void
```
Terminal snippet-fill messages DO clear (`zone.empty()`); two-zone states must be added to the host's action-layout list.

## State Narrowing via Extract

```typescript
type AtNodeState = Extract<RunnerState, { status: 'at-node' }>;
type AwaitingLoopPickState = Extract<RunnerState, { status: 'awaiting-loop-pick' }>;
```
Guarantees type-safe status-specific field access without casts. Host's `switch (state.status)` keeps a `default: never` exhaustiveness check.

## Graph Traversal Chosen by Semantics

```typescript
// Edges — when labels/identity matter (loop branches):
const outgoing = orderedOutgoingEdges(graph, state.nodeId);
// partition into exits (isExitEdge) vs body; stripExitPrefix for exit captions

// Adjacency — when only target-node kinds matter (question buttons):
for (const neighborId of graph.adjacency.get(nodeId) ?? []) {
  const n = graph.nodes.get(neighborId);
  if (n?.kind === 'answer') answers.push(n);
  else if (n?.kind === 'snippet') snippets.push(n);  // tolerate stale adjacency
}
```

## Async-Guarded Picker + Double-Click Footer

```typescript
const capturedNodeId = state.nodeId;
const snippet = await snippetService.load(absPath);
if (options.getCurrentNodeId() !== capturedNodeId) return;  // stale-state guard
if (options.isStillMounted?.() === false) return;            // detached-DOM guard

// Footer double-click guard:
host.bindClick(backBtn, () => { backBtn.disabled = true; options.onBack(); }); // disable BEFORE handler
// Skip does NOT need the guard — idempotent. Runner stepBack adds a 2nd-layer microtask guard.
```
`renderSnippetPicker` returns the mounted `SnippetTreePicker` instance — host owns its unmount on state departure / Back / teardown.

## Architectural Boundaries
- **Render layer never imports `ProtocolRunner`** — all mutation flows through host callbacks.
- **Only `render-snippet-picker.ts` imports from `views/`** — `SnippetTreePicker` is the documented cross-layer exception.
- **Only `render-footer.ts` + `render-snippet-picker.ts` import `obsidian`** — all other render modules are pure DOM.

<important if="you are adding a new render mode to the runner">
## Adding a New Render Mode
1. Create `src/runner/render/render-<state>.ts`
2. Define Host interface (`bindClick`, `renderError`, action callbacks)
3. Narrow state: `type NarrowState = Extract<RunnerState, { status: 'your-state' }>`
4. Pick signature: 1-zone `(zone, state, host)` or 2-zone `(textZone, actionZone, graph, state, host)`
5. Pick return: `void`, `boolean`, or discriminated `'rendered' | 'not-<kind>' | 'error'`
6. Guard null graph / wrong node kind; delegate errors to `host.renderError`
7. Use `createButton` + `CSS_CLASS`; `aria-label` for icon-only controls (not `title`)
8. If async: capture state identity before `await`; re-check after; guard detached-DOM
9. If non-idempotent clicks: synchronous `disabled = true` before host handler
10. Wire `case` in `views/inline-runner-modal.ts` (preserve `never` exhaustiveness)
11. Test with `MockEl` class + `vi.fn()` host spies in `__tests__/runner/render-<state>.test.ts`
</important>
