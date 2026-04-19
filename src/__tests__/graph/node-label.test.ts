// src/__tests__/graph/node-label.test.ts
// Phase 49 D-13 — unit tests for the shared node-label module.

import { describe, it, expect } from 'vitest';
import { nodeLabel, isLabeledEdge, isExitEdge } from '../../graph/node-label';
import type { RPNode, RPEdge } from '../../graph/graph-model';

// ─────────────────────────────────────────────────────────────────────────────
// nodeLabel — all 8 RPNodeKind arms
// ─────────────────────────────────────────────────────────────────────────────
describe('nodeLabel', () => {
  const baseRect = { x: 0, y: 0, width: 200, height: 60 };

  it('start → `start (${id})`', () => {
    const node: RPNode = { id: 'n-s', kind: 'start', ...baseRect };
    expect(nodeLabel(node)).toBe('start (n-s)');
  });

  it('question → questionText when non-empty, else id fallback', () => {
    expect(nodeLabel({ id: 'q1', kind: 'question', questionText: 'Size?', ...baseRect })).toBe('Size?');
    expect(nodeLabel({ id: 'q2', kind: 'question', questionText: '', ...baseRect })).toBe('q2');
  });

  it('answer → displayLabel when defined, else answerText, else id fallback', () => {
    expect(nodeLabel({ id: 'a1', kind: 'answer', answerText: '1 cm', displayLabel: 'Small', ...baseRect })).toBe('Small');
    expect(nodeLabel({ id: 'a2', kind: 'answer', answerText: '1 cm', ...baseRect })).toBe('1 cm');
    expect(nodeLabel({ id: 'a3', kind: 'answer', answerText: '', ...baseRect })).toBe('a3');
  });

  it('text-block → first 30 chars of content, else id fallback', () => {
    expect(nodeLabel({ id: 't1', kind: 'text-block', content: 'short', ...baseRect })).toBe('short');
    expect(nodeLabel({ id: 't2', kind: 'text-block', content: 'x'.repeat(40), ...baseRect })).toBe('x'.repeat(30));
    expect(nodeLabel({ id: 't3', kind: 'text-block', content: '', ...baseRect })).toBe('t3');
  });

  it('loop-start (deprecated) → loopLabel || id', () => {
    expect(nodeLabel({ id: 'ls1', kind: 'loop-start', loopLabel: 'L', exitLabel: 'выход', ...baseRect })).toBe('L');
    expect(nodeLabel({ id: 'ls2', kind: 'loop-start', loopLabel: '', exitLabel: 'выход', ...baseRect })).toBe('ls2');
  });

  it('loop-end (deprecated) → `loop-end (${id})`', () => {
    expect(nodeLabel({ id: 'le1', kind: 'loop-end', loopStartId: 'ls1', ...baseRect })).toBe('loop-end (le1)');
  });

  it('snippet → subfolderPath variant, else `snippet (root)`', () => {
    expect(nodeLabel({ id: 's1', kind: 'snippet', subfolderPath: 'Findings/Chest', ...baseRect } as RPNode)).toBe('snippet (Findings/Chest)');
    expect(nodeLabel({ id: 's2', kind: 'snippet', ...baseRect } as RPNode)).toBe('snippet (root)');
  });

  it('loop → headerText || id (Phase 43 D-11)', () => {
    expect(nodeLabel({ id: 'lp1', kind: 'loop', headerText: 'Lesion loop', ...baseRect })).toBe('Lesion loop');
    expect(nodeLabel({ id: 'lp2', kind: 'loop', headerText: '', ...baseRect })).toBe('lp2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isLabeledEdge — D-05 trim semantics
// ─────────────────────────────────────────────────────────────────────────────
describe('isLabeledEdge (D-05 — labeled iff .trim() is non-empty)', () => {
  const base = { id: 'e', fromNodeId: 'a', toNodeId: 'b' };

  it.each([
    [undefined, false, 'undefined label'],
    ['', false, 'empty string'],
    [' ', false, 'single space'],
    ['\t', false, 'tab'],
    ['\n', false, 'newline'],
    ['  \t  ', false, 'mixed whitespace'],
    ['выход', true, 'Russian exit keyword'],
    ['exit', true, 'English word'],
    ['a', true, 'single char'],
    ['проверка', true, 'Russian body-branch keyword'],
    [' x ', true, 'non-empty with surrounding whitespace'],
  ])('label=%j → %s (%s)', (label, expected, _description) => {
    const edge: RPEdge = { ...base, label: label as string | undefined };
    expect(isLabeledEdge(edge)).toBe(expected);
  });

  it('handles explicitly null label defensively (off-spec but not a crash)', () => {
    const edge = { ...base, label: null as unknown as string | undefined } as RPEdge;
    expect(isLabeledEdge(edge)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isExitEdge — D-07 alias contract
// ─────────────────────────────────────────────────────────────────────────────
describe('isExitEdge (D-07)', () => {
  it('is the same function reference as isLabeledEdge', () => {
    expect(isExitEdge).toBe(isLabeledEdge);
  });

  it('behaves identically on a labeled edge', () => {
    const edge: RPEdge = { id: 'e', fromNodeId: 'a', toNodeId: 'b', label: 'выход' };
    expect(isExitEdge(edge)).toBe(true);
    expect(isLabeledEdge(edge)).toBe(true);
  });

  it('behaves identically on an unlabeled edge', () => {
    const edge: RPEdge = { id: 'e', fromNodeId: 'a', toNodeId: 'b' };
    expect(isExitEdge(edge)).toBe(false);
    expect(isLabeledEdge(edge)).toBe(false);
  });
});
