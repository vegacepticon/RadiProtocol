// src/__tests__/protocol-document-parser.test.ts
import { describe, it, expect } from 'vitest';
import { ProtocolDocumentParser } from '../protocol/protocol-document-parser';
import type { ProtocolDocumentV1 } from '../protocol/protocol-document';

const parser = new ProtocolDocumentParser();

function validDoc(overrides: Partial<ProtocolDocumentV1> = {}): ProtocolDocumentV1 {
  return {
    schema: 'radiprotocol.protocol',
    version: 1,
    id: 'test-1',
    title: 'Test Protocol',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [],
    edges: [],
    ...overrides,
  };
}

describe('ProtocolDocumentParser — basic validation', () => {
  it('rejects invalid JSON', () => {
    const result = parser.parse('{ invalid json', 'test.rp.json');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('invalid JSON');
  });

  it('rejects missing schema field', () => {
    const doc = validDoc();
    (doc as unknown as Record<string, unknown>)['schema'] = undefined;
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('schema');
  });

  it('rejects wrong schema name', () => {
    const doc = validDoc({ schema: 'wrong.schema' as never });
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(false);
  });

  it('rejects wrong version', () => {
    const doc = validDoc({ version: 99 as never });
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(false);
  });

  it('accepts valid minimal document', () => {
    const doc = validDoc();
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.graph.nodes.size).toBe(0);
      expect(result.graph.edges.length).toBe(0);
    }
  });
});

describe('ProtocolDocumentParser — node types', () => {
  function docWithNodes(
    nodes: Array<{ id: string; kind: string | null; fields?: Record<string, unknown> }>
  ): ProtocolDocumentV1 {
    return validDoc({
      nodes: nodes.map((n) => ({
        id: n.id,
        kind: n.kind as never,
        x: 0, y: 0, width: 250, height: 60,
        fields: n.fields ?? {},
      })),
    });
  }

  it('parses start node', () => {
    const doc = docWithNodes([{ id: 'n1', kind: 'start' }]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      const node = result.graph.nodes.get('n1');
      expect(node).toBeDefined();
      expect(node!.kind).toBe('start');
    }
  });

  it('parses question node with questionText in fields', () => {
    const doc = docWithNodes([{
      id: 'n1', kind: 'start',
    }, {
      id: 'n2', kind: 'question',
      fields: { questionText: 'What is the dose?' },
    }]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      const node = result.graph.nodes.get('n2');
      expect(node!.kind).toBe('question');
      expect((node as any).questionText).toBe('What is the dose?');
    }
  });

  it('parses answer node with displayLabel and separator', () => {
    const doc = docWithNodes([{
      id: 'n1', kind: 'start',
    }, {
      id: 'n2', kind: 'answer',
      fields: {
        answerText: '5 mL',
        displayLabel: 'Low',
        separator: 'newline',
      },
    }]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      const node = result.graph.nodes.get('n2');
      expect(node!.kind).toBe('answer');
      expect((node as any).answerText).toBe('5 mL');
      expect((node as any).displayLabel).toBe('Low');
      expect((node as any).radiprotocol_separator).toBe('newline');
    }
  });

  it('parses text-block node with content', () => {
    const doc = docWithNodes([{
      id: 'n1', kind: 'text-block',
      fields: { content: 'Summary text' },
    }]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      const node = result.graph.nodes.get('n1');
      expect((node as any).content).toBe('Summary text');
    }
  });

  it('parses unified loop node', () => {
    const doc = docWithNodes([{
      id: 'n1', kind: 'loop',
      fields: { headerText: 'Repeat for each slice' },
    }]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      const node = result.graph.nodes.get('n1');
      expect(node!.kind).toBe('loop');
      expect((node as any).headerText).toBe('Repeat for each slice');
    }
  });

  it('parses snippet node with subfolderPath', () => {
    const doc = docWithNodes([{
      id: 'n1', kind: 'snippet',
      fields: { subfolderPath: 'protocols/dose', snippetLabel: 'Dose Snippet' },
    }]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      const node = result.graph.nodes.get('n1');
      expect(node!.kind).toBe('snippet');
      expect((node as any).subfolderPath).toBe('protocols/dose');
    }
  });

  it('skips null-kind nodes silently', () => {
    const doc = docWithNodes([
      { id: 'n1', kind: 'start' },
      { id: 'n2', kind: null },
    ]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.graph.nodes.size).toBe(1);
    }
  });

  it('rejects unknown kind', () => {
    const doc = docWithNodes([{ id: 'n1', kind: 'unknown-kind' }]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('unknown-kind');
  });

  it('rejects free-text-input kind', () => {
    const doc = docWithNodes([{ id: 'n1', kind: 'free-text-input' as never }]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('free-text-input');
  });
});

describe('ProtocolDocumentParser — edges and adjacency', () => {
  function docWithEdge(
    from: string,
    to: string,
    label?: string
  ): ProtocolDocumentV1 {
    return validDoc({
      nodes: [
        { id: 'n-start', kind: 'start', x: 0, y: 0, width: 250, height: 60, fields: {} },
        { id: 'n-q', kind: 'question', x: 0, y: 100, width: 250, height: 60, fields: { questionText: 'Q?' } },
      ],
      edges: [
        { id: 'e1', fromNodeId: from, toNodeId: to, ...(label && { label }) },
      ],
    });
  }

  it('builds adjacency from edges', () => {
    const doc = docWithEdge('n-start', 'n-q');
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.graph.adjacency.get('n-start')).toEqual(['n-q']);
      expect(result.graph.reverseAdjacency.get('n-q')).toEqual(['n-start']);
    }
  });

  it('skips edges referencing missing nodes', () => {
    const doc = docWithEdge('n-nonexistent', 'n-q');
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.graph.edges.length).toBe(0);
    }
  });

  it('preserves edge labels', () => {
    const doc = docWithEdge('n-start', 'n-q', 'Yes');
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.graph.edges[0]!.label).toBe('Yes');
    }
  });

  it('finds startNodeId from graph', () => {
    const doc = docWithEdge('n-start', 'n-q');
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.graph.startNodeId).toBe('n-start');
    }
  });
});

describe('ProtocolDocumentParser — canvasFilePath mapping', () => {
  it('uses protocolFilePath as canvasFilePath in graph', () => {
    const doc = validDoc({
      nodes: [{ id: 'n1', kind: 'start', x: 0, y: 0, width: 250, height: 60, fields: {} }],
    });
    const result = parser.parse(JSON.stringify(doc), 'protocols/my-protocol.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.graph.canvasFilePath).toBe('protocols/my-protocol.rp.json');
    }
  });
});
