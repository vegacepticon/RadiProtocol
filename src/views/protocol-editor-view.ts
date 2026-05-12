import { ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { ProtocolDocumentV1, ProtocolEdgeRecord, ProtocolNodeRecord } from '../protocol/protocol-document';
import type { RPNodeKind } from '../graph/graph-model';

export const PROTOCOL_EDITOR_VIEW_TYPE = 'radiprotocol-protocol-editor';

/* Phase 4D — default node dimensions and kind-specific defaults */
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 80;
const DEFAULT_VIEWPORT_WIDTH = 2400;
const DEFAULT_VIEWPORT_HEIGHT = 1600;
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
  start: { kind: 'start', fields: {}, color: 'var(--color-green)' },
  question: { kind: 'question', fields: { questionText: '' }, text: 'New question' },
  answer: { kind: 'answer', fields: { answerText: '' }, text: 'New answer' },
  'text-block': { kind: 'text-block', fields: { content: '' }, text: 'New text block' },
  loop: { kind: 'loop', fields: { headerText: '' }, text: 'New loop' },
  snippet: { kind: 'snippet', fields: {}, text: 'New snippet' },
};

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
    toolbar.createEl('div', {
      cls: 'rp-protocol-editor-path',
      text: this.protocolPath ?? this.plugin.i18n.t('protocolEditor.noFileLoaded'),
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
      color: defaults.color,
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

    const nodeById = new Map(this.doc.nodes.map(node => [node.id, node]));

    for (const edge of this.doc.edges) {
      const from = nodeById.get(edge.fromNodeId);
      const to = nodeById.get(edge.toNodeId);
      if (from === undefined || to === undefined) continue;
      const x1 = from.x + from.width;
      const y1 = from.y + from.height / 2;
      const x2 = to.x;
      const y2 = to.y + to.height / 2;
      this.svgEl.createSvg('path', {
        attr: {
          d: edgePath(x1, y1, x2, y2),
          class: 'rp-protocol-editor-edge',
        },
      });
      if (edge.label !== undefined && edge.label.trim() !== '') {
        const label = this.svgEl.createSvg('text', {
          attr: {
            x: String((x1 + x2) / 2),
            y: String((y1 + y2) / 2 - 6),
            class: 'rp-protocol-editor-edge-label',
          },
        });
        label.textContent = edge.label;
      }
    }

    for (const node of this.doc.nodes) {
      const nodeEl = this.surfaceEl.createDiv({ cls: 'rp-protocol-editor-node' });
      nodeEl.toggleClass('is-untyped', node.kind === null);
      nodeEl.setAttr('data-node-id', node.id);
      nodeEl.setAttr('data-node-kind', node.kind ?? 'untyped');
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

      this.bindConnectionDrag(outputPort, node);
      this.bindDrag(nodeEl, node);

      /* Phase 4D — double-click to edit */
      nodeEl.addEventListener('dblclick', (e) => {
        if ((e.target as HTMLElement).closest('.rp-protocol-editor-port') !== null) return;
        e.preventDefault();
        e.stopPropagation();
        this.openEditModal(node);
      });
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

  private async finishConnectionDrag(ev: MouseEvent): Promise<void> {
    const state = this.connectionDragState;
    this.connectionDragState = null;
    state?.previewPath.remove();
    if (state === null || this.doc === null || this.protocolPath === null) return;

    const target = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
    const inputPort = target?.closest('.rp-protocol-editor-port-input') as HTMLElement | null;
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

      const onMove = (ev: MouseEvent) => {
        const dx = screenDeltaToProtocolEditorDelta(ev.clientX - startX, this.zoom);
        const dy = screenDeltaToProtocolEditorDelta(ev.clientY - startY, this.zoom);
        const newX = Math.max(0, origX + dx);
        const newY = Math.max(0, origY + dy);
        nodeEl.setAttr('style', `left:${newX}px;top:${newY}px;width:${node.width}px;min-height:${node.height}px;${node.color !== undefined ? `--rp-node-color:${node.color};` : ''}`);
      };

      const onUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        nodeEl.removeClass('rp-node-dragging');

        const dx = screenDeltaToProtocolEditorDelta(ev.clientX - startX, this.zoom);
        const dy = screenDeltaToProtocolEditorDelta(ev.clientY - startY, this.zoom);
        const newX = Math.max(0, Math.round(origX + dx));
        const newY = Math.max(0, Math.round(origY + dy));

        if (newX === node.x && newY === node.y) return;

        node.x = newX;
        node.y = newY;
        void this.savePosition(node);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  /* Phase 4D — persist node position change */
  private async savePosition(node: ProtocolNodeRecord): Promise<void> {
    if (this.protocolPath === null) return;
    try {
      await this.plugin.protocolDocumentStore.update(this.protocolPath, (existing) => {
        if (existing === null) throw new Error('Protocol file disappeared');
        const nodes = existing.nodes.map((n) =>
          n.id === node.id ? { ...n, x: node.x, y: node.y } : n,
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

  /* Phase 4D — open edit modal for a node */
  private openEditModal(node: ProtocolNodeRecord): void {
    if (this.protocolPath === null) return;
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);

    const modalEl = document.body.createDiv({ cls: 'rp-protocol-editor-modal-backdrop' });
    const modal = modalEl.createDiv({ cls: 'rp-protocol-editor-modal' });

    /* Header */
    const header = modal.createDiv({ cls: 'rp-protocol-editor-modal-header' });
    header.createEl('h3', { text: t('protocolEditor.editNode') });
    const closeBtn = header.createEl('button', { cls: 'rp-protocol-editor-modal-close', text: '✕' });
    const closeModal = () => modalEl.remove();
    closeBtn.addEventListener('click', closeModal);

    /* Body — form fields */
    const body = modal.createDiv({ cls: 'rp-protocol-editor-modal-body' });

    /* Kind (read-only) */
    const kindField = body.createDiv({ cls: 'rp-protocol-editor-modal-field' });
    kindField.createEl('label', { text: t('protocolEditor.kindLabel') });
    kindField.createEl('input', {
      attr: { type: 'text', value: node.kind ?? 'untyped', readonly: 'readonly' },
    });

    /* Text */
    const textField = body.createDiv({ cls: 'rp-protocol-editor-modal-field' });
    textField.createEl('label', { text: t('protocolEditor.textLabel') });
    const textInput = textField.createEl('textarea', { text: node.text ?? '' }) as HTMLTextAreaElement;

    /* Position row */
    const posField = body.createDiv({ cls: 'rp-protocol-editor-modal-field' });
    posField.createEl('label', { text: `${t('protocolEditor.xLabel')} / ${t('protocolEditor.yLabel')}` });
    const posRow = posField.createDiv({ cls: 'field-row' });
    const xInput = posRow.createEl('input', { attr: { type: 'number', value: String(node.x) } }) as HTMLInputElement;
    const yInput = posRow.createEl('input', { attr: { type: 'number', value: String(node.y) } }) as HTMLInputElement;

    /* Size row */
    const sizeField = body.createDiv({ cls: 'rp-protocol-editor-modal-field' });
    sizeField.createEl('label', { text: `${t('protocolEditor.widthLabel')} / ${t('protocolEditor.heightLabel')}` });
    const sizeRow = sizeField.createDiv({ cls: 'field-row' });
    const wInput = sizeRow.createEl('input', { attr: { type: 'number', value: String(node.width) } }) as HTMLInputElement;
    const hInput = sizeRow.createEl('input', { attr: { type: 'number', value: String(node.height) } }) as HTMLInputElement;

    /* Color */
    const colorField = body.createDiv({ cls: 'rp-protocol-editor-modal-field' });
    colorField.createEl('label', { text: t('protocolEditor.colorLabel') });
    const colorInput = colorField.createEl('input', {
      attr: { type: 'color', value: node.color ?? '#000000' },
    }) as HTMLInputElement;

    /* Fields JSON */
    const fieldsField = body.createDiv({ cls: 'rp-protocol-editor-modal-field' });
    fieldsField.createEl('label', { text: t('protocolEditor.fieldsLabel') });
    const fieldsInput = fieldsField.createEl('textarea', {
      text: JSON.stringify(node.fields, null, 2),
    }) as HTMLTextAreaElement;

    /* Footer */
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

    /* Phase 4D — save handler */
    saveBtn.addEventListener('click', async () => {
      let parsedFields: Record<string, unknown>;
      try {
        parsedFields = JSON.parse(fieldsInput.value);
      } catch {
        new Notice(t('protocolEditor.invalidFieldsJson'));
        return;
      }

      const updatedNode: ProtocolNodeRecord = {
        ...node,
        text: textInput.value || undefined,
        x: parseInt(xInput.value, 10) || 0,
        y: parseInt(yInput.value, 10) || 0,
        width: parseInt(wInput.value, 10) || DEFAULT_NODE_WIDTH,
        height: parseInt(hInput.value, 10) || DEFAULT_NODE_HEIGHT,
        color: colorInput.value !== '#000000' ? colorInput.value : undefined,
        fields: parsedFields,
      };

      try {
        await this.plugin.protocolDocumentStore.update(this.protocolPath!, (existing) => {
          if (existing === null) throw new Error('Protocol file disappeared');
          const nodes = existing.nodes.map((n) =>
            n.id === updatedNode.id ? updatedNode : n,
          );
          return { ...existing, nodes, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
        });
        closeModal();
        new Notice(t('protocolEditor.nodeSaved'));
        void this.loadProtocol(this.protocolPath!);
      } catch (err) {
        new Notice(t('protocolEditor.saveFailed', { error: String(err) }));
      }
    });

    /* Phase 4D — delete handler */
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(t('protocolEditor.deleteNodeConfirm'))) return;
      try {
        await this.plugin.protocolDocumentStore.update(this.protocolPath!, (existing) => {
          if (existing === null) throw new Error('Protocol file disappeared');
          const nodes = existing.nodes.filter((n) => n.id !== node.id);
          const edges = existing.edges.filter(
            (e) => e.fromNodeId !== node.id && e.toNodeId !== node.id,
          );
          return { ...existing, nodes, edges, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
        });
        closeModal();
        new Notice(t('protocolEditor.nodeDeleted'));
        void this.loadProtocol(this.protocolPath!);
      } catch (err) {
        new Notice(t('protocolEditor.deleteFailed', { error: String(err) }));
      }
    });

    /* Close on backdrop click */
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal();
    });
  }
}
