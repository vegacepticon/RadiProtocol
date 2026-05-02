import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../../graph/canvas-parser';
import { ProtocolRunner } from '../../runner/protocol-runner';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

function loadGraph(name: string) {
  const json = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
  const parser = new CanvasParser();
  const result = parser.parse(json, name);
  if (!result.success) throw new Error(`Fixture ${name} failed to parse: ${result.error}`);
  return result.graph;
}

describe('BUG: start -> text-block (raw.text fallback) -> question', () => {
  it('text-block without radiprotocol_content uses raw.text and is not skipped', () => {
    const graph = loadGraph('start-text-block.canvas');
    const runner = new ProtocolRunner();
    runner.start(graph);
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('n-q1');
    expect(state.accumulatedText).toBe('Hello from text-block');
  });
});
