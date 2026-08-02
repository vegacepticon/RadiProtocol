// runner/render/render-question.ts
// Phase 87 — 2-zone render: textZone (question text, choices text, errors) + actionZone (answer/snippet buttons).
import type { AnswerNode, ProtocolGraph, RPEdge, SnippetNode } from '../../graph/graph-model';
import type { RunnerState } from '../runner-state';
import { isFileBoundSnippetNode, snippetBranchLabel } from '../snippet-label';
import { nodeLabel } from '../../graph/node-label';
import { orderedOutgoingEdges } from '../../graph/edge-order';
import { createButton } from '../../utils/dom-helpers';

type AtNodeState = Extract<RunnerState, { status: 'at-node' }>;

type RenderQuestionResult = 'rendered' | 'not-question' | 'error';

export interface QuestionBranchHost {
  bindClick(el: HTMLElement, handler: (ev: MouseEvent) => void): void;
  renderError(messages: string[]): void;
  onChooseAnswer(answerNode: AnswerNode): void | Promise<void>;
  onChooseSnippetBranch(snippetNode: SnippetNode, isFileBound: boolean): void | Promise<void>;
  onChooseQuestionBranch(edge: RPEdge): void | Promise<void>;
}

// Shared per-kind button construction for both the grouped fallback and the
// interleaved authored-order path so the CSS class, caption source, and
// callback payload are byte-for-byte identical — only the container/iteration
// order differs between the two render paths.
function appendAnswerButton(parent: HTMLElement, answerNode: AnswerNode, host: QuestionBranchHost): void {
  const btn = createButton(parent, {
    cls: 'rp-answer-btn',
    text: answerNode.displayLabel ?? answerNode.answerText,
  });
  host.bindClick(btn, () => {
    void host.onChooseAnswer(answerNode);
  });
}

function appendQuestionTransitionButton(parent: HTMLElement, edge: RPEdge, graph: ProtocolGraph, host: QuestionBranchHost): void {
  const target = graph.nodes.get(edge.toNodeId);
  const fallbackCaption = target !== undefined
    ? nodeLabel(target).trim() || edge.toNodeId
    : edge.toNodeId;
  const caption = edge.label !== undefined && edge.label.trim() !== ''
    ? edge.label
    : fallbackCaption;
  const btn = createButton(parent, {
    cls: 'rp-question-transition-btn',
    text: caption,
  });
  host.bindClick(btn, () => {
    void host.onChooseQuestionBranch(edge);
  });
}

function appendSnippetBranchButton(parent: HTMLElement, snippetNode: SnippetNode, host: QuestionBranchHost): void {
  const isFileBound = isFileBoundSnippetNode(snippetNode);
  const btn = createButton(parent, {
    cls: 'rp-snippet-branch-btn',
    text: snippetBranchLabel(snippetNode),
  });
  host.bindClick(btn, () => {
    void host.onChooseSnippetBranch(snippetNode, isFileBound);
  });
}

export function renderQuestionAtNode(
  textZone: HTMLElement,
  actionZone: HTMLElement,
  graph: ProtocolGraph | null,
  state: AtNodeState,
  host: QuestionBranchHost,
): RenderQuestionResult {
  if (graph === null) {
    host.renderError(['Internal error: graph not loaded.']);
    return 'error';
  }

  const node = graph.nodes.get(state.currentNodeId);
  if (node === undefined) {
    host.renderError([`Node "${state.currentNodeId}" not found in graph.`]);
    return 'error';
  }
  if (node.kind !== 'question') {
    return 'not-question';
  }

  textZone.createEl('p', {
    text: node.questionText,
    cls: 'rp-question-text',
  });

  // Authored display order: when the question carries an `optionOrder`, render
  // its outgoing options as a single interleaved stack in that order (answers,
  // question transitions, snippet branches interleaved). Per-kind button
  // construction is byte-for-byte identical to the grouped fallback below via
  // the shared append*Button helpers — only the container/iteration order
  // changes. When `optionOrder` is absent, the grouped edges-array fallback runs
  // unchanged (backward compatible).
  if (node.optionOrder !== undefined) {
    const orderedEdges = orderedOutgoingEdges(graph, state.currentNodeId);
    if (orderedEdges.length > 0) {
      const optionList = actionZone.createDiv({ cls: 'rp-option-list rp-stack' });
      optionList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
      for (const edge of orderedEdges) {
        const target = graph.nodes.get(edge.toNodeId);
        if (target === undefined) continue;
        if (target.kind === 'answer') {
          appendAnswerButton(optionList, target, host);
        } else if (target.kind === 'question') {
          appendQuestionTransitionButton(optionList, edge, graph, host);
        } else if (target.kind === 'snippet') {
          appendSnippetBranchButton(optionList, target, host);
        }
      }
    }
    return 'rendered';
  }

  // Phase 31: partition outgoing neighbors into answer + snippet branches.
  const neighborIds = graph.adjacency.get(state.currentNodeId) ?? [];
  const answerNeighbors: AnswerNode[] = [];
  const snippetNeighbors: SnippetNode[] = [];
  for (const nid of neighborIds) {
    const neighbor = graph.nodes.get(nid);
    if (neighbor === undefined) continue;
    if (neighbor.kind === 'answer') answerNeighbors.push(neighbor);
    else if (neighbor.kind === 'snippet') snippetNeighbors.push(neighbor);
  }

  if (answerNeighbors.length > 0) {
    const answerList = actionZone.createDiv({ cls: 'rp-answer-list rp-stack' });
    answerList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
    for (const answerNode of answerNeighbors) {
      appendAnswerButton(answerList, answerNode, host);
    }
  }

  // Direct Question transitions are edge-sensitive: preserve persisted edge
  // order, caption, and identity rather than reducing them to adjacency IDs.
  const questionEdges = graph.edges.filter((edge) => {
    if (edge.fromNodeId !== state.currentNodeId) return false;
    return graph.nodes.get(edge.toNodeId)?.kind === 'question';
  });

  if (questionEdges.length > 0) {
    const transitionList = actionZone.createDiv({ cls: 'rp-question-transition-list' });
    if (answerNeighbors.length === 0) {
      transitionList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
    }
    for (const edge of questionEdges) {
      appendQuestionTransitionButton(transitionList, edge, graph, host);
    }
  }

  if (snippetNeighbors.length > 0) {
    // Phase 31 D-02: snippet branches render below answers, visually distinct.
    const snippetList = actionZone.createDiv({ cls: 'rp-snippet-branch-list' });
    if (answerNeighbors.length === 0) {
      snippetList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
    }
    for (const snippetNode of snippetNeighbors) {
      appendSnippetBranchButton(snippetList, snippetNode, host);
    }
  }

  return 'rendered';
}
