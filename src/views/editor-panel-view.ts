import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { RPNodeKind } from '../graph/graph-model';
import type RadiProtocolPlugin from '../main';
import type { CanvasChangedForNodeDetail } from '../canvas/edge-label-sync-service';
// Phase 51 Plan 03 (PICKER-02 D-05): inline hierarchical snippet/folder picker for Snippet nodes.
// See `docs/ARCHITECTURE-NOTES.md#snippet-node-binding-and-picker` (Shared Pattern H).
import { SnippetTreePicker } from './snippet-tree-picker';
// Phase 76 (SPLIT-01) — extracted helper modules. Class methods below are thin
// wrappers that delegate to these so test access patterns (view['renderForm'],
// vi.spyOn(view, 'saveNodeEdits'), etc.) keep working unchanged.
import { saveNodeEditsImpl } from './editor-panel/save-node-edits';
import type { FormContext } from './editor-panel/forms/_shared';
import { renderStartForm } from './editor-panel/forms/start-form';
import { renderLoopForm } from './editor-panel/forms/loop-form';
import { renderQuestionForm } from './editor-panel/forms/question-form';
import { renderTextBlockForm } from './editor-panel/forms/text-block-form';
import { renderAnswerForm } from './editor-panel/forms/answer-form';
import { renderSnippetForm } from './editor-panel/forms/snippet-form';
import { renderToolbar as renderToolbarImpl } from './editor-panel/render-toolbar';
import { renderGrowableTextarea as renderGrowableTextareaImpl } from './editor-panel/growable-textarea';
import {
  attachCanvasListener as attachCanvasListenerImpl,
  type CanvasListenerState,
} from './editor-panel/canvas-listener';
import {
  applyCanvasPatchImpl,
  registerFieldRefImpl,
} from './editor-panel/canvas-patch';
import {
  onQuickCreate as onQuickCreateImpl,
  onDuplicate as onDuplicateImpl,
  type QuickCreateKind,
  type QuickCreateState,
} from './editor-panel/quick-create-controller';
import {
  renderNodeFormImpl,
  renderFormImpl,
  type RenderHost,
} from './editor-panel/render-form';
import {
  scheduleAutoSave as scheduleAutoSaveImpl,
  onTypeDropdownChange as onTypeDropdownChangeImpl,
  showSavedIndicator as showSavedIndicatorImpl,
  type AutosaveState,
} from './editor-panel/autosave';

export const EDITOR_PANEL_VIEW_TYPE = 'radiprotocol-editor-panel';

export class EditorPanelView extends ItemView {
  private plugin: RadiProtocolPlugin;
  private currentNodeId: string | null = null;
  private currentFilePath: string | null = null;
  private pendingEdits: Record<string, unknown> = {};
  // Phase 63 D-08 — DOM ref per pendingEdits-key; consulted by applyCanvasPatch.
  private formFieldRefs = new Map<string, HTMLInputElement | HTMLTextAreaElement>();
  // Phase 63 D-07 — canvas patches stashed while a field is focused; flushed on blur.
  private pendingCanvasUpdate = new Map<string, string | undefined>();
  // kindFormSection holds the container for kind-specific fields
  // so onChange can call kindFormSection.empty() + rebuild without
  // clearing the node-type dropdown
  private kindFormSection: HTMLElement | null = null;
  // Auto-switch canvas listener bookkeeping (EDITOR-01)
  private canvasPointerdownHandler: (() => void) | null = null;
  private watchedCanvasContainer: HTMLElement | null = null;
  // Auto-save (Phase 23)
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _savedIndicatorEl: HTMLElement | null = null;
  private _indicatorTimer: ReturnType<typeof setTimeout> | null = null;
  // Phase 51 Plan 03 D-05 — current SnippetTreePicker instance for the active snippet
  // node form. Null when no snippet node is selected or after unmount. Cleaned up on
  // form re-render (see buildKindForm head) and when a new picker is mounted.
  private snippetTreePicker: SnippetTreePicker | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return EDITOR_PANEL_VIEW_TYPE; }
  getDisplayText(): string { return 'Protocol node editor'; }
  getIcon(): string { return 'pencil'; }

  async onOpen(): Promise<void> {
    this.renderIdle();
    this.attachCanvasListener();

    // Re-attach when user switches active leaf (e.g. opens a second canvas)
    type EventRef = import('obsidian').EventRef;
    this.registerEvent(
      (this.plugin.app.workspace as unknown as {
        on(event: 'active-leaf-change', handler: () => void): EventRef;
      }).on('active-leaf-change', () => {
        this.attachCanvasListener();
      })
    );

    // Phase 63 D-12 — subscribe to canvas-changed-for-node from EdgeLabelSyncService
    // (Plan 02 dispatch bus). The returned unsubscribe is wired through
    // Component.register(...) so it auto-detaches when the view unmounts (T-04
    // multi-instance subscription leak guard). Inbound patches reach
    // applyCanvasPatch which decides per-field whether to write .value, stash
    // for blur, kick a full re-render (D-09), or return to renderIdle (D-10).
    const unsubscribeCanvas = this.plugin.edgeLabelSyncService.subscribe(
      (detail) => this.applyCanvasPatch(detail),
    );
    this.register(unsubscribeCanvas);
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
    // Phase 63 — release DOM refs and stashed patches on view unmount (T-04
    // leak prevention). The subscribe()-returned unsubscribe is auto-invoked by
    // Component.register from onOpen so the bus-side listener is detached too.
    this.formFieldRefs.clear();
    this.pendingCanvasUpdate.clear();
  }

  private attachCanvasListener(): void {
    attachCanvasListenerImpl({
      plugin: this.plugin,
      state: this as unknown as CanvasListenerState,
      registerDomEvent: this.registerDomEvent.bind(this),
      handleNodeClick: (fp, nid) => this.handleNodeClick(fp, nid),
    });
  }

  private async handleNodeClick(filePath: string, nodeId: string): Promise<void> {
    // No-op: same node already loaded — avoids form flicker on re-click
    if (this.currentFilePath === filePath && this.currentNodeId === nodeId) return;

    // D-02: Flush pending debounce before switching nodes
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
      if (this.currentFilePath && this.currentNodeId) {
        const editsSnapshot = { ...this.pendingEdits };
        try {
          await this.saveNodeEdits(this.currentFilePath, this.currentNodeId, editsSnapshot);
        } catch {
          // flush save failure does not block navigation — silent
        }
      }
    }

    // D-03: Reveal the Node Editor tab before loading the node form (TAB-01)
    await this.plugin.ensureEditorPanelVisible();
    this.loadNode(filePath, nodeId);
  }

  private renderIdle(): void {
    this.contentEl.empty();
    const container = this.contentEl.createDiv({ cls: 'rp-editor-idle' });
    container.createEl('p', { text: 'No node selected' });
    container.createEl('p', {
      text: "Right-click a canvas node and choose 'edit protocol properties' to open its configuration form.",
    });
    // Phase 48 NODEUI-05: toolbar moved to bottom (was Phase 39 top-of-panel).
    this.renderToolbar(this.contentEl);
  }

  loadNode(canvasFilePath: string, nodeId: string): void {
    // Safety net: clear any stale timer if loadNode is called outside handleNodeClick
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this.currentFilePath = canvasFilePath;
    this.currentNodeId = nodeId;
    this.pendingEdits = {};
    // Phase 63 — clear DOM refs and stashed canvas patches on node switch.
    // Adjacent to the existing pendingEdits reset for symmetry; without this
    // the formFieldRefs Map would retain pointers to the previous node's
    // detached textareas (RESEARCH T-04 use-after-free variant).
    this.formFieldRefs.clear();
    this.pendingCanvasUpdate.clear();
    void this.renderNodeForm(canvasFilePath, nodeId);
  }

  async saveNodeEdits(
    filePath: string,
    nodeId: string,
    edits: Record<string, unknown>
  ): Promise<void> {
    return saveNodeEditsImpl(this.plugin, filePath, nodeId, edits);
  }

  // Phase 76 (SPLIT-01 G7) — wrapper preserves the in-class call sites
  // (loadNode, applyCanvasPatch path). Body lives in editor-panel/render-form.ts.
  private renderNodeForm(filePath: string, nodeId: string): Promise<void> {
    return renderNodeFormImpl(this.makeRenderHost(), filePath, nodeId);
  }

  // Phase 76 (SPLIT-01 G7) — wrapper preserves the `view['renderForm']` test
  // surface (canvas-sync, editor-panel-forms) and lets quick-create dispatch
  // through this.renderForm(...). Body lives in editor-panel/render-form.ts.
  private renderForm(nodeRecord: Record<string, unknown>, currentKind: RPNodeKind | null): void {
    renderFormImpl(this.makeRenderHost(), nodeRecord, currentKind);
  }

  private makeRenderHost(): RenderHost {
    return {
      contentEl: this.contentEl,
      plugin: this.plugin,
      formFieldRefs: this.formFieldRefs,
      pendingCanvasUpdate: this.pendingCanvasUpdate,
      getPendingEdits: () => this.pendingEdits,
      resetPendingEdits: () => { this.pendingEdits = {}; },
      setKindFormSection: (el) => { this.kindFormSection = el; },
      setSavedIndicatorEl: (el) => { this._savedIndicatorEl = el; },
      renderError: (msg) => this.renderError(msg),
      renderIdle: () => this.renderIdle(),
      renderToolbar: (container) => this.renderToolbar(container),
      renderForm: (record, kind) => this.renderForm(record, kind),
      buildKindForm: (container, record, kind) => this.buildKindForm(container, record, kind),
      onTypeDropdownChange: (value) => this.onTypeDropdownChange(value),
    };
  }

  // Phase 76 (SPLIT-01 G3) — wrapper preserves the `view['applyCanvasPatch']`
  // private test surface; the body lives in editor-panel/canvas-patch.ts.
  private applyCanvasPatch(detail: CanvasChangedForNodeDetail): void {
    applyCanvasPatchImpl(detail, {
      formFieldRefs: this.formFieldRefs,
      pendingCanvasUpdate: this.pendingCanvasUpdate,
      getCurrentFilePath: () => this.currentFilePath,
      getCurrentNodeId: () => this.currentNodeId,
      setCurrentFilePath: (v) => { this.currentFilePath = v; },
      setCurrentNodeId: (v) => { this.currentNodeId = v; },
      resetPendingEdits: () => { this.pendingEdits = {}; },
      renderIdle: () => this.renderIdle(),
      renderNodeForm: (fp, nid) => { void this.renderNodeForm(fp, nid); },
    });
  }

  // Phase 76 (SPLIT-01 G3) — wrapper kept because makeFormContext exposes it
  // to the per-kind form modules; body lives in editor-panel/canvas-patch.ts.
  private registerFieldRef(
    key: string,
    el: HTMLInputElement | HTMLTextAreaElement,
  ): void {
    registerFieldRefImpl(key, el, {
      formFieldRefs: this.formFieldRefs,
      pendingCanvasUpdate: this.pendingCanvasUpdate,
      registerDomEvent:
        typeof this.registerDomEvent === 'function'
          ? this.registerDomEvent.bind(this)
          : undefined,
    });
  }

  // Phase 76 Plan 01 (SPLIT-01) — factory for the constrained context handed to
  // extracted per-kind form modules. Form modules receive `pendingEdits` by
  // reference so their onInput callbacks mutate the same object the dispatcher
  // and autosave pipeline read; method references are arrow-bound so callees
  // never see EditorPanelView directly.
  private makeFormContext(): FormContext {
    return {
      pendingEdits: this.pendingEdits,
      registerFieldRef: (key, el) => this.registerFieldRef(key, el),
      scheduleAutoSave: () => this.scheduleAutoSave(),
      renderGrowableTextarea: (container, opts) =>
        renderGrowableTextareaImpl(container, opts, {
          scheduleAutoSave: () => this.scheduleAutoSave(),
          registerDomEvent:
            typeof this.registerDomEvent === 'function'
              ? this.registerDomEvent.bind(this)
              : undefined,
        }),
      plugin: this.plugin,
      app: this.plugin.app,
      setSnippetTreePicker: (picker) => {
        this.snippetTreePicker = picker;
      },
    };
  }

  private buildKindForm(
    container: HTMLElement,
    nodeRecord: Record<string, unknown>,
    kind: RPNodeKind | null
  ): void {
    // Phase 51 Plan 03 D-05 — lifecycle: unmount any SnippetTreePicker from the prior
    // render before building a new form. Protects against leaked event listeners when
    // the user rapidly switches selection between snippet nodes or to a non-snippet kind.
    if (this.snippetTreePicker !== null) {
      this.snippetTreePicker.unmount();
      this.snippetTreePicker = null;
    }

    if (!kind) return; // unset — no kind-specific fields

    switch (kind) {
      case 'start': {
        renderStartForm(container, nodeRecord, this.makeFormContext());
        break;
      }

      case 'question': {
        renderQuestionForm(container, nodeRecord, this.makeFormContext());
        break;
      }

      case 'answer': {
        renderAnswerForm(container, nodeRecord, this.makeFormContext());
        break;
      }

      case 'text-block': {
        renderTextBlockForm(container, nodeRecord, this.makeFormContext());
        break;
      }

      case 'loop-start':
      case 'loop-end':
      case 'loop': {
        renderLoopForm(container, nodeRecord, kind, this.makeFormContext());
        break;
      }

      case 'snippet': {
        renderSnippetForm(container, nodeRecord, this.makeFormContext());
        break;
      }
    }
  }

  // Phase 76 (SPLIT-01 G8) — wrappers preserve dynamic dispatch. Forms call
  // `scheduleAutoSave` through FormContext; tests reassign `view.scheduleAutoSave`
  // to install spies. The regression suite also asserts the identifiers
  // `scheduleAutoSave` / `_debounceTimer` / `showSavedIndicator` appear here.
  private scheduleAutoSave(): void {
    scheduleAutoSaveImpl({
      state: this as unknown as AutosaveState,
      saveNodeEdits: (fp, nid, e) => this.saveNodeEdits(fp, nid, e),
      showSavedIndicator: () => this.showSavedIndicator(),
    });
  }

  private onTypeDropdownChange(value: string): void {
    onTypeDropdownChangeImpl(value, {
      state: this as unknown as AutosaveState,
      saveNodeEdits: (fp, nid, e) => this.saveNodeEdits(fp, nid, e),
      showSavedIndicator: () => this.showSavedIndicator(),
    });
  }

  private showSavedIndicator(): void {
    showSavedIndicatorImpl(this as unknown as AutosaveState);
  }

  private renderError(message: string): void {
    this.contentEl.empty();
    const container = this.contentEl.createDiv({ cls: 'rp-editor-idle' });
    container.createEl('p', { text: message });
  }

  // Phase 76 (SPLIT-01 G4) — wrappers preserve the `view.onQuickCreate(...)` /
  // `view.onDuplicate()` private surface used by editor-panel-create tests
  // (including `vi.spyOn(view, 'onQuickCreate')`) and let the toolbar wrapper
  // continue dispatching via `this.*`. Bodies live in
  // editor-panel/quick-create-controller.ts.

  private async onQuickCreate(kind: QuickCreateKind): Promise<void> {
    return onQuickCreateImpl(kind, {
      plugin: this.plugin,
      state: this as unknown as QuickCreateState,
      saveNodeEdits: (fp, nid, e) => this.saveNodeEdits(fp, nid, e),
      renderForm: (record, k) => this.renderForm(record, k),
    });
  }

  private async onDuplicate(): Promise<void> {
    return onDuplicateImpl({
      plugin: this.plugin,
      state: this as unknown as QuickCreateState,
      saveNodeEdits: (fp, nid, e) => this.saveNodeEdits(fp, nid, e),
      renderForm: (record, k) => this.renderForm(record, k),
    });
  }

  private renderToolbar(container: HTMLElement): void {
    renderToolbarImpl(container, {
      registerDomEvent: this.registerDomEvent.bind(this),
      hasCurrentNode: this.currentNodeId !== null,
      onQuickCreate: (kind) => { void this.onQuickCreate(kind); },
      onDuplicate: () => { void this.onDuplicate(); },
    });
  }

}
