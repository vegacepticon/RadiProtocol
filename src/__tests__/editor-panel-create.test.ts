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
