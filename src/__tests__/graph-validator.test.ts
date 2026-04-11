import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../graph/canvas-parser';
import { GraphValidator } from '../graph/graph-validator';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
}

function parseFixture(name: string) {
  const parser = new CanvasParser();
  const result = parser.parse(loadFixture(name), name);
  if (!result.success) throw new Error(`Fixture ${name} failed to parse: ${result.error}`);
  return result.graph;
}

describe('GraphValidator', () => {
  describe('valid protocols', () => {
    it('returns no errors for linear.canvas', () => {
      const graph = parseFixture('linear.canvas');
      const validator = new GraphValidator();
      const errors = validator.validate(graph);
      expect(errors).toHaveLength(0);
    });

    it('returns no errors for branching.canvas', () => {
      const graph = parseFixture('branching.canvas');
      const validator = new GraphValidator();
      const errors = validator.validate(graph);
      expect(errors).toHaveLength(0);
    });
  });

  describe('error detection (PARSE-07, PARSE-08)', () => {
    it('detects dead-end question with no outgoing edges', () => {
      const graph = parseFixture('dead-end.canvas');
      const validator = new GraphValidator();
      const errors = validator.validate(graph);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.toLowerCase().includes('q1') || e.toLowerCase().includes('answer') || e.toLowerCase().includes('dead'))).toBe(true);
    });

    it('detects unintentional cycle not through loop-end node', () => {
      const graph = parseFixture('cycle.canvas');
      const validator = new GraphValidator();
      const errors = validator.validate(graph);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.toLowerCase().includes('cycle'))).toBe(true);
    });

    it('detects missing start node', () => {
      const noStartJson = JSON.stringify({
        nodes: [
          { id: 'n-q1', type: 'text', text: 'Q1', x: 0, y: 0, width: 100, height: 60,
            radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' }
        ],
        edges: []
      });
      const parser = new CanvasParser();
      const result = parser.parse(noStartJson, 'no-start.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const validator = new GraphValidator();
      const errors = validator.validate(result.graph);
      expect(errors.some(e => e.toLowerCase().includes('start'))).toBe(true);
    });

    it('detects multiple start nodes', () => {
      const multiStartJson = JSON.stringify({
        nodes: [
          { id: 'n-s1', type: 'text', text: 'S1', x: 0, y: 0, width: 100, height: 60,
            radiprotocol_nodeType: 'start' },
          { id: 'n-s2', type: 'text', text: 'S2', x: 200, y: 0, width: 100, height: 60,
            radiprotocol_nodeType: 'start' }
        ],
        edges: []
      });
      const parser = new CanvasParser();
      const result = parser.parse(multiStartJson, 'multi-start.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const validator = new GraphValidator();
      const errors = validator.validate(result.graph);
      expect(errors.some(e => e.toLowerCase().includes('multiple') || e.toLowerCase().includes('start'))).toBe(true);
    });

    it('detects unreachable nodes', () => {
      const unreachableJson = JSON.stringify({
        nodes: [
          { id: 'n-start', type: 'text', text: 'Start', x: 0, y: 0, width: 100, height: 60,
            radiprotocol_nodeType: 'start' },
          { id: 'n-q1', type: 'text', text: 'Q1', x: 0, y: 120, width: 100, height: 60,
            radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q1' },
          { id: 'n-orphan', type: 'text', text: 'Orphan', x: 500, y: 0, width: 100, height: 60,
            radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Orphan' }
        ],
        edges: [
          { id: 'e1', fromNode: 'n-start', toNode: 'n-q1' }
        ]
      });
      const parser = new CanvasParser();
      const result = parser.parse(unreachableJson, 'unreachable.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const validator = new GraphValidator();
      const errors = validator.validate(result.graph);
      expect(errors.some(e => e.toLowerCase().includes('unreachable') || e.toLowerCase().includes('reach'))).toBe(true);
    });

    it('detects orphaned loop-end node', () => {
      const orphanLoopEndJson = JSON.stringify({
        nodes: [
          { id: 'n-start', type: 'text', text: 'Start', x: 0, y: 0, width: 100, height: 60,
            radiprotocol_nodeType: 'start' },
          { id: 'n-le', type: 'text', text: 'LoopEnd', x: 0, y: 120, width: 100, height: 60,
            radiprotocol_nodeType: 'loop-end', radiprotocol_loopStartId: 'nonexistent-id' }
        ],
        edges: [
          { id: 'e1', fromNode: 'n-start', toNode: 'n-le' }
        ]
      });
      const parser = new CanvasParser();
      const result = parser.parse(orphanLoopEndJson, 'orphan-loop-end.canvas');
      expect(result.success).toBe(true);
      if (!result.success) return;
      const validator = new GraphValidator();
      const errors = validator.validate(result.graph);
      expect(errors.some(e => e.toLowerCase().includes('loop') || e.toLowerCase().includes('orphan'))).toBe(true);
    });

    it('returns all errors as plain English strings, not code exceptions (PARSE-08)', () => {
      const graph = parseFixture('dead-end.canvas');
      const validator = new GraphValidator();
      let errors: string[] = [];
      expect(() => { errors = validator.validate(graph); }).not.toThrow();
      for (const e of errors) {
        expect(typeof e).toBe('string');
        expect(e.length).toBeGreaterThan(0);
      }
    });
  });

  describe('snippet node — dead-end is valid (D-04)', () => {
    it('does not error when snippet node has no outgoing edges', () => {
      // Build minimal graph: start → answer → snippet (terminal)
      const graph = {
        canvasFilePath: 'test.canvas',
        startNodeId: 'n-start',
        nodes: new Map([
          ['n-start', { id: 'n-start', kind: 'start' as const, x: 0, y: 0, width: 200, height: 60 }],
          ['n-a1', { id: 'n-a1', kind: 'answer' as const, answerText: 'Yes', x: 0, y: 120, width: 200, height: 60 }],
          ['n-snip', { id: 'n-snip', kind: 'snippet' as const, x: 0, y: 240, width: 200, height: 60 }],
        ]),
        edges: [
          { id: 'e1', fromNodeId: 'n-start', toNodeId: 'n-a1' },
          { id: 'e2', fromNodeId: 'n-a1', toNodeId: 'n-snip' },
        ],
        adjacency: new Map([
          ['n-start', ['n-a1']],
          ['n-a1', ['n-snip']],
        ]),
        reverseAdjacency: new Map([
          ['n-a1', ['n-start']],
          ['n-snip', ['n-a1']],
        ]),
      };
      const validator = new GraphValidator();
      const errors = validator.validate(graph);
      expect(errors).toHaveLength(0);
    });
  });

  describe('loop validation (LOOP-01, LOOP-06)', () => {
    it('valid loop-body graph passes validation with zero errors (LOOP-01)', () => {
      const graph = parseFixture('loop-body.canvas');
      const validator = new GraphValidator();
      const errors = validator.validate(graph);
      expect(errors).toHaveLength(0);
    });
  });
});
