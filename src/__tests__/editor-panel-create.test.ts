// src/__tests__/editor-panel-create.test.ts
// Unit tests for quick-create toolbar behavior (Phase 39, Plan 01)
// CANVAS-02: question node creation
// CANVAS-03: answer node creation

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Notice } from 'obsidian';
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
