// src/__tests__/editor-panel.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import the stub (will be replaced by full implementation in Plan 01)
import { EditorPanelView, EDITOR_PANEL_VIEW_TYPE } from '../views/editor-panel-view';

// Mock obsidian module (same pattern as RunnerView.test.ts)
vi.mock('obsidian');

describe('EditorPanelView', () => {
  let mockLeaf: { containerEl: Record<string, unknown> };
  let mockPlugin: { app: { vault: object; workspace: object }; settings: object };
  let view: EditorPanelView;

  beforeEach(() => {
    // Create a minimal mock WorkspaceLeaf (plain object — no DOM needed in node environment)
    mockLeaf = { containerEl: {} };
    // Create a minimal plugin mock
    mockPlugin = {
      app: {
        vault: {},
        workspace: { getLeavesOfType: vi.fn().mockReturnValue([]) },
      },
      settings: {},
    };
    // Instantiate — constructor receives (leaf, plugin) after Plan 01 update
    // During Wave 0 (current stub), constructor only takes (leaf) — stub test accordingly:
    view = new EditorPanelView(
      mockLeaf as unknown as import('obsidian').WorkspaceLeaf,
      mockPlugin as unknown as import('../main').default
    );
  });

  describe('view metadata', () => {
    it('EDITOR_PANEL_VIEW_TYPE is radiprotocol-editor-panel', () => {
      expect(EDITOR_PANEL_VIEW_TYPE).toBe('radiprotocol-editor-panel');
    });

    it('getViewType returns EDITOR_PANEL_VIEW_TYPE', () => {
      expect(view.getViewType()).toBe(EDITOR_PANEL_VIEW_TYPE);
    });

    it('getDisplayText returns RadiProtocol node editor (sentence case)', () => {
      expect(view.getDisplayText()).toBe('RadiProtocol node editor');
    });

    it('getIcon returns pencil', () => {
      expect(view.getIcon()).toBe('pencil');
    });
  });

  describe('loadNode API', () => {
    it('loadNode method exists', () => {
      expect(typeof view.loadNode).toBe('function');
    });

    it('loadNode accepts filePath and nodeId without throwing', () => {
      expect(() => {
        view.loadNode('test/protocol.canvas', 'node-abc-123');
      }).not.toThrow();
    });
  });

  describe('saveNodeEdits API', () => {
    it('saveNodeEdits method exists', () => {
      expect(typeof view.saveNodeEdits).toBe('function');
    });
  });
});

describe('auto-save behaviour', () => {
  let view: EditorPanelView;
  let mockSaveNodeEdits: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    const mockLeaf = { containerEl: {} };
    const mockPlugin = {
      app: {
        vault: {
          getAbstractFileByPath: vi.fn().mockReturnValue(null),
          read: vi.fn().mockResolvedValue('{}'),
        },
        workspace: { getLeavesOfType: vi.fn().mockReturnValue([]) },
      },
      settings: {},
      canvasLiveEditor: { saveLive: vi.fn().mockResolvedValue(false) },
    };
    view = new EditorPanelView(
      mockLeaf as unknown as import('obsidian').WorkspaceLeaf,
      mockPlugin as unknown as import('../main').default
    );
    // Spy on saveNodeEdits — replace with a mock that resolves immediately
    mockSaveNodeEdits = vi.fn().mockResolvedValue(undefined);
    view.saveNodeEdits = mockSaveNodeEdits as unknown as typeof view.saveNodeEdits;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to set internal state directly (avoids needing renderForm with vault mocks)
  function setViewState(filePath: string, nodeId: string, edits: Record<string, unknown>) {
    (view as unknown as Record<string, unknown>)['currentFilePath'] = filePath;
    (view as unknown as Record<string, unknown>)['currentNodeId'] = nodeId;
    (view as unknown as Record<string, unknown>)['pendingEdits'] = edits;
  }

  it('23-01-01: scheduleAutoSave fires saveNodeEdits after 1000ms with captured snapshot', async () => {
    setViewState('test.canvas', 'node-1', { radiprotocol_questionText: 'hello' });
    (view as unknown as { scheduleAutoSave(): void }).scheduleAutoSave();
    expect(mockSaveNodeEdits).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockSaveNodeEdits).toHaveBeenCalledOnce();
    expect(mockSaveNodeEdits).toHaveBeenCalledWith(
      'test.canvas',
      'node-1',
      { radiprotocol_questionText: 'hello' }
    );
  });

  it('23-01-02: snapshot captures filePath/nodeId/edits at schedule time, not fire time', async () => {
    setViewState('canvas-A.canvas', 'node-1', { radiprotocol_questionText: 'first' });
    (view as unknown as { scheduleAutoSave(): void }).scheduleAutoSave();
    // Mutate state AFTER scheduling — timer should use captured values
    setViewState('canvas-B.canvas', 'node-2', { radiprotocol_questionText: 'second' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockSaveNodeEdits).toHaveBeenCalledWith(
      'canvas-A.canvas',
      'node-1',
      { radiprotocol_questionText: 'first' }
    );
  });

  it('23-01-03: type dropdown onChange cancels debounce and saves immediately with color', async () => {
    setViewState('test.canvas', 'node-1', { radiprotocol_questionText: 'hello' });
    (view as unknown as { scheduleAutoSave(): void }).scheduleAutoSave();
    // Trigger type change — this should cancel the timer and fire immediately
    (view as unknown as { pendingEdits: Record<string, unknown> }).pendingEdits['radiprotocol_nodeType'] = 'question';
    (view as unknown as { onTypeDropdownChange(value: string): void }).onTypeDropdownChange('question');
    // No timer advance — should have fired synchronously (or as microtask)
    await Promise.resolve();
    expect(mockSaveNodeEdits).toHaveBeenCalledOnce();
    const callArgs = mockSaveNodeEdits.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(callArgs[2]).toMatchObject({ color: '5' }); // NODE_COLOR_MAP['question'] = '5'
    // Timer should be cleared
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockSaveNodeEdits).toHaveBeenCalledOnce(); // still just one call
  });

  it('23-01-04: node switch while debounce pending flushes first node before loading second', async () => {
    setViewState('A.canvas', 'node-1', { radiprotocol_questionText: 'first' });
    (view as unknown as { scheduleAutoSave(): void }).scheduleAutoSave();
    // Switch to a different node
    await (view as unknown as { handleNodeClick(fp: string, id: string): Promise<void> })
      .handleNodeClick('B.canvas', 'node-2');
    // saveNodeEdits should have been called for the FIRST node immediately (flush)
    expect(mockSaveNodeEdits).toHaveBeenCalledWith(
      'A.canvas',
      'node-1',
      expect.objectContaining({ radiprotocol_questionText: 'first' })
    );
    // And navigation proceeded: currentFilePath updated to B.canvas
    expect((view as unknown as { currentFilePath: string }).currentFilePath).toBe('B.canvas');
  });

  it('23-01-05: flush save failure does not block node switch (D-03)', async () => {
    mockSaveNodeEdits.mockRejectedValueOnce(new Error('write failed'));
    setViewState('A.canvas', 'node-1', { x: 'y' });
    (view as unknown as { scheduleAutoSave(): void }).scheduleAutoSave();
    // Should not throw even though saveNodeEdits rejects
    await expect(
      (view as unknown as { handleNodeClick(fp: string, id: string): Promise<void> })
        .handleNodeClick('B.canvas', 'node-2')
    ).resolves.not.toThrow();
    // Navigation still proceeded
    expect((view as unknown as { currentFilePath: string }).currentFilePath).toBe('B.canvas');
  });

  it('23-01-06: showSavedIndicator adds is-visible; removed after 2000ms', () => {
    // Create a minimal element mock with addClass/removeClass tracking
    const classes = new Set<string>();
    const mockIndicatorEl = {
      addClass: (cls: string) => classes.add(cls),
      removeClass: (cls: string) => classes.delete(cls),
    };
    (view as unknown as { _savedIndicatorEl: unknown })._savedIndicatorEl = mockIndicatorEl;
    (view as unknown as { showSavedIndicator(): void }).showSavedIndicator();
    expect(classes.has('is-visible')).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(classes.has('is-visible')).toBe(false);
  });

  it('23-01-07: Notice is NOT called during auto-save flow', async () => {
    const { Notice } = await import('obsidian');
    setViewState('test.canvas', 'node-1', { radiprotocol_questionText: 'test' });
    (view as unknown as { scheduleAutoSave(): void }).scheduleAutoSave();
    await vi.advanceTimersByTimeAsync(1000);
    // Notice should NOT have been instantiated
    expect(Notice).not.toHaveBeenCalled();
  });
});
