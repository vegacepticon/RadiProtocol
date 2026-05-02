// runner/render/render-loop-picker.ts
// Phase 75 DEDUP-01 — shared awaiting-loop-pick renderer.
import type { ProtocolGraph, RPEdge } from '../../graph/graph-model';
import { isExitEdge, nodeLabel, stripExitPrefix } from '../../graph/node-label';
import type { RunnerState } from '../runner-state';
import { renderRunnerFooter, type RunnerFooterHost } from './render-footer';

export type AwaitingLoopPickState = Extract<RunnerState, { status: 'awaiting-loop-pick' }>;

export interface LoopPickerHost extends RunnerFooterHost {
  renderError(messages: string[]): void;
  onChooseLoopBranch(edge: RPEdge, isExit: boolean): void | Promise<void>;
  onBack(): void;
}

export function renderLoopPicker(
  questionZone: HTMLElement,
  graph: ProtocolGraph | null,
  state: AwaitingLoopPickState,
  host: LoopPickerHost,
): boolean {
  if (graph === null) {
    host.renderError(['Internal error: graph not loaded.']);
    return false;
  }

  const node = graph.nodes.get(state.nodeId);
  if (node === undefined || node.kind !== 'loop') {
    host.renderError([`Loop node "${state.nodeId}" not found in graph.`]);
    return false;
  }

  // RUN-01: render headerText above picker when present.
  if (node.headerText !== '') {
    questionZone.createEl('p', {
      text: node.headerText,
      cls: 'rp-loop-header-text',
    });
  }

  // RUN-01: one button per outgoing edge (Pitfall 4 — filter edges, not adjacency).
  const outgoing = graph.edges.filter(e => e.fromNodeId === state.nodeId);
  const list = questionZone.createDiv({ cls: 'rp-loop-picker-list rp-stack-md' });
  for (const edge of outgoing) {
    // Phase 50.1 EDGE-03 — "+"-prefix convention:
    //   * "+"-prefixed edge → caption = stripExitPrefix(label), class = rp-loop-exit-btn.
    //   * non-"+" edge → caption = nodeLabel(target) fallback to target id, class = rp-loop-body-btn.
    const exit = isExitEdge(edge);
    let caption: string;
    if (exit) {
      caption = stripExitPrefix(edge.label ?? '');
    } else {
      const target = graph.nodes.get(edge.toNodeId);
      caption = target !== undefined ? nodeLabel(target) : edge.toNodeId;
    }
    const btn = list.createEl('button', {
      cls: exit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn',
      text: caption,
    });
    host.bindClick(btn, () => {
      void host.onChooseLoopBranch(edge, exit);
    });
  }

  // RUN-05: step-back footer row.
  renderRunnerFooter(questionZone, host, {
    showBack: state.canStepBack,
    onBack: host.onBack,
  });

  return true;
}
