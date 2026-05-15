// node-picker-modal.test.ts
// Phase 45 (LOOP-06) — D-06..D-10 lock-in for buildNodeOptions + KIND_LABELS.
// buildNodeOptions is a pure function — no Obsidian mock directive required; the
// project's vitest config aliases 'obsidian' to the __mocks__ stub automatically.

import { describe, it, expect } from 'vitest';
import { buildNodeOptions, KIND_LABELS } from '../views/node-picker-modal';
import type {
  ProtocolGraph,
  RPNode,
  QuestionNode,
  TextBlockNode,
  SnippetNode,
  LoopNode,
  AnswerNode,
  StartNode,
  LoopStartNode,
  LoopEndNode,
} from '../graph/graph-model';

// ── Mock graph builder ──────────────────────────────────────────────────
function makeGraph(nodes: RPNode[]): ProtocolGraph {
  const map = new Map<string, RPNode>();
  for (const n of nodes) map.set(n.id, n);
  return {
    canvasFilePath: 'test.canvas',
    nodes: map,
    edges: [],
    adjacency: new Map(),
    reverseAdjacency: new Map(),
    startNodeId: nodes[0]?.id ?? '',
  };
}

// ── Node factories (zero-width/height OK — не влияют на buildNodeOptions) ──
const baseNodeProps = { x: 0, y: 0, width: 0, height: 0 };

function question(id: string, questionText: string): QuestionNode {
  return { ...baseNodeProps, id, kind: 'question', questionText };
}
function textBlock(id: string, content: string): TextBlockNode {
  return { ...baseNodeProps, id, kind: 'text-block', content };
}
function snippet(id: string, subfolderPath?: string): SnippetNode {
  return { ...baseNodeProps, id, kind: 'snippet', subfolderPath };
}
function loop(id: string, headerText: string): LoopNode {
  return { ...baseNodeProps, id, kind: 'loop', headerText };
}
function answer(id: string, answerText: string): AnswerNode {
  return { ...baseNodeProps, id, kind: 'answer', answerText };
}
function start(id: string): StartNode {
  return { ...baseNodeProps, id, kind: 'start' };
}
function loopStart(id: string, loopLabel: string, exitLabel: string): LoopStartNode {
  return { ...baseNodeProps, id, kind: 'loop-start', loopLabel, exitLabel };
}
function loopEnd(id: string, loopStartId: string): LoopEndNode {
  return { ...baseNodeProps, id, kind: 'loop-end', loopStartId };
}

// ── Tests ───────────────────────────────────────────────────────────────
describe('buildNodeOptions (Phase 45 LOOP-06 / D-06..D-08)', () => {
  it('returns options for all 4 startable kinds (question, text-block, snippet, loop)', () => {
    const g = makeGraph([
      question('q1', 'Is there a lesion?'),
      textBlock('t1', 'Some content'),
      snippet('s1', 'organ/lesion'),
      loop('l1', 'Lesion loop'),
    ]);
    const opts = buildNodeOptions(g);
    expect(opts).toHaveLength(4);
    const kindSet = new Set(opts.map(o => o.kind));
    expect(kindSet).toEqual(new Set(['question', 'text-block', 'snippet', 'loop']));
  });

  it('includes answer, start, question, text-block, snippet, loop; excludes only loop-start / loop-end', () => {
    const g = makeGraph([
      question('q1', 'Q'),
      answer('a1', 'A'),
      start('s1'),
      textBlock('tb1', 'text'),
      snippet('sn1', 'organ'),
      loop('l1', 'Loop'),
      loopStart('ls1', 'inner', 'выход'),
      loopEnd('le1', 'ls1'),
    ]);
    const opts = buildNodeOptions(g);
    expect(opts).toHaveLength(6);
    const kinds = opts.map(o => o.kind);
    expect(kinds).toContain('question');
    expect(kinds).toContain('answer');
    expect(kinds).toContain('start');
    expect(kinds).toContain('text-block');
    expect(kinds).toContain('snippet');
    expect(kinds).toContain('loop');
    expect(opts.find(o => (o.kind as string) === 'loop-start')).toBeUndefined();
    expect(opts.find(o => (o.kind as string) === 'loop-end')).toBeUndefined();
  });

  it('label falls back to id when primary text field is empty (D-07 — all 6 kinds)', () => {
    const g = makeGraph([
      question('q-empty', ''),          // questionText пустой → label === id
      textBlock('t-empty', ''),         // content пустой → label === id
      snippet('s-empty'),               // subfolderPath undefined → label === '(snippets root)'
      loop('l-empty', ''),              // headerText пустой → label === id
      answer('a-empty', ''),            // answerText пустой → label === id
      start('s-start'),                 // text пустой → label === id
    ]);
    const opts = buildNodeOptions(g);
    const byKind = Object.fromEntries(opts.map(o => [o.kind, o]));
    expect(byKind['question']?.label).toBe('q-empty');
    expect(byKind['text-block']?.label).toBe('t-empty');
    expect(byKind['snippet']?.label).toBe('(snippets root)');
    expect(byKind['loop']?.label).toBe('l-empty');
    expect(byKind['answer']?.label).toBe('a-empty');
    expect(byKind['start']?.label).toBe('s-start');
  });

  it('sorts kind-groups in entry order: start → question → answer → loop → text-block → snippet', () => {
    // Insertion order deliberately scrambled — output MUST be in KIND_ORDER sequence.
    const g = makeGraph([
      snippet('s1', 'a'),
      textBlock('t1', 'z content'),
      answer('a1', 'A'),
      start('s-start'),
      loop('l1', 'mid header'),
      question('q1', 'Start here'),
    ]);
    const opts = buildNodeOptions(g);
    expect(opts.map(o => o.kind)).toEqual(['start', 'question', 'answer', 'loop', 'text-block', 'snippet']);
  });

  it('sorts within-group alphabetically via toLowerCase().localeCompare (D-08)', () => {
    const g = makeGraph([
      question('q1', 'Zebra protocol'),
      question('q2', 'alpha check'),
      question('q3', 'Beta run'),
    ]);
    const opts = buildNodeOptions(g);
    // Case-insensitive alphabetical: alpha → Beta → Zebra
    expect(opts.map(o => o.label)).toEqual(['alpha check', 'Beta run', 'Zebra protocol']);
  });

  it('excludes legacy loop-start / loop-end even when unified loop also present', () => {
    const g = makeGraph([
      loopStart('ls1', 'legacy', 'выход'),
      loopEnd('le1', 'ls1'),
      loop('l1', 'Unified'),
    ]);
    const opts = buildNodeOptions(g);
    expect(opts).toHaveLength(1);
    expect(opts[0]?.kind).toBe('loop');
    expect(opts[0]?.label).toBe('Unified');
  });

  it('returns [] for empty graph', () => {
    const g = makeGraph([]);
    expect(buildNodeOptions(g)).toEqual([]);
  });
});

describe('KIND_LABELS (Phase 45 LOOP-06 / D-10)', () => {
  it('has Russian labels for exactly 6 startable kinds', () => {
    const keys = Object.keys(KIND_LABELS).sort();
    expect(keys).toEqual(['answer', 'loop', 'question', 'snippet', 'start', 'text-block']);
  });

  it('maps each kind to its locked English badge text', () => {
    expect(KIND_LABELS.question).toBe('Question');
    expect(KIND_LABELS['text-block']).toBe('Text');
    expect(KIND_LABELS.snippet).toBe('Snippet');
    expect(KIND_LABELS.loop).toBe('Loop');
  });
});
