// views/runner-view.ts — Phase 5: Full RunnerView with awaiting-snippet-fill branch
import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { ProtocolRunner } from '../runner/protocol-runner';
import { GraphValidator } from '../graph/graph-validator';
import type { CompleteState } from '../runner/runner-state';
import type { ProtocolGraph } from '../graph/graph-model';
import { SnippetFillInModal } from './snippet-fill-in-modal';

export const RUNNER_VIEW_TYPE = 'radiprotocol-runner';

export class RunnerView extends ItemView {
  private readonly plugin: RadiProtocolPlugin;
  private readonly runner = new ProtocolRunner();
  private readonly validator = new GraphValidator();
  private canvasFilePath: string | null = null;
  private previewTextarea: HTMLTextAreaElement | null = null;
  private graph: ProtocolGraph | null = null;

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
      await this.openCanvas(path);
    }
  }

  async openCanvas(filePath: string): Promise<void> {
    this.canvasFilePath = filePath;
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file === null) {
      this.renderError([`Canvas file not found: "${filePath}".`]);
      return;
    }

    let content: string;
    try {
      // vault.read requires a TFile — cast from abstract file
      content = await this.app.vault.read(file as import('obsidian').TFile);
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

    this.graph = parseResult.graph;
    this.runner.start(parseResult.graph);
    this.render();
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
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
        questionZone.createEl('h2', { text: 'Open a canvas file to start' });
        questionZone.createEl('p', {
          text: "Use the 'Run protocol' command from the command palette.",
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
    this.render();
  }

  // ── Sub-renders ───────────────────────────────────────────────────────────

  private renderPreviewZone(zone: HTMLElement, text: string): void {
    zone.createEl('p', { text: 'Report preview', cls: 'rp-preview-heading' });
    const textarea = zone.createEl('textarea', { cls: 'rp-preview-textarea' });
    textarea.readOnly = true;
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

    if (!enabled || text === null) {
      copyBtn.disabled = true;
      saveBtn.disabled = true;
      return;
    }

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
