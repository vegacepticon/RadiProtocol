// views/runner-view.ts — Phase 3 full implementation
import { ItemView, WorkspaceLeaf, setIcon, ViewStateResult, TFile, Notice } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { ProtocolRunner } from '../runner/protocol-runner';
import { CanvasParser } from '../graph/canvas-parser';
import { GraphValidator } from '../graph/graph-validator';
import type { ProtocolGraph, QuestionNode, FreeTextInputNode, AnswerNode } from '../graph/graph-model';
import type { AtNodeState } from '../runner/runner-state';

export const RUNNER_VIEW_TYPE = 'radiprotocol-runner';

interface RunnerViewPersistedState extends Record<string, unknown> {
  canvasFilePath: string | null;
}

export class RunnerView extends ItemView {
  private plugin: RadiProtocolPlugin;
  private runner: ProtocolRunner | null = null;
  private graph: ProtocolGraph | null = null;
  private canvasFilePath: string | null = null;

  // Stable DOM elements — built once in buildSkeleton(), never rebuilt
  private questionZoneEl!: HTMLElement;
  private previewTextarea!: HTMLTextAreaElement;
  private copyBtn!: HTMLButtonElement;
  private saveBtn!: HTMLButtonElement;

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return RUNNER_VIEW_TYPE; }
  getDisplayText(): string { return 'RadiProtocol runner'; }
  getIcon(): string { return 'activity'; }

  async onOpen(): Promise<void> {
    this.buildSkeleton();
    this.renderIdle();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  // ── Workspace persistence (D-09, UI-07) ─────────────────────────────────────

  getState(): RunnerViewPersistedState {
    return { canvasFilePath: this.canvasFilePath };
  }

  async setState(state: RunnerViewPersistedState, result: ViewStateResult): Promise<void> {
    if (state.canvasFilePath) {
      this.canvasFilePath = state.canvasFilePath;
      this.renderIdle();
    }
    return super.setState(state, result);
  }

  // ── DOM skeleton (built once) ────────────────────────────────────────────────

  private buildSkeleton(): void {
    this.contentEl.empty();

    // Root container
    const root = this.contentEl.createDiv({ cls: 'rp-runner-view' });

    // Question zone (top, flex:0 0 auto)
    this.questionZoneEl = root.createDiv({ cls: 'rp-question-zone' });

    // Zone divider
    root.createDiv({ cls: 'rp-zone-divider' });

    // Preview zone (bottom, flex:1 1 auto)
    const previewZone = root.createDiv({ cls: 'rp-preview-zone' });

    // Preview heading label
    previewZone.createEl('span', { cls: 'rp-preview-heading', text: 'Protocol preview' });

    // Editable textarea — NEVER rebuilt after this (Pitfall 1)
    this.previewTextarea = previewZone.createEl('textarea', {
      cls: 'rp-preview-textarea',
      attr: {
        'aria-label': 'Protocol preview',
        'disabled': 'true',
        'rows': '4',
      },
    }) as HTMLTextAreaElement;

    // Register stable 'input' event via registerDomEvent (UI-09)
    this.registerDomEvent(this.previewTextarea, 'input', () => {
      this.runner?.setAccumulatedText(this.previewTextarea.value);
    });

    // Output toolbar
    const toolbar = previewZone.createDiv({ cls: 'rp-output-toolbar' });

    this.copyBtn = toolbar.createEl('button', {
      cls: 'rp-copy-btn',
      text: 'Copy to clipboard',
    }) as HTMLButtonElement;
    this.copyBtn.addClass('mod-cta');

    this.saveBtn = toolbar.createEl('button', {
      cls: 'rp-save-btn',
      text: 'Save to note',
    }) as HTMLButtonElement;
    this.saveBtn.addClass('mod-cta');

    // Wire copy/save handlers (UI-05, UI-06)
    this.registerDomEvent(this.copyBtn, 'click', () => { void this.handleCopy(); });
    this.registerDomEvent(this.saveBtn, 'click', () => { void this.handleSave(); });

    // Disable output buttons initially
    this.copyBtn.disabled = true;
    this.saveBtn.disabled = true;

    // Collapsible legend (native <details>/<summary>, D-08, UI-12)
    const legend = root.createEl('details', { cls: 'rp-legend' });
    // No 'open' attribute — collapsed by default
    legend.createEl('summary', { text: 'Legend' });

    this.buildLegendRows(legend);
  }

  private buildLegendRows(container: HTMLElement): void {
    const rows: Array<{ label: string; color: string; border?: boolean; description: string }> = [
      { label: 'start',           color: 'var(--color-green)',      description: 'Entry point of the protocol' },
      { label: 'question',        color: 'var(--color-blue)',       description: 'Question node; presents answer buttons' },
      { label: 'answer',          color: 'var(--background-primary)', border: true, description: 'Answer option; auto-appends text' },
      { label: 'free-text-input', color: 'var(--color-yellow)',     description: 'Free-text input field' },
      { label: 'text-block',      color: 'var(--color-purple)',     description: 'Auto-appends static text' },
      { label: 'loop-start',      color: 'var(--color-orange)',     description: 'Loop entry point' },
      { label: 'loop-end',        color: 'var(--color-orange)',     description: 'Loop exit / next-iteration choice' },
    ];

    for (const row of rows) {
      const rowEl = container.createDiv({ cls: 'rp-legend-row' });

      const swatch = rowEl.createEl('span', { cls: 'rp-legend-swatch' });
      swatch.style.display = 'inline-block';
      swatch.style.width = '12px';
      swatch.style.height = '12px';
      swatch.style.borderRadius = '2px';
      swatch.style.marginRight = 'var(--size-2-1)';
      swatch.style.verticalAlign = 'middle';
      swatch.style.background = row.color;
      swatch.style.flexShrink = '0';
      if (row.border) {
        swatch.style.border = '1px solid var(--background-modifier-border)';
      }

      rowEl.createEl('span', { text: row.label });
      rowEl.createEl('span', { text: ' — ' });
      const desc = rowEl.createEl('span', { text: row.description });
      desc.style.color = 'var(--text-muted)';
    }
  }

  // ── Public entry point ────────────────────────────────────────────────────────

  /**
   * Public method called by main.ts command to open a canvas file as a protocol session.
   * Threat T-03-01-03: guard vault.getAbstractFileByPath() null return before TFile cast.
   */
  async openCanvas(filePath: string, startNodeId?: string): Promise<void> {
    const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
    if (abstractFile === null) {
      this.canvasFilePath = filePath;
      this.renderError(`Canvas file not found: ${filePath}`);
      return;
    }

    const content = await this.app.vault.read(abstractFile as TFile);
    const parser = new CanvasParser();
    const parseResult = parser.parse(content, filePath);

    if (!parseResult.success) {
      this.canvasFilePath = filePath;
      this.renderValidationErrors([parseResult.error]);
      return;
    }

    const validator = new GraphValidator();
    const errors = validator.validate(parseResult.graph);
    if (errors.length > 0) {
      this.canvasFilePath = filePath;
      this.renderValidationErrors(errors);
      return;
    }

    this.canvasFilePath = filePath;
    this.graph = parseResult.graph;
    this.runner = new ProtocolRunner({ maxIterations: this.plugin.settings.maxLoopIterations });
    this.runner.start(this.graph, startNodeId);
    this.previewTextarea.disabled = false;
    this.render();
  }

  // ── Render dispatcher ─────────────────────────────────────────────────────────

  private render(): void {
    if (!this.runner) {
      this.renderIdle();
      return;
    }

    const state = this.runner.getState();
    this.questionZoneEl.empty();

    switch (state.status) {
      case 'at-node':
        this.previewTextarea.value = state.accumulatedText;
        this.renderAtNode(state);
        break;
      case 'complete':
        this.previewTextarea.value = state.finalText;
        this.renderComplete();
        break;
      case 'error':
        this.renderError(state.message);
        break;
      case 'awaiting-snippet-fill':
        this.questionZoneEl.createEl('p', { text: 'Snippet support coming in a future update.' });
        break;
      case 'idle':
        this.renderIdle();
        break;
    }

    // Update output button disabled state (trim check per plan spec)
    const hasText = this.previewTextarea.value.trim().length > 0;
    this.copyBtn.disabled = !hasText;
    this.saveBtn.disabled = !hasText;

    // Output button visibility per settings (Pitfall 5 — read settings on every render)
    const dest = this.plugin.settings.outputDestination;
    this.copyBtn.style.display = dest === 'new-note' ? 'none' : '';
    this.saveBtn.style.display = dest === 'clipboard' ? 'none' : '';
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  private renderIdle(): void {
    this.questionZoneEl.empty();

    const emptyState = this.questionZoneEl.createDiv({ cls: 'rp-empty-state' });
    emptyState.createEl('p', { cls: 'rp-empty-state-heading', text: 'No protocol loaded' });
    emptyState.createEl('p', {
      cls: 'rp-empty-state-body',
      text: 'Run a protocol from the command palette or use the ribbon icon to get started.',
    });

    if (this.previewTextarea) {
      this.previewTextarea.disabled = true;
    }
  }

  private renderAtNode(state: AtNodeState): void {
    this.questionZoneEl.empty();

    const node = this.graph!.nodes.get(state.currentNodeId);
    if (node === undefined) {
      this.renderError('Node not found in graph.');
      return;
    }

    switch (node.kind) {
      case 'question':
        this.renderQuestionNode(node as QuestionNode, state.canStepBack);
        break;
      case 'free-text-input':
        this.renderFreeTextNode(node as FreeTextInputNode, state.canStepBack);
        break;
      default:
        this.renderError('Unexpected node kind: ' + node.kind);
    }
  }

  private renderQuestionNode(node: QuestionNode, canStepBack: boolean): void {
    this.questionZoneEl.createEl('p', { cls: 'rp-question-text', text: node.questionText });

    const answerList = this.questionZoneEl.createDiv({ cls: 'rp-answer-list' });

    for (const answerId of (this.graph!.adjacency.get(node.id) ?? [])) {
      const answerNode = this.graph!.nodes.get(answerId);
      // Pitfall 4: null-check before property access
      if (answerNode === undefined || answerNode.kind !== 'answer') continue;

      const answerTyped = answerNode as AnswerNode;
      const btn = answerList.createEl('button', {
        cls: 'rp-answer-btn mod-quiet',
        text: answerTyped.displayLabel ?? answerTyped.answerText,
      }) as HTMLButtonElement;

      // Apply button styles inline
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.style.minHeight = '40px';
      btn.style.padding = 'var(--size-4-1) var(--size-4-2)';
      btn.style.whiteSpace = 'normal';
      btn.style.wordBreak = 'break-word';

      // Ephemeral button — use el.onclick (Pitfall 2)
      const capturedId = answerId;
      btn.onclick = () => {
        this.runner!.chooseAnswer(capturedId);
        this.render();
      };
    }

    this.renderStepBackBtn(canStepBack);
  }

  private renderFreeTextNode(node: FreeTextInputNode, canStepBack: boolean): void {
    this.questionZoneEl.createEl('p', { cls: 'rp-question-text', text: node.promptLabel });

    const freeTextEl = this.questionZoneEl.createEl('textarea', {
      cls: 'rp-free-text-input',
      attr: {
        rows: '4',
        placeholder: 'Type your finding here...',
      },
    }) as HTMLTextAreaElement;

    const submitBtn = this.questionZoneEl.createEl('button', {
      cls: 'mod-cta',
      text: 'Submit answer',
    }) as HTMLButtonElement;

    // Ephemeral button — use el.onclick (Pitfall 2)
    submitBtn.onclick = () => {
      this.runner!.enterFreeText(freeTextEl.value);
      this.render();
    };

    this.renderStepBackBtn(canStepBack);
  }

  private renderStepBackBtn(canStepBack: boolean): void {
    const btn = this.questionZoneEl.createEl('button', {
      cls: 'rp-step-back-btn',
    }) as HTMLButtonElement;

    setIcon(btn, 'undo-2');
    btn.appendChild(document.createTextNode('Step back'));
    btn.disabled = !canStepBack;

    // Ephemeral button — use el.onclick (Pitfall 2)
    btn.onclick = () => {
      this.runner!.stepBack();
      this.render();
    };
  }

  private renderComplete(): void {
    this.questionZoneEl.createEl('p', {
      cls: 'rp-complete-heading',
      text: 'Protocol complete',
    });
    const bodyEl = this.questionZoneEl.createEl('p', {
      text: 'Your report is ready. Copy it to the clipboard or save it as a note.',
    });
    bodyEl.style.color = 'var(--text-muted)';

    // Enable output buttons (visibility still follows settings in render())
    this.copyBtn.disabled = false;
    this.saveBtn.disabled = false;
  }

  private renderError(message: string): void {
    const p = this.questionZoneEl.createEl('p', { text: message });
    p.style.color = 'var(--text-error)';
  }

  private renderValidationErrors(errors: string[]): void {
    const heading = this.questionZoneEl.createEl('p', {
      cls: 'rp-validation-heading',
      text: 'Protocol cannot be opened',
    });
    heading.style.color = 'var(--text-error)';
    heading.style.fontWeight = 'var(--font-semibold)';

    const list = this.questionZoneEl.createEl('ol', {
      cls: 'rp-error-list',
      attr: { role: 'alert' },
    });
    for (const error of errors) {
      list.createEl('li', { text: error });
    }

    const footer = this.questionZoneEl.createEl('p', { text: 'Fix the canvas and try again.' });
    footer.style.color = 'var(--text-muted)';
  }

  // ── Output handlers ───────────────────────────────────────────────────────────

  /**
   * Copy accumulated text to the system clipboard (UI-05).
   * Shows "Copied!" feedback for 1500ms then reverts the button label.
   */
  private async handleCopy(): Promise<void> {
    const text = this.previewTextarea.value;
    await navigator.clipboard.writeText(text);
    const originalLabel = this.copyBtn.textContent ?? 'Copy to clipboard';
    this.copyBtn.textContent = 'Copied!';
    window.setTimeout(() => {
      this.copyBtn.textContent = originalLabel;
    }, 1500);
  }

  /**
   * Save accumulated text as a new note in the configured output folder (UI-06).
   * Creates the folder if it does not exist. Shows Notice on success or failure.
   * Wrapped in try/catch per T-03-02-02 (DoS mitigation).
   */
  private async handleSave(): Promise<void> {
    const text = this.previewTextarea.value;
    const folderPath = this.plugin.settings.outputFolderPath || 'RadiProtocol Output';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${timestamp}-protocol.md`;
    const fullPath = `${folderPath}/${fileName}`;
    try {
      // Ensure folder exists (Pitfall 6 — await vault.create)
      const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
      if (folderExists === null) {
        await this.app.vault.createFolder(folderPath);
      }
      await this.app.vault.create(fullPath, text);
      new Notice(`Protocol saved to ${fullPath}`);
    } catch (err) {
      new Notice('Failed to save protocol. Check the output folder path in settings.');
      console.error('[RadiProtocol] Save to note failed:', err);
    }
  }
}
