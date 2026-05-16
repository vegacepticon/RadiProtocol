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
    ...(kind === 'loop' ? { headerText: '' } : {}),
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
  return {
    canvasFilePath: 'test.canvas',
    nodes,
    edges: [],
    adjacency: new Map([[current.id, ['a1', 's-file', 's-dir']]]),
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

    const result = renderQuestionAtNode(asHtml(textZone), asHtml(actionZone), makeGraph(), {
      status: 'at-node',
      currentNodeId: 'q',
      accumulatedText: 'before',
      canStepBack: true,
    }, {
      bindClick: (el, handler) => {
        (el as unknown as MockEl).clickHandler = handler;
      },
      renderError: vi.fn(),
      onChooseAnswer,
      onChooseSnippetBranch,
    });

    expect(result).toBe('rendered');
    expect(findByClass(textZone, 'rp-question-text')[0]?.text).toBe('Pick one');
    expect(findByClass(actionZone, 'rp-answer-btn')[0]?.text).toBe('Shown answer');
    expect(findByClass(actionZone, 'rp-snippet-branch-btn').map(btn => btn.text)).toEqual([
      '📄 report',
      '📁 Folder label',
    ]);

    findByClass(actionZone, 'rp-answer-btn')[0]!.clickHandler?.({} as MouseEvent);
    findByClass(actionZone, 'rp-snippet-branch-btn')[0]!.clickHandler?.({} as MouseEvent);
    findByClass(actionZone, 'rp-snippet-branch-btn')[1]!.clickHandler?.({} as MouseEvent);

    expect(onChooseAnswer.mock.calls[0]?.[0].id).toBe('a1');
    expect(onChooseSnippetBranch.mock.calls[0]?.[0].id).toBe('s-file');
    expect(onChooseSnippetBranch.mock.calls[0]?.[1]).toBe(true);
    expect(onChooseSnippetBranch.mock.calls[1]?.[0].id).toBe('s-dir');
    expect(onChooseSnippetBranch.mock.calls[1]?.[1]).toBe(false);
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
    };
    const state = {
      status: 'at-node' as const,
      currentNodeId: 'q',
      accumulatedText: '',
      canStepBack: false,
    };

    expect(renderQuestionAtNode(asHtml(textZone), asHtml(actionZone), null, state, host)).toBe('error');
    expect(renderQuestionAtNode(asHtml(textZone), asHtml(actionZone), makeGraph(baseNode('q', 'text-block')), state, host)).toBe('not-question');
    expect(renderError).toHaveBeenCalledWith(['Internal error: graph not loaded.']);
  });
});
