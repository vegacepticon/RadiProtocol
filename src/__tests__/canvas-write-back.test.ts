// src/__tests__/canvas-write-back.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorPanelView } from '../views/editor-panel-view';
import { CanvasLiveEditor } from '../canvas/canvas-live-editor';

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

// Phase 50: CanvasLiveEditor edge-write surface (saveLiveEdges + saveLiveBatch with edgeEdits).
// Round-trip tests asserting D-08 strip-key semantics and D-14 single-setData atomicity.
// Uses a hand-rolled CanvasViewInternal mock (no full EditorPanelView needed because
// the wire-up of displayLabel → incoming edges lives in Plan 04).
describe('PHASE-50 CanvasLiveEditor edge writes (D-08 / D-12 / D-14)', () => {
  // Minimal CanvasViewInternal-compatible mock. Mirrors the shape consumed by
  // CanvasLiveEditor.getCanvasView (src/canvas/canvas-live-editor.ts:29-47).
  function buildMockLiveEditor(params: {
    filePath: string;
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  }): {
    editor: CanvasLiveEditor;
    setDataSpy: ReturnType<typeof vi.fn>;
    requestSaveSpy: ReturnType<typeof vi.fn>;
  } {
    const data = { nodes: [...params.nodes], edges: [...params.edges] };
    const setDataSpy = vi.fn((next: { nodes: unknown[]; edges: unknown[] }) => {
      data.nodes = next.nodes as Array<Record<string, unknown>>;
      data.edges = next.edges as Array<Record<string, unknown>>;
    });
    const requestSaveSpy = vi.fn();
    const mockView = {
      file: { path: params.filePath },
      canvas: {
        getData: () => ({
          nodes: data.nodes.map((n) => ({ ...n })), // deep-enough copy for Pattern B semantics
          edges: data.edges.map((e) => ({ ...e })),
        }),
        setData: setDataSpy,
        requestSave: requestSaveSpy,
        nodes: new Map(),
      },
    };
    const mockApp = {
      workspace: {
        getLeavesOfType: (t: string) => (t === 'canvas' ? [{ view: mockView }] : []),
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = new CanvasLiveEditor(mockApp as any);
    return { editor, setDataSpy, requestSaveSpy };
  }

  it('saveLiveEdges deletes the "label" key when label === undefined (D-08)', async () => {
    const { editor, setDataSpy } = buildMockLiveEditor({
      filePath: 'test.canvas',
      nodes: [{ id: 'n-q' }, { id: 'n-a' }],
      edges: [{ id: 'e1', fromNode: 'n-q', toNode: 'n-a', label: 'old' }],
    });
    const ok = await editor.saveLiveEdges('test.canvas', [{ edgeId: 'e1', label: undefined }]);
    expect(ok).toBe(true);
    expect(setDataSpy).toHaveBeenCalledTimes(1);
    const written = setDataSpy.mock.calls[0]![0] as { edges: Array<Record<string, unknown>> };
    expect(written.edges[0]).not.toHaveProperty('label');
  });

  it('saveLiveEdges sets the "label" key when label is a string (D-04 forward)', async () => {
    const { editor, setDataSpy } = buildMockLiveEditor({
      filePath: 'test.canvas',
      nodes: [{ id: 'n-q' }, { id: 'n-a' }],
      edges: [{ id: 'e1', fromNode: 'n-q', toNode: 'n-a' }],
    });
    const ok = await editor.saveLiveEdges('test.canvas', [{ edgeId: 'e1', label: 'Новое' }]);
    expect(ok).toBe(true);
    const written = setDataSpy.mock.calls[0]![0] as { edges: Array<Record<string, unknown>> };
    expect(written.edges[0]!['label']).toBe('Новое');
  });

  it('saveLiveBatch writes node edits + edge edits in ONE setData call (D-14 atomicity)', async () => {
    const { editor, setDataSpy } = buildMockLiveEditor({
      filePath: 'test.canvas',
      nodes: [
        { id: 'n-q', radiprotocol_nodeType: 'question' },
        { id: 'n-a', radiprotocol_nodeType: 'answer', radiprotocol_displayLabel: 'Старое' },
      ],
      edges: [{ id: 'e1', fromNode: 'n-q', toNode: 'n-a', label: 'Старое' }],
    });
    const ok = await editor.saveLiveBatch(
      'test.canvas',
      [{ nodeId: 'n-a', edits: { radiprotocol_displayLabel: 'Новое' } }],
      [{ edgeId: 'e1', label: 'Новое' }],
    );
    expect(ok).toBe(true);
    expect(setDataSpy).toHaveBeenCalledTimes(1); // D-14: atomic single write — never two setData
    const written = setDataSpy.mock.calls[0]![0] as {
      nodes: Array<Record<string, unknown>>;
      edges: Array<Record<string, unknown>>;
    };
    const answer = written.nodes.find((n) => n['id'] === 'n-a');
    const edge = written.edges.find((e) => e['id'] === 'e1');
    expect(answer!['radiprotocol_displayLabel']).toBe('Новое');
    expect(edge!['label']).toBe('Новое');
  });

  it('saveLiveBatch first-pass-validate rejects entire batch if an edgeId is missing (no partial mutation)', async () => {
    const { editor, setDataSpy } = buildMockLiveEditor({
      filePath: 'test.canvas',
      nodes: [{ id: 'n-a' }],
      edges: [{ id: 'e1', fromNode: 'q', toNode: 'n-a' }],
    });
    const ok = await editor.saveLiveBatch(
      'test.canvas',
      [{ nodeId: 'n-a', edits: { radiprotocol_displayLabel: 'X' } }],
      [{ edgeId: 'e-missing', label: 'X' }],
    );
    expect(ok).toBe(false);
    expect(setDataSpy).not.toHaveBeenCalled();
  });

  it('saveLiveBatch called with only nodeEdits (no edgeEdits) keeps prior single-arg behaviour (back-compat)', async () => {
    const { editor, setDataSpy } = buildMockLiveEditor({
      filePath: 'test.canvas',
      nodes: [{ id: 'n-a', radiprotocol_nodeType: 'answer' }],
      edges: [],
    });
    const ok = await editor.saveLiveBatch(
      'test.canvas',
      [{ nodeId: 'n-a', edits: { radiprotocol_displayLabel: 'X' } }],
    );
    expect(ok).toBe(true);
    expect(setDataSpy).toHaveBeenCalledTimes(1);
    const written = setDataSpy.mock.calls[0]![0] as { nodes: Array<Record<string, unknown>> };
    expect(written.nodes[0]!['radiprotocol_displayLabel']).toBe('X');
  });
});
