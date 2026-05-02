// views/runner-view.ts — Phase 5: Full RunnerView with awaiting-snippet-fill branch
import { ItemView, WorkspaceLeaf, Notice, TFile, MarkdownView, setIcon } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { ProtocolRunner } from '../runner/protocol-runner';
import { GraphValidator } from '../graph/graph-validator';
import type { ProtocolGraph } from '../graph/graph-model';
import { SnippetFillInModal } from './snippet-fill-in-modal';
import type { Snippet } from '../snippets/snippet-model';
import { ResumeSessionModal } from './resume-session-modal';
import type { PersistedSession } from '../sessions/session-model';
import { validateSessionNodeIds } from '../sessions/session-service';
import { CanvasSelectorWidget } from './canvas-selector-widget';
import { CanvasSwitchModal } from './canvas-switch-modal';
import { SnippetTreePicker } from './snippet-tree-picker';
import { renderLoopPicker } from '../runner/render/render-loop-picker';
import { renderQuestionAtNode } from '../runner/render/render-question';
import { renderSnippetPicker } from '../runner/render/render-snippet-picker';
import { renderCompleteHeading } from '../runner/render/render-complete';
import { renderErrorList } from '../runner/render/render-error';
import {
  isFullSnippetPath,
  renderSnippetFillLoading,
  renderSnippetFillNotFound,
} from '../runner/render/render-snippet-fill';

export const RUNNER_VIEW_TYPE = 'radiprotocol-runner';

export class RunnerView extends ItemView {
  private readonly plugin: RadiProtocolPlugin;
  // Phase 15: runner is re-created in openCanvas() to pick up textSeparator
  private runner: ProtocolRunner = new ProtocolRunner();
  // Phase 51 D-04 (PICKER-01): validator is now stateful (carries snippet-file probe).
  // Instantiated in constructor after `this.plugin` is assigned so the probe closes over
  // the live app + settings. See `.planning/notes/snippet-node-binding-and-picker.md`.
  private readonly validator: GraphValidator;
  private canvasFilePath: string | null = null;
  private previewTextarea: HTMLTextAreaElement | null = null;
  private insertBtn: HTMLButtonElement | null = null;
  private lastActiveMarkdownFile: TFile | null = null;
  private graph: ProtocolGraph | null = null;
  private selector: CanvasSelectorWidget | null = null;
  private selectorBarEl: HTMLDivElement | null = null;
  // Phase 53 RUNNER-CLOSE-01: button attached once in onOpen() alongside selectorBarEl.
  // Shares selectorBarEl's lifetime — the prepend-survives-empty pattern carries it
  // across every render(). Nulled in onClose().
  private closeBtn: HTMLButtonElement | null = null;
  /**
   * @deprecated Phase 51 D-06 — superseded by SnippetTreePicker; retained per
   *   CLAUDE.md Shared Pattern G for legacy state-restoration paths if any.
   * Phase 30 D-05/D-23: local picker drill-down segments, reset on exit from picker state.
   */
  private snippetPickerPath: string[] = [];
  /**
   * @deprecated Phase 51 D-06 — superseded by SnippetTreePicker; retained per
   *   CLAUDE.md Shared Pattern G for legacy state-restoration paths if any.
   */
  private snippetPickerNodeId: string | null = null;
  /**
   * Phase 51 D-06 — SnippetTreePicker for awaiting-snippet-pick state.
   * Replaces the Phase 30 hand-rolled drill-down. Null when not in picker state.
   */
  private snippetTreePicker: SnippetTreePicker | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
    // Phase 51 D-04 (PICKER-01): wire vault-backed snippet-file probe + snippet root.
    this.validator = new GraphValidator({
      snippetFileProbe: (absPath) => this.plugin.app.vault.getAbstractFileByPath(absPath) !== null,
      snippetFolderPath: this.plugin.settings.snippetFolderPath,
    });
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

  async openCanvas(filePath: string, startNodeId?: string): Promise<void> {
    // Phase 15: re-create runner to pick up the current textSeparator setting
    this.runner = new ProtocolRunner({
      defaultSeparator: this.plugin.settings.textSeparator,
    });

    this.canvasFilePath = filePath;
    this.selector?.setSelectedPath(filePath);
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      this.renderError([`Canvas file not found: "${filePath}".`]);
      return;
    }

    let content: string;
    // BUG-02/03: If canvas is open, read live in-memory data to avoid stale disk
    // state from the debounced saveLive() write path (D-05, D-06).
    const liveJson = this.plugin.canvasLiveEditor.getCanvasJSON(filePath);
    if (liveJson !== null) {
      content = liveJson;
    } else {
      try {
        content = await this.app.vault.read(file);
      } catch {
        this.renderError([`Could not read canvas file: "${filePath}".`]);
        return;
      }
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

    // Phase 45 (LOOP-06 / D-14): explicit start-from-node path bypasses session resume.
    // When the start-from-node command callback supplies a startNodeId, clear any stale
    // session and begin the runner at the chosen node. This preserves the v1.0 contract
    // for openCanvas(path) setState restoration (Pitfall 8) by making startNodeId optional.
    if (startNodeId !== undefined) {
      await this.plugin.sessionService.clear(filePath);
      this.graph = graph;
      this.runner.start(graph, startNodeId);
      this.render();
      return;
    }

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
    // SESSION-01 Pitfall 3: clear any stale session file once per fresh run,
    // here in openCanvas() rather than inside render() (Pitfall 6).
    await this.plugin.sessionService.clear(filePath);
    this.graph = graph;
    this.runner.start(graph);
    this.render();
  }

  async onOpen(): Promise<void> {
    // Create a persistent selector bar at the top of contentEl (gap-closure: SIDEBAR-01).
    // headerEl is Obsidian's native 32px title bar row with overflow:hidden — in sidebar
    // mode it crushes any injected child. contentEl has no such constraint.
    // selectorBarEl is created once here and re-inserted at the top of contentEl in
    // render() and renderError() so it survives the contentEl.empty() calls they make.
    const selectorBarEl = this.contentEl.createDiv({ cls: 'rp-selector-bar' });
    this.selectorBarEl = selectorBarEl;
    this.selector = new CanvasSelectorWidget(
      this.app,
      this.plugin,
      selectorBarEl,
      (filePath) => { void this.handleSelectorSelect(filePath); },
    );

    // Phase 53 RUNNER-CLOSE-01 / D-02: Close button lives inside selectorBarEl next
    // to the selector trigger. Attached ONCE here so that contentEl.empty() +
    // prepend(selectorBarEl) in render() carries it across re-renders (same lifetime
    // as selector — avoids the Phase 30 WR-01 class of listener-accumulation bug).
    // D-06: neutral styling (no mod-warning, no destructive red).
    //
    // CSS ownership (CLAUDE.md): `.rp-selector-bar` is owned by canvas-selector.css
    // and is block-level with padding. To lay out the selector trigger and Close
    // button inline without touching the canvas-selector feature, we apply a
    // RUNNER-OWNED modifier class `rp-selector-bar--has-close` here. All layout
    // rules for this modifier live in runner-view.css (runner-owned selectors only).
    selectorBarEl.addClass('rp-selector-bar--has-close');

    const closeBtn = selectorBarEl.createEl('button', { cls: 'rp-close-btn' });
    setIcon(closeBtn, 'x');
    closeBtn.setAttribute('aria-label', 'Close protocol');
    closeBtn.title = 'Close protocol';
    this.closeBtn = closeBtn;
    // Initial visibility: canvasFilePath is null at fresh open — hide.
    closeBtn.toggleClass('is-hidden', this.canvasFilePath === null);
    this.registerDomEvent(closeBtn, 'click', () => { void this.handleClose(); });

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

    // Initialize lastActiveMarkdownFile by scanning all open leaves (INSERT-01).
    // active-leaf-change only fires on subsequent switches, so without this the
    // button starts disabled even when a markdown note is already open.
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (this.lastActiveMarkdownFile === null &&
          leaf.view instanceof MarkdownView &&
          leaf.view.file !== null) {
        this.lastActiveMarkdownFile = leaf.view.file;
      }
    });

    // Phase 30 WR-01: register active-leaf-change listener ONCE at view open.
    // Previously this was registered inside renderOutputToolbar() which runs on
    // every render (snippet pick, step, back), accumulating duplicate listeners
    // over long sessions. Keep insertBtn disabled state in sync with active leaf
    // (D-07, D-08).
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

    this.render();
  }

  async onClose(): Promise<void> {
    this.selector?.destroy();
    this.selector = null;
    this.selectorBarEl = null;
    this.closeBtn = null;  // Phase 53 RUNNER-CLOSE-01
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
      state.status === 'at-node' ||
      state.status === 'awaiting-snippet-pick' ||
      state.status === 'awaiting-snippet-fill' ||
      state.status === 'awaiting-loop-pick';

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

  /**
   * Phase 53 RUNNER-CLOSE-02 / D-13 / D-14 / D-16:
   * Unload the current canvas and return the view to the fresh-plugin-open idle
   * state. Mirrors handleSelectorSelect's D-12 confirmation predicate byte-for-byte;
   * on confirm (or no-confirmation path) executes the D-14 teardown in exact order.
   * D-15: reuses CanvasSwitchModal verbatim (no new modal). D-16: no selector memory
   * after close — setSelectedPath(null) restores the placeholder.
   */
  private async handleClose(): Promise<void> {
    if (this.canvasFilePath === null) return;  // defence in depth (button is hidden)

    const state = this.runner.getState();
    const needsConfirmation =
      state.status === 'at-node' ||
      state.status === 'awaiting-snippet-pick' ||
      state.status === 'awaiting-snippet-fill' ||
      state.status === 'awaiting-loop-pick';

    if (needsConfirmation) {
      const modal = new CanvasSwitchModal(this.app);
      modal.open();
      const confirmed = await modal.result;
      if (!confirmed) {
        // D-13: user cancelled — nothing to revert (selector never changed).
        return;
      }
    }
    // D-13 idle/complete/error path falls through directly — no modal.

    // D-14 teardown — exact order matters.
    // 1. Clear persisted session for the canvas we are unloading.
    await this.plugin.sessionService.clear(this.canvasFilePath);

    // 2. Re-create the runner to match openCanvas's pattern (lines 93-97) so that
    //    getState().status === 'idle' post-reset. defaultSeparator pulled from
    //    plugin settings, same as openCanvas.
    this.runner = new ProtocolRunner({
      defaultSeparator: this.plugin.settings.textSeparator,
    });

    // 3. Null out runner-local state.
    this.graph = null;
    this.canvasFilePath = null;
    this.previewTextarea = null;

    // 4. D-16: reset selector to placeholder ("Select a protocol…").
    this.selector?.setSelectedPath(null);

    // 5. Re-render — enters the idle branch of render(), visually identical to
    //    a fresh plugin open with no canvas ever selected.
    this.render();
  }

  /**
   * Restart the current canvas from the beginning without showing ResumeSessionModal.
   * Called by the "Run again" button (gap-closure: RUNNER-01).
   * Clears any persisted session before calling openCanvas() so that openCanvas()
   * finds no session and skips the modal entirely.
   */
  private async restartCanvas(filePath: string): Promise<void> {
    await this.plugin.sessionService.clear(filePath);
    await this.openCanvas(filePath);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  private render(): void {
    // Phase 51 D-06: unmount picker if state has left awaiting-snippet-pick
    const renderState = this.runner.getState();
    if (this.snippetTreePicker !== null && renderState.status !== 'awaiting-snippet-pick') {
      this.snippetTreePicker.unmount();
      this.snippetTreePicker = null;
    }

    this.contentEl.empty();
    // Re-prepend the selector bar: contentEl.empty() removes it from the DOM
    // but the element and its CanvasSelectorWidget subtree remain valid in memory.
    if (this.selectorBarEl !== null) {
      this.contentEl.prepend(this.selectorBarEl);
    }
    // Phase 53 RUNNER-CLOSE-01 / D-12: Close button is hidden when no canvas is loaded.
    // Visibility re-computed on every render so the first render after openCanvas
    // (canvasFilePath newly non-null) reveals it, and the render after handleClose
    // (canvasFilePath newly null) hides it again. is-hidden class maps to display:none.
    this.closeBtn?.toggleClass('is-hidden', this.canvasFilePath === null);
    this.previewTextarea = null;

    const root = this.contentEl.createDiv({ cls: 'rp-runner-view' });
    const previewZone = root.createDiv({ cls: 'rp-preview-zone' });
    const questionZone = root.createDiv({ cls: 'rp-question-zone' });
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
        const result = renderQuestionAtNode(questionZone, this.graph, state, {
          bindClick: (el, handler) => this.registerDomEvent(el, 'click', handler),
          renderError: (messages) => this.renderError(messages),
          onChooseAnswer: (answerNode) => {
            this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // BUG-01: capture manual edit (D-01)
            this.runner.chooseAnswer(answerNode.id);
            void this.autoSaveSession();   // SESSION-01 — save after answer
            void this.renderAsync();
          },
          onChooseSnippetBranch: (snippetNode, isFileBound) => {
            this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // BUG-01: capture manual edit (D-01)

            if (isFileBound) {
              // Phase 56 D-04 (PICKER-01 reversal): file-bound Snippet → direct dispatch.
              const snippetPath = snippetNode.radiprotocol_snippetPath as string;
              this.runner.pickFileBoundSnippet(state.currentNodeId, snippetNode.id, snippetPath);
            } else {
              // Directory-bound — Phase 51 path preserved.
              this.runner.chooseSnippetBranch(snippetNode.id);
            }

            void this.autoSaveSession();   // SESSION-01 — save after snippet branch choice
            void this.renderAsync();
          },
          onBack: () => {
            this.runner.stepBack();
            void this.autoSaveSession();   // SESSION-01 — save the reverted state
            this.render();
          },
          onSkip: () => {
            this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // BUG-01 / D-11
            this.runner.skip();
            void this.autoSaveSession();   // SESSION-01 — save after skip (D-10: recordable step)
            void this.renderAsync();
          },
          canSkip: true,
        });
        if (result === 'error') return;
        if (result === 'not-question') {
          const node = this.graph?.nodes.get(state.currentNodeId);
          this.renderError([
            `Internal bug: RunnerView.renderState reached at-node default branch for kind='${(node as { kind: string } | undefined)?.kind ?? 'unknown'}'. Step back and report.`,
          ]);
          return;
        }

        this.renderPreviewZone(previewZone, state.accumulatedText);
        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);
        break;
      }

      case 'awaiting-snippet-pick': {
        this.renderPreviewZone(previewZone, state.accumulatedText);
        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);

        // Phase 30 D-05/D-23: reset picker drill-down when we enter a new snippet node
        if (this.snippetPickerNodeId !== state.nodeId) {
          this.snippetPickerNodeId = state.nodeId;
          this.snippetPickerPath = [];
        }

        questionZone.createEl('p', {
          text: 'Loading snippets...',
          cls: 'rp-empty-state-body',
        });
        void this.mountSnippetPicker(state, questionZone);
        break;
      }

      case 'awaiting-loop-pick': {
        const rendered = renderLoopPicker(questionZone, this.graph, state, {
          bindClick: (el, handler) => this.registerDomEvent(el, 'click', handler),
          renderError: (messages) => this.renderError(messages),
          onChooseLoopBranch: (edge) => {
            this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // Pitfall 7
            this.runner.chooseLoopBranch(edge.id);                          // per locked decision: edge.id
            void this.autoSaveSession();
            void this.renderAsync();
          },
          onBack: () => {
            this.runner.stepBack();
            void this.autoSaveSession();
            this.render();
          },
        });
        if (!rendered) return;

        this.renderPreviewZone(previewZone, state.accumulatedText);
        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);
        break;
      }

      case 'awaiting-snippet-fill': {
        renderSnippetFillLoading(questionZone);
        this.renderPreviewZone(previewZone, state.accumulatedText);
        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);
        // Async: load snippet and open modal (SNIP-06, D-17)
        void this.handleSnippetFill(state.snippetId, questionZone);
        break;
      }

      case 'complete': {
        renderCompleteHeading(questionZone);
        // RUNNER-01: "Run again" button — restarts the same canvas from the beginning.
        const runAgainBtn = questionZone.createEl('button', {
          cls: 'rp-run-again-btn',
          text: 'Run again',
        });
        if (this.canvasFilePath === null) {
          runAgainBtn.disabled = true;
        } else {
          const path = this.canvasFilePath; // narrow to string
          this.registerDomEvent(runAgainBtn, 'click', () => {
            void this.restartCanvas(path);
          });
        }
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

  }

  /** Wrapper so click handlers can call `void this.renderAsync()` */
  private async renderAsync(): Promise<void> {
    this.render();
  }

  /**
   * Phase 51 D-06 (PICKER-02) — drill-down rebuilt on the unified SnippetTreePicker
   * in file-only mode rooted at the Snippet node's subfolderPath. Phase 30 D-05 semantics
   * preserved: drill does NOT push undo (internal to picker); only pickSnippet via
   * handleSnippetPickerSelection mutates runner state (Pattern A).
   * File-row glyphs (📄/📝) are dispatched by the picker's built-in extension logic
   * (Phase 35 MD-01 preservation, shipped by Plan 02). No per-call-site customisation.
   * Host wrapper class `rp-stp-runner-host` is defined in src/styles/snippet-tree-picker.css
   * (owned by Plan 02). This plan does NOT modify CSS.
   * See `.planning/notes/snippet-node-binding-and-picker.md`.
   */
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
    // Defensive cleanup of any prior picker instance (lifecycle discipline).
    if (this.snippetTreePicker !== null) {
      this.snippetTreePicker.unmount();
      this.snippetTreePicker = null;
    }

    this.snippetTreePicker = renderSnippetPicker(questionZone, state, {
      app: this.app,
      snippetService: this.plugin.snippetService,
      rootPath: this.plugin.settings.snippetFolderPath,
      hostClass: 'rp-stp-runner-host',
      copy: {
        notFound: (relativePath) => `Сниппет не найден: ${relativePath}`,
        validationError: (snippetPath, validationMessage) =>
          `Сниппет «${snippetPath}» не может быть использован. ${validationMessage}`,
      },
      bindClick: (el, handler) => this.registerDomEvent(el, 'click', handler),
      getCurrentNodeId: () => {
        const s = this.runner.getState();
        return s.status === 'awaiting-snippet-pick' ? s.nodeId : null;
      },
      onSnippetReady: (snippet) => this.handleSnippetPickerSelection(snippet),
      onBack: () => {
        if (this.snippetTreePicker !== null) {
          this.snippetTreePicker.unmount();
          this.snippetTreePicker = null;
        }
        this.runner.stepBack();
        void this.autoSaveSession();
        this.render();
      },
    });
  }

  /**
   * Phase 30 D-08, D-09, D-14: user clicked a snippet row.
   *  - Push pickSnippet to runner (undo-before-mutate inside the runner).
   *  - If snippet has zero placeholders → completeSnippet(template) directly (D-09).
   *  - Else open SnippetFillInModal; on resolve → completeSnippet(rendered); on cancel → completeSnippet('') (D-14).
   */
  private async handleSnippetPickerSelection(snippet: Snippet): Promise<void> {
    // Phase 52 D-04: defensive validationError guard. The shared picker
    // onSelect callback already intercepts this case for the file-row path, but
    // other callers (or future refactors) could route a broken snippet here.
    // Emit a non-fatal Notice and bail before any state mutation or scroll
    // capture — a rejected snippet never advances, so no scroll preservation is
    // needed.
    if (snippet.kind === 'json' && snippet.validationError !== null) {
      new Notice(
        `Сниппет «${snippet.path}» не может быть использован. ${snippet.validationError}`,
      );
      return;
    }
    // BUG-01: capture any manual edit before advancing
    this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
    // Phase 35: MD snippets have no `id`; use `path` for identity. JSON keeps
    // legacy `id ?? name` fallback to preserve Phase 30 behavior.
    const pickId = snippet.kind === 'md' ? snippet.path : (snippet.id ?? snippet.name);
    this.runner.pickSnippet(pickId);
    // Phase 30 WR-03: removed duplicate autoSaveSession here — the save at the
    // end of this handler (after completeSnippet) supersedes this intermediate
    // state. Two fire-and-forget writes could race on slow disks and produce a
    // truncated session file.

    // Phase 35 (MD-02, D-02, D-03, D-04): MD snippets insert verbatim, no modal.
    // MUST be checked BEFORE JSON-only fields (placeholders/template).
    if (snippet.kind === 'md') {
      this.runner.completeSnippet(snippet.content);
      void this.autoSaveSession();
      this.snippetPickerPath = [];
      this.snippetPickerNodeId = null;
      this.render();
      return;
    }

    if (snippet.placeholders.length === 0) {
      // D-09: no-placeholder path — skip modal, append template directly
      this.runner.completeSnippet(snippet.template);
      void this.autoSaveSession();
      this.snippetPickerPath = [];
      this.snippetPickerNodeId = null;
      this.render();
      return;
    }

    const modal = new SnippetFillInModal(this.app, snippet);
    modal.open();
    const rendered = await modal.result;
    if (rendered !== null) {
      this.runner.completeSnippet(rendered);
    } else {
      // D-14: cancel = empty insertion, runner still advances
      this.runner.completeSnippet('');
    }
    void this.autoSaveSession();
    this.snippetPickerPath = [];
    this.snippetPickerNodeId = null;
    this.render();
  }

  /** Load snippet and open SnippetFillInModal; update runner with result (SNIP-06). */
  private async handleSnippetFill(snippetId: string, questionZone: HTMLElement): Promise<void> {
    // Phase 51 D-14 (PICKER-01) — snippetId path-shape detection.
    // Legacy id-string (no '/', no extension) — Phase 32/35 callers — compose with .json append.
    // Phase 51 full-path (contains '/' OR ends with .md/.json) — auto-insert from Plan 06 —
    // load directly without extension append.
    // See `.planning/notes/snippet-node-binding-and-picker.md`.
    const isPhase51FullPath = isFullSnippetPath(snippetId);
    const root = this.plugin.settings.snippetFolderPath;
    const absPath = isPhase51FullPath
      ? `${root}/${snippetId}`
      : `${root}/${snippetId}.json`;  // Phase 32 D-03 legacy composition

    const snippet = await this.plugin.snippetService.load(absPath);

    if (snippet === null) {
      renderSnippetFillNotFound(questionZone, snippetId, {
        trailer: ' The snippet may have been deleted. Use step-back to continue.',
      });
      return;
    }

    // Phase 52 D-04: validationError guard for the auto-insert path (Phase 51 D-14).
    // A JsonSnippet carrying a non-null validationError (emitted by Plan 02's
    // validatePlaceholders in the snippet-service load path) is unusable. Surface
    // a non-fatal Notice, step the runner back so the user remains at the
    // preceding Question node, persist the session, and re-render. Placement is
    // AFTER the null-check and BEFORE the md-kind branch — Phase 51 D-14 path-
    // shape detection at :788-795 remains upstream and unchanged.
    if (snippet.kind === 'json' && snippet.validationError !== null) {
      new Notice(
        `Сниппет «${snippet.path}» не может быть использован. ${snippet.validationError}`,
      );
      this.runner.stepBack();
      void this.autoSaveSession();
      this.render();
      return;
    }

    // Phase 51 D-14: .md auto-insert (Phase 51 full-path) — completeSnippet directly, no modal
    // (Phase 35 D-04 contract — MD snippets insert verbatim).
    // Legacy id-string callers expecting JSON-only (Phase 32) preserve the prior behaviour: a
    // legacy id always composes a .json path, so kind==='md' from a legacy id is unreachable in
    // practice — guard with the existing "not found" rendering for defence.
    if (snippet.kind === 'md') {
      if (isPhase51FullPath) {
        this.runner.completeSnippet(snippet.content);
        void this.autoSaveSession();
        this.render();
        return;
      }
      renderSnippetFillNotFound(questionZone, snippetId, {
        trailer: ' The snippet may have been deleted. Use step-back to continue.',
      });
      return;
    }

    // JsonSnippet path — Phase 30 D-09 short-circuit harmonisation: zero-placeholder snippets
    // skip the modal (mirrors handleSnippetPickerSelection). Keeps auto-insert behaviour
    // identical to a user-clicked specific-bound snippet per D-14.
    if (snippet.placeholders.length === 0) {
      this.runner.completeSnippet(snippet.template);
      void this.autoSaveSession();
      this.render();
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
    const textarea = zone.createEl('textarea', { cls: 'rp-preview-textarea' });
    textarea.value = text;
    // Defer height calculation until the element has layout
    requestAnimationFrame(() => {
      textarea.setCssProps({ '--rp-textarea-height': 'auto' });
      textarea.setCssProps({ '--rp-textarea-height': textarea.scrollHeight + 'px' });
      // Phase 66 D-09: pin to bottom on every render — last inserted line is visible.
      textarea.scrollTop = textarea.scrollHeight;
    });
    this.registerDomEvent(textarea, 'input', () => {
      textarea.setCssProps({ '--rp-textarea-height': 'auto' });
      textarea.setCssProps({ '--rp-textarea-height': textarea.scrollHeight + 'px' });
    });
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

    if (!enabled || text === null) {
      copyBtn.disabled = true;
      saveBtn.disabled = true;
      insertBtn.disabled = true;
      return;
    }

    // Only reach here when enabled=true and text is non-null (D-05, D-08)
    // Use lastActiveMarkdownFile (not getActiveViewOfType) so the initial state
    // is consistent with the click handler — clicking the button shifts focus to
    // the runner, making getActiveViewOfType return null at click time (INSERT-01).
    insertBtn.disabled = this.lastActiveMarkdownFile === null;

    const capturedText = text;

    this.registerDomEvent(copyBtn, 'click', () => {
      const finalText = this.previewTextarea?.value ?? capturedText;  // D-03: live textarea read
      void navigator.clipboard.writeText(finalText).then(() => {
        new Notice('Copied to clipboard.');
      });
    });

    this.registerDomEvent(saveBtn, 'click', () => {
      const finalText = this.previewTextarea?.value ?? capturedText;  // D-03: live textarea read
      void this.plugin.saveOutputToNote(finalText).then(() => {
        new Notice('Report saved to note.');
      });
    });

    this.registerDomEvent(insertBtn, 'click', () => {
      const file = this.lastActiveMarkdownFile;
      if (file === null) return;
      const finalText = this.previewTextarea?.value ?? capturedText;  // D-03: live textarea read
      void this.plugin.insertIntoCurrentNote(finalText, file);
    });

    // Phase 30 WR-01: active-leaf-change listener moved to onOpen() so it is
    // registered exactly once per view lifetime rather than on every render.
  }

  private renderError(errors: string[]): void {
    this.contentEl.empty();
    // Re-prepend the selector bar after empty() — same guard as in render().
    if (this.selectorBarEl !== null) {
      this.contentEl.prepend(this.selectorBarEl);
    }
    const root = this.contentEl.createDiv({ cls: 'rp-runner-view' });
    const questionZone = root.createDiv({ cls: 'rp-question-zone rp-validation-panel' });
    renderErrorList(questionZone, errors);
  }

}
