import { ItemView, WorkspaceLeaf, Setting, TFile, Notice } from 'obsidian';
import type { RPNodeKind } from '../graph/graph-model';
import type RadiProtocolPlugin from '../main';
import { NodeSwitchGuardModal } from './node-switch-guard-modal';

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
      const selection = canvasView.canvas?.selection;
      if (!selection || selection.size !== 1) return; // ignore multi-select

      const node = Array.from(selection)[0];
      if (!node?.id) return;

      const filePath = canvasView.file?.path;
      if (!filePath) return;

      void this.handleNodeClick(filePath, node.id);
    };

    if (this.watchedCanvasContainer !== null) {
      this.registerDomEvent(
        this.watchedCanvasContainer,
        'click',
        this.canvasPointerdownHandler
      );
    }
  }

  private async handleNodeClick(filePath: string, nodeId: string): Promise<void> {
    // No-op: same node already loaded — avoids form flicker on re-click
    if (this.currentFilePath === filePath && this.currentNodeId === nodeId) return;

    // Dirty guard (EDITOR-02): only show when a node is loaded AND has unsaved edits.
    // Guard does NOT fire when panel is in idle state (currentNodeId === null).
    if (this.currentNodeId !== null && Object.keys(this.pendingEdits).length > 0) {
      const modal = new NodeSwitchGuardModal(this.plugin.app);
      modal.open();
      const confirmed = await modal.result; // true = discard and switch
      if (!confirmed) return; // user chose Stay — leave editor unchanged
      this.pendingEdits = {}; // clear before loadNode (explicit, even though loadNode also clears)
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
  }

  loadNode(canvasFilePath: string, nodeId: string): void {
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
    // LIVE-03: Attempt live save via internal Canvas API first (Pattern B).
    // If saveLive() returns true, the canvas view owns the write — do not call vault.modify().
    try {
      const savedLive = await this.plugin.canvasLiveEditor.saveLive(filePath, nodeId, edits);
      if (savedLive) {
        new Notice('Node properties saved.');
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

    const PROTECTED_FIELDS = new Set(['id', 'x', 'y', 'width', 'height', 'type', 'color']);

    const nodeTypeEdit = edits['radiprotocol_nodeType'];
    const isUnmarking = nodeTypeEdit === '' || nodeTypeEdit === undefined;

    const node = canvasData.nodes[nodeIndex];
    if (node !== undefined) {
      if (isUnmarking && 'radiprotocol_nodeType' in edits) {
        for (const key of Object.keys(node)) {
          if (key.startsWith('radiprotocol_')) {
            delete node[key];
          }
        }
      } else {
        for (const [key, value] of Object.entries(edits)) {
          if (PROTECTED_FIELDS.has(key)) continue;
          if (value === undefined) {
            delete node[key];
          } else {
            node[key] = value;
          }
        }
      }
    }

    try {
      await this.plugin.app.vault.modify(file as TFile, JSON.stringify(canvasData, null, 2));
      new Notice('Node properties saved.');
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

    const nodeRecord = canvasData.nodes.find(n => n['id'] === nodeId);
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
          .addOption('free-text-input', 'Free-text input')
          .addOption('text-block', 'Text block')
          .addOption('loop-start', 'Loop start')
          .addOption('loop-end', 'Loop end')
          .setValue(currentKind ?? '')
          .onChange(value => {
            this.pendingEdits['radiprotocol_nodeType'] = value || undefined;
            if (this.kindFormSection) {
              this.kindFormSection.empty();
              this.buildKindForm(
                this.kindFormSection,
                nodeRecord,
                value ? (value as RPNodeKind) : null
              );
            }
          });
      });

    // Kind-specific fields section
    this.kindFormSection = formArea.createDiv();
    this.buildKindForm(this.kindFormSection, nodeRecord, currentKind);

    // Save row
    const saveRow = panel.createDiv({ cls: 'rp-editor-save-row' });
    new Setting(saveRow)
      .addButton(btn => {
        btn
          .setButtonText('Save changes')
          .setCta()
          .onClick(() => {
            if (this.currentFilePath && this.currentNodeId) {
              void this.saveNodeEdits(
                this.currentFilePath,
                this.currentNodeId,
                { ...this.pendingEdits }
              );
            }
          });
      });
  }

  private buildKindForm(
    container: HTMLElement,
    nodeRecord: Record<string, unknown>,
    kind: RPNodeKind | null
  ): void {
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
        new Setting(container)
          .setName('Question text')
          .setDesc('Displayed to the user during the protocol session.')
          .addTextArea(ta => {
            ta.setValue((nodeRecord['radiprotocol_questionText'] as string | undefined) ?? (nodeRecord['text'] as string | undefined) ?? '')
              .onChange(v => { this.pendingEdits['radiprotocol_questionText'] = v; this.pendingEdits['text'] = v; });
          });
        break;
      }

      case 'answer': {
        new Setting(container).setHeading().setName('Answer node');
        new Setting(container)
          .setName('Answer text')
          .setDesc('Appended to the accumulated report text when this answer is chosen.')
          .addTextArea(ta => {
            ta.setValue((nodeRecord['radiprotocol_answerText'] as string | undefined) ?? (nodeRecord['text'] as string | undefined) ?? '')
              .onChange(v => { this.pendingEdits['radiprotocol_answerText'] = v; this.pendingEdits['text'] = v; });
          });
        new Setting(container)
          .setName('Display label (optional)')
          .setDesc('Short label shown in the runner button if set. Leave blank to use answer text.')
          .addText(t => {
            t.setValue((nodeRecord['radiprotocol_displayLabel'] as string | undefined) ?? '')
              .onChange(v => { this.pendingEdits['radiprotocol_displayLabel'] = v || undefined; });
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
              });
          });
        break;
      }

      case 'free-text-input': {
        new Setting(container).setHeading().setName('Free-text input node');
        new Setting(container)
          .setName('Prompt label')
          .setDesc('Shown to the user above the text input field during the session.')
          .addText(t => {
            t.setValue((nodeRecord['radiprotocol_promptLabel'] as string | undefined) ?? (nodeRecord['text'] as string | undefined) ?? '')
              .onChange(v => { this.pendingEdits['radiprotocol_promptLabel'] = v; this.pendingEdits['text'] = v; });
          });
        new Setting(container)
          .setName('Prefix (optional)')
          .setDesc('Prepended to the user\'s input in the accumulated text.')
          .addText(t => {
            t.setValue((nodeRecord['radiprotocol_prefix'] as string | undefined) ?? '')
              .onChange(v => { this.pendingEdits['radiprotocol_prefix'] = v || undefined; });
          });
        new Setting(container)
          .setName('Suffix (optional)')
          .setDesc('Appended to the user\'s input in the accumulated text.')
          .addText(t => {
            t.setValue((nodeRecord['radiprotocol_suffix'] as string | undefined) ?? '')
              .onChange(v => { this.pendingEdits['radiprotocol_suffix'] = v || undefined; });
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
              });
          });
        break;
      }

      case 'text-block': {
        new Setting(container).setHeading().setName('Text-block node');
        new Setting(container)
          .setName('Content')
          .setDesc('Auto-appended to the accumulated text when this node is reached.')
          .addTextArea(ta => {
            ta.setValue((nodeRecord['radiprotocol_content'] as string | undefined) ?? (nodeRecord['text'] as string | undefined) ?? '')
              .onChange(v => { this.pendingEdits['radiprotocol_content'] = v; this.pendingEdits['text'] = v; });
          });
        new Setting(container)
          .setName('Snippet ID (optional)')
          .setDesc('Snippet ID for Phase 5 dynamic snippet fill-in. Leave blank if not using snippets.')
          .addText(t => {
            t.setValue((nodeRecord['radiprotocol_snippetId'] as string | undefined) ?? '')
              .onChange(v => { this.pendingEdits['radiprotocol_snippetId'] = v || undefined; });
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
              });
          });
        break;
      }

      case 'loop-start': {
        new Setting(container).setHeading().setName('Loop-start node');
        new Setting(container)
          .setName('Loop label')
          .setDesc('Shown as iteration prefix in the runner (e.g., "Lesion 2"). Default: Loop.')
          .addText(t => {
            t.setValue((nodeRecord['radiprotocol_loopLabel'] as string | undefined) ?? 'Loop')
              .onChange(v => { this.pendingEdits['radiprotocol_loopLabel'] = v || 'Loop'; });
          });
        new Setting(container)
          .setName('Exit label')
          .setDesc('Text on the exit button shown at the loop-end node. Default: Done.')
          .addText(t => {
            t.setValue((nodeRecord['radiprotocol_exitLabel'] as string | undefined) ?? 'Done')
              .onChange(v => { this.pendingEdits['radiprotocol_exitLabel'] = v || 'Done'; });
          });
        new Setting(container)
          .setName('Max iterations')
          .setDesc('Hard cap on loop repetitions. Prevents infinite loops in the runner. Default: 50.')
          .addText(t => {
            const inputEl = t.inputEl;
            inputEl.type = 'number';
            inputEl.min = '1';
            t.setValue(String((nodeRecord['radiprotocol_maxIterations'] as number | undefined) ?? 50))
              .onChange(v => {
                const n = parseInt(v, 10);
                this.pendingEdits['radiprotocol_maxIterations'] = isNaN(n) ? 50 : Math.max(1, n);
              });
          });
        break;
      }

      case 'loop-end': {
        new Setting(container).setHeading().setName('Loop-end node');
        new Setting(container)
          .setName('Loop start node ID')
          .setDesc('Must match the ID of the corresponding loop-start node on the canvas.')
          .addText(t => {
            t.setValue((nodeRecord['radiprotocol_loopStartId'] as string | undefined) ?? '')
              .onChange(v => { this.pendingEdits['radiprotocol_loopStartId'] = v; });
          });
        break;
      }
    }
  }

  private renderError(message: string): void {
    this.contentEl.empty();
    const container = this.contentEl.createDiv({ cls: 'rp-editor-idle' });
    container.createEl('p', { text: message });
  }
}
