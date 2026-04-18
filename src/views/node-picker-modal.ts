// views/node-picker-modal.ts
// Implements the "Start from specific node" picker (RUN-10 / D-06)
import { App, SuggestModal } from 'obsidian';
import type { ProtocolGraph, QuestionNode, TextBlockNode, SnippetNode, LoopNode } from '../graph/graph-model';

export interface NodeOption {
  id: string;
  label: string;
  kind: 'question' | 'text-block' | 'snippet' | 'loop';
}

/**
 * Phase 45 (LOOP-06, D-10): Russian kind badges rendered by renderSuggestion().
 * Exhaustive over NodeOption['kind'] — TypeScript will complain if a new kind
 * is added to the union without updating this map.
 */
export const KIND_LABELS: Record<NodeOption['kind'], string> = {
  'question': 'Вопрос',
  'text-block': 'Текст',
  'snippet': 'Сниппет',
  'loop': 'Цикл',
};

/**
 * Phase 45 (LOOP-06, D-08): sort key for kind-group ordering in buildNodeOptions.
 * Order: question (most common start) → loop (common for repeating blocks) →
 * text-block → snippet. Within each group options sort alphabetically by label.
 */
const KIND_ORDER: NodeOption['kind'][] = ['question', 'loop', 'text-block', 'snippet'];

/**
 * Build a sorted list of NodeOption values from a ProtocolGraph.
 * Includes question, text-block, snippet, and loop nodes (Phase 45 LOOP-06, D-06).
 *
 * Excluded by design (D-06 — осознанное отклонение от ROADMAP SC #3):
 *   - answer (renders as button under question, not a self-starting point)
 *   - start (implicit entry node, not author-picked)
 *   - free-text-input (scheduled for removal in Phase 46, CLEAN-01..04)
 *   - loop-start, loop-end (legacy parseable kinds — validator rejects canvases
 *     containing them via MIGRATE-01; they must not appear as picker options)
 *
 * Label fallback (D-07): every option carries a non-empty label — text field or node.id.
 * Sort order (D-08): kind-group entry order (see KIND_ORDER), alphabetical within group
 * via toLowerCase().localeCompare().
 */
export function buildNodeOptions(graph: ProtocolGraph): NodeOption[] {
  const options: NodeOption[] = [];

  for (const [id, node] of graph.nodes) {
    if (node.kind === 'question') {
      const q = node as QuestionNode;
      options.push({ id, label: q.questionText || id, kind: 'question' });
    } else if (node.kind === 'text-block') {
      const tb = node as TextBlockNode;
      const preview = tb.content.slice(0, 60);
      options.push({ id, label: preview || id, kind: 'text-block' });
    } else if (node.kind === 'snippet') {
      const s = node as SnippetNode;
      // D-07 + D-CL-05: subfolderPath может быть undefined → fallback '(корень snippets)';
      // id — последний fallback (defense-in-depth, не должен срабатывать так как '(корень snippets)' truthy).
      options.push({ id, label: s.subfolderPath || '(корень snippets)' || id, kind: 'snippet' });
    } else if (node.kind === 'loop') {
      const l = node as LoopNode;
      options.push({ id, label: l.headerText || id, kind: 'loop' });
    }
    // answer, start, free-text-input, loop-start, loop-end — сознательно исключены (D-06)
  }

  // D-08: kind-group entry order via KIND_ORDER indexOf, alphabetical within group.
  options.sort((a, b) => {
    const kaIdx = KIND_ORDER.indexOf(a.kind);
    const kbIdx = KIND_ORDER.indexOf(b.kind);
    if (kaIdx !== kbIdx) return kaIdx - kbIdx;
    return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
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
    el.createEl('small', { text: KIND_LABELS[option.kind], cls: 'rp-node-kind-badge' });
  }

  onChooseSuggestion(option: NodeOption, _evt: MouseEvent | KeyboardEvent): void {
    this.onChooseCb(option);
  }
}
