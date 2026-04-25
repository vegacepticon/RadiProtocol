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
import { InlineRunnerModal } from '../../views/inline-runner-modal';
import type RadiProtocolPlugin from '../../main';
import type { AnswerNode, ProtocolGraph, RPEdge, RPNode, SnippetNode } from '../../graph/graph-model';

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
  addEventListener: (type: string, handler: () => void) => void;
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
    addEventListener(type: string, handler: () => void): void {
      if (type === 'click') node._clickHandler = handler;
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
    nodes: new Map<string, RPNode>([
      ['q1', { kind: 'question', id: 'q1', questionText: 'Pick one?', x: 0, y: 0, width: 200, height: 80 }],
      ['a1', answerNode],
      ['s1', snippetNode],
    ]),
    edges: [
      { id: 'e-q1-a1', fromNodeId: 'q1', toNodeId: 'a1' },
      { id: 'e-q1-s1', fromNodeId: 'q1', toNodeId: 's1' },
    ],
    adjacency: new Map([['q1', ['a1', 's1']]]),
    reverseAdjacency: new Map(),
    startNodeId: 'q1',
  };
}

function buildLoopGraph(): ProtocolGraph {
  return {
    canvasFilePath: 'loop.canvas',
    nodes: new Map<string, RPNode>([
      ['loop1', { kind: 'loop', id: 'loop1', headerText: 'Loop header', x: 0, y: 0, width: 200, height: 80 }],
      ['a1', { kind: 'answer', id: 'a1', answerText: 'Body answer', x: 0, y: 0, width: 100, height: 40 }],
      ['done', { kind: 'text-block', id: 'done', content: 'Done', x: 0, y: 0, width: 100, height: 40 }],
    ]),
    edges: [
      { id: 'e-body', fromNodeId: 'loop1', toNodeId: 'a1' },
      { id: 'e-exit', fromNodeId: 'loop1', toNodeId: 'done', label: '+ exit' },
    ] as RPEdge[],
    adjacency: new Map([['loop1', ['a1', 'done']]]),
    reverseAdjacency: new Map(),
    startNodeId: 'loop1',
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
  syncManualEditSpy: ReturnType<typeof vi.fn>;
  skipSpy: ReturnType<typeof vi.fn>;
  stepBackSpy: ReturnType<typeof vi.fn>;
  autoSaveSessionSpy: ReturnType<typeof vi.fn>;
  renderAsyncSpy: ReturnType<typeof vi.fn>;
}

function mountRunnerViewAtMixedQuestion(): RunnerHarness {
  const view = new RunnerView({} as import('obsidian').WorkspaceLeaf, makePlugin());
  const contentEl = makeFakeNode();
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
  (view as unknown as { autoSaveSession: () => Promise<void> }).autoSaveSession = autoSaveSessionSpy;
  (view as unknown as { renderAsync: () => Promise<void> }).renderAsync = renderAsyncSpy;
  (view as unknown as { renderPreviewZone: () => void }).renderPreviewZone = () => {};
  (view as unknown as { renderOutputToolbar: () => void }).renderOutputToolbar = () => {};

  (view as unknown as { render: () => void }).render();

  return {
    contentEl,
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
    h.syncManualEditSpy.mockImplementation(() => callOrder.push('syncManualEdit'));
    h.skipSpy.mockImplementation(() => callOrder.push('skip'));
    h.stepBackSpy.mockImplementation(() => callOrder.push('stepBack'));
    h.autoSaveSessionSpy.mockImplementation(async () => { callOrder.push('autoSaveSession'); });
    h.renderAsyncSpy.mockImplementation(async () => { callOrder.push('renderAsync'); });

    const footerRow = findByClass(h.contentEl, 'rp-runner-footer-row')[0]!;
    expect(footerRow).toBeDefined();
    findByClass(footerRow, 'rp-skip-btn')[0]!._clickHandler?.();
    await Promise.resolve();

    expect(callOrder.slice(0, 4)).toEqual([
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

describe('Phase 66 D-01/D-02/D-03 — Back disable-on-click guard', () => {
  it('Phase 66 disables RunnerView Back synchronously before invoking the handler', () => {
    const h = mountRunnerViewAtMixedQuestion();
    const footerRow = findByClass(h.contentEl, 'rp-runner-footer-row')[0]!;
    const backBtn = findByClass(footerRow, 'rp-step-back-btn')[0]!;

    expect(backBtn.disabled).toBe(false);
    backBtn._clickHandler?.();
    expect(backBtn.disabled).toBe(true);
    expect(h.stepBackSpy).toHaveBeenCalledTimes(1);

    backBtn._clickHandler?.();
    expect(backBtn.disabled).toBe(true);
    expect(h.stepBackSpy.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('Phase 66 keeps the Back guard scoped away from RunnerView Skip', () => {
    const h = mountRunnerViewAtMixedQuestion();
    const footerRow = findByClass(h.contentEl, 'rp-runner-footer-row')[0]!;
    const backBtn = findByClass(footerRow, 'rp-step-back-btn')[0]!;
    const skipBtn = findByClass(footerRow, 'rp-skip-btn')[0]!;

    backBtn._clickHandler?.();
    expect(backBtn.disabled).toBe(true);
    expect(skipBtn.disabled).toBe(false);

    const fresh = mountRunnerViewAtMixedQuestion();
    const freshFooterRow = findByClass(fresh.contentEl, 'rp-runner-footer-row')[0]!;
    const freshBackBtn = findByClass(freshFooterRow, 'rp-step-back-btn')[0]!;
    const freshSkipBtn = findByClass(freshFooterRow, 'rp-skip-btn')[0]!;
    freshSkipBtn._clickHandler?.();
    expect(freshSkipBtn.disabled).toBe(false);
    expect(freshBackBtn.disabled).toBe(false);
  });
});

interface InlineHarness {
  contentEl: FakeNode;
  stepBackSpy: ReturnType<typeof vi.fn>;
  skipSpy: ReturnType<typeof vi.fn>;
}

function makeInlineApp(): import('obsidian').App {
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      read: vi.fn(),
      modify: vi.fn(),
      getFiles: vi.fn(() => []),
      on: vi.fn(),
      offref: vi.fn(),
    },
    workspace: {
      on: vi.fn(),
      offref: vi.fn(),
      getActiveFile: vi.fn(() => null),
      iterateAllLeaves: vi.fn(),
    },
  } as unknown as import('obsidian').App;
}

function mountInlineModalWithState(
  state: Record<string, unknown>,
  graph: ProtocolGraph,
): InlineHarness {
  const modal = new InlineRunnerModal(
    makeInlineApp(),
    {
      ...makePlugin(),
      settings: { snippetFolderPath: '.radiprotocol/snippets', textSeparator: 'newline' },
      getInlineRunnerPosition: vi.fn(() => null),
      saveInlineRunnerPosition: vi.fn(async () => {}),
      insertMutex: { runExclusive: vi.fn(async (_path: string, fn: () => Promise<void>) => fn()) },
    } as unknown as RadiProtocolPlugin,
    'test.canvas',
    { path: 'target.md' } as import('obsidian').TFile,
  );
  const contentEl = makeFakeNode();
  const stepBackSpy = vi.fn();
  const skipSpy = vi.fn();
  (modal as unknown as { contentEl: FakeNode }).contentEl = contentEl;
  (modal as unknown as { graph: ProtocolGraph }).graph = graph;
  (modal as unknown as { runner: unknown }).runner = {
    getState: () => state,
    chooseAnswer: vi.fn(),
    chooseSnippetBranch: vi.fn(),
    pickFileBoundSnippet: vi.fn(),
    skip: skipSpy,
    stepBack: stepBackSpy,
    chooseLoopBranch: vi.fn(),
  };

  (modal as unknown as { render: () => void }).render();
  return { contentEl, stepBackSpy, skipSpy };
}

describe('Phase 65 Plan 01 — RUNNER-02 InlineRunnerModal footer layout RED tests', () => {
  it('RUNNER-02 places InlineRunnerModal Skip in a footer row after Back with visible text', () => {
    const { contentEl } = mountInlineModalWithState(
      {
        status: 'at-node',
        currentNodeId: 'q1',
        accumulatedText: 'Initial inline text',
        canStepBack: true,
      },
      buildMixedGraph(),
    );

    const questionZone = findByClass(contentEl, 'rp-question-zone')[0]!;
    const answerListIndex = questionZone.children.findIndex(child => hasClass(child, 'rp-answer-list'));
    const snippetListIndex = questionZone.children.findIndex(child => hasClass(child, 'rp-snippet-branch-list'));
    const footerRowIndex = questionZone.children.findIndex(child => hasClass(child, 'rp-runner-footer-row'));
    const footerRow = findByClass(questionZone, 'rp-runner-footer-row')[0];

    expect(footerRowIndex).toBeGreaterThan(snippetListIndex);
    expect(answerListIndex).toBeGreaterThan(-1);
    expect(snippetListIndex).toBeGreaterThan(answerListIndex);
    expect(footerRow).toBeDefined();
    expect(textOf(findByClass(footerRow, 'rp-step-back-btn')[0])).toBe('Back');
    expect(textOf(findByClass(footerRow, 'rp-skip-btn')[0])).toBe('Skip');
    expect(footerRow!.children.indexOf(findByClass(footerRow, 'rp-step-back-btn')[0]!))
      .toBeLessThan(footerRow!.children.indexOf(findByClass(footerRow, 'rp-skip-btn')[0]!));
  });

  it('RUNNER-02 uses visible Back copy in InlineRunnerModal loop and snippet picker footer rows', () => {
    const loopHarness = mountInlineModalWithState(
      {
        status: 'awaiting-loop-pick',
        nodeId: 'loop1',
        accumulatedText: 'Loop text',
        canStepBack: true,
      },
      buildLoopGraph(),
    );
    const loopFooter = findByClass(loopHarness.contentEl, 'rp-runner-footer-row')[0];
    expect(loopFooter).toBeDefined();
    expect(textOf(findByClass(loopFooter, 'rp-step-back-btn')[0])).toBe('Back');
    expect(textOf(loopHarness.contentEl)).not.toContain('Step back');

    const snippetHarness = mountInlineModalWithState(
      {
        status: 'awaiting-snippet-pick',
        nodeId: 's1',
        subfolderPath: 'abdomen',
        accumulatedText: 'Snippet text',
        canStepBack: true,
      },
      buildMixedGraph(),
    );
    const snippetFooter = findByClass(snippetHarness.contentEl, 'rp-runner-footer-row')[0];
    expect(snippetFooter).toBeDefined();
    expect(textOf(findByClass(snippetFooter, 'rp-step-back-btn')[0])).toBe('Back');
    expect(textOf(snippetHarness.contentEl)).not.toContain('Step back');
  });
});

describe('Phase 66 D-01/D-02/D-03 — InlineRunnerModal Back disable-on-click guard', () => {
  it('Phase 66 disables InlineRunnerModal Back synchronously before invoking the handler', () => {
    const h = mountInlineModalWithState(
      {
        status: 'at-node',
        currentNodeId: 'q1',
        accumulatedText: 'Initial inline text',
        canStepBack: true,
      },
      buildMixedGraph(),
    );
    const footerRow = findByClass(h.contentEl, 'rp-runner-footer-row')[0]!;
    const backBtn = findByClass(footerRow, 'rp-step-back-btn')[0]!;

    expect(backBtn.disabled).toBe(false);
    backBtn._clickHandler?.();
    expect(backBtn.disabled).toBe(true);
    expect(h.stepBackSpy).toHaveBeenCalledTimes(1);

    backBtn._clickHandler?.();
    expect(backBtn.disabled).toBe(true);
    expect(h.stepBackSpy.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
