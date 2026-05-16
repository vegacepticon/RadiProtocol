import { describe, expect, it, vi } from 'vitest';
import type { ProtocolGraph, RPEdge, RPNode } from '../../graph/graph-model';
import { renderRunnerFooter } from '../../runner/render/render-footer';
import { renderLoopPicker } from '../../runner/render/render-loop-picker';

class MockEl {
  children: MockEl[] = [];
  cls = '';
  text = '';
  title = '';
  disabled = false;
  attrs = new Map<string, string>();
  clickHandler: ((ev: MouseEvent) => void) | null = null;

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

function node(id: string, kind: RPNode['kind'], extra: Partial<RPNode> = {}): RPNode {
  return {
    id,
    kind,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...(kind === 'loop' ? { headerText: '' } : {}),
    ...(kind === 'answer' ? { answerText: id } : {}),
    ...(kind === 'question' ? { questionText: id } : {}),
    ...(kind === 'text-block' ? { content: id } : {}),
    ...(kind === 'loop-start' ? { loopLabel: id, exitLabel: 'exit' } : {}),
    ...(kind === 'loop-end' ? { loopStartId: 'loop' } : {}),
    ...extra,
  } as RPNode;
}

function graph(edges: RPEdge[]): ProtocolGraph {
  const nodes = new Map<string, RPNode>();
  nodes.set('loop', node('loop', 'loop', { headerText: 'Repeat?' }));
  nodes.set('body', node('body', 'answer', { answerText: 'Body answer', displayLabel: 'Body label' }));
  nodes.set('exit', node('exit', 'text-block', { content: 'Done' }));
  return {
    canvasFilePath: 'test.canvas',
    nodes,
    edges,
    adjacency: new Map(),
    reverseAdjacency: new Map(),
    startNodeId: 'loop',
  };
}

describe('shared runner footer renderer', () => {
  it('renders Back/Skip with synchronous back disable guard', () => {
    const root = new MockEl('root');
    const onBack = vi.fn();
    const onSkip = vi.fn();
    renderRunnerFooter(asHtml(root), {
      bindClick: (el, handler) => {
        (el as unknown as MockEl).clickHandler = handler;
      },
    }, {
      showBack: true,
      onBack,
      showSkip: true,
      onSkip,
    });

    const back = findByClass(root, 'rp-step-back-btn')[0]!;
    const skip = findByClass(root, 'rp-skip-btn')[0]!;
    back.clickHandler?.({} as MouseEvent);
    skip.clickHandler?.({} as MouseEvent);

    expect(back.disabled).toBe(true);
    expect(back.attrs.get('aria-label')).toBe('Go back one step');
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe('shared loop picker renderer', () => {
  it('renders header, body/exit buttons, and delegates clicks', () => {
    const textRoot = new MockEl('root');
    const actionRoot = new MockEl('root');
    const bodyEdge = { id: 'e-body', fromNodeId: 'loop', toNodeId: 'body' };
    const exitEdge = { id: 'e-exit', fromNodeId: 'loop', toNodeId: 'exit', label: '+ finish' };
    const onChooseLoopBranch = vi.fn();
    const onBack = vi.fn();

    const rendered = renderLoopPicker(asHtml(textRoot), asHtml(actionRoot), graph([bodyEdge, exitEdge]), {
      status: 'awaiting-loop-pick',
      nodeId: 'loop',
      accumulatedText: 'before',
      canStepBack: true,
    }, {
      bindClick: (el, handler) => {
        (el as unknown as MockEl).clickHandler = handler;
      },
      renderError: vi.fn(),
      onChooseLoopBranch,
      onBack,
    });

    expect(rendered).toBe(true);
    expect(findByClass(textRoot, 'rp-loop-header-text')[0]?.text).toBe('Repeat?');
    expect(findByClass(actionRoot, 'rp-loop-body-btn')[0]?.text).toBe('Body label');
    expect(findByClass(actionRoot, 'rp-loop-exit-btn')[0]?.text).toBe('finish');

    findByClass(actionRoot, 'rp-loop-body-btn')[0]!.clickHandler?.({} as MouseEvent);
    findByClass(actionRoot, 'rp-loop-exit-btn')[0]!.clickHandler?.({} as MouseEvent);
    findByClass(actionRoot, 'rp-step-back-btn')[0]!.clickHandler?.({} as MouseEvent);

    expect(onChooseLoopBranch).toHaveBeenNthCalledWith(1, bodyEdge, false);
    expect(onChooseLoopBranch).toHaveBeenNthCalledWith(2, exitEdge, true);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('returns false and delegates graph/node errors to host chrome', () => {
    const textRoot = new MockEl('root');
    const actionRoot = new MockEl('root');
    const renderError = vi.fn();
    const host = {
      bindClick: vi.fn(),
      renderError,
      onChooseLoopBranch: vi.fn(),
      onBack: vi.fn(),
    };
    const state = {
      status: 'awaiting-loop-pick' as const,
      nodeId: 'missing',
      accumulatedText: '',
      canStepBack: false,
    };

    expect(renderLoopPicker(asHtml(textRoot), asHtml(actionRoot), null, state, host)).toBe(false);
    expect(renderLoopPicker(asHtml(textRoot), asHtml(actionRoot), graph([]), state, host)).toBe(false);
    expect(renderError).toHaveBeenNthCalledWith(1, ['Internal error: graph not loaded.']);
    expect(renderError).toHaveBeenNthCalledWith(2, ['Loop node "missing" not found in graph.']);
  });
});
