import { describe, expect, it } from 'vitest';
import {
  canCreateProtocolEditorEdge,
  clampProtocolEditorZoom,
  defaultColorForProtocolEditorNodeKind,
  displayProtocolEditorEdgeLabel,
  fieldsForProtocolEditorNodeKind,
  isProtocolEditorLoopExitLabel,
  normalizeProtocolEditorEdgeLabel,
  normalizeProtocolEditorSnippetFolderSelection,
  removeProtocolEditorEdge,
  screenDeltaToProtocolEditorDelta,
} from '../views/protocol-editor-view';

describe('protocol editor helper functions', () => {
  describe('canCreateProtocolEditorEdge', () => {
    it('allows a new directed edge', () => {
      expect(canCreateProtocolEditorEdge([], 'a', 'b')).toBe('ok');
    });

    it('rejects self edges', () => {
      expect(canCreateProtocolEditorEdge([], 'a', 'a')).toBe('self');
    });

    it('rejects duplicate same-direction edges', () => {
      expect(canCreateProtocolEditorEdge([{ fromNodeId: 'a', toNodeId: 'b' }], 'a', 'b')).toBe('duplicate');
    });

    it('allows reverse direction as a distinct edge', () => {
      expect(canCreateProtocolEditorEdge([{ fromNodeId: 'a', toNodeId: 'b' }], 'b', 'a')).toBe('ok');
    });
  });

  describe('edge helpers', () => {
    it('removes an edge by id without mutating the rest', () => {
      expect(removeProtocolEditorEdge([
        { id: 'e1', fromNodeId: 'a', toNodeId: 'b' },
        { id: 'e2', fromNodeId: 'b', toNodeId: 'c' },
      ], 'e1')).toEqual([{ id: 'e2', fromNodeId: 'b', toNodeId: 'c' }]);
    });

    it('normalizes loop exit labels with a leading plus', () => {
      expect(normalizeProtocolEditorEdgeLabel(' Exit ', true)).toBe('+Exit');
      expect(normalizeProtocolEditorEdgeLabel('+ Exit ', true)).toBe('+Exit');
      expect(displayProtocolEditorEdgeLabel('+ Exit')).toBe('Exit');
      expect(isProtocolEditorLoopExitLabel('+ Exit')).toBe(true);
      expect(isProtocolEditorLoopExitLabel('Body')).toBe(false);
    });

    it('removes leading plus when loop exit is disabled', () => {
      expect(normalizeProtocolEditorEdgeLabel('+ Exit ', false)).toBe('Exit');
      expect(normalizeProtocolEditorEdgeLabel('   ', false)).toBeUndefined();
    });
  });

  describe('node and snippet helpers', () => {
    it('normalizes snippet folder/file selections', () => {
      expect(normalizeProtocolEditorSnippetFolderSelection('/ct/chest/')).toBe('ct/chest');
      expect(normalizeProtocolEditorSnippetFolderSelection('   ')).toBeUndefined();
    });

    it('returns kind-specific defaults for node type changes', () => {
      expect(fieldsForProtocolEditorNodeKind('question')).toEqual({ questionText: '' });
      expect(defaultColorForProtocolEditorNodeKind('snippet')).toContain('156');
    });
  });

  describe('zoom helpers', () => {
    it('clamps zoom to editor bounds', () => {
      expect(clampProtocolEditorZoom(0.1)).toBe(0.4);
      expect(clampProtocolEditorZoom(3)).toBe(2);
      expect(clampProtocolEditorZoom(1.25)).toBe(1.25);
    });

    it('falls back to 1 for invalid zoom values', () => {
      expect(clampProtocolEditorZoom(Number.NaN)).toBe(1);
      expect(clampProtocolEditorZoom(Number.POSITIVE_INFINITY)).toBe(1);
    });

    it('converts screen movement to canvas movement under zoom', () => {
      expect(screenDeltaToProtocolEditorDelta(100, 2)).toBe(50);
      expect(screenDeltaToProtocolEditorDelta(100, 0.5)).toBe(200);
    });
  });
});
