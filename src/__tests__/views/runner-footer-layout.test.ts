import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian');

vi.mock('../../views/snippet-tree-picker', () => {
  class SnippetTreePicker {
    constructor(_options: unknown) {}
    async mount(): Promise<void> {}
    unmount(): void {}
  }
  return { SnippetTreePicker };
});

import { RunnerView } from '../../views/runner-view';
import type RadiProtocolPlugin from '../../main';
import type { AnswerNode, ProtocolGraph, SnippetNode } from '../../graph/graph-model';

interface FakeNode {
  tag: string;
  cls?: string;
  text?: string;
  title?: string;
  children: FakeNode[];
  parent: FakeNode | null;
  createDiv: (opts?: { cls?: string; text?: string }) => FakeNode;
  createEl: (tag: string, opts?: { cls?: string; text?: string; type?: string }) => FakeNode;
  createSpan: (opts?: { cls?: string; text?: string }) => FakeNode;
  empty: () => void;
  setText: (t: string) => void;
  setAttribute: (name: string, value: string) => void;
  prepend: (el: FakeNode) => void;
  addClass: (cls: string) => void;
  removeClass: (cls: string) => void;
  toggleClass: (cls: string, on?: boolean) => void;
  hasClass: (cls: string) => boolean;
  _clickHandler?: () => void;
  _attrs?: Record<string, string>;
  disabled: boolean;
  value: string;
  style: Record<string, string>;
  scrollTop: number;
  scrollHeight: number;
}

function makeFakeNode(tag = 'div', cls?: string, text?: string): FakeNode {
  const classNames = new Set<string>();
  if (cls !== undefined) {
    for (const c of cls.split(/\s+/).filter(Boolean)) classNames.add(c);
  }
  const node: FakeNode = {
    tag,
    cls,
    text,
    children: [],
    parent: null,
    createDiv(opts?: { cls?: string; text?: string }): FakeNode {
      return node.createEl('div', opts);
    },
    createEl(t: string, opts?: { cls?: string; text?: string; type?: string }): FakeNode {
      const child = makeFakeNode(t, opts?.cls, opts?.text);
      child.parent = node;
      node.children.push(child);
      if (opts?.type !== undefined) {
        (child as unknown as { type: string }).type = opts.type;
      }
      return child;
    },
    createSpan(opts?: { cls?: string; text?: string }): FakeNode {
      return node.createEl('span', opts);
    },
    empty(): void {
      node.children.length = 0;
    },
    setText(t: string): void {
      node.text = t;
    },
    setAttribute(name: string, value: string): void {
      if (node._attrs === undefined) node._attrs = {};
      node._attrs[name] = value;
    },
    prepend(el: FakeNode): void {
      node.children.unshift(el);
      el.parent = node;
    },
    addClass(c: string): void {
      classNames.add(c);
      node.cls = Array.from(classNames).join(' ');
    },
    removeClass(c: string): void {
      classNames.delete(c);
      node.cls = Array.from(classNames).join(' ');
    },
    toggleClass(c: string, on?: boolean): void {
      const shouldHave = on ?? !classNames.has(c);
      if (shouldHave) node.addClass(c);
      else node.removeClass(c);
    },
    hasClass(c: string): boolean {
      return classNames.has(c);
    },
    disabled: false,
    value: '',
    style: {},
    scrollTop: 0,
    scrollHeight: 0,
  };
  return node;
}

function hasClass(node: FakeNode | undefined, cls: string): boolean {
  return node?.cls?.split(/\s+/).includes(cls) ?? false;
}

function findByClass(root: FakeNode | undefined, cls: string): FakeNode[] {
  if (root === undefined) return [];
  const out: FakeNode[] = [];
  const visit = (n: FakeNode): void => {
    if (hasClass(n, cls)) out.push(n);
    for (const child of n.children) visit(child);
  };
  visit(root);
  return out;
}

function textOf(node: FakeNode | undefined): string {
  if (node === undefined) return '';
  return [node.text ?? '', ...node.children.map(textOf)].join('');
}

function buildMixedGraph(): ProtocolGraph {
  const answerNode: AnswerNode = {
    kind: 'answer',
    id: 'a1',
    answerText: 'Answer branch',
    x: 0,
    y: 0,
    width: 100,
    height: 40,
  };
  const snippetNode: SnippetNode = {
    kind: 'snippet',
    id: 's1',
    subfolderPath: 'abdomen',
    snippetLabel: 'Snippet branch',
    x: 0,
    y: 0,
    width: 100,
    height: 40,
  } as SnippetNode;

  return {
    canvasFilePath: 'test.canvas',
    nodes: new Map([
      ['q1', { kind: 'question', id: 'q1', questionText: 'Pick one?', x: 0, y: 0, width: 200, height: 80 }],
      ['a1', answerNode],
      ['s1', snippetNode],
    ]) as ProtocolGraph['nodes'],
    edges: [
      { id: 'e-q1-a1', fromNodeId: 'q1', toNodeId: 'a1' },
      { id: 'e-q1-s1', fromNodeId: 'q1', toNodeId: 's1' },
    ],
    adjacency: new Map([['q1', ['a1', 's1']]]),
    reverseAdjacency: new Map(),
    startNodeId: 'q1',
  };
}

function makePlugin(): RadiProtocolPlugin {
  return {
    settings: { snippetFolderPath: '.radiprotocol/snippets', textSeparator: 'newline' },
    snippetService: {
      load: vi.fn(),
      listFolder: vi.fn(async () => ({ folders: [], snippets: [] })),
      listFolderDescendants: vi.fn(async () => ({ files: [], folders: [] })),
    },
    app: { vault: { getAbstractFileByPath: () => null } },
    sessionService: { save: vi.fn(), load: vi.fn(), clear: vi.fn() },
    canvasLiveEditor: { getCanvasJSON: () => null },
    canvasParser: { parse: vi.fn() },
    saveOutputToNote: vi.fn(),
    insertIntoCurrentNote: vi.fn(),
  } as unknown as RadiProtocolPlugin;
}

interface RunnerHarness {
  contentEl: FakeNode;
  capturePendingTextareaScrollSpy: ReturnType<typeof vi.fn>;
  syncManualEditSpy: ReturnType<typeof vi.fn>;
  skipSpy: ReturnType<typeof vi.fn>;
  stepBackSpy: ReturnType<typeof vi.fn>;
  autoSaveSessionSpy: ReturnType<typeof vi.fn>;
  renderAsyncSpy: ReturnType<typeof vi.fn>;
}

function mountRunnerViewAtMixedQuestion(): RunnerHarness {
  const view = new RunnerView({} as import('obsidian').WorkspaceLeaf, makePlugin());
  const contentEl = makeFakeNode();
  const capturePendingTextareaScrollSpy = vi.fn();
  const syncManualEditSpy = vi.fn();
  const skipSpy = vi.fn();
  const stepBackSpy = vi.fn();
  const autoSaveSessionSpy = vi.fn(async () => {});
  const renderAsyncSpy = vi.fn(async () => {});

  (view as unknown as { contentEl: FakeNode }).contentEl = contentEl;
  (view as unknown as { graph: ProtocolGraph }).graph = buildMixedGraph();
  (view as unknown as { runner: unknown }).runner = {
    getState: () => ({
      status: 'at-node',
      currentNodeId: 'q1',
      accumulatedText: 'Initial text',
      canStepBack: true,
    }),
    chooseAnswer: vi.fn(),
    chooseSnippetBranch: vi.fn(),
    pickFileBoundSnippet: vi.fn(),
    syncManualEdit: syncManualEditSpy,
    skip: skipSpy,
    stepBack: stepBackSpy,
  };
  (view as unknown as { registerDomEvent: unknown }).registerDomEvent = (
    el: FakeNode,
    type: string,
    handler: () => void,
  ) => {
    if (type === 'click') el._clickHandler = handler;
  };
  (view as unknown as { capturePendingTextareaScroll: () => void }).capturePendingTextareaScroll = capturePendingTextareaScrollSpy;
  (view as unknown as { autoSaveSession: () => Promise<void> }).autoSaveSession = autoSaveSessionSpy;
  (view as unknown as { renderAsync: () => Promise<void> }).renderAsync = renderAsyncSpy;
  (view as unknown as { renderPreviewZone: () => void }).renderPreviewZone = () => {};
  (view as unknown as { renderOutputToolbar: () => void }).renderOutputToolbar = () => {};

  (view as unknown as { render: () => void }).render();

  return {
    contentEl,
    capturePendingTextareaScrollSpy,
    syncManualEditSpy,
    skipSpy,
    stepBackSpy,
    autoSaveSessionSpy,
    renderAsyncSpy,
  };
}

describe('Phase 65 Plan 01 — RUNNER-02 RunnerView footer layout RED tests', () => {
  it('RUNNER-02 places one footer row after answer and snippet branches on mixed questions', () => {
    const { contentEl } = mountRunnerViewAtMixedQuestion();

    const questionZone = findByClass(contentEl, 'rp-question-zone')[0]!;
    const answerListIndex = questionZone.children.findIndex(child => hasClass(child, 'rp-answer-list'));
    const snippetListIndex = questionZone.children.findIndex(child => hasClass(child, 'rp-snippet-branch-list'));
    const footerRowIndex = questionZone.children.findIndex(child => hasClass(child, 'rp-runner-footer-row'));

    expect(findByClass(questionZone, 'rp-runner-footer-row')).toHaveLength(1);
    expect(answerListIndex).toBeGreaterThan(-1);
    expect(snippetListIndex).toBeGreaterThan(answerListIndex);
    expect(footerRowIndex).toBeGreaterThan(snippetListIndex);
  });

  it('RUNNER-02 renders visible Back then Skip labels inside the RunnerView footer row', () => {
    const { contentEl } = mountRunnerViewAtMixedQuestion();

    const footerRow = findByClass(contentEl, 'rp-runner-footer-row')[0]!;
    expect(footerRow).toBeDefined();
    const stepBackBtn = findByClass(footerRow, 'rp-step-back-btn')[0];
    const skipBtn = findByClass(footerRow, 'rp-skip-btn')[0];

    expect(textOf(stepBackBtn)).toBe('Back');
    expect(textOf(skipBtn)).toBe('Skip');
    expect(footerRow.children.indexOf(stepBackBtn!)).toBeLessThan(footerRow.children.indexOf(skipBtn!));
  });

  it('RUNNER-02 never inserts RunnerView Skip between answer and snippet branch lists', () => {
    const { contentEl } = mountRunnerViewAtMixedQuestion();
    const questionZone = findByClass(contentEl, 'rp-question-zone')[0]!;
    const answerListIndex = questionZone.children.findIndex(child => hasClass(child, 'rp-answer-list'));
    const snippetListIndex = questionZone.children.findIndex(child => hasClass(child, 'rp-snippet-branch-list'));

    const betweenBranchGroups = questionZone.children.slice(answerListIndex + 1, snippetListIndex);
    expect(betweenBranchGroups.some(child => findByClass(child, 'rp-skip-btn').length > 0 || hasClass(child, 'rp-skip-btn'))).toBe(false);

    const footerRow = findByClass(questionZone, 'rp-runner-footer-row')[0]!;
    expect(footerRow).toBeDefined();
    expect(findByClass(footerRow, 'rp-skip-btn')).toHaveLength(1);
  });

  it('RUNNER-02 footer Skip and Back preserve the RunnerView click prologue', async () => {
    const h = mountRunnerViewAtMixedQuestion();
    const callOrder: string[] = [];
    h.capturePendingTextareaScrollSpy.mockImplementation(() => callOrder.push('capturePendingTextareaScroll'));
    h.syncManualEditSpy.mockImplementation(() => callOrder.push('syncManualEdit'));
    h.skipSpy.mockImplementation(() => callOrder.push('skip'));
    h.stepBackSpy.mockImplementation(() => callOrder.push('stepBack'));
    h.autoSaveSessionSpy.mockImplementation(async () => { callOrder.push('autoSaveSession'); });
    h.renderAsyncSpy.mockImplementation(async () => { callOrder.push('renderAsync'); });

    const footerRow = findByClass(h.contentEl, 'rp-runner-footer-row')[0]!;
    expect(footerRow).toBeDefined();
    findByClass(footerRow, 'rp-skip-btn')[0]!._clickHandler?.();
    await Promise.resolve();

    expect(callOrder.slice(0, 5)).toEqual([
      'capturePendingTextareaScroll',
      'syncManualEdit',
      'skip',
      'autoSaveSession',
      'renderAsync',
    ]);

    callOrder.length = 0;
    findByClass(footerRow, 'rp-step-back-btn')[0]!._clickHandler?.();
    await Promise.resolve();

    expect(callOrder).toEqual(['stepBack', 'autoSaveSession']);
  });
});
