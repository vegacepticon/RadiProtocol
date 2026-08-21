// views/node-picker-modal.ts
// Implements the "Start from specific node" picker (RUN-10 / D-06)
import { App, SuggestModal } from 'obsidian';
import type { ProtocolGraph, QuestionNode, TextBlockNode, SnippetNode, RPNodeKind } from '../graph/graph-model';
import type { ProtocolEdgeRecord, ProtocolNodeRecord } from '../protocol/protocol-document';
import type RadiProtocolPlugin from '../main';
import { defaultT, type Translator } from '../i18n';

type StartableNodeKind = Extract<RPNodeKind, 'start' | 'question' | 'answer' | 'text-block' | 'snippet'>;

export interface NodeOption {
  id: string;
  label: string;
  kind: StartableNodeKind;
}

/**
 * Phase 84 (I18N-02): kind-badge label keys rendered by renderSuggestion().
 * Each entry is an i18n key under nodePicker.* — resolved at render time
 * against the active locale. Exhaustive over NodeOption['kind'].
 */
export const KIND_LABEL_KEYS: Record<NodeOption['kind'], string> = {
  'start': 'nodePicker.start',
  'question': 'nodePicker.question',
  'answer': 'nodePicker.answer',
  'text-block': 'nodePicker.textBlock',
  'snippet': 'nodePicker.snippet',
};

/**
 * Phase 84 (I18N-02): English-resolved KIND_LABELS retained for callers that
 * still expect a literal string (notably tests). Production rendering uses
 * KIND_LABEL_KEYS + the plugin's translator for live-locale output.
 */
export const KIND_LABELS: Record<NodeOption['kind'], string> = {
  'start': defaultT('nodePicker.start'),
  'question': defaultT('nodePicker.question'),
  'answer': defaultT('nodePicker.answer'),
  'text-block': defaultT('nodePicker.textBlock'),
  'snippet': defaultT('nodePicker.snippet'),
};

/**
 * Phase 45 (LOOP-06, D-08): sort key for kind-group ordering in buildNodeOptions.
 * Order: start → question → answer → text-block → snippet. Within each
 * group options sort alphabetically by label.
 *
 * Phase 45 WR-02 fix: keyed as Record<NodeOption['kind'], number> so TypeScript
 * enforces exhaustiveness the same way KIND_LABELS does. Adding a new kind to
 * the NodeOption['kind'] union without updating KIND_ORDER will now fail the
 * TS build at the declaration site instead of silently mapping to indexOf === -1
 * at runtime (which previously clustered unknown kinds ahead of every known group).
 */
const KIND_ORDER: Record<NodeOption['kind'], number> = {
  'start':      0,
  'question':   1,
  'answer':     2,
  'text-block': 3,
  'snippet':    4,
};

/**
 * Build a sorted list of NodeOption values from a ProtocolGraph.
 * Includes start, question, answer, text-block, and snippet nodes (Phase 45 LOOP-06, D-06).
 * Looped questions appear as ordinary question options via the Question branch.
 *
 * Excluded by design (D-06 — deliberate deviation from ROADMAP SC #3):
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
function sortNodeOptions(options: NodeOption[]): NodeOption[] {
  options.sort((a, b) => {
    const kaIdx = KIND_ORDER[a.kind];
    const kbIdx = KIND_ORDER[b.kind];
    if (kaIdx !== kbIdx) return kaIdx - kbIdx;
    return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
  });
  return options;
}

export function buildNodeOptions(graph: ProtocolGraph, t: Translator = defaultT): NodeOption[] {
  const options: NodeOption[] = [];

  for (const [id, node] of graph.nodes) {
    if (node.kind === 'start') {
      options.push({ id, label: node.text || id, kind: 'start' });
    } else if (node.kind === 'question') {
      const q = node as QuestionNode;
      options.push({ id, label: q.questionText || id, kind: 'question' });
    } else if (node.kind === 'answer') {
      options.push({ id, label: node.text || id, kind: 'answer' });
    } else if (node.kind === 'text-block') {
      const tb = node as TextBlockNode;
      const preview = tb.content.slice(0, 60);
      options.push({ id, label: preview || id, kind: 'text-block' });
    } else if (node.kind === 'snippet') {
      const s = node as SnippetNode;
      options.push({ id, label: s.snippetLabel || s.subfolderPath || t('nodePicker.rootSnippets'), kind: 'snippet' });
    }
  }

  return sortNodeOptions(options);
}

function stringField(record: ProtocolNodeRecord, key: string): string | undefined {
  const value = record.fields[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * Graph distance (BFS hop count) from the document's start node to every
 * reachable node, used to order "start from specific node" picker options by
 * protocol position: nodes closer to start appear first. Nodes unreachable
 * from start get distance Infinity and sort last, keeping their relative
 * document order.
 */
function graphDistancesFromStart(nodes: ProtocolNodeRecord[], edges: ProtocolEdgeRecord[]): Map<string, number> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.fromNodeId);
    if (list === undefined) adjacency.set(edge.fromNodeId, [edge.toNodeId]);
    else list.push(edge.toNodeId);
  }
  const startNode = nodes.find((node) => node.kind === 'start');
  const distances = new Map<string, number>();
  if (startNode === undefined) return distances;
  distances.set(startNode.id, 0);
  const queue = [startNode.id];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const distance = distances.get(current) ?? 0;
    for (const next of adjacency.get(current) ?? []) {
      if (distances.has(next)) continue;
      distances.set(next, distance + 1);
      queue.push(next);
    }
  }
  return distances;
}

export function buildStartableProtocolNodeOptions(
  nodes: ProtocolNodeRecord[],
  t: Translator = defaultT,
  edges: ProtocolEdgeRecord[] = [],
): NodeOption[] {
  const options: NodeOption[] = [];
  for (const node of nodes) {
    if (node.kind === null || node.fields['startPointEnabled'] !== true) continue;
    if (node.kind === 'loop-start' || node.kind === 'loop-end') continue;
    const customLabel = stringField(node, 'startPointLabel');
    const label =
      customLabel ??
      stringField(node, 'displayLabel') ??
      stringField(node, 'snippetLabel') ??
      stringField(node, 'questionText') ??
      stringField(node, 'answerText') ??
      stringField(node, 'content') ??
      node.text ??
      (node.kind === 'snippet' ? t('nodePicker.rootSnippets') : node.id);
    options.push({ id: node.id, label, kind: node.kind });
  }
  // Order by protocol position (BFS distance from start); alphabetical only as
  // a tie-break for same-distance options. Unreachable-from-start options sort
  // last in document order.
  const distances = graphDistancesFromStart(nodes, edges);
  const docIndexById = new Map(nodes.map((node, index) => [node.id, index] as [string, number]));
  options.sort((a, b) => {
    const da = distances.get(a.id) ?? Number.POSITIVE_INFINITY;
    const db = distances.get(b.id) ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    const ia = docIndexById.get(a.id) ?? 0;
    const ib = docIndexById.get(b.id) ?? 0;
    if (ia !== ib) return ia - ib;
    return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
  });
  return options;
}

/**
 * SuggestModal that presents start, question, answer, text-block, and snippet
 * nodes for the "Start from specific node" command (RUN-10 / D-06).
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
    this.setPlaceholder(this.t('nodePicker.searchPlaceholder'));
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
