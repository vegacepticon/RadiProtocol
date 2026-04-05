# Plan 01-03: CanvasParser Implementation

**Phase**: 1 — Project Scaffold and Canvas Parsing Foundation
**Requirements**: PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06, NFR-01, NFR-07, NFR-11
**Wave**: 2
**Depends on**: 01-02 (stubs), 01-00 (test stubs and fixtures)

## Goal

Implement `CanvasParser.parse()` so it converts a canvas JSON string into a typed `ProtocolGraph`, silently skips plain nodes, and returns a structured error result on invalid JSON — with all canvas-parser tests passing GREEN.

## Context

`CanvasParser` is a pure TypeScript module with zero Obsidian API imports (PARSE-06, NFR-01). It receives a JSON string (the caller does `vault.read()`) and returns a `ParseResult`. The graph model types in `src/graph/graph-model.ts` are already defined by Plan 01-02 and must not be modified here. The test file `src/__tests__/canvas-parser.test.ts` already exists (Plan 01-00) and defines exactly what must pass. This plan turns those failing stubs GREEN.

The Canvas JSON format (JSON Canvas v1.0) is just `JSON.parse` plus TypeScript type assertions — no library needed. Custom RadiProtocol fields live on canvas node objects as `radiprotocol_*` properties. Nodes without `radiprotocol_nodeType` are silently skipped (PARSE-03).

`noUncheckedIndexedAccess` is enabled in tsconfig (D-07) — all array index accesses and Map lookups return `T | undefined`. Every such access must include a null/undefined check or use the `?.` operator.

---

## Tasks

### Task 01-03-01: Implement CanvasParser.parse() — node parsing and graph construction

**Requirement**: PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-06, NFR-01, NFR-11
**Verify**: `npx vitest run src/__tests__/canvas-parser.test.ts 2>&1 | tail -20` — all tests in that file must show as `pass`.

Replace the stub body of `src/graph/canvas-parser.ts` with the full implementation. The file must have zero Obsidian API imports — use only `node:` modules if needed (none are needed for parsing) and TypeScript built-ins.

Full implementation of `src/graph/canvas-parser.ts`:

```typescript
// graph/canvas-parser.ts
// Pure module — zero Obsidian API imports (PARSE-06, NFR-01, NFR-07)

import type {
  RPNode,
  RPNodeKind,
  RPEdge,
  ProtocolGraph,
  ParseResult,
  StartNode,
  QuestionNode,
  AnswerNode,
  FreeTextInputNode,
  TextBlockNode,
  LoopStartNode,
  LoopEndNode,
} from './graph-model';

// Minimal canvas JSON shape we need from the JSON Canvas v1.0 spec.
// We do NOT import from 'obsidian/canvas' here — that would require
// the Obsidian runtime and break unit tests (PARSE-06, NFR-01).
interface RawCanvasNode {
  id: string;
  type: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  // radiprotocol_* fields are accessed via index signature below
  [key: string]: unknown;
}

interface RawCanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  label?: string;
}

interface RawCanvasData {
  nodes: RawCanvasNode[];
  edges: RawCanvasEdge[];
}

function getString(obj: Record<string, unknown>, key: string, fallback = ''): string {
  const v = obj[key];
  return typeof v === 'string' ? v : fallback;
}

function getNumber(obj: Record<string, unknown>, key: string, fallback = 0): number {
  const v = obj[key];
  return typeof v === 'number' ? v : fallback;
}

export class CanvasParser {
  /**
   * Parse a canvas JSON string into a ProtocolGraph.
   * Returns { success: false, error: string } on parse failure — never throws.
   * Plain canvas nodes (no radiprotocol_nodeType) are silently skipped (PARSE-03).
   */
  parse(jsonString: string, canvasFilePath: string): ParseResult {
    // Step 1: Parse JSON — catch malformed input (PARSE-06 resilience)
    let raw: RawCanvasData;
    try {
      raw = JSON.parse(jsonString) as RawCanvasData;
    } catch {
      return { success: false, error: 'Canvas file contains invalid JSON' };
    }

    if (!raw || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
      return { success: false, error: 'Canvas file is missing required "nodes" or "edges" arrays' };
    }

    // Step 2: Parse nodes — collect RP nodes, silently skip plain nodes
    const nodes = new Map<string, RPNode>();
    const parseErrors: string[] = [];

    for (const rawNode of raw.nodes) {
      const result = this.parseNode(rawNode);
      if (result === null) {
        // Plain canvas node without radiprotocol_nodeType — silently skip (PARSE-03)
        continue;
      }
      if ('parseError' in result) {
        parseErrors.push(result.parseError);
        continue;
      }
      nodes.set(result.id, result);
    }

    if (parseErrors.length > 0) {
      return { success: false, error: parseErrors.join('; ') };
    }

    // Step 3: Build adjacency lists — only include edges between RP nodes
    const adjacency = new Map<string, string[]>();
    const reverseAdjacency = new Map<string, string[]>();
    const edges: RPEdge[] = [];

    for (const rawEdge of raw.edges) {
      // Skip edges that reference non-RP or missing nodes
      if (!nodes.has(rawEdge.fromNode) || !nodes.has(rawEdge.toNode)) continue;

      edges.push({
        id: rawEdge.id,
        fromNodeId: rawEdge.fromNode,
        toNodeId: rawEdge.toNode,
        label: rawEdge.label,
      });

      const fromAdj = adjacency.get(rawEdge.fromNode);
      if (fromAdj !== undefined) {
        fromAdj.push(rawEdge.toNode);
      } else {
        adjacency.set(rawEdge.fromNode, [rawEdge.toNode]);
      }

      const toRevAdj = reverseAdjacency.get(rawEdge.toNode);
      if (toRevAdj !== undefined) {
        toRevAdj.push(rawEdge.fromNode);
      } else {
        reverseAdjacency.set(rawEdge.toNode, [rawEdge.fromNode]);
      }
    }

    // Step 4: Find start node (GraphValidator will enforce exactly-one; parser finds any)
    let startNodeId = '';
    for (const [id, node] of nodes) {
      if (node.kind === 'start') {
        startNodeId = id;
        break;
      }
    }

    const graph: ProtocolGraph = {
      canvasFilePath,
      nodes,
      edges,
      adjacency,
      reverseAdjacency,
      startNodeId,
    };

    return { success: true, graph };
  }

  private parseNode(raw: RawCanvasNode): RPNode | null | { parseError: string } {
    // Not a RadiProtocol node — skip silently (PARSE-03)
    const kind = raw['radiprotocol_nodeType'];
    if (kind === undefined || kind === null) return null;

    if (typeof kind !== 'string') {
      return { parseError: `Node "${raw.id}" has non-string radiprotocol_nodeType` };
    }

    const validKinds: RPNodeKind[] = [
      'start', 'question', 'answer', 'free-text-input',
      'text-block', 'loop-start', 'loop-end',
    ];

    if (!(validKinds as string[]).includes(kind)) {
      return { parseError: `Node "${raw.id}" has unknown radiprotocol_nodeType: "${kind}"` };
    }

    const rpKind = kind as RPNodeKind;

    const base = {
      id: raw.id,
      x: raw.x,
      y: raw.y,
      width: raw.width,
      height: raw.height,
      color: typeof raw.color === 'string' ? raw.color : undefined,
    };

    const props = raw as Record<string, unknown>;

    switch (rpKind) {
      case 'start': {
        const node: StartNode = { ...base, kind: 'start' };
        return node;
      }
      case 'question': {
        const node: QuestionNode = {
          ...base,
          kind: 'question',
          questionText: getString(props, 'radiprotocol_questionText', raw.text ?? ''),
        };
        return node;
      }
      case 'answer': {
        const node: AnswerNode = {
          ...base,
          kind: 'answer',
          answerText: getString(props, 'radiprotocol_answerText', raw.text ?? ''),
          displayLabel: props['radiprotocol_displayLabel'] !== undefined
            ? getString(props, 'radiprotocol_displayLabel')
            : undefined,
        };
        return node;
      }
      case 'free-text-input': {
        const node: FreeTextInputNode = {
          ...base,
          kind: 'free-text-input',
          promptLabel: getString(props, 'radiprotocol_promptLabel', raw.text ?? ''),
          prefix: props['radiprotocol_prefix'] !== undefined
            ? getString(props, 'radiprotocol_prefix')
            : undefined,
          suffix: props['radiprotocol_suffix'] !== undefined
            ? getString(props, 'radiprotocol_suffix')
            : undefined,
        };
        return node;
      }
      case 'text-block': {
        const node: TextBlockNode = {
          ...base,
          kind: 'text-block',
          content: getString(props, 'radiprotocol_content', raw.text ?? ''),
          snippetId: props['radiprotocol_snippetId'] !== undefined
            ? getString(props, 'radiprotocol_snippetId')
            : undefined,
        };
        return node;
      }
      case 'loop-start': {
        const node: LoopStartNode = {
          ...base,
          kind: 'loop-start',
          loopLabel: getString(props, 'radiprotocol_loopLabel', 'Loop'),
          exitLabel: getString(props, 'radiprotocol_exitLabel', 'Done'),
          maxIterations: getNumber(props, 'radiprotocol_maxIterations', 50),
        };
        return node;
      }
      case 'loop-end': {
        const loopStartId = getString(props, 'radiprotocol_loopStartId');
        if (!loopStartId) {
          return { parseError: `Loop-end node "${raw.id}" is missing radiprotocol_loopStartId` };
        }
        const node: LoopEndNode = {
          ...base,
          kind: 'loop-end',
          loopStartId,
        };
        return node;
      }
    }
  }
}
```

After writing the file, run:
```
npx vitest run src/__tests__/canvas-parser.test.ts 2>&1 | tail -30
```

All tests in `canvas-parser.test.ts` must show as `pass`. If any test fails, inspect the failure message and correct the implementation before proceeding.

---

### Task 01-03-02: Confirm no Obsidian imports and TypeScript compiles clean

**Requirement**: PARSE-06, NFR-01, NFR-07
**Verify**: Two commands must both succeed:
1. `grep -r "from 'obsidian'" src/graph/ 2>&1` — must produce no output (zero matches)
2. `npx tsc -noEmit -skipLibCheck 2>&1 | grep -c "error TS"` — must output `0`

1. Run `grep -r "from 'obsidian'" src/graph/` — confirm zero lines are printed. If any `obsidian` import appears in `src/graph/`, remove it. The graph module must have zero Obsidian API dependencies (PARSE-06, NFR-01).

2. Run `npx tsc -noEmit -skipLibCheck` — confirm zero TypeScript errors. If errors appear, fix them before marking this task complete.

3. Run the full Vitest suite to confirm no regressions: `npx vitest run 2>&1 | tail -20`. All previously passing tests must continue to pass.

---

## Recommended Commit

```
feat(01): implement CanvasParser — pure JSON→ProtocolGraph with silent skip for plain nodes
```
