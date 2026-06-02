# Graph Model Layer

## Responsibility
Pure domain types and validation for the protocol directed-graph system. Owns every node kind interface, the `ProtocolGraph` container with pre-computed adjacency, graph integrity validation, and shared label utilities used by both validator and runner.

## Dependencies
- **i18n** (only `graph-validator.ts`): Translator injection via options bag, falls back to `defaultT` for tests

## Consumers
- `runner/` — traversal, render modules (types + label utilities)
- `views/` — inline runner, node picker, editor (types + validator)
- `protocol/` — parser imports `RPNodeKind`, `SnippetNode` (types only)

## Module Structure
```
graph/
├── graph-model.ts       # Types only — RPNodeKind, 7 node interfaces, ProtocolGraph, ParseResult
├── graph-validator.ts   # GraphValidator class — 5+ structural checks, never throws
└── node-label.ts        # Pure utility functions — shared by validator + runner
```

## Discriminated Union (`RPNodeKind` + `RPNode`)

```typescript
type RPNodeKind = 'start' | 'question' | 'answer' | 'text-block' | 'loop' | 'snippet'
  | 'loop-start' /* @deprecated */ | 'loop-end' /* @deprecated */;

interface RPNodeBase { id: string; kind: RPNodeKind; x: number; y: number; }
type RPNode = StartNode | QuestionNode | AnswerNode | TextBlockNode | LoopNode
  | SnippetNode | LoopStartNode | LoopEndNode;
```

## Error-Accumulating Validator

```typescript
class GraphValidator {
  constructor(options?: { snippetFileProbe?: (p: string) => boolean; t?: Translator });
  validate(graph: ProtocolGraph): string[];  // [] = valid, never throws
}
// Checks: start-node existence, reachability (BFS), unintentional cycles
//   (3-color DFS with loop-node exemption), dead-end questions, deprecated nodes
```

## Shared Label Utilities (Byte-Identical Contract)

```typescript
// Used by BOTH validator error messages AND runner picker captions
function nodeLabel(node: RPNode): string;       // Must match byte-for-byte
function isExitEdge(edge: RPEdge): boolean;     // label starts with '+'
function stripExitPrefix(label: string): string; // strip leading '+'
```

## Architectural Boundaries
- **NO Obsidian imports** (NFR-01, PARSE-06): All three files are pure TypeScript — testable in Node.js without mocking Obsidian
- **NO throws**: `validate()` returns `string[]` — errors are values
- **NO barrel index**: Consumers import directly from individual files

<important if="you are adding a new RPNodeKind">
## Adding a New Node Kind
1. Add kind string to `RPNodeKind` union in `graph-model.ts`
2. Create new interface extending `RPNodeBase` with `kind` literal
3. Add to `RPNode` union
4. Add `case` to `nodeLabel()` switch in `node-label.ts`
5. Add parser arm in `protocol/protocol-document-parser.ts`
6. Add validation checks in `GraphValidator.validate()` if needed
7. Update exhaustive `switch` statements across codebase
</important>
