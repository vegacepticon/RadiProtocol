import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../graph/canvas-parser';
import type { SnippetNode } from '../graph/graph-model';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
}

describe('CanvasParser', () => {
  describe('parse() — snippet node parsing (SNIPPET-02, Task 25-01-01)', () => {
    it('parses a snippet node with folderPath and buttonLabel from radiprotocol_ fields', () => {
      const parser = new CanvasParser();
      const result = parser.parse(loadFixture('snippet-node.canvas'), 'snippet-node.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;

      const node = result.graph.nodes.get('n-snippet1') as SnippetNode | undefined;
      expect(node).toBeDefined();
      if (!node) return;

      expect(node.kind).toBe('snippet');
      expect(node.folderPath).toBe('snippets/liver');
      expect(node.buttonLabel).toBe('Select snippet file');
    });

    it('parses a snippet node with no folderPath/buttonLabel fields as undefined', () => {
      const minimalCanvas = JSON.stringify({
        nodes: [
          { id: 'n-start', type: 'text', text: 'Start', x: 0, y: 0, width: 200, height: 60, radiprotocol_nodeType: 'start' },
          { id: 'n-snip', type: 'text', text: '', x: 0, y: 120, width: 200, height: 60, radiprotocol_nodeType: 'snippet' },
        ],
        edges: [
          { id: 'e1', fromNode: 'n-start', toNode: 'n-snip' },
        ],
      });
      const parser = new CanvasParser();
      const result = parser.parse(minimalCanvas, 'minimal-snippet.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;

      const node = result.graph.nodes.get('n-snip') as SnippetNode | undefined;
      expect(node).toBeDefined();
      if (!node) return;

      expect(node.kind).toBe('snippet');
      expect(node.folderPath).toBeUndefined();
      expect(node.buttonLabel).toBeUndefined();
    });
  });

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
});
