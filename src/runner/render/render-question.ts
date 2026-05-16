// runner/render/render-question.ts
// Phase 87 — 2-zone render: textZone (question text, choices text, errors) + actionZone (answer/snippet buttons).
import type { AnswerNode, ProtocolGraph, SnippetNode } from '../../graph/graph-model';
import type { RunnerState } from '../runner-state';
import { isFileBoundSnippetNode, snippetBranchLabel } from '../snippet-label';
import { createButton } from '../../utils/dom-helpers';

export type AtNodeState = Extract<RunnerState, { status: 'at-node' }>;

export type RenderQuestionResult = 'rendered' | 'not-question' | 'error';

export interface QuestionBranchHost {
  bindClick(el: HTMLElement, handler: (ev: MouseEvent) => void): void;
  renderError(messages: string[]): void;
  onChooseAnswer(answerNode: AnswerNode): void | Promise<void>;
  onChooseSnippetBranch(snippetNode: SnippetNode, isFileBound: boolean): void | Promise<void>;
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
      const btn = createButton(answerList, {
        cls: 'rp-answer-btn',
        text: answerNode.displayLabel ?? answerNode.answerText,
      });
      host.bindClick(btn, () => {
        void host.onChooseAnswer(answerNode);
      });
    }
  }

  if (snippetNeighbors.length > 0) {
    // Phase 31 D-02: snippet branches render below answers, visually distinct.
    const snippetList = actionZone.createDiv({ cls: 'rp-snippet-branch-list' });
    if (answerNeighbors.length === 0) {
      snippetList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
    }
    for (const snippetNode of snippetNeighbors) {
      const isFileBound = isFileBoundSnippetNode(snippetNode);
      const btn = createButton(snippetList, {
        cls: 'rp-snippet-branch-btn',
        text: snippetBranchLabel(snippetNode),
      });
      host.bindClick(btn, () => {
        void host.onChooseSnippetBranch(snippetNode, isFileBound);
      });
    }
  }

  return 'rendered';
}
