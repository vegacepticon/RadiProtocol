// src/__tests__/editor-panel-loop-form.test.ts
// Phase 45 Plan 02 Task 1 — Lock-in tests for unified loop node form (D-01, D-02, D-17)
// + quick-create loop button smoke tests (D-03, D-04, D-CL-01/02).
//
// Tests 1-5 pin down behaviour introduced by Phase 44 UAT-fix (commit cd98df3) + Phase 28 D-01
// color-injection pipeline (saveNodeEdits). They are expected GREEN from the start — pure lock-in.
//
// Tests 6-7 exercise the quick-create loop button path; they depend on Task 2 widening the
// onQuickCreate kind-union to include 'loop'. Before Task 2, the switch in onQuickCreate does
// not recognise 'loop' per se, but the method is kind-agnostic at runtime — factory.createNode
// is called for any string. The tests therefore pass once the union is widened (TypeScript gate)
// and the factory mock fires.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Setting, type WorkspaceLeaf } from 'obsidian';
import { EditorPanelView } from '../views/editor-panel-view';
import type RadiProtocolPlugin from '../main';

vi.mock('obsidian');

// ── Shared mock infrastructure ────────────────────────────────────────────

type MockPluginShape = {
  app: {
    vault: Record<string, ReturnType<typeof vi.fn>>;
    workspace: {
      getLeavesOfType: ReturnType<typeof vi.fn>;
      getMostRecentLeaf: ReturnType<typeof vi.fn>;
    };
  };
  settings: Record<string, unknown>;
  canvasNodeFactory: { createNode: ReturnType<typeof vi.fn> };
  canvasLiveEditor: {
    saveLive: ReturnType<typeof vi.fn>;
    getCanvasJSON?: ReturnType<typeof vi.fn>;
  };
};

function makeCanvasLeaf(filePath: string) {
  return { view: { file: { path: filePath } } };
}

// Capture Setting.prototype.* chainable calls so tests can assert what the form rendered.
const settingCalls: {
  setName: string[];
  setDesc: string[];
  setHeading: number;
} = { setName: [], setDesc: [], setHeading: 0 };
const textareaOnChange: { cb: ((v: string) => void) | null } = { cb: null };
const dropdownOptions: Array<[string, string]> = [];

function installSettingPrototypeMock(): void {
  settingCalls.setName = [];
  settingCalls.setDesc = [];
  settingCalls.setHeading = 0;
  textareaOnChange.cb = null;
  dropdownOptions.length = 0;

  const SettingProto = Setting.prototype as unknown as Record<string, unknown>;
  SettingProto.setName = vi.fn(function (this: unknown, name: string) {
    settingCalls.setName.push(name);
    return this;
  });
  SettingProto.setDesc = vi.fn(function (this: unknown, desc: string) {
    settingCalls.setDesc.push(desc);
    return this;
  });
  SettingProto.setHeading = vi.fn(function (this: unknown) {
    settingCalls.setHeading += 1;
    return this;
  });

  const mockTextArea = {
    setValue: vi.fn(function (this: unknown) { return this; }),
    onChange: vi.fn(function (this: unknown, cb: (v: string) => void) {
      textareaOnChange.cb = cb;
      return this;
    }),
  };
  SettingProto.addTextArea = vi.fn(function (this: unknown, cb: (ta: unknown) => void) {
    cb(mockTextArea);
    return this;
  });

  const mockDropdown = {
    addOption: vi.fn(function (this: unknown, value: string, display: string) {
      dropdownOptions.push([value, display]);
      return this;
    }),
    setValue: vi.fn(function (this: unknown) { return this; }),
    onChange: vi.fn(function (this: unknown) { return this; }),
    selectEl: {
      createEl: () => ({ disabled: false }),
    },
  };
  SettingProto.addDropdown = vi.fn(function (this: unknown, cb: (d: unknown) => void) {
    cb(mockDropdown);
    return this;
  });

  // Other Setting methods referenced by sibling case arms — noop chainable
  SettingProto.addText = vi.fn(function (this: unknown) { return this; });
}

function fakeNode(): Record<string, unknown> {
  const self: Record<string, unknown> = {
    empty: () => {},
    createDiv: (_opts?: { cls?: string }) => fakeNode(),
    createEl: (_tag: string, _opts?: unknown) => fakeNode(),
    createSpan: () => fakeNode(),
    setAttribute: () => {},
    appendText: () => {},
    addEventListener: () => {},
    addClass: () => {},
    removeClass: () => {},
    setText: () => {},
    disabled: false,
  };
  return self;
}

// ── Test state ────────────────────────────────────────────────────────────

let view: EditorPanelView;
let mockPlugin: MockPluginShape;
let mockLeaf: { containerEl: Record<string, unknown> };

beforeEach(() => {
  vi.clearAllMocks();

  const canvasLeaf = makeCanvasLeaf('test.canvas');
  mockPlugin = {
    app: {
      vault: {
        getAbstractFileByPath: vi.fn().mockReturnValue(null),
        read: vi.fn().mockResolvedValue('{}'),
        modify: vi.fn().mockResolvedValue(undefined),
      },
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
      saveLive: vi.fn().mockResolvedValue(true), // short-circuit past vault fallback
      getCanvasJSON: vi.fn().mockReturnValue(null),
    },
  };
  mockLeaf = { containerEl: {} };

  view = new EditorPanelView(
    mockLeaf as unknown as WorkspaceLeaf,
    mockPlugin as unknown as RadiProtocolPlugin,
  );

  // Pitfall 3: stub contentEl — obsidian module mock auto-stubs ItemView without body.
  (view as unknown as { contentEl: Record<string, unknown> }).contentEl = fakeNode();

  // Pitfall 2: make Setting.prototype.* chainable and capturing.
  installSettingPrototypeMock();

  // Pitfall 4: renderToolbar calls setIcon / registerDomEvent which are not in the mock.
  vi.spyOn(
    view as unknown as { renderToolbar: (c: unknown) => void },
    'renderToolbar',
  ).mockImplementation(() => {});
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('LOOP-05: Node Editor loop form lock-in (D-01, D-02, D-17)', () => {
  it('dropdown contains option loop with label "Loop"', () => {
    (view as unknown as { renderForm: (n: unknown, k: unknown) => void }).renderForm({}, null);
    const loopEntry = dropdownOptions.find(([v]) => v === 'loop');
    expect(loopEntry).toBeDefined();
    expect(loopEntry?.[1]).toBe('Loop');
  });

  it('renderForm(kind=loop) renders heading "Loop node" + exactly one "Header text" Setting', () => {
    (view as unknown as { renderForm: (n: unknown, k: unknown) => void }).renderForm(
      { radiprotocol_nodeType: 'loop', radiprotocol_headerText: 'sample' },
      'loop',
    );
    expect(settingCalls.setName).toContain('Loop node');
    // Fall-through guard (Pitfall 5): legacy 'loop-start'/'loop-end' stub uses 'Legacy loop node'.
    expect(settingCalls.setName).not.toContain('Legacy loop node');
    const headerTextCount = settingCalls.setName.filter(n => n === 'Header text').length;
    expect(headerTextCount).toBe(1);
  });

  it('loop form NEVER renders a Setting with /iterations/i in name/desc (RUN-07 regression guard)', () => {
    (view as unknown as { renderForm: (n: unknown, k: unknown) => void }).renderForm(
      { radiprotocol_nodeType: 'loop' },
      'loop',
    );
    const haystack = [...settingCalls.setName, ...settingCalls.setDesc].join(' | ');
    expect(haystack).not.toMatch(/iterations/i);
  });

  it('header-text textarea onChange writes to BOTH pendingEdits.radiprotocol_headerText AND pendingEdits.text', () => {
    (view as unknown as { renderForm: (n: unknown, k: unknown) => void }).renderForm(
      { radiprotocol_nodeType: 'loop', radiprotocol_headerText: '' },
      'loop',
    );
    expect(textareaOnChange.cb).not.toBeNull();
    textareaOnChange.cb?.('new lesion header');
    const pendingEdits = (view as unknown as { pendingEdits: Record<string, unknown> }).pendingEdits;
    expect(pendingEdits['radiprotocol_headerText']).toBe('new lesion header');
    expect(pendingEdits['text']).toBe('new lesion header');
  });

  it('saveNodeEdits with kind=loop injects color:"1" via NODE_COLOR_MAP (Phase 28 D-01 pipeline lock-in)', async () => {
    const saveLiveSpy = mockPlugin.canvasLiveEditor.saveLive;
    await view.saveNodeEdits('test.canvas', 'node-123', {
      radiprotocol_nodeType: 'loop',
      radiprotocol_headerText: 'x',
    });
    expect(saveLiveSpy).toHaveBeenCalledTimes(1);
    const enrichedEdits = saveLiveSpy.mock.calls[0]?.[2] as Record<string, unknown> | undefined;
    expect(enrichedEdits?.['color']).toBe('1');
    expect(enrichedEdits?.['radiprotocol_nodeType']).toBe('loop');
  });
});

describe('LOOP-05: Quick-create loop button (D-03, D-04)', () => {
  it('onQuickCreate("loop") calls canvasNodeFactory.createNode(canvasPath, "loop", anchorId?)', async () => {
    mockPlugin.canvasNodeFactory.createNode.mockReturnValue(null);

    // Seed current-anchor state so the factory call carries the anchor id.
    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'anchor-1';

    await (view as unknown as {
      onQuickCreate: (k: string) => Promise<void>;
    }).onQuickCreate('loop');

    expect(mockPlugin.canvasNodeFactory.createNode).toHaveBeenCalledTimes(1);
    expect(mockPlugin.canvasNodeFactory.createNode).toHaveBeenCalledWith(
      'test.canvas',
      'loop',
      'anchor-1',
    );
  });

  it('onQuickCreate("loop") flushes pending debounce before creating', async () => {
    mockPlugin.canvasNodeFactory.createNode.mockReturnValue(null);

    (view as unknown as { currentFilePath: string | null }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'anchor-1';
    (view as unknown as { pendingEdits: Record<string, unknown> }).pendingEdits = {
      radiprotocol_headerText: 'pending',
    };
    (view as unknown as {
      _debounceTimer: ReturnType<typeof setTimeout> | null;
    })._debounceTimer = setTimeout(() => {}, 10000);

    const saveSpy = vi.spyOn(view, 'saveNodeEdits').mockResolvedValue(undefined);

    await (view as unknown as {
      onQuickCreate: (k: string) => Promise<void>;
    }).onQuickCreate('loop');

    expect(saveSpy).toHaveBeenCalledWith(
      'test.canvas',
      'anchor-1',
      expect.objectContaining({ radiprotocol_headerText: 'pending' }),
    );
    expect(mockPlugin.canvasNodeFactory.createNode).toHaveBeenCalled();
  });
});
