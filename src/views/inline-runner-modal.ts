// views/inline-runner-modal.ts — Phase 54: Inline protocol display mode
// A floating, non-blocking DOM host for inline protocol runs over the active note.
// NOT an Obsidian Modal subclass — plain class managing its own DOM element.
import { App, TFile, Notice, setIcon } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { ProtocolRunner } from '../runner/protocol-runner';
import { GraphValidator } from '../graph/graph-validator';
import type { ProtocolGraph, AnswerNode } from '../graph/graph-model';
import type { RunnerState } from '../runner/runner-state';
import { SnippetTreePicker } from './snippet-tree-picker';
import { SnippetFillInModal } from './snippet-fill-in-modal';
import { renderLoopPicker } from '../runner/render/render-loop-picker';
import { renderQuestionAtNode } from '../runner/render/render-question';
import { renderSnippetPicker } from '../runner/render/render-snippet-picker';
import { renderCompleteHeading } from '../runner/render/render-complete';
import { renderErrorList } from '../runner/render/render-error';
import { createButton } from '../utils/dom-helpers';
import { CSS_CLASS } from '../constants/css-classes';
import {
  isFullSnippetPath,
  renderSnippetFillLoading,
  renderSnippetFillNotFound,
} from '../runner/render/render-snippet-fill';
import type { InlineRunnerLayout } from '../settings';

interface InlineRunnerViewport {
  width: number;
  height: number;
}

interface InlineRunnerSize {
  width: number;
  height: number;
}

const INLINE_RUNNER_DEFAULT_WIDTH = 420;
const INLINE_RUNNER_DEFAULT_HEIGHT = 320;
const INLINE_RUNNER_DEFAULT_MARGIN = 16;
const INLINE_RUNNER_MIN_VISIBLE_WIDTH = 160;
const INLINE_RUNNER_MIN_VISIBLE_HEADER_HEIGHT = 40;

function isFiniteInlineRunnerPosition(position: InlineRunnerLayout | null): position is InlineRunnerLayout {
  return position !== null && Number.isFinite(position.left) && Number.isFinite(position.top);
}

/** Phase 60 D-02: never let persisted coordinates place the draggable header fully off-screen. */
export function clampInlineRunnerPosition(
  position: InlineRunnerLayout | null,
  viewport: InlineRunnerViewport,
  size: InlineRunnerSize,
): InlineRunnerLayout | null {
  if (!isFiniteInlineRunnerPosition(position)) return null;

  const visibleWidth = Math.min(Math.max(size.width, INLINE_RUNNER_MIN_VISIBLE_WIDTH), viewport.width);
  const visibleHeight = Math.min(Math.max(size.height, INLINE_RUNNER_MIN_VISIBLE_HEADER_HEIGHT), viewport.height);
  const maxLeft = Math.max(0, viewport.width - Math.min(visibleWidth, INLINE_RUNNER_MIN_VISIBLE_WIDTH));
  const maxTop = Math.max(0, viewport.height - Math.min(visibleHeight, INLINE_RUNNER_MIN_VISIBLE_HEADER_HEIGHT));

  return {
    left: Math.min(Math.max(0, position.left), maxLeft),
    top: Math.min(Math.max(0, position.top), maxTop),
  };
}

/** Phase 67 D-10: extends Phase 60 D-02 clamp-on-restore to width/height.
 *  Position arm reuses the existing clampInlineRunnerPosition (preserves
 *  INLINE_RUNNER_MIN_VISIBLE_WIDTH gating). Size arm clamps to viewport - 32px
 *  (matches the CSS `max-width: calc(100vw - var(--size-4-8))` rule). Missing
 *  or non-finite width/height fall back to defaults (D-06). */
export function clampInlineRunnerLayout(
  layout: InlineRunnerLayout | null,
  viewport: InlineRunnerViewport,
): InlineRunnerLayout | null {
  if (layout === null) return null;
  const positionOnly = clampInlineRunnerPosition(
    { left: layout.left, top: layout.top },
    viewport,
    { width: INLINE_RUNNER_DEFAULT_WIDTH, height: INLINE_RUNNER_DEFAULT_HEIGHT },
  );
  if (positionOnly === null) return null;
  const VIEWPORT_MARGIN_PX = 32;
  const widthIn = (typeof layout.width === 'number' && Number.isFinite(layout.width) && layout.width > 0)
    ? layout.width : INLINE_RUNNER_DEFAULT_WIDTH;
  const heightIn = (typeof layout.height === 'number' && Number.isFinite(layout.height) && layout.height > 0)
    ? layout.height : INLINE_RUNNER_DEFAULT_HEIGHT;
  const width = Math.min(widthIn, Math.max(0, viewport.width - VIEWPORT_MARGIN_PX));
  const height = Math.min(heightIn, Math.max(0, viewport.height - VIEWPORT_MARGIN_PX));
  return { left: positionOnly.left, top: positionOnly.top, width, height };
}

/**
 * InlineRunnerModal — floating panel that hosts the Runner UI over an active note.
 *
 * Lifecycle:
 *   const modal = new InlineRunnerModal(app, plugin, canvasPath, targetNote);
 *   modal.open();   // parses canvas, starts runner, shows panel
 *   modal.close();  // unsubscribes, removes from DOM
 */
export class InlineRunnerModal {
  private readonly app: App;
  private readonly plugin: RadiProtocolPlugin;
  private readonly targetNote: TFile;
  private readonly startNodeId: string | undefined;

  private containerEl: HTMLElement | null = null;
  private headerEl: HTMLElement | null = null;
  private progressFillEl: HTMLElement | null = null;
  private progressTextEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private actionsEl: HTMLElement | null = null;
  private footerBtnRowEl: HTMLElement | null = null;

  private runner: ProtocolRunner;
  private readonly validator: GraphValidator;
  private graph: ProtocolGraph | null = null;
  private canvasFilePath: string | null = null;
  private selfCheckItems: string[] = [];
  private selfCheckEnabled = false;

  private activeFileEventRef: import('obsidian').EventRef | null = null;
  private fileDeleteEventRef: import('obsidian').EventRef | null = null;
  private isHidden = false;
  private openedSuccessfully = false;

  private snippetTreePicker: SnippetTreePicker | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private workspaceLayoutRef: import('obsidian').EventRef | null = null;

  /** Phase 59 INLINE-FIX-05: tracks the active fill-in modal so close() can dispose it. */
  private fillModal: SnippetFillInModal | null = null;

  /** Phase 59 INLINE-FIX-05: gate flag — when true, D1 handleActiveLeafChange skips hide/show
   *  to prevent the inline container from disappearing while SnippetFillInModal is active. */
  private isFillModalOpen = false;

  private windowResizeHandler: (() => void) | null = null;
  private dragMoveHandler: ((event: PointerEvent) => void) | null = null;
  private dragUpHandler: ((event: PointerEvent) => void) | null = null;
  private isDragging = false;
  /** Phase 67 D-04: tracks active resize gesture so .is-resizing class lifecycle is one-shot. */
  private isResizing = false;
  /** Phase 67 D-04: handle for the 400ms debounce timer between ResizeObserver ticks. */
  private resizeDebounceTimer: number | null = null;

  constructor(
    app: App,
    plugin: RadiProtocolPlugin,
    canvasFilePath: string,
    targetNote: TFile,
    startNodeId?: string,
  ) {
    this.app = app;
    this.plugin = plugin;
    this.canvasFilePath = canvasFilePath;
    this.targetNote = targetNote;
    this.startNodeId = startNodeId;
    // Phase 84 (I18N-02): inject translator so runtime / validator messages follow the active locale.
    this.runner = new ProtocolRunner({
      defaultSeparator: this.plugin.settings.textSeparator,
      t: this.plugin.i18n.t.bind(this.plugin.i18n),
    });
    this.validator = new GraphValidator({
      snippetFileProbe: (absPath) => this.app.vault.getAbstractFileByPath(absPath) !== null,
      snippetFolderPath: this.plugin.settings.snippetFolderPath,
      t: this.plugin.i18n.t.bind(this.plugin.i18n),
    });
  }

  // ── Phase 85 INLINE-MULTI-01 — Registry accessors ────────────────────────

  /** Identifier for the protocol file driving this runner. */
  getCanvasFilePath(): string | null {
    return this.canvasFilePath;
  }

  /** The markdown note this runner appends answers/snippets into. */
  getTargetNote(): TFile {
    return this.targetNote;
  }

  isOpen(): boolean {
    return this.openedSuccessfully && this.containerEl !== null;
  }

  /** Bring an already-open inline runner to the foreground.
   *  Re-appends the container to document.body (so it stacks above sibling
   *  runners) and clears the D1 `is-hidden` class if previously hidden. */
  focus(): void {
    if (this.containerEl === null) return;
    document.body.appendChild(this.containerEl);
    this.containerEl.removeClass('is-hidden');
    this.isHidden = false;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async open(): Promise<void> {
    console.debug('[RadiProtocol] InlineRunnerModal.open()', this.canvasFilePath);

    // Build DOM shell
    this.buildContainer();

    // Parse and validate .rp.json protocol file.
    const protocolPath = this.canvasFilePath!;
    const file = this.app.vault.getAbstractFileByPath(protocolPath);
    if (!(file instanceof TFile)) {
      const reason = `Protocol file not found: "${protocolPath}".`;
      console.warn('[RadiProtocol] InlineRunnerModal.open() failed:', reason);
      new Notice(reason);
      this.close();
      return;
    }

    let content: string;
    try {
      content = await this.app.vault.read(file);
    } catch {
      const reason = `Could not read protocol file: "${protocolPath}".`;
      console.warn('[RadiProtocol] InlineRunnerModal.open() failed:', reason);
      new Notice(reason);
      this.close();
      return;
    }

    this.selfCheckItems = [];
    this.selfCheckEnabled = false;
    try {
      const rawDoc = JSON.parse(content) as { selfCheckItems?: unknown; selfCheckEnabled?: unknown };
      if (Array.isArray(rawDoc.selfCheckItems)) {
        this.selfCheckItems = rawDoc.selfCheckItems
          .filter((item): item is string => typeof item === 'string')
          .map(item => item.trim())
          .filter(item => item.length > 0);
      }
      if (rawDoc.selfCheckEnabled === true) this.selfCheckEnabled = true;
    } catch {
      this.selfCheckItems = [];
      this.selfCheckEnabled = false;
    }

    const parseResult = this.plugin.protocolDocumentParser.parse(content, protocolPath);
    if (!parseResult.success) {
      console.warn('[RadiProtocol] InlineRunnerModal.open() parse failed:', parseResult.error);
      new Notice(parseResult.error);
      this.close();
      return;
    }

    const validationErrors = this.validator.validate(parseResult.graph);
    if (validationErrors.length > 0) {
      console.warn('[RadiProtocol] InlineRunnerModal.open() validation failed:', validationErrors);
      new Notice(validationErrors.join('\n'));
      this.close();
      return;
    }

    this.graph = parseResult.graph;
    this.runner.start(this.graph, this.startNodeId);
    this.render();
    this.openedSuccessfully = true;

    // D1: freeze/resume on note switch
    this.activeFileEventRef = this.app.workspace.on('active-leaf-change', () => {
      this.handleActiveLeafChange();
    });

    // D2: close when target note is deleted
    this.fileDeleteEventRef = this.app.vault.on('delete', (deletedFile) => {
      if (deletedFile instanceof TFile && deletedFile.path === this.targetNote.path) {
        this.handleTargetNoteDeleted();
      }
    });

    // Initial visibility check
    this.handleActiveLeafChange();

    // Phase 85 INLINE-MULTI-02: cascade-or-default position decision.
    this.applyInitialLayout();

    // Re-clamp on layout changes without resetting to note-width anchoring.
    this.workspaceLayoutRef = this.app.workspace.on('layout-change', () => {
      void this.reclampCurrentPosition(true);
    });
    this.windowResizeHandler = () => {
      void this.reclampCurrentPosition(true);
    };
    window.addEventListener('resize', this.windowResizeHandler);

    // Phase 67 D-04 / D-07: debounced save on resize-end + .is-resizing lifecycle.
    if (this.containerEl !== null) {
      this.resizeObserver = new ResizeObserver(() => this.handleResizeTick());
      this.resizeObserver.observe(this.containerEl);
    }
  }

  close(): void {
    console.debug('[RadiProtocol] InlineRunnerModal.close()');
    this.openedSuccessfully = false;

    // Unmount picker if active
    if (this.snippetTreePicker !== null) {
      this.snippetTreePicker.unmount();
      this.snippetTreePicker = null;
    }

    // Phase 59 INLINE-FIX-05: ensure fill-in modal is closed if inline closes first.
    // Single .close() call here — handleSnippetFill's finally does NOT call .close()
    // (modal self-closed when result resolved). This close() runs only when inline
    // closes BEFORE the modal resolves (orphan scenario).
    if (this.fillModal !== null) {
      this.fillModal.close();
      this.fillModal = null;
    }
    this.isFillModalOpen = false;

    // Unsubscribe event listeners
    if (this.activeFileEventRef !== null) {
      this.app.workspace.offref(this.activeFileEventRef);
      this.activeFileEventRef = null;
    }
    if (this.fileDeleteEventRef !== null) {
      this.app.vault.offref(this.fileDeleteEventRef);
      this.fileDeleteEventRef = null;
    }
    if (this.workspaceLayoutRef !== null) {
      this.app.workspace.offref(this.workspaceLayoutRef);
      this.workspaceLayoutRef = null;
    }
    if (this.resizeObserver !== null) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.windowResizeHandler !== null) {
      window.removeEventListener('resize', this.windowResizeHandler);
      this.windowResizeHandler = null;
    }
    // Phase 67: defensive resize-state cleanup (timer + .is-resizing class).
    if (this.resizeDebounceTimer !== null) {
      window.clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }
    if (this.containerEl !== null) {
      this.containerEl.removeClass('is-resizing');
    }
    this.isResizing = false;
    this.removeDragListeners();

    // Phase 85 INLINE-MULTI-01: unregister from the plugin's registry. Computed
    // BEFORE we null out canvasFilePath/containerEl so the key is still derivable.
    if (this.canvasFilePath !== null) {
      const key = `${this.canvasFilePath}#${this.targetNote.path}`;
      this.plugin.unregisterInlineRunner(key);
    }

    // Remove from DOM
    if (this.containerEl !== null) {
      this.containerEl.remove();
      this.containerEl = null;
    }

    this.headerEl = null;
    this.progressFillEl = null;
    this.progressTextEl = null;
    this.contentEl = null;
    this.actionsEl = null;
    this.footerBtnRowEl = null;
    this.graph = null;
  }

  // ── DOM Building ──────────────────────────────────────────────────────────

  private buildContainer(): void {
    const container = document.body.createDiv({ cls: 'rp-inline-runner-container' });
    this.containerEl = container;

    // Header — invisible drag handle only (close button moved to footer row)
    const header = container.createDiv({ cls: 'rp-inline-runner-header' });
    this.headerEl = header;
    this.enableDragging(header);

    // Content area — scrollable text (top half of modal)
    const content = container.createDiv({ cls: 'rp-inline-runner-content' });
    this.contentEl = content;

    // Actions zone — buttons anchored from top, scrollable if overflow (bottom half)
    const actions = container.createDiv({ cls: 'rp-inline-runner-actions' });
    this.actionsEl = actions;

    // Footer — close button (left) + progress bar + Back/Skip (right)
    const footer = container.createDiv({ cls: 'rp-inline-runner-footer' });
    const footerBtnRow = footer.createDiv({ cls: 'rp-inline-runner-footer-btn-row' });
    this.footerBtnRowEl = footerBtnRow;

    // Close button — left side of footer row (square, was in header)
    const closeBtn = footerBtnRow.createEl('button', { cls: 'rp-inline-runner-close-btn rp-runner-icon-btn' });
    setIcon(closeBtn, 'x');
    closeBtn.setAttribute('aria-label', 'Close protocol');
    closeBtn.addEventListener('click', () => {
      this.close();
    });

    // Progress bar — fills remaining space in footer row
    const progress = footerBtnRow.createDiv({ cls: 'rp-inline-runner-progress', attr: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' } });
    const progressTrack = progress.createDiv({ cls: 'rp-inline-runner-progress-track' });
    this.progressFillEl = progressTrack.createDiv({ cls: 'rp-inline-runner-progress-fill' });
    this.progressTextEl = progress.createDiv({ cls: 'rp-inline-runner-progress-text' });
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private calculateProgressPercent(state: RunnerState): number {
    if (this.graph === null) return 0;
    if (state.status === 'complete') return 100;
    if (state.status === 'idle' || state.status === 'error') return 0;

    const currentNodeId = state.status === 'at-node' ? state.currentNodeId : state.nodeId;
    const globalDistances = this.calculateShortestDistances(this.graph.startNodeId);
    const globalMaxDistance = Math.max(1, ...globalDistances.values());
    const sessionStartNodeId = this.startNodeId ?? this.graph.startNodeId;
    const baselineDistance = globalDistances.get(sessionStartNodeId) ?? 0;
    const baselinePercent = Math.round((baselineDistance / globalMaxDistance) * 99);

    const sessionDistances = this.calculateShortestDistances(sessionStartNodeId);
    const currentSessionDistance = sessionDistances.get(currentNodeId);
    if (currentSessionDistance === undefined) return Math.min(99, Math.max(0, baselinePercent));

    const sessionMaxDistance = Math.max(1, ...sessionDistances.values());
    const remainingPercent = 99 - baselinePercent;
    const sessionPercent = Math.round((currentSessionDistance / sessionMaxDistance) * remainingPercent);
    return Math.min(99, Math.max(0, baselinePercent + sessionPercent));
  }

  private calculateShortestDistances(startNodeId: string): Map<string, number> {
    const distances = new Map<string, number>();
    if (this.graph === null) return distances;

    const queue: string[] = [startNodeId];
    distances.set(startNodeId, 0);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      const currentDistance = distances.get(current) ?? 0;
      for (const next of this.graph.adjacency.get(current) ?? []) {
        if (distances.has(next)) continue;
        distances.set(next, currentDistance + 1);
        queue.push(next);
      }
    }

    return distances;
  }

  private updateProgress(state: RunnerState): void {
    if (this.progressFillEl === null || this.progressTextEl === null) return;
    const percent = this.calculateProgressPercent(state);
    this.progressFillEl.style.width = `${percent}%`;
    this.progressTextEl.setText(`${percent}%`);
    const progressEl = this.containerEl?.querySelector('.rp-inline-runner-progress');
    progressEl?.setAttribute('aria-valuenow', String(percent));
    progressEl?.setAttribute('aria-label', `Protocol progress ${percent}%`);
  }

  private render(): void {
    if (this.contentEl === null) return;

    // Unmount picker if state has left awaiting-snippet-pick
    const state = this.runner.getState();
    this.updateProgress(state);
    if (this.snippetTreePicker !== null && state.status !== 'awaiting-snippet-pick') {
      this.snippetTreePicker.unmount();
      this.snippetTreePicker = null;
    }

    this.contentEl.empty();
    if (this.actionsEl !== null) this.actionsEl.empty();

    // Recreate footer-row children (close btn destroyed by empty, must re-add)
    if (this.footerBtnRowEl !== null) {
      this.footerBtnRowEl.empty();
      // Close button — always present on the left
      const closeBtn = this.footerBtnRowEl.createEl('button', { cls: 'rp-inline-runner-close-btn rp-runner-icon-btn' });
      setIcon(closeBtn, 'x');
      closeBtn.setAttribute('aria-label', 'Close protocol');
      closeBtn.addEventListener('click', () => {
        this.close();
      });
    }

    switch (state.status) {
      case 'idle': {
        this.contentEl.createEl('p', {
          text: 'Starting protocol…',
          cls: CSS_CLASS.EMPTY_STATE_BODY,
        });
        break;
      }

      case 'at-node': {
        const result = renderQuestionAtNode(
          this.contentEl,
          this.actionsEl!,
          this.graph,
          state,
          {
            bindClick: (el, handler) => el.addEventListener('click', handler),
            renderError: (messages) => this.renderError(this.contentEl!, messages),
            onChooseAnswer: (answerNode) => this.handleAnswerClick(answerNode),
            onChooseSnippetBranch: (snippetNode, isFileBound) => {
              if (isFileBound) {
                const snippetPath = snippetNode.radiprotocol_snippetPath as string;
                this.runner.pickFileBoundSnippet(state.currentNodeId, snippetNode.id, snippetPath);
              } else {
                this.runner.chooseSnippetBranch(snippetNode.id);
              }
              this.render();
            },
          },
        );
        if (result === 'error') return;
        if (result === 'not-question') {
          this.contentEl.createEl('p', {
            text: 'Processing...',
            cls: CSS_CLASS.EMPTY_STATE_BODY,
          });
        }

        // Footer icon buttons: Back + Skip (only when question has answers)
        if (this.footerBtnRowEl !== null && this.graph !== null) {
          const node = this.graph.nodes.get(state.currentNodeId);
          if (node !== undefined && node.kind === 'question') {
            const neighborIds = this.graph.adjacency.get(state.currentNodeId) ?? [];
            const hasAnswers = neighborIds.some(
              (nid) => this.graph!.nodes.get(nid)?.kind === 'answer',
            );
            this.renderFooterIcons(state.canStepBack, hasAnswers && typeof this.runner.skip === 'function');
          }
        }
        break;
      }

      case 'awaiting-snippet-pick': {
        this.contentEl.createEl('p', {
          text: 'Loading snippets...',
          cls: CSS_CLASS.EMPTY_STATE_BODY,
        });
        void this.mountSnippetPicker(state, this.contentEl);
        break;
      }

      case 'awaiting-loop-pick': {
        const rendered = renderLoopPicker(
          this.contentEl,
          this.actionsEl!,
          this.graph,
          state,
          {
            bindClick: (el, handler) => el.addEventListener('click', handler),
            renderError: (messages) => this.renderError(this.contentEl!, messages),
            onChooseLoopBranch: (edge, isExit) => this.handleLoopBranchClick(edge, isExit),
          },
        );
        if (!rendered) return;

        // Footer icon buttons: Back only (no Skip in loop picker)
        if (this.footerBtnRowEl !== null) {
          this.renderFooterIcons(state.canStepBack, false);
        }
        break;
      }

      case 'awaiting-snippet-fill': {
        renderSnippetFillLoading(this.contentEl);
        void this.handleSnippetFill(state.snippetId, this.contentEl);
        break;
      }

      case 'complete': {
        if (!this.selfCheckEnabled) {
          const scheduleClose = typeof window !== 'undefined' ? window.setTimeout.bind(window) : globalThis.setTimeout;
          scheduleClose(() => this.close(), 0);
          break;
        }
        if (this.selfCheckItems.length === 0) {
          const scheduleClose = typeof window !== 'undefined' ? window.setTimeout.bind(window) : globalThis.setTimeout;
          scheduleClose(() => this.close(), 0);
          break;
        }
        this.renderSelfCheckCompletion(this.contentEl);
        break;
      }

      case 'error': {
        this.renderError(this.contentEl, [state.message]);
        break;
      }

      default: {
        const _exhaustive: never = state;
        void _exhaustive;
        break;
      }
    }
  }

  /** Render Back/Skip icon buttons into the footer row (after close btn). */
  private renderFooterIcons(showBack: boolean, showSkip: boolean): void {
    if (this.footerBtnRowEl === null) return;
    if (!showBack && !showSkip) return;

    // Container for Back+Skip, pushed right via justify-content: flex-end
    const iconsGroup = this.footerBtnRowEl.createDiv({ cls: 'rp-runner-footer-row' });
    if (showBack) {
      const backBtn = createButton(iconsGroup, {
        cls: 'rp-step-back-btn rp-runner-icon-btn',
        attr: { 'aria-label': 'Go back one step' },
      });
      setIcon(backBtn, 'arrow-left');
      // Phase 66 D-01/D-02/D-03: visual half of double-click guard
      backBtn.addEventListener('click', () => {
        backBtn.disabled = true;
        this.runner.stepBack();
        this.render();
      });
    }
    if (showSkip) {
      const skipBtn = createButton(iconsGroup, {
        cls: 'rp-skip-btn rp-runner-icon-btn',
        attr: { 'aria-label': 'Skip this question' },
      });
      setIcon(skipBtn, 'skip-forward');
      skipBtn.addEventListener('click', () => {
        this.runner.skip();
        this.render();
      });
    }
  }

  private renderSelfCheckCompletion(container: HTMLElement): void {
    renderCompleteHeading(container);
    const checklist = container.createDiv({ cls: 'rp-inline-runner-self-check' });
    checklist.createEl('h4', { text: this.plugin.i18n.t('selfCheck.title') });
    const checked = new Set<number>();
    const updateCompletion = () => {
      if (checked.size === this.selfCheckItems.length) this.close();
    };
    this.selfCheckItems.forEach((item, index) => {
      const label = checklist.createEl('label', { cls: 'rp-inline-runner-self-check-item' });
      const checkbox = label.createEl('input', { type: 'checkbox' });
      label.createSpan({ text: item });
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) checked.add(index);
        else checked.delete(index);
        updateCompletion();
      });
    });
  }

  // ── Event Handlers ────────────────────────────────────────────────────────

  /** D1: freeze/resume — hide modal when active note is not the target note. */
  private handleActiveLeafChange(): void {
    if (this.containerEl === null) return;

    // Phase 59 INLINE-FIX-05 / Pitfall 3: while SnippetFillInModal is open, focus
    // may transition to the stacked modal and fire active-leaf-change. Skipping the
    // D1 hide/show logic here keeps the inline container visible under the modal
    // so the user sees context while filling placeholders, and avoids a hide→show
    // flicker when the modal closes.
    if (this.isFillModalOpen) return;

    const activeFile = this.app.workspace.getActiveFile();
    const isTargetActive = activeFile !== null && activeFile.path === this.targetNote.path;

    // Check if target note has any open leaves by iterating all leaves
    let targetHasOpenLeaves = false;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if ('file' in view && view.file instanceof TFile) {
        if (view.file.path === this.targetNote.path) {
          targetHasOpenLeaves = true;
        }
      }
    });

    if (!targetHasOpenLeaves) {
      // D2: target note tab closed — end the run
      this.close();
      return;
    }

    if (isTargetActive) {
      if (this.isHidden) {
        this.containerEl.removeClass('is-hidden');
        this.isHidden = false;
      }
    } else {
      if (!this.isHidden) {
        this.containerEl.addClass('is-hidden');
        this.isHidden = true;
      }
    }
  }

  /** D2: target note was deleted — close the modal. */
  private handleTargetNoteDeleted(): void {
    console.debug('[RadiProtocol] InlineRunnerModal: target note deleted, closing');
    this.close();
  }

  private getViewport(): InlineRunnerViewport {
    return {
      width: Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0),
      height: Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0),
    };
  }

  private getContainerSize(): InlineRunnerSize {
    const rect = this.containerEl?.getBoundingClientRect();
    return {
      width: Math.max(INLINE_RUNNER_DEFAULT_WIDTH, rect?.width ?? 0),
      height: Math.max(INLINE_RUNNER_DEFAULT_HEIGHT, rect?.height ?? 0),
    };
  }

  private getDefaultPosition(): InlineRunnerLayout {
    const viewport = this.getViewport();
    const size = this.getContainerSize();
    return {
      left: Math.max(INLINE_RUNNER_DEFAULT_MARGIN, viewport.width - size.width - INLINE_RUNNER_DEFAULT_MARGIN),
      top: Math.max(INLINE_RUNNER_DEFAULT_MARGIN, viewport.height - size.height - INLINE_RUNNER_DEFAULT_MARGIN),
    };
  }

  private applyPosition(position: InlineRunnerLayout): void {
    if (this.containerEl === null) return;
    this.containerEl.style.left = `${Math.round(position.left)}px`;
    this.containerEl.style.top = `${Math.round(position.top)}px`;
    // Phase 67: do NOT clear style.width — the modal is resizable and width must persist across drags
    // this.containerEl.style.width = '';
    this.containerEl.toggleClass('rp-inline-runner-applied-position', true);
  }

  /** Phase 67 D-10: applyPosition + size. Missing width/height ⇒ default fallback. */
  private applyLayout(layout: InlineRunnerLayout): void {
    if (this.containerEl === null) return;
    this.applyPosition({ left: layout.left, top: layout.top });
    const width = (typeof layout.width === 'number' && Number.isFinite(layout.width) && layout.width > 0)
      ? layout.width : INLINE_RUNNER_DEFAULT_WIDTH;
    const height = (typeof layout.height === 'number' && Number.isFinite(layout.height) && layout.height > 0)
      ? layout.height : INLINE_RUNNER_DEFAULT_HEIGHT;
    this.containerEl.style.width = `${Math.round(width)}px`;
    this.containerEl.style.height = `${Math.round(height)}px`;
  }

  /** Phase 67 D-06/D-10: restore saved layout (clamped) or apply default. */
  private restoreOrDefaultPosition(): void {
    const saved = this.plugin.getInlineRunnerPosition();
    const viewport = this.getViewport();
    const restored = clampInlineRunnerLayout(saved, viewport);
    if (restored !== null) {
      this.applyLayout(restored);
      return;
    }
    const defaultLayout: InlineRunnerLayout = {
      ...this.getDefaultPosition(),
      width: INLINE_RUNNER_DEFAULT_WIDTH,
      height: INLINE_RUNNER_DEFAULT_HEIGHT,
    };
    const clamped = clampInlineRunnerLayout(defaultLayout, viewport)
      ?? { left: INLINE_RUNNER_DEFAULT_MARGIN, top: INLINE_RUNNER_DEFAULT_MARGIN, width: INLINE_RUNNER_DEFAULT_WIDTH, height: INLINE_RUNNER_DEFAULT_HEIGHT };
    this.applyLayout(clamped);
  }

  /** Phase 85 INLINE-MULTI-02: cascade-or-default position decision.
   *  When opened with no other open inline runners, restores the saved
   *  position (or falls back to the default). When opened while at least one
   *  other inline runner is already open, offsets +24/+24 from the most
   *  recently opened instance, clamped to the viewport, and applies default
   *  width/height — without persisting the cascade position to settings
   *  (the saved global default belongs to drag/resize gestures only). */
  private applyInitialLayout(): void {
    const others = this.plugin.getOpenInlineRunners();
    if (others.length === 0) {
      this.restoreOrDefaultPosition();
      return;
    }
    const last = others[others.length - 1]!;
    const lastLayout = last.getAppliedLayout();
    if (lastLayout === null) {
      this.restoreOrDefaultPosition();
      return;
    }
    const viewport = this.getViewport();
    const containerSize = this.getContainerSize();
    const next = clampInlineRunnerPosition(
      { left: lastLayout.left + 24, top: lastLayout.top + 24 },
      viewport,
      containerSize,
    );
    if (next === null) {
      this.restoreOrDefaultPosition();
      return;
    }
    this.applyPosition(next);
    if (this.containerEl !== null) {
      this.containerEl.style.width = `${INLINE_RUNNER_DEFAULT_WIDTH}px`;
      this.containerEl.style.height = `${INLINE_RUNNER_DEFAULT_HEIGHT}px`;
    }
  }

  /** Phase 85 INLINE-MULTI-02: public so the cascade logic in another modal's
   *  open() can read this instance's current applied position. */
  getAppliedLayout(): InlineRunnerLayout | null {
    if (this.containerEl === null) return null;
    const left = Number.parseFloat(this.containerEl.style.left);
    const top = Number.parseFloat(this.containerEl.style.top);
    if (!isFiniteInlineRunnerPosition({ left, top })) return null;
    const width = Number.parseFloat(this.containerEl.style.width);
    const height = Number.parseFloat(this.containerEl.style.height);
    return {
      left,
      top,
      width: Number.isFinite(width) && width > 0 ? width : INLINE_RUNNER_DEFAULT_WIDTH,
      height: Number.isFinite(height) && height > 0 ? height : INLINE_RUNNER_DEFAULT_HEIGHT,
    };
  }

  /** Phase 67 D-11: re-clamp position AND size on viewport change; persist if anything changed. */
  private async reclampCurrentPosition(persistIfChanged: boolean): Promise<void> {
    if (this.containerEl === null) return;
    if (this.containerEl.hasClass('is-hidden')) return;
    const currentPosition = this.getAppliedLayout() ?? this.plugin.getInlineRunnerPosition() ?? this.getDefaultPosition();
    const saved = this.plugin.getInlineRunnerPosition();
    const styleWidth = Number.parseFloat(this.containerEl.style.width);
    const styleHeight = Number.parseFloat(this.containerEl.style.height);
    const current: InlineRunnerLayout = {
      left: currentPosition.left,
      top: currentPosition.top,
      width: Number.isFinite(styleWidth) && styleWidth > 0 ? styleWidth : (saved?.width ?? INLINE_RUNNER_DEFAULT_WIDTH),
      height: Number.isFinite(styleHeight) && styleHeight > 0 ? styleHeight : (saved?.height ?? INLINE_RUNNER_DEFAULT_HEIGHT),
    };
    const clamped = clampInlineRunnerLayout(current, this.getViewport());
    if (clamped === null) return;
    this.applyLayout(clamped);
    const positionChanged = clamped.left !== current.left || clamped.top !== current.top;
    const sizeChanged = clamped.width !== current.width || clamped.height !== current.height;
    if (persistIfChanged && (positionChanged || sizeChanged)) {
      await this.plugin.saveInlineRunnerPosition(clamped);
    }
  }

  private enableDragging(header: HTMLElement): void {
    header.addEventListener('pointerdown', (event: PointerEvent) => {
      if (this.containerEl === null) return;
      const start = this.getAppliedLayout() ?? this.getDefaultPosition();
      const startX = event.clientX;
      const startY = event.clientY;
      this.isDragging = true;
      this.containerEl.addClass('is-dragging');

      this.dragMoveHandler = (moveEvent: PointerEvent) => {
        const next = clampInlineRunnerPosition(
          { left: start.left + moveEvent.clientX - startX, top: start.top + moveEvent.clientY - startY },
          this.getViewport(),
          this.getContainerSize(),
        );
        if (next !== null) this.applyPosition(next);
      };

      this.dragUpHandler = () => {
        const finalLayout = this.getAppliedLayout();
        this.removeDragListeners();
        if (finalLayout !== null) {
          void this.plugin.saveInlineRunnerPosition(finalLayout);
        }
      };

      document.addEventListener('pointermove', this.dragMoveHandler);
      document.addEventListener('pointerup', this.dragUpHandler);
    });
  }

  private removeDragListeners(): void {
    if (this.dragMoveHandler !== null) {
      document.removeEventListener('pointermove', this.dragMoveHandler);
      this.dragMoveHandler = null;
    }
    if (this.dragUpHandler !== null) {
      document.removeEventListener('pointerup', this.dragUpHandler);
      this.dragUpHandler = null;
    }
    if (this.containerEl !== null) {
      this.containerEl.removeClass('is-dragging');
    }
    this.isDragging = false;
  }

  /** Phase 67 D-04: ResizeObserver tick handler — toggles .is-resizing class and resets the debounce timer.
   *  Saves only on debounce expiry (D-07). Native CSS `resize: both` owns pointer events (D-01). */
  private handleResizeTick(): void {
    if (this.containerEl === null) return;
    if (!this.isResizing) {
      this.isResizing = true;
      this.containerEl.addClass('is-resizing');
    }
    if (this.resizeDebounceTimer !== null) {
      window.clearTimeout(this.resizeDebounceTimer);
    }
    this.resizeDebounceTimer = window.setTimeout(() => this.handleResizeDebounceExpire(), 400);
  }

  /** Phase 67 D-07: debounce expiry — read final size, clamp, persist once, clear .is-resizing. */
  private handleResizeDebounceExpire(): void {
    this.resizeDebounceTimer = null;
    if (this.containerEl === null) return;
    const appliedLayout = this.getAppliedLayout() ?? this.getDefaultPosition();
    const layout: InlineRunnerLayout = {
      left: appliedLayout.left,
      top: appliedLayout.top,
      width: appliedLayout.width,
      height: appliedLayout.height,
    };
    const clamped = clampInlineRunnerLayout(layout, this.getViewport());
    if (clamped !== null) {
      void this.plugin.saveInlineRunnerPosition(clamped);
    }
    this.containerEl.removeClass('is-resizing');
    this.isResizing = false;
  }

  /** Phase 60 compatibility shim: layout events now clamp, not note-width-anchor. */
  private updateModalPosition(): void {
    void this.reclampCurrentPosition(true);
  }

  /** Resolve the textSeparator enum to its actual string value. */
  private resolveSeparator(): string {
    const sep = this.plugin.settings.textSeparator;
    return sep === 'newline' ? '\n' : ' ';
  }

  /** Handle answer button click — append answer to note and advance. */
  private async handleAnswerClick(answerNode: AnswerNode): Promise<void> {
    const stateBefore = this.runner.getState();
    const beforeText = this.extractAccumulatedText(stateBefore);

    this.runner.chooseAnswer(answerNode.id);

    const stateAfter = this.runner.getState();
    const afterText = this.extractAccumulatedText(stateAfter);

    if (afterText.length > beforeText.length) {
      // WR-01: defensive check — text should only grow (append-only invariant)
      if (!afterText.startsWith(beforeText)) {
        console.warn('[RadiProtocol] Text changed non-monotonically, skipping append');
        this.render();
        return;
      }
      const appendedText = afterText.slice(beforeText.length);
      await this.appendAnswerToNote(appendedText);
    }

    this.render();
  }

  /** Append text to the end of the target note. The delta already contains
   *  separators from the accumulator, but Obsidian adds a trailing newline
   *  to files on save. If the note already ends with the separator char and
   *  the delta starts with it, strip the leading separator from the delta
   *  to avoid duplication.
   *  CR-02: Protected by insertMutex to prevent read-modify-write races
   *  with concurrent vault.modify calls (e.g., user edits, other plugins). */
  private async appendAnswerToNote(text: string): Promise<void> {
    await this.plugin['insertMutex'].runExclusive(this.targetNote.path, async () => {
      const currentContent = await this.app.vault.read(this.targetNote);
      let toAppend = text;
      const sep = this.resolveSeparator();
      if (currentContent.endsWith(sep) && text.startsWith(sep)) {
        toAppend = text.slice(sep.length);
      }
      const newContent = currentContent + toAppend;
      await this.app.vault.modify(this.targetNote, newContent);
    });
  }

  /**
   * Phase 59 INLINE-FIX-04 — Accumulator-diff helper for snippet insert paths.
   *
   * Mirrors {@link handleAnswerClick}'s diff logic so snippet dispatch
   * sites can append the separator-applied delta (not raw snippet content) to the note.
   *
   * Contract: caller captures `beforeText` BEFORE calling `runner.completeSnippet(...)`.
   * After completeSnippet mutates the accumulator (applying the per-node or global
   * separator), this helper reads `afterText`, computes the delta, and pipes it through
   * the same `appendAnswerToNote` sink that the answer path uses — preserving the
   * `TextAccumulator.appendWithSeparator` first-chunk invariant.
   *
   * Non-monotonic accumulator growth (afterText does not start with beforeText) is
   * treated as a bug and logged via console.warn, mirroring WR-01 in handleAnswerClick.
   */
  private async appendDeltaFromAccumulator(beforeText: string): Promise<void> {
    const afterText = this.extractAccumulatedText(this.runner.getState());
    if (afterText.length <= beforeText.length) return;
    if (!afterText.startsWith(beforeText)) {
      console.warn('[RadiProtocol] Text changed non-monotonically, skipping append');
      return;
    }
    await this.appendAnswerToNote(afterText.slice(beforeText.length));
  }

  /** Handle loop branch click — append any traversed answer text to note. */
  private async handleLoopBranchClick(edge: import('../graph/graph-model').RPEdge, _isExit: boolean): Promise<void> {
    void _isExit;
    // Capture accumulated text before the branch choice
    const stateBefore = this.runner.getState();
    const beforeText = stateBefore.status === 'awaiting-loop-pick'
      ? stateBefore.accumulatedText
      : '';

    this.runner.chooseLoopBranch(edge.id);

    // After chooseLoopBranch, the runner may have advanced through answer/text-block nodes.
    // Capture the new accumulated text — the delta is what was appended by advanceThrough.
    const stateAfter = this.runner.getState();
    let afterText = '';
    if (stateAfter.status === 'at-node') {
      afterText = stateAfter.accumulatedText;
    } else if (stateAfter.status === 'awaiting-loop-pick') {
      afterText = stateAfter.accumulatedText;
    } else if (stateAfter.status === 'complete') {
      afterText = stateAfter.finalText;
    } else if (stateAfter.status === 'awaiting-snippet-pick') {
      afterText = stateAfter.accumulatedText;
    } else if (stateAfter.status === 'awaiting-snippet-fill') {
      afterText = stateAfter.accumulatedText;
    } else {
      // WR-02: unexpected state — preserve baseline to avoid spurious append
      console.warn('[RadiProtocol] Unexpected state after loop branch:', stateAfter.status);
      afterText = beforeText;
    }

    if (afterText.length > beforeText.length) {
      const appendedText = afterText.slice(beforeText.length);
      await this.appendAnswerToNote(appendedText);
    }

    this.render();
  }

  /** Extract accumulated text from any runner state. */
  private extractAccumulatedText(state: ReturnType<typeof this.runner.getState>): string {
    switch (state.status) {
      case 'at-node':
      case 'awaiting-loop-pick':
      case 'awaiting-snippet-pick':
      case 'awaiting-snippet-fill':
        return state.accumulatedText;
      case 'complete':
        return state.finalText;
      default:
        return '';
    }
  }



  /** Render snippet picker inline (Phase 51 D-06 pattern). */
  private async mountSnippetPicker(
    state: {
      status: 'awaiting-snippet-pick';
      nodeId: string;
      subfolderPath: string | undefined;
      accumulatedText: string;
      canStepBack: boolean;
    },
    questionZone: HTMLElement,
  ): Promise<void> {
    if (this.snippetTreePicker !== null) {
      this.snippetTreePicker.unmount();
      this.snippetTreePicker = null;
    }

    this.snippetTreePicker = renderSnippetPicker(questionZone, state, {
      app: this.app,
      snippetService: this.plugin.snippetService,
      rootPath: this.plugin.settings.snippetFolderPath,
      hostClass: CSS_CLASS.STP_INLINE_HOST,
      copy: {
        notFound: (relativePath) => `Snippet not found: ${relativePath}`,
        validationError: (snippetPath, validationMessage) =>
          `Snippet "${snippetPath}" cannot be used. ${validationMessage}`,
      },
      bindClick: (el, handler) => el.addEventListener('click', handler),
      getCurrentNodeId: () => {
        const s = this.runner.getState();
        return s.status === 'awaiting-snippet-pick' ? s.nodeId : null;
      },
      // CR-01: detached-DOM guard for inline modal closures.
      isStillMounted: () =>
        this.containerEl !== null && document.body.contains(this.containerEl),
      // Inline modal re-renders before showing the error so the new picker
      // takes a fresh DOM, then writes the error into the fresh question zone.
      presentAsyncError: (message) => {
        this.render();
        const freshZone = this.contentEl?.querySelector('.rp-question-zone');
        if (freshZone) {
          freshZone.empty();
          (freshZone as HTMLElement).createEl('p', {
            cls: CSS_CLASS.EMPTY_STATE_BODY,
            text: message,
          });
        }
      },
      onSnippetReady: (snippet) => this.handleSnippetPickerSelection(snippet),
      onBack: () => {
        if (this.snippetTreePicker !== null) {
          this.snippetTreePicker.unmount();
          this.snippetTreePicker = null;
        }
        this.runner.stepBack();
        this.render();
      },
    });
  }

  /** Handle snippet picker selection — append to note and advance. */
  private async handleSnippetPickerSelection(snippet: import('../snippets/snippet-model').Snippet): Promise<void> {
    if (snippet.kind === 'json' && snippet.validationError !== null) {
      new Notice(`Snippet "${snippet.path}" cannot be used. ${snippet.validationError}`);
      return;
    }

    const pickId = snippet.kind === 'md' ? snippet.path : (snippet.id ?? snippet.name);
    this.runner.pickSnippet(pickId);

    if (snippet.kind === 'md') {
      // Phase 59 INLINE-FIX-04: capture baseline BEFORE completeSnippet so the
      // accumulator delta includes the resolved separator applied by
      // runner → TextAccumulator.appendWithSeparator. Raw snippet.content bypasses it.
      const beforeText = this.extractAccumulatedText(this.runner.getState());
      this.runner.completeSnippet(snippet.content);
      await this.appendDeltaFromAccumulator(beforeText);
      this.snippetTreePicker?.unmount();
      this.snippetTreePicker = null;
      this.render();
      return;
    }

    if (snippet.placeholders.length === 0) {
      // Phase 59 INLINE-FIX-04: same accumulator-diff pattern as MD arm above.
      const beforeText = this.extractAccumulatedText(this.runner.getState());
      this.runner.completeSnippet(snippet.template);
      await this.appendDeltaFromAccumulator(beforeText);
      this.snippetTreePicker?.unmount();
      this.snippetTreePicker = null;
      this.render();
      return;
    }

    // Snippet has placeholders — advance to awaiting-snippet-fill state
    this.render();
  }

  /**
   * Phase 59 INLINE-FIX-05 — Load snippet and dispatch fill-in modal (parity with sidebar).
   *
   * Reverses Phase 54 D6: instead of rendering an in-panel form via the old fill-in method,
   * this now instantiates the stacked SnippetFillInModal using the shared snippet-fill flow.
   * The modal mounts to document.body (via Obsidian Modal); the inline container stays
   * visible underneath (gated by isFillModalOpen in handleActiveLeafChange).
   */
  private async handleSnippetFill(snippetId: string, questionZone: HTMLElement): Promise<void> {
    const isPhase51FullPath = isFullSnippetPath(snippetId);
    const root = this.plugin.settings.snippetFolderPath;
    // WR-03: avoid double-prefixing when snippetId is already an absolute vault path
    const absPath = snippetId.startsWith(root + '/')
      ? snippetId
      : isPhase51FullPath
        ? `${root}/${snippetId}`
        : `${root}/${snippetId}.json`;

    let snippet = await this.plugin.snippetService.load(absPath);

    // Phase 59 INLINE-FIX-05: fallback scan for JSON snippets in subdirectories.
    // When a snippet was selected from a picker in a subdirectory, pickId is a
    // basename, so the direct path misses the subdirectory. Scan vault files
    // under the snippet root for a matching basename.
    if (snippet === null && !isPhase51FullPath) {
      const targetBasename = `${snippetId}.json`;
      const candidates = this.app.vault.getFiles().filter((f) => {
        if (!f.path.startsWith(root + '/')) return false;
        const parts = f.path.split('/');
        return parts[parts.length - 1]! === targetBasename;
      });
      if (candidates.length === 1) {
        snippet = await this.plugin.snippetService.load(candidates[0]!.path);
      }
    }

    if (snippet === null) {
      renderSnippetFillNotFound(questionZone, snippetId);
      return;
    }

    if (snippet.kind === 'json' && snippet.validationError !== null) {
      new Notice(`Snippet "${snippet.path}" cannot be used. ${snippet.validationError}`);
      this.runner.stepBack();
      this.render();
      return;
    }

    // Capture accumulator baseline before any runner mutation, for separator-applied delta.
    const beforeText = this.extractAccumulatedText(this.runner.getState());

    if (snippet.kind === 'md') {
      if (isPhase51FullPath) {
        this.runner.completeSnippet(snippet.content);
        await this.appendDeltaFromAccumulator(beforeText);
        this.render();
        return;
      }
      // Legacy path — MD snippet via non-full-path id; treat as not-found.
      renderSnippetFillNotFound(questionZone, snippetId);
      return;
    }

    if (snippet.placeholders.length === 0) {
      this.runner.completeSnippet(snippet.template);
      await this.appendDeltaFromAccumulator(beforeText);
      this.render();
      return;
    }

    // JSON with placeholders — open the stacked fill-in modal (parity with sidebar).
    // Phase 54 D6 is reversed: the in-panel fill-in form is gone.
    const modal = new SnippetFillInModal(this.app, snippet);
    this.fillModal = modal;
    this.isFillModalOpen = true;
    modal.open();
    let rendered: string | null;
    try {
      rendered = await modal.result;
    } finally {
      // Clear flags. DO NOT call modal.close() here — the modal self-closed when its
      // result promise resolved (submit/cancel/escape all trigger close + resolve inside
      // SnippetFillInModal). Double-closing would fire duplicate onClose handlers.
      this.isFillModalOpen = false;
      this.fillModal = null;
    }
    if (rendered !== null) {
      this.runner.completeSnippet(rendered);
    } else {
      // D-11 parity with sidebar: cancel/escape → completeSnippet('') advances runner.
      this.runner.completeSnippet('');
    }
    await this.appendDeltaFromAccumulator(beforeText);
    this.render();
  }

  /** Render error state. */
  private renderError(zone: HTMLElement, errors: string[]): void {
    zone.empty();
    const errorPanel = zone.createDiv({ cls: 'rp-error-panel' });
    renderErrorList(errorPanel, errors, { titleClass: CSS_CLASS.ERROR_TITLE });
  }
}
