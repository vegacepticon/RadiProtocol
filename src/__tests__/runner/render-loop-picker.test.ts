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

  createEl(tag: string, opts?: { cls?: string; text?: string; attr?: Record<string, string> }): MockEl {
    const child = new MockEl(tag);
    child.cls = opts?.cls ?? '';
    child.text = opts?.text ?? '';
    if (opts?.attr) {
      for (const [k, v] of Object.entries(opts.attr)) {
        child.setAttribute(k, v);
      }
    }
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
  nodes.set('loop', node('loop', 'question', { questionText: 'Repeat?', loop: true }));
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
  it('renders Back/Skip icon buttons with synchronous back disable guard', () => {
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
      t: (key: string) => key === 'protocolRunner.stepBack' ? 'Go back one step (Ctrl+←)' : key === 'protocolRunner.stepSkip' ? 'Skip this question' : key,
    });

    const back = findByClass(root, 'rp-step-back-btn')[0]!;
    const skip = findByClass(root, 'rp-skip-btn')[0]!;
    back.clickHandler?.({} as MouseEvent);
    skip.clickHandler?.({} as MouseEvent);

    expect(back.disabled).toBe(true);
    expect(skip.attrs.get('aria-label')).toBe('Skip this question');
    expect(back.attrs.get('aria-label')).toBe('Go back one step (Ctrl+←)');
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('uses i18n key as fallback when no t function is provided', () => {
    const root = new MockEl('root');
    renderRunnerFooter(asHtml(root), {
      bindClick: (el, handler) => {
        (el as unknown as MockEl).clickHandler = handler;
      },
    }, {
      showBack: true,
      onBack: () => {},
    });

    const back = findByClass(root, 'rp-step-back-btn')[0]!;
    expect(back.attrs.get('aria-label')).toBe('protocolRunner.stepBack');
  });

  it('renders Redo button with localized aria-label', () => {
    const root = new MockEl('root');
    const onRedo = vi.fn();
    renderRunnerFooter(asHtml(root), {
      bindClick: (el, handler) => {
        (el as unknown as MockEl).clickHandler = handler;
      },
    }, {
      showBack: false,
      onBack: () => {},
      showRedo: true,
      onRedo,
      t: (key: string) => key === 'protocolRunner.stepRedo' ? 'Redo (Ctrl+→)' : key,
    });

    const redo = findByClass(root, 'rp-step-redo-btn')[0]!;
    expect(redo.attrs.get('aria-label')).toBe('Redo (Ctrl+→)');
    redo.clickHandler?.({} as MouseEvent);
    expect(onRedo).toHaveBeenCalledTimes(1);
    expect(redo.disabled).toBe(true);
  });

  it('does not render footer when no buttons are visible', () => {
    const root = new MockEl('root');
    renderRunnerFooter(asHtml(root), {
      bindClick: () => {},
    }, {
      showBack: false,
      onBack: () => {},
    });

    expect(root.children.length).toBe(0);
  });

  it('does not use title attribute on any button (Obsidian icon tooltip pitfall)', () => {
    const root = new MockEl('root');
    renderRunnerFooter(asHtml(root), {
      bindClick: (el, handler) => {
        (el as unknown as MockEl).clickHandler = handler;
      },
    }, {
      showBack: true,
      onBack: () => {},
      showSkip: true,
      onSkip: () => {},
      showRedo: true,
      onRedo: () => {},
      t: (key: string) => {
        const map: Record<string, string> = {
          'protocolRunner.stepBack': 'Go back one step (Ctrl+←)',
          'protocolRunner.stepRedo': 'Redo (Ctrl+→)',
          'protocolRunner.stepSkip': 'Skip this question',
        };
        return map[key] ?? key;
      },
    });

    for (const btn of findByClass(root, 'rp-runner-icon-btn')) {
      expect(btn.attrs.get('title') ?? null).toBeNull();
      expect(btn.attrs.get('aria-label')).not.toBeNull();
    }
  });
});

describe('shared loop picker renderer', () => {
  it('renders header in text zone, body/exit buttons in action zone, and delegates clicks', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const bodyEdge = { id: 'e-body', fromNodeId: 'loop', toNodeId: 'body' };
    const exitEdge = { id: 'e-exit', fromNodeId: 'loop', toNodeId: 'exit', label: 'finish', isLoopExit: true };
    const onChooseLoopBranch = vi.fn();

    const rendered = renderLoopPicker(asHtml(textZone), asHtml(actionZone), graph([bodyEdge, exitEdge]), {
      status: 'awaiting-loop-pick',
      nodeId: 'loop',
      accumulatedText: 'before',
      canStepBack: true,
      canRedo: false,
      undoStackSize: 0,
    }, {
      bindClick: (el, handler) => {
        (el as unknown as MockEl).clickHandler = handler;
      },
      renderError: vi.fn(),
      onChooseLoopBranch,
    });

    expect(rendered).toBe(true);
    expect(findByClass(textZone, 'rp-loop-header-text')[0]?.text).toBe('Repeat?');
    expect(findByClass(actionZone, 'rp-loop-body-btn')[0]?.text).toBe('Body label');
    expect(findByClass(actionZone, 'rp-loop-exit-btn')[0]?.text).toBe('finish');

    findByClass(actionZone, 'rp-loop-body-btn')[0]!.clickHandler?.({} as MouseEvent);
    findByClass(actionZone, 'rp-loop-exit-btn')[0]!.clickHandler?.({} as MouseEvent);

    expect(onChooseLoopBranch).toHaveBeenNthCalledWith(1, bodyEdge, false);
    expect(onChooseLoopBranch).toHaveBeenNthCalledWith(2, exitEdge, true);
  });

  it('returns false and delegates graph/node errors to host chrome', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const renderError = vi.fn();
    const host = {
      bindClick: vi.fn(),
      renderError,
      onChooseLoopBranch: vi.fn(),
    };
    const state = {
      status: 'awaiting-loop-pick' as const,
      nodeId: 'missing',
      accumulatedText: '',
      canStepBack: false,
      canRedo: false,
      undoStackSize: 0,
    };

    expect(renderLoopPicker(asHtml(textZone), asHtml(actionZone), null, state, host)).toBe(false);
    expect(renderLoopPicker(asHtml(textZone), asHtml(actionZone), graph([]), state, host)).toBe(false);
    expect(renderError).toHaveBeenNthCalledWith(1, ['Internal error: graph not loaded.']);
    expect(renderError).toHaveBeenNthCalledWith(2, ['Looped question "missing" not found in graph.']);
  });

  it('returns false when the node is an ordinary question (no loop toggle)', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const renderError = vi.fn();
    const graphOrdinary: ProtocolGraph = {
      ...graph([]),
      nodes: new Map<string, RPNode>([
        ['loop', node('loop', 'question', { questionText: 'Ordinary?' })],
        ['body', node('body', 'answer', { answerText: 'Body answer', displayLabel: 'Body label' })],
        ['exit', node('exit', 'text-block', { content: 'Done' })],
      ]),
    };
    const state = { status: 'awaiting-loop-pick' as const, nodeId: 'loop', accumulatedText: '', canStepBack: false, canRedo: false, undoStackSize: 0 };
    const rendered = renderLoopPicker(asHtml(textZone), asHtml(actionZone), graphOrdinary, state, { bindClick: vi.fn(), renderError, onChooseLoopBranch: vi.fn() });
    expect(rendered).toBe(false);
    expect(renderError).toHaveBeenCalledWith(['Looped question "loop" not found in graph.']);
  });

  it('an unlabeled exit edge renders empty visible text but a target-derived aria-label', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const unlabeledExit = { id: 'e-exit', fromNodeId: 'loop', toNodeId: 'exit', isLoopExit: true };
    const onChooseLoopBranch = vi.fn();
    renderLoopPicker(asHtml(textZone), asHtml(actionZone), graph([unlabeledExit]), {
      status: 'awaiting-loop-pick', nodeId: 'loop', accumulatedText: '', canStepBack: false, canRedo: false, undoStackSize: 0,
    }, {
      bindClick: (el, handler) => { (el as unknown as MockEl).clickHandler = handler; },
      renderError: vi.fn(),
      onChooseLoopBranch,
    });
    const exitBtn = findByClass(actionZone, 'rp-loop-exit-btn')[0]!;
    expect(exitBtn.text).toBe('');
    // target 'exit' is a text-block with content 'Done' → nodeLabel slices to 'Done'
    expect(exitBtn.attrs.get('aria-label')).toBe('Done');
  });

  it('renders body/exit buttons in authored optionOrder when present', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const bodyEdge = { id: 'e-body', fromNodeId: 'loop', toNodeId: 'body' };
    const exitEdge = { id: 'e-exit', fromNodeId: 'loop', toNodeId: 'exit', label: 'finish', isLoopExit: true };
    const onChooseLoopBranch = vi.fn();

    // Authored order: exit first, then body (reverse of edges-array order).
    const orderedGraph: ProtocolGraph = {
      ...graph([bodyEdge, exitEdge]),
      nodes: new Map<string, RPNode>([
        ['loop', node('loop', 'question', { questionText: 'Repeat?', loop: true, optionOrder: ['e-exit', 'e-body'] })],
        ['body', node('body', 'answer', { answerText: 'Body answer', displayLabel: 'Body label' })],
        ['exit', node('exit', 'text-block', { content: 'Done' })],
      ]),
    };

    renderLoopPicker(asHtml(textZone), asHtml(actionZone), orderedGraph, {
      status: 'awaiting-loop-pick', nodeId: 'loop', accumulatedText: '', canStepBack: true, canRedo: false, undoStackSize: 0,
    }, {
      bindClick: (el, handler) => { (el as unknown as MockEl).clickHandler = handler; },
      renderError: vi.fn(),
      onChooseLoopBranch,
    });

    const list = findByClass(actionZone, 'rp-loop-picker-list')[0]!;
    expect(list.children.map((b) => b.cls)).toEqual(['rp-loop-exit-btn', 'rp-loop-body-btn']);
    expect(list.children.map((b) => b.text)).toEqual(['finish', 'Body label']);
  });

  it('a whitespace-only exit label renders verbatim visible text but a target-derived aria-label', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const whitespaceExit = { id: 'e-exit', fromNodeId: 'loop', toNodeId: 'exit', label: '   ', isLoopExit: true };
    const onChooseLoopBranch = vi.fn();
    renderLoopPicker(asHtml(textZone), asHtml(actionZone), graph([whitespaceExit]), {
      status: 'awaiting-loop-pick', nodeId: 'loop', accumulatedText: '', canStepBack: false, canRedo: false, undoStackSize: 0,
    }, {
      bindClick: (el, handler) => { (el as unknown as MockEl).clickHandler = handler; },
      renderError: vi.fn(),
      onChooseLoopBranch,
    });
    const exitBtn = findByClass(actionZone, 'rp-loop-exit-btn')[0]!;
    // Verbatim whitespace preserved as visible text
    expect(exitBtn.text).toBe('   ');
    // Trimmed-empty caption is treated as unlabeled → target-derived aria-label
    expect(exitBtn.attrs.get('aria-label')).toBe('Done');
  });
});
