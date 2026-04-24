// src/__tests__/editor-panel-create.test.ts
// Unit tests for quick-create toolbar behavior (Phase 39, Plan 01)
// CANVAS-02: question node creation
// CANVAS-03: answer node creation
// Phase 42: in-memory canvas fallback + empty-type helper hint render path

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Notice, Setting, TFile } from 'obsidian';
import { EditorPanelView } from '../views/editor-panel-view';

vi.mock('obsidian');

function makeCanvasLeaf(filePath: string) {
  return { view: { file: { path: filePath } } };
}

describe('EditorPanelView quick-create', () => {
  let mockPlugin: Record<string, unknown>;
  let mockLeaf: { containerEl: Record<string, unknown> };
  let view: EditorPanelView;

  beforeEach(() => {
    vi.clearAllMocks();

    const canvasLeaf = makeCanvasLeaf('test.canvas');

    mockPlugin = {
      app: {
        vault: {},
        workspace: {
          getLeavesOfType: vi.fn().mockReturnValue([canvasLeaf]),
          getMostRecentLeaf: vi.fn().mockReturnValue(canvasLeaf),
        },
      },
      settings: {},
      canvasNodeFactory: {
        createNode: vi.fn().mockReturnValue(null),
      },
      canvasLiveEditor: {
        saveLive: vi.fn().mockResolvedValue(false),
      },
    };

    mockLeaf = { containerEl: {} };

    view = new EditorPanelView(
      mockLeaf as unknown as import('obsidian').WorkspaceLeaf,
      mockPlugin as unknown as import('../main').default
    );
  });

  it('question button calls factory with question kind', async () => {
    await (view as unknown as { onQuickCreate(kind: string): Promise<void> }).onQuickCreate('question');

    expect((mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode)
      .toHaveBeenCalledWith('test.canvas', 'question', undefined);
  });

  it('answer button calls factory with answer kind', async () => {
    await (view as unknown as { onQuickCreate(kind: string): Promise<void> }).onQuickCreate('answer');

    expect((mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode)
      .toHaveBeenCalledWith('test.canvas', 'answer', undefined);
  });

  it('snippet button calls factory with snippet kind', async () => {
    await (view as unknown as { onQuickCreate(kind: string): Promise<void> }).onQuickCreate('snippet');

    expect((mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode)
      .toHaveBeenCalledWith('test.canvas', 'snippet', undefined);
  });

  it('Phase 64 EDITOR-06: text-block quick-create calls factory with text-block kind', async () => {
    await (view as unknown as { onQuickCreate(kind: 'text-block'): Promise<void> }).onQuickCreate('text-block');

    expect((mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode)
      .toHaveBeenCalledWith('test.canvas', 'text-block', undefined);
  });

  it('passes currentNodeId as anchor when a node is loaded', async () => {
    (view as unknown as { currentNodeId: string }).currentNodeId = 'existing-node-42';
    (view as unknown as { currentFilePath: string }).currentFilePath = 'test.canvas';

    await (view as unknown as { onQuickCreate(kind: string): Promise<void> }).onQuickCreate('question');

    expect((mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode)
      .toHaveBeenCalledWith('test.canvas', 'question', 'existing-node-42');
  });

  it('renders form directly from in-memory node data on successful creation', async () => {
    const mockNodeData = { id: 'new-node-1', radiprotocol_nodeType: 'question' };
    const mockCanvasNode = { getData: vi.fn().mockReturnValue(mockNodeData) };

    (mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode
      .mockReturnValue({ nodeId: 'new-node-1', canvasNode: mockCanvasNode });

    const renderFormSpy = vi.spyOn(
      view as unknown as { renderForm: (nodeRecord: Record<string, unknown>, kind: string | null) => void },
      'renderForm'
    ).mockImplementation(() => {});

    await (view as unknown as { onQuickCreate(kind: string): Promise<void> }).onQuickCreate('question');

    expect(mockCanvasNode.getData).toHaveBeenCalled();
    expect(renderFormSpy).toHaveBeenCalledWith(mockNodeData, 'question');
    expect((view as unknown as { currentNodeId: string }).currentNodeId).toBe('new-node-1');
    expect((view as unknown as { currentFilePath: string }).currentFilePath).toBe('test.canvas');
  });

  it('Phase 64 EDITOR-06: text-block creation renders Text-block form from in-memory node data', async () => {
    const mockNodeData = {
      id: 'new-text-block-1',
      radiprotocol_nodeType: 'text-block',
      radiprotocol_content: 'Created text block',
      text: 'Created text block',
    };
    const mockCanvasNode = { getData: vi.fn().mockReturnValue(mockNodeData) };

    (mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode
      .mockReturnValue({ nodeId: 'new-text-block-1', canvasNode: mockCanvasNode });

    const renderFormSpy = vi.spyOn(
      view as unknown as { renderForm: (nodeRecord: Record<string, unknown>, kind: string | null) => void },
      'renderForm'
    ).mockImplementation(() => {});

    await (view as unknown as { onQuickCreate(kind: 'text-block'): Promise<void> }).onQuickCreate('text-block');

    expect(mockCanvasNode.getData).toHaveBeenCalled();
    expect(renderFormSpy).toHaveBeenCalledWith(mockNodeData, 'text-block');
    expect((view as unknown as { currentNodeId: string }).currentNodeId).toBe('new-text-block-1');
    expect((view as unknown as { currentFilePath: string }).currentFilePath).toBe('test.canvas');
  });

  it('Phase 64 EDITOR-06: toolbar renders an accessible Create text block button wired to quick-create', () => {
    const buttons: Array<{
      cls?: string;
      text: string;
      attrs: Record<string, string>;
      events: Record<string, () => void>;
      disabled?: boolean;
      createSpan: () => Record<string, unknown>;
      appendText: (text: string) => void;
      setAttribute: (name: string, value: string) => void;
    }> = [];

    const toolbar = {
      createEl: (tag: string, opts?: { cls?: string }) => {
        expect(tag).toBe('button');
        const button = {
          cls: opts?.cls,
          text: '',
          attrs: {} as Record<string, string>,
          events: {} as Record<string, () => void>,
          createSpan: () => ({}),
          appendText: (text: string) => { button.text += text; },
          setAttribute: (name: string, value: string) => { button.attrs[name] = value; },
          disabled: false,
        };
        buttons.push(button);
        return button;
      },
    };
    const container = {
      createDiv: (opts?: { cls?: string }) => {
        expect(opts?.cls).toBe('rp-editor-create-toolbar');
        return toolbar;
      },
    };

    Object.defineProperty(view, 'registerDomEvent', {
      value: (target: { events: Record<string, () => void> }, event: string, handler: () => void) => {
        target.events[event] = handler;
      },
      configurable: true,
      writable: true,
    });
    const quickCreateSpy = vi.spyOn(
      view as unknown as { onQuickCreate: (kind: 'text-block') => Promise<void> },
      'onQuickCreate'
    ).mockResolvedValue(undefined);

    (view as unknown as { renderToolbar(container: unknown): void }).renderToolbar(container);

    const textBlockButton = buttons.find(button => button.text === 'Create text block');
    expect(textBlockButton).toBeDefined();
    expect(textBlockButton?.attrs['aria-label']).toBe('Create text block');
    expect(textBlockButton?.attrs['title']).toBe('Create text block');
    expect(textBlockButton?.events['click']).toBeDefined();

    textBlockButton?.events['click']?.();
    expect(quickCreateSpy).toHaveBeenCalledWith('text-block');
  });

  it('does not render form when factory returns null', async () => {
    (mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode
      .mockReturnValue(null);

    const renderFormSpy = vi.spyOn(
      view as unknown as { renderForm: (nodeRecord: Record<string, unknown>, kind: string | null) => void },
      'renderForm'
    ).mockImplementation(() => {});

    await (view as unknown as { onQuickCreate(kind: string): Promise<void> }).onQuickCreate('question');

    expect(renderFormSpy).not.toHaveBeenCalled();
  });

  it('shows Notice when no canvas leaf found', async () => {
    (mockPlugin.app as { workspace: { getLeavesOfType: ReturnType<typeof vi.fn> } })
      .workspace.getLeavesOfType.mockReturnValue([]);

    await (view as unknown as { onQuickCreate(kind: string): Promise<void> }).onQuickCreate('question');

    expect(Notice).toHaveBeenCalledWith('Open a canvas first to create nodes.');
  });

  it('flushes debounce timer before creation', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    (view as unknown as { _debounceTimer: ReturnType<typeof setTimeout> })._debounceTimer =
      setTimeout(() => {}, 99999);
    (view as unknown as { currentFilePath: string }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string }).currentNodeId = 'node-1';

    await (view as unknown as { onQuickCreate(kind: string): Promise<void> }).onQuickCreate('question');

    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});

describe('EditorPanelView duplicate', () => {
  let mockPlugin: Record<string, unknown>;
  let mockLeaf: { containerEl: Record<string, unknown> };
  let view: EditorPanelView;
  let mockCanvas: { nodes: Map<string, unknown>; requestSave: ReturnType<typeof vi.fn> };
  let mockNewNode: { getData: ReturnType<typeof vi.fn>; setData: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    const mockSourceNode = {
      getData: vi.fn().mockReturnValue({
        id: 'src-node-1',
        radiprotocol_nodeType: 'question',
        radiprotocol_questionText: 'What?',
        text: 'Q: What?',
      }),
    };

    mockCanvas = {
      nodes: new Map([['src-node-1', mockSourceNode]]),
      requestSave: vi.fn(),
    };

    const canvasLeaf = {
      view: {
        file: { path: 'test.canvas' },
        canvas: mockCanvas,
      },
    };

    mockNewNode = {
      getData: vi.fn().mockReturnValue({ id: 'new-1' }),
      setData: vi.fn(),
    };

    mockPlugin = {
      app: {
        vault: {},
        workspace: {
          getLeavesOfType: vi.fn().mockReturnValue([canvasLeaf]),
          getMostRecentLeaf: vi.fn().mockReturnValue(canvasLeaf),
        },
      },
      settings: {},
      canvasNodeFactory: {
        createNode: vi.fn().mockReturnValue({ nodeId: 'new-1', canvasNode: mockNewNode }),
      },
      canvasLiveEditor: {
        saveLive: vi.fn().mockResolvedValue(false),
      },
    };

    mockLeaf = { containerEl: {} };

    view = new EditorPanelView(
      mockLeaf as unknown as import('obsidian').WorkspaceLeaf,
      mockPlugin as unknown as import('../main').default
    );

    // Set up loaded node state (onDuplicate guards on these)
    (view as unknown as { currentNodeId: string }).currentNodeId = 'src-node-1';
    (view as unknown as { currentFilePath: string }).currentFilePath = 'test.canvas';
  });

  it('onDuplicate calls factory with source node kind and anchor', async () => {
    const renderFormSpy = vi.spyOn(
      view as unknown as { renderForm: (r: Record<string, unknown>, k: string | null) => void },
      'renderForm'
    ).mockImplementation(() => {});

    await (view as unknown as { onDuplicate(): Promise<void> }).onDuplicate();

    expect((mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode)
      .toHaveBeenCalledWith('test.canvas', 'question', 'src-node-1');

    renderFormSpy.mockRestore();
  });

  it('onDuplicate copies radiprotocol_* properties and text to new node', async () => {
    const renderFormSpy = vi.spyOn(
      view as unknown as { renderForm: (r: Record<string, unknown>, k: string | null) => void },
      'renderForm'
    ).mockImplementation(() => {});

    await (view as unknown as { onDuplicate(): Promise<void> }).onDuplicate();

    expect(mockNewNode.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        radiprotocol_nodeType: 'question',
        radiprotocol_questionText: 'What?',
        text: 'Q: What?',
      })
    );
    // Structural field 'id' from source should NOT be in the copied data directly
    // (it comes from newData spread, which has id: 'new-1', not 'src-node-1')
    const callArgs = mockNewNode.setData.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs['id']).not.toBe('src-node-1');

    renderFormSpy.mockRestore();
  });

  it('onDuplicate loads new node in editor panel', async () => {
    const renderFormSpy = vi.spyOn(
      view as unknown as { renderForm: (r: Record<string, unknown>, k: string | null) => void },
      'renderForm'
    ).mockImplementation(() => {});

    await (view as unknown as { onDuplicate(): Promise<void> }).onDuplicate();

    expect(renderFormSpy).toHaveBeenCalled();
    expect((view as unknown as { currentNodeId: string }).currentNodeId).toBe('new-1');
    expect((view as unknown as { currentFilePath: string }).currentFilePath).toBe('test.canvas');

    renderFormSpy.mockRestore();
  });

  it('onDuplicate shows Notice for untyped node', async () => {
    // Override source node to return data without radiprotocol_nodeType
    const untypedNode = {
      getData: vi.fn().mockReturnValue({ id: 'src-node-1' }),
    };
    mockCanvas.nodes.set('src-node-1', untypedNode);

    await (view as unknown as { onDuplicate(): Promise<void> }).onDuplicate();

    expect(Notice).toHaveBeenCalledWith('Select a RadiProtocol node to duplicate.');
    expect((mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode)
      .not.toHaveBeenCalled();
  });

  it('onDuplicate returns early when no node loaded', async () => {
    (view as unknown as { currentNodeId: string | null }).currentNodeId = null;

    await (view as unknown as { onDuplicate(): Promise<void> }).onDuplicate();

    expect((mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode)
      .not.toHaveBeenCalled();
  });
});

describe('EditorPanelView double-click fallback + empty-type hint', () => {
  let mockPlugin: Record<string, unknown>;
  let mockLeaf: { containerEl: Record<string, unknown> };
  let view: EditorPanelView;
  let mockCanvas: {
    nodes: Map<string, { getData: () => Record<string, unknown> }>;
    requestSave: ReturnType<typeof vi.fn>;
  };
  let mockVault: {
    getAbstractFileByPath: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
  };

  // Phase 48 NODEUI-04: buildKindForm('question') now calls requestAnimationFrame.
  // Install a synchronous polyfill so tests in this describe block don't throw.
  let originalRaf: typeof globalThis.requestAnimationFrame | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalRaf = (globalThis as unknown as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame;
    (globalThis as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number }).requestAnimationFrame =
      (cb: FrameRequestCallback) => { cb(0); return 0; };

    mockCanvas = {
      nodes: new Map(),
      requestSave: vi.fn(),
    };

    const canvasLeaf = {
      view: {
        file: { path: 'test.canvas' },
        canvas: mockCanvas,
      },
    };

    // TFile mock — must be a real TFile instance so the `instanceof TFile` check
    // inside renderNodeForm passes. Default: disk JSON has no matching node.
    // The real Obsidian TFile constructor takes no args; our mock accepts an
    // optional path, so use `Object.assign` to attach the path without violating
    // the public type signature.
    const tfile = Object.assign(new TFile(), { path: 'test.canvas' });
    mockVault = {
      getAbstractFileByPath: vi.fn().mockReturnValue(tfile),
      read: vi.fn().mockResolvedValue(JSON.stringify({ nodes: [], edges: [] })),
    };

    mockPlugin = {
      app: {
        vault: mockVault,
        workspace: {
          getLeavesOfType: vi.fn().mockReturnValue([canvasLeaf]),
          getMostRecentLeaf: vi.fn().mockReturnValue(canvasLeaf),
        },
      },
      settings: {},
      canvasNodeFactory: { createNode: vi.fn() },
      canvasLiveEditor: { saveLive: vi.fn().mockResolvedValue(false) },
    };

    mockLeaf = { containerEl: {} };

    view = new EditorPanelView(
      mockLeaf as unknown as import('obsidian').WorkspaceLeaf,
      mockPlugin as unknown as import('../main').default
    );

    // The obsidian mock's ItemView constructor is auto-stubbed by vi.mock (no body
    // runs), so view.contentEl is undefined by default. Inject a minimal fake that
    // satisfies .empty() for renderNodeForm. Tests C and D replace this with a
    // richer capturing fake before calling renderForm directly.
    (view as unknown as { contentEl: { empty: () => void } }).contentEl = {
      empty: () => {},
    };

    // Phase 48 NODEUI-04: buildKindForm('question') calls this.registerDomEvent.
    // The obsidian ItemView mock does not provide it — stub it as a no-op.
    (view as unknown as { registerDomEvent: (...args: unknown[]) => void })
      .registerDomEvent = () => {};

    // vi.mock('obsidian') auto-stubs Setting prototype methods to return undefined,
    // breaking the `.setName(...).setDesc(...).addDropdown(...)` chain used by
    // renderForm. Patch the prototype to return `this` and invoke the dropdown cb
    // with a chainable mock so renderForm can execute end-to-end.
    const SettingProto = Setting.prototype as unknown as Record<string, unknown>;
    SettingProto.setName = vi.fn(function (this: unknown) { return this; });
    SettingProto.setDesc = vi.fn(function (this: unknown) { return this; });
    SettingProto.setHeading = vi.fn(function (this: unknown) { return this; });
    const mockDrop = {
      addOption: vi.fn(function (this: unknown) { return this; }),
      setValue: vi.fn(function (this: unknown) { return this; }),
      onChange: vi.fn(function (this: unknown) { return this; }),
    };
    SettingProto.addDropdown = vi.fn(function (this: unknown, cb: (drop: unknown) => void) {
      cb(mockDrop);
      return this;
    });
  });

  afterEach(() => {
    if (originalRaf === undefined) {
      delete (globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame;
    } else {
      (globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame = originalRaf;
    }
  });

  it('renderNodeForm uses in-memory canvas data when disk JSON lacks the node', async () => {
    const liveData = { id: 'dcc-node-1' };
    mockCanvas.nodes.set('dcc-node-1', { getData: () => liveData });

    const renderFormSpy = vi.spyOn(
      view as unknown as { renderForm: (r: Record<string, unknown>, k: string | null) => void },
      'renderForm'
    ).mockImplementation(() => {});
    const renderErrorSpy = vi.spyOn(
      view as unknown as { renderError: (m: string) => void },
      'renderError'
    ).mockImplementation(() => {});

    await (view as unknown as { renderNodeForm(f: string, n: string): Promise<void> })
      .renderNodeForm('test.canvas', 'dcc-node-1');

    expect(renderFormSpy).toHaveBeenCalledWith(liveData, null);
    expect(renderErrorSpy).not.toHaveBeenCalled();

    renderFormSpy.mockRestore();
    renderErrorSpy.mockRestore();
  });

  it('renderNodeForm calls renderError when disk AND in-memory both miss', async () => {
    // canvas.nodes already empty by default; disk read returns empty nodes array
    const renderErrorSpy = vi.spyOn(
      view as unknown as { renderError: (m: string) => void },
      'renderError'
    ).mockImplementation(() => {});

    await (view as unknown as { renderNodeForm(f: string, n: string): Promise<void> })
      .renderNodeForm('test.canvas', 'ghost-node');

    expect(renderErrorSpy).toHaveBeenCalledWith(
      'Node not found in canvas — it may have been deleted.'
    );

    renderErrorSpy.mockRestore();
  });

  it('renderForm emits .rp-editor-type-hint when currentKind is null', () => {
    const createdElements: Array<{ tag: string; cls?: string; text?: string }> = [];

    const fakeNode = (): Record<string, unknown> => {
      const self: Record<string, unknown> = {
        empty: () => {},
        createDiv: (_opts?: { cls?: string }) => fakeNode(),
        createEl: (tag: string, opts?: { cls?: string; text?: string }) => {
          createdElements.push({ tag, cls: opts?.cls, text: opts?.text });
          return fakeNode();
        },
        createSpan: () => fakeNode(),
        setAttribute: () => {},
        appendText: () => {},
        addClass: () => {},
        removeClass: () => {},
        setText: () => {},
        disabled: false,
      };
      return self;
    };

    (view as unknown as { contentEl: Record<string, unknown> }).contentEl = fakeNode();

    // Stub renderToolbar so it doesn't try to call setIcon / registerDomEvent
    vi.spyOn(
      view as unknown as { renderToolbar: (c: unknown) => void },
      'renderToolbar'
    ).mockImplementation(() => {});

    (view as unknown as { renderForm(r: Record<string, unknown>, k: string | null): void })
      .renderForm({ id: 'n1' }, null);

    const hint = createdElements.find(e => e.cls === 'rp-editor-type-hint');
    expect(hint).toBeDefined();
    expect(hint?.text).toBe('Select a node type to configure this node');
    expect(hint?.tag).toBe('p');
  });

  it('renderForm does NOT emit .rp-editor-type-hint when currentKind is set', () => {
    const createdElements: Array<{ tag: string; cls?: string }> = [];
    const fakeNode = (): Record<string, unknown> => {
      const self: Record<string, unknown> = {
        empty: () => {},
        createDiv: (_opts?: { cls?: string }) => fakeNode(),
        createEl: (tag: string, opts?: { cls?: string }) => {
          createdElements.push({ tag, cls: opts?.cls });
          const child = fakeNode();
          // Phase 48 NODEUI-04: buildKindForm('question') creates a textarea and
          // requestAnimationFrame (now synchronous polyfill) sets style.height.
          // Attach a style stub so the height assignment doesn't throw.
          if (tag === 'textarea') {
            (child as Record<string, unknown>).style = { height: '' };
            (child as Record<string, unknown>).scrollHeight = 0;
            (child as Record<string, unknown>).value = '';
          }
          return child;
        },
        createSpan: () => fakeNode(),
        setAttribute: () => {},
        appendText: () => {},
        addClass: () => {},
        removeClass: () => {},
        setText: () => {},
        disabled: false,
      };
      return self;
    };

    (view as unknown as { contentEl: Record<string, unknown> }).contentEl = fakeNode();
    vi.spyOn(
      view as unknown as { renderToolbar: (c: unknown) => void },
      'renderToolbar'
    ).mockImplementation(() => {});

    (view as unknown as { renderForm(r: Record<string, unknown>, k: string | null): void })
      .renderForm({ id: 'n1', radiprotocol_nodeType: 'question' }, 'question');

    expect(createdElements.find(e => e.cls === 'rp-editor-type-hint')).toBeUndefined();
  });
});

describe('EditorPanelView double-click auto-select (gap closure)', () => {
  let mockPlugin: Record<string, unknown>;
  let mockLeaf: { containerEl: Record<string, unknown> };
  let view: EditorPanelView;
  let fakeContainer: Record<string, unknown>;
  let fakeCanvas: { selection?: Set<{ id: string }> };
  let canvasLeaf: {
    containerEl: Record<string, unknown>;
    view: { file?: { path: string }; canvas: typeof fakeCanvas };
  };
  let registeredEvents: Array<{ target: unknown; event: string; handler: () => void }>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    fakeCanvas = { selection: new Set() };
    fakeContainer = {};
    canvasLeaf = {
      containerEl: fakeContainer,
      view: {
        file: { path: 'test.canvas' },
        canvas: fakeCanvas,
      },
    };

    mockPlugin = {
      app: {
        vault: {},
        workspace: {
          getLeavesOfType: vi.fn().mockReturnValue([canvasLeaf]),
          getMostRecentLeaf: vi.fn().mockReturnValue(canvasLeaf),
        },
      },
      settings: {},
      canvasNodeFactory: { createNode: vi.fn() },
      canvasLiveEditor: { saveLive: vi.fn().mockResolvedValue(false) },
      ensureEditorPanelVisible: vi.fn().mockResolvedValue(undefined),
    };

    mockLeaf = { containerEl: {} };

    view = new EditorPanelView(
      mockLeaf as unknown as import('obsidian').WorkspaceLeaf,
      mockPlugin as unknown as import('../main').default
    );

    // Capture registerDomEvent calls — EditorPanelView extends ItemView which
    // provides registerDomEvent; replace with a capturing spy for the test.
    // vi.mock('obsidian') auto-stubs ItemView so registerDomEvent may not be
    // a writable prototype property — use Object.defineProperty for safety.
    registeredEvents = [];
    Object.defineProperty(view, 'registerDomEvent', {
      value: (target: unknown, event: string, handler: () => void) => {
        registeredEvents.push({ target, event, handler });
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deferred selection read invokes handleNodeClick when node appears after setTimeout(0)', () => {
    const handleNodeClickSpy = vi
      .spyOn(
        view as unknown as { handleNodeClick: (f: string, n: string) => Promise<void> },
        'handleNodeClick'
      )
      .mockResolvedValue(undefined);

    (view as unknown as { attachCanvasListener: () => void }).attachCanvasListener();

    // Find the registered 'click' handler
    const clickReg = registeredEvents.find(r => r.event === 'click');
    expect(clickReg).toBeDefined();

    // Simulate: at event-time selection is still empty (Obsidian hasn't updated yet)
    fakeCanvas.selection = new Set();
    clickReg!.handler();

    // Now Obsidian updates selection (happens inside the deferred tick)
    fakeCanvas.selection = new Set([{ id: 'newly-created-node' }]);

    // Tick the setTimeout(0)
    vi.advanceTimersByTime(0);

    expect(handleNodeClickSpy).toHaveBeenCalledTimes(1);
    expect(handleNodeClickSpy).toHaveBeenCalledWith('test.canvas', 'newly-created-node');
  });

  it('deferred read does NOT call handleNodeClick when selection stays empty', () => {
    const handleNodeClickSpy = vi
      .spyOn(
        view as unknown as { handleNodeClick: (f: string, n: string) => Promise<void> },
        'handleNodeClick'
      )
      .mockResolvedValue(undefined);

    (view as unknown as { attachCanvasListener: () => void }).attachCanvasListener();

    const clickReg = registeredEvents.find(r => r.event === 'click');
    fakeCanvas.selection = new Set();
    clickReg!.handler();
    vi.advanceTimersByTime(0);

    expect(handleNodeClickSpy).not.toHaveBeenCalled();
  });

  it('deferred read ignores multi-select', () => {
    const handleNodeClickSpy = vi
      .spyOn(
        view as unknown as { handleNodeClick: (f: string, n: string) => Promise<void> },
        'handleNodeClick'
      )
      .mockResolvedValue(undefined);

    (view as unknown as { attachCanvasListener: () => void }).attachCanvasListener();

    const clickReg = registeredEvents.find(r => r.event === 'click');
    clickReg!.handler();
    fakeCanvas.selection = new Set([{ id: 'a' }, { id: 'b' }]);
    vi.advanceTimersByTime(0);

    expect(handleNodeClickSpy).not.toHaveBeenCalled();
  });

  it('registers BOTH click and dblclick on the canvas container', () => {
    (view as unknown as { attachCanvasListener: () => void }).attachCanvasListener();

    const clickRegs = registeredEvents.filter(
      r => r.event === 'click' && r.target === fakeContainer
    );
    const dblclickRegs = registeredEvents.filter(
      r => r.event === 'dblclick' && r.target === fakeContainer
    );

    expect(clickRegs.length).toBeGreaterThanOrEqual(1);
    expect(dblclickRegs.length).toBeGreaterThanOrEqual(1);
    // Same handler reused for both events
    expect(clickRegs[0]!.handler).toBe(dblclickRegs[0]!.handler);
  });
});
