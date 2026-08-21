import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPickerMockInstances,
  makeBaseApp,
  makeBasePlugin,
  makeEl,
  resetPickerMockInstances,
} from '../runner/runner-renderer-host-fixtures';

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
import type { ProtocolGraph, RPEdge, RPNode } from '../../graph/graph-model';
import { RunnerSessionHost } from '../../views/runner-session-host';

const box = { x: 0, y: 0, width: 100, height: 60 };

function makeGraph(fileBound: boolean): ProtocolGraph {
  const nodes = new Map<string, RPNode>([
    ['start', { ...box, id: 'start', kind: 'start' }],
    ['loop', { ...box, id: 'loop', kind: 'question', questionText: 'Repeat?', loop: true }],
    ['snippet', {
      ...box,
      id: 'snippet',
      kind: 'snippet',
      ...(fileBound
        ? { radiprotocol_snippetPath: 'abdomen/ct.md', snippetLabel: 'Abd CT' }
        : { subfolderPath: 'Findings/Chest' }),
    }],
    ['end', { ...box, id: 'end', kind: 'text-block', content: 'Done' }],
  ]);
  const edges: RPEdge[] = [
    { id: 'start-loop', fromNodeId: 'start', toNodeId: 'loop' },
    { id: 'loop-snippet', fromNodeId: 'loop', toNodeId: 'snippet' },
    { id: 'snippet-loop', fromNodeId: 'snippet', toNodeId: 'loop' },
    { id: 'loop-end', fromNodeId: 'loop', toNodeId: 'end', label: 'Finish', isLoopExit: true },
  ];
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.fromNodeId, [...(adjacency.get(edge.fromNodeId) ?? []), edge.toNodeId]);
    reverseAdjacency.set(edge.toNodeId, [...(reverseAdjacency.get(edge.toNodeId) ?? []), edge.fromNodeId]);
  }
  return {
    canvasFilePath: 'Protocols/test.rp.json',
    nodes,
    edges,
    adjacency,
    reverseAdjacency,
    startNodeId: 'start',
  };
}

async function mount(fileBound: boolean) {
  const plugin = makeBasePlugin();
  const app = makeBaseApp(plugin);
  const protocol = new (TFile as any)('Protocols/test.rp.json');
  const target = new (TFile as any)('notes/target.md');
  app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
    if (path === protocol.path) return protocol;
    if (path === 'Snippets/abdomen/ct.md' || path === 'Snippets/report.md') {
      return new (TFile as any)(path);
    }
    return null;
  });
  app.vault.read.mockImplementation(async (file: { path: string }) =>
    file.path === protocol.path ? '{}' : '');
  plugin.protocolDocumentParser.parse.mockReturnValue({ success: true, graph: makeGraph(fileBound) });
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
  return { host, root, plugin };
}

beforeEach(() => resetPickerMockInstances());

describe('floating parity through RunnerSessionHost loop branches', () => {
  it('routes a file-bound loop body to snippet resolution, never the tree picker', async () => {
    const h = await mount(true);
    h.plugin.snippetService.resolveSnippet.mockResolvedValue({ status: 'missing' });
    const body = h.root.querySelector('.rp-loop-body-btn')!;
    expect(body._text).toBe('📄 Abd CT');

    body.dispatchEvent({ type: 'click' });
    await Promise.resolve();
    await Promise.resolve();

    expect(h.plugin.snippetService.resolveSnippet).toHaveBeenCalledWith('abdomen/ct.md');
    expect(getPickerMockInstances()).toHaveLength(0);
  });

  it('keeps a directory-bound loop body on the neutral tree picker path', async () => {
    const h = await mount(false);
    const body = h.root.querySelector('.rp-loop-body-btn')!;
    expect(body._text).toBe('snippet (Findings/Chest)');

    body.dispatchEvent({ type: 'click' });
    await Promise.resolve();

    expect(getPickerMockInstances()).toHaveLength(1);
    expect(h.root.querySelector('.rp-stp-runner-session-host')).not.toBeNull();
    expect(h.plugin.snippetService.resolveSnippet).not.toHaveBeenCalled();
  });
});
