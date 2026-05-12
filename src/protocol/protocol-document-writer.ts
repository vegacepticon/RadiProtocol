// src/protocol/protocol-document-writer.ts
// Pure writer/converter: ProtocolGraph -> ProtocolDocumentV1.

import type {
  ProtocolGraph,
  RPNode,
  AnswerNode,
  TextBlockNode,
  LoopStartNode,
  LoopEndNode,
  SnippetNode,
  LoopNode,
} from '../graph/graph-model';
import {
  PROTOCOL_SCHEMA,
  PROTOCOL_VERSION,
  type ProtocolDocumentV1,
  type ProtocolNodeRecord,
  type ProtocolEdgeRecord,
} from './protocol-document';

function fieldsForNode(node: RPNode): Record<string, unknown> {
  switch (node.kind) {
    case 'start':
      return {};
    case 'question':
      return { questionText: node.questionText };
    case 'answer': {
      const n = node as AnswerNode;
      return stripUndefined({
        answerText: n.answerText,
        displayLabel: n.displayLabel,
        separator: n.radiprotocol_separator,
      });
    }
    case 'text-block': {
      const n = node as TextBlockNode;
      return stripUndefined({
        content: n.content,
        snippetId: n.snippetId,
        separator: n.radiprotocol_separator,
      });
    }
    case 'loop-start': {
      const n = node as LoopStartNode;
      return stripUndefined({
        loopLabel: n.loopLabel,
        exitLabel: n.exitLabel,
      });
    }
    case 'loop-end': {
      const n = node as LoopEndNode;
      return stripUndefined({
        loopStartId: n.loopStartId,
      });
    }
    case 'snippet': {
      const n = node as SnippetNode;
      return stripUndefined({
        subfolderPath: n.subfolderPath,
        snippetLabel: n.snippetLabel,
        snippetSeparator: n.radiprotocol_snippetSeparator,
        snippetPath: n.radiprotocol_snippetPath,
      });
    }
    case 'loop': {
      const n = node as LoopNode;
      return { headerText: n.headerText };
    }
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export interface ProtocolGraphToDocumentOptions {
  id: string;
  title: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function protocolGraphToDocument(
  graph: ProtocolGraph,
  options: ProtocolGraphToDocumentOptions
): ProtocolDocumentV1 {
  const createdAt = (options.createdAt ?? new Date()).toISOString();
  const updatedAt = (options.updatedAt ?? options.createdAt ?? new Date()).toISOString();

  const nodes: ProtocolNodeRecord[] = Array.from(graph.nodes.values()).map((node) => ({
    id: node.id,
    kind: node.kind,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    color: node.color,
    text: node.text,
    fields: fieldsForNode(node),
  }));

  const edges: ProtocolEdgeRecord[] = graph.edges.map((edge) => ({
    id: edge.id,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    label: edge.label,
  }));

  return {
    schema: PROTOCOL_SCHEMA,
    version: PROTOCOL_VERSION,
    id: options.id,
    title: options.title,
    createdAt,
    updatedAt,
    nodes,
    edges,
  };
}

export function stringifyProtocolDocument(doc: ProtocolDocumentV1): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
