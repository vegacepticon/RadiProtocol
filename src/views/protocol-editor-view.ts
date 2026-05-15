import { ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { ProtocolDocumentV1, ProtocolEdgeRecord, ProtocolNodeRecord } from '../protocol/protocol-document';
import type { RPNodeKind } from '../graph/graph-model';
import { SnippetTreePicker, type SnippetTreePickerResult } from './snippet-tree-picker';

export const PROTOCOL_EDITOR_VIEW_TYPE = 'radiprotocol-protocol-editor';

/* Phase 4D — default node dimensions and kind-specific defaults */
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 80;
const DEFAULT_VIEWPORT_WIDTH = 20000;
const DEFAULT_VIEWPORT_HEIGHT = 16000;
const PROTOCOL_EDITOR_ORIGIN_X = DEFAULT_VIEWPORT_WIDTH / 2;
const PROTOCOL_EDITOR_ORIGIN_Y = DEFAULT_VIEWPORT_HEIGHT / 2;
const MIN_NODE_WIDTH = 120;
const MIN_NODE_HEIGHT = 50;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

interface NodeKindDefault {
  kind: RPNodeKind | null;
  fields: Record<string, unknown>;
  text?: string;
  color?: string;
}

interface ConnectionDragState {
  fromNodeId: string;
  startX: number;
  startY: number;
  previewPath: SVGPathElement;
}

interface PanState {
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
}

function worldXToSurfaceX(x: number): number {
  return x + PROTOCOL_EDITOR_ORIGIN_X;
}

function worldYToSurfaceY(y: number): number {
  return y + PROTOCOL_EDITOR_ORIGIN_Y;
}

const NODE_KIND_DEFAULTS: Record<string, NodeKindDefault> = {
  start: { kind: 'start', fields: {}, color: 'rgba(76, 175, 80, 0.28)' },
  question: { kind: 'question', fields: { questionText: '' }, text: 'New question', color: 'rgba(33, 150, 243, 0.24)' },
  answer: { kind: 'answer', fields: { answerText: '' }, text: 'New answer', color: 'rgba(255, 193, 7, 0.28)' },
  'text-block': { kind: 'text-block', fields: { content: '' }, text: 'New text block', color: 'rgba(255, 235, 59, 0.24)' },
  loop: { kind: 'loop', fields: { headerText: '' }, text: 'New loop', color: 'rgba(233, 30, 99, 0.24)' },
  snippet: { kind: 'snippet', fields: {}, text: 'New snippet', color: 'rgba(156, 39, 176, 0.24)' },
};

const EDITABLE_NODE_KINDS: RPNodeKind[] = ['start', 'question', 'answer', 'text-block', 'loop', 'snippet'];

export function defaultColorForProtocolEditorNodeKind(kind: RPNodeKind | null): string | undefined {
  if (kind === null) return undefined;
  return NODE_KIND_DEFAULTS[kind]?.color;
}

export function fieldsForProtocolEditorNodeKind(kind: RPNodeKind | null): Record<string, unknown> {
  if (kind === null) return {};
  return { ...(NODE_KIND_DEFAULTS[kind]?.fields ?? {}) };
}

export function normalizeProtocolEditorEdgeLabel(label: string, isLoopExit: boolean): string | undefined {
  const withoutPrefix = label.trim().replace(/^\+\s*/, '').trim();
  if (isLoopExit && withoutPrefix !== '') return `+${withoutPrefix}`;
  return withoutPrefix === '' ? undefined : withoutPrefix;
}

export function displayProtocolEditorEdgeLabel(label: string | undefined): string {
  return (label ?? '').trim().replace(/^\+\s*/, '').trim();
}

export function isProtocolEditorLoopExitLabel(label: string | undefined): boolean {
  return (label ?? '').trim().startsWith('+');
}

function nodeTitle(node: ProtocolNodeRecord): string {
  if (typeof node.text === 'string' && node.text.trim() !== '') return node.text.trim();
  if (typeof node.fields['displayLabel'] === 'string') return node.fields['displayLabel'];
  if (typeof node.fields['questionText'] === 'string') return node.fields['questionText'];
  if (typeof node.fields['answerText'] === 'string') return node.fields['answerText'];
  if (typeof node.fields['content'] === 'string') return node.fields['content'];
  return node.kind ?? 'untyped';
}

export function defaultProtocolEditorEdgeLabelForTarget(node: ProtocolNodeRecord | undefined): string | undefined {
  if (node === undefined) return undefined;
  const candidates = node.kind === 'answer'
    ? [node.fields['displayLabel'], node.fields['answerText'], node.text]
    : node.kind === 'snippet'
      ? [node.fields['snippetLabel'], node.text]
      : [];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate.trim();
  }
  return undefined;
}

export function shouldAutoRefreshProtocolEditorEdgeLabel(
  currentLabel: string | undefined,
  previousAutoLabel: string | undefined,
): boolean {
  const currentTrim = currentLabel?.trim() || undefined;
  const previousTrim = previousAutoLabel?.trim() || undefined;
  return currentTrim === undefined || currentTrim === previousTrim;
}

export function shouldDisplayProtocolEditorEdgeLabel(
  edge: ProtocolEdgeRecord,
  fromNode: ProtocolNodeRecord | undefined,
  toNode: ProtocolNodeRecord | undefined,
): boolean {
  if (toNode?.kind === 'answer' || toNode?.kind === 'snippet') {
    const effectiveLabel = deriveProtocolEditorEdgeLabel(toNode, edge.label);
    return effectiveLabel !== undefined && effectiveLabel.trim() !== '';
  }
  return fromNode?.kind === 'loop' && toNode?.kind === 'loop' && isProtocolEditorLoopExitLabel(edge.label);
}

export function deriveProtocolEditorEdgeLabel(
  targetNode: ProtocolNodeRecord | undefined,
  currentLabel: string | undefined,
): string | undefined {
  if (currentLabel !== undefined && currentLabel.trim() !== '') return currentLabel;
  return defaultProtocolEditorEdgeLabelForTarget(targetNode);
}

/* Phase 4D/4E — generate unique IDs */
function nodeUid(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function edgeUid(): string {
  return `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function clampProtocolEditorZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenDeltaToProtocolEditorDelta(delta: number, zoom: number): number {
  return delta / clampProtocolEditorZoom(zoom);
}

export function canCreateProtocolEditorEdge(
  edges: Pick<ProtocolEdgeRecord, 'fromNodeId' | 'toNodeId'>[],
  fromNodeId: string,
  toNodeId: string,
): 'ok' | 'self' | 'duplicate' {
  if (fromNodeId === toNodeId) return 'self';
  if (edges.some((edge) => edge.fromNodeId === fromNodeId && edge.toNodeId === toNodeId)) return 'duplicate';
  return 'ok';
}

export function removeProtocolEditorEdge(
  edges: ProtocolEdgeRecord[],
  edgeId: string,
): ProtocolEdgeRecord[] {
  return edges.filter((edge) => edge.id !== edgeId);
}

export function normalizeProtocolEditorSnippetFolderSelection(relativePath: string): string | undefined {
  const trimmed = relativePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? undefined : trimmed;
}

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const mid = Math.max(40, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`;
}

export class ProtocolEditorView extends ItemView {
  private readonly plugin: RadiProtocolPlugin;
  private protocolPath: string | null = null;
  private doc: ProtocolDocumentV1 | null = null;
  private rootEl: HTMLElement | null = null;
  private viewportEl: HTMLElement | null = null;
  private surfaceEl: HTMLElement | null = null;
  private svgEl: SVGSVGElement | null = null;
  private minimapEl: HTMLElement | null = null;
  private minimapSvgEl: SVGSVGElement | null = null;
  private minimapViewportEl: SVGRectElement | null = null;
  private minimapWorldBounds: { x: number; y: number; width: number; height: number } | null = null;
  private zoom = 1;
  private panState: PanState | null = null;
  private connectionDragState: ConnectionDragState | null = null;
  private viewportSaveTimer: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return PROTOCOL_EDITOR_VIEW_TYPE; }
  getDisplayText(): string { return this.plugin.i18n.t('protocolEditor.displayText'); }
  getIcon(): string { return 'workflow'; }

  async onOpen(): Promise<void> {
    this.renderShell();
  }

  async onClose(): Promise<void> {
    this.clearPendingViewportSave();
    this.rootEl = null;
    this.viewportEl = null;
    this.surfaceEl = null;
    this.svgEl = null;
    this.minimapEl = null;
    this.minimapSvgEl = null;
    this.minimapViewportEl = null;
    this.minimapWorldBounds = null;
    this.doc = null;
    this.protocolPath = null;
    this.panState = null;
    this.connectionDragState = null;
    document.body.removeClass('rp-protocol-editor-drag-active');
    document.body.removeClass('rp-protocol-editor-resize-active');
  }

  async loadProtocol(protocolPath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(protocolPath);
    if (!(file instanceof TFile) || !file.path.endsWith('.rp.json')) {
      new Notice(this.plugin.i18n.t('protocolEditor.notProtocolFile'));
      return;
    }

    const doc = await this.plugin.protocolDocumentStore.read(file.path);
    if (doc === null) {
      new Notice(this.plugin.i18n.t('protocolEditor.loadFailed'));
      return;
    }

    this.protocolPath = file.path;
    this.doc = doc;
    this.zoom = clampProtocolEditorZoom(doc.viewport?.zoom ?? 1);
    this.renderShell();
    this.renderDocument();
  }

  private renderShell(): void {
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    if (container === undefined) return;
    container.empty();
    this.rootEl = container.createDiv({ cls: 'rp-protocol-editor' });

    const toolbar = this.rootEl.createDiv({ cls: 'rp-protocol-editor-toolbar' });
    toolbar.createEl('div', {
      cls: 'rp-protocol-editor-title',
      text: this.doc?.title ?? this.plugin.i18n.t('protocolEditor.emptyTitle'),
    });
    /* Phase 4D — toolbar action buttons for each node kind */
    const actions = toolbar.createDiv({ cls: 'rp-protocol-editor-toolbar-actions' });
    const kinds: Array<{ key: string; label: string }> = [
      { key: 'start', label: this.plugin.i18n.t('protocolEditor.addStart') },
      { key: 'question', label: this.plugin.i18n.t('protocolEditor.addQuestion') },
      { key: 'answer', label: this.plugin.i18n.t('protocolEditor.addAnswer') },
      { key: 'text-block', label: this.plugin.i18n.t('protocolEditor.addTextBlock') },
      { key: 'loop', label: this.plugin.i18n.t('protocolEditor.addLoop') },
      { key: 'snippet', label: this.plugin.i18n.t('protocolEditor.addSnippet') },
    ];
    for (const { key, label } of kinds) {
      const btn = actions.createEl('button', {
        cls: 'rp-protocol-editor-add-btn',
        text: label,
      });
      btn.setAttr('data-node-kind', key);
      btn.addEventListener('click', () => this.addNodeAtCenter(key as RPNodeKind | null));
    }

    const selfCheckBtn = actions.createEl('button', {
      cls: 'rp-protocol-editor-add-btn',
      text: this.plugin.i18n.t('selfCheck.title'),
    });
    selfCheckBtn.addEventListener('click', () => this.openSelfCheckModal());

    const zoomIndicator = actions.createDiv({ cls: 'rp-protocol-editor-zoom-indicator' });
    zoomIndicator.setText(`${Math.round(this.zoom * 100)}%`);

    const workspace = this.rootEl.createDiv({ cls: 'rp-protocol-editor-workspace' });
    this.viewportEl = workspace.createDiv({ cls: 'rp-protocol-editor-viewport' });
    this.viewportEl.setAttr('data-zoom', String(this.zoom));
    this.surfaceEl = this.viewportEl.createDiv({ cls: 'rp-protocol-editor-surface' });
    this.svgEl = this.viewportEl.createSvg('svg', { cls: 'rp-protocol-editor-edges' });

    if (this.doc !== null) {
      this.minimapEl = workspace.createDiv({ cls: 'rp-protocol-editor-minimap' });
      this.minimapEl.setAttr('role', 'button');
      this.minimapEl.setAttr('aria-label', this.plugin.i18n.t('protocolEditor.minimapLabel'));
      this.minimapSvgEl = this.minimapEl.createSvg('svg', {
        attr: {
          class: 'rp-protocol-editor-minimap-svg',
          viewBox: `0 0 ${DEFAULT_VIEWPORT_WIDTH} ${DEFAULT_VIEWPORT_HEIGHT}`,
          preserveAspectRatio: 'none',
        },
      }) as SVGSVGElement;
    } else {
      this.minimapEl = null;
      this.minimapSvgEl = null;
      this.minimapViewportEl = null;
      this.minimapWorldBounds = null;
    }

    this.applyZoom();
    this.bindViewportControls();
    this.bindMinimapControls();
    this.restoreViewportState();

    if (this.doc === null) {
      this.surfaceEl.createDiv({
        cls: 'rp-protocol-editor-empty',
        text: this.plugin.i18n.t('protocolEditor.emptyState'),
      });
    }
  }

  /* Phase 4D — create a new node at the center of the viewport */
  private addNodeAtCenter(kind: RPNodeKind | null): void {
    if (this.doc === null || this.protocolPath === null || this.viewportEl === null) return;

    const cx = (this.viewportEl.scrollLeft + this.viewportEl.clientWidth / 2) / this.zoom - PROTOCOL_EDITOR_ORIGIN_X - DEFAULT_NODE_WIDTH / 2;
    const cy = (this.viewportEl.scrollTop + this.viewportEl.clientHeight / 2) / this.zoom - PROTOCOL_EDITOR_ORIGIN_Y - DEFAULT_NODE_HEIGHT / 2;

    const defaults = (kind !== null && NODE_KIND_DEFAULTS[kind])
      ? NODE_KIND_DEFAULTS[kind]
      : { kind: null as RPNodeKind | null, fields: {} };

    const newNode: ProtocolNodeRecord = {
      id: nodeUid(),
      kind: defaults.kind,
      x: Math.round(cx),
      y: Math.round(cy),
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
      color: defaults.color ?? defaultColorForProtocolEditorNodeKind(defaults.kind),
      text: defaults.text,
      fields: { ...defaults.fields },
    };

    void this.plugin.protocolDocumentStore.update(this.protocolPath, (existing) => {
      if (existing === null) throw new Error('Protocol file disappeared');
      return { ...existing, nodes: [...existing.nodes, newNode], viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
    }).then(() => {
      void this.loadProtocol(this.protocolPath!);
      new Notice(this.plugin.i18n.t('protocolEditor.nodeCreated'));
    }).catch((err) => {
      new Notice(this.plugin.i18n.t('protocolEditor.saveFailed', { error: String(err) }));
    });
  }

  private renderDocument(): void {
    if (this.doc === null || this.surfaceEl === null || this.svgEl === null) return;
    this.surfaceEl.empty();
    this.svgEl.empty();
    this.applyZoom();

    if (this.doc.nodes.length === 0) {
      this.surfaceEl.createDiv({
        cls: 'rp-protocol-editor-empty',
        text: this.plugin.i18n.t('protocolEditor.noNodes'),
      });
      this.renderMinimap();
      return;
    }

    this.renderEdges();

    for (const node of this.doc.nodes) {
      const nodeEl = this.surfaceEl.createDiv({ cls: 'rp-protocol-editor-node' });
      nodeEl.toggleClass('is-untyped', node.kind === null);
      nodeEl.setAttr('data-node-id', node.id);
      nodeEl.setAttr('data-node-kind', node.kind ?? 'untyped');
      if (node.color === undefined) node.color = defaultColorForProtocolEditorNodeKind(node.kind);
      this.applyNodePosition(nodeEl, node);

      const inputPort = nodeEl.createDiv({ cls: 'rp-protocol-editor-port rp-protocol-editor-port-input' });
      inputPort.setAttr('data-node-id', node.id);
      inputPort.setAttr('data-port-kind', 'input');
      inputPort.setAttr('aria-label', this.plugin.i18n.t('protocolEditor.inputPortLabel'));

      const outputPort = nodeEl.createDiv({ cls: 'rp-protocol-editor-port rp-protocol-editor-port-output' });
      outputPort.setAttr('data-node-id', node.id);
      outputPort.setAttr('data-port-kind', 'output');
      outputPort.setAttr('aria-label', this.plugin.i18n.t('protocolEditor.outputPortLabel'));

      nodeEl.createDiv({ cls: 'rp-protocol-editor-node-kind', text: node.kind ?? 'untyped' });
      nodeEl.createDiv({ cls: 'rp-protocol-editor-node-title', text: nodeTitle(node) });
      const resizeHandle = nodeEl.createDiv({ cls: 'rp-protocol-editor-resize-handle' });
      resizeHandle.setAttr('aria-label', this.plugin.i18n.t('protocolEditor.resizeNodeLabel'));

      this.bindConnectionDrag(outputPort, node);
      this.bindDrag(nodeEl, node);
      this.bindResize(resizeHandle, nodeEl, node);

      /* Phase 4D — double-click to edit */
      nodeEl.addEventListener('dblclick', (e) => {
        if ((e.target as HTMLElement).closest('.rp-protocol-editor-port') !== null) return;
        e.preventDefault();
        e.stopPropagation();
        this.openEditModal(node);
      });
    }

    this.renderMinimap();
  }

  private renderEdges(): void {
    if (this.doc === null || this.svgEl === null) return;
    this.svgEl.empty();
    const nodeById = new Map(this.doc.nodes.map(node => [node.id, node]));
    for (const edge of this.doc.edges) {
      const from = nodeById.get(edge.fromNodeId);
      const to = nodeById.get(edge.toNodeId);
      if (from === undefined || to === undefined) continue;
      const x1 = worldXToSurfaceX(from.x + from.width);
      const y1 = worldYToSurfaceY(from.y + from.height / 2);
      const x2 = worldXToSurfaceX(to.x);
      const y2 = worldYToSurfaceY(to.y + to.height / 2);
      const d = edgePath(x1, y1, x2, y2);
      const group = this.svgEl.createSvg('g', {
        attr: {
          class: 'rp-protocol-editor-edge-group',
          'data-edge-id': edge.id,
          role: 'button',
          tabindex: '0',
          'aria-label': this.plugin.i18n.t('protocolEditor.editEdge'),
        },
      }) as SVGGElement;
      const openEdge = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.openEdgeModal(edge);
      };
      group.addEventListener('click', openEdge);
      group.addEventListener('dblclick', openEdge);
      group.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          openEdge(e);
          return;
        }
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        e.preventDefault();
        e.stopPropagation();
        void this.deleteEdge(edge.id);
      });
      group.createSvg('path', {
        attr: {
          d,
          class: 'rp-protocol-editor-edge-hitbox',
        },
      });
       group.createSvg('path', {
        attr: {
          d,
          class: 'rp-protocol-editor-edge',
        },
      }) as SVGPathElement;
      const effectiveLabel = shouldDisplayProtocolEditorEdgeLabel(edge, from, to)
        ? deriveProtocolEditorEdgeLabel(to, edge.label)
        : undefined;
      if (effectiveLabel !== undefined && effectiveLabel.trim() !== '') {
        const labelGroup = group.createSvg('g', { attr: { class: 'rp-protocol-editor-edge-label-group' } });
        const labelText = displayProtocolEditorEdgeLabel(effectiveLabel);
        const labelX = (x1 + x2) / 2;
        const labelY = (y1 + y2) / 2 - 8;
        const approxWidth = Math.min(220, Math.max(48, labelText.length * 7 + 18));
        labelGroup.createSvg('rect', {
          attr: {
            x: String(labelX - approxWidth / 2),
            y: String(labelY - 15),
            width: String(approxWidth),
            height: '22',
            rx: '11',
            class: 'rp-protocol-editor-edge-label-bg',
          },
        });
        const label = labelGroup.createSvg('text', {
          attr: {
            x: String(labelX),
            y: String(labelY),
            class: 'rp-protocol-editor-edge-label',
            'text-anchor': 'middle',
          },
        });
        label.textContent = labelText.length > 28 ? `${labelText.slice(0, 27)}…` : labelText;
      }
    }
  }

  private renderMinimap(): void {
    if (this.doc === null || this.minimapSvgEl === null) return;
    this.minimapSvgEl.empty();

    const nodeById = new Map(this.doc.nodes.map(node => [node.id, node]));

    // Compute content bounds so the viewBox fits all nodes with some padding.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of this.doc.nodes) {
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      const right = node.x + node.width;
      const bottom = node.y + node.height;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
    // Include edges in bounds
    for (const edge of this.doc.edges) {
      const from = nodeById.get(edge.fromNodeId);
      const to = nodeById.get(edge.toNodeId);
      if (from === undefined || to === undefined) continue;
      const x1 = from.x + from.width;
      const x2 = to.x;
      if (x1 < minX) minX = x1;
      if (x2 < minX) minX = x2;
      if (x1 > maxX) maxX = x1;
      if (x2 > maxX) maxX = x2;
      const y1 = from.y + from.height / 2;
      const y2 = to.y + to.height / 2;
      if (y1 < minY) minY = y1;
      if (y2 < minY) minY = y2;
      if (y1 > maxY) maxY = y1;
      if (y2 > maxY) maxY = y2;
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      minX = -100;
      minY = -100;
      maxX = 100;
      maxY = 100;
    }

    const PADDING = 80;
    const vbWidth = Math.max(maxX - minX + PADDING * 2, 300);
    const vbHeight = Math.max(maxY - minY + PADDING * 2, 220);
    const vbX = minX - PADDING;
    const vbY = minY - PADDING;
    this.minimapWorldBounds = { x: vbX, y: vbY, width: vbWidth, height: vbHeight };
    this.minimapSvgEl.setAttr('viewBox', `${vbX} ${vbY} ${vbWidth} ${vbHeight}`);

    // Background
    this.minimapSvgEl.createSvg('rect', {
      attr: {
        x: String(vbX),
        y: String(vbY),
        width: String(vbWidth),
        height: String(vbHeight),
        class: 'rp-protocol-editor-minimap-bg',
      },
    });

    // Edges
    for (const edge of this.doc.edges) {
      const from = nodeById.get(edge.fromNodeId);
      const to = nodeById.get(edge.toNodeId);
      if (from === undefined || to === undefined) continue;
      this.minimapSvgEl.createSvg('line', {
        attr: {
          x1: String(from.x + from.width / 2),
          y1: String(from.y + from.height / 2),
          x2: String(to.x + to.width / 2),
          y2: String(to.y + to.height / 2),
          class: 'rp-protocol-editor-minimap-edge',
        },
      });
    }

    // Nodes
    for (const node of this.doc.nodes) {
      this.minimapSvgEl.createSvg('rect', {
        attr: {
          x: String(node.x),
          y: String(node.y),
          width: String(node.width),
          height: String(node.height),
          rx: '4',
          class: `rp-protocol-editor-minimap-node rp-protocol-editor-minimap-node-${node.kind ?? 'untyped'}`,
        },
      });
    }

    this.minimapViewportEl = this.minimapSvgEl.createSvg('rect', {
      attr: {
        class: 'rp-protocol-editor-minimap-viewport',
        x: '0',
        y: '0',
        width: '0',
        height: '0',
      },
    }) as SVGRectElement;
    this.updateMinimapViewport();
  }

  private updateMinimapViewport(): void {
    if (this.viewportEl === null || this.minimapViewportEl === null) return;
    const x = this.viewportEl.scrollLeft / this.zoom - PROTOCOL_EDITOR_ORIGIN_X;
    const y = this.viewportEl.scrollTop / this.zoom - PROTOCOL_EDITOR_ORIGIN_Y;
    const width = this.viewportEl.clientWidth / this.zoom;
    const height = this.viewportEl.clientHeight / this.zoom;
    this.minimapViewportEl.setAttr('x', String(x));
    this.minimapViewportEl.setAttr('y', String(y));
    this.minimapViewportEl.setAttr('width', String(width));
    this.minimapViewportEl.setAttr('height', String(height));
  }

  private centerViewportOnSurfacePoint(surfaceX: number, surfaceY: number): void {
    if (this.viewportEl === null) return;
    this.viewportEl.scrollLeft = (surfaceX + PROTOCOL_EDITOR_ORIGIN_X) * this.zoom - this.viewportEl.clientWidth / 2;
    this.viewportEl.scrollTop = (surfaceY + PROTOCOL_EDITOR_ORIGIN_Y) * this.zoom - this.viewportEl.clientHeight / 2;
    this.updateMinimapViewport();
    this.scheduleViewportSave();
  }

  private minimapClientPointToSurfacePoint(clientX: number, clientY: number): { x: number; y: number } | null {
    if (this.minimapSvgEl === null || this.minimapWorldBounds === null) return null;
    const rect = this.minimapSvgEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: this.minimapWorldBounds.x + ((clientX - rect.left) / rect.width) * this.minimapWorldBounds.width,
      y: this.minimapWorldBounds.y + ((clientY - rect.top) / rect.height) * this.minimapWorldBounds.height,
    };
  }

  private panViewportFromMinimapPointer(clientX: number, clientY: number): void {
    const point = this.minimapClientPointToSurfacePoint(clientX, clientY);
    if (point === null) return;
    this.centerViewportOnSurfacePoint(point.x, point.y);
  }

  private async deleteEdge(edgeId: string): Promise<void> {
    if (this.protocolPath === null) return;
    try {
      await this.plugin.protocolDocumentStore.update(this.protocolPath, (existing) => {
        if (existing === null) throw new Error('Protocol file disappeared');
        return {
          ...existing,
          edges: removeProtocolEditorEdge(existing.edges, edgeId),
          viewport: this.currentViewportState(),
          updatedAt: new Date().toISOString(),
        };
      });
      new Notice(this.plugin.i18n.t('protocolEditor.edgeDeleted'));
      await this.loadProtocol(this.protocolPath);
    } catch (err) {
      new Notice(this.plugin.i18n.t('protocolEditor.deleteFailed', { error: String(err) }));
    } finally {
      this.restoreEditorFocus();
    }
  }

  private applyNodePosition(nodeEl: HTMLElement, node: ProtocolNodeRecord): void {
    nodeEl.setAttr('style', `left:${worldXToSurfaceX(node.x)}px;top:${worldYToSurfaceY(node.y)}px;width:${node.width}px;min-height:${node.height}px;${node.color !== undefined ? `--rp-node-color:${node.color};` : ''}`);
  }

  private bindConnectionDrag(outputPort: HTMLElement, node: ProtocolNodeRecord): void {
    outputPort.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0 || this.svgEl === null) return;
      e.preventDefault();
      e.stopPropagation();

      const startX = worldXToSurfaceX(node.x + node.width);
      const startY = worldYToSurfaceY(node.y + node.height / 2);
      const previewPath = this.svgEl.createSvg('path', {
        attr: {
          d: edgePath(startX, startY, startX + 80, startY),
          class: 'rp-protocol-editor-edge rp-protocol-editor-edge-preview',
        },
      }) as SVGPathElement;
      this.connectionDragState = { fromNodeId: node.id, startX, startY, previewPath };

      const onMove = (ev: MouseEvent) => this.updateConnectionPreview(ev);
      const onUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        void this.finishConnectionDrag(ev);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  private updateConnectionPreview(ev: MouseEvent): void {
    if (this.connectionDragState === null || this.viewportEl === null) return;
    const point = this.clientPointToCanvasPoint(ev.clientX, ev.clientY);
    this.connectionDragState.previewPath.setAttr('d', edgePath(
      this.connectionDragState.startX,
      this.connectionDragState.startY,
      point.x,
      point.y,
    ));
  }

  private findInputPortAt(clientX: number, clientY: number): HTMLElement | null {
    const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const direct = target?.closest('.rp-protocol-editor-port-input') as HTMLElement | null;
    if (direct !== null) return direct;

    let best: HTMLElement | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const tolerance = 32;
    for (const port of Array.from(document.querySelectorAll('.rp-protocol-editor-port-input')) as HTMLElement[]) {
      const rect = port.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const distance = Math.hypot(clientX - cx, clientY - cy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = port;
      }
    }
    return bestDistance <= tolerance ? best : null;
  }

  private async finishConnectionDrag(ev: MouseEvent): Promise<void> {
    const state = this.connectionDragState;
    this.connectionDragState = null;
    state?.previewPath.remove();
    if (state === null || this.doc === null || this.protocolPath === null) return;

    const inputPort = this.findInputPortAt(ev.clientX, ev.clientY);
    const toNodeId = inputPort?.getAttr('data-node-id');
    if (toNodeId === undefined || toNodeId === null) return;

    const decision = canCreateProtocolEditorEdge(this.doc.edges, state.fromNodeId, toNodeId);
    if (decision === 'self') {
      new Notice(this.plugin.i18n.t('protocolEditor.selfEdgeRejected'));
      return;
    }
    if (decision === 'duplicate') {
      new Notice(this.plugin.i18n.t('protocolEditor.duplicateEdgeRejected'));
      return;
    }

    const sourceNode = this.doc.nodes.find((node) => node.id === state.fromNodeId);
    const targetNode = this.doc.nodes.find((node) => node.id === toNodeId);
    const defaultLabel = defaultProtocolEditorEdgeLabelForTarget(targetNode);
    const newEdge: ProtocolEdgeRecord = {
      id: edgeUid(),
      fromNodeId: state.fromNodeId,
      toNodeId,
      label: shouldDisplayProtocolEditorEdgeLabel(
        { id: 'preview', fromNodeId: state.fromNodeId, toNodeId, label: defaultLabel },
        sourceNode,
        targetNode,
      ) ? defaultLabel : undefined,
    };

    try {
      await this.plugin.protocolDocumentStore.update(this.protocolPath, (existing) => {
        if (existing === null) throw new Error('Protocol file disappeared');
        const currentDecision = canCreateProtocolEditorEdge(existing.edges, state.fromNodeId, toNodeId);
        if (currentDecision !== 'ok') return existing;
        return { ...existing, edges: [...existing.edges, newEdge], viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
      });
      new Notice(this.plugin.i18n.t('protocolEditor.edgeCreated'));
      await this.loadProtocol(this.protocolPath);
    } catch (err) {
      new Notice(this.plugin.i18n.t('protocolEditor.saveFailed', { error: String(err) }));
    }
  }

  private openSelfCheckModal(): void {
    if (this.doc === null || this.protocolPath === null) return;
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const backdrop = document.body.createDiv({ cls: 'rp-protocol-editor-modal-backdrop' });
    const modal = backdrop.createDiv({ cls: 'rp-protocol-editor-modal rp-protocol-editor-self-check-modal' });
    modal.createEl('h3', { text: t('selfCheck.title') });
    const body = modal.createDiv({ cls: 'rp-protocol-editor-modal-body' });
    const enabledRow = body.createEl('label', { cls: 'rp-protocol-editor-self-check-enabled' });
    const enabledCheckbox = enabledRow.createEl('input', { type: 'checkbox' });
    enabledCheckbox.checked = this.doc.selfCheckEnabled === true;
    enabledRow.createSpan({ text: t('selfCheck.enabled') });
    const rows = body.createDiv({ cls: 'rp-protocol-editor-self-check-list' });
    const values = [...(this.doc.selfCheckItems ?? []), ''];
    let enabled = enabledCheckbox.checked;

    const closeModal = () => backdrop.remove();
    const persist = async () => {
      const items = values.map(value => value.trim()).filter(value => value.length > 0);
      await this.plugin.protocolDocumentStore.update(this.protocolPath!, (existing) => {
        if (existing === null) throw new Error('Protocol file disappeared');
        return { ...existing, selfCheckEnabled: enabled, selfCheckItems: items, updatedAt: new Date().toISOString() };
      });
      if (this.doc !== null) this.doc = { ...this.doc, selfCheckEnabled: enabled, selfCheckItems: items };
    };
    const ensureTrailingEmpty = () => {
      const lastValue = values[values.length - 1];
      if (lastValue === undefined || lastValue.trim().length > 0) values.push('');
    };
    const renderRows = () => {
      ensureTrailingEmpty();
      rows.empty();
      rows.toggle(enabled);
      if (!enabled) return;
      for (let index = 0; index < values.length; index += 1) {
        const row = rows.createDiv({ cls: 'rp-protocol-editor-self-check-row' });
        const input = row.createEl('input', {
          type: 'text',
          value: values[index],
          attr: { placeholder: t('selfCheck.addItem') },
        });
        const removeBtn = row.createEl('button', {
          cls: 'rp-protocol-editor-modal-btn',
          text: '×',
          attr: { title: t('selfCheck.removeItem') },
        });
        input.addEventListener('input', () => {
          values[index] = input.value;
          if (index === values.length - 1 && input.value.trim().length > 0) renderRows();
          void persist();
        });
        removeBtn.addEventListener('click', () => {
          values.splice(index, 1);
          renderRows();
          void persist();
        });
      }
    };
    enabledCheckbox.addEventListener('change', () => {
      enabled = enabledCheckbox.checked;
      renderRows();
      void persist();
    });
    renderRows();

    const footer = modal.createDiv({ cls: 'rp-protocol-editor-modal-footer' });
    const doneBtn = footer.createEl('button', {
      cls: 'rp-protocol-editor-modal-btn rp-protocol-editor-modal-btn-primary',
      text: t('protocolEditor.save'),
    });
    doneBtn.addEventListener('click', () => {
      void persist().then(closeModal);
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  /* Phase 4D — bind mouse drag events to a node element */
  private bindDrag(nodeEl: HTMLElement, node: ProtocolNodeRecord): void {
    nodeEl.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('.rp-protocol-editor-port') !== null) return;
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const origX = node.x;
      const origY = node.y;

      nodeEl.addClass('rp-node-dragging');
      document.body.addClass('rp-protocol-editor-drag-active');

      const onMove = (ev: MouseEvent) => {
        const dx = screenDeltaToProtocolEditorDelta(ev.clientX - startX, this.zoom);
        const dy = screenDeltaToProtocolEditorDelta(ev.clientY - startY, this.zoom);
        const newX = origX + dx;
        const newY = origY + dy;
        node.x = newX;
        node.y = newY;
        this.applyNodePosition(nodeEl, node);
        this.renderEdges();
      };

      const onUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        nodeEl.removeClass('rp-node-dragging');
        document.body.removeClass('rp-protocol-editor-drag-active');
        this.restoreEditorFocus();

        const dx = screenDeltaToProtocolEditorDelta(ev.clientX - startX, this.zoom);
        const dy = screenDeltaToProtocolEditorDelta(ev.clientY - startY, this.zoom);
        const newX = Math.round(origX + dx);
        const newY = Math.round(origY + dy);

        if (newX === origX && newY === origY) return;

        node.x = newX;
        node.y = newY;
        void this.saveNodeGeometry(node);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  private bindResize(handleEl: HTMLElement, nodeEl: HTMLElement, node: ProtocolNodeRecord): void {
    handleEl.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const origWidth = node.width;
      const origHeight = node.height;

      nodeEl.addClass('rp-node-resizing');
      document.body.addClass('rp-protocol-editor-resize-active');

      const onMove = (ev: MouseEvent) => {
        const dx = screenDeltaToProtocolEditorDelta(ev.clientX - startX, this.zoom);
        const dy = screenDeltaToProtocolEditorDelta(ev.clientY - startY, this.zoom);
        node.width = Math.max(MIN_NODE_WIDTH, origWidth + dx);
        node.height = Math.max(MIN_NODE_HEIGHT, origHeight + dy);
        this.applyNodePosition(nodeEl, node);
        this.renderEdges();
      };

      const onUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        nodeEl.removeClass('rp-node-resizing');
        document.body.removeClass('rp-protocol-editor-resize-active');
        this.restoreEditorFocus();

        const dx = screenDeltaToProtocolEditorDelta(ev.clientX - startX, this.zoom);
        const dy = screenDeltaToProtocolEditorDelta(ev.clientY - startY, this.zoom);
        const newWidth = Math.max(MIN_NODE_WIDTH, Math.round(origWidth + dx));
        const newHeight = Math.max(MIN_NODE_HEIGHT, Math.round(origHeight + dy));
        if (newWidth === origWidth && newHeight === origHeight) return;
        node.width = newWidth;
        node.height = newHeight;
        this.applyNodePosition(nodeEl, node);
        this.renderEdges();
        void this.saveNodeGeometry(node);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  /* Phase 4D — persist node position/size change */
  private async saveNodeGeometry(node: ProtocolNodeRecord): Promise<void> {
    if (this.protocolPath === null) return;
    try {
      await this.plugin.protocolDocumentStore.update(this.protocolPath, (existing) => {
        if (existing === null) throw new Error('Protocol file disappeared');
        const nodes = existing.nodes.map((n) =>
          n.id === node.id ? { ...n, x: Math.round(node.x), y: Math.round(node.y), width: Math.round(node.width), height: Math.round(node.height) } : n,
        );
        return { ...existing, nodes, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
      });
      await this.loadProtocol(this.protocolPath);
    } catch (err) {
      new Notice(this.plugin.i18n.t('protocolEditor.saveFailed', { error: String(err) }));
    }
  }

  private bindViewportControls(): void {
    if (this.viewportEl === null) return;

    this.viewportEl.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Element;
      if (target.closest('.rp-protocol-editor-minimap') !== null) return;
      if (target.closest('.rp-protocol-editor-node') !== null) return;
      if (target.closest('.rp-protocol-editor-port') !== null) return;
      if (target.closest('.rp-protocol-editor-edge-group') !== null) return;
      e.preventDefault();
      if (this.viewportEl === null) return;
      this.viewportEl.addClass('is-panning');
      this.panState = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startScrollLeft: this.viewportEl.scrollLeft,
        startScrollTop: this.viewportEl.scrollTop,
      };

      const onMove = (ev: MouseEvent) => {
        if (this.viewportEl === null || this.panState === null) return;
        this.viewportEl.scrollLeft = this.panState.startScrollLeft - (ev.clientX - this.panState.startClientX);
        this.viewportEl.scrollTop = this.panState.startScrollTop - (ev.clientY - this.panState.startClientY);
        this.updateMinimapViewport();
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        this.viewportEl?.removeClass('is-panning');
        this.panState = null;
        this.restoreEditorFocus();
        void this.persistViewportState();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    this.viewportEl.addEventListener('wheel', (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (this.viewportEl === null) return;
      e.preventDefault();

      const oldZoom = this.zoom;
      const direction = e.deltaY > 0 ? -1 : 1;
      const nextZoom = clampProtocolEditorZoom(oldZoom + direction * ZOOM_STEP);
      if (nextZoom === oldZoom) return;

      const rect = this.viewportEl.getBoundingClientRect();
      const anchorX = this.viewportEl.scrollLeft + e.clientX - rect.left;
      const anchorY = this.viewportEl.scrollTop + e.clientY - rect.top;
      const docX = anchorX / oldZoom;
      const docY = anchorY / oldZoom;

      this.zoom = nextZoom;
      this.applyZoom();
      this.viewportEl.scrollLeft = docX * nextZoom - (e.clientX - rect.left);
      this.viewportEl.scrollTop = docY * nextZoom - (e.clientY - rect.top);
      this.updateMinimapViewport();
      this.scheduleViewportSave();
    }, { passive: false });

    this.viewportEl.addEventListener('scroll', () => {
      this.updateMinimapViewport();
      this.scheduleViewportSave();
    });
  }

  private bindMinimapControls(): void {
    if (this.minimapEl === null) return;

    this.minimapEl.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.minimapEl?.addClass('is-dragging');
      this.panViewportFromMinimapPointer(e.clientX, e.clientY);

      const onMove = (ev: MouseEvent) => {
        ev.preventDefault();
        this.panViewportFromMinimapPointer(ev.clientX, ev.clientY);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        this.minimapEl?.removeClass('is-dragging');
        void this.persistViewportState();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  private applyZoom(): void {
    const scaledWidth = `${DEFAULT_VIEWPORT_WIDTH * this.zoom}px`;
    const scaledHeight = `${DEFAULT_VIEWPORT_HEIGHT * this.zoom}px`;
    if (this.viewportEl !== null) {
      this.viewportEl.setAttr('data-zoom', String(this.zoom));
      this.viewportEl.style.setProperty('--rp-protocol-editor-zoom', String(this.zoom));
      const indicator = this.rootEl?.querySelector('.rp-protocol-editor-zoom-indicator');
      indicator?.setText(`${Math.round(this.zoom * 100)}%`);
    }
    if (this.surfaceEl !== null) {
      this.surfaceEl.setAttr('style', `width:${DEFAULT_VIEWPORT_WIDTH}px;height:${DEFAULT_VIEWPORT_HEIGHT}px;transform:scale(${this.zoom});`);
    }
    if (this.svgEl !== null) {
      this.svgEl.setAttr('viewBox', `0 0 ${DEFAULT_VIEWPORT_WIDTH} ${DEFAULT_VIEWPORT_HEIGHT}`);
      this.svgEl.setAttr('style', `width:${DEFAULT_VIEWPORT_WIDTH}px;height:${DEFAULT_VIEWPORT_HEIGHT}px;transform:scale(${this.zoom});`);
    }
    if (this.viewportEl !== null) {
      this.viewportEl.style.setProperty('--rp-protocol-editor-scaled-width', scaledWidth);
      this.viewportEl.style.setProperty('--rp-protocol-editor-scaled-height', scaledHeight);
    }
  }

  private clientPointToCanvasPoint(clientX: number, clientY: number): { x: number; y: number } {
    if (this.viewportEl === null) return { x: 0, y: 0 };
    const rect = this.viewportEl.getBoundingClientRect();
    return {
      x: (this.viewportEl.scrollLeft + clientX - rect.left) / this.zoom,
      y: (this.viewportEl.scrollTop + clientY - rect.top) / this.zoom,
    };
  }

  private clientPointToWorldPoint(clientX: number, clientY: number): { x: number; y: number } {
    const point = this.clientPointToCanvasPoint(clientX, clientY);
    return { x: point.x - PROTOCOL_EDITOR_ORIGIN_X, y: point.y - PROTOCOL_EDITOR_ORIGIN_Y };
  }

  private restoreEditorFocus(): void {
    window.requestAnimationFrame(() => {
      if (this.viewportEl === null || !this.viewportEl.isConnected) return;
      if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.rp-protocol-editor-modal') !== null) return;
      this.viewportEl.setAttr('tabindex', '-1');
      this.viewportEl.focus({ preventScroll: true });
    });
  }

  private restoreViewportState(): void {
    if (this.viewportEl === null || this.doc === null) return;
    const viewport = this.doc.viewport ?? { x: 0, y: 0, zoom: this.zoom };
    window.requestAnimationFrame(() => {
      if (this.viewportEl === null) return;
      this.viewportEl.scrollLeft = Math.max(0, viewport.x + PROTOCOL_EDITOR_ORIGIN_X * this.zoom);
      this.viewportEl.scrollTop = Math.max(0, viewport.y + PROTOCOL_EDITOR_ORIGIN_Y * this.zoom);
      this.updateMinimapViewport();
    });
  }

  private currentViewportState(): { x: number; y: number; zoom: number } {
    if (this.viewportEl === null) {
      return { x: this.doc?.viewport?.x ?? 0, y: this.doc?.viewport?.y ?? 0, zoom: this.zoom };
    }
    return {
      x: Math.round(this.viewportEl.scrollLeft - PROTOCOL_EDITOR_ORIGIN_X * this.zoom),
      y: Math.round(this.viewportEl.scrollTop - PROTOCOL_EDITOR_ORIGIN_Y * this.zoom),
      zoom: this.zoom,
    };
  }

  private scheduleViewportSave(): void {
    if (this.protocolPath === null || this.doc === null) return;
    this.clearPendingViewportSave();
    this.viewportSaveTimer = window.setTimeout(() => {
      void this.persistViewportState();
    }, 400);
  }

  private clearPendingViewportSave(): void {
    if (this.viewportSaveTimer !== null) {
      window.clearTimeout(this.viewportSaveTimer);
      this.viewportSaveTimer = null;
    }
  }

  private async persistViewportState(): Promise<void> {
    if (this.protocolPath === null || this.doc === null) return;
    this.clearPendingViewportSave();
    const viewport = this.currentViewportState();
    try {
      await this.plugin.protocolDocumentStore.update(this.protocolPath, (existing) => {
        if (existing === null) throw new Error('Protocol file disappeared');
        return { ...existing, viewport, updatedAt: new Date().toISOString() };
      });
      this.doc = { ...this.doc, viewport };
    } catch (err) {
      new Notice(this.plugin.i18n.t('protocolEditor.saveFailed', { error: String(err) }));
    }
  }

  private openEdgeModal(edge: ProtocolEdgeRecord): void {
    if (this.protocolPath === null || this.doc === null) return;
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const modalEl = document.body.createDiv({ cls: 'rp-protocol-editor-modal-backdrop' });
    const modal = modalEl.createDiv({ cls: 'rp-protocol-editor-modal' });
    const header = modal.createDiv({ cls: 'rp-protocol-editor-modal-header' });
    header.createEl('h3', { text: t('protocolEditor.editEdge') });
    const closeBtn = header.createEl('button', { cls: 'rp-protocol-editor-modal-close', text: '✕' });
    const closeModal = () => { modalEl.remove(); this.restoreEditorFocus(); };
    closeBtn.addEventListener('click', closeModal);

    const body = modal.createDiv({ cls: 'rp-protocol-editor-modal-body' });
    const nodes = this.doc.nodes;
    const nodeLabelForSelect = (node: ProtocolNodeRecord) => `${nodeTitle(node)} (${node.kind ?? 'untyped'})`;
    const addNodeSelect = (label: string, initial: string) => {
      const field = body.createDiv({ cls: 'rp-protocol-editor-modal-field' });
      field.createEl('label', { text: label });
      const select = field.createEl('select') as HTMLSelectElement;
      for (const node of nodes) {
        select.createEl('option', { attr: { value: node.id }, text: nodeLabelForSelect(node) });
      }
      select.value = initial;
      return select;
    };
    const fromSelect = addNodeSelect(t('protocolEditor.edgeFromLabel'), edge.fromNodeId);
    const toSelect = addNodeSelect(t('protocolEditor.edgeToLabel'), edge.toNodeId);
    const labelField = body.createDiv({ cls: 'rp-protocol-editor-modal-field' });
    labelField.createEl('label', { text: t('protocolEditor.edgeLabelLabel') });
    const labelInput = labelField.createEl('input', {
      attr: {
        type: 'text',
        value: displayProtocolEditorEdgeLabel(edge.label),
        placeholder: t('protocolEditor.edgeLabelPlaceholder'),
      },
    }) as HTMLInputElement;
    labelField.createDiv({ cls: 'rp-protocol-editor-modal-help', text: t('protocolEditor.edgeLabelHelp') });
    const exitField = body.createDiv({ cls: 'rp-protocol-editor-modal-field rp-protocol-editor-checkbox-field' });
    const exitLabel = exitField.createEl('label');
    const exitCheckbox = exitLabel.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement;
    exitLabel.appendText(` ${t('protocolEditor.loopExitLabel')}`);
    exitCheckbox.checked = isProtocolEditorLoopExitLabel(edge.label);
    const syncExitVisibility = () => {
      const fromNode = nodes.find((node) => node.id === fromSelect.value);
      const isLoopSource = fromNode?.kind === 'loop';
      exitField.style.display = isLoopSource ? '' : 'none';
      if (!isLoopSource) exitCheckbox.checked = false;
    };
    fromSelect.addEventListener('change', syncExitVisibility);
    syncExitVisibility();

    const footer = modal.createDiv({ cls: 'rp-protocol-editor-modal-footer' });
    const deleteBtn = footer.createEl('button', {
      cls: 'rp-protocol-editor-modal-btn rp-protocol-editor-modal-btn-danger',
      text: t('protocolEditor.deleteEdgeLabel'),
    });
    const actionBtns = footer.createDiv({ cls: 'modal-actions' });
    const cancelBtn = actionBtns.createEl('button', { cls: 'rp-protocol-editor-modal-btn', text: t('protocolEditor.cancel') });
    const saveBtn = actionBtns.createEl('button', { cls: 'rp-protocol-editor-modal-btn rp-protocol-editor-modal-btn-primary', text: t('protocolEditor.save') });
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async () => {
      const nextFrom = fromSelect.value;
      const nextTo = toSelect.value;
      const duplicate = this.doc?.edges.some((candidate) => candidate.id !== edge.id && candidate.fromNodeId === nextFrom && candidate.toNodeId === nextTo) ?? false;
      if (nextFrom === nextTo) { new Notice(t('protocolEditor.selfEdgeRejected')); return; }
      if (duplicate) { new Notice(t('protocolEditor.duplicateEdgeRejected')); return; }
      const selectedSource = nodes.find((node) => node.id === nextFrom);
      const selectedTarget = nodes.find((node) => node.id === nextTo);
      const typedLabel = normalizeProtocolEditorEdgeLabel(labelInput.value, exitCheckbox.checked);
      const defaultLabel = defaultProtocolEditorEdgeLabelForTarget(selectedTarget);
      const shouldDisplayLabel = shouldDisplayProtocolEditorEdgeLabel(
        { ...edge, fromNodeId: nextFrom, toNodeId: nextTo, label: typedLabel ?? defaultLabel },
        selectedSource,
        selectedTarget,
      );
      const nextLabel = shouldDisplayLabel ? typedLabel ?? defaultLabel : undefined;
      try {
        await this.plugin.protocolDocumentStore.update(this.protocolPath!, (existing) => {
          if (existing === null) throw new Error('Protocol file disappeared');
          const nodes = existing.nodes.map((candidate) => {
            if (candidate.id !== nextTo || candidate.kind !== 'snippet' || typedLabel === undefined || isProtocolEditorLoopExitLabel(typedLabel)) {
              return candidate;
            }
            return {
              ...candidate,
              text: typedLabel,
              fields: {
                ...candidate.fields,
                snippetLabel: typedLabel,
              },
            };
          });
          const edges = existing.edges.map((candidate) => candidate.id === edge.id
            ? { ...candidate, fromNodeId: nextFrom, toNodeId: nextTo, label: nextLabel }
            : candidate);
          return { ...existing, nodes, edges, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
        });
        closeModal();
        new Notice(t('protocolEditor.edgeSaved'));
        await this.loadProtocol(this.protocolPath!);
      } catch (err) {
        new Notice(t('protocolEditor.saveFailed', { error: String(err) }));
      }
    });

    deleteBtn.addEventListener('click', async () => {
      closeModal();
      await this.deleteEdge(edge.id);
    });

    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });
  }

  /* Phase 4D — open edit modal for a node */
  private openEditModal(node: ProtocolNodeRecord): void {
    if (this.protocolPath === null) return;
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);

    const modalEl = document.body.createDiv({ cls: 'rp-protocol-editor-modal-backdrop' });
    const modal = modalEl.createDiv({ cls: 'rp-protocol-editor-modal' });

    const header = modal.createDiv({ cls: 'rp-protocol-editor-modal-header' });
    header.createEl('h3', { text: t('protocolEditor.editNode') });
    const closeBtn = header.createEl('button', { cls: 'rp-protocol-editor-modal-close', text: '✕' });
    const closeModal = () => {
      modalEl.remove();
      this.restoreEditorFocus();
    };
    closeBtn.addEventListener('click', closeModal);

    const body = modal.createDiv({ cls: 'rp-protocol-editor-modal-body' });

    const kindField = body.createDiv({ cls: 'rp-protocol-editor-modal-field' });
    kindField.createEl('label', { text: t('protocolEditor.kindLabel') });
    const kindSelect = kindField.createEl('select') as HTMLSelectElement;
    for (const kind of EDITABLE_NODE_KINDS) {
      kindSelect.createEl('option', { attr: { value: kind }, text: t(`protocolEditor.nodeKind.${kind}`) });
    }
    kindSelect.value = (node.kind !== null && EDITABLE_NODE_KINDS.includes(node.kind)) ? node.kind : 'question';

    const textControls: Array<{ key: string; value: () => string | boolean | undefined }> = [];
    const addInput = (key: string, label: string, value: unknown, multiline = false) => {
      const field = body.createDiv({ cls: 'rp-protocol-editor-modal-field' });
      field.createEl('label', { text: label });
      if (multiline) {
        const input = field.createEl('textarea', { text: typeof value === 'string' ? value : '' }) as HTMLTextAreaElement;
        textControls.push({ key, value: () => input.value || undefined });
      } else {
        const input = field.createEl('input', { attr: { type: 'text', value: typeof value === 'string' ? value : '' } }) as HTMLInputElement;
        textControls.push({ key, value: () => input.value || undefined });
      }
    };
    const addStartPointCheckbox = () => {
      const field = body.createDiv({ cls: 'rp-protocol-editor-modal-field rp-protocol-editor-modal-checkbox-field' });
      const label = field.createEl('label');
      const input = label.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement;
      input.checked = node.fields['startPointEnabled'] === true;
      label.appendText(t('protocolEditor.startPointEnabledLabel'));
      textControls.push({ key: 'startPointEnabled', value: () => input.checked ? true : undefined });
    };

    const addSeparator = (key: string, label: string, value: unknown) => {
      const field = body.createDiv({ cls: 'rp-protocol-editor-modal-field' });
      field.createEl('label', { text: label });
      const select = field.createEl('select') as HTMLSelectElement;
      const options: Array<[string, string]> = [['', t('protocolEditor.useGlobalSeparator')], ['newline', t('settings.newline')], ['space', t('settings.space')]];
      for (const [optionValue, optionLabel] of options) {
        select.createEl('option', { attr: { value: optionValue }, text: optionLabel });
      }
      select.value = value === 'newline' || value === 'space' ? value : '';
      textControls.push({ key, value: () => (select.value === 'newline' || select.value === 'space') ? select.value : undefined });
    };

    const addSnippetTargetPicker = (folderValue: unknown, fileValue: unknown) => {
      let selectedFolder = normalizeProtocolEditorSnippetFolderSelection(typeof folderValue === 'string' ? folderValue : '');
      let selectedFile = normalizeProtocolEditorSnippetFolderSelection(typeof fileValue === 'string' ? fileValue : '');
      const field = body.createDiv({ cls: 'rp-protocol-editor-modal-field' });
      field.createEl('label', { text: t('protocolEditor.snippetTargetLabel') });
      const folderInput = field.createEl('input', {
        attr: {
          type: 'text',
          value: selectedFolder ?? '',
          readonly: 'readonly',
          placeholder: t('protocolEditor.snippetFolderPlaceholder'),
        },
      }) as HTMLInputElement;
      const fileInput = field.createEl('input', {
        attr: {
          type: 'text',
          value: selectedFile ?? '',
          readonly: 'readonly',
          placeholder: t('protocolEditor.snippetFilePlaceholder'),
        },
      }) as HTMLInputElement;
      const clearBtn = field.createEl('button', {
        cls: 'rp-protocol-editor-modal-btn',
        text: t('protocolEditor.clearSnippetTarget'),
      });
      const pickerHost = field.createDiv({ cls: 'rp-protocol-editor-snippet-folder-picker' });
      const applySelection = (result: SnippetTreePickerResult) => {
        const normalized = normalizeProtocolEditorSnippetFolderSelection(result.relativePath);
        if (result.kind === 'folder') {
          selectedFolder = normalized;
          selectedFile = undefined;
        } else {
          selectedFile = normalized;
          selectedFolder = undefined;
        }
        folderInput.value = selectedFolder ?? '';
        fileInput.value = selectedFile ?? '';
      };
      clearBtn.addEventListener('click', () => {
        selectedFolder = undefined;
        selectedFile = undefined;
        folderInput.value = '';
        fileInput.value = '';
      });
      const picker = new SnippetTreePicker({
        app: this.app,
        snippetService: this.plugin.snippetService,
        container: pickerHost,
        mode: 'both',
        rootPath: this.plugin.settings.snippetFolderPath,
        initialSelection: selectedFile ?? selectedFolder,
        t,
        onSelect: applySelection,
      });
      void picker.mount();
      textControls.push({ key: 'subfolderPath', value: () => selectedFolder });
      textControls.push({ key: 'snippetPath', value: () => selectedFile });
    };

    addStartPointCheckbox();

    switch (node.kind) {
      case 'question':
        addInput('questionText', t('protocolEditor.questionTextLabel'), node.fields['questionText'] ?? node.text, true);
        break;
      case 'answer':
        addInput('displayLabel', t('protocolEditor.answerButtonLabelLabel'), node.fields['displayLabel']);
        addInput('answerText', t('protocolEditor.answerTextLabel'), node.fields['answerText'] ?? node.text, true);
        addSeparator('separator', t('protocolEditor.answerSeparatorLabel'), node.fields['separator']);
        break;
      case 'text-block':
        addInput('content', t('protocolEditor.contentLabel'), node.fields['content'] ?? node.text, true);
        addSeparator('separator', t('protocolEditor.textSeparatorLabel'), node.fields['separator']);
        break;
      case 'loop':
        addInput('headerText', t('protocolEditor.headerTextLabel'), node.fields['headerText'] ?? node.text, true);
        break;
      case 'snippet':
        addSnippetTargetPicker(node.fields['subfolderPath'], node.fields['snippetPath']);
        addInput('snippetLabel', t('protocolEditor.snippetNodeLabelLabel'), node.fields['snippetLabel']);
        addSeparator('snippetSeparator', t('protocolEditor.snippetSeparatorLabel'), node.fields['snippetSeparator']);
        break;
      case 'start':
      case 'loop-start':
      case 'loop-end':
      case null:
        body.createDiv({ cls: 'rp-protocol-editor-modal-help', text: t('protocolEditor.noEditableFields') });
        break;
    }

    const footer = modal.createDiv({ cls: 'rp-protocol-editor-modal-footer' });
    const deleteBtn = footer.createEl('button', {
      cls: 'rp-protocol-editor-modal-btn rp-protocol-editor-modal-btn-danger',
      text: t('protocolEditor.delete'),
    });
    const actionBtns = footer.createDiv({ cls: 'modal-actions' });
    const cancelBtn = actionBtns.createEl('button', {
      cls: 'rp-protocol-editor-modal-btn',
      text: t('protocolEditor.cancel'),
    });
    const saveBtn = actionBtns.createEl('button', {
      cls: 'rp-protocol-editor-modal-btn rp-protocol-editor-modal-btn-primary',
      text: t('protocolEditor.save'),
    });

    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async () => {
      const nextKind = kindSelect.value as RPNodeKind;
      const kindChanged = nextKind !== node.kind;
      const nextFields: Record<string, unknown> = kindChanged ? fieldsForProtocolEditorNodeKind(nextKind) : { ...node.fields };
      if (!kindChanged) for (const control of textControls) {
        const value = control.value();
        if (value === undefined) delete nextFields[control.key];
        else nextFields[control.key] = value;
      }

      const updatedNode: ProtocolNodeRecord = {
        ...node,
        kind: nextKind,
        color: kindChanged || node.color === undefined ? defaultColorForProtocolEditorNodeKind(nextKind) : node.color,
        fields: nextFields,
      };

      const titleKind = updatedNode.kind;
      const titleKey = titleKind === 'question'
        ? 'questionText'
        : titleKind === 'answer'
          ? 'answerText'
          : titleKind === 'text-block'
            ? 'content'
            : titleKind === 'loop'
              ? 'headerText'
              : titleKind === 'snippet'
                ? 'snippetLabel'
                : null;
      if (titleKey !== null && typeof nextFields[titleKey] === 'string') {
        updatedNode.text = nextFields[titleKey] as string;
      }

      try {
        await this.plugin.protocolDocumentStore.update(this.protocolPath!, (existing) => {
          if (existing === null) throw new Error('Protocol file disappeared');
          const nodes = existing.nodes.map((n) => n.id === updatedNode.id ? updatedNode : n);
          const edgeNodeById = new Map(nodes.map((n) => [n.id, n]));
          const shouldSyncIncomingLabels = updatedNode.kind === 'answer' || updatedNode.kind === 'snippet';
          const previousAutoLabel = defaultProtocolEditorEdgeLabelForTarget(node);
          const nextAutoLabel = defaultProtocolEditorEdgeLabelForTarget(updatedNode);
          const edges = shouldSyncIncomingLabels
            ? existing.edges.map((candidate) => {
              if (candidate.toNodeId !== updatedNode.id) return candidate;
              if (!shouldAutoRefreshProtocolEditorEdgeLabel(candidate.label, previousAutoLabel)) return candidate;
              const fromNode = edgeNodeById.get(candidate.fromNodeId);
              const shouldDisplayLabel = shouldDisplayProtocolEditorEdgeLabel(
                { ...candidate, label: nextAutoLabel },
                fromNode,
                updatedNode,
              );
              return { ...candidate, label: shouldDisplayLabel ? nextAutoLabel : undefined };
            })
            : existing.edges;
          return { ...existing, nodes, edges, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
        });
        closeModal();
        new Notice(t('protocolEditor.nodeSaved'));
        void this.loadProtocol(this.protocolPath!);
      } catch (err) {
        new Notice(t('protocolEditor.saveFailed', { error: String(err) }));
      }
    });

    deleteBtn.addEventListener('click', () => {
      deleteBtn.setAttr('disabled', 'disabled');
      const confirmWrap = footer.createDiv({ cls: 'rp-protocol-editor-confirm' });
      confirmWrap.createSpan({ text: t('protocolEditor.deleteNodeConfirm') });
      const confirmBtn = confirmWrap.createEl('button', {
        cls: 'rp-protocol-editor-modal-btn rp-protocol-editor-modal-btn-danger',
        text: t('protocolEditor.confirmDelete'),
      });
      confirmBtn.addEventListener('click', async () => {
        try {
        await this.plugin.protocolDocumentStore.update(this.protocolPath!, (existing) => {
          if (existing === null) throw new Error('Protocol file disappeared');
          const nodes = existing.nodes.filter((n) => n.id !== node.id);
          const edges = existing.edges.filter((e) => e.fromNodeId !== node.id && e.toNodeId !== node.id);
          return { ...existing, nodes, edges, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
        });
        closeModal();
        new Notice(t('protocolEditor.nodeDeleted'));
        void this.loadProtocol(this.protocolPath!);
      } catch (err) {
          new Notice(t('protocolEditor.deleteFailed', { error: String(err) }));
        }
      });
    });

    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal();
    });
  }

}
