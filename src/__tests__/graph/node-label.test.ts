// src/__tests__/graph/node-label.test.ts
// Phase 49 D-13 — unit tests for the shared node-label module.

import { describe, it, expect } from 'vitest';
import { nodeLabel, isLabeledEdge, isExitEdge, stripExitPrefix } from '../../graph/node-label';
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
// isExitEdge — D-10 (`+`-prefix predicate, Phase 49 alias removed)
// ─────────────────────────────────────────────────────────────────────────────
describe('isExitEdge (D-10 — edge label starts with "+" after trim)', () => {
  const base = { id: 'e', fromNodeId: 'a', toNodeId: 'b' };

  it.each([
    ['+выход',       true,  '"+" + Cyrillic caption'],
    ['+ выход',      true,  '"+" + ASCII space + caption'],
    ['+\u00a0выход', true,  '"+" + nbsp + caption'],
    ['  +выход  ',   true,  'surrounding whitespace (trim first)'],
    ['+',            true,  'lone "+" — D-08 rejects at validator'],
    ['+ ',           true,  '"+" + space — D-08 rejects at validator'],
    ['++foo',        true,  'double "+" — authors opting into "+foo" caption'],
    ['foo+',         false, 'suffix "+" is not a prefix'],
    ['выход',        false, 'Phase 49 legacy literal — no longer an exit'],
    ['',             false, 'empty string'],
  ])('label=%j → %s (%s)', (label, expected, _description) => {
    const edge: RPEdge = { ...base, label: label as string | undefined };
    expect(isExitEdge(edge)).toBe(expected);
  });

  it('undefined label → false', () => {
    const edge: RPEdge = { ...base };
    expect(isExitEdge(edge)).toBe(false);
  });

  it('null label → false (defensive off-spec)', () => {
    const edge = { ...base, label: null as unknown as string | undefined } as RPEdge;
    expect(isExitEdge(edge)).toBe(false);
  });

  it('D-10 alias-removal regression — isExitEdge is NOT the same reference as isLabeledEdge', () => {
    // Phase 49 exported `isExitEdge = isLabeledEdge` (alias). Phase 50.1 decouples
    // the two. This guard ensures a future refactor cannot silently re-alias and
    // re-introduce the Phase 49↔Phase 50 conflict on labeled body edges.
    expect(isExitEdge).not.toBe(isLabeledEdge);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stripExitPrefix — D-09 (strip one "+" plus following whitespace)
// ─────────────────────────────────────────────────────────────────────────────
describe('stripExitPrefix (D-09 — trim, slice(1), then /^\\s+/)', () => {
  it.each([
    ['+выход',       'выход',  'basic "+" + Cyrillic caption'],
    ['+ выход',      'выход',  'ASCII space after "+" is stripped'],
    ['+\u00a0выход', 'выход',  'nbsp after "+" is stripped (whitespace class)'],
    ['  +выход  ',   'выход',  'outer whitespace trimmed first'],
    ['+',            '',       'lone "+" — empty caption (D-08 rejects at validator)'],
    ['+ ',           '',       '"+" + space — empty after inner strip'],
    ['++foo',        '+foo',   'double "+" — removes exactly one'],
  ])('stripExitPrefix(%j) === %j (%s)', (input, expected, _description) => {
    expect(stripExitPrefix(input)).toBe(expected);
  });
});
