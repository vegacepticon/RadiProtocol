# Graph Layer Architecture

## Responsibility
Canonical directed-graph types, validation invariants, and shared label/edge-predicate utilities for protocol graphs. Zero Obsidian imports (NFR-01) — fully unit-testable in plain Node.js.

## Dependencies
- **i18n/Translator**: Localized error messages (injected via `defaultT` fallback)

## Consumers
- **protocol/protocol-document-parser**: Builds `ProtocolGraph` from parsed documents
- **runner/protocol-runner**: Traverses graph during protocol execution
- **runner/render/***: Reads nodes/edges for UI rendering
- **views/inline-runner-modal**: Validates graph before running
- **views/node-picker-modal**: Reads nodes for selection UI

## Module Structure
```
src/graph/
├── graph-model.ts      # Canonical types (RPNodeKind, RPNode union, ProtocolGraph, ParseResult)
├── graph-validator.ts   # Never-throw validator → string[] (DI for i18n + vault probe)
└── node-label.ts       # Shared label extractor + edge predicates (isExitEdge, isLabeledEdge)
```

## Discriminated Union Type System (Exhaustive Narrowing)

```typescript
// Each node kind gets a sealed interface — the `kind` field is a string literal
export type RPNodeKind = 'start' | 'question' | 'answer' | 'text-block' | 'snippet' | 'loop'
  | 'loop-start'  // @deprecated — legacy, rejected by validator
  | 'loop-end';   // @deprecated — legacy, rejected by validator

export interface QuestionNode extends RPNodeBase {
  kind: 'question';
  questionText: string;
}

// Union enables exhaustive switch — adding a kind without handling causes TS compile error
export type RPNode = StartNode | QuestionNode | AnswerNode | TextBlockNode
  | SnippetNode | LoopNode | LoopStartNode | LoopEndNode;
```

- `@deprecated` kinds (`loop-start`, `loop-end`) are parseable but rejected at validation with a migration error.
- `radiprotocol_*`-prefixed optional fields (e.g., `radiprotocol_separator`) namespace canvas properties.

## Result Type (Never Throws)

```typescript
export type ParseResult =
  | { success: true;  graph: ProtocolGraph }
  | { success: false; error: string };
```

Consumers MUST check `result.success` before accessing `.graph`. The parser never throws.

## Graph Container with Adjacency Maps

```typescript
export interface ProtocolGraph {
  canvasFilePath: string;
  nodes: Map<string, RPNode>;            // O(1) lookup by ID
  edges: RPEdge[];                       // preserves canvas order + edge identity
  adjacency: Map<string, string[]>;      // forward: nodeId → neighborIds
  reverseAdjacency: Map<string, string[]>; // backward: nodeId → predecessorIds
  startNodeId: string;
}
```

Adjacency maps are pre-built during parsing — traversal never scans the edge array.

## Never-Throw Validator with Check-Ordering Guard

```typescript
// All errors collected, never thrown. Empty array = valid.
validate(graph: ProtocolGraph): string[]

// Check order MATTERS:
// 1. No start node → early return (can't BFS without root)
// 2. Multiple start nodes → error
// 3. Legacy loop-start/loop-end → early return (prevents spurious LOOP-04 errors)
// 4. BFS reachability
// 5. 3-color DFS cycle detection (cycles through 'loop' nodes are intentional)
// 6. Dead-end questions
// 7. Loop exit/body edge invariants
// 8. Snippet file probe (if injected)
```

Dependency injection keeps the validator pure:
```typescript
new GraphValidator({
  snippetFileProbe: (absPath) => app.vault.getAbstractFileByPath(absPath) !== null,
  t: plugin.i18n.t.bind(plugin.i18n),
});
// Pure-test: new GraphValidator() — English defaults, no vault probe
```

## Shared Label Extractor + Edge Predicates

```typescript
// ONE canonical implementation — validator errors and runner UI must match character-for-character
export function nodeLabel(node: RPNode): string { /* switch on kind */ }
export function isLabeledEdge(edge: RPEdge): boolean { /* non-empty label */ }
export function isExitEdge(edge: RPEdge): boolean { /* label starts with "+" after trim */ }
export function stripExitPrefix(label: string): string { /* remove leading "+" + whitespace */ }
```

`isExitEdge` and `isLabeledEdge` are separate functions — they are NOT aliases (regression test asserts `isExitEdge !== isLabeledEdge`).

## Architectural Boundaries
- **NO Obsidian imports**: All three files are pure TypeScript. `GraphValidator` receives vault-dependent probes via constructor injection.
- **NO runtime in graph-model.ts**: Only type exports, zero executable code at module scope.
- **NO mutation**: All functions are pure — no side effects, no shared state.

<important if="you are adding a new node kind to the graph model">
## Adding a New Node Kind
1. **`graph-model.ts`** — Add kind to `RPNodeKind` union, define interface extending `RPNodeBase` with `kind: 'your-kind'`, add to `RPNode` union
2. **`node-label.ts`** — Add case to `nodeLabel()` switch
3. **`graph-validator.ts`** — Add any validation rules (required fields, edge constraints)
4. **`protocol/protocol-document-parser.ts`** — Add kind to `VALID_KINDS`, add case to `parseNode()` switch
5. **`runner/protocol-runner.ts`** — Add case to `advanceThrough()` switch (halt or auto-advance)
6. **`runner/runner-state.ts`** — If the kind needs a new runner state, add to `RunnerState` union + `RUNNER_STATUS`
7. **`runner/render/`** — If interactive, create new `render-*.ts`; if auto-advance, no render change needed
8. **Tests** — Parser, validator, runner, and render (if interactive)
</important>

<important if="you are writing or modifying tests for the graph layer">
## Testing Conventions
- `GraphValidator` is constructed with zero arguments in tests — English defaults, no vault probe
- ParseResult assertions: always check `result.success` first, then narrow with TypeScript
- BFS/DFS fixtures live in `__tests__/fixtures/*.canvas`
- The `nodeLabel` test includes a regression guard: `expect(isExitEdge).not.toBe(isLabeledEdge)`
</important>