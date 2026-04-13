// src/__tests__/canvas-write-back.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorPanelView } from '../views/editor-panel-view';

vi.mock('obsidian');

// Minimal canvas JSON with one node
function makeCanvasJson(nodeExtra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    nodes: [{ id: 'node-1', x: 10, y: 20, width: 100, height: 50, type: 'text', ...nodeExtra }],
    edges: [],
  });
}

describe('saveNodeEdits — write-back contract (EDIT-03, EDIT-04)', () => {
  let mockVaultRead: ReturnType<typeof vi.fn>;
  let mockVaultModify: ReturnType<typeof vi.fn>;
  let mockGetLeavesOfType: ReturnType<typeof vi.fn>;
  let mockGetAbstractFileByPath: ReturnType<typeof vi.fn>;
  let mockSaveLive: ReturnType<typeof vi.fn>;
  let mockPlugin: Record<string, unknown>;
  let view: EditorPanelView;

  beforeEach(() => {
    mockVaultRead = vi.fn().mockResolvedValue(makeCanvasJson());
    mockVaultModify = vi.fn().mockResolvedValue(undefined);
    mockGetLeavesOfType = vi.fn().mockReturnValue([]); // canvas not open by default
    mockGetAbstractFileByPath = vi.fn().mockReturnValue({ path: 'test.canvas' }); // TFile mock
    // LIVE-03: saveLive returns false = canvas closed, fall through to vault.modify()
    mockSaveLive = vi.fn().mockResolvedValue(false);

    mockPlugin = {
      app: {
        vault: {
          read: mockVaultRead,
          modify: mockVaultModify,
          getAbstractFileByPath: mockGetAbstractFileByPath,
        },
        workspace: {
          getLeavesOfType: mockGetLeavesOfType,
          getMostRecentLeaf: vi.fn().mockReturnValue(null),
        },
      },
      settings: {},
      canvasLiveEditor: {
        saveLive: mockSaveLive,
      },
    };

    const mockLeaf = { containerEl: {} };
    view = new EditorPanelView(
      mockLeaf as unknown as import('obsidian').WorkspaceLeaf,
      mockPlugin as unknown as import('../main').default
    );
  });

  // Phase 28: color is always written correctly for known types (NODE-COLOR-01, NODE-COLOR-02)
  // Replaces old "color are never written" contract (D-03)

  it('TYPE-CHANGE: radiprotocol_nodeType question → color "5" written in canvas JSON (NODE-COLOR-01)', async () => {
    await view.saveNodeEdits('test.canvas', 'node-1', {
      radiprotocol_nodeType: 'question',
    });
    expect(mockVaultModify).toHaveBeenCalled();
    const written = JSON.parse(mockVaultModify.mock.calls[0]![1] as string) as {
      nodes: Array<Record<string, unknown>>;
    };
    const node = written.nodes[0];
    expect(node?.['color']).toBe('5');
  });

  it('TYPE-CHANGE: radiprotocol_nodeType start → color "4" written in canvas JSON (NODE-COLOR-01)', async () => {
    await view.saveNodeEdits('test.canvas', 'node-1', {
      radiprotocol_nodeType: 'start',
    });
    expect(mockVaultModify).toHaveBeenCalled();
    const written = JSON.parse(mockVaultModify.mock.calls[0]![1] as string) as {
      nodes: Array<Record<string, unknown>>;
    };
    const node = written.nodes[0];
    expect(node?.['color']).toBe('4');
  });

  it('FIELD-ONLY: saving non-type field on already-typed node writes correct color (NODE-COLOR-02)', async () => {
    // Node already has radiprotocol_nodeType: 'question' in canvas JSON
    mockVaultRead.mockResolvedValueOnce(
      makeCanvasJson({ radiprotocol_nodeType: 'question' })
    );
    await view.saveNodeEdits('test.canvas', 'node-1', {
      radiprotocol_questionText: 'What is the finding?',
    });
    expect(mockVaultModify).toHaveBeenCalled();
    const written = JSON.parse(mockVaultModify.mock.calls[0]![1] as string) as {
      nodes: Array<Record<string, unknown>>;
    };
    const node = written.nodes[0];
    expect(node?.['color']).toBe('5');
  });

  it('OVERWRITE: node had wrong color — saving overwrites with correct color for type (NODE-COLOR-02)', async () => {
    // Node has wrong color '6' (purple) but is a 'question' node (should be '5' cyan)
    mockVaultRead.mockResolvedValueOnce(
      makeCanvasJson({ radiprotocol_nodeType: 'question', color: '6' })
    );
    await view.saveNodeEdits('test.canvas', 'node-1', {
      radiprotocol_questionText: 'x',
    });
    expect(mockVaultModify).toHaveBeenCalled();
    const written = JSON.parse(mockVaultModify.mock.calls[0]![1] as string) as {
      nodes: Array<Record<string, unknown>>;
    };
    const node = written.nodes[0];
    expect(node?.['color']).toBe('5');
  });

  it('UNKNOWN TYPE: radiprotocol_nodeType not in NODE_COLOR_MAP → color NOT written (D-05)', async () => {
    await view.saveNodeEdits('test.canvas', 'node-1', {
      radiprotocol_nodeType: 'custom-unknown',
    });
    expect(mockVaultModify).toHaveBeenCalled();
    const written = JSON.parse(mockVaultModify.mock.calls[0]![1] as string) as {
      nodes: Array<Record<string, unknown>>;
    };
    const node = written.nodes[0];
    expect(node?.['color']).toBeUndefined();
  });

  it('radiprotocol_* fields are written to canvas JSON via vault.modify()', async () => {
    await view.saveNodeEdits('test.canvas', 'node-1', {
      radiprotocol_nodeType: 'question',
      radiprotocol_questionText: 'What is the finding?',
    });
    // saveLive returns false → falls through to vault.modify()
    expect(mockVaultModify).toHaveBeenCalled();
    const written = JSON.parse(mockVaultModify.mock.calls[0]![1] as string) as {
      nodes: Array<Record<string, unknown>>;
    };
    const node = written.nodes[0];
    expect(node?.['radiprotocol_nodeType']).toBe('question');
    expect(node?.['radiprotocol_questionText']).toBe('What is the finding?');
  });

  it('undefined values delete the key from the node', async () => {
    mockVaultRead.mockResolvedValue(
      makeCanvasJson({ radiprotocol_displayLabel: 'old-label' })
    );
    await view.saveNodeEdits('test.canvas', 'node-1', {
      radiprotocol_displayLabel: undefined,
    });
    // saveLive returns false → falls through to vault.modify()
    expect(mockVaultModify).toHaveBeenCalled();
    const written = JSON.parse(mockVaultModify.mock.calls[0]![1] as string) as {
      nodes: Array<Record<string, unknown>>;
    };
    const node = written.nodes[0];
    expect(node).not.toHaveProperty('radiprotocol_displayLabel');
  });

  it('live-save: vault.modify() NOT called when saveLive() returns true; saveLive receives enriched edits with color (NODE-COLOR-01)', async () => {
    // Simulate canvas open: saveLive returns true (live save succeeded)
    mockSaveLive.mockResolvedValue(true);
    await view.saveNodeEdits('test.canvas', 'node-1', {
      radiprotocol_nodeType: 'question',
    });
    // Live path: vault.modify() must NOT be called — canvas owns the write
    expect(mockVaultModify).not.toHaveBeenCalled();
    // Phase 28: saveLive receives enriched edits including color injected by saveNodeEdits (D-01, D-02)
    expect(mockSaveLive).toHaveBeenCalledWith('test.canvas', 'node-1', {
      radiprotocol_nodeType: 'question',
      color: '5',
    });
  });

  it('un-mark cleanup: removing nodeType (empty string) removes all radiprotocol_* fields', async () => {
    mockVaultRead.mockResolvedValue(
      makeCanvasJson({
        radiprotocol_nodeType: 'question',
        radiprotocol_questionText: 'Old question?',
      })
    );
    await view.saveNodeEdits('test.canvas', 'node-1', {
      radiprotocol_nodeType: '',
    });
    // saveLive returns false → falls through to vault.modify()
    expect(mockVaultModify).toHaveBeenCalled();
    const written = JSON.parse(mockVaultModify.mock.calls[0]![1] as string) as {
      nodes: Array<Record<string, unknown>>;
    };
    const node = written.nodes[0];
    expect(node).not.toHaveProperty('radiprotocol_nodeType');
    expect(node).not.toHaveProperty('radiprotocol_questionText');
  });
});
