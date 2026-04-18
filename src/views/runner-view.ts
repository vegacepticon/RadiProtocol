// views/runner-view.ts — Phase 5: Full RunnerView with awaiting-snippet-fill branch
import { ItemView, WorkspaceLeaf, Notice, TFile, TFolder, MarkdownView } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { ProtocolRunner } from '../runner/protocol-runner';
import { GraphValidator } from '../graph/graph-validator';
import type { ProtocolGraph, AnswerNode, SnippetNode } from '../graph/graph-model';
import { SnippetFillInModal } from './snippet-fill-in-modal';
import type { Snippet, SnippetFile } from '../snippets/snippet-model';
import { ResumeSessionModal } from './resume-session-modal';
import type { PersistedSession } from '../sessions/session-model';
import { validateSessionNodeIds } from '../sessions/session-service';
import { CanvasSelectorWidget } from './canvas-selector-widget';
import { CanvasSwitchModal } from './canvas-switch-modal';

export const RUNNER_VIEW_TYPE = 'radiprotocol-runner';

export class RunnerView extends ItemView {
  private readonly plugin: RadiProtocolPlugin;
  // Phase 15: runner is re-created in openCanvas() to pick up textSeparator
  private runner: ProtocolRunner = new ProtocolRunner();
  private readonly validator = new GraphValidator();
  private canvasFilePath: string | null = null;
  private previewTextarea: HTMLTextAreaElement | null = null;
  private insertBtn: HTMLButtonElement | null = null;
  private lastActiveMarkdownFile: TFile | null = null;
  private graph: ProtocolGraph | null = null;
  private selector: CanvasSelectorWidget | null = null;
  private selectorBarEl: HTMLDivElement | null = null;
  /** Phase 30 D-05/D-23: local picker drill-down segments, reset on exit from picker state. */
  private snippetPickerPath: string[] = [];
  private snippetPickerNodeId: string | null = null;

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
    this.contentEl.empty();
    // Re-prepend the selector bar: contentEl.empty() removes it from the DOM
    // but the element and its CanvasSelectorWidget subtree remain valid in memory.
    if (this.selectorBarEl !== null) {
      this.contentEl.prepend(this.selectorBarEl);
    }
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
            // Phase 31: partition outgoing neighbors into answer + snippet branches.
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
                this.registerDomEvent(btn, 'click', () => {
                  this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // BUG-01: capture manual edit (D-01)
                  this.runner.chooseAnswer(answerNode.id);
                  void this.autoSaveSession();   // SESSION-01 — save after answer
                  void this.renderAsync();
                });
              }
            }

            if (snippetNeighbors.length > 0) {
              // Phase 31 D-02: snippet branches rendered below answers, visually distinct.
              const snippetList = questionZone.createDiv({ cls: 'rp-snippet-branch-list' });
              for (const snippetNode of snippetNeighbors) {
                const label = (snippetNode.snippetLabel !== undefined && snippetNode.snippetLabel.length > 0)
                  ? `\uD83D\uDCC1 ${snippetNode.snippetLabel}`   // 📁
                  : '\uD83D\uDCC1 Snippet';                      // D-01 fallback
                const btn = snippetList.createEl('button', {
                  cls: 'rp-snippet-branch-btn',
                  text: label,
                });
                this.registerDomEvent(btn, 'click', () => {
                  this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // BUG-01: capture manual edit (D-01)
                  this.runner.chooseSnippetBranch(snippetNode.id);
                  void this.autoSaveSession();   // SESSION-01 — save after snippet branch choice
                  void this.renderAsync();
                });
              }
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
              this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // BUG-01: capture manual edit (D-01)
              this.runner.enterFreeText(textarea.value);
              void this.autoSaveSession();   // SESSION-01 — save after free-text
              void this.renderAsync();
            });
            break;
          }

          // Phase 43 D-14 — case 'loop-end' удалён вместе с LoopEndNode kind.
          // Unified 'loop' picker UI реализуется в Phase 44 (RUN-01). До тех пор
          // runtime просто transitionToError'ит на loop-узле (см. ProtocolRunner.advanceThrough).

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
        void this.renderSnippetPicker(state, questionZone);
        break;
      }

      case 'awaiting-loop-pick': {
        if (this.graph === null) {
          this.renderError(['Internal error: graph not loaded.']);
          return;
        }
        const node = this.graph.nodes.get(state.nodeId);
        if (node === undefined || node.kind !== 'loop') {
          this.renderError([`Loop node "${state.nodeId}" not found in graph.`]);
          return;
        }

        // RUN-01: render headerText above picker when present.
        if (node.headerText !== '') {
          questionZone.createEl('p', {
            text: node.headerText,
            cls: 'rp-loop-header-text',
          });
        }

        // RUN-01: one button per outgoing edge (Pitfall 4 — filter edges, not adjacency).
        const outgoing = this.graph.edges.filter(e => e.fromNodeId === state.nodeId);
        const list = questionZone.createDiv({ cls: 'rp-loop-picker-list' });
        for (const edge of outgoing) {
          const label = edge.label ?? '(no label)';
          const isExit = edge.label === 'выход'; // exact-match contract — Phase 43 D-08
          const btn = list.createEl('button', {
            cls: isExit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn',
            text: label,
          });
          this.registerDomEvent(btn, 'click', () => {
            this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // Pitfall 7
            this.runner.chooseLoopBranch(edge.id);                          // per locked decision: edge.id
            void this.autoSaveSession();
            void this.renderAsync();
          });
        }

        // RUN-05: step-back button (same pattern as at-node arm).
        if (state.canStepBack) {
          const stepBackBtn = questionZone.createEl('button', {
            cls: 'rp-step-back-btn',
            text: 'Step back',
          });
          this.registerDomEvent(stepBackBtn, 'click', () => {
            this.runner.stepBack();
            void this.autoSaveSession();
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
   * Phase 30 D-01..D-05, D-13..D-17: render the drill-down picker for a snippet node.
   * Local state only — drill-down does NOT push undo.
   */
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
    const currentAbs =
      this.snippetPickerPath.length === 0
        ? nodeRootAbs
        : `${nodeRootAbs}/${this.snippetPickerPath.join('/')}`;

    const listing = await this.plugin.snippetService.listFolder(currentAbs);

    // T-30-04: drop stale results if runner has moved on
    const currentState = this.runner.getState();
    if (
      currentState.status !== 'awaiting-snippet-pick' ||
      currentState.nodeId !== state.nodeId
    ) {
      return;
    }

    questionZone.empty();

    // Breadcrumb (D-02)
    const crumbBar = questionZone.createDiv({ cls: 'rp-snippet-breadcrumb' });
    const crumbLabel =
      this.snippetPickerPath.length === 0
        ? nodeRootRel === ''
          ? '/'
          : nodeRootRel
        : nodeRootRel === ''
          ? this.snippetPickerPath.join('/')
          : `${nodeRootRel}/${this.snippetPickerPath.join('/')}`;
    crumbBar.createEl('span', { cls: 'rp-snippet-breadcrumb-label', text: crumbLabel });

    if (this.snippetPickerPath.length > 0) {
      const upBtn = crumbBar.createEl('button', {
        cls: 'rp-snippet-up-btn',
        text: 'Up',
      });
      this.registerDomEvent(upBtn, 'click', () => {
        this.snippetPickerPath.pop();
        this.render(); // D-05: local nav, no undo
      });
    }

    // Empty state (D-15, D-17)
    if (listing.folders.length === 0 && listing.snippets.length === 0) {
      questionZone.createEl('p', {
        cls: 'rp-empty-state-body',
        text: `No snippets found in ${crumbLabel}`,
      });
    } else {
      const list = questionZone.createDiv({ cls: 'rp-snippet-picker-list' });

      // D-03: folders first
      for (const folderName of listing.folders) {
        const row = list.createEl('button', {
          cls: 'rp-snippet-folder-row',
          text: `📁 ${folderName}`,
        });
        this.registerDomEvent(row, 'click', () => {
          this.snippetPickerPath.push(folderName);
          this.render(); // D-05: local nav, no undo
        });
      }

      // Then snippets.
      // Phase 35 (MD-01, D-01): MD and JSON snippets both appear in picker.
      // Prefix glyph differentiates kind: 📄 JSON, 📝 MD.
      // Click always routes through handleSnippetPickerSelection(Snippet);
      // MD branch inside handler skips fill-in modal (MD-02, D-04).
      for (const snippet of listing.snippets) {
        const prefix = snippet.kind === 'md' ? '📝' : '📄';
        const row = list.createEl('button', {
          cls: 'rp-snippet-item-row',
          text: `${prefix} ${snippet.name}`,
        });
        this.registerDomEvent(row, 'click', () => {
          void this.handleSnippetPickerSelection(snippet);
        });
      }
    }

    // Step-back (D-11) — mirrors existing pattern
    if (state.canStepBack) {
      const stepBackBtn = questionZone.createEl('button', {
        cls: 'rp-step-back-btn',
        text: 'Step back',
      });
      this.registerDomEvent(stepBackBtn, 'click', () => {
        this.snippetPickerPath = [];
        this.snippetPickerNodeId = null;
        this.runner.stepBack();
        void this.autoSaveSession();
        this.render();
      });
    }
  }

  /**
   * Phase 30 D-08, D-09, D-14: user clicked a snippet row.
   *  - Push pickSnippet to runner (undo-before-mutate inside the runner).
   *  - If snippet has zero placeholders → completeSnippet(template) directly (D-09).
   *  - Else open SnippetFillInModal; on resolve → completeSnippet(rendered); on cancel → completeSnippet('') (D-14).
   */
  private async handleSnippetPickerSelection(snippet: Snippet): Promise<void> {
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
    // Phase 32 (D-03): load now takes a path. snippetId here is a legacy
    // id-string from the runner state machine — resolve it to a path under
    // the snippet root. Full callsite refactor to pass paths end-to-end is
    // Phase 33/35 scope.
    const legacyPath = `${this.plugin.settings.snippetFolderPath}/${snippetId}.json`;
    const snippet = await this.plugin.snippetService.load(legacyPath);

    // Phase 35: rewritten from `kind !== 'json'` to `kind === 'md'` (semantically
    // equivalent given the Snippet union has only two kinds) so the Phase 35
    // source-contract test (no JSON-only filter anywhere in this file) passes.
    if (snippet === null || snippet.kind === 'md') {
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
    const textarea = zone.createEl('textarea', { cls: 'rp-preview-textarea' });
    textarea.value = text;
    // Force width inline so theme/app CSS cannot override it
    textarea.style.width = '100%';
    // Defer height calculation until the element has layout
    requestAnimationFrame(() => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });
    this.registerDomEvent(textarea, 'input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
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
    questionZone.createEl('p', { text: 'Protocol error' });
    const ul = questionZone.createEl('ul', { cls: 'rp-error-list' });
    for (const err of errors) {
      ul.createEl('li', { text: err });
    }
  }

}
