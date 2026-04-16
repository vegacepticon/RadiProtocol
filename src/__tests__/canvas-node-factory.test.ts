// src/__tests__/canvas-node-factory.test.ts
// TDD tests for CanvasNodeFactory service (Phase 38, Plan 01)
// CANVAS-01: createNode via createTextNode API
// CANVAS-04: nodeType + auto-color from NODE_COLOR_MAP
// CANVAS-05: graceful Notice when no canvas open

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Notice } from 'obsidian';
import type { App } from 'obsidian';
import type { CanvasNodeInternal } from '../types/canvas-internal';

vi.mock('obsidian');

// ── Helper: build a fake CanvasNodeInternal returned by createTextNode ──────
function makeFakeCanvasNode(): CanvasNodeInternal {
  return {
    id: 'new-node-1',
    x: 0,
    y: 0,
    width: 250,
    height: 60,
    color: '',
    getData: vi.fn().mockReturnValue({}),
    setData: vi.fn(),
    setColor: vi.fn(),
  };
}

// ── Helper: build a fake canvas leaf ────────────────────────────────────────
function makeCanvasLeaf(
  filePath: string,
  opts: {
    hasCreateTextNode?: boolean;
    fakeNode?: CanvasNodeInternal;
    anchorNodes?: Map<string, { id: string; x: number; y: number; width: number; height: number }>;
  } = {}
) {
  const fakeNode = opts.fakeNode ?? makeFakeCanvasNode();
  const nodes = opts.anchorNodes
    ? new Map(opts.anchorNodes)
    : new Map<string, unknown>();

  const canvas: Record<string, unknown> = {
    getData: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
    setData: vi.fn(),
    requestSave: vi.fn(),
    nodes,
  };

  if (opts.hasCreateTextNode !== false) {
    canvas.createTextNode = vi.fn().mockReturnValue(fakeNode);
  }

  return {
    view: {
      file: { path: filePath },
      canvas,
    },
  };
}

// ── Helper: build a mock App with given leaves ──────────────────────────────
function makeApp(leaves: unknown[] = []): App {
  return {
    workspace: {
      getLeavesOfType: vi.fn().mockReturnValue(leaves),
    },
  } as unknown as App;
}

describe('CanvasNodeFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Lazy import to allow RED phase to fail on missing module
  async function loadFactory() {
    const mod = await import('../canvas/canvas-node-factory');
    return mod.CanvasNodeFactory;
  }

  it('Test 1 (CANVAS-01): createNode() calls canvas.createTextNode() with correct pos/text/size and returns { nodeId, canvasNode }', async () => {
    const fakeNode = makeFakeCanvasNode();
    const leaf = makeCanvasLeaf('proto.canvas', { fakeNode });
    const app = makeApp([leaf]);

    const Factory = await loadFactory();
    const factory = new Factory(app);
    const result = factory.createNode('proto.canvas', 'question');

    expect(result).not.toBeNull();
    expect(result!.nodeId).toBe('new-node-1');
    expect(result!.canvasNode).toBe(fakeNode);

    expect(leaf.view.canvas.createTextNode).toHaveBeenCalledWith({
      pos: { x: 0, y: 0 },
      text: '',
      size: { width: 250, height: 60 },
    });
  });

  it('Test 2 (CANVAS-04): after creation, setData() is called with radiprotocol_nodeType and color from NODE_COLOR_MAP', async () => {
    const fakeNode = makeFakeCanvasNode();
    const leaf = makeCanvasLeaf('proto.canvas', { fakeNode });
    const app = makeApp([leaf]);

    const Factory = await loadFactory();
    const factory = new Factory(app);
    factory.createNode('proto.canvas', 'question');

    expect(fakeNode.setData).toHaveBeenCalledWith({
      radiprotocol_nodeType: 'question',
      color: '5', // question -> cyan ('5') per NODE_COLOR_MAP
    });
  });

  it('Test 3 (CANVAS-05): returns null and shows Notice when no canvas leaf exists', async () => {
    const app = makeApp([]); // no leaves

    const Factory = await loadFactory();
    const factory = new Factory(app);
    const result = factory.createNode('proto.canvas', 'start');

    expect(result).toBeNull();
    expect(Notice).toHaveBeenCalled();
    const msg = vi.mocked(Notice).mock.calls[0]?.[0] as string;
    expect(msg.toLowerCase()).toContain('canvas');
  });

  it('Test 4 (CANVAS-01): returns null and shows Notice when canvas exists but createTextNode is not a function', async () => {
    const leaf = makeCanvasLeaf('proto.canvas', { hasCreateTextNode: false });
    const app = makeApp([leaf]);

    const Factory = await loadFactory();
    const factory = new Factory(app);
    const result = factory.createNode('proto.canvas', 'answer');

    expect(result).toBeNull();
    expect(Notice).toHaveBeenCalled();
    const msg = vi.mocked(Notice).mock.calls[0]?.[0] as string;
    expect(msg.toLowerCase()).toMatch(/unavailable|update/);
  });

  it('Test 5: when anchorNodeId is provided and exists in canvas.nodes, pos is offset from anchor', async () => {
    const fakeNode = makeFakeCanvasNode();
    const anchorNodes = new Map([
      ['anchor-1', { id: 'anchor-1', x: 100, y: 200, width: 300, height: 80 }],
    ]);
    const leaf = makeCanvasLeaf('proto.canvas', { fakeNode, anchorNodes: anchorNodes as never });
    const app = makeApp([leaf]);

    const Factory = await loadFactory();
    const factory = new Factory(app);
    factory.createNode('proto.canvas', 'text-block', 'anchor-1');

    expect(leaf.view.canvas.createTextNode).toHaveBeenCalledWith(
      expect.objectContaining({
        pos: { x: 100 + 300 + 40, y: 200 }, // anchor.x + anchor.width + NODE_GAP
      })
    );
  });

  it('Test 6: when anchorNodeId is not provided, pos defaults to { x: 0, y: 0 }', async () => {
    const fakeNode = makeFakeCanvasNode();
    const leaf = makeCanvasLeaf('proto.canvas', { fakeNode });
    const app = makeApp([leaf]);

    const Factory = await loadFactory();
    const factory = new Factory(app);
    factory.createNode('proto.canvas', 'start');

    expect(leaf.view.canvas.createTextNode).toHaveBeenCalledWith(
      expect.objectContaining({
        pos: { x: 0, y: 0 },
      })
    );
  });

  it('Test 7: requestSave() is called after node creation', async () => {
    const leaf = makeCanvasLeaf('proto.canvas');
    const app = makeApp([leaf]);

    const Factory = await loadFactory();
    const factory = new Factory(app);
    factory.createNode('proto.canvas', 'answer');

    expect(leaf.view.canvas.requestSave).toHaveBeenCalled();
  });

  it('Test 8: destroy() clears resources (mirrors CanvasLiveEditor pattern)', async () => {
    const app = makeApp([]);

    const Factory = await loadFactory();
    const factory = new Factory(app);

    // destroy() should not throw
    expect(() => factory.destroy()).not.toThrow();
  });
});
