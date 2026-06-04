import { describe, expect, it, vi } from 'vitest';
import { ProtocolEditorView } from '../../views/protocol-editor-view';
import type { ProtocolDocumentV1, ProtocolNodeRecord } from '../../protocol/protocol-document';

type UpdateMutator = (doc: ProtocolDocumentV1 | null) => ProtocolDocumentV1;
type StoreUpdate = (protocolPath: string, mutator: UpdateMutator) => Promise<ProtocolDocumentV1>;

interface MockNodeElement {
  attrs: Record<string, string>;
  setAttr(name: string, value: string | number | boolean): void;
}

vi.mock('obsidian', () => ({
  ItemView: class {
    leaf = {};
    app = {};
    containerEl = { children: [] };
    constructor() {}
    getViewType(): string { return ''; }
    getDisplayText(): string { return ''; }
    getIcon(): string { return ''; }
    onOpen(): void {}
    onClose(): void {}
    registerDomEvent(): void {}
  },
  Notice: class { constructor(_message?: string) {} },
  TFile: class { path: string; constructor(path = '') { this.path = path; } },
  WorkspaceLeaf: class {},
  setIcon: () => {},
}));

vi.mock('../../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class { mount(): Promise<void> { return Promise.resolve(); } unmount(): void {} },
}));

function makeNode(overrides: Partial<ProtocolNodeRecord> = {}): ProtocolNodeRecord {
  return {
    id: 'node-1',
    kind: 'question',
    x: 10,
    y: 20,
    width: 200,
    height: 80,
    text: 'Question',
    fields: { questionText: 'Question' },
    ...overrides,
  };
}

function makeDoc(node = makeNode()): ProtocolDocumentV1 {
  return {
    schema: 'radiprotocol.protocol',
    version: 1,
    id: 'doc-1',
    title: 'Protocol',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    nodes: [node],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function makeNodeElement(): MockNodeElement {
  return {
    attrs: {},
    setAttr(name: string, value: string | number | boolean): void {
      this.attrs[name] = String(value);
    },
  };
}

function createView(update: StoreUpdate, doc = makeDoc()) {
  const plugin = {
    i18n: { t: (key: string, params?: Record<string, string>) => params?.error ?? key },
    protocolDocumentStore: { update },
    settings: { snippetFolderPath: '.radiprotocol/snippets' },
  } as any;
  const view = new ProtocolEditorView({} as any, plugin);
  const nodeEl = makeNodeElement();
  (view as any).protocolPath = 'Protocols/current.rp.json';
  (view as any).doc = doc;
  (view as any).zoom = 1;
  (view as any).viewportEl = { scrollLeft: 15010, scrollTop: 12020 };
  (view as any).nodeElementById.set(doc.nodes[0]!.id, nodeEl as unknown as HTMLElement);
  const updateEdgePaths = vi.spyOn(view as any, 'updateEdgePaths').mockImplementation(() => {});
  const renderMinimap = vi.spyOn(view as any, 'renderMinimap').mockImplementation(() => {});
  return { view, nodeEl, updateEdgePaths, renderMinimap };
}

describe('ProtocolEditorView — saveNodeGeometry', () => {
  it('updates node DOM, edges, and minimap after a successful geometry save', async () => {
    const node = makeNode({ x: 12.6, y: 34.2, width: 210.7, height: 88.4 });
    let savedDoc: ProtocolDocumentV1 | null = null;
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
      const nextDoc = mutator(makeDoc(makeNode()));
      savedDoc = nextDoc;
      return nextDoc;
    });
    const { view, nodeEl, updateEdgePaths, renderMinimap } = createView(update, makeDoc(node));

    await (view as any).saveNodeGeometry(node);

    expect(update).toHaveBeenCalledWith('Protocols/current.rp.json', expect.any(Function));
    expect((savedDoc as unknown as ProtocolDocumentV1).nodes[0]).toMatchObject({ x: 13, y: 34, width: 211, height: 88 });
    expect((savedDoc as unknown as ProtocolDocumentV1).viewport).toEqual({ x: 10, y: 20, zoom: 1 });
    expect((view as any).doc).toBe(savedDoc);
    expect(nodeEl.attrs['style']).toContain('left:15013px;top:12034px;width:211px;min-height:88px;');
    expect(updateEdgePaths).toHaveBeenCalledTimes(1);
    expect(renderMinimap).toHaveBeenCalledTimes(1);
  });

  it('does not mutate the active view when a concurrent loadProtocol occurs while saving', async () => {
    const node = makeNode({ x: 42, y: 43 });
    const otherDoc = makeDoc(makeNode({ id: 'other-node' }));
    let viewRef: ProtocolEditorView | null = null;
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
      if (viewRef === null) throw new Error('view not initialized');
      (viewRef as any).protocolPath = 'Protocols/other.rp.json';
      (viewRef as any).doc = otherDoc;
      (viewRef as any).loadGeneration += 1;
      const existingDoc = makeDoc(makeNode());
      const updated = mutator(existingDoc);
      expect(updated).toBe(existingDoc);
      return updated;
    });
    const { view, nodeEl, updateEdgePaths, renderMinimap } = createView(update, makeDoc(node));
    viewRef = view;

    await (view as any).saveNodeGeometry(node);

    expect(update).toHaveBeenCalledWith('Protocols/current.rp.json', expect.any(Function));
    expect((view as any).protocolPath).toBe('Protocols/other.rp.json');
    expect((view as any).doc).toBe(otherDoc);
    expect(nodeEl.attrs['style']).toBeUndefined();
    expect(updateEdgePaths).not.toHaveBeenCalled();
    expect(renderMinimap).not.toHaveBeenCalled();
  });

  it('abandons stale save when a concurrent loadProtocol occurs on the same path', async () => {
    const node = makeNode({ x: 10, y: 20 });
    const updatedDoc = makeDoc(makeNode({ id: 'updated-node' }));
    let viewRef: ProtocolEditorView | null = null;
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
      if (viewRef === null) throw new Error('view not initialized');
      (viewRef as any).doc = updatedDoc;
      (viewRef as any).loadGeneration += 1;
      const existingDoc = makeDoc(makeNode());
      const updated = mutator(existingDoc);
      expect(updated).toBe(existingDoc);
      return updated;
    });
    const { view, nodeEl, updateEdgePaths, renderMinimap } = createView(update, makeDoc(node));
    viewRef = view;

    await (view as any).saveNodeGeometry(node);

    expect(update).toHaveBeenCalledWith('Protocols/current.rp.json', expect.any(Function));
    expect((view as any).protocolPath).toBe('Protocols/current.rp.json');
    expect((view as any).doc).toBe(updatedDoc);
    expect(nodeEl.attrs['style']).toBeUndefined();
    expect(updateEdgePaths).not.toHaveBeenCalled();
    expect(renderMinimap).not.toHaveBeenCalled();
  });

  it('updates edge paths from live geometry after doc replacement leaves drag listeners with older node objects', () => {
    const sourceNode = makeNode({ id: 'source', x: 0, y: 0, width: 200, height: 80 });
    const targetNode = makeNode({ id: 'target', x: 400, y: 0, width: 200, height: 80 });
    const doc: ProtocolDocumentV1 = {
      ...makeDoc(sourceNode),
      nodes: [sourceNode, targetNode],
      edges: [{ id: 'edge-1', fromNodeId: 'source', toNodeId: 'target' }],
    };
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => mutator(doc));
    const { view, updateEdgePaths } = createView(update, doc);
    updateEdgePaths.mockRestore();

    const hitboxEl = makeNodeElement();
    const pathEl = makeNodeElement();
    const group = {
      querySelector(selector: string) {
        if (selector === '.rp-protocol-editor-edge-hitbox') return hitboxEl;
        if (selector === '.rp-protocol-editor-edge') return pathEl;
        return null;
      },
    } as unknown as SVGGElement;
    const previousCSS = (globalThis as any).CSS;
    (globalThis as any).CSS = { escape: (value: string) => value };

    try {
      (view as any).svgEl = {
        querySelector: (selector: string) => selector === '[data-edge-id="edge-1"]' ? group : null,
      };

      // Simulate the post-save state: this.doc has replacement node objects at old
      // coordinates, while the still-bound drag listener is moving the old object.
      (view as any).doc = {
        ...doc,
        nodes: [
          { ...sourceNode, x: 0, y: 0 },
          { ...targetNode, x: 400, y: 0 },
        ],
      };
      (view as any).liveNodeGeometryById.set('source', { id: 'source', x: 50, y: 30, width: 200, height: 80 });

      (view as any).updateEdgePaths();

      expect(pathEl.attrs.d).toContain('M 15250 12070');
      expect(hitboxEl.attrs.d).toBe(pathEl.attrs.d);
      // Stale-doc LR output anchor would have produced M 15200 12040.
      expect(pathEl.attrs.d).not.toContain('M 15200 12040');
    } finally {
      if (previousCSS === undefined) {
        delete (globalThis as any).CSS;
      } else {
        (globalThis as any).CSS = previousCSS;
      }
    }
  });
});

describe('ProtocolEditorView — node creation modal handoff', () => {
  it('runs standalone creation handoff only after opening the edit modal', async () => {
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => mutator(makeDoc(makeNode())));
    const { view } = createView(update);
    const order: string[] = [];

    vi.spyOn(view as any, 'applyCreatedProtocolDocument').mockImplementation(((updated: ProtocolDocumentV1, newNodeId: string) => {
      order.push('apply-created');
      (view as any).doc = updated;
      return updated.nodes.find((node) => node.id === newNodeId) ?? null;
    }) as any);
    vi.spyOn(view as any, 'openEditModal').mockImplementation(() => {
      order.push('open-edit-modal');
    });

    await new Promise<void>((resolve) => {
      (view as any).addNodeAtWorldPoint('question', 32, 48, {
        onEditModalOpened: () => {
          order.push('handoff');
          resolve();
        },
      });
    });

    expect(order).toEqual(['apply-created', 'open-edit-modal', 'handoff']);
    expect(update).toHaveBeenCalledWith('Protocols/current.rp.json', expect.any(Function));
  });

  it('runs connected creation handoff only after opening the edit modal', async () => {
    const source = makeNode({ id: 'source', kind: 'question' });
    const doc = makeDoc(source);
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => mutator(doc));
    const { view } = createView(update, doc);
    const order: string[] = [];

    vi.spyOn(view as any, 'applyCreatedProtocolDocument').mockImplementation(((updated: ProtocolDocumentV1, newNodeId: string) => {
      order.push('apply-created');
      (view as any).doc = updated;
      return updated.nodes.find((node) => node.id === newNodeId) ?? null;
    }) as any);
    vi.spyOn(view as any, 'openEditModal').mockImplementation(() => {
      order.push('open-edit-modal');
    });

    await new Promise<void>((resolve) => {
      (view as any).addNodeAndConnectAtWorldPoint('source', 'answer', 120, 64, {
        onEditModalOpened: () => {
          order.push('handoff');
          resolve();
        },
      });
    });

    expect(order).toEqual(['apply-created', 'open-edit-modal', 'handoff']);
    expect(update).toHaveBeenCalledWith('Protocols/current.rp.json', expect.any(Function));
  });

  it('abandons stale standalone creation without opening the edit modal or successful handoff', async () => {
    let viewRef: ProtocolEditorView | null = null;
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
      if (viewRef === null) throw new Error('view not initialized');
      (viewRef as any).loadGeneration += 1;
      return mutator(makeDoc(makeNode()));
    });
    const { view } = createView(update);
    viewRef = view;
    let handoffCount = 0;
    let abandonedCount = 0;
    const openEditModal = vi.spyOn(view as any, 'openEditModal').mockImplementation(() => {});

    await new Promise<void>((resolve) => {
      (view as any).addNodeAtWorldPoint('question', 0, 0, {
        onEditModalOpened: () => {
          handoffCount += 1;
        },
        onCreateAbandoned: () => {
          abandonedCount += 1;
          resolve();
        },
      });
    });

    expect(handoffCount).toBe(0);
    expect(abandonedCount).toBe(1);
    expect(openEditModal).not.toHaveBeenCalled();
  });

  it('runs failed-creation recovery without opening the edit modal or successful handoff', async () => {
    const update = vi.fn<StoreUpdate>(async () => {
      throw new Error('write failed');
    });
    const { view } = createView(update);
    let handoffCount = 0;
    let failureCount = 0;
    const openEditModal = vi.spyOn(view as any, 'openEditModal').mockImplementation(() => {});

    await new Promise<void>((resolve) => {
      (view as any).addNodeAtWorldPoint('question', 0, 0, {
        onEditModalOpened: () => {
          handoffCount += 1;
        },
        onCreateFailed: () => {
          failureCount += 1;
          resolve();
        },
      });
    });

    expect(handoffCount).toBe(0);
    expect(failureCount).toBe(1);
    expect(openEditModal).not.toHaveBeenCalled();
  });

  it('abandons stale connected creation without opening the edit modal or successful handoff', async () => {
    const source = makeNode({ id: 'source', kind: 'question' });
    const doc = makeDoc(source);
    let viewRef: ProtocolEditorView | null = null;
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
      if (viewRef === null) throw new Error('view not initialized');
      (viewRef as any).loadGeneration += 1;
      return mutator(doc);
    });
    const { view } = createView(update, doc);
    viewRef = view;
    let handoffCount = 0;
    let abandonedCount = 0;
    const openEditModal = vi.spyOn(view as any, 'openEditModal').mockImplementation(() => {});

    await new Promise<void>((resolve) => {
      (view as any).addNodeAndConnectAtWorldPoint('source', 'answer', 0, 0, {
        onEditModalOpened: () => {
          handoffCount += 1;
        },
        onCreateAbandoned: () => {
          abandonedCount += 1;
          resolve();
        },
      });
    });

    expect(handoffCount).toBe(0);
    expect(abandonedCount).toBe(1);
    expect(openEditModal).not.toHaveBeenCalled();
  });

  it('runs failed connected-creation recovery without opening the edit modal or successful handoff', async () => {
    const source = makeNode({ id: 'source', kind: 'question' });
    const doc = makeDoc(source);
    const update = vi.fn<StoreUpdate>(async () => {
      throw new Error('write failed');
    });
    const { view } = createView(update, doc);
    let handoffCount = 0;
    let failureCount = 0;
    const openEditModal = vi.spyOn(view as any, 'openEditModal').mockImplementation(() => {});

    await new Promise<void>((resolve) => {
      (view as any).addNodeAndConnectAtWorldPoint('source', 'answer', 0, 0, {
        onEditModalOpened: () => {
          handoffCount += 1;
        },
        onCreateFailed: () => {
          failureCount += 1;
          resolve();
        },
      });
    });

    expect(handoffCount).toBe(0);
    expect(failureCount).toBe(1);
    expect(openEditModal).not.toHaveBeenCalled();
  });

  it('calls onCreateFailed when standalone UI update fails after successful save', async () => {
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => mutator(makeDoc(makeNode())));
    const { view } = createView(update);
    let failureCount = 0;

    vi.spyOn(view as any, 'applyCreatedProtocolDocument').mockImplementation(() => {
      throw new Error('UI update failed');
    });

    await new Promise<void>((resolve) => {
      (view as any).addNodeAtWorldPoint('question', 0, 0, {
        onEditModalOpened: () => {
          // Should not be called
        },
        onCreateFailed: () => {
          failureCount += 1;
          resolve();
        },
      });
    });

    expect(failureCount).toBe(1);
  });
});
