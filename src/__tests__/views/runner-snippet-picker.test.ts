// src/__tests__/views/runner-snippet-picker.test.ts
// Phase 51 Plan 05 (PICKER-02, D-06) — RunnerView renderSnippetPicker rewrite on top
// of SnippetTreePicker (file-only mode).
//
// Covers:
//   Test 1: entering awaiting-snippet-pick mounts SnippetTreePicker with mode 'file-only'
//           and rootPath = settings.snippetFolderPath + '/' + node.subfolderPath
//   Test 2: subfolderPath === undefined mounts at rootPath = settings.snippetFolderPath
//           (no trailing slash, no node-relative segment)
//   Test 3: file-row click calls snippetService.load(absPath) AND
//           handleSnippetPickerSelection(snippet) when snippet !== null
//   Test 4: file-row click on missing file (load returns null) renders Russian error
//           AND does NOT call handleSnippetPickerSelection
//   Test 5: T-30-04 stale-result guard — state transition between mount and load
//           callback suppresses handleSnippetPickerSelection
//   Test 6: Step-back button still rendered when canStepBack; click calls runner.stepBack
//           and re-renders
//   Test 7 (RUNFIX-02): file-row click handler's FIRST statement is
//           capturePendingTextareaScroll() (verified via call-order spy)
//   Test 8 (lifecycle): render() unmounts the previous picker when state has left
//           awaiting-snippet-pick

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('obsidian');

// ── SnippetTreePicker mock (hoisted via vi.mock) ──────────────────────────

const pickerCtorSpy = vi.fn();
const pickerMountSpy = vi.fn();
const pickerUnmountSpy = vi.fn();

interface CapturedPicker {
  options: Record<string, unknown>;
}
const pickerInstances: CapturedPicker[] = [];

vi.mock('../../views/snippet-tree-picker', () => {
  class SnippetTreePicker {
    constructor(options: Record<string, unknown>) {
      pickerCtorSpy(options);
      pickerInstances.push({ options });
      (this as unknown as { mount: () => Promise<void> }).mount = async () => {
        pickerMountSpy();
      };
      (this as unknown as { unmount: () => void }).unmount = () => {
        pickerUnmountSpy();
      };
    }
  }
  return { SnippetTreePicker };
});

// Import RunnerView after mocks are in place.
import { RunnerView } from '../../views/runner-view';
import type RadiProtocolPlugin from '../../main';
import type { Snippet } from '../../snippets/snippet-model';

// ── FakeNode — minimal DOM-ish stub for questionZone and children ─────────

interface FakeNode {
  tag: string;
  cls?: string;
  text?: string;
  children: FakeNode[];
  createDiv: (opts?: { cls?: string; text?: string }) => FakeNode;
  createEl: (tag: string, opts?: { cls?: string; text?: string; type?: string }) => FakeNode;
  createSpan: (opts?: { cls?: string; text?: string }) => FakeNode;
  empty: () => void;
  setText: (t: string) => void;
  _clickHandler?: () => void;
  disabled: boolean;
  value: string;
  style: Record<string, string>;
  scrollTop: number;
  scrollHeight: number;
}

function makeFakeNode(tag = 'div', cls?: string, text?: string): FakeNode {
  const node: FakeNode = {
    tag,
    cls,
    text,
    children: [],
    createDiv(opts?: { cls?: string; text?: string }): FakeNode {
      const child = makeFakeNode('div', opts?.cls, opts?.text);
      node.children.push(child);
      return child;
    },
    createEl(t: string, opts?: { cls?: string; text?: string; type?: string }): FakeNode {
      const child = makeFakeNode(t, opts?.cls, opts?.text);
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
    disabled: false,
    value: '',
    style: {},
    scrollTop: 0,
    scrollHeight: 0,
  };
  return node;
}

function findByClass(root: FakeNode, cls: string): FakeNode[] {
  const out: FakeNode[] = [];
  const visit = (n: FakeNode): void => {
    if (n.cls === cls) out.push(n);
    for (const c of n.children) visit(c);
  };
  visit(root);
  return out;
}

function findByText(root: FakeNode, text: string): FakeNode[] {
  const out: FakeNode[] = [];
  const visit = (n: FakeNode): void => {
    if (n.text !== undefined && n.text.includes(text)) out.push(n);
    for (const c of n.children) visit(c);
  };
  visit(root);
  return out;
}

// ── Fake runner + plugin + view factory ───────────────────────────────────

interface FakeRunnerState {
  status:
    | 'idle'
    | 'at-node'
    | 'awaiting-snippet-pick'
    | 'awaiting-snippet-fill'
    | 'awaiting-loop-pick'
    | 'complete'
    | 'error';
  nodeId?: string;
  subfolderPath?: string;
  accumulatedText?: string;
  canStepBack?: boolean;
  currentNodeId?: string;
  message?: string;
  finalText?: string;
  snippetId?: string;
}

function makePlugin(): RadiProtocolPlugin {
  const loadMock = vi.fn<(path: string) => Promise<Snippet | null>>();
  return {
    settings: { snippetFolderPath: '.radiprotocol/snippets', textSeparator: 'newline' },
    snippetService: {
      load: loadMock,
      listFolder: vi.fn<(p: string) => Promise<{ folders: string[]; snippets: Snippet[] }>>(
        async () => ({ folders: [], snippets: [] }),
      ),
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

function makeView(pickerState: FakeRunnerState): {
  view: RunnerView;
  plugin: RadiProtocolPlugin;
  runnerStateRef: { state: FakeRunnerState };
  stepBackSpy: ReturnType<typeof vi.fn>;
  syncManualEditSpy: ReturnType<typeof vi.fn>;
  pickSnippetSpy: ReturnType<typeof vi.fn>;
  completeSnippetSpy: ReturnType<typeof vi.fn>;
  handleSnippetPickerSelectionSpy: ReturnType<typeof vi.fn>;
} {
  const plugin = makePlugin();
  const leaf = {} as unknown as import('obsidian').WorkspaceLeaf;
  const view = new RunnerView(leaf, plugin);

  // Track runner state — tests can mutate runnerStateRef.state to simulate transitions.
  const runnerStateRef = { state: { ...pickerState } };
  const stepBackSpy = vi.fn();
  const syncManualEditSpy = vi.fn();
  const pickSnippetSpy = vi.fn();
  const completeSnippetSpy = vi.fn();
  (view as unknown as { runner: unknown }).runner = {
    getState: () => runnerStateRef.state,
    stepBack: stepBackSpy,
    syncManualEdit: syncManualEditSpy,
    pickSnippet: pickSnippetSpy,
    completeSnippet: completeSnippetSpy,
  };

  // Spy handleSnippetPickerSelection on the VIEW. Default: mark called; real logic
  // not invoked because runner is mocked.
  const handleSnippetPickerSelectionSpy = vi.fn(async (_s: Snippet) => {});
  (view as unknown as { handleSnippetPickerSelection: (s: Snippet) => Promise<void> })
    .handleSnippetPickerSelection = handleSnippetPickerSelectionSpy;

  // Neutralise registerDomEvent — capture click handler on the element instead
  (view as unknown as { registerDomEvent: unknown }).registerDomEvent = (
    el: FakeNode,
    type: string,
    handler: () => void,
  ) => {
    if (type === 'click') el._clickHandler = handler;
  };

  // autoSaveSession: fire-and-forget noop
  (view as unknown as { autoSaveSession: () => Promise<void> }).autoSaveSession = async () => {};

  return {
    view,
    plugin,
    runnerStateRef,
    stepBackSpy,
    syncManualEditSpy,
    pickSnippetSpy,
    completeSnippetSpy,
    handleSnippetPickerSelectionSpy,
  };
}

beforeEach(() => {
  pickerCtorSpy.mockClear();
  pickerMountSpy.mockClear();
  pickerUnmountSpy.mockClear();
  pickerInstances.length = 0;
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Phase 51 Plan 05 — RunnerView renderSnippetPicker on SnippetTreePicker (D-06)', () => {
  it('Test 1: mounts SnippetTreePicker mode=file-only rooted at settings.snippetFolderPath + node.subfolderPath', async () => {
    const { view } = makeView({
      status: 'awaiting-snippet-pick',
      nodeId: 'n1',
      subfolderPath: 'abdomen/ct',
      accumulatedText: '',
      canStepBack: false,
    });
    const questionZone = makeFakeNode();

    await (view as unknown as {
      renderSnippetPicker: (state: unknown, zone: HTMLElement) => Promise<void>;
    }).renderSnippetPicker(
      {
        status: 'awaiting-snippet-pick',
        nodeId: 'n1',
        subfolderPath: 'abdomen/ct',
        accumulatedText: '',
        canStepBack: false,
      },
      questionZone as unknown as HTMLElement,
    );

    expect(pickerCtorSpy).toHaveBeenCalledTimes(1);
    expect(pickerMountSpy).toHaveBeenCalledTimes(1);
    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    expect(opts.mode).toBe('file-only');
    expect(opts.rootPath).toBe('.radiprotocol/snippets/abdomen/ct');
  });

  it('Test 2: subfolderPath === undefined mounts at rootPath = settings.snippetFolderPath (no trailing slash)', async () => {
    const { view } = makeView({
      status: 'awaiting-snippet-pick',
      nodeId: 'n1',
      subfolderPath: undefined,
      accumulatedText: '',
      canStepBack: false,
    });
    const questionZone = makeFakeNode();

    await (view as unknown as {
      renderSnippetPicker: (state: unknown, zone: HTMLElement) => Promise<void>;
    }).renderSnippetPicker(
      {
        status: 'awaiting-snippet-pick',
        nodeId: 'n1',
        subfolderPath: undefined,
        accumulatedText: '',
        canStepBack: false,
      },
      questionZone as unknown as HTMLElement,
    );

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    expect(opts.rootPath).toBe('.radiprotocol/snippets');
  });

  it('Test 3: file-row click calls snippetService.load(absPath) AND handleSnippetPickerSelection(snippet)', async () => {
    const { view, plugin, handleSnippetPickerSelectionSpy } = makeView({
      status: 'awaiting-snippet-pick',
      nodeId: 'n1',
      subfolderPath: 'abdomen',
      accumulatedText: '',
      canStepBack: false,
    });
    const fakeSnippet: Snippet = {
      kind: 'md',
      path: '.radiprotocol/snippets/abdomen/ct.md',
      name: 'ct',
      content: 'hello',
    };
    (plugin.snippetService.load as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSnippet);

    const questionZone = makeFakeNode();
    await (view as unknown as {
      renderSnippetPicker: (state: unknown, zone: HTMLElement) => Promise<void>;
    }).renderSnippetPicker(
      {
        status: 'awaiting-snippet-pick',
        nodeId: 'n1',
        subfolderPath: 'abdomen',
        accumulatedText: '',
        canStepBack: false,
      },
      questionZone as unknown as HTMLElement,
    );

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    const onSelect = opts.onSelect as (r: { kind: string; relativePath: string }) => void;
    onSelect({ kind: 'file', relativePath: 'ct.md' });

    // Allow awaited microtasks
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(plugin.snippetService.load).toHaveBeenCalledWith('.radiprotocol/snippets/abdomen/ct.md');
    expect(handleSnippetPickerSelectionSpy).toHaveBeenCalledWith(fakeSnippet);
  });

  it('Test 4: file-row click on missing file (load returns null) renders Russian error AND does not call handleSnippetPickerSelection', async () => {
    const { view, plugin, handleSnippetPickerSelectionSpy } = makeView({
      status: 'awaiting-snippet-pick',
      nodeId: 'n1',
      subfolderPath: 'abdomen',
      accumulatedText: '',
      canStepBack: false,
    });
    (plugin.snippetService.load as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const questionZone = makeFakeNode();
    await (view as unknown as {
      renderSnippetPicker: (state: unknown, zone: HTMLElement) => Promise<void>;
    }).renderSnippetPicker(
      {
        status: 'awaiting-snippet-pick',
        nodeId: 'n1',
        subfolderPath: 'abdomen',
        accumulatedText: '',
        canStepBack: false,
      },
      questionZone as unknown as HTMLElement,
    );

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    const onSelect = opts.onSelect as (r: { kind: string; relativePath: string }) => void;
    onSelect({ kind: 'file', relativePath: 'missing.md' });

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(handleSnippetPickerSelectionSpy).not.toHaveBeenCalled();
    // Error message in Russian, includes relativePath
    const errs = findByText(questionZone, 'Сниппет не найден');
    expect(errs.length).toBeGreaterThanOrEqual(1);
    expect(errs[0]!.text).toContain('missing.md');
  });

  it('Test 5: T-30-04 stale-result guard — runner state change between click and load resolution suppresses handleSnippetPickerSelection', async () => {
    const { view, plugin, runnerStateRef, handleSnippetPickerSelectionSpy } = makeView({
      status: 'awaiting-snippet-pick',
      nodeId: 'n1',
      subfolderPath: 'abdomen',
      accumulatedText: '',
      canStepBack: false,
    });
    // Make load resolve AFTER we flip runner state to a different node.
    let resolveLoad!: (s: Snippet | null) => void;
    const loadPromise = new Promise<Snippet | null>((resolve) => {
      resolveLoad = resolve;
    });
    (plugin.snippetService.load as ReturnType<typeof vi.fn>).mockReturnValue(loadPromise);

    const questionZone = makeFakeNode();
    await (view as unknown as {
      renderSnippetPicker: (state: unknown, zone: HTMLElement) => Promise<void>;
    }).renderSnippetPicker(
      {
        status: 'awaiting-snippet-pick',
        nodeId: 'n1',
        subfolderPath: 'abdomen',
        accumulatedText: '',
        canStepBack: false,
      },
      questionZone as unknown as HTMLElement,
    );

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    const onSelect = opts.onSelect as (r: { kind: string; relativePath: string }) => void;
    onSelect({ kind: 'file', relativePath: 'ct.md' });

    // Flip runner state BEFORE resolving load
    runnerStateRef.state = {
      status: 'at-node',
      currentNodeId: 'other',
    };
    resolveLoad({
      kind: 'md',
      path: '.radiprotocol/snippets/abdomen/ct.md',
      name: 'ct',
      content: 'hello',
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(handleSnippetPickerSelectionSpy).not.toHaveBeenCalled();
  });

  it('Test 6: Step-back button rendered when canStepBack; click calls runner.stepBack and re-renders', async () => {
    const { view, stepBackSpy } = makeView({
      status: 'awaiting-snippet-pick',
      nodeId: 'n1',
      subfolderPath: 'abdomen',
      accumulatedText: '',
      canStepBack: true,
    });
    const renderSpy = vi.fn();
    (view as unknown as { render: () => void }).render = renderSpy;

    const questionZone = makeFakeNode();
    await (view as unknown as {
      renderSnippetPicker: (state: unknown, zone: HTMLElement) => Promise<void>;
    }).renderSnippetPicker(
      {
        status: 'awaiting-snippet-pick',
        nodeId: 'n1',
        subfolderPath: 'abdomen',
        accumulatedText: '',
        canStepBack: true,
      },
      questionZone as unknown as HTMLElement,
    );

    const stepBackBtns = findByClass(questionZone, 'rp-step-back-btn');
    expect(stepBackBtns.length).toBe(1);
    stepBackBtns[0]!._clickHandler?.();

    expect(stepBackSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalled();
  });

  it('Test 7 (RUNFIX-02): file-row click handler invokes capturePendingTextareaScroll BEFORE snippetService.load', async () => {
    const { view, plugin } = makeView({
      status: 'awaiting-snippet-pick',
      nodeId: 'n1',
      subfolderPath: 'abdomen',
      accumulatedText: '',
      canStepBack: false,
    });
    const fakeSnippet: Snippet = {
      kind: 'md',
      path: '.radiprotocol/snippets/abdomen/ct.md',
      name: 'ct',
      content: 'hello',
    };
    (plugin.snippetService.load as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSnippet);

    // Spy call order via a shared array
    const callOrder: string[] = [];
    (view as unknown as { capturePendingTextareaScroll: () => void }).capturePendingTextareaScroll =
      () => {
        callOrder.push('capturePendingTextareaScroll');
      };
    (plugin.snippetService.load as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('snippetService.load');
      return fakeSnippet;
    });

    const questionZone = makeFakeNode();
    await (view as unknown as {
      renderSnippetPicker: (state: unknown, zone: HTMLElement) => Promise<void>;
    }).renderSnippetPicker(
      {
        status: 'awaiting-snippet-pick',
        nodeId: 'n1',
        subfolderPath: 'abdomen',
        accumulatedText: '',
        canStepBack: false,
      },
      questionZone as unknown as HTMLElement,
    );

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    const onSelect = opts.onSelect as (r: { kind: string; relativePath: string }) => void;
    onSelect({ kind: 'file', relativePath: 'ct.md' });

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(callOrder[0]).toBe('capturePendingTextareaScroll');
    expect(callOrder.indexOf('capturePendingTextareaScroll')).toBeLessThan(
      callOrder.indexOf('snippetService.load'),
    );
  });

  it('Test 8 (lifecycle): previous SnippetTreePicker instance is unmounted when renderSnippetPicker runs a second time', async () => {
    const { view } = makeView({
      status: 'awaiting-snippet-pick',
      nodeId: 'n1',
      subfolderPath: 'abdomen',
      accumulatedText: '',
      canStepBack: false,
    });

    const qz1 = makeFakeNode();
    await (view as unknown as {
      renderSnippetPicker: (state: unknown, zone: HTMLElement) => Promise<void>;
    }).renderSnippetPicker(
      {
        status: 'awaiting-snippet-pick',
        nodeId: 'n1',
        subfolderPath: 'abdomen',
        accumulatedText: '',
        canStepBack: false,
      },
      qz1 as unknown as HTMLElement,
    );
    expect(pickerInstances.length).toBe(1);
    expect(pickerUnmountSpy).toHaveBeenCalledTimes(0);

    const qz2 = makeFakeNode();
    await (view as unknown as {
      renderSnippetPicker: (state: unknown, zone: HTMLElement) => Promise<void>;
    }).renderSnippetPicker(
      {
        status: 'awaiting-snippet-pick',
        nodeId: 'n1',
        subfolderPath: 'abdomen',
        accumulatedText: '',
        canStepBack: false,
      },
      qz2 as unknown as HTMLElement,
    );
    expect(pickerInstances.length).toBe(2);
    // Defensive cleanup in renderSnippetPicker — prior picker unmounted before new mount.
    expect(pickerUnmountSpy).toHaveBeenCalledTimes(1);
  });
});
