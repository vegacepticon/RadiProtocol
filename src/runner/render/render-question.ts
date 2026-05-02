// runner/render/render-question.ts
// Phase 75 DEDUP-01 — shared at-node question/answer/snippet branch renderer.
import type { AnswerNode, ProtocolGraph, SnippetNode } from '../../graph/graph-model';
import type { RunnerState } from '../runner-state';
import { isFileBoundSnippetNode, snippetBranchLabel } from '../snippet-label';
import { renderRunnerFooter, type RunnerFooterHost } from './render-footer';

export type AtNodeState = Extract<RunnerState, { status: 'at-node' }>;

export type RenderQuestionResult = 'rendered' | 'not-question' | 'error';

export interface QuestionBranchHost extends RunnerFooterHost {
  renderError(messages: string[]): void;
  onChooseAnswer(answerNode: AnswerNode): void | Promise<void>;
  onChooseSnippetBranch(snippetNode: SnippetNode, isFileBound: boolean): void | Promise<void>;
  onBack(): void;
  onSkip?(): void;
  canSkip?: boolean;
}

export function renderQuestionAtNode(
  questionZone: HTMLElement,
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

  questionZone.createEl('p', {
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
    const answerList = questionZone.createDiv({ cls: 'rp-answer-list' });
    for (const answerNode of answerNeighbors) {
      const btn = answerList.createEl('button', {
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
    const snippetList = questionZone.createDiv({ cls: 'rp-snippet-branch-list' });
    for (const snippetNode of snippetNeighbors) {
      const isFileBound = isFileBoundSnippetNode(snippetNode);
      const btn = snippetList.createEl('button', {
        cls: 'rp-snippet-branch-btn',
        text: snippetBranchLabel(snippetNode),
      });
      host.bindClick(btn, () => {
        void host.onChooseSnippetBranch(snippetNode, isFileBound);
      });
    }
  }

  // Phase 65 RUNNER-02: Skip is rendered in the shared footer row after all
  // answer and snippet branch lists, never between mixed branch groups.
  renderRunnerFooter(questionZone, host, {
    showBack: state.canStepBack,
    onBack: host.onBack,
    showSkip: answerNeighbors.length > 0 && host.canSkip === true,
    onSkip: host.onSkip,
  });

  return 'rendered';
}
