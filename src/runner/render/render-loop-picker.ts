// runner/render/render-loop-picker.ts
// Phase 87 — 2-zone render: textZone (loop header text) + actionZone (body/exit buttons).
// Post loop→question merge: the picker renders for a looped Question, classifies exits
// via the explicit edge.isLoopExit flag, and uses verbatim exit labels.
import type { ProtocolGraph, RPEdge } from '../../graph/graph-model';
import { nodeLabel } from '../../graph/node-label';
import type { RunnerState } from '../runner-state';
import { createButton } from '../../utils/dom-helpers';

type AwaitingLoopPickState = Extract<RunnerState, { status: 'awaiting-loop-pick' }>;

export interface LoopPickerHost {
  bindClick(el: HTMLElement, handler: (ev: MouseEvent) => void): void;
  renderError(messages: string[]): void;
  onChooseLoopBranch(edge: RPEdge, isExit: boolean): void | Promise<void>;
}

export function renderLoopPicker(
  textZone: HTMLElement,
  actionZone: HTMLElement,
  graph: ProtocolGraph | null,
  state: AwaitingLoopPickState,
  host: LoopPickerHost,
): boolean {
  if (graph === null) {
    host.renderError(['Internal error: graph not loaded.']);
    return false;
  }

  const node = graph.nodes.get(state.nodeId);
  if (node === undefined || node.kind !== 'question' || !node.loop) {
    host.renderError([`Looped question "${state.nodeId}" not found in graph.`]);
    return false;
  }

  // Render the question text above the picker when non-empty.
  if (node.questionText !== '') {
    textZone.createEl('p', {
      text: node.questionText,
      cls: 'rp-loop-header-text',
    });
  }

  // RUN-01: one button per outgoing edge (Pitfall 4 — filter edges, not adjacency).
  const outgoing = graph.edges.filter(e => e.fromNodeId === state.nodeId);
  const list = actionZone.createDiv({ cls: 'rp-loop-picker-list rp-stack-md' });
  for (const edge of outgoing) {
    // Exit edges are identified by edge.isLoopExit === true (explicit metadata,
    // replacing the former `+`-prefix convention).
    //   * exit edge → caption = edge.label ?? '' (verbatim), class = rp-loop-exit-btn.
    //   * body edge → caption = nodeLabel(target) fallback to target id, class = rp-loop-body-btn.
    const exit = edge.isLoopExit === true;
    const target = graph.nodes.get(edge.toNodeId);
    const targetCaption = target !== undefined ? nodeLabel(target) : edge.toNodeId;
    const accessibleTargetCaption = targetCaption.trim() !== '' ? targetCaption : edge.toNodeId;
    const caption = exit ? edge.label ?? '' : targetCaption;
    const btn = createButton(list, {
      cls: exit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn',
      text: caption,
      attr: caption.trim() === '' ? { 'aria-label': accessibleTargetCaption } : undefined,
    });
    host.bindClick(btn, () => {
      void host.onChooseLoopBranch(edge, exit);
    });
  }

  return true;
}