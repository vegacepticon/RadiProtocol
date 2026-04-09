// src/__tests__/editor-panel.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import the stub (will be replaced by full implementation in Plan 01)
import { EditorPanelView, EDITOR_PANEL_VIEW_TYPE } from '../views/editor-panel-view';
import { Setting } from 'obsidian';

// Note: obsidian is aliased to src/__mocks__/obsidian.ts in vitest.config.ts
// vi.mock('obsidian') is intentionally omitted — the alias provides the manual mock
// with proper method chaining (setHeading/setName return `this`).

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

  // Helper: invoke the private buildKindForm and collect all Setting names created
  function collectSettingNames(
    kindView: EditorPanelView,
    nodeRecord: Record<string, unknown>,
    kind: string
  ): string[] {
    const names: string[] = [];
    const setNameSpy = vi.spyOn(Setting.prototype, 'setName').mockImplementation(function (this: Setting, name: string) {
      names.push(name);
      return this;
    });

    const container = { createEl: vi.fn(), createDiv: vi.fn() } as unknown as HTMLElement;
    (kindView as unknown as {
      buildKindForm(c: HTMLElement, r: Record<string, unknown>, k: string): void;
    }).buildKindForm(container, nodeRecord, kind as import('../graph/graph-model').RPNodeKind);

    setNameSpy.mockRestore();
    return names;
  }

  // Helper: invoke buildKindForm, capture onChange callbacks from the separator dropdown
  function captureSeparatorOnChange(
    kindView: EditorPanelView,
    nodeRecord: Record<string, unknown>,
    kind: string
  ): ((v: string) => void) | undefined {
    let capturedOnChange: ((v: string) => void) | undefined;
    let settingNameContext = '';

    const setNameSpy = vi.spyOn(Setting.prototype, 'setName').mockImplementation(function (this: Setting, name: string) {
      settingNameContext = name;
      return this;
    });

    const addDropdownSpy = vi.spyOn(Setting.prototype, 'addDropdown').mockImplementation(function (
      this: Setting,
      cb: (drop: unknown) => void
    ) {
      if (settingNameContext === 'Text separator') {
        const mockDrop = {
          addOption: (_v: string, _l: string) => mockDrop,
          setValue: (_v: string) => mockDrop,
          onChange: (fn: (v: string) => void) => {
            capturedOnChange = fn;
            return mockDrop;
          },
        };
        cb(mockDrop);
      }
      return this;
    });

    const container = { createEl: vi.fn(), createDiv: vi.fn() } as unknown as HTMLElement;
    (kindView as unknown as {
      buildKindForm(c: HTMLElement, r: Record<string, unknown>, k: string): void;
    }).buildKindForm(container, nodeRecord, kind as import('../graph/graph-model').RPNodeKind);

    setNameSpy.mockRestore();
    addDropdownSpy.mockRestore();
    return capturedOnChange;
  }

  describe('Separator dropdown (SEP-02, D-05, D-06)', () => {
    // Test A: answer kind shows 'Text separator' Setting
    it('Test A: buildKindForm for answer kind includes a Setting named Text separator', () => {
      const names = collectSettingNames(view, { radiprotocol_nodeType: 'answer' }, 'answer');
      expect(names).toContain('Text separator');
    });

    // Test B: free-text-input kind shows 'Text separator' Setting
    it('Test B: buildKindForm for free-text-input kind includes a Setting named Text separator', () => {
      const names = collectSettingNames(view, { radiprotocol_nodeType: 'free-text-input' }, 'free-text-input');
      expect(names).toContain('Text separator');
    });

    // Test C: text-block kind shows 'Text separator' Setting
    it('Test C: buildKindForm for text-block kind includes a Setting named Text separator', () => {
      const names = collectSettingNames(view, { radiprotocol_nodeType: 'text-block' }, 'text-block');
      expect(names).toContain('Text separator');
    });

    // Test D: question kind does NOT show 'Text separator' Setting
    it('Test D: buildKindForm for question kind does NOT include a Setting named Text separator', () => {
      const names = collectSettingNames(view, { radiprotocol_nodeType: 'question' }, 'question');
      expect(names).not.toContain('Text separator');
    });

    // Test E: start kind does NOT show 'Text separator' Setting
    it('Test E: buildKindForm for start kind does NOT include a Setting named Text separator', () => {
      const names = collectSettingNames(view, { radiprotocol_nodeType: 'start' }, 'start');
      expect(names).not.toContain('Text separator');
    });

    // Test F: existing radiprotocol_separator value is pre-selected in the dropdown
    it('Test F: buildKindForm for answer pre-selects the existing radiprotocol_separator value', () => {
      let capturedSetValue: string | undefined;

      const setNameSpy = vi.spyOn(Setting.prototype, 'setName').mockImplementation(function (this: Setting, name: string) {
        (this as unknown as Record<string, string>)['_lastName'] = name;
        return this;
      });
      const addDropdownSpy = vi.spyOn(Setting.prototype, 'addDropdown').mockImplementation(function (
        this: Setting,
        cb: (drop: unknown) => void
      ) {
        const lastName = (this as unknown as Record<string, string>)['_lastName'];
        if (lastName === 'Text separator') {
          const mockDrop = {
            addOption: (_v: string, _l: string) => mockDrop,
            setValue: (v: string) => { capturedSetValue = v; return mockDrop; },
            onChange: (_fn: (v: string) => void) => mockDrop,
          };
          cb(mockDrop);
        }
        return this;
      });

      const container = { createEl: vi.fn(), createDiv: vi.fn() } as unknown as HTMLElement;
      (view as unknown as {
        buildKindForm(c: HTMLElement, r: Record<string, unknown>, k: string): void;
      }).buildKindForm(container, { radiprotocol_separator: 'space' }, 'answer');

      setNameSpy.mockRestore();
      addDropdownSpy.mockRestore();

      expect(capturedSetValue).toBe('space');
    });

    // Test G: onChange with '' sets pendingEdits['radiprotocol_separator'] to undefined
    it('Test G: onChange with empty string sets pendingEdits radiprotocol_separator to undefined', () => {
      const onChange = captureSeparatorOnChange(view, {}, 'answer');
      expect(onChange).toBeDefined();
      onChange!('');
      const pending = (view as unknown as { pendingEdits: Record<string, unknown> }).pendingEdits;
      expect(pending['radiprotocol_separator']).toBeUndefined();
    });

    // Test H: onChange with 'space' sets pendingEdits['radiprotocol_separator'] to 'space'
    it('Test H: onChange with space sets pendingEdits radiprotocol_separator to space', () => {
      const onChange = captureSeparatorOnChange(view, {}, 'answer');
      expect(onChange).toBeDefined();
      onChange!('space');
      const pending = (view as unknown as { pendingEdits: Record<string, unknown> }).pendingEdits;
      expect(pending['radiprotocol_separator']).toBe('space');
    });
  });
});
