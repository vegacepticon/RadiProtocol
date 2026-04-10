// src/__tests__/editor-panel.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import the stub (will be replaced by full implementation in Plan 01)
import { EditorPanelView, EDITOR_PANEL_VIEW_TYPE } from '../views/editor-panel-view';
import { Setting } from 'obsidian';

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

  describe('UX-02 — answer textarea rows', () => {
    it('answer textarea inputEl.rows is set to 6', () => {
      // After Plan 03 adds ta.inputEl.rows = 6 in buildKindForm('answer'), this passes.
      // Currently fails because rows is not explicitly set (default is 2).
      //
      // Strategy: vi.mock('obsidian') auto-mocks Setting (all prototype methods are vi.fn()
      // returning undefined). We use mockImplementation to make the chaining methods return
      // the Setting instance, and addTextArea capture the ta.inputEl.rows after the callback.
      let capturedRows: number | undefined;

      // Make all chaining methods return `this` so buildKindForm's chain calls succeed.
      const settingProto = Setting.prototype as unknown as Record<string, ReturnType<typeof vi.fn>>;
      const chainMethods = ['setName', 'setDesc', 'setHeading', 'addText', 'addDropdown', 'addButton', 'addSlider'];
      for (const method of chainMethods) {
        if (settingProto[method] && typeof settingProto[method].mockImplementation === 'function') {
          settingProto[method].mockImplementation(function(this: unknown) { return this; });
        }
      }

      // addTextArea: capture rows after the callback runs
      if (settingProto['addTextArea'] && typeof settingProto['addTextArea'].mockImplementation === 'function') {
        settingProto['addTextArea'].mockImplementation(function(
          this: unknown,
          cb: (ta: { inputEl: { rows: number }; setValue: (v: string) => unknown; onChange: (cb: unknown) => unknown }) => void
        ) {
          const ta = { inputEl: { type: '', min: '', rows: 2 }, setValue: () => ta, onChange: () => ta };
          cb(ta);
          capturedRows = ta.inputEl.rows;
          return this;
        });
      }

      // Use a minimal mock container
      const mockContainer = {
        createEl: () => mockContainer,
        createDiv: () => mockContainer,
        empty: () => {},
        setText: () => {},
      } as unknown as HTMLElement;

      (view as unknown as { buildKindForm: (c: unknown, r: Record<string, unknown>, k: string) => void })
        .buildKindForm(mockContainer, {}, 'answer');

      // capturedRows should be 6 after Plan 03; currently it remains 2 (no rows assignment)
      expect(capturedRows).toBe(6);
    });
  });
});
