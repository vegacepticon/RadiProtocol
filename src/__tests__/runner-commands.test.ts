import { describe, it, expect } from 'vitest';
import { GraphValidator } from '../graph/graph-validator';
import { CanvasParser } from '../graph/canvas-parser';
import * as fs from 'fs';
import * as path from 'path';

describe('Runner commands (RUN-10, UI-04)', () => {
  it('RUN-10: node-picker-modal exports NodePickerModal (RED until Plan 03)', async () => {
    // Dynamic import so the test file itself does not fail to parse.
    // This MUST fail until Plan 03 creates src/views/node-picker-modal.ts.
    await expect(import('../views/node-picker-modal')).resolves.toHaveProperty('NodePickerModal');
  });

  it('UI-04: GraphValidator.validate() returns non-empty errors for a dead-end canvas', () => {
    const fixturesDir = path.join(__dirname, 'fixtures');
    const json = fs.readFileSync(path.join(fixturesDir, 'dead-end.canvas'), 'utf-8');
    const parser = new CanvasParser();
    const result = parser.parse(json, 'dead-end.canvas');
    if (!result.success) {
      // Parse failure is also a valid error — it means invalid canvas
      expect(result.error).toBeTruthy();
      return;
    }
    const validator = new GraphValidator();
    const errors = validator.validate(result.graph);
    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('LOOP-06 (D-20): buildNodeOptions returns a loop option for a mixed-kind graph', async () => {
    // Phase 45 strengthens the Phase 4/RUN-10 smoke test: import buildNodeOptions
    // and verify the 4-kind union actually includes 'loop' on a real mixed graph.
    const { buildNodeOptions } = await import('../views/node-picker-modal');

    const loopNode = {
      id: 'loop-1',
      kind: 'loop' as const,
      headerText: 'Lesion loop',
      x: 0, y: 0, width: 0, height: 0,
    };
    const graph = {
      canvasFilePath: 'test.canvas',
      nodes: new Map<string, typeof loopNode>([[loopNode.id, loopNode]]),
      edges: [],
      adjacency: new Map<string, string[]>(),
      reverseAdjacency: new Map<string, string[]>(),
      startNodeId: loopNode.id,
    };
    const opts = buildNodeOptions(graph as unknown as import('../graph/graph-model').ProtocolGraph);
    const loopOpt = opts.find((o: { kind: string }) => o.kind === 'loop');
    expect(loopOpt).toBeDefined();
    expect(loopOpt?.id).toBe('loop-1');
    expect(loopOpt?.label).toBe('Lesion loop');
  });

  it('NFR-06 (Pitfall 10): start-from-node command id has no plugin prefix', () => {
    // Phase 45 Plan 03 Task 2 registers this command in main.ts. The id must NOT
    // carry a plugin-name prefix — Obsidian already namespaces commands by
    // plugin manifest id (radiprotocol:start-from-node). A double prefix would
    // collide in the Ctrl+P command palette (see NFR-06, RESEARCH.md Pitfall 10).
    const mainTsPath = path.join(__dirname, '..', 'main.ts');
    const mainTs = fs.readFileSync(mainTsPath, 'utf-8');
    expect(mainTs).toContain(`id: 'start-from-node'`);
    expect(mainTs).not.toContain(`id: 'radiprotocol-start-from-node'`);
  });

});