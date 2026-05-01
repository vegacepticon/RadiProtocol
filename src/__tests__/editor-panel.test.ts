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

    it('getDisplayText returns Protocol node editor (sentence case)', () => {
      expect(view.getDisplayText()).toBe('Protocol node editor');
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
