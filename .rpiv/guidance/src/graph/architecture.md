# Graph Layer Architecture

## Responsibility
Canonical directed-graph types, semantic validation invariants, and shared label/edge-predicate utilities for protocol graphs. Zero Obsidian imports (NFR-01) — fully unit-testable in plain Node.js.

## Dependencies
- **i18n/Translator**: localized error messages (injected, English `defaultT` fallback)

## Consumers
- **protocol/protocol-document-parser**: builds `ProtocolGraph` from parsed records
- **runner/protocol-runner**: traverses graph during execution
- **runner/render/***: reads nodes/edges for UI rendering
- **views/inline-runner-modal**: parse → validate → start pipeline
- **views/node-picker-modal**, **views/protocol-editor-view**: read node types/kinds

## Module Structure
```
src/graph/
├── graph-model.ts      # Canonical types: RPNodeKind, RPNode union, ProtocolGraph, ParseResult, LoopContext
├── graph-validator.ts  # Never-throw validator → string[]; DI for i18n + vault probe
└── node-label.ts       # nodeLabel() + edge predicates (isExitEdge, isLabeledEdge, stripExitPrefix)
```

## Discriminated-Union Node Model (Exhaustive Narrowing)

```typescript
export type RPNodeKind = 'start' | 'question' | 'answer' | 'text-block' | 'snippet' | 'loop'
  | 'loop-start'  // @deprecated — parseable, rejected at validation
  | 'loop-end';   // @deprecated — parseable, rejected at validation

export interface QuestionNode extends RPNodeBase { kind: 'question'; questionText: string; }

// Union enables exhaustive switch — adding a kind without handling causes a TS compile error
export type RPNode = StartNode | QuestionNode | AnswerNode | TextBlockNode
  | SnippetNode | LoopNode | LoopStartNode | LoopEndNode;
```

`radiprotocol_*`-prefixed optional fields (e.g. `radiprotocol_separator`, `radiprotocol_snippetPath`) namespace persisted canvas properties.

## Graph Container with Materialized Indexes

```typescript
export interface ProtocolGraph {
  canvasFilePath: string;
  nodes: Map<string, RPNode>;            // O(1) lookup by ID
  edges: RPEdge[];                       // preserves canvas order + edge identity
  adjacency: Map<string, string[]>;      // forward: nodeId → neighborIds (ordered)
  reverseAdjacency: Map<string, string[]>; // backward: nodeId → predecessorIds
  startNodeId: string;                   // '' if no start node
}
```

Adjacency maps are pre-built during parsing. **Use `adjacency` for topology-only traversal; use `edges` when labels or edge identity matter** (loop exits, duplicate-target parallel edges).

## Never-Throw Validator with Check-Ordering Guard

```typescript
validate(graph: ProtocolGraph): string[]   // [] = valid. Never throws.

// Check order MATTERS — early returns prevent spurious secondary errors:
// 1. Zero start nodes → early return (can't BFS without root)
// 2. Multiple start nodes → error, continue with first
// 3. Legacy loop-start/loop-end → consolidated migration error, early return
// 4. BFS reachability (forward adjacency)
// 5. 3-color DFS cycle detection — cycles through 'loop' nodes are intentional
// 6. Dead-end questions (no outgoing adjacency)
// 7. Loop exit/body edge invariants (+-prefixed exits need captions; ≥1 body edge required)
// 8. Snippet file probe (only if probe + rootPath both injected)
```

Dependency injection keeps the validator pure — zero-argument construction works in tests (English defaults, no probe):

```typescript
new GraphValidator({ snippetFileProbe: p => app.vault.getAbstractFileByPath(p) !== null,
                     rootPath: settings.snippetFolderPath, t: plugin.i18n.t.bind(plugin.i18n) });
// Pure test: new GraphValidator()
```

## Shared Label + Edge Predicates (Single Source of Truth)

```typescript
export function nodeLabel(node: RPNode): string      // switch on kind — validator errors + UI captions MUST match
export function isLabeledEdge(edge: RPEdge): boolean // non-empty trimmed label
export function isExitEdge(edge: RPEdge): boolean    // trimmed label starts with '+'
export function stripExitPrefix(label: string): string // remove exactly one '+' + following whitespace
```

`isExitEdge` and `isLabeledEdge` are separate functions, NOT aliases — a labeled body edge is not an exit (regression test asserts `isExitEdge !== isLabeledEdge`). Loop validation partitions outgoing edges into `exits`, `labeledNonExits` (legacy diagnostic), and `body` (everything non-exit).

## Architectural Boundaries
- **NO Obsidian imports**: all three files are pure TypeScript. `GraphValidator` receives vault-dependent probes via constructor injection.
- **NO runtime in graph-model.ts**: type/interface exports only.
- **NO mutation**: all functions are pure.
- **Never-throw contract**: `ParseResult` (parsing) + `string[]` (validation). Injected translators/probes are assumed not to throw.

<important if="you are adding a new node kind to the graph model">
## Adding a New Node Kind
1. **`graph-model.ts`** — add kind to `RPNodeKind`, define interface extending `RPNodeBase` with `kind: 'your-kind'`, add to `RPNode` union
2. **`node-label.ts`** — add case to `nodeLabel()` switch
3. **`graph-validator.ts`** — add validation rules (required fields, edge constraints)
4. **`protocol/protocol-document-parser.ts`** — add kind to `VALID_KINDS`, add case to `parseNode()` switch
5. **`runner/protocol-runner.ts`** — add case to `advanceThrough()` switch (halt or auto-advance)
6. **`runner/runner-state.ts`** — if interactive, add to `RunnerState` union + `RUNNER_STATUS`
7. **`runner/render/`** — if interactive, create `render-*.ts`; if auto-advance, no render change
8. **Tests** — parser, validator, runner, render (if interactive)
</important>

<important if="you are writing or modifying tests for the graph layer">
## Testing Conventions
- `GraphValidator` constructed with zero arguments in tests — English defaults, no vault probe
- `ParseResult` assertions: always check `result.success` first, then narrow with TypeScript
- BFS/DFS fixtures live in `__tests__/fixtures/*.canvas`
- The `nodeLabel` test includes a regression guard: `expect(isExitEdge).not.toBe(isLabeledEdge)`
</important>
