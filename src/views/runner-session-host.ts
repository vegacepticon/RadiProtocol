import { TFile, setIcon, type App, type EventRef } from 'obsidian';
import { GraphValidator } from '../graph/graph-validator';
import type { AnswerNode, ProtocolGraph, RPEdge } from '../graph/graph-model';
import type { Translator } from '../i18n';
import type { ProtocolDocumentParser } from '../protocol/protocol-document-parser';
import type { ProtocolDocumentStore } from '../protocol/protocol-document-store';
import { ProtocolRunner } from '../runner/protocol-runner';
import { renderCompleteHeading } from '../runner/render/render-complete';
import { renderErrorList } from '../runner/render/render-error';
import { renderLoopPicker } from '../runner/render/render-loop-picker';
import { renderQuestionAtNode } from '../runner/render/render-question';
import {
  renderSnippetFillLoading,
  renderSnippetFillNotFound,
  renderSnippetFillUnsupportedFormat,
} from '../runner/render/render-snippet-fill';
import { renderSnippetPicker } from '../runner/render/render-snippet-picker';
import type { RunnerState } from '../runner/runner-state';
import type { Snippet } from '../snippets/snippet-model';
import type { SnippetResolution, SnippetService } from '../snippets/snippet-service';
import { CSS_CLASS } from '../constants/css-classes';
import { createButton } from '../utils/dom-helpers';
import { SnippetFillInModal } from './snippet-fill-in-modal';
import { SnippetTreePicker } from './snippet-tree-picker';

interface AccumulatorDelta {
  text: string;
  hasSyntheticLeadingSeparator: boolean;
}

export interface RunnerSessionHostOptions {
  app: App;
  protocolPath: string;
  targetNote: TFile;
  startNodeId?: string;
  protocolDocumentStore: Pick<ProtocolDocumentStore, 'read'>;
  protocolDocumentParser: Pick<ProtocolDocumentParser, 'parse'>;
  snippetService: SnippetService;
  getTextSeparator(): 'newline' | 'space';
  getSnippetFolderPath(): string;
  withTargetNoteLock(path: string, operation: () => Promise<void>): Promise<void>;
  t: Translator;
  notify(message: string): void;
  onRequestClose(): void;
}

/**
 * Presentation-neutral owner of one transient protocol execution session.
 * Construction is inert; mount() creates DOM and starts asynchronous bootstrap.
 */
export class RunnerSessionHost {
  private readonly options: RunnerSessionHostOptions;
  private readonly runner: ProtocolRunner;

  private mounted = false;
  /** Mount/dispose ownership: bootstrap and accepted note writes. */
  private lifecycleGeneration = 0;
  /** Render/dispose ownership: picker/resolution/fill UI, errors, and timers. */
  private operationGeneration = 0;
  private graph: ProtocolGraph | null = null;
  private selfCheckItems: string[] = [];
  private selfCheckEnabled = false;

  private rootEl: HTMLElement | null = null;
  private headerEl: HTMLElement | null = null;
  private progressEl: HTMLElement | null = null;
  private progressFillEl: HTMLElement | null = null;
  private progressTextEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private actionsEl: HTMLElement | null = null;
  private footerBtnRowEl: HTMLElement | null = null;

  private targetDeleteEventRef: EventRef | null = null;
  private snippetTreePicker: SnippetTreePicker | null = null;
  private fillModal: SnippetFillInModal | null = null;
  private completionTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private readonly answerDrafts = new Map<string, string>();
  private readonly answerErrors = new Map<string, string>();
  private answerFocusRequest: string | null = null;
  private answerFocusTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private readonly initiallyFocusedAnswers = new Set<string>();
  private readonly textareaResizeTimers = new Set<ReturnType<typeof globalThis.setTimeout>>();

  constructor(options: RunnerSessionHostOptions) {
    this.options = options;
    this.runner = new ProtocolRunner({
      defaultSeparator: options.getTextSeparator(),
      t: options.t,
    });
  }

  isMounted(): boolean {
    return this.mounted;
  }

  hasOpenChildModal(): boolean {
    return this.fillModal !== null;
  }

  getHeaderElement(): HTMLElement | null {
    return this.headerEl;
  }

  async mount(rootEl: HTMLElement): Promise<boolean> {
    if (this.mounted) return false;

    this.mounted = true;
    const lifecycleGeneration = ++this.lifecycleGeneration;
    this.rootEl = rootEl;
    this.buildDom(rootEl);
    this.targetDeleteEventRef = this.options.app.vault.on('delete', (deletedFile) => {
      if (
        !this.mounted
        || !(deletedFile instanceof TFile)
        || deletedFile.path !== this.options.targetNote.path
      ) return;

      // Invalidate every owned continuation before requesting shell close.
      this.dispose();
      this.options.onRequestClose();
    });

    const protocolFile = this.options.app.vault.getAbstractFileByPath(this.options.protocolPath);
    if (!(protocolFile instanceof TFile)) {
      this.failBootstrap(this.options.t('inlineRunner.protocolFileNotFound', {
        path: this.options.protocolPath,
      }), lifecycleGeneration);
      return false;
    }

    let content: string;
    try {
      const canonicalDocument = await this.options.protocolDocumentStore.read(this.options.protocolPath);
      if (!this.isLifecycleCurrent(lifecycleGeneration)) return false;
      if (canonicalDocument === null) {
        this.failBootstrap(this.options.t('inlineRunner.couldNotReadProtocol', {
          path: this.options.protocolPath,
        }), lifecycleGeneration);
        return false;
      }

      content = await this.options.app.vault.read(protocolFile);
      if (!this.isLifecycleCurrent(lifecycleGeneration)) return false;
    } catch {
      this.failBootstrap(this.options.t('inlineRunner.couldNotReadProtocol', {
        path: this.options.protocolPath,
      }), lifecycleGeneration);
      return false;
    }

    this.readSelfCheckConfiguration(content);
    const parseResult = this.options.protocolDocumentParser.parse(content, this.options.protocolPath);
    if (!parseResult.success) {
      this.failBootstrap(parseResult.error, lifecycleGeneration);
      return false;
    }

    const validator = new GraphValidator({
      snippetFileProbe: (absolutePath) =>
        this.options.app.vault.getAbstractFileByPath(absolutePath) !== null,
      snippetFolderPath: this.options.getSnippetFolderPath(),
      t: this.options.t,
    });
    const validationErrors = validator.validate(parseResult.graph);
    if (validationErrors.length > 0) {
      this.failBootstrap(validationErrors.join('\n'), lifecycleGeneration);
      return false;
    }
    if (!this.isLifecycleCurrent(lifecycleGeneration)) return false;

    this.graph = parseResult.graph;
    this.runner.start(this.graph, this.options.startNodeId);
    this.render();
    // Start-from-node auto-appended content (e.g. starting AT a preset Answer or
    // a text-block chain between the chosen node and the first question) lands in
    // the accumulator without a user action, so the host must flush the initial
    // buffer to the target note itself — normal writes are deltas only. Regular
    // start-of-protocol sessions keep their lazy first-action delta semantics.
    if (this.options.startNodeId !== undefined) {
      await this.appendToTargetNote(this.captureAccumulatorDelta(''), lifecycleGeneration);
    }
    return this.mounted;
  }

  dispose(): void {
    if (!this.mounted && this.rootEl === null) return;

    this.mounted = false;
    ++this.lifecycleGeneration;
    ++this.operationGeneration;
    this.clearCompletionTimer();
    this.clearAnswerFocusTimer();
    this.clearTextareaResizeTimers();
    this.disposeSnippetPicker();
    this.closeFillModal();
    if (this.targetDeleteEventRef !== null) {
      this.options.app.vault.offref(this.targetDeleteEventRef);
      this.targetDeleteEventRef = null;
    }

    if (this.rootEl !== null) {
      this.rootEl.removeClass('rp-runner-session-root');
      this.rootEl.removeClass('rp-state-actions');
      this.rootEl.removeClass('rp-state-content-only');
      this.rootEl.empty();
    }
    this.rootEl = null;
    this.headerEl = null;
    this.progressEl = null;
    this.progressFillEl = null;
    this.progressTextEl = null;
    this.contentEl = null;
    this.actionsEl = null;
    this.footerBtnRowEl = null;
    this.graph = null;
    this.selfCheckItems = [];
    this.selfCheckEnabled = false;
    this.answerDrafts.clear();
    this.answerErrors.clear();
    this.answerFocusRequest = null;
    this.initiallyFocusedAnswers.clear();
  }

  handleKeydown(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return false;
    }
    if ((event.ctrlKey || event.altKey) && event.key === 'ArrowLeft') {
      event.preventDefault();
      this.runner.stepBack();
      this.render();
      return true;
    }
    if ((event.ctrlKey || event.altKey) && event.key === 'ArrowRight') {
      event.preventDefault();
      this.runner.redo();
      this.render();
      return true;
    }
    return false;
  }

  private isLifecycleCurrent(generation: number): boolean {
    return this.mounted && generation === this.lifecycleGeneration;
  }

  private isOperationCurrent(
    lifecycleGeneration: number,
    operationGeneration: number,
  ): boolean {
    return this.isLifecycleCurrent(lifecycleGeneration)
      && operationGeneration === this.operationGeneration;
  }

  private failBootstrap(message: string, lifecycleGeneration: number): void {
    if (!this.isLifecycleCurrent(lifecycleGeneration)) return;
    this.options.notify(message);
    this.dispose();
    this.options.onRequestClose();
  }

  private closeFillModal(): void {
    if (this.fillModal === null) return;
    const modal = this.fillModal;
    this.fillModal = null;
    modal.close();
  }

  private buildDom(rootEl: HTMLElement): void {
    rootEl.empty();
    rootEl.addClass('rp-runner-session-root');

    const header = rootEl.createDiv({ cls: 'rp-runner-session-header' });
    this.headerEl = header;
    const progress = header.createDiv({
      cls: 'rp-runner-session-progress',
      attr: {
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
      },
    });
    this.progressEl = progress;
    const track = progress.createDiv({ cls: 'rp-runner-session-progress-track' });
    this.progressFillEl = track.createDiv({ cls: 'rp-runner-session-progress-fill' });
    this.progressTextEl = progress.createDiv({ cls: 'rp-runner-session-progress-text' });

    this.contentEl = rootEl.createDiv({ cls: 'rp-runner-session-content' });
    this.contentEl.createEl('p', {
      text: this.options.t('protocolRunner.starting'),
      cls: CSS_CLASS.EMPTY_STATE_BODY,
    });
    this.actionsEl = rootEl.createDiv({ cls: 'rp-runner-session-actions' });
    const footer = rootEl.createDiv({ cls: 'rp-runner-session-footer' });
    this.footerBtnRowEl = footer.createDiv({ cls: 'rp-runner-session-footer-btn-row' });
    this.renderFooterCloseButton();
  }

  private render(): void {
    if (!this.mounted || this.contentEl === null || this.actionsEl === null) return;

    const lifecycleGeneration = this.lifecycleGeneration;
    const operationGeneration = ++this.operationGeneration;
    this.clearCompletionTimer();
    this.clearAnswerFocusTimer();
    this.clearTextareaResizeTimers();
    this.disposeSnippetPicker();
    this.closeFillModal();

    const state = this.runner.getState();
    this.reconcileAnswerFocusRequest(state);
    this.updateProgress(state);
    this.contentEl.empty();
    this.actionsEl.empty();

    const hasActions = state.status === 'at-node' || state.status === 'awaiting-loop-pick';
    this.rootEl?.toggleClass('rp-state-actions', hasActions);
    this.rootEl?.toggleClass('rp-state-content-only', !hasActions);

    if (this.footerBtnRowEl !== null) {
      this.footerBtnRowEl.empty();
      this.renderFooterCloseButton();
    }

    switch (state.status) {
      case 'idle':
        this.contentEl.createEl('p', {
          text: this.options.t('protocolRunner.starting'),
          cls: CSS_CLASS.EMPTY_STATE_BODY,
        });
        return;

      case 'at-node': {
        const result = renderQuestionAtNode(
          this.contentEl,
          this.actionsEl,
          this.graph,
          state,
          {
            bindClick: (element, handler) => element.addEventListener('click', handler),
            bindInput: (element, handler) => element.addEventListener('input', handler),
            bindKeydown: (element, handler) => element.addEventListener('keydown', handler),
            scheduleTextareaResize: (textarea, resize) => {
              this.deferTextareaResize(
                textarea,
                resize,
                lifecycleGeneration,
                operationGeneration,
              );
            },
            renderError: (messages) => this.renderError(messages),
            getAnswerDraft: (answerId) => this.answerDrafts.get(answerId) ?? '',
            onAnswerDraftChange: (answerNode, value) => {
              if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return false;
              this.handleAnswerDraftChange(answerNode.id, value);
              return true;
            },
            getAnswerError: (answerId) => this.answerErrors.get(answerId),
            onSubmitFreeText: (answerNode, submittedText) => {
              if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
              return this.handleAnswerClick(answerNode, submittedText);
            },
            getAnswerFocusRequest: () => this.answerFocusRequest,
            requestAnswerFocus: (answerId, textarea, explicitRequest) => {
              this.deferAnswerFocus(
                answerId,
                textarea,
                explicitRequest,
                lifecycleGeneration,
                operationGeneration,
              );
            },
            onChooseAnswer: (answerNode) => {
              if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
              return this.handleAnswerClick(answerNode);
            },
            onChooseQuestionBranch: (edge) => {
              if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
              this.runner.chooseQuestionBranch(edge.id);
              this.render();
            },
            onChooseSnippetBranch: (snippetNode, isFileBound) => {
              if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
              if (isFileBound) {
                this.runner.pickFileBoundSnippet(
                  state.currentNodeId,
                  snippetNode.id,
                  snippetNode.radiprotocol_snippetPath as string,
                );
              } else {
                this.runner.chooseSnippetBranch(snippetNode.id);
              }
              this.render();
            },
            t: this.options.t,
          },
        );
        if (result === 'error') return;
        if (result === 'not-question') {
          this.contentEl.createEl('p', {
            text: this.options.t('protocolRunner.processing'),
            cls: CSS_CLASS.EMPTY_STATE_BODY,
          });
        }

        const node = this.graph?.nodes.get(state.currentNodeId);
        if (node?.kind === 'question') {
          const hasAnswers = (this.graph?.adjacency.get(state.currentNodeId) ?? [])
            .some((nodeId) => this.graph?.nodes.get(nodeId)?.kind === 'answer');
          this.renderFooterIcons(
            state.canStepBack,
            hasAnswers && typeof this.runner.skip === 'function',
            state.canRedo,
          );
        }
        return;
      }

      case 'awaiting-snippet-pick':
        this.contentEl.createEl('p', {
          text: this.options.t('protocolRunner.loadingSnippets'),
          cls: CSS_CLASS.EMPTY_STATE_BODY,
        });
        this.mountSnippetPicker(state, lifecycleGeneration, operationGeneration);
        return;

      case 'awaiting-loop-pick': {
        const rendered = renderLoopPicker(
          this.contentEl,
          this.actionsEl,
          this.graph,
          state,
          {
            bindClick: (element, handler) => element.addEventListener('click', handler),
            bindInput: (element, handler) => element.addEventListener('input', handler),
            bindKeydown: (element, handler) => element.addEventListener('keydown', handler),
            scheduleTextareaResize: (textarea, resize) => {
              this.deferTextareaResize(
                textarea,
                resize,
                lifecycleGeneration,
                operationGeneration,
              );
            },
            renderError: (messages) => this.renderError(messages),
            getAnswerDraft: (answerId) => this.answerDrafts.get(answerId) ?? '',
            onAnswerDraftChange: (answerNode, value) => {
              if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return false;
              this.handleAnswerDraftChange(answerNode.id, value);
              return true;
            },
            getAnswerError: (answerId) => this.answerErrors.get(answerId),
            onSubmitFreeText: (edge, submittedText) => {
              if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
              return this.handleLoopBranchClick(edge, submittedText);
            },
            onChooseLoopBranch: (edge) => this.handleLoopBranchClick(edge),
            getAnswerFocusRequest: () => this.answerFocusRequest,
            requestAnswerFocus: (answerId, textarea, explicitRequest) => {
              this.deferAnswerFocus(
                answerId,
                textarea,
                explicitRequest,
                lifecycleGeneration,
                operationGeneration,
              );
            },
            t: this.options.t,
          },
        );
        if (rendered) this.renderFooterIcons(state.canStepBack, false, state.canRedo);
        return;
      }

      case 'awaiting-snippet-fill':
        renderSnippetFillLoading(this.contentEl);
        this.renderFooterIcons(state.canStepBack, false, state.canRedo);
        void this.handleSnippetFill(
          state.snippetId,
          this.contentEl,
          lifecycleGeneration,
          operationGeneration,
        );
        return;

      case 'complete':
        if (!this.selfCheckEnabled || this.selfCheckItems.length === 0) {
          this.scheduleCompletionClose(lifecycleGeneration, operationGeneration);
        } else {
          this.renderSelfCheckCompletion(
            this.contentEl,
            lifecycleGeneration,
            operationGeneration,
          );
        }
        return;

      case 'error':
        this.renderError([state.message]);
        return;

      default: {
        const exhaustive: never = state;
        return exhaustive;
      }
    }
  }

  private renderFooterCloseButton(): void {
    if (this.footerBtnRowEl === null) return;
    const closeButton = this.footerBtnRowEl.createEl('button', {
      cls: 'rp-runner-session-close-btn rp-runner-icon-btn',
    });
    setIcon(closeButton, 'x');
    closeButton.setAttribute('aria-label', this.options.t('protocolRunner.closeProtocol'));
    closeButton.addEventListener('click', () => this.options.onRequestClose());
  }

  private renderFooterIcons(showBack: boolean, showSkip: boolean, showRedo: boolean): void {
    if (this.footerBtnRowEl === null || (!showBack && !showSkip && !showRedo)) return;
    const group = this.footerBtnRowEl.createDiv({ cls: 'rp-runner-footer-row' });
    if (showBack) {
      const backButton = createButton(group, {
        cls: 'rp-step-back-btn rp-runner-icon-btn',
        attr: { 'aria-label': this.options.t('protocolRunner.stepBack') },
      });
      setIcon(backButton, 'arrow-left');
      backButton.addEventListener('click', () => {
        backButton.disabled = true;
        this.runner.stepBack();
        this.render();
      });
    }
    if (showRedo) {
      const redoButton = createButton(group, {
        cls: 'rp-step-redo-btn rp-runner-icon-btn',
        attr: { 'aria-label': this.options.t('protocolRunner.stepRedo') },
      });
      setIcon(redoButton, 'redo');
      redoButton.addEventListener('click', () => {
        redoButton.disabled = true;
        this.runner.redo();
        this.render();
      });
    }
    if (showSkip) {
      const skipButton = createButton(group, {
        cls: 'rp-skip-btn rp-runner-icon-btn',
        attr: { 'aria-label': this.options.t('protocolRunner.stepSkip') },
      });
      setIcon(skipButton, 'skip-forward');
      skipButton.addEventListener('click', () => {
        skipButton.disabled = true;
        void this.handleSkipClick();
      });
    }
  }

  private readSelfCheckConfiguration(content: string): void {
    this.selfCheckItems = [];
    this.selfCheckEnabled = false;
    try {
      const raw = JSON.parse(content) as {
        selfCheckItems?: unknown;
        selfCheckEnabled?: unknown;
      };
      if (Array.isArray(raw.selfCheckItems)) {
        this.selfCheckItems = raw.selfCheckItems
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      }
      this.selfCheckEnabled = raw.selfCheckEnabled === true;
    } catch {
      this.selfCheckItems = [];
      this.selfCheckEnabled = false;
    }
  }

  private calculateProgressPercent(state: RunnerState): number {
    if (this.graph === null) return 0;
    if (state.status === 'complete') return 100;
    if (state.status === 'idle' || state.status === 'error') return 0;

    const currentNodeId = state.status === 'at-node' ? state.currentNodeId : state.nodeId;
    const globalDistances = this.calculateShortestDistances(this.graph.startNodeId);
    const globalMaxDistance = Math.max(1, ...globalDistances.values());
    const sessionStartNodeId = this.options.startNodeId ?? this.graph.startNodeId;
    const baselineDistance = globalDistances.get(sessionStartNodeId) ?? 0;
    const baselinePercent = Math.round((baselineDistance / globalMaxDistance) * 99);

    const sessionDistances = this.calculateShortestDistances(sessionStartNodeId);
    const currentSessionDistance = sessionDistances.get(currentNodeId);
    if (currentSessionDistance === undefined) {
      return Math.min(99, Math.max(0, baselinePercent));
    }
    const sessionMaxDistance = Math.max(1, ...sessionDistances.values());
    const sessionPercent = Math.round(
      (currentSessionDistance / sessionMaxDistance) * (99 - baselinePercent),
    );
    return Math.min(99, Math.max(0, baselinePercent + sessionPercent));
  }

  private calculateShortestDistances(startNodeId: string): Map<string, number> {
    const distances = new Map<string, number>();
    if (this.graph === null) return distances;
    const queue = [startNodeId];
    distances.set(startNodeId, 0);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      const distance = distances.get(current) ?? 0;
      for (const next of this.graph.adjacency.get(current) ?? []) {
        if (distances.has(next)) continue;
        distances.set(next, distance + 1);
        queue.push(next);
      }
    }
    return distances;
  }

  private updateProgress(state: RunnerState): void {
    if (
      this.progressEl === null
      || this.progressFillEl === null
      || this.progressTextEl === null
    ) return;
    const percent = this.calculateProgressPercent(state);
    this.progressFillEl.style.width = `${percent}%`;
    this.progressTextEl.setText(`${percent}%`);
    this.progressEl.setAttribute('aria-valuenow', String(percent));
    this.progressEl.setAttribute('aria-label', this.options.t('protocolRunner.progressLabel', {
      percent: String(percent),
    }));
  }

  private scheduleCompletionClose(
    lifecycleGeneration: number,
    operationGeneration: number,
  ): void {
    this.clearCompletionTimer();
    this.completionTimer = globalThis.setTimeout(() => {
      this.completionTimer = null;
      if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) {
        this.options.onRequestClose();
      }
    }, 0);
  }

  private clearCompletionTimer(): void {
    if (this.completionTimer === null) return;
    globalThis.clearTimeout(this.completionTimer);
    this.completionTimer = null;
  }

  private renderSelfCheckCompletion(
    container: HTMLElement,
    lifecycleGeneration: number,
    operationGeneration: number,
  ): void {
    renderCompleteHeading(container);
    const checklist = container.createDiv({ cls: 'rp-runner-session-self-check' });
    checklist.createEl('h4', { text: this.options.t('selfCheck.title') });
    const checked = new Set<number>();
    this.selfCheckItems.forEach((item, index) => {
      const label = checklist.createEl('label', {
        cls: 'rp-runner-session-self-check-item',
      });
      const checkbox = label.createEl('input', { type: 'checkbox' });
      label.createSpan({ text: item });
      checkbox.addEventListener('change', () => {
        if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
        if (checkbox.checked) checked.add(index);
        else checked.delete(index);
        if (checked.size === this.selfCheckItems.length) this.options.onRequestClose();
      });
    });
  }

  private handleAnswerDraftChange(answerId: string, value: string): void {
    this.answerDrafts.set(answerId, value);
    this.answerErrors.delete(answerId);
    if (this.answerFocusRequest === answerId) this.answerFocusRequest = null;
    this.initiallyFocusedAnswers.add(answerId);
    this.clearAnswerFocusTimer();
  }

  private async handleAnswerClick(
    answerNode: AnswerNode,
    submittedText?: string,
  ): Promise<void> {
    const lifecycleGeneration = this.lifecycleGeneration;
    const operationGeneration = this.operationGeneration;
    this.clearAnswerFocusTimer();
    this.answerFocusRequest = null;

    if (
      answerNode.freeText === true
      && (submittedText === undefined || submittedText.trim() === '')
    ) {
      this.answerErrors.set(
        answerNode.id,
        this.options.t('protocolRunner.freeTextBlankError'),
      );
      this.answerFocusRequest = answerNode.id;
      this.render();
      return;
    }

    const beforeText = this.extractAccumulatedText(this.runner.getState());
    const accepted = this.runner.chooseAnswer(answerNode.id, submittedText);
    if (!accepted) return;

    if (answerNode.freeText === true) {
      this.answerDrafts.delete(answerNode.id);
      this.answerErrors.delete(answerNode.id);
      if (this.answerFocusRequest === answerNode.id) this.answerFocusRequest = null;
    }

    const delta = this.captureAccumulatorDelta(beforeText);
    await this.appendToTargetNote(delta, lifecycleGeneration);
    if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
  }

  private reconcileAnswerFocusRequest(state: RunnerState): void {
    if (this.answerFocusRequest === null) return;
    // Free-text errors can originate at an at-node question OR at a looped
    // question's picker (free-text Answer as a direct loop branch target), so
    // both states retain a focus request while the requested Answer remains an
    // outgoing neighbour of the current node.
    if (state.status === 'at-node' || state.status === 'awaiting-loop-pick') {
      const nodeId = state.status === 'at-node' ? state.currentNodeId : state.nodeId;
      const outgoing = this.graph?.adjacency.get(nodeId) ?? [];
      if (!outgoing.includes(this.answerFocusRequest)) this.answerFocusRequest = null;
      return;
    }
    this.answerFocusRequest = null;
  }

  private deferAnswerFocus(
    answerId: string,
    textarea: HTMLTextAreaElement,
    explicitRequest: boolean,
    lifecycleGeneration: number,
    operationGeneration: number,
  ): void {
    if (explicitRequest) {
      if (this.answerFocusRequest !== answerId) return;
    } else if (this.initiallyFocusedAnswers.has(answerId)) {
      return;
    }

    this.clearAnswerFocusTimer();
    this.answerFocusTimer = globalThis.setTimeout(() => {
      this.answerFocusTimer = null;
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      if (this.rootEl === null || !this.rootEl.contains(textarea)) return;
      if (explicitRequest && this.answerFocusRequest !== answerId) return;
      textarea.focus();
      if (explicitRequest && this.answerFocusRequest === answerId) {
        this.answerFocusRequest = null;
      }
      this.initiallyFocusedAnswers.add(answerId);
    }, 0);
  }

  private deferTextareaResize(
    textarea: HTMLTextAreaElement,
    resize: () => void,
    lifecycleGeneration: number,
    operationGeneration: number,
  ): void {
    const timer = globalThis.setTimeout(() => {
      this.textareaResizeTimers.delete(timer);
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      if (this.rootEl === null || !this.rootEl.contains(textarea)) return;
      resize();
    }, 0);
    this.textareaResizeTimers.add(timer);
  }

  private clearTextareaResizeTimers(): void {
    for (const timer of this.textareaResizeTimers) globalThis.clearTimeout(timer);
    this.textareaResizeTimers.clear();
  }

  private clearAnswerFocusTimer(): void {
    if (this.answerFocusTimer === null) return;
    globalThis.clearTimeout(this.answerFocusTimer);
    this.answerFocusTimer = null;
  }

  private async handleLoopBranchClick(
    edge: RPEdge,
    submittedText?: string,
  ): Promise<void> {
    const lifecycleGeneration = this.lifecycleGeneration;
    const operationGeneration = this.operationGeneration;
    this.clearAnswerFocusTimer();

    // A free-text Answer as a direct loop branch target requires typed input:
    // blank submissions surface the inline error and restore focus, exactly like
    // the at-node free-text path, without any runner/vault mutation.
    const target = this.graph?.nodes.get(edge.toNodeId);
    const freeTextTarget = target !== undefined
      && target.kind === 'answer'
      && target.freeText === true
      ? target
      : undefined;
    if (
      freeTextTarget !== undefined
      && (submittedText === undefined || submittedText.trim() === '')
    ) {
      this.answerErrors.set(
        freeTextTarget.id,
        this.options.t('protocolRunner.freeTextBlankError'),
      );
      this.answerFocusRequest = freeTextTarget.id;
      this.render();
      return;
    }

    const beforeText = this.extractAccumulatedText(this.runner.getState());
    const accepted = this.runner.chooseLoopBranch(edge.id, submittedText);
    if (!accepted) return;

    if (freeTextTarget !== undefined) {
      this.answerDrafts.delete(freeTextTarget.id);
      this.answerErrors.delete(freeTextTarget.id);
      if (this.answerFocusRequest === freeTextTarget.id) this.answerFocusRequest = null;
    }

    const delta = this.captureAccumulatorDelta(beforeText);
    await this.appendToTargetNote(delta, lifecycleGeneration);
    if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
  }

  private async handleSkipClick(): Promise<void> {
    const lifecycleGeneration = this.lifecycleGeneration;
    const operationGeneration = this.operationGeneration;
    const beforeText = this.extractAccumulatedText(this.runner.getState());
    this.runner.skip();
    const delta = this.captureAccumulatorDelta(beforeText);
    await this.appendToTargetNote(delta, lifecycleGeneration);
    if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
  }

  private extractAccumulatedText(state: RunnerState): string {
    switch (state.status) {
      case 'at-node':
      case 'awaiting-loop-pick':
      case 'awaiting-snippet-pick':
      case 'awaiting-snippet-fill':
        return state.accumulatedText;
      case 'complete':
        return state.finalText;
      case 'idle':
      case 'error':
        return '';
      default: {
        const exhaustive: never = state;
        return exhaustive;
      }
    }
  }

  private captureAccumulatorDelta(beforeText: string): AccumulatorDelta {
    const afterText = this.extractAccumulatedText(this.runner.getState());
    if (afterText.length <= beforeText.length) {
      return { text: '', hasSyntheticLeadingSeparator: false };
    }
    if (!afterText.startsWith(beforeText)) {
      console.warn('[RadiProtocol] Text changed non-monotonically, skipping append');
      return { text: '', hasSyntheticLeadingSeparator: false };
    }
    return {
      text: afterText.slice(beforeText.length),
      // TextAccumulator prefixes every non-first chunk with its effective
      // separator. A first chunk has no generated prefix, so any leading
      // whitespace there is authored and must never be de-duplicated.
      hasSyntheticLeadingSeparator: beforeText.length > 0,
    };
  }

  private async appendToTargetNote(
    delta: AccumulatorDelta,
    lifecycleGeneration: number,
  ): Promise<void> {
    const { text } = delta;
    if (text.length === 0 || !this.isLifecycleCurrent(lifecycleGeneration)) return;
    try {
      await this.options.withTargetNoteLock(this.options.targetNote.path, async () => {
        if (!this.isLifecycleCurrent(lifecycleGeneration)) return;
        const currentContent = await this.options.app.vault.read(this.options.targetNote);
        if (!this.isLifecycleCurrent(lifecycleGeneration)) return;
        const separator = this.options.getTextSeparator() === 'newline' ? '\n' : ' ';
        const toAppend = delta.hasSyntheticLeadingSeparator
          && currentContent.endsWith(separator)
          && text.startsWith(separator)
          ? text.slice(separator.length)
          : text;
        if (!this.isLifecycleCurrent(lifecycleGeneration)) return;
        await this.options.app.vault.modify(
          this.options.targetNote,
          currentContent + toAppend,
        );
      });
    } catch (error) {
      if (!this.isLifecycleCurrent(lifecycleGeneration)) return;
      console.error('[RadiProtocol] Failed to append runner output to bound note', error);
      this.options.notify(this.options.t('inlineRunner.noteWriteFailed'));
    }
  }

  private mountSnippetPicker(
    state: Extract<RunnerState, { status: 'awaiting-snippet-pick' }>,
    lifecycleGeneration: number,
    operationGeneration: number,
  ): void {
    if (
      this.contentEl === null
      || !this.isOperationCurrent(lifecycleGeneration, operationGeneration)
    ) return;
    this.snippetTreePicker = renderSnippetPicker(this.contentEl, state, {
      app: this.options.app,
      snippetService: this.options.snippetService,
      rootPath: this.options.getSnippetFolderPath(),
      hostClass: CSS_CLASS.STP_RUNNER_SESSION_HOST,
      copy: {
        notFound: (relativePath) => this.options.t('inlineRunner.snippetNotFound', {
          path: relativePath,
        }),
      },
      t: this.options.t,
      bindClick: (element, handler) => element.addEventListener('click', handler),
      getCurrentNodeId: () => {
        if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return null;
        const current = this.runner.getState();
        return current.status === 'awaiting-snippet-pick' ? current.nodeId : null;
      },
      isStillMounted: () => this.isOperationCurrent(
        lifecycleGeneration,
        operationGeneration,
      ),
      presentAsyncError: (message) => {
        if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
        // Invalidate sibling loads, then recreate the current picker/footer before
        // adding the error, preserving the existing floating-host recovery flow.
        ++this.operationGeneration;
        this.disposeSnippetPicker();
        this.render();
        this.contentEl?.createEl('p', {
          cls: CSS_CLASS.EMPTY_STATE_BODY,
          text: message,
        });
      },
      onSnippetReady: (snippet) => this.handleSnippetPickerSelection(
        snippet,
        lifecycleGeneration,
        operationGeneration,
      ),
      onBack: () => {
        if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
        this.runner.stepBack();
        this.render();
      },
      onRedo: () => {
        if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
        this.runner.redo();
        this.render();
      },
    });
  }

  private disposeSnippetPicker(): void {
    if (this.snippetTreePicker === null) return;
    this.snippetTreePicker.unmount();
    this.snippetTreePicker = null;
  }

  private async handleSnippetPickerSelection(
    snippet: Snippet,
    lifecycleGeneration: number,
    operationGeneration: number,
  ): Promise<void> {
    if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
    this.runner.pickSnippet(snippet.path);

    if (snippet.kind === 'md') {
      const beforeText = this.extractAccumulatedText(this.runner.getState());
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      this.runner.completeSnippet(snippet.content);
      const delta = this.captureAccumulatorDelta(beforeText);
      await this.appendToTargetNote(delta, lifecycleGeneration);
      if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
      return;
    }

    if (snippet.placeholders.length === 0) {
      const beforeText = this.extractAccumulatedText(this.runner.getState());
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      this.runner.completeSnippet(snippet.template);
      const delta = this.captureAccumulatorDelta(beforeText);
      await this.appendToTargetNote(delta, lifecycleGeneration);
      if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
      return;
    }

    if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
  }

  private async handleSnippetFill(
    snippetId: string,
    questionZone: HTMLElement,
    lifecycleGeneration: number,
    operationGeneration: number,
  ): Promise<void> {
    if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
    let resolution: SnippetResolution;
    try {
      resolution = await this.options.snippetService.resolveSnippet(snippetId);
    } catch (error) {
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      console.error('[RadiProtocol] Failed to resolve runner snippet', error);
      this.renderError([this.options.t('inlineRunner.snippetLoadFailed')]);
      return;
    }
    if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;

    if (resolution.status === 'missing') {
      renderSnippetFillNotFound(questionZone, snippetId);
      return;
    }
    if (resolution.status === 'legacy-json') {
      renderSnippetFillUnsupportedFormat(questionZone, resolution.path, this.options.t);
      this.runner.stepBack();
      this.render();
      return;
    }

    const snippet = resolution.snippet;
    const beforeText = this.extractAccumulatedText(this.runner.getState());
    if (snippet.kind === 'md') {
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      this.runner.completeSnippet(snippet.content);
      const delta = this.captureAccumulatorDelta(beforeText);
      await this.appendToTargetNote(delta, lifecycleGeneration);
      if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
      return;
    }
    if (snippet.placeholders.length === 0) {
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      this.runner.completeSnippet(snippet.template);
      const delta = this.captureAccumulatorDelta(beforeText);
      await this.appendToTargetNote(delta, lifecycleGeneration);
      if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
      return;
    }

    const modal = new SnippetFillInModal(this.options.app, snippet, this.options.t);
    this.fillModal = modal;
    modal.open();
    let rendered: string | null;
    try {
      rendered = await modal.result;
    } finally {
      if (this.fillModal === modal) this.fillModal = null;
    }
    if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
    this.runner.completeSnippet(rendered ?? '');
    const delta = this.captureAccumulatorDelta(beforeText);
    await this.appendToTargetNote(delta, lifecycleGeneration);
    if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
  }

  private renderError(errors: string[]): void {
    if (this.contentEl === null) return;
    this.contentEl.empty();
    const errorPanel = this.contentEl.createDiv({ cls: 'rp-error-panel' });
    renderErrorList(errorPanel, errors, { titleClass: CSS_CLASS.ERROR_TITLE });
  }
}
