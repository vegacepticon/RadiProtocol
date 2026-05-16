// src/__tests__/views/inline-runner-modal-output-toolbar.test.ts
// Phase 69 INLINE-CLEAN-01 (D-01, D-08) — Inline Runner regression for output-toolbar
// absence across all 6 inline states (idle / at-node / awaiting-snippet-pick /
// awaiting-loop-pick / awaiting-snippet-fill / complete). Asserts that
// .rp-copy-btn, .rp-save-btn, .rp-insert-btn, and the .rp-output-toolbar container
// are absent from .rp-inline-runner-content's DOM in every state.
//
// Phase 75 plan 06 — MockEl harness, obsidian mock, and SnippetFillInModal /
// SnippetTreePicker mocks moved to runner-renderer-host-fixtures.ts so all 3
// inline-runner-modal host tests share the same fixtures.
import { describe, it, expect, vi } from 'vitest';
import {
  type MockEl,
  makeEl,
} from '../runner/runner-renderer-host-fixtures';

const { snippetTreePickerMountSpy } = vi.hoisted(() => ({ snippetTreePickerMountSpy: vi.fn() }));

vi.mock('obsidian', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createObsidianModuleMock();
});

vi.mock('../../views/snippet-tree-picker', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetTreePickerMock(snippetTreePickerMountSpy);
});

vi.mock('../../views/snippet-fill-in-modal', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetFillInModalMock();
});

import { InlineRunnerModal } from '../../views/inline-runner-modal';
import { TFile } from 'obsidian';
import { makeBaseApp, makeBasePlugin } from '../runner/runner-renderer-host-fixtures';

function makeTargetNote(): TFile {
  return new (TFile as any)('notes/target.md');
}

interface FakeQuestionNode { id: string; kind: 'question'; questionText: string }
interface FakeLoopNode { id: string; kind: 'loop'; headerText: string }

function makeFakeGraph(includeQuestion: boolean, includeLoop: boolean): {
  nodes: Map<string, FakeQuestionNode | FakeLoopNode>;
  adjacency: Map<string, string[]>;
  edges: Array<{ fromNodeId: string; toNodeId: string; label: string }>;
} {
  const nodes = new Map<string, FakeQuestionNode | FakeLoopNode>();
  if (includeQuestion) nodes.set('Q1', { id: 'Q1', kind: 'question', questionText: 'sample?' });
  if (includeLoop) nodes.set('L1', { id: 'L1', kind: 'loop', headerText: '' });
  return { nodes, adjacency: new Map(), edges: [] };
}

function setupModalAndRender(
  status: string,
  extras: Record<string, unknown> = {},
  opts: { graph?: ReturnType<typeof makeFakeGraph> } = {},
): MockEl {
  const targetNote = makeTargetNote();
  const plugin = makeBasePlugin();
  const app = makeBaseApp(plugin);
  const modal = new InlineRunnerModal(app as any, plugin as any, 'test.canvas', targetNote);
  (modal as any).contentEl = makeEl('div');
  (modal as any).actionsEl = makeEl('div');
  (modal as any).footerBtnRowEl = makeEl('div');
  if (opts.graph !== undefined) (modal as any).graph = opts.graph;
  vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
    status,
    canStepBack: false,
    accumulatedText: 'sample',
    finalText: 'sample',
    ...extras,
  } as any));
  (modal as any).render();
  return (modal as any).contentEl as MockEl;
}

const TOOLBAR_SELECTORS = ['.rp-copy-btn', '.rp-save-btn', '.rp-insert-btn', '.rp-output-toolbar'];

function expectToolbarAbsent(root: MockEl): void {
  for (const sel of TOOLBAR_SELECTORS) {
    expect(root.querySelectorAll(sel)).toHaveLength(0);
  }
}

describe('Phase 69 INLINE-CLEAN-01 — Inline output toolbar absent in all 6 states', () => {
  const cases: Array<{
    label: string;
    status: string;
    extras?: Record<string, unknown>;
    graph?: ReturnType<typeof makeFakeGraph>;
  }> = [
    { label: 'status=idle', status: 'idle' },
    { label: 'status=at-node', status: 'at-node', extras: { currentNodeId: 'Q1' }, graph: makeFakeGraph(true, false) },
    { label: 'status=awaiting-snippet-pick', status: 'awaiting-snippet-pick', extras: { nodeId: 'Q1', subfolderPath: undefined } },
    { label: 'status=awaiting-loop-pick', status: 'awaiting-loop-pick', extras: { nodeId: 'L1' }, graph: makeFakeGraph(false, true) },
    { label: 'status=awaiting-snippet-fill', status: 'awaiting-snippet-fill', extras: { snippetId: 'S1' } },
    { label: 'status=complete', status: 'complete' },
  ];

  for (const c of cases) {
    it(`${c.label}: rp-copy-btn / rp-save-btn / rp-insert-btn / rp-output-toolbar all absent`, () => {
      const root = setupModalAndRender(c.status, c.extras ?? {}, c.graph !== undefined ? { graph: c.graph } : {});
      expectToolbarAbsent(root);
    });
  }
});
