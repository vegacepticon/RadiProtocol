// start-from-node-options.test.ts
// Locks the "start from specific node" picker contract added in 3.2.x:
//   - options ordered by protocol position (BFS distance from the start node),
//     not by kind group or marking order;
//   - per-node custom label (fields.startPointLabel) overrides the node caption.
import { describe, it, expect } from 'vitest';
import { buildStartableProtocolNodeOptions } from '../views/node-picker-modal';
import type { ProtocolEdgeRecord, ProtocolNodeRecord } from '../protocol/protocol-document';

function node(
  id: string,
  kind: ProtocolNodeRecord['kind'],
  fields: Record<string, unknown> = {},
): ProtocolNodeRecord {
  return { id, kind, x: 0, y: 0, width: 10, height: 10, fields };
}

function edge(id: string, fromNodeId: string, toNodeId: string): ProtocolEdgeRecord {
  return { id, fromNodeId, toNodeId };
}

describe('buildStartableProtocolNodeOptions ordering (BFS distance from start)', () => {
  it('orders options by graph distance from the start node, not by kind or marking order', () => {
    const nodes = [
      node('start', 'start'),
      node('far-answer', 'answer', { startPointEnabled: true, answerText: 'Far answer' }),
      node('near-question', 'question', { startPointEnabled: true, questionText: 'Near question' }),
      node('mid-block', 'text-block', { startPointEnabled: true, content: 'Mid block' }),
    ];
    const edges = [
      edge('e1', 'start', 'mid-block'),
      edge('e2', 'mid-block', 'near-question'),
      edge('e3', 'near-question', 'far-answer'),
    ];
    const opts = buildStartableProtocolNodeOptions(nodes, undefined as never, edges);
    expect(opts.map((o) => o.id)).toEqual(['mid-block', 'near-question', 'far-answer']);
  });

  it('does not depend on document order of the marked nodes', () => {
    const nodes = [
      node('start', 'start'),
      node('late', 'question', { startPointEnabled: true, questionText: 'Late' }),
      node('early', 'question', { startPointEnabled: true, questionText: 'Early' }),
    ];
    const edges = [
      edge('e1', 'start', 'early'),
      edge('e2', 'early', 'late'),
    ];
    const opts = buildStartableProtocolNodeOptions(nodes, undefined as never, edges);
    expect(opts.map((o) => o.id)).toEqual(['early', 'late']);
  });

  it('places unreachable-from-start options after reachable ones, in document order', () => {
    const nodes = [
      node('start', 'start'),
      node('orphan-b', 'question', { startPointEnabled: true, questionText: 'Orphan B' }),
      node('reachable', 'question', { startPointEnabled: true, questionText: 'Reachable' }),
      node('orphan-a', 'question', { startPointEnabled: true, questionText: 'Orphan A' }),
    ];
    const edges = [edge('e1', 'start', 'reachable')];
    const opts = buildStartableProtocolNodeOptions(nodes, undefined as never, edges);
    expect(opts.map((o) => o.id)).toEqual(['reachable', 'orphan-b', 'orphan-a']);
  });

  it('falls back to kind/document ordering when no start node exists', () => {
    const nodes = [
      node('q1', 'question', { startPointEnabled: true, questionText: 'Q1' }),
      node('a1', 'answer', { startPointEnabled: true, answerText: 'A1' }),
    ];
    const opts = buildStartableProtocolNodeOptions(nodes, undefined as never, []);
    expect(opts).toHaveLength(2);
  });
});

describe('buildStartableProtocolNodeOptions custom start labels', () => {
  it('uses fields.startPointLabel over every other caption source', () => {
    const nodes = [
      node('a1', 'answer', {
        startPointEnabled: true,
        startPointLabel: 'Custom start entry',
        displayLabel: 'Button label',
        answerText: 'Answer body',
      }),
    ];
    const [opt] = buildStartableProtocolNodeOptions(nodes);
    expect(opt?.label).toBe('Custom start entry');
  });

  it('ignores a blank startPointLabel and falls back to the node caption', () => {
    const nodes = [
      node('a1', 'answer', {
        startPointEnabled: true,
        startPointLabel: '   ',
        displayLabel: 'Button label',
      }),
    ];
    const [opt] = buildStartableProtocolNodeOptions(nodes);
    expect(opt?.label).toBe('Button label');
  });

  it('trims surrounding whitespace from the custom label', () => {
    const nodes = [
      node('q1', 'question', {
        startPointEnabled: true,
        startPointLabel: '  Padded label  ',
        questionText: 'Question text',
      }),
    ];
    const [opt] = buildStartableProtocolNodeOptions(nodes);
    expect(opt?.label).toBe('Padded label');
  });

  it('keeps the plain caption when no startPointLabel is configured', () => {
    const nodes = [
      node('q1', 'question', { startPointEnabled: true, questionText: 'Question text' }),
    ];
    const [opt] = buildStartableProtocolNodeOptions(nodes);
    expect(opt?.label).toBe('Question text');
  });
});
