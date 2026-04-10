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

  describe('DEPRECATED_KINDS silent-skip (NTYPE-01, NTYPE-02)', () => {
    it('silently skips a node with radiprotocol_nodeType="free-text-input"', () => {
      // Uses the deprecated-free-text.canvas fixture (inline JSON for speed).
      // After Plan 02 adds DEPRECATED_KINDS, this will pass.
      // Currently fails because free-text-input is still in validKinds.
      const parser = new CanvasParser();
      const fixtureJson = JSON.stringify({
        nodes: [
          { id: 'n-start', type: 'text', text: '', x: 0, y: 0, width: 200, height: 60, radiprotocol_nodeType: 'start' },
          { id: 'n-ft1', type: 'text', text: 'What is your finding?', x: 0, y: 120, width: 200, height: 60, radiprotocol_nodeType: 'free-text-input', radiprotocol_promptLabel: 'What is your finding?' },
        ],
        edges: [{ id: 'e1', fromNode: 'n-start', toNode: 'n-ft1' }],
      });
      const result = parser.parse(fixtureJson, 'deprecated-free-text.canvas');
      // Must parse successfully — no error
      expect(result.success).toBe(true);
      if (!result.success) return;
      // The free-text-input node must NOT be in the graph
      expect(result.graph.nodes.has('n-ft1')).toBe(false);
      // The start node IS in the graph
      expect(result.graph.nodes.has('n-start')).toBe(true);
    });

    it('drops edges to/from deprecated free-text-input nodes', () => {
      const parser = new CanvasParser();
      const fixtureJson = JSON.stringify({
        nodes: [
          { id: 'n-start', type: 'text', text: '', x: 0, y: 0, width: 200, height: 60, radiprotocol_nodeType: 'start' },
          { id: 'n-ft1', type: 'text', text: '', x: 0, y: 120, width: 200, height: 60, radiprotocol_nodeType: 'free-text-input', radiprotocol_promptLabel: 'Enter text' },
        ],
        edges: [{ id: 'e1', fromNode: 'n-start', toNode: 'n-ft1' }],
      });
      const result = parser.parse(fixtureJson, 'deprecated-free-text.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      // Edge to n-ft1 must NOT appear in the graph (free-text-input was not added to nodes map)
      expect(result.graph.edges.length).toBe(0);
    });

    it('does not add a parse error for a free-text-input node — silent skip only', () => {
      const parser = new CanvasParser();
      const fixtureJson = JSON.stringify({
        nodes: [
          { id: 'n-start', type: 'text', text: '', x: 0, y: 0, width: 200, height: 60, radiprotocol_nodeType: 'start' },
          { id: 'n-ft1', type: 'text', text: '', x: 0, y: 120, width: 200, height: 60, radiprotocol_nodeType: 'free-text-input', radiprotocol_promptLabel: 'Enter text' },
        ],
        edges: [],
      });
      const result = parser.parse(fixtureJson, 'test.canvas');
      // Result must be success (not error) — NTYPE-02: no validator errors
      expect(result.success).toBe(true);
    });
  });
});
