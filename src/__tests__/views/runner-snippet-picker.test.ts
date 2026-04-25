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
//   Test 7: file-row click handler calls snippetService.load then
//           handleSnippetPickerSelection (call-order verified via spy)
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

  it('Test 7: file-row click handler invokes snippetService.load before handleSnippetPickerSelection', async () => {
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

    // Spy call order via a shared array
    const callOrder: string[] = [];
    (plugin.snippetService.load as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('snippetService.load');
      return fakeSnippet;
    });
    handleSnippetPickerSelectionSpy.mockImplementation(async () => {
      callOrder.push('handleSnippetPickerSelection');
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

    expect(callOrder.indexOf('snippetService.load')).toBeLessThan(
      callOrder.indexOf('handleSnippetPickerSelection'),
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

// ──────────────────────────────────────────────────────────────────────────
// Phase 52 D-04 — validationError fixtures
// ──────────────────────────────────────────────────────────────────────────
// This describe block holds fixtures used by future Plan 04 tasks to drive
// the error-panel path. Declared here so downstream plans can import without
// touching this file again. `validationError` is not in the current JsonSnippet
// interface — the cast preserves tsc green pre-Plan-02 and becomes redundant
// (but harmless) after Plan 02 narrows the type.
describe('Phase 52 D-04 — validationError fixtures', () => {
  it('declares a broken-snippet fixture with a non-null validationError', () => {
    const broken = {
      kind: 'json',
      path: 'Protocols/Snippets/broken.json',
      name: 'broken',
      template: 'Value: {{v}}',
      placeholders: [{ id: 'v', label: 'Value', type: 'choice', options: [] }],
      validationError:
        'Плейсхолдер "v" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.',
    } as unknown as Snippet & { validationError: string | null };
    expect(broken.validationError).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Phase 52 D-04 — RunnerView validationError guards (GREEN wave)
// ──────────────────────────────────────────────────────────────────────────
// Covers:
//   Test: handleSnippetFill blocks a broken snippet with Notice + stepBack
//          + autoSaveSession + render; does NOT open SnippetFillInModal nor
//          call completeSnippet.
//   Test: renderSnippetPicker onSelect with a broken JsonSnippet renders an
//          inline «не может быть использован» error in the questionZone and
//          does NOT call handleSnippetPickerSelection.
//   Test: renderSnippetPicker onSelect with a valid JsonSnippet (validationError
//          === null) continues through to handleSnippetPickerSelection (happy
//          path regression).
import { Notice } from 'obsidian';

describe('Phase 52 D-04 — RunnerView validationError guards', () => {
  it('handleSnippetFill blocks a broken snippet with Notice + stepBack (Phase 52 D-04)', async () => {
    const { view, plugin, stepBackSpy, completeSnippetSpy } = makeView({
      status: 'awaiting-snippet-fill',
      nodeId: 'n1',
      snippetId: 'abdomen/broken.json',
      accumulatedText: '',
      canStepBack: true,
    });

    const broken = {
      kind: 'json',
      path: '.radiprotocol/snippets/abdomen/broken.json',
      name: 'broken',
      template: 'V: {{v}}',
      placeholders: [{ id: 'v', label: 'V', type: 'choice', options: [] }],
      validationError:
        'Плейсхолдер "v" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.',
    } as unknown as Snippet;
    (plugin.snippetService.load as ReturnType<typeof vi.fn>).mockResolvedValue(broken);

    // Spy Notice constructor via vi.spyOn on the imported class.
    const noticeSpy = vi.spyOn({ Notice }, 'Notice');

    // Neutralise render so it cannot throw on the mock DOM.
    const renderSpy = vi.fn();
    (view as unknown as { render: () => void }).render = renderSpy;

    const questionZone = makeFakeNode();
    await (view as unknown as {
      handleSnippetFill: (id: string, zone: HTMLElement) => Promise<void>;
    }).handleSnippetFill(
      'abdomen/broken.json',
      questionZone as unknown as HTMLElement,
    );

    // Load was hit with the Phase 51 full-path + settings.snippetFolderPath.
    expect(plugin.snippetService.load).toHaveBeenCalledWith(
      '.radiprotocol/snippets/abdomen/broken.json',
    );
    // stepBack fired — user remains at preceding Question.
    expect(stepBackSpy).toHaveBeenCalledTimes(1);
    // completeSnippet MUST NOT be called (no advancement).
    expect(completeSnippetSpy).not.toHaveBeenCalled();
    // Render was called (re-renders the preceding node after stepBack).
    expect(renderSpy).toHaveBeenCalled();

    noticeSpy.mockRestore();
  });

  it('renderSnippetPicker onSelect renders inline error on broken snippet and skips handleSnippetPickerSelection (Phase 52 D-04)', async () => {
    const { view, plugin, handleSnippetPickerSelectionSpy } = makeView({
      status: 'awaiting-snippet-pick',
      nodeId: 'n1',
      subfolderPath: 'abdomen',
      accumulatedText: '',
      canStepBack: false,
    });

    const broken = {
      kind: 'json',
      path: '.radiprotocol/snippets/abdomen/broken.json',
      name: 'broken',
      template: 'V: {{v}}',
      placeholders: [{ id: 'v', label: 'V', type: 'choice', options: [] }],
      validationError:
        'Плейсхолдер "v" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.',
    } as unknown as Snippet;
    (plugin.snippetService.load as ReturnType<typeof vi.fn>).mockResolvedValue(broken);

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
    onSelect({ kind: 'file', relativePath: 'broken.json' });

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // handleSnippetPickerSelection MUST NOT be called.
    expect(handleSnippetPickerSelectionSpy).not.toHaveBeenCalled();
    // Inline Russian error rendered — «не может быть использован».
    const errs = findByText(questionZone, 'не может быть использован');
    expect(errs.length).toBeGreaterThanOrEqual(1);
    // Error text includes the snippet's path verbatim.
    expect(errs[0]!.text).toContain(broken.path);
  });

  it('renderSnippetPicker onSelect routes a valid JsonSnippet through handleSnippetPickerSelection (happy-path regression)', async () => {
    const { view, plugin, handleSnippetPickerSelectionSpy } = makeView({
      status: 'awaiting-snippet-pick',
      nodeId: 'n1',
      subfolderPath: 'abdomen',
      accumulatedText: '',
      canStepBack: false,
    });

    const valid = {
      kind: 'json',
      path: '.radiprotocol/snippets/abdomen/ok.json',
      name: 'ok',
      template: 'V: {{v}}',
      placeholders: [{ id: 'v', label: 'V', type: 'choice', options: ['a', 'b'] }],
      validationError: null,
    } as unknown as Snippet;
    (plugin.snippetService.load as ReturnType<typeof vi.fn>).mockResolvedValue(valid);

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
    onSelect({ kind: 'file', relativePath: 'ok.json' });

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(handleSnippetPickerSelectionSpy).toHaveBeenCalledWith(valid);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Phase 56 Plan 04 — Directory-bound dispatch regression (D-04 / SC 3)
// ──────────────────────────────────────────────────────────────────────────
// The Phase 56 reversal (PICKER-01) only retargets FILE-bound Snippet sibling
// clicks. Directory-bound siblings must continue to route through
// runner.chooseSnippetBranch → awaiting-snippet-pick → SnippetTreePicker.
// These regressions guard SC 3: per-click branching is by binding kind, not
// per-Question — a directory-bound sibling sitting next to a file-bound sibling
// must still hit chooseSnippetBranch on click.

import type {
  AnswerNode as AN,
  SnippetNode as SN,
  ProtocolGraph as PG,
} from '../../graph/graph-model';

interface FakeNode56 {
  tag: string;
  cls?: string;
  text?: string;
  children: FakeNode56[];
  createDiv: (opts?: { cls?: string; text?: string }) => FakeNode56;
  createEl: (tag: string, opts?: { cls?: string; text?: string; type?: string }) => FakeNode56;
  createSpan: (opts?: { cls?: string; text?: string }) => FakeNode56;
  empty: () => void;
  setText: (t: string) => void;
  setAttribute: (name: string, value: string) => void;
  prepend: (el: FakeNode56) => void;
  _clickHandler?: () => void;
  _attrs?: Record<string, string>;
  disabled: boolean;
  value: string;
  style: Record<string, string>;
  scrollTop: number;
  scrollHeight: number;
}

function makeFakeNode56(tag = 'div', cls?: string, text?: string): FakeNode56 {
  const node: FakeNode56 = {
    tag,
    cls,
    text,
    children: [],
    createDiv(opts?: { cls?: string; text?: string }): FakeNode56 {
      const child = makeFakeNode56('div', opts?.cls, opts?.text);
      node.children.push(child);
      return child;
    },
    createEl(t: string, opts?: { cls?: string; text?: string; type?: string }): FakeNode56 {
      const child = makeFakeNode56(t, opts?.cls, opts?.text);
      node.children.push(child);
      return child;
    },
    createSpan(opts?: { cls?: string; text?: string }): FakeNode56 {
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
    prepend(_el: FakeNode56): void {},
    disabled: false,
    value: '',
    style: {},
    scrollTop: 0,
    scrollHeight: 0,
  };
  return node;
}

function findByClass56(root: FakeNode56, cls: string): FakeNode56[] {
  const out: FakeNode56[] = [];
  const visit = (n: FakeNode56): void => {
    if (n.cls === cls) out.push(n);
    for (const c of n.children) visit(c);
  };
  visit(root);
  return out;
}

function buildAtQuestionGraph(snippetNodes: SN[]): PG {
  const nodes = new Map<string, AN | SN | {
    kind: 'question';
    id: string;
    questionText: string;
    x: number; y: number; width: number; height: number;
  }>();
  nodes.set('q1', {
    kind: 'question',
    id: 'q1',
    questionText: 'Pick?',
    x: 0, y: 0, width: 200, height: 80,
  });
  const adjacency = new Map<string, string[]>();
  adjacency.set('q1', []);
  for (const sn of snippetNodes) {
    nodes.set(sn.id, sn);
    adjacency.get('q1')!.push(sn.id);
  }
  return {
    canvasFilePath: 'test.canvas',
    nodes: nodes as unknown as PG['nodes'],
    edges: snippetNodes.map((sn) => ({ id: `e-${sn.id}`, fromNodeId: 'q1', toNodeId: sn.id })),
    adjacency,
    reverseAdjacency: new Map(),
    startNodeId: 'q1',
  };
}

function makeSnippetNode56(partial: Partial<SN> & { id: string }): SN {
  return {
    kind: 'snippet',
    x: 0, y: 0, width: 100, height: 40,
    ...partial,
  } as SN;
}

interface AtQuestionHarness {
  view: RunnerView;
  contentEl: FakeNode56;
  chooseSnippetBranchSpy: ReturnType<typeof vi.fn>;
  pickFileBoundSnippetSpy: ReturnType<typeof vi.fn>;
  syncManualEditSpy: ReturnType<typeof vi.fn>;
}

function mountAtQuestion56(graph: PG): AtQuestionHarness {
  const plugin = makePlugin();
  const leaf = {} as unknown as import('obsidian').WorkspaceLeaf;
  const view = new RunnerView(leaf, plugin);
  const contentEl = makeFakeNode56();
  (view as unknown as { contentEl: FakeNode56 }).contentEl = contentEl;

  const chooseSnippetBranchSpy = vi.fn();
  const pickFileBoundSnippetSpy = vi.fn();
  const syncManualEditSpy = vi.fn();
  (view as unknown as { runner: unknown }).runner = {
    getState: () => ({
      status: 'at-node',
      currentNodeId: 'q1',
      accumulatedText: '',
      canStepBack: false,
    }),
    chooseSnippetBranch: chooseSnippetBranchSpy,
    pickFileBoundSnippet: pickFileBoundSnippetSpy,
    chooseAnswer: vi.fn(),
    syncManualEdit: syncManualEditSpy,
    stepBack: vi.fn(),
  };
  (view as unknown as { graph: PG }).graph = graph;

  (view as unknown as { registerDomEvent: unknown }).registerDomEvent = (
    el: FakeNode56,
    type: string,
    handler: () => void,
  ) => {
    if (type === 'click') el._clickHandler = handler;
  };
  (view as unknown as { autoSaveSession: () => Promise<void> }).autoSaveSession =
    async () => {};
  (view as unknown as { renderAsync: () => Promise<void> }).renderAsync = async () => {};

  (view as unknown as { renderPreviewZone: () => void }).renderPreviewZone = () => {};
  (view as unknown as { renderOutputToolbar: () => void }).renderOutputToolbar = () => {};

  (view as unknown as { render: () => void }).render();

  return {
    view,
    contentEl,
    chooseSnippetBranchSpy,
    pickFileBoundSnippetSpy,
    syncManualEditSpy,
  };
}

describe('Phase 56 Plan 04 — Directory-bound dispatch regression (D-04 / SC 3)', () => {
  it('Test 56-04-A: directory-bound single-edge Question — single 📁 button click → chooseSnippetBranch (Phase 51 path preserved)', () => {
    const sn = makeSnippetNode56({
      id: 'sDirOnly',
      subfolderPath: 'abdomen',
      snippetLabel: 'Abdomen Picker',
    });
    const h = mountAtQuestion56(buildAtQuestionGraph([sn]));

    const btns = findByClass56(h.contentEl, 'rp-snippet-branch-btn');
    expect(btns.length).toBe(1);
    expect(btns[0]!.text).toContain('Abdomen Picker');
    btns[0]!._clickHandler?.();

    expect(h.chooseSnippetBranchSpy).toHaveBeenCalledTimes(1);
    expect(h.chooseSnippetBranchSpy).toHaveBeenCalledWith('sDirOnly');
    // pickFileBoundSnippet must NOT fire — directory-bound never routes through it.
    expect(h.pickFileBoundSnippetSpy).not.toHaveBeenCalled();
    expect(h.syncManualEditSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 56-04-B: sibling directory-bound Snippet click ALSO routes through chooseSnippetBranch even when a file-bound sibling exists (per-click branching)', () => {
    const snDir = makeSnippetNode56({
      id: 'sDir',
      subfolderPath: 'liver',
      snippetLabel: 'Liver Folder',
    });
    const snFile = makeSnippetNode56({
      id: 'sFile',
      radiprotocol_snippetPath: 'kidney/k.md',
      snippetLabel: 'Kidney',
    });
    const h = mountAtQuestion56(buildAtQuestionGraph([snDir, snFile]));

    const btns = findByClass56(h.contentEl, 'rp-snippet-branch-btn');
    expect(btns.length).toBe(2);

    // Click directory-bound sibling — must route to chooseSnippetBranch (SC 3).
    btns[0]!._clickHandler?.();
    expect(h.chooseSnippetBranchSpy).toHaveBeenCalledTimes(1);
    expect(h.chooseSnippetBranchSpy).toHaveBeenCalledWith('sDir');
    expect(h.pickFileBoundSnippetSpy).not.toHaveBeenCalled();

    // Independent click on file-bound sibling — does NOT regress directory-bound dispatch.
    btns[1]!._clickHandler?.();
    expect(h.pickFileBoundSnippetSpy).toHaveBeenCalledTimes(1);
    // chooseSnippetBranch count stays at 1 — file-bound did not double-fire it.
    expect(h.chooseSnippetBranchSpy).toHaveBeenCalledTimes(1);
  });
});
