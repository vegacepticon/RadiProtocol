// views/node-picker-modal.ts
// Implements the "Start from specific node" picker (RUN-10 / D-06)
import { App, SuggestModal } from 'obsidian';
import type { ProtocolGraph, QuestionNode, TextBlockNode } from '../graph/graph-model';

export interface NodeOption {
  id: string;
  label: string;
  kind: 'question' | 'text-block';
}

/**
 * Build a sorted list of NodeOption values from a ProtocolGraph.
 * Includes question nodes (by questionText) and text-block nodes (by content preview).
 * Excludes start, answer, free-text-input, loop-start, loop-end nodes.
 */
export function buildNodeOptions(graph: ProtocolGraph): NodeOption[] {
  const options: NodeOption[] = [];

  for (const [id, node] of graph.nodes) {
    if (node.kind === 'question') {
      options.push({ id, label: (node as QuestionNode).questionText, kind: 'question' });
    } else if (node.kind === 'text-block') {
      const preview = (node as TextBlockNode).content.slice(0, 60);
      options.push({ id, label: preview, kind: 'text-block' });
    }
  }

  // Sort: questions first, then text-blocks; within each group, alphabetically by label
  options.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'question' ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });

  return options;
}

/**
 * SuggestModal that presents question and text-block nodes for the
 * "Start from specific node" command (RUN-10 / D-06).
 *
 * Usage:
 *   const options = buildNodeOptions(graph);
 *   new NodePickerModal(app, options, (opt) => {
 *     void runnerView.openCanvas(canvasPath, opt.id);
 *   }).open();
 */
export class NodePickerModal extends SuggestModal<NodeOption> {
  private readonly options: NodeOption[];
  private readonly onChooseCb: (option: NodeOption) => void;

  constructor(app: App, options: NodeOption[], onChoose: (option: NodeOption) => void) {
    super(app);
    this.options = options;
    this.onChooseCb = onChoose;
    this.setPlaceholder('Search nodes by label\u2026');
  }

  getSuggestions(query: string): NodeOption[] {
    if (query.trim() === '') return this.options;
    const q = query.toLowerCase();
    return this.options.filter(o => o.label.toLowerCase().includes(q));
  }

  renderSuggestion(option: NodeOption, el: HTMLElement): void {
    el.createEl('div', { text: option.label });
    el.createEl('small', { text: option.kind, cls: 'rp-node-kind-badge' });
  }

  onChooseSuggestion(option: NodeOption, _evt: MouseEvent | KeyboardEvent): void {
    this.onChooseCb(option);
  }
}
