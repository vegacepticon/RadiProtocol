import { describe, expect, it, vi } from 'vitest';
import type { ProtocolGraph, RPNode } from '../../graph/graph-model';
import { renderQuestionAtNode } from '../../runner/render/render-question';

class MockEl {
  children: MockEl[] = [];
  cls = '';
  text = '';
  title = '';
  disabled = false;
  attrs = new Map<string, string>();
  clickHandler: ((ev: MouseEvent) => void) | null = null;
  cssProps = new Map<string, string>();

  constructor(readonly tag: string) {}

  createDiv(opts?: { cls?: string }): MockEl {
    const child = new MockEl('div');
    child.cls = opts?.cls ?? '';
    this.children.push(child);
    return child;
  }

  createEl(tag: string, opts?: { cls?: string; text?: string }): MockEl {
    const child = new MockEl(tag);
    child.cls = opts?.cls ?? '';
    child.text = opts?.text ?? '';
    this.children.push(child);
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  setCssProps(props: Record<string, string>): void {
    for (const [k, v] of Object.entries(props)) {
      this.cssProps.set(k, v);
    }
  }
}

function asHtml(el: MockEl): HTMLElement {
  return el as unknown as HTMLElement;
}

function findByClass(root: MockEl, cls: string): MockEl[] {
  const out: MockEl[] = [];
  const visit = (el: MockEl): void => {
    if (el.cls.split(/\s+/).includes(cls)) out.push(el);
    for (const child of el.children) visit(child);
  };
  visit(root);
  return out;
}

function baseNode(id: string, kind: RPNode['kind'], extra: Partial<RPNode> = {}): RPNode {
  return {
    id,
    kind,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...(kind === 'question' ? { questionText: 'Pick one' } : {}),
    ...(kind === 'answer' ? { answerText: 'Answer text' } : {}),
    ...(kind === 'text-block' ? { content: 'Text' } : {}),
    ...(kind === 'loop-start' ? { loopLabel: 'Loop', exitLabel: 'Exit' } : {}),
    ...(kind === 'loop-end' ? { loopStartId: 'loop' } : {}),
    ...extra,
  } as RPNode;
}

function makeGraph(current: RPNode = baseNode('q', 'question')): ProtocolGraph {
  const nodes = new Map<string, RPNode>();
  nodes.set(current.id, current);
  nodes.set('a1', baseNode('a1', 'answer', { answerText: 'Raw answer', displayLabel: 'Shown answer' }));
  nodes.set('s-file', baseNode('s-file', 'snippet', {
    radiprotocol_snippetPath: 'Chest/report.json',
  }));
  nodes.set('s-dir', baseNode('s-dir', 'snippet', {
    snippetLabel: 'Folder label',
  }));
  nodes.set('q-labeled', baseNode('q-labeled', 'question', { questionText: 'Labeled target' }));
  nodes.set('q-fallback', baseNode('q-fallback', 'question', { questionText: 'Fallback question' }));
  nodes.set('q-id', baseNode('q-id', 'question', { questionText: '   ' }));
  return {
    canvasFilePath: 'test.canvas',
    nodes,
    edges: [
      { id: 'e-fallback', fromNodeId: current.id, toNodeId: 'q-fallback' },
      { id: 'e-labeled', fromNodeId: current.id, toNodeId: 'q-labeled', label: 'Direct label' },
      { id: 'e-id', fromNodeId: current.id, toNodeId: 'q-id', label: '   ' },
    ],
    adjacency: new Map([[current.id, ['a1', 'q-labeled', 's-file', 's-dir', 'q-fallback', 'q-id']]]),
    reverseAdjacency: new Map(),
    startNodeId: current.id,
  };
}

describe('shared question branch renderer', () => {
  it('renders question text in text zone and answer/snippet buttons in action zone, delegates clicks', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const onChooseAnswer = vi.fn();
    const onChooseSnippetBranch = vi.fn();
    const onChooseQuestionBranch = vi.fn();

    const result = renderQuestionAtNode(asHtml(textZone), asHtml(actionZone), makeGraph(), {
      status: 'at-node',
      currentNodeId: 'q',
      accumulatedText: 'before',
      canStepBack: true,
      canRedo: false,
      undoStackSize: 0,
    }, {
      bindClick: (el, handler) => {
        (el as unknown as MockEl).clickHandler = handler;
      },
      renderError: vi.fn(),
      onChooseAnswer,
      onChooseSnippetBranch,
      onChooseQuestionBranch,
    });

    expect(result).toBe('rendered');
    expect(findByClass(textZone, 'rp-question-text')[0]?.text).toBe('Pick one');
    expect(actionZone.children.map(child => child.cls)).toEqual([
      'rp-answer-list rp-stack',
      'rp-question-transition-list',
      'rp-snippet-branch-list',
    ]);
    expect(findByClass(actionZone, 'rp-answer-btn')[0]?.text).toBe('Shown answer');
    expect(findByClass(actionZone, 'rp-question-transition-btn').map(btn => btn.text)).toEqual([
      'Fallback question',
      'Direct label',
      'q-id',
    ]);
    expect(findByClass(actionZone, 'rp-snippet-branch-btn').map(btn => btn.text)).toEqual([
      '📄 report',
      '📁 Folder label',
    ]);

    findByClass(actionZone, 'rp-answer-btn')[0]!.clickHandler?.({} as MouseEvent);
    for (const btn of findByClass(actionZone, 'rp-question-transition-btn')) {
      btn.clickHandler?.({} as MouseEvent);
    }
    findByClass(actionZone, 'rp-snippet-branch-btn')[0]!.clickHandler?.({} as MouseEvent);
    findByClass(actionZone, 'rp-snippet-branch-btn')[1]!.clickHandler?.({} as MouseEvent);

    expect(onChooseAnswer.mock.calls[0]?.[0].id).toBe('a1');
    expect(onChooseQuestionBranch.mock.calls.map(call => call[0].id)).toEqual([
      'e-fallback',
      'e-labeled',
      'e-id',
    ]);
    expect(onChooseSnippetBranch.mock.calls[0]?.[0].id).toBe('s-file');
    expect(onChooseSnippetBranch.mock.calls[0]?.[1]).toBe(true);
    expect(onChooseSnippetBranch.mock.calls[1]?.[0].id).toBe('s-dir');
    expect(onChooseSnippetBranch.mock.calls[1]?.[1]).toBe(false);
  });

  it('renders an interleaved single stack in authored optionOrder (per-kind buttons preserved)', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const onChooseAnswer = vi.fn();
    const onChooseSnippetBranch = vi.fn();
    const onChooseQuestionBranch = vi.fn();

    const q = baseNode('q', 'question', { questionText: 'Pick one', optionOrder: ['e-snippet', 'e-a1', 'e-q2'] });
    const nodes = new Map<string, RPNode>();
    nodes.set('q', q);
    nodes.set('a1', baseNode('a1', 'answer', { answerText: 'Raw answer', displayLabel: 'Shown answer' }));
    nodes.set('s-file', baseNode('s-file', 'snippet', { radiprotocol_snippetPath: 'Chest/report.json' }));
    nodes.set('q2', baseNode('q2', 'question', { questionText: 'Next question' }));
    const graph: ProtocolGraph = {
      canvasFilePath: 'test.canvas',
      nodes,
      edges: [
        { id: 'e-a1', fromNodeId: 'q', toNodeId: 'a1' },
        { id: 'e-q2', fromNodeId: 'q', toNodeId: 'q2', label: 'Go to q2' },
        { id: 'e-snippet', fromNodeId: 'q', toNodeId: 's-file' },
      ],
      adjacency: new Map([['q', ['a1', 'q2', 's-file']]]),
      reverseAdjacency: new Map(),
      startNodeId: 'q',
    };

    const result = renderQuestionAtNode(asHtml(textZone), asHtml(actionZone), graph, {
      status: 'at-node', currentNodeId: 'q', accumulatedText: '', canStepBack: true, canRedo: false, undoStackSize: 0,
    }, {
      bindClick: (el, handler) => { (el as unknown as MockEl).clickHandler = handler; },
      renderError: vi.fn(),
      onChooseAnswer,
      onChooseSnippetBranch,
      onChooseQuestionBranch,
    });

    expect(result).toBe('rendered');
    expect(actionZone.children.map((c) => c.cls)).toEqual(['rp-option-list rp-stack']);
    const buttons = actionZone.children[0]!.children;
    expect(buttons.map((b) => b.cls)).toEqual(['rp-snippet-branch-btn', 'rp-answer-btn', 'rp-question-transition-btn']);
    expect(buttons.map((b) => b.text)).toEqual(['📄 report', 'Shown answer', 'Go to q2']);

    buttons[0]!.clickHandler?.({} as MouseEvent);
    buttons[1]!.clickHandler?.({} as MouseEvent);
    buttons[2]!.clickHandler?.({} as MouseEvent);
    expect(onChooseSnippetBranch.mock.calls[0]?.[0].id).toBe('s-file');
    expect(onChooseSnippetBranch.mock.calls[0]?.[1]).toBe(true);
    expect(onChooseAnswer.mock.calls[0]?.[0].id).toBe('a1');
    expect(onChooseQuestionBranch.mock.calls[0]?.[0].id).toBe('e-q2');
  });

  it('returns error/not-question for host-specific chrome handling', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const renderError = vi.fn();
    const host = {
      bindClick: vi.fn(),
      renderError,
      onChooseAnswer: vi.fn(),
      onChooseSnippetBranch: vi.fn(),
      onChooseQuestionBranch: vi.fn(),
    };
    const state = {
      status: 'at-node' as const,
      currentNodeId: 'q',
      accumulatedText: '',
      canStepBack: false,
      canRedo: false,
      undoStackSize: 0,
    };

    expect(renderQuestionAtNode(asHtml(textZone), asHtml(actionZone), null, state, host)).toBe('error');
    expect(renderQuestionAtNode(asHtml(textZone), asHtml(actionZone), makeGraph(baseNode('q', 'text-block')), state, host)).toBe('not-question');
    expect(renderError).toHaveBeenCalledWith(['Internal error: graph not loaded.']);
  });
});
