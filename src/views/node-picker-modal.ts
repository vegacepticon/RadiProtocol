// views/node-picker-modal.ts
// Implements the "Start from specific node" picker (RUN-10 / D-06)
import { App, SuggestModal } from 'obsidian';
import type { ProtocolGraph, QuestionNode, TextBlockNode, SnippetNode, LoopNode } from '../graph/graph-model';
import type RadiProtocolPlugin from '../main';
import { defaultT, type Translator } from '../i18n';

export interface NodeOption {
  id: string;
  label: string;
  kind: 'question' | 'text-block' | 'snippet' | 'loop';
}

/**
 * Phase 84 (I18N-02): kind-badge label keys rendered by renderSuggestion().
 * Each entry is an i18n key under nodePicker.* — resolved at render time
 * against the active locale. Exhaustive over NodeOption['kind'].
 */
export const KIND_LABEL_KEYS: Record<NodeOption['kind'], string> = {
  'question': 'nodePicker.question',
  'text-block': 'nodePicker.textBlock',
  'snippet': 'nodePicker.snippet',
  'loop': 'nodePicker.loop',
};

/**
 * Phase 84 (I18N-02): English-resolved KIND_LABELS retained for callers that
 * still expect a literal string (notably tests). Production rendering uses
 * KIND_LABEL_KEYS + the plugin's translator for live-locale output.
 */
export const KIND_LABELS: Record<NodeOption['kind'], string> = {
  'question': defaultT('nodePicker.question'),
  'text-block': defaultT('nodePicker.textBlock'),
  'snippet': defaultT('nodePicker.snippet'),
  'loop': defaultT('nodePicker.loop'),
};

/**
 * Phase 45 (LOOP-06, D-08): sort key for kind-group ordering in buildNodeOptions.
 * Order: question (most common start) → loop (common for repeating blocks) →
 * text-block → snippet. Within each group options sort alphabetically by label.
 *
 * Phase 45 WR-02 fix: keyed as Record<NodeOption['kind'], number> so TypeScript
 * enforces exhaustiveness the same way KIND_LABELS does. Adding a new kind to
 * the NodeOption['kind'] union without updating KIND_ORDER will now fail the
 * TS build at the declaration site instead of silently mapping to indexOf === -1
 * at runtime (which previously clustered unknown kinds ahead of every known group).
 */
const KIND_ORDER: Record<NodeOption['kind'], number> = {
  'question':   0,
  'loop':       1,
  'text-block': 2,
  'snippet':    3,
};

/**
 * Build a sorted list of NodeOption values from a ProtocolGraph.
 * Includes question, text-block, snippet, and loop nodes (Phase 45 LOOP-06, D-06).
 *
 * Excluded by design (D-06 — deliberate deviation from ROADMAP SC #3):
 *   - answer (renders as button under question, not a self-starting point)
 *   - start (implicit entry node, not author-picked)
 *   - loop-start, loop-end (legacy parseable kinds — validator rejects canvases
 *     containing them via MIGRATE-01; they must not appear as picker options)
 *
 * Label fallback (D-07): every option carries a non-empty label — text field or node.id.
 * Sort order (D-08): kind-group entry order (see KIND_ORDER), alphabetical within group
 * via toLowerCase().localeCompare().
 *
 * Phase 84 (I18N-02): the snippet-row fallback label ("(snippets root)") is
 * resolved through the optional translator so it follows the active locale.
 */
export function buildNodeOptions(graph: ProtocolGraph, t: Translator = defaultT): NodeOption[] {
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
      // D-07 + D-CL-05: subfolderPath may be undefined → fallback "(snippets root)" (i18n-keyed);
      // id — final fallback (defense-in-depth; should never fire because the i18n key resolves truthy).
      options.push({ id, label: s.subfolderPath || t('nodePicker.rootSnippets'), kind: 'snippet' });
    } else if (node.kind === 'loop') {
      const l = node as LoopNode;
      options.push({ id, label: l.headerText || id, kind: 'loop' });
    }
    // answer, start, loop-start, loop-end — deliberately excluded (D-06)
  }

  // D-08: kind-group entry order via KIND_ORDER lookup, alphabetical within group.
  // Phase 45 WR-02 fix: KIND_ORDER is now a Record<kind, number> so lookup cannot
  // return -1 for unknown kinds — TypeScript enforces exhaustiveness at the
  // declaration site (see KIND_ORDER JSDoc above).
  options.sort((a, b) => {
    const kaIdx = KIND_ORDER[a.kind];
    const kbIdx = KIND_ORDER[b.kind];
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
  /** Phase 84 (I18N-02): translator used for the kind-badge label rendered on
   *  each suggestion row. Optional so existing two-arg callers keep working
   *  with the English-default fallback. */
  private readonly t: Translator;

  constructor(
    app: App,
    options: NodeOption[],
    onChoose: (option: NodeOption) => void,
    plugin?: RadiProtocolPlugin,
  ) {
    super(app);
    this.options = options;
    this.onChooseCb = onChoose;
    this.t = plugin ? plugin.i18n.t.bind(plugin.i18n) : defaultT;
    this.setPlaceholder('Search nodes by label\u2026');
  }

  getSuggestions(query: string): NodeOption[] {
    if (query.trim() === '') return this.options;
    const q = query.toLowerCase();
    return this.options.filter(o => o.label.toLowerCase().includes(q));
  }

  renderSuggestion(option: NodeOption, el: HTMLElement): void {
    el.createEl('div', { text: option.label });
    el.createEl('small', { text: this.t(KIND_LABEL_KEYS[option.kind]), cls: 'rp-node-kind-badge' });
  }

  onChooseSuggestion(option: NodeOption, _evt: MouseEvent | KeyboardEvent): void {
    void _evt;
    this.onChooseCb(option);
  }
}
