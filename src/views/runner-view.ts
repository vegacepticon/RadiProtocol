// views/runner-view.ts — Phase 5: Full RunnerView with awaiting-snippet-fill branch
import { ItemView, WorkspaceLeaf, Notice, TFile, TFolder, MarkdownView } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { ProtocolRunner } from '../runner/protocol-runner';
import { GraphValidator } from '../graph/graph-validator';
import type { CompleteState } from '../runner/runner-state';
import type { ProtocolGraph } from '../graph/graph-model';
import { SnippetFillInModal } from './snippet-fill-in-modal';
import { ResumeSessionModal } from './resume-session-modal';
import type { PersistedSession } from '../sessions/session-model';
import { validateSessionNodeIds } from '../sessions/session-service';
import { CanvasSelectorWidget } from './canvas-selector-widget';
import { CanvasSwitchModal } from './canvas-switch-modal';

export const RUNNER_VIEW_TYPE = 'radiprotocol-runner';

export class RunnerView extends ItemView {
  private readonly plugin: RadiProtocolPlugin;
  private readonly runner = new ProtocolRunner();
  private readonly validator = new GraphValidator();
  private canvasFilePath: string | null = null;
  private previewTextarea: HTMLTextAreaElement | null = null;
  private insertBtn: HTMLButtonElement | null = null;
  private lastActiveMarkdownFile: TFile | null = null;
  private graph: ProtocolGraph | null = null;
  private selector: CanvasSelectorWidget | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return RUNNER_VIEW_TYPE; }
  getDisplayText(): string { return 'Protocol runner'; }
  getIcon(): string { return 'activity'; }

  getState(): Record<string, unknown> {
    return { canvasFilePath: this.canvasFilePath ?? '' };
  }

  async setState(state: Record<string, unknown>): Promise<void> {
    const path = state['canvasFilePath'];
    if (typeof path === 'string' && path !== '') {
      // Defer canvas restore to onLayoutReady so that vault I/O and any modal
      // (e.g. ResumeSessionModal) only run after Obsidian's workspace is fully
      // ready. Calling openCanvas() synchronously during layout restoration
      // caused an infinite-loading hang when a session file existed (SESSION-07).
      // onLayoutReady fires immediately when the layout is already ready, so
      // this path is safe for both startup restore and runtime openCanvas calls.
      this.app.workspace.onLayoutReady(() => {
        void this.openCanvas(path);
      });
    }
  }

  async openCanvas(filePath: string): Promise<void> {
    this.canvasFilePath = filePath;
    this.selector?.setSelectedPath(filePath);
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      this.renderError([`Canvas file not found: "${filePath}".`]);
      return;
    }

    let content: string;
    try {
      content = await this.app.vault.read(file);
    } catch {
      this.renderError([`Could not read canvas file: "${filePath}".`]);
      return;
    }

    const parseResult = this.plugin.canvasParser.parse(content, filePath);
    if (!parseResult.success) {
      this.renderError([parseResult.error]);
      return;
    }

    const validationErrors = this.validator.validate(parseResult.graph);
    if (validationErrors.length > 0) {
      this.renderError(validationErrors);
      return;
    }

    const graph = parseResult.graph;

    // ── SESSION-02: check for existing incomplete session ─────────────────────
    const session = await this.plugin.sessionService.load(filePath);

    if (session !== null) {
      // SESSION-03: validate that all saved node IDs still exist in the current graph
      const missingIds = validateSessionNodeIds(session, graph);
      if (missingIds.length > 0) {
        // Hard failure — cannot resume safely; clear the session and show error
        await this.plugin.sessionService.clear(filePath);
        this.renderError([
          `Cannot resume session: ${missingIds.length} node(s) referenced in the saved session no longer exist in the canvas.`,
          'The canvas may have been edited since the session was saved.',
          'Starting over. Run the protocol again to begin a fresh session.',
        ]);
        return;
      }

      // SESSION-04: check canvas mtime against the saved timestamp
      const warnings: string[] = [];
      if (file instanceof TFile && file.stat.mtime > session.canvasMtimeAtSave) {
        warnings.push('The canvas file has been modified since this session was saved.');
        warnings.push('Resuming may produce unexpected results if nodes or their content changed.');
      }

      // SESSION-06: present resume/start-over choice to the user
      const modal = new ResumeSessionModal(this.app, warnings);
      modal.open();
      const choice = await modal.result;

      if (choice === 'resume') {
        // Restore the runner from the saved session snapshot
        // Order is critical: setGraph first, then restoreFrom (Pitfall 2)
        this.graph = graph;
        this.runner.setGraph(graph);
        this.runner.restoreFrom(session);
        this.render();
        return;
      }

      // 'start-over' — clear the stale session and fall through to normal start
      await this.plugin.sessionService.clear(filePath);
    }

    // Normal protocol start (no session, or user chose start-over)
    this.graph = graph;
    this.runner.start(graph);
    this.render();
  }

  async onOpen(): Promise<void> {
    // Render selector into headerEl (D-05) — headerEl persists across render() calls
    // because render() only clears contentEl, never headerEl.
    // headerEl is a real DOM element on every ItemView at runtime but is not
    // declared in the public Obsidian type definitions — access via cast (D-05).
    const headerEl = (this as unknown as { headerEl: HTMLElement }).headerEl;
    this.selector = new CanvasSelectorWidget(
      this.app,
      this.plugin,
      headerEl,
      (filePath) => { void this.handleSelectorSelect(filePath); },
    );

    // Sync selector label if a canvas is already set (e.g. restored from state)
    if (this.canvasFilePath !== null) {
      this.selector.setSelectedPath(this.canvasFilePath);
    }

    // Vault file-change listeners — rebuild widget when .canvas files in the
    // protocol folder are created, deleted, or renamed (D-11).
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && file.extension === 'canvas') {
          this.selector?.rebuildIfOpen();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && file.extension === 'canvas') {
          this.selector?.rebuildIfOpen();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile && file.extension === 'canvas') {
          this.selector?.rebuildIfOpen();
          if (oldPath === this.canvasFilePath) {
            this.canvasFilePath = file.path;
            this.selector?.setSelectedPath(file.path);
          }
        }
      })
    );

    this.render();
  }

  async onClose(): Promise<void> {
    this.selector?.destroy();
    this.selector = null;
    this.contentEl.empty();
  }

  /**
   * Called by CanvasSelectorWidget when a file is picked.
   * Implements D-12 / D-13 mid-session confirmation logic.
   */
  private async handleSelectorSelect(newPath: string): Promise<void> {
    // No-op if the user selects the already-active canvas
    if (newPath === this.canvasFilePath) return;

    const state = this.runner.getState();
    const needsConfirmation =
      state.status === 'at-node' || state.status === 'awaiting-snippet-fill';

    if (needsConfirmation) {
      // D-12: show confirmation modal; runner state is in-progress
      const modal = new CanvasSwitchModal(this.app);
      modal.open();
      const confirmed = await modal.result;

      if (!confirmed) {
        // D-12: user cancelled — revert selector label to previous canvas
        this.selector?.setSelectedPath(this.canvasFilePath);
        return;
      }

      // D-12: confirmed — clear active session before switching (D-14: already auto-saved)
      if (this.canvasFilePath !== null) {
        await this.plugin.sessionService.clear(this.canvasFilePath);
      }
    }
    // D-13: idle or complete — switch without confirmation; fall through directly

    // Update selector label to the new canvas, then load it
    this.selector?.setSelectedPath(newPath);
    await this.openCanvas(newPath);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  private render(): void {
    this.contentEl.empty();
    this.previewTextarea = null;

    const root = this.contentEl.createDiv({ cls: 'rp-runner-view' });
    const questionZone = root.createDiv({ cls: 'rp-question-zone' });
    root.createEl('hr', { cls: 'rp-zone-divider' });
    const previewZone = root.createDiv({ cls: 'rp-preview-zone' });
    const outputToolbar = root.createDiv({ cls: 'rp-output-toolbar' });

    const state = this.runner.getState();

    switch (state.status) {
      case 'idle': {
        questionZone.createEl('p', {
          text: 'Select a protocol above to get started.',
          cls: 'rp-empty-state-body',
        });
        this.renderPreviewZone(previewZone, '');
        this.renderOutputToolbar(outputToolbar, null, false);
        break;
      }

      case 'at-node': {
        if (this.graph === null) {
          this.renderError(['Internal error: graph not loaded.']);
          return;
        }
        const node = this.graph.nodes.get(state.currentNodeId);
        if (node === undefined) {
          this.renderError([`Node "${state.currentNodeId}" not found in graph.`]);
          return;
        }

        switch (node.kind) {
          case 'question': {
            questionZone.createEl('p', {
              text: node.questionText,
              cls: 'rp-question-text',
            });
            const answerList = questionZone.createDiv({ cls: 'rp-answer-list' });
            // Answer nodes are the direct neighbors of the question node
            const neighborIds = this.graph.adjacency.get(state.currentNodeId) ?? [];
            for (const answerId of neighborIds) {
              const answerNode = this.graph.nodes.get(answerId);
              if (answerNode === undefined || answerNode.kind !== 'answer') continue;
              const btn = answerList.createEl('button', {
                cls: 'rp-answer-btn',
                text: answerNode.displayLabel ?? answerNode.answerText,
              });
              this.registerDomEvent(btn, 'click', () => {
                this.runner.chooseAnswer(answerNode.id);
                void this.autoSaveSession();   // SESSION-01 — save after answer
                void this.renderAsync();
              });
            }
            break;
          }

          case 'free-text-input': {
            questionZone.createEl('p', {
              text: node.promptLabel,
              cls: 'rp-question-text',
            });
            const textarea = questionZone.createEl('textarea', { cls: 'rp-free-text-input' });
            const submitBtn = questionZone.createEl('button', { text: 'Submit' });
            this.registerDomEvent(submitBtn, 'click', () => {
              this.runner.enterFreeText(textarea.value);
              void this.autoSaveSession();   // SESSION-01 — save after free-text
              void this.renderAsync();
            });
            break;
          }

          case 'loop-end': {
            // Display iteration label if inside a loop body (LOOP-04)
            if (state.loopIterationLabel !== undefined) {
              questionZone.createEl('p', {
                text: state.loopIterationLabel,
                cls: 'rp-loop-iteration-label',
              });
            }

            // Resolve button labels from the matching loop-start node
            const matchingStart = this.graph.nodes.get(node.loopStartId);
            const againLabel = matchingStart?.kind === 'loop-start'
              ? matchingStart.loopLabel
              : 'Loop again';
            const doneLabel = matchingStart?.kind === 'loop-start'
              ? matchingStart.exitLabel
              : 'Done';

            const loopBtnRow = questionZone.createDiv({ cls: 'rp-loop-btn-row' });

            const againBtn = loopBtnRow.createEl('button', {
              cls: 'rp-loop-again-btn',
              text: againLabel,
            });
            const doneBtn = loopBtnRow.createEl('button', {
              cls: 'rp-loop-done-btn',
              text: doneLabel,
            });

            this.registerDomEvent(againBtn, 'click', () => {
              this.runner.chooseLoopAction('again');
              void this.autoSaveSession();
              void this.renderAsync();
            });
            this.registerDomEvent(doneBtn, 'click', () => {
              this.runner.chooseLoopAction('done');
              void this.autoSaveSession();
              void this.renderAsync();
            });
            break;
          }

          default: {
            // text-block, answer, start — auto-advance nodes should not halt here,
            // but handle gracefully in case they do
            questionZone.createEl('p', {
              text: 'Processing...',
              cls: 'rp-empty-state-body',
            });
            break;
          }
        }

        if (state.canStepBack) {
          const stepBackBtn = questionZone.createEl('button', {
            cls: 'rp-step-back-btn',
            text: 'Step back',
          });
          this.registerDomEvent(stepBackBtn, 'click', () => {
            this.runner.stepBack();
            void this.autoSaveSession();   // SESSION-01 — save the reverted state
            this.render();
          });
        }

        this.renderPreviewZone(previewZone, state.accumulatedText);
        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);
        break;
      }

      case 'awaiting-snippet-fill': {
        questionZone.createEl('p', {
          text: 'Loading snippet...',
          cls: 'rp-empty-state-body',
        });
        this.renderPreviewZone(previewZone, state.accumulatedText);
        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);
        // Async: load snippet and open modal (SNIP-06, D-17)
        void this.handleSnippetFill(state.snippetId, questionZone);
        break;
      }

      case 'complete': {
        // SESSION-01 Pitfall 3: clear session file when protocol finishes — no resume needed
        if (this.canvasFilePath !== null) {
          void this.plugin.sessionService.clear(this.canvasFilePath);
        }
        questionZone.createEl('h2', { text: 'Protocol complete', cls: 'rp-complete-heading' });
        this.renderPreviewZone(previewZone, state.finalText);
        this.renderOutputToolbar(outputToolbar, state.finalText, true);
        break;
      }

      case 'error': {
        this.renderError([state.message]);
        return;
      }

      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = state;
        void _exhaustive;
        break;
      }
    }

    // Legend (UI-12) — always visible at bottom
    this.renderLegend(root);
  }

  /** Wrapper so click handlers can call `void this.renderAsync()` */
  private async renderAsync(): Promise<void> {
    this.render();
  }

  /** Load snippet and open SnippetFillInModal; update runner with result (SNIP-06). */
  private async handleSnippetFill(snippetId: string, questionZone: HTMLElement): Promise<void> {
    const snippet = await this.plugin.snippetService.load(snippetId);

    if (snippet === null) {
      questionZone.empty();
      questionZone.createEl('p', {
        text: `Snippet '${snippetId}' not found. The snippet may have been deleted. Use step-back to continue.`,
        cls: 'rp-empty-state-body',
      });
      return;
    }

    const modal = new SnippetFillInModal(this.app, snippet);
    modal.open();
    const rendered = await modal.result;
    if (rendered !== null) {
      this.runner.completeSnippet(rendered);
    } else {
      // D-11: Cancel = skip — advance runner with empty string
      this.runner.completeSnippet('');
    }
    void this.autoSaveSession();   // SESSION-01 — save after snippet completion
    this.render();
  }

  /**
   * Fire-and-forget session auto-save (SESSION-01).
   * Called after every user action that mutates runner state.
   * Returns without writing if runner is not in a saveable state (idle/complete/error)
   * or if canvasFilePath is not set.
   *
   * IMPORTANT: Call as `void this.autoSaveSession()` — never await in event handlers
   * (NFR-09: floating promises must be void-marked).
   *
   * Do NOT call this inside render() — only at explicit mutation sites (Pitfall 6).
   */
  private async autoSaveSession(): Promise<void> {
    if (this.canvasFilePath === null) return;
    const state = this.runner.getSerializableState();
    if (state === null) return; // idle, complete, or error — not a valid save point

    // Read canvas mtime for SESSION-04 change detection on resume
    const file = this.app.vault.getAbstractFileByPath(this.canvasFilePath);
    const mtime = (file instanceof TFile) ? file.stat.mtime : 0;

    const session: PersistedSession = {
      version: 1,
      canvasFilePath: this.canvasFilePath,
      canvasMtimeAtSave: mtime,
      savedAt: Date.now(),
      ...state,
    };
    try {
      await this.plugin.sessionService.save(session);
    } catch (err) {
      // Log save errors so silent failures are visible in the developer console
      console.error('[RadiProtocol] autoSaveSession failed:', err);
    }
  }

  // ── Sub-renders ───────────────────────────────────────────────────────────

  private renderPreviewZone(zone: HTMLElement, text: string): void {
    zone.createEl('p', { text: 'Report preview', cls: 'rp-preview-heading' });
    const textarea = zone.createEl('textarea', { cls: 'rp-preview-textarea' });
    textarea.value = text;
    this.previewTextarea = textarea;
  }

  private renderOutputToolbar(
    toolbar: HTMLElement,
    text: string | null,
    enabled: boolean,
  ): void {
    const copyBtn = toolbar.createEl('button', {
      cls: 'rp-copy-btn',
      text: 'Copy to clipboard',
    });
    const saveBtn = toolbar.createEl('button', {
      cls: 'rp-save-btn',
      text: 'Save to note',
    });
    const insertBtn = toolbar.createEl('button', {
      cls: 'rp-insert-btn',
      text: 'Insert into note',
    });
    this.insertBtn = insertBtn;

    const hasActiveNote = (): boolean => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      return view !== null && view.file !== null;
    };

    if (!enabled || text === null) {
      copyBtn.disabled = true;
      saveBtn.disabled = true;
      insertBtn.disabled = true;
      return;
    }

    // Only reach here when enabled=true and text is non-null (D-05, D-08)
    insertBtn.disabled = !hasActiveNote();

    const capturedText = text;

    this.registerDomEvent(copyBtn, 'click', () => {
      const state = this.runner.getState();
      const finalText = state.status === 'complete'
        ? (state as CompleteState).finalText
        : capturedText;
      void navigator.clipboard.writeText(finalText).then(() => {
        new Notice('Copied to clipboard.');
      });
    });

    this.registerDomEvent(saveBtn, 'click', () => {
      const state = this.runner.getState();
      const finalText = state.status === 'complete'
        ? (state as CompleteState).finalText
        : capturedText;
      void this.plugin.saveOutputToNote(finalText).then(() => {
        new Notice('Report saved to note.');
      });
    });

    this.registerDomEvent(insertBtn, 'click', () => {
      const file = this.lastActiveMarkdownFile;
      if (file === null) return;
      const state = this.runner.getState();
      const finalText = state.status === 'complete'
        ? (state as CompleteState).finalText
        : capturedText;
      void this.plugin.insertIntoCurrentNote(finalText, file);
    });

    // Keep insertBtn disabled state in sync with active leaf (D-07, D-08)
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view !== null && view.file !== null) {
          this.lastActiveMarkdownFile = view.file;
        }
        if (this.insertBtn !== null) {
          this.insertBtn.disabled = this.lastActiveMarkdownFile === null;
        }
      })
    );
  }

  private renderError(errors: string[]): void {
    this.contentEl.empty();
    const root = this.contentEl.createDiv({ cls: 'rp-runner-view' });
    const questionZone = root.createDiv({ cls: 'rp-question-zone rp-validation-panel' });
    questionZone.createEl('p', { text: 'Protocol error' });
    const ul = questionZone.createEl('ul', { cls: 'rp-error-list' });
    for (const err of errors) {
      ul.createEl('li', { text: err });
    }
  }

  private renderLegend(root: HTMLElement): void {
    const legend = root.createDiv({ cls: 'rp-legend' });
    const legendItems: Array<{ color: string; label: string }> = [
      { color: '#e07b39', label: 'Question / Answer node' },
      { color: '#4a90d9', label: 'Free-text input node' },
      { color: '#5a9e6f', label: 'Text-block node' },
      { color: '#9b59b6', label: 'Snippet text-block node' },
      { color: '#e0b030', label: 'Loop start / end node' },
    ];
    for (const item of legendItems) {
      const row = legend.createDiv({ cls: 'rp-legend-row' });
      const swatch = row.createEl('span', { cls: 'rp-legend-swatch' });
      swatch.style.background = item.color;
      row.createEl('span', { text: item.label });
    }
  }
}
