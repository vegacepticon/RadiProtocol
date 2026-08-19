# Graph Layer Architecture

## Responsibility
`src/graph/` is the pure runtime graph kernel for normalized protocol nodes, edge topology, labels, authored ordering, and semantic validation. It has no Obsidian, vault, DOM, or service ownership.

## Dependencies
- **`i18n/Translator`**: injected localization for validator diagnostics; tests use the English default.

## Consumers
- **`protocol/`**: parses the persisted document into this runtime graph.
- **`runner/` and `runner/render/`**: traverse and project nodes/edges.
- **`views/` and `library/`**: start-node selection, editing projections, and staged install validation.

## Module Structure
```
graph-model.ts                 # RPNode/RPEdge/ProtocolGraph contracts
edge-order.ts + node-label.ts  # pure semantic projections and captions
graph-validator.ts             # ordered, never-throw graph policy
```

## Discriminated Runtime Contract
```typescript
export type RPNodeKind = 'start' | 'question' | 'answer' | 'text-block' | 'snippet'
  | 'loop-start' | 'loop-end'; // migration-only arms
interface QuestionNode extends RPNodeBase {
  kind: 'question'; questionText: string; loop?: boolean;
  optionOrder?: string[]; // stable RPEdge IDs
}
interface RPEdge {
  id: string; fromNodeId: string; toNodeId: string; label?: string;
  isLoopExit?: boolean; // semantic metadata, not caption parsing
}
type RPNode = StartNode | QuestionNode | AnswerNode | TextBlockNode
  | SnippetNode | LoopStartNode | LoopEndNode;
```
A loop is a `question` with `loop === true`; the old standalone loop representation is migration-only. Runtime consumers must narrow the union exhaustively.

## Edge Identity and Ordered Projection
```typescript
export interface ProtocolGraph {
  nodes: Map<string, RPNode>;
  edges: RPEdge[];                 // preserve IDs, labels, and parallel edges
  adjacency: Map<string, string[]>;
  reverseAdjacency: Map<string, string[]>;
  startNodeId: string;
  canvasFilePath: string;          // historical name; may contain .rp.json
}

const outgoing = orderedOutgoingEdges(graph, questionId);
// Use adjacency for topology-only traversal; use edges when identity/order
// or isLoopExit metadata affects the behavior.
```
`orderedOutgoingEdges()` preserves edge-array order when `optionOrder` is absent, skips stale/duplicate IDs, and appends live unlisted edges. `nodeLabel()` is the shared caption source for validator messages and branch buttons.

## Ordered Validation with Injected Probes
```typescript
class GraphValidator {
  constructor(private readonly options: {
    t?: Translator;
    snippetFileProbe?: (absolutePath: string) => boolean;
    rootPath?: string;
  } = {}) {}

  validate(graph: ProtocolGraph): string[] {
    // [] is valid; normal invalidity never throws.
    // Order: start → migration arms → reachability → cycles → questions
    // → loop body/exit → optional file-bound snippet probe.
    return [];
  }
}

const validator = new GraphValidator({
  t: plugin.i18n.t.bind(plugin.i18n),
  snippetFileProbe: path => app.vault.getAbstractFileByPath(path) !== null,
  rootPath: settings.snippetFolderPath,
});
```
Validation order is part of the contract: early migration errors suppress misleading secondary topology errors, and cycles are accepted only when a looped question is on the cycle path.

## Architectural Boundaries
- Keep graph code pure and mutation-free; inject vault probes and translators instead of importing Obsidian.
- Parser syntax/shape errors belong to `protocol/`; graph semantic errors belong here.
- Loop exits are identified by `edge.isLoopExit === true`; labels are presentation data.
- Edge IDs, not labels or target IDs, identify user-selectable branches.

<important if="you are adding a new node kind or graph capability">
## Adding a New Graph Capability
1. Extend `graph-model.ts` and every exhaustive label/consumer switch.
2. Add persisted parsing or migration in `.rpiv/guidance/src/protocol/architecture.md`.
3. Add semantic invariants here, preserving the ordered `string[]` validator contract.
4. Add runner state/traversal and renderer behavior where interactive; see `.rpiv/guidance/src/runner/architecture.md` and `src/runner/render/`.
5. Update editor/picker projections and both locale files.
6. Test canonical, malformed, stale-order, and migration forms.
</important>

<important if="you are writing or modifying tests for the graph layer">
- Construct pure graphs directly for edge-order and label tests; include all graph indexes when topology is under test.
- Use `.canvas` fixtures only through the test-only compatibility helpers described in `.rpiv/guidance/src/__tests__/fixtures/architecture.md`.
- Assert `ParseResult.success` before reading the graph and use injected map-backed snippet probes.
</important>
