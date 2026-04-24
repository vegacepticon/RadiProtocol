// views/inline-runner-modal.ts — Phase 54: Inline protocol display mode
// A floating, non-blocking DOM host for inline protocol runs over the active note.
// NOT an Obsidian Modal subclass — plain class managing its own DOM element.
import { App, TFile, TFolder, Notice, setIcon } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { ProtocolRunner } from '../runner/protocol-runner';
import { GraphValidator } from '../graph/graph-validator';
import type { ProtocolGraph, AnswerNode, SnippetNode } from '../graph/graph-model';
import { SnippetTreePicker } from './snippet-tree-picker';
import { isExitEdge, nodeLabel, stripExitPrefix } from '../graph/node-label';
import { renderSnippet, type JsonSnippet } from '../snippets/snippet-model';
import type { InlineRunnerPosition } from '../settings';

interface InlineRunnerViewport {
  width: number;
  height: number;
}

interface InlineRunnerSize {
  width: number;
  height: number;
}

const INLINE_RUNNER_DEFAULT_WIDTH = 360;
const INLINE_RUNNER_DEFAULT_HEIGHT = 240;
const INLINE_RUNNER_DEFAULT_MARGIN = 16;
const INLINE_RUNNER_MIN_VISIBLE_WIDTH = 160;
const INLINE_RUNNER_MIN_VISIBLE_HEADER_HEIGHT = 40;

function isFiniteInlineRunnerPosition(position: InlineRunnerPosition | null): position is InlineRunnerPosition {
  return position !== null && Number.isFinite(position.left) && Number.isFinite(position.top);
}

/** Phase 60 D-02: never let persisted coordinates place the draggable header fully off-screen. */
export function clampInlineRunnerPosition(
  position: InlineRunnerPosition | null,
  viewport: InlineRunnerViewport,
  size: InlineRunnerSize,
): InlineRunnerPosition | null {
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
  private contentEl: HTMLElement | null = null;

  private runner: ProtocolRunner;
  private readonly validator: GraphValidator;
  private graph: ProtocolGraph | null = null;
  private canvasFilePath: string | null = null;

  private activeFileEventRef: import('obsidian').EventRef | null = null;
  private fileDeleteEventRef: import('obsidian').EventRef | null = null;
  private isHidden = false;

  private snippetTreePicker: SnippetTreePicker | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private workspaceLayoutRef: import('obsidian').EventRef | null = null;
  private windowResizeHandler: (() => void) | null = null;
  private dragMoveHandler: ((event: PointerEvent) => void) | null = null;
  private dragUpHandler: ((event: PointerEvent) => void) | null = null;
  private isDragging = false;

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
    this.runner = new ProtocolRunner({
      defaultSeparator: this.plugin.settings.textSeparator,
    });
    this.validator = new GraphValidator({
      snippetFileProbe: (absPath) => this.app.vault.getAbstractFileByPath(absPath) !== null,
      snippetFolderPath: this.plugin.settings.snippetFolderPath,
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async open(): Promise<void> {
    console.debug('[RadiProtocol] InlineRunnerModal.open()', this.canvasFilePath);

    // Build DOM shell
    this.buildContainer();

    // Parse and validate canvas
    const file = this.app.vault.getAbstractFileByPath(this.canvasFilePath!);
    if (!(file instanceof TFile)) {
      new Notice(`Canvas file not found: "${this.canvasFilePath}".`);
      this.close();
      return;
    }

    let content: string;
    const liveJson = this.plugin.canvasLiveEditor.getCanvasJSON(this.canvasFilePath!);
    if (liveJson !== null) {
      content = liveJson;
    } else {
      try {
        content = await this.app.vault.read(file);
      } catch {
        new Notice(`Could not read canvas file: "${this.canvasFilePath}".`);
        this.close();
        return;
      }
    }

    const parseResult = this.plugin.canvasParser.parse(content, this.canvasFilePath!);
    if (!parseResult.success) {
      new Notice(parseResult.error);
      this.close();
      return;
    }

    const validationErrors = this.validator.validate(parseResult.graph);
    if (validationErrors.length > 0) {
      new Notice(validationErrors.join('\n'));
      this.close();
      return;
    }

    this.graph = parseResult.graph;
    this.runner.start(this.graph, this.startNodeId);
    this.render();

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

    // Phase 60: restore saved compact position or apply compact default.
    this.restoreOrDefaultPosition();

    // Re-clamp on layout changes without resetting to note-width anchoring.
    this.workspaceLayoutRef = this.app.workspace.on('layout-change', () => {
      void this.reclampCurrentPosition(true);
    });
    this.windowResizeHandler = () => {
      void this.reclampCurrentPosition(true);
    };
    window.addEventListener('resize', this.windowResizeHandler);
  }

  close(): void {
    console.debug('[RadiProtocol] InlineRunnerModal.close()');

    // Unmount picker if active
    if (this.snippetTreePicker !== null) {
      this.snippetTreePicker.unmount();
      this.snippetTreePicker = null;
    }

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
    this.removeDragListeners();

    // Remove from DOM
    if (this.containerEl !== null) {
      this.containerEl.remove();
      this.containerEl = null;
    }

    this.headerEl = null;
    this.contentEl = null;
    this.graph = null;
  }

  // ── DOM Building ──────────────────────────────────────────────────────────

  private buildContainer(): void {
    const container = document.body.createDiv({ cls: 'rp-inline-runner-container' });
    this.containerEl = container;

    // Header
    const header = container.createDiv({ cls: 'rp-inline-runner-header' });
    this.headerEl = header;
    this.enableDragging(header);

    const titleEl = header.createDiv({ cls: 'rp-inline-runner-header-title' });
    const canvasName = this.canvasFilePath!.replace(/\.canvas$/, '').split('/').pop() ?? 'Protocol';
    titleEl.setText(canvasName);

    const closeBtn = header.createEl('button', { cls: 'rp-inline-runner-close-btn' });
    setIcon(closeBtn, 'x');
    closeBtn.setAttribute('aria-label', 'Close protocol');
    closeBtn.title = 'Close protocol';
    closeBtn.addEventListener('click', () => {
      this.close();
    });

    // Content area
    const content = container.createDiv({ cls: 'rp-inline-runner-content' });
    this.contentEl = content;
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private render(): void {
    if (this.contentEl === null) return;

    // Unmount picker if state has left awaiting-snippet-pick
    const state = this.runner.getState();
    if (this.snippetTreePicker !== null && state.status !== 'awaiting-snippet-pick') {
      this.snippetTreePicker.unmount();
      this.snippetTreePicker = null;
    }

    this.contentEl.empty();

    const questionZone = this.contentEl.createDiv({ cls: 'rp-question-zone' });
    const outputToolbar = this.contentEl.createDiv({ cls: 'rp-output-toolbar' });

    switch (state.status) {
      case 'idle': {
        questionZone.createEl('p', {
          text: 'Starting protocol…',
          cls: 'rp-empty-state-body',
        });
        this.renderOutputToolbar(outputToolbar, null, false);
        break;
      }

      case 'at-node': {
        if (this.graph === null) {
          this.renderError(questionZone, ['Internal error: graph not loaded.']);
          return;
        }
        const node = this.graph.nodes.get(state.currentNodeId);
        if (node === undefined) {
          this.renderError(questionZone, [`Node "${state.currentNodeId}" not found in graph.`]);
          return;
        }

        switch (node.kind) {
          case 'question': {
            questionZone.createEl('p', {
              text: node.questionText,
              cls: 'rp-question-text',
            });

            const neighborIds = this.graph.adjacency.get(state.currentNodeId) ?? [];
            const answerNeighbors: AnswerNode[] = [];
            const snippetNeighbors: SnippetNode[] = [];
            for (const nid of neighborIds) {
              const n = this.graph.nodes.get(nid);
              if (n === undefined) continue;
              if (n.kind === 'answer') answerNeighbors.push(n);
              else if (n.kind === 'snippet') snippetNeighbors.push(n);
            }

            if (answerNeighbors.length > 0) {
              const answerList = questionZone.createDiv({ cls: 'rp-answer-list' });
              for (const answerNode of answerNeighbors) {
                const btn = answerList.createEl('button', {
                  cls: 'rp-answer-btn',
                  text: answerNode.displayLabel ?? answerNode.answerText,
                });
                btn.addEventListener('click', () => {
                  void this.handleAnswerClick(answerNode);
                });
              }
            }

            if (snippetNeighbors.length > 0) {
              const snippetList = questionZone.createDiv({ cls: 'rp-snippet-branch-list' });
              for (const snippetNode of snippetNeighbors) {
                const isFileBound =
                  typeof snippetNode.radiprotocol_snippetPath === 'string' &&
                  snippetNode.radiprotocol_snippetPath !== '';
                let label: string;
                if (isFileBound) {
                  const snippetPath = snippetNode.radiprotocol_snippetPath as string;
                  if (snippetNode.snippetLabel !== undefined && snippetNode.snippetLabel.length > 0) {
                    label = `\uD83D\uDCC4 ${snippetNode.snippetLabel}`;
                  } else {
                    const lastSlash = snippetPath.lastIndexOf('/');
                    const basename = lastSlash >= 0 ? snippetPath.slice(lastSlash + 1) : snippetPath;
                    const dot = basename.lastIndexOf('.');
                    const stem = dot > 0 ? basename.slice(0, dot) : basename;
                    label = stem.length > 0 ? `\uD83D\uDCC4 ${stem}` : '\uD83D\uDCC4 Snippet';
                  }
                } else {
                  label = (snippetNode.snippetLabel !== undefined && snippetNode.snippetLabel.length > 0)
                    ? `\uD83D\uDCC1 ${snippetNode.snippetLabel}`
                    : '\uD83D\uDCC1 Snippet';
                }
                const btn = snippetList.createEl('button', {
                  cls: 'rp-snippet-branch-btn',
                  text: label,
                });
                btn.addEventListener('click', () => {
                  if (isFileBound) {
                    const snippetPath = snippetNode.radiprotocol_snippetPath as string;
                    this.runner.pickFileBoundSnippet(state.currentNodeId, snippetNode.id, snippetPath);
                  } else {
                    this.runner.chooseSnippetBranch(snippetNode.id);
                  }
                  this.render();
                });
              }
            }

            // Skip button (Phase 53 parity)
            if (answerNeighbors.length > 0 && typeof this.runner.skip === 'function') {
              const skipBtn = questionZone.createEl('button', { cls: 'rp-skip-btn' });
              setIcon(skipBtn, 'skip-forward');
              skipBtn.setAttribute('aria-label', 'Skip this question');
              skipBtn.title = 'Skip this question';
              skipBtn.addEventListener('click', () => {
                this.runner.skip();
                this.render();
              });
            }
            break;
          }

          default: {
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
          stepBackBtn.addEventListener('click', () => {
            this.runner.stepBack();
            this.render();
          });
        }

        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);
        break;
      }

      case 'awaiting-snippet-pick': {
        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);

        questionZone.createEl('p', {
          text: 'Loading snippets...',
          cls: 'rp-empty-state-body',
        });
        void this.renderSnippetPicker(state, questionZone);
        break;
      }

      case 'awaiting-loop-pick': {
        if (this.graph === null) {
          this.renderError(questionZone, ['Internal error: graph not loaded.']);
          return;
        }
        const node = this.graph.nodes.get(state.nodeId);
        if (node === undefined || node.kind !== 'loop') {
          this.renderError(questionZone, [`Loop node "${state.nodeId}" not found in graph.`]);
          return;
        }

        if (node.headerText !== '') {
          questionZone.createEl('p', {
            text: node.headerText,
            cls: 'rp-loop-header-text',
          });
        }

        const outgoing = this.graph.edges.filter(e => e.fromNodeId === state.nodeId);
        const list = questionZone.createDiv({ cls: 'rp-loop-picker-list' });
        for (const edge of outgoing) {
          const exit = isExitEdge(edge);
          let caption: string;
          if (exit) {
            caption = stripExitPrefix(edge.label ?? '');
          } else {
            const target = this.graph.nodes.get(edge.toNodeId);
            caption = target !== undefined ? nodeLabel(target) : edge.toNodeId;
          }
          const btn = list.createEl('button', {
            cls: exit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn',
            text: caption,
          });
          btn.addEventListener('click', () => {
            void this.handleLoopBranchClick(edge, exit);
          });
        }

        if (state.canStepBack) {
          const stepBackBtn = questionZone.createEl('button', {
            cls: 'rp-step-back-btn',
            text: 'Step back',
          });
          stepBackBtn.addEventListener('click', () => {
            this.runner.stepBack();
            this.render();
          });
        }

        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);
        break;
      }

      case 'awaiting-snippet-fill': {
        questionZone.createEl('p', {
          text: 'Loading snippet...',
          cls: 'rp-empty-state-body',
        });
        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);
        void this.handleSnippetFill(state.snippetId, questionZone);
        break;
      }

      case 'complete': {
        questionZone.createEl('h2', { text: 'Protocol complete', cls: 'rp-complete-heading' });
        this.renderOutputToolbar(outputToolbar, state.finalText, true);
        break;
      }

      case 'error': {
        this.renderError(questionZone, [state.message]);
        break;
      }

      default: {
        const _exhaustive: never = state;
        void _exhaustive;
        break;
      }
    }
  }

  // ── Event Handlers ────────────────────────────────────────────────────────

  /** D1: freeze/resume — hide modal when active note is not the target note. */
  private handleActiveLeafChange(): void {
    if (this.containerEl === null) return;

    const activeFile = this.app.workspace.getActiveFile();
    const isTargetActive = activeFile !== null && activeFile.path === this.targetNote.path;

    // Check if target note has any open leaves by iterating all leaves
    let targetHasOpenLeaves = false;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if ('file' in view && view.file instanceof TFile) {
        if ((view.file as TFile).path === this.targetNote.path) {
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

  private getDefaultPosition(): InlineRunnerPosition {
    const viewport = this.getViewport();
    const size = this.getContainerSize();
    return {
      left: Math.max(INLINE_RUNNER_DEFAULT_MARGIN, viewport.width - size.width - INLINE_RUNNER_DEFAULT_MARGIN),
      top: Math.max(INLINE_RUNNER_DEFAULT_MARGIN, viewport.height - size.height - INLINE_RUNNER_DEFAULT_MARGIN),
    };
  }

  private applyPosition(position: InlineRunnerPosition): void {
    if (this.containerEl === null) return;
    this.containerEl.style.left = `${Math.round(position.left)}px`;
    this.containerEl.style.top = `${Math.round(position.top)}px`;
    this.containerEl.style.right = '';
    this.containerEl.style.bottom = '';
    this.containerEl.style.width = '';
    this.containerEl.style.maxWidth = '';
    this.containerEl.style.transform = '';
  }

  private restoreOrDefaultPosition(): void {
    const saved = this.plugin.getInlineRunnerPosition();
    const viewport = this.getViewport();
    const size = this.getContainerSize();
    const restored = clampInlineRunnerPosition(saved, viewport, size);
    const position = restored ?? clampInlineRunnerPosition(this.getDefaultPosition(), viewport, size) ?? { left: INLINE_RUNNER_DEFAULT_MARGIN, top: INLINE_RUNNER_DEFAULT_MARGIN };
    this.applyPosition(position);
  }

  private getAppliedPosition(): InlineRunnerPosition | null {
    if (this.containerEl === null) return null;
    const left = Number.parseFloat(this.containerEl.style.left);
    const top = Number.parseFloat(this.containerEl.style.top);
    return isFiniteInlineRunnerPosition({ left, top }) ? { left, top } : null;
  }

  private async reclampCurrentPosition(persistIfChanged: boolean): Promise<void> {
    const current = this.getAppliedPosition() ?? this.plugin.getInlineRunnerPosition() ?? this.getDefaultPosition();
    const clamped = clampInlineRunnerPosition(current, this.getViewport(), this.getContainerSize());
    if (clamped === null) return;
    this.applyPosition(clamped);
    if (persistIfChanged && (clamped.left !== current.left || clamped.top !== current.top)) {
      await this.plugin.saveInlineRunnerPosition(clamped);
    }
  }

  private enableDragging(header: HTMLElement): void {
    header.addEventListener('pointerdown', (event: PointerEvent) => {
      if (this.containerEl === null) return;
      const start = this.getAppliedPosition() ?? this.getDefaultPosition();
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
        const finalPosition = this.getAppliedPosition();
        this.removeDragListeners();
        if (finalPosition !== null) {
          void this.plugin.saveInlineRunnerPosition(finalPosition);
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

  /** Handle loop branch click — append any traversed answer text to note. */
  private async handleLoopBranchClick(edge: import('../graph/graph-model').RPEdge, isExit: boolean): Promise<void> {
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

  // ── Sub-renders ───────────────────────────────────────────────────────────

  /** Render the output toolbar for complete state. */
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

    if (!enabled || text === null) {
      copyBtn.disabled = true;
      saveBtn.disabled = true;
      insertBtn.disabled = true;
      return;
    }

    const capturedText = text;

    copyBtn.addEventListener('click', () => {
      void navigator.clipboard.writeText(capturedText).then(() => {
        new Notice('Copied to clipboard.');
      });
    });

    saveBtn.addEventListener('click', () => {
      void this.plugin.saveOutputToNote(capturedText).then(() => {
        new Notice('Report saved to note.');
      });
    });

    insertBtn.addEventListener('click', () => {
      void this.plugin.insertIntoCurrentNote(capturedText, this.targetNote);
    });
  }

  /** Render snippet picker inline (Phase 51 D-06 pattern). */
  private async renderSnippetPicker(
    state: {
      status: 'awaiting-snippet-pick';
      nodeId: string;
      subfolderPath: string | undefined;
      accumulatedText: string;
      canStepBack: boolean;
    },
    questionZone: HTMLElement,
  ): Promise<void> {
    const rootPath = this.plugin.settings.snippetFolderPath;
    const nodeRootRel = state.subfolderPath ?? '';
    const nodeRootAbs = nodeRootRel === '' ? rootPath : `${rootPath}/${nodeRootRel}`;

    if (this.snippetTreePicker !== null) {
      this.snippetTreePicker.unmount();
      this.snippetTreePicker = null;
    }

    questionZone.empty();
    const pickerHost = questionZone.createDiv({ cls: 'rp-stp-inline-host' });

    const capturedNodeId = state.nodeId;

    this.snippetTreePicker = new SnippetTreePicker({
      app: this.app,
      snippetService: this.plugin.snippetService,
      container: pickerHost as unknown as HTMLElement,
      mode: 'file-only',
      rootPath: nodeRootAbs,
      onSelect: (result) => {
        void (async () => {
          const absPath = result.relativePath === ''
            ? nodeRootAbs
            : `${nodeRootAbs}/${result.relativePath}`;
          const snippet = await this.plugin.snippetService.load(absPath);

          const currentState = this.runner.getState();
          if (
            currentState.status !== 'awaiting-snippet-pick' ||
            currentState.nodeId !== capturedNodeId
          ) {
            return;
          }

          // CR-01: Verify the modal container is still in the DOM before
          // operating on any captured DOM references. If the modal was
          // closed or re-rendered, the captured questionZone is detached.
          if (this.containerEl === null || !document.body.contains(this.containerEl)) {
            return;
          }

          if (snippet === null) {
            // Re-render to get a fresh DOM instead of writing to a stale element.
            this.render();
            const freshZone = this.contentEl?.querySelector('.rp-question-zone');
            if (freshZone) {
              freshZone.empty();
              freshZone.createEl('p', {
                cls: 'rp-empty-state-body',
                text: `Snippet not found: ${result.relativePath}`,
              });
            }
            return;
          }

          if (snippet.kind === 'json' && snippet.validationError !== null) {
            this.render();
            const freshZone = this.contentEl?.querySelector('.rp-question-zone');
            if (freshZone) {
              freshZone.empty();
              freshZone.createEl('p', {
                cls: 'rp-empty-state-body',
                text: `Snippet "${snippet.path}" cannot be used. ${snippet.validationError}`,
              });
            }
            return;
          }

          await this.handleSnippetPickerSelection(snippet);
        })();
      },
    });
    void this.snippetTreePicker.mount();

    if (state.canStepBack) {
      const stepBackBtn = questionZone.createEl('button', {
        cls: 'rp-step-back-btn',
        text: 'Step back',
      });
      stepBackBtn.addEventListener('click', () => {
        if (this.snippetTreePicker !== null) {
          this.snippetTreePicker.unmount();
          this.snippetTreePicker = null;
        }
        this.runner.stepBack();
        this.render();
      });
    }
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
      this.runner.completeSnippet(snippet.content);
      await this.appendAnswerToNote(snippet.content);
      this.snippetTreePicker?.unmount();
      this.snippetTreePicker = null;
      this.render();
      return;
    }

    if (snippet.placeholders.length === 0) {
      this.runner.completeSnippet(snippet.template);
      await this.appendAnswerToNote(snippet.template);
      this.snippetTreePicker?.unmount();
      this.snippetTreePicker = null;
      this.render();
      return;
    }

    // Snippet has placeholders — advance to awaiting-snippet-fill state
    this.render();
  }

  /** Load snippet and render fill-in form inline (D6). */
  private async handleSnippetFill(snippetId: string, questionZone: HTMLElement): Promise<void> {
    const isPhase51FullPath =
      snippetId.includes('/') ||
      snippetId.endsWith('.md') ||
      snippetId.endsWith('.json');
    const root = this.plugin.settings.snippetFolderPath;
    // WR-03: avoid double-prefixing when snippetId is already an absolute vault path
    const absPath = snippetId.startsWith(root + '/')
      ? snippetId
      : isPhase51FullPath
        ? `${root}/${snippetId}`
        : `${root}/${snippetId}.json`;

    const snippet = await this.plugin.snippetService.load(absPath);

    if (snippet === null) {
      questionZone.empty();
      questionZone.createEl('p', {
        text: `Snippet '${snippetId}' not found.`,
        cls: 'rp-empty-state-body',
      });
      return;
    }

    if (snippet.kind === 'json' && snippet.validationError !== null) {
      new Notice(`Snippet "${snippet.path}" cannot be used. ${snippet.validationError}`);
      this.runner.stepBack();
      this.render();
      return;
    }

    if (snippet.kind === 'md') {
      if (isPhase51FullPath) {
        this.runner.completeSnippet(snippet.content);
        await this.appendAnswerToNote(snippet.content);
        this.render();
        return;
      }
      questionZone.empty();
      questionZone.createEl('p', {
        text: `Snippet '${snippetId}' not found.`,
        cls: 'rp-empty-state-body',
      });
      return;
    }

    if (snippet.placeholders.length === 0) {
      this.runner.completeSnippet(snippet.template);
      await this.appendAnswerToNote(snippet.template);
      this.render();
      return;
    }

    // Render inline fill-in form (D6 — no stacked Modal)
    this.renderSnippetFillIn(snippet, questionZone);
  }

  /** D6: Render snippet fill-in form inside the inline modal. */
  private renderSnippetFillIn(
    snippet: import('../snippets/snippet-model').JsonSnippet,
    questionZone: HTMLElement,
  ): void {
    questionZone.empty();

    const form = questionZone.createDiv({ cls: 'rp-snippet-fill-form' });
    form.createEl('p', {
      text: `Fill in placeholders for "${snippet.path}"`,
      cls: 'rp-snippet-fill-title',
    });

    const values: Record<string, string | string[]> = {};

    for (const placeholder of snippet.placeholders) {
      const row = form.createDiv({ cls: 'rp-snippet-fill-row' });
      row.createEl('label', { text: placeholder.label, cls: 'rp-snippet-fill-label' });

      if (placeholder.type === 'free-text') {
        const input = row.createEl('input', {
          cls: 'rp-snippet-fill-input',
          attr: { type: 'text', placeholder: placeholder.id },
        });
        values[placeholder.id] = input.value;
        input.addEventListener('input', () => {
          values[placeholder.id] = input.value;
        });
      } else if (placeholder.type === 'choice') {
        const choicesContainer = row.createDiv({ cls: 'rp-snippet-fill-choices' });
        const selectedChoices: string[] = [];
        values[placeholder.id] = selectedChoices;

        const options = placeholder.options ?? [];
        for (const option of options) {
          const optLabel = choicesContainer.createEl('label', { cls: 'rp-snippet-fill-choice-label' });
          const checkbox = optLabel.createEl('input', {
            attr: { type: 'checkbox' },
          });
          optLabel.appendText(option);
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
              selectedChoices.push(option);
            } else {
              const idx = selectedChoices.indexOf(option);
              if (idx >= 0) selectedChoices.splice(idx, 1);
            }
            values[placeholder.id] = selectedChoices;
          });
        }
      }
    }

    const btnRow = form.createDiv({ cls: 'rp-snippet-fill-buttons' });

    const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => {
      this.runner.stepBack();
      this.render();
    });

    const submitBtn = btnRow.createEl('button', {
      text: 'Insert',
      cls: 'mod-cta',
    });
    submitBtn.addEventListener('click', () => {
      // Convert values to string format for renderSnippet
      // WR-04: copy array values before processing to avoid mutation-after-submit issues
      const filledValues: Record<string, string> = {};
      for (const [key, val] of Object.entries(values)) {
        if (Array.isArray(val)) {
          filledValues[key] = [...val].join(this.plugin.settings.textSeparator);
        } else {
          filledValues[key] = val as string;
        }
      }

      const rendered = renderSnippet(snippet, filledValues);
      this.runner.completeSnippet(rendered);
      void this.appendAnswerToNote(rendered).then(() => {
        this.render();
      });
    });
  }

  /** Render error state. */
  private renderError(zone: HTMLElement, errors: string[]): void {
    zone.empty();
    const errorPanel = zone.createDiv({ cls: 'rp-error-panel' });
    errorPanel.createEl('p', { text: 'Protocol error', cls: 'rp-error-title' });
    const ul = errorPanel.createEl('ul', { cls: 'rp-error-list' });
    for (const err of errors) {
      ul.createEl('li', { text: err });
    }
  }
}
