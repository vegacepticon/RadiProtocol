import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../graph/canvas-parser';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
}

describe('CanvasParser', () => {
  describe('parse() — valid fixtures', () => {
    it('parses linear.canvas and returns a ProtocolGraph with correct node kinds', () => {
      const parser = new CanvasParser();
      const result = parser.parse(loadFixture('linear.canvas'), 'linear.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const graph = result.graph;
      expect(graph.nodes.size).toBe(3);
      expect(graph.nodes.get('n-start')?.kind).toBe('start');
      expect(graph.nodes.get('n-q1')?.kind).toBe('question');
      expect(graph.nodes.get('n-a1')?.kind).toBe('answer');
      expect(graph.startNodeId).toBe('n-start');
    });

    it('parses branching.canvas and builds correct adjacency map', () => {
      const parser = new CanvasParser();
      const result = parser.parse(loadFixture('branching.canvas'), 'branching.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const graph = result.graph;
      const q1Edges = graph.adjacency.get('n-q1');
      expect(q1Edges).toBeDefined();
      expect(q1Edges).toContain('n-a1');
      expect(q1Edges).toContain('n-a2');
    });

    it('silently skips plain canvas nodes without radiprotocol_nodeType (PARSE-03)', () => {
      const parser = new CanvasParser();
      const result = parser.parse(loadFixture('branching.canvas'), 'branching.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      // branching.canvas has 5 raw nodes but 1 is plain — expect 4 RP nodes
      expect(result.graph.nodes.size).toBe(4);
      expect(result.graph.nodes.has('n-plain')).toBe(false);
    });

    it('returns error on invalid JSON, not a thrown exception (PARSE-06 resilience)', () => {
      const parser = new CanvasParser();
      const result = parser.parse('not valid json{{{', 'bad.canvas');
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    });
  });

  describe('CanvasParser has zero Obsidian API imports (NFR-01, PARSE-06)', () => {
    it('module can be imported without Obsidian runtime', () => {
      // If this test file loads, the import at the top succeeded in a pure Node.js env.
      // This proves CanvasParser has no obsidian imports.
      expect(typeof CanvasParser).toBe('function');
    });
  });

  describe('RUN-07: legacy loop-start no longer carries maxIterations', () => {
    it('parsed legacy loop-start node has no maxIterations property', () => {
      const parser = new CanvasParser();
      const result = parser.parse(loadFixture('loop-start.canvas'), 'loop-start.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const node = result.graph.nodes.get('n-ls1');
      expect(node).toBeDefined();
      expect(node?.kind).toBe('loop-start');
      // RUN-07 — Phase 44 Plan 04: parser must NOT set the deleted field.
       
      expect('maxIterations' in (node as any)).toBe(false);
    });
  });
});

describe('CanvasParser — snippet node (Phase 29)', () => {
  it('parses snippet-node.canvas — returns SnippetNode with kind "snippet" and subfolderPath "CT/adrenal"', () => {
    const parser = new CanvasParser();
    const result = parser.parse(loadFixture('snippet-node.canvas'), 'snippet-node.canvas');
    expect(result.success).toBe(true);
    if (!result.success) return;
    const node = result.graph.nodes.get('n-snippet1');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('snippet');
     
    expect((node as any).subfolderPath).toBe('CT/adrenal');
  });

  it('parses snippet-node-no-path.canvas — returns SnippetNode with subfolderPath undefined', () => {
    const parser = new CanvasParser();
    const result = parser.parse(loadFixture('snippet-node-no-path.canvas'), 'snippet-node-no-path.canvas');
    expect(result.success).toBe(true);
    if (!result.success) return;
    const node = result.graph.nodes.get('n-snippet1');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('snippet');
     
    expect((node as any).subfolderPath).toBeUndefined();
  });
});

describe('CanvasParser — snippet node extra fields (Phase 31)', () => {
  function buildSnippetCanvas(extraProps: Record<string, unknown>): string {
    return JSON.stringify({
      nodes: [
        {
          id: 'n-start',
          type: 'text',
          text: 'Start',
          x: 0,
          y: 0,
          width: 100,
          height: 60,
          radiprotocol_nodeType: 'start',
        },
        {
          id: 'n-snippet1',
          type: 'text',
          text: 'Snippet',
          x: 200,
          y: 0,
          width: 100,
          height: 60,
          radiprotocol_nodeType: 'snippet',
          ...extraProps,
        },
      ],
      edges: [{ id: 'e1', fromNode: 'n-start', toNode: 'n-snippet1' }],
    });
  }

  function parseSnippet(extraProps: Record<string, unknown>) {
    const parser = new CanvasParser();
    const result = parser.parse(buildSnippetCanvas(extraProps), 'phase31-snippet.canvas');
    if (!result.success) throw new Error(result.error);
    const node = result.graph.nodes.get('n-snippet1');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('snippet');
     
    return node as any;
  }

  it('parses non-empty radiprotocol_snippetLabel into node.snippetLabel', () => {
    const node = parseSnippet({ radiprotocol_snippetLabel: 'Adrenal templates' });
    expect(node.snippetLabel).toBe('Adrenal templates');
  });

  it('normalises empty-string radiprotocol_snippetLabel to undefined', () => {
    const node = parseSnippet({ radiprotocol_snippetLabel: '' });
    expect(node.snippetLabel).toBeUndefined();
  });

  it('returns undefined snippetLabel when radiprotocol_snippetLabel is absent', () => {
    const node = parseSnippet({});
    expect(node.snippetLabel).toBeUndefined();
  });

  it('parses radiprotocol_snippetSeparator="space" as "space"', () => {
    const node = parseSnippet({ radiprotocol_snippetSeparator: 'space' });
    expect(node.radiprotocol_snippetSeparator).toBe('space');
  });

  it('parses radiprotocol_snippetSeparator="newline" as "newline"', () => {
    const node = parseSnippet({ radiprotocol_snippetSeparator: 'newline' });
    expect(node.radiprotocol_snippetSeparator).toBe('newline');
  });

  it('normalises invalid enum radiprotocol_snippetSeparator to undefined', () => {
    const node = parseSnippet({ radiprotocol_snippetSeparator: 'garbage' });
    expect(node.radiprotocol_snippetSeparator).toBeUndefined();
  });

  it('returns undefined radiprotocol_snippetSeparator when absent', () => {
    const node = parseSnippet({});
    expect(node.radiprotocol_snippetSeparator).toBeUndefined();
  });
});

describe('Phase 51 — radiprotocol_snippetPath parsing (PICKER-01)', () => {
  // Local factory mirroring the Phase 31 `buildSnippetCanvas` / `parseSnippet` pair
  // so the new tests remain independent from those of the earlier phase.
  // See `docs/ARCHITECTURE-NOTES.md#snippet-node-binding-and-picker` (D-01/D-02/D-03).
  function buildSnippetCanvas(extraProps: Record<string, unknown>): string {
    return JSON.stringify({
      nodes: [
        {
          id: 'n-start',
          type: 'text',
          text: 'Start',
          x: 0,
          y: 0,
          width: 100,
          height: 60,
          radiprotocol_nodeType: 'start',
        },
        {
          id: 'n-snippet1',
          type: 'text',
          text: 'Snippet',
          x: 200,
          y: 0,
          width: 100,
          height: 60,
          radiprotocol_nodeType: 'snippet',
          ...extraProps,
        },
      ],
      edges: [{ id: 'e1', fromNode: 'n-start', toNode: 'n-snippet1' }],
    });
  }

  function parseSnippet(extraProps: Record<string, unknown>) {
    const parser = new CanvasParser();
    const result = parser.parse(buildSnippetCanvas(extraProps), 'phase51-snippet.canvas');
    if (!result.success) throw new Error(result.error);
    const node = result.graph.nodes.get('n-snippet1');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('snippet');
     
    return node as any;
  }

  it('reads radiprotocol_snippetPath into node.radiprotocol_snippetPath (D-01) with subfolderPath undefined', () => {
    const node = parseSnippet({ radiprotocol_snippetPath: 'abdomen/ct-routine.md' });
    expect(node.radiprotocol_snippetPath).toBe('abdomen/ct-routine.md');
    expect(node.subfolderPath).toBeUndefined();
  });

  it('keeps the extension verbatim per D-03 — .json path stored as-is', () => {
    const node = parseSnippet({ radiprotocol_snippetPath: 'liver/report.json' });
    expect(node.radiprotocol_snippetPath).toBe('liver/report.json');
  });

  it('normalises empty-string radiprotocol_snippetPath to undefined (D-02)', () => {
    const node = parseSnippet({ radiprotocol_snippetPath: '' });
    expect(node.radiprotocol_snippetPath).toBeUndefined();
  });

  it('normalises JSON null radiprotocol_snippetPath to undefined (D-02)', () => {
    const node = parseSnippet({ radiprotocol_snippetPath: null });
    expect(node.radiprotocol_snippetPath).toBeUndefined();
  });

  it('normalises non-string radiprotocol_snippetPath (e.g. number 123) to undefined (D-02)', () => {
    const node = parseSnippet({ radiprotocol_snippetPath: 123 });
    expect(node.radiprotocol_snippetPath).toBeUndefined();
  });

  it('back-compat: snippet node with neither radiprotocol_snippetPath nor radiprotocol_subfolderPath yields both undefined (Pitfall #11)', () => {
    const node = parseSnippet({});
    expect(node.radiprotocol_snippetPath).toBeUndefined();
    expect(node.subfolderPath).toBeUndefined();
  });

  it('back-compat: legacy directory-bound snippet (only radiprotocol_subfolderPath) is byte-identical to pre-Phase-51 behaviour', () => {
    const node = parseSnippet({ radiprotocol_subfolderPath: 'abdomen' });
    expect(node.subfolderPath).toBe('abdomen');
    expect(node.radiprotocol_snippetPath).toBeUndefined();
  });

  it('parser preserves both fields if both set on disk; mutual exclusivity is enforced on write per D-01', () => {
    const node = parseSnippet({
      radiprotocol_subfolderPath: 'abdomen',
      radiprotocol_snippetPath: 'liver/r.md',
    });
    expect(node.subfolderPath).toBe('abdomen');
    expect(node.radiprotocol_snippetPath).toBe('liver/r.md');
  });
});

// Phase 50 fixtures for bi-directional Answer.displayLabel ↔ incoming edge label sync
// (D-17: exercises reverseAdjacency enumeration used by edge-label-reconciler.ts
// and regression-guards RPEdge.label propagation that the reconciler depends on).
describe('Phase 50 fixtures — multi-incoming + displayLabel-edge mismatch', () => {
  it('parses branching-multi-incoming.canvas — reverseAdjacency.get(sharedAnswerId) returns both Question parents', () => {
    const parser = new CanvasParser();
    const result = parser.parse(loadFixture('branching-multi-incoming.canvas'), 'branching-multi-incoming.canvas');
    expect(result.success).toBe(true);
    if (!result.success) return;
    const graph = result.graph;
    const incoming = graph.reverseAdjacency.get('n-a-shared');
    expect(incoming).toBeDefined();
    expect(incoming).toContain('n-q1');
    expect(incoming).toContain('n-q2');
    expect(incoming!.length).toBe(2);
    // Edge labels preserved on RPEdge.label (reconciler's input)
    const e1 = graph.edges.find(e => e.id === 'e1');
    const e2 = graph.edges.find(e => e.id === 'e2');
    expect(e1?.label).toBe('Вариант X');
    expect(e2?.label).toBe('Вариант Y');
  });

  it('parses displayLabel-edge-mismatch.canvas — edge.label preserved on RPEdge.label; Answer.displayLabel preserved on node', () => {
    const parser = new CanvasParser();
    const result = parser.parse(loadFixture('displayLabel-edge-mismatch.canvas'), 'displayLabel-edge-mismatch.canvas');
    expect(result.success).toBe(true);
    if (!result.success) return;
    const graph = result.graph;
    const edge = graph.edges.find(e => e.id === 'e1');
    expect(edge?.label).toBe('Y');
    const answer = graph.nodes.get('n-a1');
    expect(answer).toBeDefined();
    if (!answer || answer.kind !== 'answer') return;
    expect(answer.displayLabel).toBe('X');
  });
});
