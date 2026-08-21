import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GraphValidator } from '../graph/graph-validator';
import { CanvasParser } from './helpers/canvas-parser';

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.ts'), 'utf8');

function methodSource(name: string, nextName: string): string {
  const start = mainSource.indexOf(name);
  const end = mainSource.indexOf(nextName, start + name.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return mainSource.slice(start, end);
}

describe('Runner commands (RUN-10, UI-04)', () => {
  it('RUN-10: node-picker-modal exports NodePickerModal', async () => {
    await expect(import('../views/node-picker-modal')).resolves.toHaveProperty('NodePickerModal');
  });

  it('UI-04: GraphValidator.validate() returns non-empty errors for a dead-end canvas', () => {
    const fixturesDir = path.join(__dirname, 'fixtures');
    const json = fs.readFileSync(path.join(fixturesDir, 'dead-end.canvas'), 'utf8');
    const result = new CanvasParser().parse(json, 'dead-end.canvas');
    if (!result.success) {
      expect(result.error).toBeTruthy();
      return;
    }
    const errors = new GraphValidator().validate(result.graph);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('LOOP-06: buildNodeOptions returns a question option for a looped question', async () => {
    const { buildNodeOptions } = await import('../views/node-picker-modal');
    const loopedQuestion = {
      id: 'loop-1',
      kind: 'question' as const,
      questionText: 'Lesion loop',
      loop: true,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
    const graph = {
      canvasFilePath: 'test.canvas',
      nodes: new Map([[loopedQuestion.id, loopedQuestion]]),
      edges: [],
      adjacency: new Map<string, string[]>(),
      reverseAdjacency: new Map<string, string[]>(),
      startNodeId: loopedQuestion.id,
    };

    const options = buildNodeOptions(
      graph as unknown as import('../graph/graph-model').ProtocolGraph,
    );
    const question = options.find(option => option.kind === 'question');
    expect(question).toMatchObject({ id: 'loop-1', label: 'Lesion loop' });
    expect(options.map(option => option.kind)).not.toContain('loop');
  });

  it('preserves unprefixed runner command IDs', () => {
    expect(mainSource).toContain(`id: 'start-from-node'`);
    expect(mainSource).toContain(`id: 'run-protocol-inline'`);
    expect(mainSource).toContain(`name: 'Run protocol'`);
    expect(mainSource).not.toContain(`name: 'Run protocol in inline'`);
    expect(mainSource).not.toContain(`id: 'radiprotocol-start-from-node'`);
    expect(mainSource).not.toContain(`id: 'radiprotocol-run-protocol-inline'`);
  });

  it('routes the normal Run callback through openRunnerSession', () => {
    const source = methodSource(
      'private async handleRunProtocolInline()',
      'async openRunnerSession(',
    );
    expect(source).toContain('void this.openRunnerSession({');
    expect(source).toContain('protocolPath: item.file.path');
    expect(source).toContain('targetNote: activeFile');
    expect(source).not.toContain('new InlineRunnerModal');
  });

  it('routes Start from node through the same selector with the selected node ID', () => {
    const source = methodSource(
      'private async openProtocolStartNodePicker(',
      'private async handleInsertSnippet()',
    );
    expect(source).toContain('void this.openRunnerSession({');
    expect(source).toContain('protocolPath: protocolFile.path');
    expect(source).toContain('targetNote: activeFile');
    expect(source).toContain('startNodeId: opt.id');
    expect(source).not.toContain('new InlineRunnerModal');
  });

  it('constructs InlineRunnerModal only inside the unified presentation selector', () => {
    expect(mainSource.match(/new InlineRunnerModal\(/g)).toHaveLength(1);
    const selector = mainSource.slice(mainSource.indexOf('async openRunnerSession('));
    expect(selector).toContain('new InlineRunnerModal(');
  });
});
