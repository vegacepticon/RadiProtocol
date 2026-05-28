import { describe, expect, it } from 'vitest';
import {
  canCreateProtocolEditorEdge,
  clampProtocolEditorZoom,
  defaultColorForProtocolEditorNodeKind,
  defaultProtocolEditorEdgeLabelForTarget,
  displayProtocolEditorEdgeLabel,
  fieldsForProtocolEditorNodeKind,
  isProtocolEditorLoopExitLabel,
  nodeKindToken,
  nodeTitle,
  normalizeProtocolEditorEdgeLabel,
  normalizeProtocolEditorSnippetFolderSelection,
  protocolEditorEdgeRoute,
  protocolMissingFileError,
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

    it('routes backward horizontal edges around nodes instead of through them', () => {
      const route = protocolEditorEdgeRoute(500, 100, 200, 120, 'LR');
      expect(route.d).toContain('L 540 144');
      expect(route.d).toContain('L 136 168');
      expect(route.labelY).toBeGreaterThan(120);
    });

    it('keeps forward horizontal edges as stepped orthogonal segments', () => {
      const route = protocolEditorEdgeRoute(100, 100, 500, 120, 'LR');
      expect(route.d).toContain('Q 300 100 300 124');
      expect(route.d).toContain('L 500 120');
      expect(route.labelX).toBe(300);
    });

    it('routes forward vertical edges from bottom to top anchors with orthogonal bends', () => {
      const route = protocolEditorEdgeRoute(200, 100, 240, 420, 'TB');
      expect(route.d).toContain('Q 200 260 224 260');
      expect(route.d).toContain('L 240 420');
      expect(route.labelY).toBe(250);
    });

    it('routes backward vertical edges around the right side', () => {
      const route = protocolEditorEdgeRoute(200, 320, 160, 120, 'TB');
      expect(route.d).toContain('L 260 56');
      expect(route.labelX).toBeGreaterThan(260);
    });

    it('shows labels for answer/snippet targets and loop exit edges regardless of target kind', () => {
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
      // Loop-to-loop exit edge: preserved
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'e4', fromNodeId: 'loop-a', toNodeId: 'loop-b', label: '+Exit' },
        loopNodeA,
        loopNodeB,
      )).toBe(true);
      // Loop-to-loop body edge (no "+" prefix): not displayed
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'e5', fromNodeId: 'loop-a', toNodeId: 'loop-b', label: 'Body' },
        loopNodeA,
        loopNodeB,
      )).toBe(false);
      // Phase 50.1 EDGE-03 FIX: loop exit edge to a non-loop node (question/answer/text-block)
      // must still be displayed. The runner dispatches on the "+" prefix regardless of target kind.
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'e6', fromNodeId: 'loop-a', toNodeId: 'question-1', label: '+Выход' },
        loopNodeA,
        { id: 'question-1', kind: 'question', x: 0, y: 0, width: 160, height: 80, text: '', fields: { questionText: 'Q' } },
      )).toBe(true);
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'e7', fromNodeId: 'loop-a', toNodeId: 'answer-1', label: '+Да' },
        loopNodeA,
        answerNode,
      )).toBe(true);
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'e8', fromNodeId: 'loop-a', toNodeId: 'text-1', label: '+Завершить' },
        loopNodeA,
        textNode,
      )).toBe(true);
    });
  });

  describe('protocolMissingFileError', () => {
    it('throws an Error with the expected message', () => {
      expect(() => protocolMissingFileError()).toThrow('Protocol file disappeared');
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

  describe('nodeTitle untyped fallback (Phase 42 i18n)', () => {
    const nodeNoKindNoText: ProtocolNodeRecord = {
      id: 'n1',
      kind: null,
      x: 0, y: 0, width: 100, height: 60,
      text: '',
      fields: {},
    };

    it('returns i18n key via mock translator when kind is null and no text fallback', () => {
      const mockT = (key: string) => `[${key}]`;
      expect(nodeTitle(nodeNoKindNoText, mockT as never)).toBe('[protocolEditor.untyped]');
    });

    it('returns defaultT English value when no translator passed', () => {
      expect(nodeTitle(nodeNoKindNoText)).toBe('untyped');
    });

    it('returns node.text when available, never hitting untyped fallback', () => {
      const node: ProtocolNodeRecord = {
        id: 'n2',
        kind: null,
        x: 0, y: 0, width: 100, height: 60,
        text: 'My title',
        fields: {},
      };
      const mockT = (key: string) => `[${key}]`;
      expect(nodeTitle(node, mockT as never)).toBe('My title');
    });
  });

  describe('nodeTitle for all editable node kinds (keyboard aria-label regression #56)', () => {
    const kinds: Array<ProtocolNodeRecord['kind']> = ['start', 'question', 'answer', 'text-block', 'loop', 'snippet'];

    it('returns node.text when present for every editable kind', () => {
      for (const kind of kinds) {
        const node: ProtocolNodeRecord = {
          id: `${kind}-1`, kind, x: 0, y: 0, width: 100, height: 60,
          text: `${kind} label`, fields: {},
        };
        expect(nodeTitle(node), `kind=${kind}`).toBe(`${kind} label`);
      }
    });

    it('returns kind label via nodeKindToken when text is empty/undefined', () => {
      for (const kind of kinds) {
        const noText: ProtocolNodeRecord = {
          id: `${kind}-2`, kind, x: 0, y: 0, width: 100, height: 60,
          text: '', fields: {},
        };
        expect(nodeTitle(noText), `kind=${kind}`).toBe(kind);
      }
    });

    it('returns i18n untyped fallback when kind is null and text is empty', () => {
      const node: ProtocolNodeRecord = {
        id: 'untitled', kind: null, x: 0, y: 0, width: 100, height: 60,
        text: undefined as unknown as string, fields: {},
      };
      const mockT = (key: string) => `[${key}]`;
      expect(nodeTitle(node, mockT as never)).toBe('[protocolEditor.untyped]');
    });

    it('falls back to field values when text is empty', () => {
      const questionNode: ProtocolNodeRecord = {
        id: 'q1', kind: 'question', x: 0, y: 0, width: 100, height: 60,
        text: '', fields: { questionText: 'Where is the pain?' },
      };
      expect(nodeTitle(questionNode)).toBe('Where is the pain?');

      const answerNode: ProtocolNodeRecord = {
        id: 'a1', kind: 'answer', x: 0, y: 0, width: 100, height: 60,
        text: '', fields: { answerText: 'Left side' },
      };
      expect(nodeTitle(answerNode)).toBe('Left side');

      const textBlockNode: ProtocolNodeRecord = {
        id: 'tb1', kind: 'text-block', x: 0, y: 0, width: 100, height: 60,
        text: '', fields: { content: 'Report header' },
      };
      expect(nodeTitle(textBlockNode)).toBe('Report header');

      const answerWithLabel: ProtocolNodeRecord = {
        id: 'a2', kind: 'answer', x: 0, y: 0, width: 100, height: 60,
        text: '', fields: { displayLabel: 'Yes/No' },
      };
      expect(nodeTitle(answerWithLabel)).toBe('Yes/No');
    });
  });

  describe('nodeKindToken — raw "untyped" for CSS/attribute paths (Phase 44)', () => {
    it('returns the kind string when kind is non-null', () => {
      expect(nodeKindToken('question')).toBe('question');
      expect(nodeKindToken('loop')).toBe('loop');
    });

    it('returns raw "untyped" when kind is null — never i18n', () => {
      expect(nodeKindToken(null)).toBe('untyped');
    });

    it('returns a non-empty string for every editable node kind', () => {
      const editableKinds: Array<ProtocolNodeRecord['kind']> = ['start', 'question', 'answer', 'text-block', 'loop', 'snippet'];
      for (const kind of editableKinds) {
        expect(nodeKindToken(kind).length, `kind=${kind}`).toBeGreaterThan(0);
      }
    });

    it('returns null for kind=null when used as aria-label fallback source', () => {
      expect(nodeKindToken(null)).toBe('untyped');
      expect(typeof nodeKindToken(null)).toBe('string');
    });
  });
});
