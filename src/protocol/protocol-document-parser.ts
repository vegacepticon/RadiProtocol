// src/protocol/protocol-document-parser.ts
// Pure parser: ProtocolDocumentV1 JSON -> ProtocolGraph.
// No Obsidian imports; safe for unit tests and official plugin review.

import type {
  RPNode,
  RPNodeKind,
  RPEdge,
  ProtocolGraph,
  ParseResult,
  StartNode,
  QuestionNode,
  AnswerNode,
  TextBlockNode,
  LoopNode,
  SnippetNode,
  LoopStartNode,
  LoopEndNode,
} from '../graph/graph-model';
import { defaultT, type Translator } from '../i18n';
import {
  isProtocolDocumentV1,
  type ProtocolDocumentV1,
  type ProtocolNodeRecord,
} from './protocol-document';

const VALID_KINDS: RPNodeKind[] = [
  'start',
  'question',
  'answer',
  'text-block',
  'loop-start',
  'loop-end',
  'snippet',
  'loop',
];

function getCompatValue(obj: Record<string, unknown>, key: string, legacyKey?: string): unknown {
  const v = obj[key];
  if (typeof v !== 'undefined') return v;
  return legacyKey !== undefined ? obj[legacyKey] : undefined;
}

function getString(obj: Record<string, unknown>, key: string, fallback = '', legacyKey?: string): string {
  const v = getCompatValue(obj, key, legacyKey);
  return typeof v === 'string' ? v : fallback;
}

function getOptionalString(obj: Record<string, unknown>, key: string, legacyKey?: string): string | undefined {
  const v = getCompatValue(obj, key, legacyKey);
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function getSeparator(obj: Record<string, unknown>, key: string, legacyKey?: string): 'newline' | 'space' | undefined {
  const v = getCompatValue(obj, key, legacyKey);
  return v === 'newline' || v === 'space' ? v : undefined;
}

export class ProtocolDocumentParser {
  private readonly t: Translator;

  constructor(t: Translator = defaultT) {
    this.t = t;
  }

  /**
   * Parse a .rp.json protocol document string into a runtime ProtocolGraph.
   * Returns a ParseResult; never throws.
   */
  parse(jsonString: string, protocolFilePath: string): ParseResult {
    let raw: unknown;
    try {
      raw = JSON.parse(jsonString);
    } catch {
      return { success: false, error: 'Protocol file contains invalid JSON' };
    }

    if (!isProtocolDocumentV1(raw)) {
      return { success: false, error: 'Protocol file is missing required schema/version/nodes/edges fields' };
    }

    return this.parseDocument(raw, protocolFilePath);
  }

  parseDocument(doc: ProtocolDocumentV1, protocolFilePath: string): ParseResult {
    const nodes = new Map<string, RPNode>();
    const parseErrors: string[] = [];

    for (const record of doc.nodes) {
      const result = this.parseNode(record);
      if (result === null) continue;
      if ('parseError' in result) {
        parseErrors.push(result.parseError);
        continue;
      }
      nodes.set(result.id, result);
    }

    if (parseErrors.length > 0) {
      return { success: false, error: parseErrors.join('; ') };
    }

    const adjacency = new Map<string, string[]>();
    const reverseAdjacency = new Map<string, string[]>();
    const edges: RPEdge[] = [];

    for (const rawEdge of doc.edges) {
      if (
        typeof rawEdge.id !== 'string' ||
        typeof rawEdge.fromNodeId !== 'string' ||
        typeof rawEdge.toNodeId !== 'string'
      ) {
        continue;
      }

      // Skip edges that reference untyped/missing nodes, matching CanvasParser behavior.
      if (!nodes.has(rawEdge.fromNodeId) || !nodes.has(rawEdge.toNodeId)) continue;

      edges.push({
        id: rawEdge.id,
        fromNodeId: rawEdge.fromNodeId,
        toNodeId: rawEdge.toNodeId,
        label: typeof rawEdge.label === 'string' ? rawEdge.label : undefined,
      });

      const fromAdj = adjacency.get(rawEdge.fromNodeId);
      if (fromAdj !== undefined) fromAdj.push(rawEdge.toNodeId);
      else adjacency.set(rawEdge.fromNodeId, [rawEdge.toNodeId]);

      const toRevAdj = reverseAdjacency.get(rawEdge.toNodeId);
      if (toRevAdj !== undefined) toRevAdj.push(rawEdge.fromNodeId);
      else reverseAdjacency.set(rawEdge.toNodeId, [rawEdge.fromNodeId]);
    }

    let startNodeId = '';
    for (const [id, node] of nodes) {
      if (node.kind === 'start') {
        startNodeId = id;
        break;
      }
    }

    const graph: ProtocolGraph = {
      canvasFilePath: protocolFilePath,
      nodes,
      edges,
      adjacency,
      reverseAdjacency,
      startNodeId,
    };

    return { success: true, graph };
  }

  private parseNode(raw: ProtocolNodeRecord): RPNode | null | { parseError: string } {
    if (raw.kind === null || raw.kind === undefined) return null;

    if (typeof raw.kind !== 'string') {
      return { parseError: `Node "${raw.id}" has non-string kind` };
    }

    // free-text-input was removed from RPNodeKind in Phase 46;
    // reject it explicitly so authors get a clear message.
    if ((raw.kind as string) === 'free-text-input') {
      return { parseError: this.t('canvasParser.legacyFreeTextInput', { id: raw.id }) };
    }

    if (!(VALID_KINDS as string[]).includes(raw.kind)) {
      return { parseError: `Node "${raw.id}" has unknown kind: "${raw.kind}"` };
    }

    if (typeof raw.id !== 'string') {
      return { parseError: 'Protocol node is missing string id' };
    }

    const fields = typeof raw.fields === 'object' && raw.fields !== null
      ? raw.fields as Record<string, unknown>
      : {};

    const base = {
      id: raw.id,
      x: typeof raw.x === 'number' ? raw.x : 0,
      y: typeof raw.y === 'number' ? raw.y : 0,
      width: typeof raw.width === 'number' ? raw.width : 250,
      height: typeof raw.height === 'number' ? raw.height : 60,
      color: typeof raw.color === 'string' ? raw.color : undefined,
      text: typeof raw.text === 'string' ? raw.text : undefined,
    };

    switch (raw.kind) {
      case 'start': {
        const node: StartNode = { ...base, kind: 'start' };
        return node;
      }
      case 'question': {
        const node: QuestionNode = {
          ...base,
          kind: 'question',
          questionText: getString(fields, 'questionText', raw.text ?? '', 'radiprotocol_questionText'),
        };
        return node;
      }
      case 'answer': {
        const node: AnswerNode = {
          ...base,
          kind: 'answer',
          answerText: getString(fields, 'answerText', raw.text ?? '', 'radiprotocol_answerText'),
          displayLabel: getOptionalString(fields, 'displayLabel', 'radiprotocol_displayLabel'),
          radiprotocol_separator: getSeparator(fields, 'separator', 'radiprotocol_separator'),
        };
        return node;
      }
      case 'text-block': {
        const node: TextBlockNode = {
          ...base,
          kind: 'text-block',
          content: getString(fields, 'content', raw.text ?? '', 'radiprotocol_content'),
          snippetId: getOptionalString(fields, 'snippetId', 'radiprotocol_snippetId'),
          radiprotocol_separator: getSeparator(fields, 'separator', 'radiprotocol_separator'),
        };
        return node;
      }
      case 'loop-start': {
        const node: LoopStartNode = {
          ...base,
          kind: 'loop-start',
          loopLabel: getString(fields, 'loopLabel', 'Loop', 'radiprotocol_loopLabel'),
          exitLabel: getString(fields, 'exitLabel', 'Done', 'radiprotocol_exitLabel'),
        };
        return node;
      }
      case 'loop-end': {
        const loopStartId = getString(fields, 'loopStartId', '', 'radiprotocol_loopStartId');
        if (!loopStartId) {
          return { parseError: `Loop-end node "${raw.id}" is missing loopStartId` };
        }
        const node: LoopEndNode = {
          ...base,
          kind: 'loop-end',
          loopStartId,
        };
        return node;
      }
      case 'snippet': {
        const node: SnippetNode = {
          ...base,
          kind: 'snippet',
          subfolderPath: getOptionalString(fields, 'subfolderPath', 'radiprotocol_subfolderPath'),
          snippetLabel: getOptionalString(fields, 'snippetLabel', 'radiprotocol_snippetLabel'),
          radiprotocol_snippetSeparator: getSeparator(fields, 'snippetSeparator', 'radiprotocol_snippetSeparator'),
          radiprotocol_snippetPath: getOptionalString(fields, 'snippetPath', 'radiprotocol_snippetPath'),
        };
        return node;
      }
      case 'loop': {
        const node: LoopNode = {
          ...base,
          kind: 'loop',
          headerText: getString(fields, 'headerText', '', 'radiprotocol_headerText'),
        };
        return node;
      }
    }
  }
}

export function parseProtocolDocument(
  jsonString: string,
  protocolFilePath: string,
  t: Translator = defaultT
): ParseResult {
  return new ProtocolDocumentParser(t).parse(jsonString, protocolFilePath);
}
