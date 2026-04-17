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
  SnippetNode,  // Phase 29
  LoopNode,     // Phase 43 D-05 — unified loop kind (LOOP-01, LOOP-02)
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
      'text-block', 'loop-start', 'loop-end', 'snippet',  // Phase 29
      'loop',  // Phase 43 D-05 — unified loop (LOOP-01, LOOP-02)
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
          radiprotocol_separator: props['radiprotocol_separator'] === 'space' ? 'space'
            : props['radiprotocol_separator'] === 'newline' ? 'newline'
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
          radiprotocol_separator: props['radiprotocol_separator'] === 'space' ? 'space'
            : props['radiprotocol_separator'] === 'newline' ? 'newline'
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
          radiprotocol_separator: props['radiprotocol_separator'] === 'space' ? 'space'
            : props['radiprotocol_separator'] === 'newline' ? 'newline'
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
      case 'snippet': {
        const rawPath = props['radiprotocol_subfolderPath'];
        const rawLabel = props['radiprotocol_snippetLabel'];
        const rawSep = props['radiprotocol_snippetSeparator'];
        const node: SnippetNode = {
          ...base,
          kind: 'snippet',
          // WR-02: treat JSON null and empty string identically to undefined — all mean "root"
          subfolderPath: (typeof rawPath === 'string' && rawPath !== '')
            ? rawPath
            : undefined,
          // Phase 31 D-01: empty string normalised to undefined (mirror WR-02 pattern)
          snippetLabel: (typeof rawLabel === 'string' && rawLabel !== '') ? rawLabel : undefined,
          // Phase 31 D-04: strict enum normalisation (mirror radiprotocol_separator pattern)
          radiprotocol_snippetSeparator: rawSep === 'space' ? 'space'
            : rawSep === 'newline' ? 'newline'
            : undefined,
        };
        return node;
      }
      case 'loop': {
        // Phase 43 D-05 — unified loop node (LOOP-01, LOOP-02, LOOP-03).
        // headerText нормализуется в '' если radiprotocol_headerText отсутствует/undefined
        // (симметрия с TextBlockNode.content, НЕ SnippetNode.subfolderPath?: string | undefined).
        const node: LoopNode = {
          ...base,
          kind: 'loop',
          headerText: getString(props, 'radiprotocol_headerText', ''),
        };
        return node;
      }
    }
  }
}
