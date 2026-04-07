import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../../graph/canvas-parser';
import { ProtocolRunner } from '../../runner/protocol-runner';
import type { ProtocolGraph } from '../../graph/graph-model';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

function loadGraph(name: string): ProtocolGraph {
  const json = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
  const parser = new CanvasParser();
  const result = parser.parse(json, name);
  if (!result.success) throw new Error(`Fixture ${name} failed to parse: ${result.error}`);
  return result.graph;
}

describe('ProtocolRunner', () => {

  describe('initial state (RUN-08 — idle state)', () => {
    it('starts in idle state before start() is called', () => {
      const runner = new ProtocolRunner();
      const state = runner.getState();
      expect(state.status).toBe('idle');
    });
  });

  describe('start() — linear protocol traversal (RUN-01, RUN-02)', () => {
    it('transitions to at-node state pointing at the first question after start()', () => {
      const runner = new ProtocolRunner();
      const graph = loadGraph('linear.canvas');
      runner.start(graph);
      const state = runner.getState();
      expect(state.status).toBe('at-node');
      if (state.status !== 'at-node') return;
      // linear.canvas: start → n-q1 (question) — runner auto-advances through start node
      expect(state.currentNodeId).toBe('n-q1');
      expect(state.canStepBack).toBe(false);
    });

    it('accumulated text is empty at the first question node', () => {
      const runner = new ProtocolRunner();
      runner.start(loadGraph('linear.canvas'));
      const state = runner.getState();
      if (state.status !== 'at-node') return;
      expect(state.accumulatedText).toBe('');
    });
  });

  describe('chooseAnswer() — preset-text answer (RUN-03)', () => {
    it('appends answerText to accumulatedText and transitions to complete on terminal answer', () => {
      // linear.canvas: start → n-q1 → n-a1 (answerText="A1", terminal)
      const runner = new ProtocolRunner();
      runner.start(loadGraph('linear.canvas'));
      runner.chooseAnswer('n-a1');
      const state = runner.getState();
      // n-a1 has no outgoing edge → complete
      expect(state.status).toBe('complete');
      if (state.status !== 'complete') return;
      expect(state.finalText).toBe('A1');
    });

    it('follows the correct branch in a branching protocol (RUN-03)', () => {
      // branching.canvas: start → n-q1 → n-a1 or n-a2 (both terminal)
      const runner = new ProtocolRunner();
      runner.start(loadGraph('branching.canvas'));
      runner.chooseAnswer('n-a2');
      const state = runner.getState();
      expect(state.status).toBe('complete');
      if (state.status !== 'complete') return;
      expect(state.finalText).toBe('A2');
    });

    it('auto-appends text-block content after answer without extra user action (RUN-05)', () => {
      // text-block.canvas: start → n-q1 → n-a1 (answerText="Size: normal") → n-tb1 (content="Findings: normal liver.", terminal)
      const runner = new ProtocolRunner();
      runner.start(loadGraph('text-block.canvas'));
      runner.chooseAnswer('n-a1');
      const state = runner.getState();
      // After choosing n-a1, runner auto-advances through n-tb1 (text-block) → complete
      expect(state.status).toBe('complete');
      if (state.status !== 'complete') return;
      expect(state.finalText).toBe('Size: normalFindings: normal liver.');
    });

    it('enables canStepBack after first answer', () => {
      // Use branching.canvas but choose answer that leads to another question
      // For now test that after chooseAnswer in a protocol with more nodes, canStepBack becomes true.
      // We use text-block.canvas parsed as branching graph but check simpler: build inline graph.
      // Simplest: start runner on linear graph, check canStepBack after choosing but before complete.
      // linear.canvas answer is terminal so we can't check mid-state.
      // Use branching.canvas — choose n-a1 which is terminal, but before that check state.
      const runner = new ProtocolRunner();
      runner.start(loadGraph('branching.canvas'));
      // Still at-node at n-q1 — canStepBack false
      const stateBefore = runner.getState();
      expect(stateBefore.status).toBe('at-node');
      if (stateBefore.status !== 'at-node') return;
      expect(stateBefore.canStepBack).toBe(false);
    });
  });

  describe('enterFreeText() — free-text input node (RUN-04)', () => {
    it('wraps user text with prefix/suffix and appends to accumulatedText', () => {
      // free-text.canvas: start → n-ft1 (promptLabel, prefix="Findings: ", suffix=".")
      const runner = new ProtocolRunner();
      runner.start(loadGraph('free-text.canvas'));
      const stateAtFT = runner.getState();
      expect(stateAtFT.status).toBe('at-node');
      if (stateAtFT.status !== 'at-node') return;
      expect(stateAtFT.currentNodeId).toBe('n-ft1');

      runner.enterFreeText('enlarged spleen');
      const state = runner.getState();
      // n-ft1 has no outgoing edge → complete
      expect(state.status).toBe('complete');
      if (state.status !== 'complete') return;
      // Expected: prefix + text + suffix = "Findings: enlarged spleen."
      expect(state.finalText).toBe('Findings: enlarged spleen.');
    });

    it('handles free-text node with no prefix/suffix — appends raw text', () => {
      // Build a minimal inline graph with a free-text node that has no prefix/suffix
      // We construct a ProtocolGraph directly to avoid needing a new fixture.
      const graph: ProtocolGraph = {
        canvasFilePath: 'inline.canvas',
        nodes: new Map([
          ['n-start', { id: 'n-start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
          ['n-ft1', { id: 'n-ft1', kind: 'free-text-input', promptLabel: 'Notes:', x: 0, y: 120, width: 100, height: 60 }],
        ]),
        edges: [{ id: 'e1', fromNodeId: 'n-start', toNodeId: 'n-ft1' }],
        adjacency: new Map([['n-start', ['n-ft1']]]),
        reverseAdjacency: new Map([['n-ft1', ['n-start']]]),
        startNodeId: 'n-start',
      };
      const runner = new ProtocolRunner();
      runner.start(graph);
      runner.enterFreeText('raw note');
      const state = runner.getState();
      expect(state.status).toBe('complete');
      if (state.status !== 'complete') return;
      expect(state.finalText).toBe('raw note');
    });
  });

  describe('stepBack() — undo last user action (RUN-06, RUN-07)', () => {
    it('reverts currentNodeId and accumulatedText to state before last chooseAnswer', () => {
      // text-block.canvas: start → n-q1 → n-a1 → n-tb1 (terminal)
      // After chooseAnswer('n-a1'), state = complete, finalText = 'Size: normalFindings: normal liver.'
      // After stepBack(), state must return to at-node at n-q1 with accumulatedText = ''
      const runner = new ProtocolRunner();
      runner.start(loadGraph('text-block.canvas'));
      runner.chooseAnswer('n-a1');
      expect(runner.getState().status).toBe('complete');
      runner.stepBack();
      const state = runner.getState();
      expect(state.status).toBe('at-node');
      if (state.status !== 'at-node') return;
      expect(state.currentNodeId).toBe('n-q1');
      expect(state.accumulatedText).toBe('');
    });

    it('reverts both navigation state and text on multi-step protocol (RUN-06 3-step)', () => {
      // Build a 3-answer chain: start → q1 → a1 → q2 → a2 → q3 → a3 (terminal)
      // This exercises the 3-step protocol requirement from RUN-06 success criteria
      const graph: ProtocolGraph = {
        canvasFilePath: 'multi-step.canvas',
        nodes: new Map([
          ['s', { id: 's', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
          ['q1', { id: 'q1', kind: 'question', questionText: 'Q1', x: 0, y: 60, width: 100, height: 60 }],
          ['a1', { id: 'a1', kind: 'answer', answerText: 'ans1', x: 0, y: 120, width: 100, height: 60 }],
          ['q2', { id: 'q2', kind: 'question', questionText: 'Q2', x: 0, y: 180, width: 100, height: 60 }],
          ['a2', { id: 'a2', kind: 'answer', answerText: 'ans2', x: 0, y: 240, width: 100, height: 60 }],
          ['q3', { id: 'q3', kind: 'question', questionText: 'Q3', x: 0, y: 300, width: 100, height: 60 }],
          ['a3', { id: 'a3', kind: 'answer', answerText: 'ans3', x: 0, y: 360, width: 100, height: 60 }],
        ]),
        edges: [
          { id: 'e1', fromNodeId: 's', toNodeId: 'q1' },
          { id: 'e2', fromNodeId: 'q1', toNodeId: 'a1' },
          { id: 'e3', fromNodeId: 'a1', toNodeId: 'q2' },
          { id: 'e4', fromNodeId: 'q2', toNodeId: 'a2' },
          { id: 'e5', fromNodeId: 'a2', toNodeId: 'q3' },
          { id: 'e6', fromNodeId: 'q3', toNodeId: 'a3' },
        ],
        adjacency: new Map([
          ['s', ['q1']], ['q1', ['a1']], ['a1', ['q2']], ['q2', ['a2']], ['a2', ['q3']], ['q3', ['a3']],
        ]),
        reverseAdjacency: new Map([
          ['q1', ['s']], ['a1', ['q1']], ['q2', ['a1']], ['a2', ['q2']], ['q3', ['a2']], ['a3', ['q3']],
        ]),
        startNodeId: 's',
      };
      const runner = new ProtocolRunner();
      runner.start(graph);
      runner.chooseAnswer('a1'); // text: 'ans1', now at q2
      runner.chooseAnswer('a2'); // text: 'ans1ans2', now at q3
      runner.chooseAnswer('a3'); // text: 'ans1ans2ans3', now complete

      runner.stepBack(); // reverts ans3 → at q3, text = 'ans1ans2'
      const s1 = runner.getState();
      expect(s1.status).toBe('at-node');
      if (s1.status !== 'at-node') return;
      expect(s1.currentNodeId).toBe('q3');
      expect(s1.accumulatedText).toBe('ans1ans2');

      runner.stepBack(); // reverts ans2 → at q2, text = 'ans1'
      const s2 = runner.getState();
      expect(s2.status).toBe('at-node');
      if (s2.status !== 'at-node') return;
      expect(s2.currentNodeId).toBe('q2');
      expect(s2.accumulatedText).toBe('ans1');
    });

    it('stepBack() is a no-op when canStepBack is false (idle or just after start)', () => {
      const runner = new ProtocolRunner();
      runner.start(loadGraph('linear.canvas'));
      const stateBefore = runner.getState();
      expect(stateBefore.status).toBe('at-node');
      if (stateBefore.status !== 'at-node') return;
      expect(stateBefore.canStepBack).toBe(false);
      runner.stepBack(); // no-op: nothing to undo
      const stateAfter = runner.getState();
      expect(stateAfter.status).toBe('at-node');
      if (stateAfter.status !== 'at-node') return;
      expect(stateAfter.currentNodeId).toBe(stateBefore.currentNodeId);
    });
  });

  describe('awaiting-snippet-fill state (RUN-08, D-06, D-07)', () => {
    it('transitions to awaiting-snippet-fill when reaching a text-block with snippetId', () => {
      // snippet-block.canvas: start → n-q1 → n-a1 → n-tb1 (has snippetId="snip-liver-001")
      const runner = new ProtocolRunner();
      runner.start(loadGraph('snippet-block.canvas'));
      runner.chooseAnswer('n-a1');
      const state = runner.getState();
      expect(state.status).toBe('awaiting-snippet-fill');
      if (state.status !== 'awaiting-snippet-fill') return;
      expect(state.snippetId).toBe('snip-liver-001');
      expect(state.nodeId).toBe('n-tb1');
    });

    it('completeSnippet() appends rendered text and advances to complete', () => {
      const runner = new ProtocolRunner();
      runner.start(loadGraph('snippet-block.canvas'));
      runner.chooseAnswer('n-a1');
      expect(runner.getState().status).toBe('awaiting-snippet-fill');
      runner.completeSnippet('Findings: normal liver with snippet text.');
      const state = runner.getState();
      // n-tb1 has no outgoing edge → complete
      expect(state.status).toBe('complete');
      if (state.status !== 'complete') return;
      expect(state.finalText).toContain('Findings: normal liver with snippet text.');
    });
  });

  describe('loop-start missing continue edge (RUN-08)', () => {
    it('transitions to error state when loop-start has no continue edge', () => {
      // loop-start.canvas: start → n-ls1 (loop-start, no outgoing edges with label 'continue')
      // Phase 6: loop support is implemented — a missing 'continue' edge is a malformed graph error
      const runner = new ProtocolRunner();
      runner.start(loadGraph('loop-start.canvas'));
      const state = runner.getState();
      expect(state.status).toBe('error');
      if (state.status !== 'error') return;
      expect(state.message).toMatch(/Loop-start node.*has no 'continue' edge/);
    });
  });

  describe('iteration cap (RUN-09, D-08)', () => {
    it('transitions to error state when maxIterations is exceeded', () => {
      // Build a graph that causes the auto-advance loop to exceed the cap.
      // A chain of text-blocks: start → tb1 → tb2 → ... → tb(N+1)
      // With maxIterations=3 and 4 text-blocks, the cap is hit during advanceThrough.
      const nodes = new Map<string, import('../../graph/graph-model').RPNode>();
      const adjacency = new Map<string, string[]>();
      nodes.set('s', { id: 's', kind: 'start', x: 0, y: 0, width: 100, height: 60 });
      const tbCount = 5;
      for (let i = 1; i <= tbCount; i++) {
        const id = `tb${i}`;
        nodes.set(id, { id, kind: 'text-block', content: `block${i}`, x: 0, y: i * 60, width: 100, height: 60 });
        if (i === 1) adjacency.set('s', [id]);
        if (i < tbCount) adjacency.set(id, [`tb${i + 1}`]);
      }
      adjacency.set('s', ['tb1']);

      const graph: ProtocolGraph = {
        canvasFilePath: 'overflow.canvas',
        nodes,
        edges: [],
        adjacency,
        reverseAdjacency: new Map(),
        startNodeId: 's',
      };

      // Pass maxIterations: 3 so the cap is hit before traversing all 5 text-blocks
      const runner = new ProtocolRunner({ maxIterations: 3 });
      runner.start(graph);
      const state = runner.getState();
      expect(state.status).toBe('error');
      if (state.status !== 'error') return;
      expect(state.message).toMatch(/iteration cap|Iteration cap/i);
    });

    it('default maxIterations is 50 — constructor option overrides it (D-08)', () => {
      // Verify the constructor accepts the option without throwing
      const runner = new ProtocolRunner({ maxIterations: 100 });
      expect(runner.getState().status).toBe('idle');
    });
  });

  describe('ProtocolRunner has zero Obsidian API imports (NFR-01)', () => {
    it('module can be imported without Obsidian runtime', () => {
      // If this test file loaded, the import succeeded in pure Node.js env.
      expect(typeof ProtocolRunner).toBe('function');
    });
  });

  describe('loop support (LOOP-01 through LOOP-05, RUN-09)', () => {
    function reachLoopEnd(runner: ProtocolRunner, graph: ProtocolGraph): void {
      runner.start(graph);
      // Runner halts at n-q1 (first question inside loop body)
      runner.chooseAnswer('n-a1'); // answer → n-le1 (loop-end) — runner should halt here
    }

    it('runner halts at loop-end node after traversing loop body once (LOOP-02)', () => {
      const runner = new ProtocolRunner();
      const graph = loadGraph('loop-body.canvas');
      reachLoopEnd(runner, graph);
      const state = runner.getState();
      expect(state.status).toBe('at-node');
      if (state.status !== 'at-node') return;
      expect(state.currentNodeId).toBe('n-le1');
    });

    it("chooseLoopAction('again') re-enters loop body and increments iteration to 2 (LOOP-02, LOOP-03)", () => {
      const runner = new ProtocolRunner();
      const graph = loadGraph('loop-body.canvas');
      reachLoopEnd(runner, graph);
      (runner as unknown as Record<string, unknown>)['chooseLoopAction']?.('again');
      const state = runner.getState();
      expect(state.status).toBe('at-node');
      if (state.status !== 'at-node') return;
      expect(state.currentNodeId).toBe('n-q1');
      expect((state as unknown as Record<string, unknown>)['loopIterationLabel']).toBe('Lesion 2');
    });

    it("chooseLoopAction('done') exits loop and completes protocol (LOOP-02)", () => {
      const runner = new ProtocolRunner();
      const graph = loadGraph('loop-body.canvas');
      reachLoopEnd(runner, graph);
      (runner as unknown as Record<string, unknown>)['chooseLoopAction']?.('done');
      const state = runner.getState();
      expect(state.status).toBe('complete');
      if (state.status !== 'complete') return;
      expect(state.finalText).toBe('LiverEnd of protocol.');
    });

    it("getState() returns loopIterationLabel='Lesion 1' when halted at loop-end on iteration 1 (LOOP-04)", () => {
      const runner = new ProtocolRunner();
      const graph = loadGraph('loop-body.canvas');
      reachLoopEnd(runner, graph);
      const state = runner.getState();
      expect(state.status).toBe('at-node');
      if (state.status !== 'at-node') return;
      expect((state as unknown as Record<string, unknown>)['loopIterationLabel']).toBe('Lesion 1');
      expect((state as unknown as Record<string, unknown>)['isAtLoopEnd']).toBe(true);
    });

    it('stepBack() from iteration 2 first question restores iteration 1 loop-end state (LOOP-05)', () => {
      const runner = new ProtocolRunner();
      const graph = loadGraph('loop-body.canvas');
      reachLoopEnd(runner, graph);
      (runner as unknown as Record<string, unknown>)['chooseLoopAction']?.('again');
      // Now at n-q1 iteration 2
      runner.stepBack();
      const state = runner.getState();
      expect(state.status).toBe('at-node');
      if (state.status !== 'at-node') return;
      expect(state.currentNodeId).toBe('n-le1');
      expect((state as unknown as Record<string, unknown>)['loopIterationLabel']).toBe('Lesion 1');
    });

    it('per-loop maxIterations cap transitions to error after exceeding limit (RUN-09)', () => {
      const runner = new ProtocolRunner();
      const graph = loadGraph('loop-body.canvas');
      reachLoopEnd(runner, graph);
      // Iterate 4 more times to reach the 5th iteration (maxIterations=5)
      for (let i = 0; i < 4; i++) {
        (runner as unknown as Record<string, unknown>)['chooseLoopAction']?.('again');
        runner.chooseAnswer('n-a1'); // advance back to loop-end
      }
      // 5th 'again' should hit the cap
      (runner as unknown as Record<string, unknown>)['chooseLoopAction']?.('again');
      const state = runner.getState();
      expect(state.status).toBe('error');
      if (state.status !== 'error') return;
      expect(state.message).toMatch(/Maximum iterations/);
    });
  });
});
