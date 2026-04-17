import { describe, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../../graph/canvas-parser';
import type { ProtocolGraph } from '../../graph/graph-model';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function loadGraph(name: string): ProtocolGraph {
  const json = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
  const parser = new CanvasParser();
  const result = parser.parse(json, name);
  if (!result.success) throw new Error(`Fixture ${name} failed to parse: ${result.error}`);
  return result.graph;
}

// Phase 44 (RUN-01..RUN-03) — picker state-machine coverage.
// Wave 0 skeleton — implementation lands in Plan 02.
describe('ProtocolRunner loop picker (RUN-01, RUN-02, RUN-03)', () => {
  it.todo('RUN-01: runner halts at awaiting-loop-pick with loop node id after start() on unified-loop-valid.canvas');
  it.todo('RUN-02: choosing a body branch walks it; dead-end auto-returns to same loop picker with iteration=2');
  it.todo('RUN-03: choosing «выход» pops the loop frame and advances along the exit edge');
});
