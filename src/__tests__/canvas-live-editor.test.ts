// src/__tests__/canvas-live-editor.test.ts
// Unit tests for CanvasLiveEditor — Pattern B (canvas.getData/setData/requestSave)
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { App } from 'obsidian';
import { CanvasLiveEditor } from '../canvas/canvas-live-editor';

describe('CanvasLiveEditor', () => {
  let fakeNode: Record<string, unknown>;
  let fakeRequestSave: ReturnType<typeof vi.fn>;
  let fakeSetData: ReturnType<typeof vi.fn>;
  let fakeGetData: ReturnType<typeof vi.fn>;
  let fakeCanvas: { getData: ReturnType<typeof vi.fn>; setData: ReturnType<typeof vi.fn>; requestSave: ReturnType<typeof vi.fn> };
  let fakeLeaf: { view: { file: { path: string }; canvas: typeof fakeCanvas } };
  let fakeApp: { workspace: { getLeavesOfType: ReturnType<typeof vi.fn> } };
  let editor: CanvasLiveEditor;

  beforeEach(() => {
    fakeNode = {
      id: 'node-1',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      type: 'text',
      radiprotocol_nodeType: 'question',
    };
    fakeRequestSave = vi.fn();
    fakeSetData = vi.fn();
    // Simulate getData() returning a deep copy each call (as the real Obsidian Canvas API does)
    fakeGetData = vi.fn().mockImplementation(() => ({
      nodes: [{ ...fakeNode }],
      edges: [],
    }));
    fakeCanvas = {
      getData: fakeGetData,
      setData: fakeSetData,
      requestSave: fakeRequestSave,
    };
    fakeLeaf = {
      view: {
        file: { path: 'test.canvas' },
        canvas: fakeCanvas,
      },
    };
    fakeApp = {
      workspace: {
        getLeavesOfType: vi.fn().mockReturnValue([fakeLeaf]),
      },
    };
    editor = new CanvasLiveEditor(fakeApp as unknown as App);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saveLive returns true when canvas.getData is function and node found by id', async () => {
    const result = await editor.saveLive('test.canvas', 'node-1', {
      radiprotocol_questionText: 'Is this a finding?',
    });
    expect(result).toBe(true);
  });

  it('saveLive returns false when canvas.getData is not a function (D-01 fallback)', async () => {
    // Override to expose canvas without getData function
    fakeLeaf.view.canvas = { getData: 'not-a-function' as unknown as typeof fakeGetData, setData: fakeSetData, requestSave: fakeRequestSave };
    const result = await editor.saveLive('test.canvas', 'node-1', {
      radiprotocol_questionText: 'test',
    });
    expect(result).toBe(false);
  });

  it('saveLive returns false when no canvas leaf found (canvas closed)', async () => {
    fakeApp.workspace.getLeavesOfType.mockReturnValue([]);
    const result = await editor.saveLive('test.canvas', 'node-1', {
      radiprotocol_questionText: 'test',
    });
    expect(result).toBe(false);
  });

  it('saveLive returns false when node id not found in getData().nodes', async () => {
    const result = await editor.saveLive('test.canvas', 'nonexistent-node', {
      radiprotocol_questionText: 'test',
    });
    expect(result).toBe(false);
  });

  it('PROTECTED_FIELDS (id, x, y, width, height, type, color) are not in committed setData() call', async () => {
    await editor.saveLive('test.canvas', 'node-1', {
      id: 'hacked-id',
      x: 999,
      y: 999,
      width: 1,
      height: 1,
      type: 'group',
      color: '#ff0000',
      radiprotocol_extra: 'allowed',
    });
    expect(fakeSetData).toHaveBeenCalled();
    const committedData = fakeSetData.mock.calls[0]![0] as { nodes: Array<Record<string, unknown>> };
    const committedNode = committedData.nodes.find((n: Record<string, unknown>) => n['id'] === 'node-1');
    // PROTECTED fields must retain original values
    expect(committedNode?.['id']).toBe('node-1');
    expect(committedNode?.['x']).toBe(0);
    expect(committedNode?.['y']).toBe(0);
    expect(committedNode?.['width']).toBe(100);
    expect(committedNode?.['height']).toBe(50);
    expect(committedNode?.['type']).toBe('text');
    // Non-protected field allowed through
    expect(committedNode?.['radiprotocol_extra']).toBe('allowed');
  });

  it('un-mark path: radiprotocol_nodeType="" removes all radiprotocol_* keys from node before setData()', async () => {
    await editor.saveLive('test.canvas', 'node-1', {
      radiprotocol_nodeType: '',
    });
    expect(fakeSetData).toHaveBeenCalled();
    const committedData = fakeSetData.mock.calls[0]![0] as { nodes: Array<Record<string, unknown>> };
    const committedNode = committedData.nodes.find((n: Record<string, unknown>) => n['id'] === 'node-1');
    // All radiprotocol_* keys must be removed
    const remainingKeys = Object.keys(committedNode ?? {}).filter(k => k.startsWith('radiprotocol_'));
    expect(remainingKeys).toHaveLength(0);
  });

  it('rollback: if setData() or requestSave() throws, canvas.setData(originalData) is called with pre-edit data', async () => {
    // Make setData throw on the first call (the mutation commit), succeed on rollback
    let setDataCallCount = 0;
    fakeSetData.mockImplementation(() => {
      setDataCallCount++;
      if (setDataCallCount === 1) {
        throw new Error('setData failed');
      }
    });

    await expect(
      editor.saveLive('test.canvas', 'node-1', { radiprotocol_questionText: 'test' })
    ).rejects.toThrow('setData failed');

    // Should have been called twice: once for mutation (throws), once for rollback
    expect(fakeSetData).toHaveBeenCalledTimes(2);
    // Second call (rollback) must have the original node data
    const rollbackData = fakeSetData.mock.calls[1]![0] as { nodes: Array<Record<string, unknown>> };
    const rolledBackNode = rollbackData.nodes.find((n: Record<string, unknown>) => n['id'] === 'node-1');
    expect(rolledBackNode?.['radiprotocol_questionText']).toBeUndefined();
  });

  it('destroy() clears all pending debounce timers', async () => {
    vi.useFakeTimers();

    // Trigger a save to create a pending debounce timer
    await editor.saveLive('test.canvas', 'node-1', { radiprotocol_questionText: 'test' });

    // At this point requestSave should not have been called yet (debounced)
    expect(fakeRequestSave).not.toHaveBeenCalled();

    // Destroy should clear the timer
    editor.destroy();

    // Advance timers — requestSave should NOT be called after destroy
    vi.runAllTimers();
    expect(fakeRequestSave).not.toHaveBeenCalled();
  });
});
