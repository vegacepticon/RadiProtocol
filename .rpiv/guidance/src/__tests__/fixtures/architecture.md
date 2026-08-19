# Test Fixture Corpus Architecture

## Responsibility
Test-only serialized scenario corpus. The `.canvas` files exercise the compatibility `CanvasParser` → `ProtocolGraph` path for validator/runner regressions; they are not the production protocol format. Current production selection is `.rp.json`.

## Dependencies
- **`helpers/canvas-parser.ts`**: test-owned reduced Canvas-to-graph adapter.
- **Node `fs`/`path`**: deterministic fixture loading relative to the fixture directory.
- **`graph/` and `runner/`**: consumers of parsed runtime graphs.

## Consumers
`graph-validator.test.ts` and runner suites load files directly or through `protocol-document-fixtures.ts`. Protocol-document migration tests use inline V1 builders instead; do not assume a fixture file exercises `.rp.json` parsing.

## Module Structure
```
*.canvas                         # flat topology/scenario matrix
protocol-document-fixtures.ts   # named fresh Graph factories
snippets/                        # physical Markdown path/content cases
```

## Canvas Compatibility Shape
```json
{
  "nodes": [{
    "id": "n-question", "type": "text",
    "radiprotocol_nodeType": "question",
    "radiprotocol_questionText": "..."
  }],
  "edges": [{
    "id": "e1", "fromNode": "n-start", "toNode": "n-question",
    "radiprotocol_isLoopExit": true
  }]
}
```
Use stable `n-*` node IDs and `e*` edge IDs, Canvas endpoint names (`fromNode`/`toNode`), and `radiprotocol_nodeType`. The parser skips ordinary Canvas nodes and drops edges whose endpoints did not survive parsing.

## Scenario Matrices and Compatibility Labels
```text
canonical: question + loop flag + explicit loop-exit metadata
negative: missing exit/body, dead end, cycle, malformed JSON
legacy: loop-start/loop-end, label-only exit, removed node kind
```
Give each fixture one semantic purpose. Canonical loop fixtures use a looped question and explicit exit metadata; labels alone do not define exits. Legacy/malformed files remain regression cases and must not be exported by canonical happy-path factories.

## Fresh Factory Boundary
```typescript
export function unifiedLoopGraph(): ProtocolGraph {
  const raw = readFileSync(join(__dirname, 'unified-loop-valid.canvas'), 'utf8');
  const parsed = new CanvasParser().parse(raw, 'unified-loop-valid.canvas');
  if (!parsed.success) throw new Error(parsed.error);
  return parsed.graph; // fresh parse on every call
}
```
Add a named `...Graph()` factory only for parse-valid scenarios reused by multiple tests. Use a direct parser when parse failure is the behavior under test or when a scenario is intentionally rare.

## Markdown Fixture Tree
The nested Markdown files represent physical path, empty-file, and raw-content cases. They are not automatically covered merely by existing on-disk presence; active snippet tests usually seed `makeVault()` and generate templates with the canonical serializer.

## Architectural Boundaries
- `.canvas` is compatibility/regression data only; new production protocol examples belong to typed `ProtocolDocumentV1` builders or a future dedicated `.rp.json` loader.
- Do not infer current runtime support from retained fixture names or historical phase directories.
- Fixture IDs, topology, exact text, and expected loop stack depth are part of the consuming test contract.

<important if="you are adding a new fixture scenario">
## Adding a Fixture
1. Choose `.canvas` for compatibility graph parsing or Markdown for physical vault-path behavior.
2. Give it a behavior-oriented name and stable IDs; classify it canonical, negative, malformed, or legacy.
3. Encode explicit loop-exit metadata and keep labels presentation-only.
4. Add a focused assertion; add a factory only when parse-valid and reused.
5. Update hard-coded IDs/expected output in consumers and avoid treating legacy data as a happy path.
</important>
