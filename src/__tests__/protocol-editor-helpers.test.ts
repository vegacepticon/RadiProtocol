import { describe, expect, it } from 'vitest';
import {
  canCreateProtocolEditorEdge,
  clampProtocolEditorZoom,
  defaultColorForProtocolEditorNodeKind,
  defaultProtocolEditorEdgeLabelForTarget,
  displayProtocolEditorEdgeLabel,
  fieldsForProtocolEditorNodeKind,
  isProtocolEditorLoopExitLabel,
  normalizeProtocolEditorEdgeLabel,
  normalizeProtocolEditorSnippetFolderSelection,
  protocolEditorEdgeRoute,
  removeProtocolEditorEdge,
  screenDeltaToProtocolEditorDelta,
  shouldAutoRefreshProtocolEditorEdgeLabel,
  shouldDisplayProtocolEditorEdgeLabel,
} from '../views/protocol-editor-view';
import type { ProtocolNodeRecord } from '../protocol/protocol-document';

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
    const answerNode: ProtocolNodeRecord = {
      id: 'answer',
      kind: 'answer',
      x: 0,
      y: 0,
      width: 160,
      height: 80,
      text: 'Answer text',
      fields: { displayLabel: 'Answer button', answerText: 'Answer body' },
    };
    const snippetNode: ProtocolNodeRecord = {
      id: 'snippet',
      kind: 'snippet',
      x: 0,
      y: 0,
      width: 160,
      height: 80,
      text: 'Snippet title',
      fields: { snippetLabel: 'Snippet button' },
    };
    const loopNodeA: ProtocolNodeRecord = {
      id: 'loop-a',
      kind: 'loop',
      x: 0,
      y: 0,
      width: 160,
      height: 80,
      text: 'Loop A',
      fields: {},
    };
    const loopNodeB: ProtocolNodeRecord = {
      id: 'loop-b',
      kind: 'loop',
      x: 0,
      y: 0,
      width: 160,
      height: 80,
      text: 'Loop B',
      fields: {},
    };
    const textNode: ProtocolNodeRecord = {
      id: 'text',
      kind: 'text-block',
      x: 0,
      y: 0,
      width: 160,
      height: 80,
      text: 'Text block',
      fields: { content: 'Text content' },
    };

    it('removes an edge by id without mutating the rest', () => {
      expect(removeProtocolEditorEdge([
        { id: 'e1', fromNodeId: 'a', toNodeId: 'b' },
        { id: 'e2', fromNodeId: 'b', toNodeId: 'c' },
      ], 'e1')).toEqual([{ id: 'e2', fromNodeId: 'b', toNodeId: 'c' }]);
    });

    it('normalizes loop exit labels with a leading plus', () => {
      expect(normalizeProtocolEditorEdgeLabel(' Exit ', true)).toBe('+Exit');
      expect(normalizeProtocolEditorEdgeLabel('+ Exit ', true)).toBe('+Exit');
      expect(normalizeProtocolEditorEdgeLabel('   ', true)).toBeUndefined();
      expect(displayProtocolEditorEdgeLabel('+ Exit')).toBe('Exit');
      expect(isProtocolEditorLoopExitLabel('+ Exit')).toBe(true);
      expect(isProtocolEditorLoopExitLabel('Body')).toBe(false);
    });

    it('removes leading plus when loop exit is disabled', () => {
      expect(normalizeProtocolEditorEdgeLabel('+ Exit ', false)).toBe('Exit');
      expect(normalizeProtocolEditorEdgeLabel('   ', false)).toBeUndefined();
    });

    it('derives edge labels only from answer and snippet button labels', () => {
      expect(defaultProtocolEditorEdgeLabelForTarget(answerNode)).toBe('Answer button');
      expect(defaultProtocolEditorEdgeLabelForTarget(snippetNode)).toBe('Snippet button');
      expect(defaultProtocolEditorEdgeLabelForTarget(textNode)).toBeUndefined();
      expect(defaultProtocolEditorEdgeLabelForTarget(loopNodeA)).toBeUndefined();
    });

    it('auto-refreshes only empty or previously generated edge labels', () => {
      expect(shouldAutoRefreshProtocolEditorEdgeLabel(undefined, 'Old')).toBe(true);
      expect(shouldAutoRefreshProtocolEditorEdgeLabel('   ', 'Old')).toBe(true);
      expect(shouldAutoRefreshProtocolEditorEdgeLabel('Old', 'Old')).toBe(true);
      expect(shouldAutoRefreshProtocolEditorEdgeLabel('Manual', 'Old')).toBe(false);
    });

    it('routes backward edges around nodes instead of through them', () => {
      const route = protocolEditorEdgeRoute(500, 100, 200, 120);
      expect(route.d).toContain('L 200');
      expect(route.labelY).toBeGreaterThan(120);
    });

    it('keeps forward edges as direct bezier curves', () => {
      const route = protocolEditorEdgeRoute(100, 100, 500, 120);
      expect(route.d).toContain('C');
      expect(route.d).not.toContain('L 500');
      expect(route.labelX).toBe(300);
    });

    it('shows labels for answer/snippet targets and loop-to-loop exit edges only', () => {
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'e1', fromNodeId: 'text', toNodeId: 'answer', label: undefined },
        textNode,
        answerNode,
      )).toBe(true);
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'e2', fromNodeId: 'text', toNodeId: 'snippet', label: undefined },
        textNode,
        snippetNode,
      )).toBe(true);
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'e3', fromNodeId: 'text', toNodeId: 'loop-a', label: 'Noise' },
        textNode,
        loopNodeA,
      )).toBe(false);
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'e4', fromNodeId: 'loop-a', toNodeId: 'loop-b', label: '+Exit' },
        loopNodeA,
        loopNodeB,
      )).toBe(true);
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'e5', fromNodeId: 'loop-a', toNodeId: 'loop-b', label: 'Body' },
        loopNodeA,
        loopNodeB,
      )).toBe(false);
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
      expect(clampProtocolEditorZoom(0.1)).toBe(0.1);
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
