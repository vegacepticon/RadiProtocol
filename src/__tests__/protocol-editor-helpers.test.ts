import { describe, expect, it } from 'vitest';
import {
  canCreateProtocolEditorEdge,
  clampProtocolEditorZoom,
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
