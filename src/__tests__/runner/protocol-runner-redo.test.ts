// src/__tests__/runner/protocol-runner-redo.test.ts
// Tests for the undo/redo stack: canRedo, redo(), forward-action clears redo.

import { describe, it, expect } from 'vitest';
import { ProtocolRunner } from '../../runner/protocol-runner';
import { branchingGraph, linearGraph } from '../fixtures/protocol-document-fixtures';

describe('ProtocolRunner — redo', () => {
  it('canRedo is false after start() (no undo yet)', () => {
    const runner = new ProtocolRunner();
    runner.start(linearGraph());
    const state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canRedo).toBe(false);
  });

  it('canRedo becomes true after stepBack(); redo() restores state and clears canRedo', () => {
    const runner = new ProtocolRunner();
    const graph = branchingGraph();
    runner.start(graph);

    let state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canRedo).toBe(false);

    // Choose an answer to push an undo entry
    const neighbors = graph.adjacency.get(state.currentNodeId) ?? [];
    const firstNeighbor = graph.nodes.get(neighbors[0]!);
    if (firstNeighbor?.kind !== 'answer') return;
    runner.chooseAnswer(firstNeighbor.id);

    state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canStepBack).toBe(true);
    expect(state.canRedo).toBe(false);

    // Step back
    runner.stepBack();
    state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canStepBack).toBe(false);
    expect(state.canRedo).toBe(true);

    // Redo
    runner.redo();
    state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canRedo).toBe(false);
    expect(state.currentNodeId).toBe(firstNeighbor.id);
    expect(state.canStepBack).toBe(true);
  });

  it('redo() is a no-op when canRedo is false (redoStack empty)', () => {
    const runner = new ProtocolRunner();
    runner.start(branchingGraph());
    const stateBefore = runner.getState();
    if (stateBefore.status !== 'at-node') return;
    expect(stateBefore.canRedo).toBe(false);

    runner.redo(); // should be a no-op
    const stateAfter = runner.getState();
    if (stateAfter.status !== 'at-node') return;
    expect(stateAfter.currentNodeId).toBe(stateBefore.currentNodeId);
  });

  it('forward action after stepBack() clears redoStack (canRedo → false)', () => {
    const runner = new ProtocolRunner();
    const graph = branchingGraph();
    runner.start(graph);

    let state = runner.getState();
    if (state.status !== 'at-node') return;
    const q1Id = state.currentNodeId;

    // Choose first answer
    const neighbors = graph.adjacency.get(q1Id) ?? [];
    const firstAnswer = graph.nodes.get(neighbors[0]!);
    if (firstAnswer?.kind !== 'answer') return;
    runner.chooseAnswer(firstAnswer.id);

    state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canStepBack).toBe(true);

    // Step back
    runner.stepBack();
    state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canRedo).toBe(true);

    // Choose a different forward action — should clear redo
    const secondAnswer = graph.nodes.get(neighbors[1]!);
    if (secondAnswer?.kind === 'answer') {
      runner.chooseAnswer(secondAnswer.id);
    } else {
      // If no second answer, use skip
      runner.skip();
    }

    state = runner.getState();
    // After a forward action, redo should be cleared
    if (state.status === 'at-node') {
      expect(state.canRedo).toBe(false);
    }
  });

  it('multiple stepBack/redo cycles preserve state', () => {
    const runner = new ProtocolRunner();
    const graph = branchingGraph();
    runner.start(graph);

    let state = runner.getState();
    if (state.status !== 'at-node') return;
    const q1Id = state.currentNodeId;

    // Choose first answer to advance
    const neighbors = graph.adjacency.get(q1Id) ?? [];
    const firstAnswer = graph.nodes.get(neighbors[0]!);
    if (firstAnswer?.kind !== 'answer') return;
    runner.chooseAnswer(firstAnswer.id);

    // Step back → redo → step back → redo
    runner.stepBack();
    state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canRedo).toBe(true);

    runner.redo();
    state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canRedo).toBe(false);

    runner.stepBack();
    state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canRedo).toBe(true);

    runner.redo();
    state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canRedo).toBe(false);
    // Should be back at the same node after redo
    expect(state.currentNodeId).toBe(firstAnswer.id);
  });

  it('start() clears redoStack', () => {
    const runner = new ProtocolRunner();
    const graph = branchingGraph();
    runner.start(graph);

    let state = runner.getState();
    if (state.status !== 'at-node') return;
    const q1Id = state.currentNodeId;

    const neighbors = graph.adjacency.get(q1Id) ?? [];
    const firstAnswer = graph.nodes.get(neighbors[0]!);
    if (firstAnswer?.kind !== 'answer') return;
    runner.chooseAnswer(firstAnswer.id);

    runner.stepBack();
    state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canRedo).toBe(true);

    // restart
    runner.start(graph);
    state = runner.getState();
    if (state.status !== 'at-node') return;
    expect(state.canRedo).toBe(false);
  });
});