import { ItemView, WorkspaceLeaf, Setting, TFile, Notice, setIcon } from 'obsidian';
import type { RPNodeKind } from '../graph/graph-model';
import type RadiProtocolPlugin from '../main';
import type { CanvasInternal } from '../types/canvas-internal';
import { NODE_COLOR_MAP } from '../canvas/node-color-map';
// Phase 50 D-14: enumerates incoming Question→Answer edges for atomic Node Editor write
import { collectIncomingEdgeEdits } from '../canvas/edge-label-sync-service';
import { CanvasParser } from '../graph/canvas-parser';
// Phase 51 Plan 03 (PICKER-02 D-05): inline hierarchical snippet/folder picker for Snippet nodes.
// See `.planning/notes/snippet-node-binding-and-picker.md` (Shared Pattern H).
import { SnippetTreePicker } from './snippet-tree-picker';

export const EDITOR_PANEL_VIEW_TYPE = 'radiprotocol-editor-panel';

export class EditorPanelView extends ItemView {
  private plugin: RadiProtocolPlugin;
  private currentNodeId: string | null = null;
  private currentFilePath: string | null = null;
  private pendingEdits: Record<string, unknown> = {};
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
  getDisplayText(): string { return 'RadiProtocol node editor'; }
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
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private attachCanvasListener(): void {
    const canvasLeaves = this.plugin.app.workspace.getLeavesOfType('canvas');
    const activeLeaf = this.plugin.app.workspace.getMostRecentLeaf();
    const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
    if (!canvasLeaf) return;

    // containerEl is an undocumented but stable property on WorkspaceLeaf (EDITOR-01).
    const canvasLeafInternal = canvasLeaf as unknown as {
      containerEl: HTMLElement;
      view: unknown;
    };

    // Early-return: already watching this exact container — do not re-register.
    // Prevents listener accumulation when active-leaf-change fires on modal open/close.
    if (this.watchedCanvasContainer === canvasLeafInternal.containerEl) return;

    // Genuine switch to a different canvas leaf — reset bookkeeping.
    this.canvasPointerdownHandler = null;
    this.watchedCanvasContainer = null;

    const canvasView = canvasLeaf.view as unknown as {
      file?: { path: string };
      canvas?: { selection?: Set<{ id: string; [key: string]: unknown }> };
    };

    this.watchedCanvasContainer = canvasLeafInternal.containerEl;

    this.canvasPointerdownHandler = () => {
      // Phase 42 Plan 03: defer the selection read via setTimeout(0) per
      // canvas-internal.d.ts — Obsidian updates canvas.selection AFTER the
      // pointer event, not synchronously. Reading sync causes the double-click
      // -creates-node flow to miss the freshly-selected node and leaves the
      // Node Editor stuck on the previous selection (UAT gap 1).
      setTimeout(() => {
        const selection = canvasView.canvas?.selection;
        if (!selection || selection.size !== 1) return; // ignore multi-select

        const node = Array.from(selection)[0];
        if (!node?.id) return;

        const filePath = canvasView.file?.path;
        if (!filePath) return;

        void this.handleNodeClick(filePath, node.id);
      }, 0);
    };

    if (this.watchedCanvasContainer !== null) {
      this.registerDomEvent(
        this.watchedCanvasContainer,
        'click',
        this.canvasPointerdownHandler
      );
      // Phase 42 Plan 03: also wire 'dblclick' so double-click-creates-node is
      // handled even if Obsidian swallows the intermediate click events during
      // the native text-node creation gesture. Same handler is safe to reuse —
      // handleNodeClick guards against same-node re-selection (line 105).
      this.registerDomEvent(
        this.watchedCanvasContainer,
        'dblclick',
        this.canvasPointerdownHandler
      );
    }
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
      text: "Right-click a canvas node and choose 'Edit RadiProtocol properties' to open its configuration form.",
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
    void this.renderNodeForm(canvasFilePath, nodeId);
  }

  async saveNodeEdits(
    filePath: string,
    nodeId: string,
    edits: Record<string, unknown>
  ): Promise<void> {
    // Phase 28: D-01, D-02 — inject color before forking into Pattern B / Strategy A
    const enrichedEdits = { ...edits };
    const editedType = enrichedEdits['radiprotocol_nodeType'] as string | undefined;
    // D-06: unmark path — type is '' or key present with undefined/empty value
    const isTypeChange = 'radiprotocol_nodeType' in enrichedEdits;
    const isUnmarkingType = isTypeChange && (editedType === '' || editedType === undefined);

    if (!isUnmarkingType && editedType) {
      // D-04 priority 1: type explicitly changed — inject color immediately
      const mapped = (NODE_COLOR_MAP as Record<string, string | undefined>)[editedType];
      if (mapped !== undefined) {
        enrichedEdits['color'] = mapped; // D-02: overwrite regardless of prior color
      }
    }

    // LIVE-03: Attempt live save via internal Canvas API first (Pattern B).
    // If saveLive() returns true, the canvas view owns the write — do not call vault.modify().
    try {
      // Phase 50 D-14: when displayLabel is in edits, read live-or-disk canvas JSON
      // to enumerate incoming Question→Answer edges, then commit node + edges in
      // ONE saveLiveBatch call. Otherwise fall back to the Phase 28 saveLive path.
      const isDisplayLabelEdit = 'radiprotocol_displayLabel' in enrichedEdits;
      let savedLive: boolean;
      if (isDisplayLabelEdit) {
        const newLabel = enrichedEdits['radiprotocol_displayLabel'] as string | undefined;
        const liveJson = this.plugin.canvasLiveEditor.getCanvasJSON(filePath);
        const canvasContent = liveJson ?? await (async () => {
          const f = this.plugin.app.vault.getAbstractFileByPath(filePath);
          if (!(f instanceof TFile)) return '';
          try { return await this.plugin.app.vault.read(f); } catch { return ''; }
        })();
        const parser = new CanvasParser();
        const edgeEdits = collectIncomingEdgeEdits(parser, canvasContent, filePath, nodeId, newLabel);
        savedLive = await this.plugin.canvasLiveEditor.saveLiveBatch(
          filePath,
          [{ nodeId, edits: enrichedEdits }],
          edgeEdits,
        );
      } else {
        savedLive = await this.plugin.canvasLiveEditor.saveLive(filePath, nodeId, enrichedEdits);
      }
      if (savedLive) {
        return;
      }
    } catch (err) {
      // D-03: requestSave() threw — canvas state has been rolled back by CanvasLiveEditor.
      console.error('[RadiProtocol] saveLive threw — canvas state rolled back:', err);
      new Notice('Save failed \u2014 close the canvas and try again.');
      return;
    }
    // saveLive() returned false: canvas is closed or Pattern B API unavailable.
    // Fall through to Strategy A (vault.modify() with canvas closed requirement).

    const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!file) {
      new Notice('Canvas file not found in vault.');
      return;
    }

    let raw: string;
    try {
      raw = await this.plugin.app.vault.read(file as TFile);
    } catch {
      new Notice('Could not read canvas file.');
      return;
    }

    let canvasData: { nodes: Array<Record<string, unknown>>; edges: unknown[] };
    try {
      canvasData = JSON.parse(raw) as typeof canvasData;
    } catch {
      new Notice('Canvas file contains invalid JSON — cannot save.');
      return;
    }

    const nodeIndex = canvasData.nodes.findIndex(n => n['id'] === nodeId);
    if (nodeIndex === -1) {
      new Notice('Node not found in canvas — it may have been deleted.');
      return;
    }

    // Phase 28: D-04 — fallback type resolution for field-only saves (type not in edits)
    // Note: isUnmarkingType implies isTypeChange, so !isTypeChange already covers !isUnmarkingType
    if (!isTypeChange) {
      const existingNode = canvasData.nodes[nodeIndex] as Record<string, unknown> | undefined;
      const existingType = existingNode?.['radiprotocol_nodeType'] as string | undefined;
      if (existingType) {
        const mapped = (NODE_COLOR_MAP as Record<string, string | undefined>)[existingType];
        if (mapped !== undefined) {
          enrichedEdits['color'] = mapped; // D-02: always overwrite
        }
      }
    }

    const PROTECTED_FIELDS = new Set(['id', 'x', 'y', 'width', 'height', 'type']);

    const nodeTypeEdit = enrichedEdits['radiprotocol_nodeType'];
    const isUnmarking = nodeTypeEdit === '' || nodeTypeEdit === undefined;

    const node = canvasData.nodes[nodeIndex];
    if (node !== undefined) {
      if (isUnmarking && 'radiprotocol_nodeType' in enrichedEdits) {
        for (const key of Object.keys(node)) {
          if (key.startsWith('radiprotocol_')) {
            delete node[key];
          }
        }
        // COLOR-02, D-06: also clear the canvas node's colour on unmark (Strategy A path)
        delete node['color'];
      } else {
        for (const [key, value] of Object.entries(enrichedEdits)) {
          if (PROTECTED_FIELDS.has(key)) continue;
          if (value === undefined) {
            delete node[key];
          } else {
            node[key] = value;
          }
        }
      }
    }

    // Phase 50 D-13/D-14: when displayLabel is in edits, mutate every incoming
    // Question→Answer edge label in the SAME canvasData payload — one vault.modify
    // writes node + edges atomically (avoids WR-01 race). Symmetric to the node
    // mutation above: undefined ≡ delete 'label' key (D-08, canvas-parser.ts:207-209).
    if ('radiprotocol_displayLabel' in enrichedEdits) {
      const newLabel = enrichedEdits['radiprotocol_displayLabel'] as string | undefined;
      const parser = new CanvasParser();
      const edgeEdits = collectIncomingEdgeEdits(parser, raw, filePath, nodeId, newLabel);
      const incomingIds = new Set(edgeEdits.map(e => e.edgeId));
      for (const edge of canvasData.edges) {
        const edgeObj = edge as Record<string, unknown>;
        if (!incomingIds.has(edgeObj['id'] as string)) continue;
        if (newLabel === undefined) {
          delete edgeObj['label']; // D-08 strip-key
        } else {
          edgeObj['label'] = newLabel;
        }
      }
    }

    try {
      await this.plugin.app.vault.modify(file as TFile, JSON.stringify(canvasData, null, 2));
    } catch {
      new Notice('Could not save — write failed. Check file permissions.');
    }
  }

  private async renderNodeForm(filePath: string, nodeId: string): Promise<void> {
    // Guard: contentEl may not be initialized if the view is not yet mounted
    if (!this.contentEl) return;
    this.contentEl.empty();
    this.pendingEdits = {};

    const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      this.renderError('Canvas file not found in vault.');
      return;
    }

    let raw: string;
    try {
      raw = await this.plugin.app.vault.read(file);
    } catch {
      this.renderError('Could not read canvas file.');
      return;
    }

    let canvasData: { nodes: Array<Record<string, unknown>>; edges: unknown[] };
    try {
      canvasData = JSON.parse(raw) as typeof canvasData;
    } catch {
      this.renderError('Canvas file contains invalid JSON — cannot save.');
      return;
    }

    let nodeRecord: Record<string, unknown> | undefined = canvasData.nodes.find(n => n['id'] === nodeId);

    // Phase 42: double-click-created nodes may not yet be flushed to disk by Obsidian's
    // async save cycle. When the disk read misses the node, fall back to the live in-memory
    // canvas state (same pattern Phase 39 Plan 02 uses inside onQuickCreate).
    if (!nodeRecord) {
      const canvas = this.getCanvasForPath(filePath);
      if (canvas) {
        const liveNode = canvas.nodes.get(nodeId);
        if (liveNode) {
          nodeRecord = liveNode.getData();
        }
      }
    }

    if (!nodeRecord) {
      this.renderError('Node not found in canvas — it may have been deleted.');
      return;
    }

    const currentKind = (nodeRecord['radiprotocol_nodeType'] as RPNodeKind | undefined) ?? null;
    this.renderForm(nodeRecord, currentKind);
  }

  private renderForm(nodeRecord: Record<string, unknown>, currentKind: RPNodeKind | null): void {
    this.contentEl.empty();
    const panel = this.contentEl.createDiv({ cls: 'rp-editor-panel' });
    const formArea = panel.createDiv({ cls: 'rp-editor-form' });

    // Node type dropdown — always first
    new Setting(formArea)
      .setName('Node type')
      .setDesc('The RadiProtocol role of this canvas node. Changing this will update the fields below.')
      .addDropdown(drop => {
        drop
          .addOption('', '— unset —')
          .addOption('start', 'Start')
          .addOption('question', 'Question')
          .addOption('answer', 'Answer')
          .addOption('text-block', 'Text block')
          .addOption('snippet', 'Snippet')         // Phase 29: D-06
          .addOption('loop', 'Loop')               // Phase 44 UAT-fix: expose unified loop
          // Phase 46 CLEAN-03: free-text-input excised entirely from RPNodeKind (46-01 D-46-01-A).
          // Phase 44 UAT-fix: legacy kinds (loop-start, loop-end) are NOT offered here — they
          // remain in RPNodeKind only so the parser can emit MIGRATE-01 on legacy canvases
          // (Phase 43 D-03). New nodes should use `loop` instead.
          .setValue(currentKind ?? '')
          .onChange(value => {
            // Immediate save with color + cancel debounce (D-04) — must run first so
            // the new type is in-flight before the re-render.
            this.onTypeDropdownChange(value);
            // Phase 42 (post-review WR-01/WR-02): re-render the whole form so the
            // empty-type hint (which lives outside kindFormSection) is re-evaluated.
            // Defer via queueMicrotask so the dropdown handler fully unwinds before
            // contentEl is torn down (avoids re-entrancy on the live <select> element).
            // Merge pendingEdits into the record copy so buildKindForm sees the newly
            // picked type in field defaults instead of stale data from nodeRecord.
            const mergedRecord = { ...nodeRecord, ...this.pendingEdits };
            const nextKind = value ? (value as RPNodeKind) : null;
            queueMicrotask(() => {
              this.renderForm(mergedRecord, nextKind);
            });
          });
      });

    // Phase 42: empty-type helper hint — copy locked by UI-SPEC
    if (currentKind === null) {
      formArea.createEl('p', {
        cls: 'rp-editor-type-hint',
        text: 'Select a node type to configure this node',
      });
    }

    // Kind-specific fields section
    this.kindFormSection = formArea.createDiv();
    this.buildKindForm(this.kindFormSection, nodeRecord, currentKind);

    // "Saved ✓" indicator — replaces Save button slot (D-01)
    const indicatorRow = panel.createDiv({ cls: 'rp-editor-saved-indicator' });
    indicatorRow.setText('Saved \u2713');
    this._savedIndicatorEl = indicatorRow;
    // Reset indicator visibility on each form render (Pitfall 2 fix)
    indicatorRow.removeClass('is-visible');
    // Phase 48 NODEUI-05: toolbar moved to bottom (was Phase 39 top-of-panel).
    this.renderToolbar(this.contentEl);
  }

  private renderGrowableTextarea(
    container: HTMLElement,
    options: {
      blockClass: string;
      textareaClass?: string;
      label: string;
      desc: string;
      value: string;
      onInput: (value: string) => void;
    }
  ): HTMLTextAreaElement {
    const block = container.createDiv({ cls: options.blockClass });
    block.createDiv({ cls: 'rp-field-label', text: options.label });
    block.createEl('p', { cls: 'rp-field-desc', text: options.desc });

    const textareaClasses = options.textareaClass
      ? `rp-growable-textarea ${options.textareaClass}`
      : 'rp-growable-textarea';
    const textarea = block.createEl('textarea', { cls: textareaClasses });
    textarea.value = options.value;

    const resize = () => {
      if (!textarea.style) return;
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(resize);
    } else {
      resize();
    }
    const onTextareaInput = () => {
      resize();
      options.onInput(textarea.value);
      this.scheduleAutoSave();
    };

    if (typeof this.registerDomEvent === 'function') {
      this.registerDomEvent(textarea, 'input', onTextareaInput);
    } else if (typeof textarea.addEventListener === 'function') {
      textarea.addEventListener('input', onTextareaInput);
    }

    return textarea;
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
        new Setting(container).setHeading().setName('Start node');
        container.createEl('p', {
          text: 'Start node has no additional properties.',
          cls: 'rp-editor-start-note',
        });
        break;
      }

      case 'question': {
        new Setting(container).setHeading().setName('Question node');
        // Phase 64: shared growable textarea helper preserves the Phase 48
        // custom-DOM Question behavior while exposing common managed classes.
        this.renderGrowableTextarea(container, {
          blockClass: 'rp-question-block',
          textareaClass: 'rp-question-textarea',
          label: 'Question text',
          desc: 'Displayed to the user during the protocol session.',
          value:
            (nodeRecord['radiprotocol_questionText'] as string | undefined) ??
            (nodeRecord['text'] as string | undefined) ??
            '',
          onInput: (value) => {
            this.pendingEdits['radiprotocol_questionText'] = value;
            this.pendingEdits['text'] = value;
          },
        });
        break;
      }

      case 'answer': {
        new Setting(container).setHeading().setName('Answer node');
        // Phase 50 D-10: Answer.displayLabel is the single source of truth for every
        // incoming Question→Answer edge label. Multi-incoming Answer nodes share ONE
        // label across all incoming edges — per-edge override is explicitly out of scope
        // for v1.8. Writes flow through saveNodeEdits (D-14 atomic batch): node
        // radiprotocol_displayLabel + every incoming edge.label land in ONE saveLiveBatch
        // or ONE vault.modify call. Undefined displayLabel strips the 'label' key on
        // every incoming edge (D-08 symmetry with canvas-parser.ts:207-209).
        // Design source: .planning/notes/answer-label-edge-sync.md
        // Phase 48 NODEUI-03: Display label renders BEFORE Answer text (swapped from original order).
        new Setting(container)
          .setName('Display label (optional)')
          .setDesc('Short label shown in the runner button if set. Leave blank to use answer text.')
          .addText(t => {
            t.setValue((nodeRecord['radiprotocol_displayLabel'] as string | undefined) ?? '')
              .onChange(v => {
                this.pendingEdits['radiprotocol_displayLabel'] = v || undefined;
                this.scheduleAutoSave();
              });
          });
        this.renderGrowableTextarea(container, {
          blockClass: 'rp-answer-text-block',
          label: 'Answer text',
          desc: 'Appended to the accumulated report text when this answer is chosen.',
          value:
            (nodeRecord['radiprotocol_answerText'] as string | undefined) ??
            (nodeRecord['text'] as string | undefined) ??
            '',
          onInput: (value) => {
            this.pendingEdits['radiprotocol_answerText'] = value;
            this.pendingEdits['text'] = value;
          },
        });
        // Separator override dropdown (D-05, D-06, SEP-02)
        new Setting(container)
          .setName('Text separator')
          .setDesc('How this node\'s text is joined to the accumulated report. "Use global" inherits the setting from Settings > Runner.')
          .addDropdown(drop => {
            drop
              .addOption('', 'Use global (default)')
              .addOption('newline', 'Newline')
              .addOption('space', 'Space')
              .setValue((nodeRecord['radiprotocol_separator'] as string | undefined) ?? '')
              .onChange(value => {
                this.pendingEdits['radiprotocol_separator'] =
                  value === '' ? undefined : (value as 'newline' | 'space');
                this.scheduleAutoSave();
              });
          });
        break;
      }

      case 'text-block': {
        new Setting(container).setHeading().setName('Text-block node');
        this.renderGrowableTextarea(container, {
          blockClass: 'rp-text-block-content-block',
          label: 'Content',
          desc: 'Auto-appended to the accumulated text when this node is reached.',
          value:
            (nodeRecord['radiprotocol_content'] as string | undefined) ??
            (nodeRecord['text'] as string | undefined) ??
            '',
          onInput: (value) => {
            this.pendingEdits['radiprotocol_content'] = value;
            this.pendingEdits['text'] = value;
          },
        });
        // Separator override dropdown (D-05, D-06, SEP-02)
        new Setting(container)
          .setName('Text separator')
          .setDesc('How this node\'s text is joined to the accumulated report. "Use global" inherits the setting from Settings > Runner.')
          .addDropdown(drop => {
            drop
              .addOption('', 'Use global (default)')
              .addOption('newline', 'Newline')
              .addOption('space', 'Space')
              .setValue((nodeRecord['radiprotocol_separator'] as string | undefined) ?? '')
              .onChange(value => {
                this.pendingEdits['radiprotocol_separator'] =
                  value === '' ? undefined : (value as 'newline' | 'space');
                this.scheduleAutoSave();
              });
          });
        break;
      }

      case 'loop-start':
      case 'loop-end': {
        // Phase 44 (RUN-07) — legacy kinds retained for parser migration-error path (Phase 43 D-03).
        // Validator rejects any canvas containing these; the form below is informational only.
        new Setting(container).setHeading().setName('Legacy loop node');
        new Setting(container).setDesc(
          'This node type is obsolete. Rebuild the loop using a unified "loop" node. The canvas will fail validation until the legacy nodes are removed.',
        );
        break;
      }

      case 'loop': {
        // Phase 44 UAT-fix: unified loop node form (RUN-01 header text + picker).
        // Sync both `radiprotocol_headerText` (runtime source) and `text` (canvas visual label)
        // so the header is visible on the canvas node AND picked up by the runner — same pattern
        // as question/answer.
        new Setting(container).setHeading().setName('Loop node');
        this.renderGrowableTextarea(container, {
          blockClass: 'rp-loop-header-block',
          label: 'Header text',
          desc: 'Displayed above the branch picker when the runner halts at this loop, and also shown as the canvas node label. Leave blank for no header.',
          value:
            (nodeRecord['radiprotocol_headerText'] as string | undefined) ??
            (nodeRecord['text'] as string | undefined) ??
            '',
          onInput: (value) => {
            this.pendingEdits['radiprotocol_headerText'] = value;
            this.pendingEdits['text'] = value;
          },
        });
        break;
      }

      case 'snippet': {
        new Setting(container).setHeading().setName('Snippet node');

        // Phase 51 Plan 03 D-05 (PICKER-02) — inline hierarchical picker replaces the
        // Phase 30 flat-list addDropdown. Mode 'both' lets the author pick a folder
        // (legacy directory binding via radiprotocol_subfolderPath) OR a specific snippet
        // file (new file binding via radiprotocol_snippetPath, D-01 mutual exclusivity on
        // write). Host wrapper class `rp-stp-editor-host` is defined in
        // src/styles/snippet-tree-picker.css (owned by Plan 02). This plan does NOT modify
        // CSS. See `.planning/notes/snippet-node-binding-and-picker.md`.
        new Setting(container)
          .setName('Target')
          .setDesc(
            'Выберите папку (узел предложит все её сниппеты) или конкретный файл сниппета. ' +
            'Папка и файл взаимно исключительны (D-01).'
          );

        const pickerHost = container.createDiv({ cls: 'rp-stp-editor-host' });

        const existingFilePath = nodeRecord['radiprotocol_snippetPath'];
        const existingFolderPath = nodeRecord['radiprotocol_subfolderPath'];
        const initialSelection =
          (typeof existingFilePath === 'string' && existingFilePath !== '')
            ? existingFilePath
            : (typeof existingFolderPath === 'string' && existingFolderPath !== '')
              ? existingFolderPath
              : undefined;

        // Lifecycle: buildKindForm head unmounts any prior picker (see top of method).
        // The single-site cleanup keeps the invariant clean; no defensive re-check needed.
        this.snippetTreePicker = new SnippetTreePicker({
          app: this.plugin.app,
          snippetService: this.plugin.snippetService,
          container: pickerHost as unknown as HTMLElement,
          mode: 'both',
          rootPath: this.plugin.settings.snippetFolderPath,
          initialSelection,
          onSelect: (result) => {
            if (result.kind === 'folder') {
              // D-01 mutual exclusivity: setting folder clears file binding.
              this.pendingEdits['radiprotocol_subfolderPath'] = result.relativePath || undefined;
              this.pendingEdits['radiprotocol_snippetPath'] = undefined;
              // Phase 31 D-10 text-mirroring contract — folder path mirrored verbatim.
              this.pendingEdits['text'] = result.relativePath;
            } else {
              // File selection — D-01 mutual exclusivity: setting file clears folder binding.
              this.pendingEdits['radiprotocol_snippetPath'] = result.relativePath;
              this.pendingEdits['radiprotocol_subfolderPath'] = undefined;
              // Mirror basename-without-extension into text (canvas card label).
              const lastSlash = result.relativePath.lastIndexOf('/');
              const basename = lastSlash >= 0
                ? result.relativePath.slice(lastSlash + 1)
                : result.relativePath;
              const dot = basename.lastIndexOf('.');
              const stem = dot > 0 ? basename.slice(0, dot) : basename;
              this.pendingEdits['text'] = stem;
            }
            this.scheduleAutoSave();
          },
        });
        void this.snippetTreePicker.mount();

        // Phase 31 D-01: optional label shown on branch-list button when this snippet node
        // is reached as a variant of a question. Empty fallback = "📁 Snippet".
        this.renderGrowableTextarea(container, {
          blockClass: 'rp-snippet-branch-label-block',
          label: 'Branch label',
          desc: 'Shown on the branch-list button when a question has outgoing edges to this snippet. Leave empty to use "📁 Snippet".',
          value: (nodeRecord['radiprotocol_snippetLabel'] as string | undefined) ?? '',
          onInput: (value) => {
            this.pendingEdits['radiprotocol_snippetLabel'] = value || undefined;
          },
        });

        // Phase 31 D-04: per-node separator override. '' = use global default from settings.
        new Setting(container)
          .setName('Separator override')
          .setDesc('How the rendered snippet text is joined to the accumulated protocol. Default uses the global Text Separator setting.')
          .addDropdown(drop => {
            drop.addOption('', '\u2014 use global default \u2014');
            drop.addOption('newline', 'Newline');
            drop.addOption('space', 'Space');
            const current = (nodeRecord['radiprotocol_snippetSeparator'] as string | undefined) ?? '';
            drop.setValue(current);
            drop.onChange(v => {
              this.pendingEdits['radiprotocol_snippetSeparator'] = (v === 'space' || v === 'newline') ? v : undefined;
              this.scheduleAutoSave();
            });
          });
        break;
      }
    }
  }

  private scheduleAutoSave(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
    }
    // Snapshot at schedule time — NOT at fire time (critical correctness invariant)
    const filePath = this.currentFilePath;
    const nodeId = this.currentNodeId;
    const edits = { ...this.pendingEdits };

    if (!filePath || !nodeId) return;

    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      void this.saveNodeEdits(filePath, nodeId, edits)
        .then(() => { this.showSavedIndicator(); })
        .catch(err => {
          console.error('[RadiProtocol] auto-save failed:', err);
        });
    }, 800);
  }

  private onTypeDropdownChange(value: string): void {
    this.pendingEdits['radiprotocol_nodeType'] = value || undefined;
    // Cancel any pending debounce
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    if (this.currentFilePath && this.currentNodeId) {
      const edits = { ...this.pendingEdits };
      // Color injection and color-clearing are handled entirely inside saveNodeEdits
      // (D-04, D-06). Do not duplicate the NODE_COLOR_MAP lookup here — divergence risk.
      void this.saveNodeEdits(this.currentFilePath, this.currentNodeId, edits)
        .then(() => { this.showSavedIndicator(); })
        .catch(err => {
          console.error('[RadiProtocol] type-change save failed:', err);
        });
    }
  }

  private showSavedIndicator(): void {
    if (!this._savedIndicatorEl) return;
    this._savedIndicatorEl.addClass('is-visible');
    if (this._indicatorTimer !== null) clearTimeout(this._indicatorTimer);
    this._indicatorTimer = setTimeout(() => {
      this._savedIndicatorEl?.removeClass('is-visible');
      this._indicatorTimer = null;
    }, 2000);
  }

  private renderError(message: string): void {
    this.contentEl.empty();
    const container = this.contentEl.createDiv({ cls: 'rp-editor-idle' });
    container.createEl('p', { text: message });
  }

  // Phase 39: Quick-create helpers ─────────────────────────────────────────

  private getActiveCanvasPath(): string | undefined {
    const canvasLeaves = this.plugin.app.workspace.getLeavesOfType('canvas');
    const activeLeaf = this.plugin.app.workspace.getMostRecentLeaf();
    const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
    if (!canvasLeaf) return undefined;
    return (canvasLeaf.view as { file?: { path: string } })?.file?.path;
  }

  private getCanvasForPath(canvasPath: string): CanvasInternal | undefined {
    const leaf = this.plugin.app.workspace
      .getLeavesOfType('canvas')
      .find((l) => {
        const v = l.view as { file?: { path: string } };
        return v.file?.path === canvasPath;
      });
    if (!leaf) return undefined;
    return (leaf.view as unknown as { canvas?: CanvasInternal })?.canvas;
  }

  private async onQuickCreate(kind: 'question' | 'answer' | 'snippet' | 'loop' | 'text-block'): Promise<void> {
    const canvasPath = this.getActiveCanvasPath();
    if (!canvasPath) {
      new Notice('Open a canvas first to create nodes.');
      return;
    }

    // Flush pending auto-save before switching (Pitfall 3 from RESEARCH.md)
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
      if (this.currentFilePath && this.currentNodeId) {
        const editsSnapshot = { ...this.pendingEdits };
        try {
          await this.saveNodeEdits(this.currentFilePath, this.currentNodeId, editsSnapshot);
        } catch {
          // flush save failure does not block creation — silent
        }
      }
    }

    const result = this.plugin.canvasNodeFactory.createNode(
      canvasPath,
      kind,
      this.currentNodeId ?? undefined
    );

    if (result) {
      // Bypass disk read: use in-memory node data directly from createNode().
      // renderNodeForm() reads canvas JSON from disk via vault.read(), but
      // canvas.requestSave() is async fire-and-forget — the file may not be
      // flushed yet. Instead, getData() returns the live node record.
      this.currentFilePath = canvasPath;
      this.currentNodeId = result.nodeId;
      this.pendingEdits = {};
      const nodeRecord = result.canvasNode.getData();
      const currentKind = (nodeRecord['radiprotocol_nodeType'] as RPNodeKind | undefined) ?? null;
      this.renderForm(nodeRecord, currentKind);
    }
  }

  // Phase 40: Duplicate node ─────────────────────────────────────────────

  private async onDuplicate(): Promise<void> {
    if (!this.currentNodeId || !this.currentFilePath) {
      return;
    }

    const canvasPath = this.getActiveCanvasPath();
    if (!canvasPath) {
      new Notice('Open a canvas first to create nodes.');
      return;
    }

    // Flush pending auto-save before switching (same pattern as onQuickCreate)
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
      if (this.currentFilePath && this.currentNodeId) {
        const editsSnapshot = { ...this.pendingEdits };
        try {
          await this.saveNodeEdits(this.currentFilePath, this.currentNodeId, editsSnapshot);
        } catch {
          // flush save failure does not block duplication — silent
        }
      }
    }

    // Read source node data from live canvas (NOT disk — avoids race condition)
    const canvas = this.getCanvasForPath(canvasPath);
    if (!canvas) return;
    const sourceNode = canvas.nodes.get(this.currentNodeId);
    if (!sourceNode) return;
    const sourceData = sourceNode.getData();

    const sourceKind = sourceData['radiprotocol_nodeType'] as RPNodeKind | undefined;
    if (!sourceKind) {
      new Notice('Select a RadiProtocol node to duplicate.');
      return;
    }

    // Create new node via factory (handles position offset, type, color, ID)
    const result = this.plugin.canvasNodeFactory.createNode(
      canvasPath, sourceKind, this.currentNodeId
    );
    if (!result) return;

    // Copy radiprotocol_* properties + text from source to new node
    const rpProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(sourceData)) {
      if (key.startsWith('radiprotocol_') || key === 'text') {
        rpProps[key] = value;
      }
    }
    const newData = result.canvasNode.getData();
    result.canvasNode.setData({ ...newData, ...rpProps });
    canvas.requestSave();

    // Load new node in editor (in-memory, no disk read)
    this.currentFilePath = canvasPath;
    this.currentNodeId = result.nodeId;
    this.pendingEdits = {};
    const finalData = result.canvasNode.getData();
    const finalKind = (finalData['radiprotocol_nodeType'] as RPNodeKind | undefined) ?? null;
    this.renderForm(finalData, finalKind);
  }

  private renderToolbar(container: HTMLElement): void {
    const toolbar = container.createDiv({ cls: 'rp-editor-create-toolbar' });

    const qBtn = toolbar.createEl('button', { cls: 'rp-create-question-btn' });
    const qIcon = qBtn.createSpan();
    setIcon(qIcon, 'help-circle');
    qBtn.appendText('Create question node');
    this.registerDomEvent(qBtn, 'click', () => { void this.onQuickCreate('question'); });

    const aBtn = toolbar.createEl('button', { cls: 'rp-create-answer-btn' });
    const aIcon = aBtn.createSpan();
    setIcon(aIcon, 'message-square');
    aBtn.appendText('Create answer node');
    this.registerDomEvent(aBtn, 'click', () => { void this.onQuickCreate('answer'); });

    // Phase 42: Create snippet node button
    const sBtn = toolbar.createEl('button', { cls: 'rp-create-snippet-btn' });
    sBtn.setAttribute('aria-label', 'Create snippet node');
    sBtn.setAttribute('title', 'Create snippet node');
    const sIcon = sBtn.createSpan();
    setIcon(sIcon, 'file-text');
    sBtn.appendText('Create snippet node');
    this.registerDomEvent(sBtn, 'click', () => { void this.onQuickCreate('snippet'); });

    // Phase 45: Create loop node button (LOOP-05, D-03)
    const lBtn = toolbar.createEl('button', { cls: 'rp-create-loop-btn' });
    lBtn.setAttribute('aria-label', 'Create loop node');
    lBtn.setAttribute('title', 'Create loop node');
    const lIcon = lBtn.createSpan();
    setIcon(lIcon, 'repeat');
    lBtn.appendText('Create loop node');
    this.registerDomEvent(lBtn, 'click', () => { void this.onQuickCreate('loop'); });

    // Phase 64: Create text block button (EDITOR-06)
    const tbBtn = toolbar.createEl('button', { cls: 'rp-create-text-block-btn' });
    tbBtn.setAttribute('aria-label', 'Create text block');
    tbBtn.setAttribute('title', 'Create text block');
    const tbIcon = tbBtn.createSpan();
    setIcon(tbIcon, 'file-text');
    tbBtn.appendText('Create text block');
    this.registerDomEvent(tbBtn, 'click', () => { void this.onQuickCreate('text-block'); });

    // Phase 40: Duplicate node button
    const dupBtn = toolbar.createEl('button', { cls: 'rp-duplicate-btn' });
    const dupIcon = dupBtn.createSpan();
    setIcon(dupIcon, 'copy');
    dupBtn.appendText('Duplicate node');
    if (!this.currentNodeId) dupBtn.disabled = true;
    this.registerDomEvent(dupBtn, 'click', () => { void this.onDuplicate(); });
  }

  /**
   * Recursively lists all subfolder paths (relative to basePath) within basePath.
   * Uses BFS via vault.adapter.list(). Returns [] if basePath does not exist.
   * Phase 29, D-07.
   *
   * @deprecated Phase 51 Plan 03 — Node Editor's `case 'snippet'` now mounts
   * SnippetTreePicker (hierarchical + search) instead of this BFS-flat-list helper.
   * Retained per CLAUDE.md Shared Pattern G (never delete code authored by prior
   * phases). No remaining callers in src/ as of Phase 51-03 (grep-verified).
   */
  private async listSnippetSubfolders(basePath: string): Promise<string[]> {
    const exists = await this.plugin.app.vault.adapter.exists(basePath);
    if (!exists) return [];

    const results: string[] = [];
    const queue: string[] = [basePath];
    const visited = new Set<string>([basePath]); // WR-01: cycle guard for symlink/junction loops

    while (queue.length > 0) {
      const current = queue.shift()!;
      let listing: { files: string[]; folders: string[] };
      try {
        listing = await this.plugin.app.vault.adapter.list(current);
      } catch {
        continue; // Skip inaccessible directories silently
      }

      for (const folder of listing.folders) {
        if (visited.has(folder)) continue; // WR-01: skip already-seen paths
        visited.add(folder);
        // vault.adapter.list returns full vault-relative paths (e.g. .radiprotocol/snippets/CT/adrenal)
        // Compute relative path: strip basePath + '/' prefix (Pitfall 3 from RESEARCH.md)
        const rel = folder.slice(basePath.length + 1);
        if (rel) {
          results.push(rel);
        }
        queue.push(folder); // BFS: recurse into subfolder
      }
    }

    return results;
  }
}
