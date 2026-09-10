// Regression for the loop-frame leak: a loop whose isLoopExit edge targets the
// same node its body branch auto-advances into ("trivial" loop) must have its
// frame closed when the body is walked — otherwise a later dead end returns
// the user to a picker they already finished (real bug on «ОГК ОБП ОМТ short»).

import { describe, it, expect } from 'vitest';
import { ProtocolRunner } from '../../runner/protocol-runner';
import type {
  ProtocolGraph,
  RPNode,
  RPEdge,
  QuestionNode,
  AnswerNode,
  SnippetNode,
  StartNode,
} from '../../graph/graph-model';

function makeStart(id = 'n-start'): StartNode {
  return { kind: 'start', id, x: 0, y: 0, width: 50, height: 50 };
}

function makeLoopedQuestion(id: string, questionText = 'Есть изменения?'): QuestionNode {
  return { kind: 'question', id, questionText, loop: true, x: 0, y: 0, width: 100, height: 40 };
}

function makeQuestion(id: string, questionText: string): QuestionNode {
  return { kind: 'question', id, questionText, x: 0, y: 0, width: 100, height: 40 };
}

function makeSnippet(id: string, path: string): SnippetNode {
  return { kind: 'snippet', id, x: 0, y: 0, width: 100, height: 40, radiprotocol_snippetPath: path } as SnippetNode;
}

function makeAnswer(id: string, answerText: string): AnswerNode {
  return { kind: 'answer', id, answerText, x: 0, y: 0, width: 100, height: 40 };
}

function buildGraph(
  nodes: RPNode[],
  edgeList: Array<[string, string, string?, boolean?]>,
  startNodeId: string,
): ProtocolGraph {
  const nodeMap = new Map<string, RPNode>();
  for (const n of nodes) nodeMap.set(n.id, n);
  const edges: RPEdge[] = edgeList.map(([from, to, label, isLoopExit], i) => ({
    id: `e-${i}`,
    fromNodeId: from,
    toNodeId: to,
    ...(label !== undefined ? { label } : {}),
    ...(isLoopExit === true ? { isLoopExit: true } : {}),
  }));
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjacency.has(e.fromNodeId)) adjacency.set(e.fromNodeId, []);
    adjacency.get(e.fromNodeId)!.push(e.toNodeId);
    if (!reverseAdjacency.has(e.toNodeId)) reverseAdjacency.set(e.toNodeId, []);
    reverseAdjacency.get(e.toNodeId)!.push(e.fromNodeId);
  }
  return {
    canvasFilePath: 'test.rp.json',
    nodes: nodeMap,
    edges,
    adjacency,
    reverseAdjacency,
    startNodeId,
  };
}

function loopFrameIds(runner: ProtocolRunner): string[] {
  const s = runner.getSerializableState();
  if (s === null) return [];
  return s.loopContextStack.map((f) => f.loopNodeId);
}

describe('trivial loop exit — body walk closes the frame, later dead ends complete', () => {
  it('snippet body branch does not leak the frame into a later dead-end answer', () => {
    // start → loopQ ─(exit «Дальше»)→ tailQ ─→ deadEndAnswer (no outgoing edge)
    //            └─(body «Сниппет»)→ snippet ─┘   (same continuation as the exit!)
    const graph = buildGraph(
      [
        makeStart(),
        makeLoopedQuestion('loopQ'),
        makeSnippet('sn', 'snips/organ.md'),
        makeQuestion('tailQ', 'Костные изменения есть?'),
        makeAnswer('deadEnd', '\n\nЗаключение:'),
      ],
      [
        ['n-start', 'loopQ'],
        ['loopQ', 'tailQ', 'Дальше', true],   // exit — targets tailQ
        ['loopQ', 'sn', 'Вставить сниппет'],  // body — auto-advances into tailQ too
        ['sn', 'tailQ'],
        ['tailQ', 'deadEnd', 'Есть'],
      ],
      'n-start',
    );
    const runner = new ProtocolRunner();
    runner.start(graph);

    expect(runner.getState().status).toBe('awaiting-loop-pick');
    const bodyEdge = graph.edges.find((e) => e.fromNodeId === 'loopQ' && e.label === 'Вставить сниппет');
    expect(runner.chooseLoopBranch(bodyEdge!.id)).toBe(true);
    expect(runner.getState().status).toBe('awaiting-snippet-fill');
    runner.completeSnippet('Печень без изменений.');

    // Auto-advance lands on tailQ via the snippet — the frame must be closed.
    expect(runner.getState().status).toBe('at-node');
    expect(loopFrameIds(runner)).toEqual([]);

    // Dead-end answer now completes instead of returning to the stale picker.
    const answerEdge = graph.edges.find((e) => e.fromNodeId === 'tailQ');
    expect(runner.chooseAnswer(answerEdge!.toNodeId)).toBe(true);
    expect(runner.getState().status).toBe('complete');
  });

  it('non-trivial deeper frames survive a trivial inner-frame pop', () => {
    // Outer loop's exit re-enters the walk BEFORE the outer question, so it must stay open.
    const graph = buildGraph(
      [
        makeStart(),
        makeLoopedQuestion('outerQ', 'Внешний цикл?'),
        makeLoopedQuestion('innerQ', 'Внутренний цикл?'),
        makeSnippet('sn2', 'snips/x.md'),
        makeQuestion('tailQ2', 'Финал?'),
        makeAnswer('deadEnd2', 'Конец'),
      ],
      [
        ['n-start', 'outerQ'],
        // outer body → innerQ (a loop itself)
        ['outerQ', 'innerQ', 'Внутрь'],
        // inner trivial loop: body snippet and exit both continue into tailQ2
        ['innerQ', 'sn2', 'Сниппет'],
        ['sn2', 'tailQ2'],
        ['innerQ', 'tailQ2', 'Дальше', true],
        // outer exit → deadEnd2 (NOT tailQ2, so walking the inner body must not pop it)
        ['outerQ', 'deadEnd2', 'Завершить', true],
        ['tailQ2', 'deadEnd2', 'Ответ'],
      ],
      'n-start',
    );
    const runner = new ProtocolRunner();
    runner.start(graph);

    expect(runner.getState().status).toBe('awaiting-loop-pick'); // outerQ
    const intoInner = graph.edges.find((e) => e.fromNodeId === 'outerQ' && e.label === 'Внутрь');
    expect(runner.chooseLoopBranch(intoInner!.id)).toBe(true);
    expect(runner.getState().status).toBe('awaiting-loop-pick'); // innerQ

    const innerBody = graph.edges.find((e) => e.fromNodeId === 'innerQ' && e.label === 'Сниппет');
    expect(runner.chooseLoopBranch(innerBody!.id)).toBe(true);
    runner.completeSnippet('Текст.');

    // Inner (trivial) frame closed; outer frame survives — its exit targets elsewhere.
    expect(runner.getState().status).toBe('at-node');
    expect(loopFrameIds(runner)).toEqual(['outerQ']);
  });
});
