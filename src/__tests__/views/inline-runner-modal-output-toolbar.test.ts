import { describe, expect, it, vi } from 'vitest';
import { makeBaseApp, makeBasePlugin, makeEl, type MockEl } from '../runner/runner-renderer-host-fixtures';

vi.mock('obsidian', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createObsidianModuleMock();
});
vi.mock('../../views/snippet-tree-picker', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetTreePickerMock();
});
vi.mock('../../views/snippet-fill-in-modal', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetFillInModalMock();
});

import { TFile } from 'obsidian';
import type { ProtocolGraph, RPNode } from '../../graph/graph-model';
import type { RunnerState } from '../../runner/runner-state';
import { RunnerSessionHost } from '../../views/runner-session-host';

function makeGraph(): ProtocolGraph {
  const nodes = new Map<string, RPNode>([
    ['start', { id: 'start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
    ['question', {
      id: 'question', kind: 'question', questionText: 'Choose',
      x: 0, y: 60, width: 100, height: 60,
    }],
    ['answer', {
      id: 'answer', kind: 'answer', answerText: 'Finding',
      x: 0, y: 120, width: 100, height: 60,
    }],
    ['loop', {
      id: 'loop', kind: 'question', questionText: 'Repeat?', loop: true,
      x: 0, y: 180, width: 100, height: 60,
    }],
    ['body', {
      id: 'body', kind: 'answer', answerText: 'Again',
      x: 0, y: 240, width: 100, height: 60,
    }],
    ['end', {
      id: 'end', kind: 'text-block', content: 'Done',
      x: 120, y: 240, width: 100, height: 60,
    }],
  ]);
  const edges = [
    { id: 'start-question', fromNodeId: 'start', toNodeId: 'question' },
    { id: 'question-answer', fromNodeId: 'question', toNodeId: 'answer' },
    { id: 'answer-loop', fromNodeId: 'answer', toNodeId: 'loop' },
    { id: 'loop-body', fromNodeId: 'loop', toNodeId: 'body' },
    { id: 'body-loop', fromNodeId: 'body', toNodeId: 'loop' },
    { id: 'loop-exit', fromNodeId: 'loop', toNodeId: 'end', label: 'Exit', isLoopExit: true },
  ];
  return {
    canvasFilePath: 'Protocols/test.rp.json',
    nodes,
    edges,
    adjacency: new Map([
      ['start', ['question']],
      ['question', ['answer']],
      ['answer', ['loop']],
      ['loop', ['body', 'end']],
      ['body', ['loop']],
    ]),
    reverseAdjacency: new Map([
      ['question', ['start']],
      ['answer', ['question']],
      ['loop', ['answer', 'body']],
      ['body', ['loop']],
      ['end', ['loop']],
    ]),
    startNodeId: 'start',
  };
}

async function mountedHost() {
  const plugin = makeBasePlugin();
  const app = makeBaseApp(plugin);
  const protocol = new (TFile as any)('Protocols/test.rp.json');
  const target = new (TFile as any)('notes/target.md');
  app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
    if (path === protocol.path) return protocol;
    if (path === 'Snippets/report.md') return new (TFile as any)(path);
    return null;
  });
  app.vault.read.mockImplementation(async (file: { path: string }) =>
    file.path === protocol.path
      ? JSON.stringify({ selfCheckEnabled: true, selfCheckItems: ['Review'] })
      : '');
  plugin.protocolDocumentParser.parse.mockReturnValue({ success: true, graph: makeGraph() });
  const host = new RunnerSessionHost({
    app: app as any,
    protocolPath: protocol.path,
    targetNote: target,
    protocolDocumentStore: plugin.protocolDocumentStore as any,
    protocolDocumentParser: plugin.protocolDocumentParser as any,
    snippetService: plugin.snippetService as any,
    getTextSeparator: () => 'newline',
    getSnippetFolderPath: () => 'Snippets',
    withTargetNoteLock: async (_path, operation) => operation(),
    t: plugin.i18n.t.bind(plugin.i18n),
    notify: vi.fn(),
    onRequestClose: vi.fn(),
  });
  const root = makeEl('div');
  expect(await host.mount(root as unknown as HTMLElement)).toBe(true);
  return { host, root };
}

const forbidden = ['.rp-copy-btn', '.rp-save-btn', '.rp-insert-btn', '.rp-output-toolbar'];

function expectToolbarAbsent(root: MockEl): void {
  for (const selector of forbidden) expect(root.querySelectorAll(selector)).toHaveLength(0);
}

describe('RunnerSessionHost common output projection', () => {
  it('keeps the legacy output toolbar absent in every runner state', async () => {
    const h = await mountedHost();
    const states: RunnerState[] = [
      { status: 'idle' },
      { status: 'at-node', currentNodeId: 'question', accumulatedText: '', canStepBack: false, canRedo: false, undoStackSize: 0 },
      { status: 'awaiting-snippet-pick', nodeId: 'question', subfolderPath: undefined, accumulatedText: '', canStepBack: false, canRedo: false, undoStackSize: 0 },
      { status: 'awaiting-loop-pick', nodeId: 'loop', accumulatedText: '', canStepBack: true, canRedo: false, undoStackSize: 1 },
      { status: 'awaiting-snippet-fill', nodeId: 'question', snippetId: 'missing', accumulatedText: '', canStepBack: true, canRedo: false, undoStackSize: 1 },
      { status: 'complete', finalText: 'Done' },
      { status: 'error', message: 'Broken' },
    ];
    vi.spyOn((h.host as any).options.snippetService, 'resolveSnippet').mockResolvedValue({ status: 'missing' });
    const stateSpy = vi.spyOn((h.host as any).runner, 'getState');
    for (const state of states) {
      stateSpy.mockReturnValue(state);
      (h.host as any).render();
      expectToolbarAbsent(h.root);
    }
  });

  it('projects neutral progress, footer controls, self-check, and error classes', async () => {
    const h = await mountedHost();
    expect(h.root.querySelector('.rp-runner-session-progress')).not.toBeNull();
    expect(h.root.querySelector('.rp-runner-session-footer')).not.toBeNull();
    expect(h.root.querySelector('.rp-runner-session-close-btn')).not.toBeNull();

    vi.spyOn((h.host as any).runner, 'getState').mockReturnValue({
      status: 'complete', finalText: 'Done',
    });
    (h.host as any).render();
    expect(h.root.querySelector('.rp-runner-session-self-check')).not.toBeNull();

    vi.spyOn((h.host as any).runner, 'getState').mockReturnValue({
      status: 'error', message: 'Broken',
    });
    (h.host as any).render();
    expect(h.root.querySelector('.rp-error-panel')).not.toBeNull();
    expectToolbarAbsent(h.root);
  });
});
