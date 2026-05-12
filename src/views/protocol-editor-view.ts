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
const MIN_NODE_WIDTH = 120;
const MIN_NODE_HEIGHT = 50;
const MIN_ZOOM = 0.4;
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
  if (isLoopExit) return `+${withoutPrefix}`;
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
    this.restoreViewportState();
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
      btn.addEventListener('click', () => this.addNodeAtCenter(key as RPNodeKind | null));
    }

    const zoomIndicator = actions.createDiv({ cls: 'rp-protocol-editor-zoom-indicator' });
    zoomIndicator.setText(`${Math.round(this.zoom * 100)}%`);

    this.viewportEl = this.rootEl.createDiv({ cls: 'rp-protocol-editor-viewport' });
    this.viewportEl.setAttr('data-zoom', String(this.zoom));
    this.svgEl = this.viewportEl.createSvg('svg', { cls: 'rp-protocol-editor-edges' });
    this.surfaceEl = this.viewportEl.createDiv({ cls: 'rp-protocol-editor-surface' });
    this.applyZoom();
    this.bindViewportControls();

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

    const cx = (this.viewportEl.scrollLeft + this.viewportEl.clientWidth / 2) / this.zoom - DEFAULT_NODE_WIDTH / 2;
    const cy = (this.viewportEl.scrollTop + this.viewportEl.clientHeight / 2) / this.zoom - DEFAULT_NODE_HEIGHT / 2;

    const defaults = (kind !== null && NODE_KIND_DEFAULTS[kind])
      ? NODE_KIND_DEFAULTS[kind]
      : { kind: null as RPNodeKind | null, fields: {} };

    const newNode: ProtocolNodeRecord = {
      id: nodeUid(),
      kind: defaults.kind,
      x: Math.max(0, Math.round(cx)),
      y: Math.max(0, Math.round(cy)),
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
  }

  private renderEdges(): void {
    if (this.doc === null || this.svgEl === null) return;
    this.svgEl.empty();
    const nodeById = new Map(this.doc.nodes.map(node => [node.id, node]));
    for (const edge of this.doc.edges) {
      const from = nodeById.get(edge.fromNodeId);
      const to = nodeById.get(edge.toNodeId);
      if (from === undefined || to === undefined) continue;
      const x1 = from.x + from.width;
      const y1 = from.y + from.height / 2;
      const x2 = to.x;
      const y2 = to.y + to.height / 2;
      const path = this.svgEl.createSvg('path', {
        attr: {
          d: edgePath(x1, y1, x2, y2),
          class: 'rp-protocol-editor-edge',
          'data-edge-id': edge.id,
          role: 'button',
          tabindex: '0',
          'aria-label': this.plugin.i18n.t('protocolEditor.editEdge'),
        },
      }) as SVGPathElement;
      path.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openEdgeModal(edge);
      });
      path.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        e.preventDefault();
        e.stopPropagation();
        void this.deleteEdge(edge.id);
      });
      if (edge.label !== undefined && edge.label.trim() !== '') {
        const label = this.svgEl.createSvg('text', {
          attr: {
            x: String((x1 + x2) / 2),
            y: String((y1 + y2) / 2 - 6),
            class: 'rp-protocol-editor-edge-label',
          },
        });
        label.textContent = displayProtocolEditorEdgeLabel(edge.label);
      }
    }
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
    nodeEl.setAttr('style', `left:${node.x}px;top:${node.y}px;width:${node.width}px;min-height:${node.height}px;${node.color !== undefined ? `--rp-node-color:${node.color};` : ''}`);
  }

  private bindConnectionDrag(outputPort: HTMLElement, node: ProtocolNodeRecord): void {
    outputPort.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0 || this.svgEl === null) return;
      e.preventDefault();
      e.stopPropagation();

      const startX = node.x + node.width;
      const startY = node.y + node.height / 2;
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

    const newEdge: ProtocolEdgeRecord = {
      id: edgeUid(),
      fromNodeId: state.fromNodeId,
      toNodeId,
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
        const newX = Math.max(0, origX + dx);
        const newY = Math.max(0, origY + dy);
        node.x = newX;
        node.y = newY;
        nodeEl.setAttr('style', `left:${newX}px;top:${newY}px;width:${node.width}px;min-height:${node.height}px;${node.color !== undefined ? `--rp-node-color:${node.color};` : ''}`);
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
        const newX = Math.max(0, Math.round(origX + dx));
        const newY = Math.max(0, Math.round(origY + dy));

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
      if ((e.target as HTMLElement).closest('.rp-protocol-editor-node') !== null) return;
      if ((e.target as HTMLElement).closest('.rp-protocol-editor-port') !== null) return;
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
      this.scheduleViewportSave();
    }, { passive: false });

    this.viewportEl.addEventListener('scroll', () => this.scheduleViewportSave());
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
    const viewport = this.doc.viewport;
    if (viewport === undefined) return;
    window.requestAnimationFrame(() => {
      if (this.viewportEl === null) return;
      this.viewportEl.scrollLeft = Math.max(0, viewport.x);
      this.viewportEl.scrollTop = Math.max(0, viewport.y);
    });
  }

  private currentViewportState(): { x: number; y: number; zoom: number } {
    return {
      x: Math.round(this.viewportEl?.scrollLeft ?? this.doc?.viewport?.x ?? 0),
      y: Math.round(this.viewportEl?.scrollTop ?? this.doc?.viewport?.y ?? 0),
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
      attr: { type: 'text', value: displayProtocolEditorEdgeLabel(edge.label) },
    }) as HTMLInputElement;
    const exitField = body.createDiv({ cls: 'rp-protocol-editor-modal-field rp-protocol-editor-checkbox-field' });
    const exitLabel = exitField.createEl('label');
    const exitCheckbox = exitLabel.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement;
    exitLabel.appendText(` ${t('protocolEditor.loopExitLabel')}`);
    exitCheckbox.checked = isProtocolEditorLoopExitLabel(edge.label);
    const syncExitVisibility = () => {
      const fromNode = nodes.find((node) => node.id === fromSelect.value);
      exitField.toggleClass('is-hidden', fromNode?.kind !== 'loop');
      if (fromNode?.kind !== 'loop') exitCheckbox.checked = false;
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
      const nextLabel = normalizeProtocolEditorEdgeLabel(labelInput.value, exitCheckbox.checked);
      try {
        await this.plugin.protocolDocumentStore.update(this.protocolPath!, (existing) => {
          if (existing === null) throw new Error('Protocol file disappeared');
          const edges = existing.edges.map((candidate) => candidate.id === edge.id
            ? { ...candidate, fromNodeId: nextFrom, toNodeId: nextTo, label: nextLabel }
            : candidate);
          return { ...existing, edges, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
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

    const textControls: Array<{ key: string; value: () => string | undefined }> = [];
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

    switch (node.kind) {
      case 'question':
        addInput('questionText', t('protocolEditor.questionTextLabel'), node.fields['questionText'] ?? node.text, true);
        break;
      case 'answer':
        addInput('displayLabel', t('protocolEditor.displayLabelLabel'), node.fields['displayLabel']);
        addInput('answerText', t('protocolEditor.answerTextLabel'), node.fields['answerText'] ?? node.text, true);
        addSeparator('separator', t('protocolEditor.textSeparatorLabel'), node.fields['separator']);
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
          return { ...existing, nodes, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
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
