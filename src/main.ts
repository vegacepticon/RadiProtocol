// main.ts
import { Plugin, Notice, Menu, TFile, TFolder, SuggestModal } from 'obsidian';
import type { App } from 'obsidian';
import { RadiProtocolSettings, DEFAULT_SETTINGS, RadiProtocolSettingsTab, type InlineRunnerLayout } from './settings';
import { CanvasParser } from './graph/canvas-parser';
import { ProtocolDocumentParser } from './protocol/protocol-document-parser';
import { ProtocolDocumentStore } from './protocol/protocol-document-store';
import { EditorPanelView, EDITOR_PANEL_VIEW_TYPE } from './views/editor-panel-view';
import { SnippetManagerView, SNIPPET_MANAGER_VIEW_TYPE } from './views/snippet-manager-view';
import { SnippetService } from './snippets/snippet-service';
import { WriteMutex } from './utils/write-mutex';
import { I18nService } from './i18n';
import { CanvasLiveEditor } from './canvas/canvas-live-editor';
import { CanvasNodeFactory } from './canvas/canvas-node-factory';
import { EdgeLabelSyncService } from './canvas/edge-label-sync-service';
import { LibraryService } from './snippets/library-service';
// Phase 45 (LOOP-06): start-from-node command dependencies
import { NodePickerModal, buildNodeOptions } from './views/node-picker-modal';
import { GraphValidator } from './graph/graph-validator';
// Phase 54: inline protocol display mode
import { InlineRunnerModal } from './views/inline-runner-modal';
import { ProtocolEditorView, PROTOCOL_EDITOR_VIEW_TYPE } from './views/protocol-editor-view';

/**
 * Phase 59 INLINE-FIX-01 — Nested-path-safe protocol folder enumeration.
 *
 * Called by {@link RadiProtocolPlugin.handleRunProtocolInline} to resolve the
 * configured `protocolFolderPath` setting to a flat list of `.canvas` files.
 *
 * Handles three known failure modes in the pre-Phase-59 implementation:
 *   1. Trailing / leading slashes in the stored setting — stripped via regex.
 *   2. Windows backslash path separators — replaced with forward slash.
 *   3. Obsidian vault-index returning null for an otherwise-valid nested folder —
 *      fallback to a `vault.getFiles()` prefix scan filtered to `.canvas` extension.
 *
 * Returns an empty array when the folder does not exist, has no canvases, or the
 * path is blank. The caller is responsible for the D8 "No protocol canvases found"
 * Notice when the result is empty.
 *
 * Exported (not a private method) so it can be unit-tested from
 * `src/__tests__/main-inline-command.test.ts` without instrumenting the plugin class.
 */
function normalizeProtocolFolderPath(folderPath: string): string {
  return folderPath
    .trim()
    .replace(/\\/g, '/')          // Windows backslash → forward slash (Pitfall 5 / A1)
    .replace(/^\/+|\/+$/g, '');   // strip leading/trailing slashes
}

function resolveProtocolFilesBySuffix(
  vault: import('obsidian').Vault,
  folderPath: string,
  suffix: string,
  debugLabel: string,
): TFile[] {
  const normalized = normalizeProtocolFolderPath(folderPath);
  if (normalized === '') {
    console.debug(`[RadiProtocol][${debugLabel}] folderPath normalized to empty — skipping resolution.`);
    return [];
  }

  const folder = vault.getAbstractFileByPath(normalized);
  const out: TFile[] = [];

  if (folder instanceof TFolder) {
    const walk = (f: TFolder): void => {
      for (const child of f.children) {
        if (child instanceof TFolder) walk(child);
        else if (child instanceof TFile && child.path.endsWith(suffix)) out.push(child);
      }
    };
    walk(folder);
    console.debug(
      `[RadiProtocol][${debugLabel}] Resolved '${folderPath}' → '${normalized}' via TFolder walk; ${out.length} file(s).`,
    );
    return out;
  }

  // Fallback — getAbstractFileByPath returned null or non-folder. Scan all vault files.
  const prefix = normalized + '/';
  for (const f of vault.getFiles()) {
    if (!f.path.endsWith(suffix)) continue;
    if (f.path === normalized || f.path.startsWith(prefix)) out.push(f);
  }
  console.debug(
    `[RadiProtocol][${debugLabel}] Resolved '${folderPath}' → '${normalized}' via getFiles() fallback; ${out.length} file(s). (getAbstractFileByPath returned ${folder === null ? 'null' : typeof folder})`,
  );
  return out;
}

export function resolveProtocolDocumentFiles(
  vault: import('obsidian').Vault,
  folderPath: string,
): TFile[] {
  return resolveProtocolFilesBySuffix(vault, folderPath, '.rp.json', 'PROTOCOL-DOC');
}

export function resolveProtocolCanvasFiles(
  vault: import('obsidian').Vault,
  folderPath: string,
): TFile[] {
  return resolveProtocolFilesBySuffix(vault, folderPath, '.canvas', 'INLINE-FIX-01');
}

type ProtocolPickerSuggestion = { file: TFile; name: string };
type ProtocolEditorPickerSuggestion =
  | { kind: 'existing'; file: TFile; name: string }
  | { kind: 'create'; title: string };

function protocolDisplayName(file: TFile): string {
  return file.basename.replace(/\.rp$/, '');
}

function protocolDocumentId(): string {
  return `protocol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

class ProtocolPickerSuggestModal extends SuggestModal<ProtocolPickerSuggestion> {
  constructor(
    app: App,
    private readonly protocolFiles: TFile[],
    private readonly onChoose: (item: ProtocolPickerSuggestion) => void,
  ) {
    super(app);
  }

  getSuggestions(query: string): ProtocolPickerSuggestion[] {
    const q = query.toLowerCase();
    return this.protocolFiles
      .map(f => ({ file: f, name: protocolDisplayName(f) }))
      .filter(item => item.name.toLowerCase().includes(q));
  }

  renderSuggestion(item: ProtocolPickerSuggestion, el: HTMLElement): void {
    el.createEl('div', { text: item.name });
  }

  onChooseSuggestion(item: ProtocolPickerSuggestion): void {
    this.onChoose(item);
  }
}

class ProtocolEditorPickerModal extends SuggestModal<ProtocolEditorPickerSuggestion> {
  private lastQuery = '';

  constructor(
    app: App,
    private readonly protocolFiles: TFile[],
    private readonly t: (key: string, vars?: Record<string, string>) => string,
    private readonly onOpenExisting: (file: TFile) => void,
    private readonly onCreate: (title: string) => void,
  ) {
    super(app);
    this.setPlaceholder(this.t('protocolEditor.openPickerPlaceholder'));
  }

  getSuggestions(query: string): ProtocolEditorPickerSuggestion[] {
    this.lastQuery = query.trim();
    const q = this.lastQuery.toLowerCase();
    const existing = this.protocolFiles
      .map(file => ({ kind: 'existing' as const, file, name: protocolDisplayName(file) }))
      .filter(item => item.name.toLowerCase().includes(q));

    if (this.lastQuery === '') return existing;
    if (existing.some(item => item.name.toLowerCase() === q)) return existing;
    return [{ kind: 'create', title: this.lastQuery }, ...existing];
  }

  renderSuggestion(item: ProtocolEditorPickerSuggestion, el: HTMLElement): void {
    if (item.kind === 'create') {
      el.createEl('div', { text: this.t('protocolEditor.createProtocolSuggestion', { title: item.title }) });
      el.createEl('small', { text: this.t('protocolEditor.createProtocolHint') });
      return;
    }
    el.createEl('div', { text: item.name });
    el.createEl('small', { text: item.file.path });
  }

  onChooseSuggestion(item: ProtocolEditorPickerSuggestion): void {
    if (item.kind === 'create') {
      this.onCreate(item.title);
      return;
    }
    this.onOpenExisting(item.file);
  }
}

export default class RadiProtocolPlugin extends Plugin {
  settings!: RadiProtocolSettings;
  i18n!: I18nService;
  canvasParser!: CanvasParser;
  protocolDocumentParser!: ProtocolDocumentParser;
  protocolDocumentStore!: ProtocolDocumentStore;
  snippetService!: SnippetService;
  libraryService!: LibraryService;
  canvasLiveEditor!: CanvasLiveEditor;
  canvasNodeFactory!: CanvasNodeFactory;
  edgeLabelSyncService!: EdgeLabelSyncService;
  private readonly insertMutex = new WriteMutex();
  private pickerModal: SuggestModal<ProtocolPickerSuggestion | ProtocolEditorPickerSuggestion> | null = null;
  // Phase 85 INLINE-MULTI-01: registry of open inline runners keyed by `${protocolPath}#${notePath}`.
  private inlineRunners = new Map<string, InlineRunnerModal>();

  async onload(): Promise<void> {
    // Load settings with defaults guard (NFR-08)
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Phase 84 (I18N-01): init i18n. Backward-compat: existing installs without locale key default to 'ru'.
    const loadedLocale = (this.settings as unknown as Record<string, unknown>).locale;
    if (loadedLocale === undefined || loadedLocale === null) {
      this.settings.locale = 'ru';
      await this.saveSettings();
    }
    this.i18n = new I18nService(this.settings.locale);

    // Instantiate pure modules (no Obsidian dependency)
    // Phase 84 (I18N-02): inject the i18n translator so parse-time error messages follow the active locale.
    this.canvasParser = new CanvasParser(this.i18n.t.bind(this.i18n));
    this.protocolDocumentParser = new ProtocolDocumentParser(this.i18n.t.bind(this.i18n));
    this.protocolDocumentStore = new ProtocolDocumentStore(this.app);

    // Instantiate services
    // Phase 84 (I18N-01): SnippetService takes the plugin's i18n translator so
    // its error messages and validatePlaceholders output follow the active locale.
    this.snippetService = new SnippetService(this.app, this.settings, this.i18n.t.bind(this.i18n));

    // Phase 86 (TEMPLATE-LIB-01): template library service
    this.libraryService = new LibraryService(this.app, this.settings, this.snippetService, this.i18n.t.bind(this.i18n));

    // Instantiate live canvas editor (LIVE-01)
    this.canvasLiveEditor = new CanvasLiveEditor(this.app);

    // Instantiate canvas node factory (CANVAS-01)
    this.canvasNodeFactory = new CanvasNodeFactory(this.app);

    // Phase 50 D-01: own the vault.on('modify') subscription for bi-directional
    // Answer.displayLabel ↔ incoming-edge label sync. Design source:
    // .planning/notes/answer-label-edge-sync.md
    this.edgeLabelSyncService = new EdgeLabelSyncService(this.app, this);
    this.edgeLabelSyncService.register();

    // Commands — IDs intentionally omit plugin name prefix (NFR-06)

    // Register EditorPanelView ItemView (EDIT-01)
    this.registerView(EDITOR_PANEL_VIEW_TYPE, (leaf) => new EditorPanelView(leaf, this));

    // Register ProtocolEditorView ItemView (.rp.json visual editor)
    this.registerView(PROTOCOL_EDITOR_VIEW_TYPE, (leaf) => new ProtocolEditorView(leaf, this));

    // Register SnippetManagerView ItemView (SNIP-01)
    this.registerView(SNIPPET_MANAGER_VIEW_TYPE, (leaf) => new SnippetManagerView(leaf, this));

    // Command: open-snippet-manager (SNIP-01)
    this.addCommand({
      id: 'open-snippet-manager',
      name: 'Open snippet manager',
      callback: () => { void this.activateSnippetManagerView(); },
    });

    // Command: open-node-editor (EDIT-01 — opens editor panel; NFR-06: no plugin name prefix)
    this.addCommand({
      id: 'open-node-editor',
      name: 'Open node editor',
      callback: () => { void this.activateEditorPanelView(); },
    });

    // Command: open-protocol-editor — prompts for a .rp.json target, then opens the independent visual editor.
    this.addCommand({
      id: 'open-protocol-editor',
      name: 'Open protocol editor',
      callback: () => { void this.handleOpenProtocolEditor(); },
    });

    // Phase 45 (LOOP-06): start-from-node command (NFR-06: no plugin name prefix)
    this.addCommand({
      id: 'start-from-node',
      name: 'Start from specific node',
      callback: () => { void this.handleStartFromNode(); },
    });

    // Phase 54: inline protocol display mode — command palette only (D3, D9)
    this.addCommand({
      id: 'run-protocol-inline',
      name: 'Run protocol in inline',
      callback: () => { void this.handleRunProtocolInline(); },
    });

    // Settings tab
    this.addSettingTab(new RadiProtocolSettingsTab(this.app, this));

    // Context menu integration — EDIT-05
    // 'canvas:node-menu' is undocumented but confirmed in multiple community plugins.
    // Use typed cast to unknown then minimal interface to avoid 'any' (eslint no-explicit-any).
    type CanvasNodeMenuHandler = (menu: Menu, node: { id: string; canvas?: unknown }) => void;
    type EventRef = import('obsidian').EventRef;
    this.registerEvent(
      (this.app.workspace as unknown as {
        on(event: 'canvas:node-menu', handler: CanvasNodeMenuHandler): EventRef;
      }).on('canvas:node-menu', (menu: Menu, node: { id: string; canvas?: unknown }) => {
        const nodeId = node.id;

        // Derive canvas file path from the active canvas leaf
        const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
        // The node object's 'canvas' property is the internal CanvasView instance —
        // use it only to match the leaf; extract only id and file path, nothing else.
        const activeLeaf = canvasLeaves.find(leaf => {
          const view = leaf.view as unknown as { canvas?: unknown };
          return view.canvas === node.canvas;
        });
        const filePath = (activeLeaf?.view as { file?: { path: string } } | undefined)?.file?.path;

        if (!filePath) return; // Not triggered from a canvas leaf — skip

        menu.addSeparator();
        menu.addItem(item =>
          item
            .setTitle('Edit protocol properties')
            .setSection('radiprotocol')
            .onClick(() => {
              void this.openEditorPanelForNode(filePath, nodeId);
            })
        );
      })
    );

    console.debug('[RadiProtocol] Plugin loaded');
  }

  async onunload(): Promise<void> {
    // WR-05: dismiss the canvas picker modal if it's still open
    if (this.pickerModal !== null) {
      this.pickerModal.close();
      this.pickerModal = null;
    }
    // Phase 85 INLINE-MULTI-01: close any open inline runners to prevent DOM leaks.
    for (const modal of this.inlineRunners.values()) {
      modal.close();
    }
    this.inlineRunners.clear();
    this.canvasLiveEditor.destroy();
    this.canvasNodeFactory.destroy();
    this.edgeLabelSyncService.destroy();
    console.debug('[RadiProtocol] Plugin unloaded');
  }

  // Phase 85 INLINE-MULTI-01: registry API for inline runner instances. Key is
  // `${protocolPath}#${notePath}`. Each instance unregisters itself on close().
  registerInlineRunner(key: string, modal: InlineRunnerModal): void {
    this.inlineRunners.set(key, modal);
  }

  unregisterInlineRunner(key: string): void {
    this.inlineRunners.delete(key);
  }

  getInlineRunner(key: string): InlineRunnerModal | null {
    return this.inlineRunners.get(key) ?? null;
  }

  // Phase 85 INLINE-MULTI-02: returns currently-open inline runners in registry order
  // so the cascade-position logic can offset the new instance from the last one opened.
  getOpenInlineRunners(): InlineRunnerModal[] {
    return Array.from(this.inlineRunners.values());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  getInlineRunnerPosition(): InlineRunnerLayout | null {
    return this.settings.inlineRunnerPosition ?? null;
  }

  async saveInlineRunnerPosition(layout: InlineRunnerLayout | null): Promise<void> {
    this.settings.inlineRunnerPosition = layout;
    await this.saveSettings();
  }

  async activateEditorPanelView(): Promise<void> {
    const { workspace } = this.app;
    workspace.detachLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: EDITOR_PANEL_VIEW_TYPE, active: true });
      const activeLeaf = workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE)[0];
      if (activeLeaf !== undefined) {
        void workspace.revealLeaf(activeLeaf);
      }
    }
  }

  async ensureEditorPanelVisible(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
    if (leaves.length > 0 && leaves[0] !== undefined) {
      void workspace.revealLeaf(leaves[0]);
      return;
    }
    // No existing leaf — create one in the right sidebar
    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: EDITOR_PANEL_VIEW_TYPE, active: true });
      const newLeaves = workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
      if (newLeaves[0] !== undefined) {
        void workspace.revealLeaf(newLeaves[0]);
      }
    }
  }

  async activateProtocolEditorView(protocolPath?: string): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(PROTOCOL_EDITOR_VIEW_TYPE)[0];
    const leaf = existing ?? workspace.getLeaf(false);
    if (leaf === null) return;

    if (existing === undefined) {
      await leaf.setViewState({ type: PROTOCOL_EDITOR_VIEW_TYPE, active: true });
    }
    void workspace.revealLeaf(leaf);

    if (protocolPath !== undefined) {
      const view = leaf.view;
      if (view instanceof ProtocolEditorView) {
        await view.loadProtocol(protocolPath);
      }
    }
  }

  private async handleOpenProtocolEditor(): Promise<void> {
    const folderPath = normalizeProtocolFolderPath(this.settings.protocolFolderPath);
    if (folderPath === '') {
      new Notice(this.i18n.t('protocolEditor.setProtocolFolderFirst'));
      await this.activateProtocolEditorView();
      return;
    }

    const protocolFiles = resolveProtocolDocumentFiles(this.app.vault, folderPath);
    const modal = new ProtocolEditorPickerModal(
      this.app,
      protocolFiles,
      this.i18n.t.bind(this.i18n),
      (file) => {
        this.pickerModal = null;
        void this.activateProtocolEditorView(file.path);
      },
      (title) => {
        this.pickerModal = null;
        void this.createAndOpenProtocol(folderPath, title);
      },
    );
    this.pickerModal = modal;
    modal.open();
  }

  private async createAndOpenProtocol(folderPath: string, title: string): Promise<void> {
    try {
      const { file } = await this.protocolDocumentStore.create(folderPath, title, protocolDocumentId());
      new Notice(this.i18n.t('protocolEditor.protocolCreated', { title: protocolDisplayName(file) }));
      await this.activateProtocolEditorView(file.path);
    } catch (err) {
      new Notice(this.i18n.t('protocolEditor.createProtocolFailed', { error: String(err) }));
    }
  }

  async activateSnippetManagerView(): Promise<void> {
    const { workspace } = this.app;
    workspace.detachLeavesOfType(SNIPPET_MANAGER_VIEW_TYPE);
    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: SNIPPET_MANAGER_VIEW_TYPE, active: true });
      const activeLeaf = workspace.getLeavesOfType(SNIPPET_MANAGER_VIEW_TYPE)[0];
      if (activeLeaf !== undefined) {
        void workspace.revealLeaf(activeLeaf);
      }
    }
  }

  async openEditorPanelForNode(filePath: string, nodeId: string): Promise<void> {
    await this.activateEditorPanelView();
    const leaves = this.app.workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
    const leaf = leaves[0];
    if (leaf === undefined) return;
    const view = leaf.view;
    if (view instanceof EditorPanelView) {
      view.loadNode(filePath, nodeId);
    }
  }

  /**
   * Phase 45 (LOOP-06, D-12/D-13): "Start from specific node" command callback.
   *
   * Flow:
   *   1. Discover active canvas leaf (editor-panel pattern).
   *   2. Read canvas content (live-JSON preferred, disk fallback — Pitfall BUG-02/03).
   *   3. Parse via CanvasParser; validate via GraphValidator.
   *   4. Any parse/validate error -> Notice + abort (D-CL-06 - validator blocks start
   *      including MIGRATE-01 on legacy loop-start/loop-end).
   *   5. buildNodeOptions produces 4-kind picker list (Plan 45-01).
   *   6. Check active file is a markdown note. On pick, open InlineRunnerModal.
   */
  private async handleStartFromNode(): Promise<void> {
    // 1. Find active canvas leaf — same pattern as editor-panel-view.ts:54-57
    const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
    const activeLeaf = this.app.workspace.getMostRecentLeaf();
    const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
    if (!canvasLeaf) {
      new Notice('Open a canvas first.');
      return;
    }

    const canvasPath = (canvasLeaf.view as { file?: { path: string } }).file?.path;
    if (!canvasPath) {
      new Notice('Active canvas has no file path.');
      return;
    }

    // 2. Read canvas content — prefer live in-memory JSON (BUG-02/03 avoidance).
    let content: string;
    const liveJson = this.canvasLiveEditor.getCanvasJSON(canvasPath);
    if (liveJson !== null) {
      content = liveJson;
    } else {
      const file = this.app.vault.getAbstractFileByPath(canvasPath);
      if (!(file instanceof TFile)) {
        new Notice('Canvas file not found.');
        return;
      }
      try {
        content = await this.app.vault.read(file);
      } catch {
        new Notice('Could not read canvas file.');
        return;
      }
    }

    // 3. Parse
    const parseResult = this.canvasParser.parse(content, canvasPath);
    if (!parseResult.success) {
      new Notice(`Canvas parse failed: ${parseResult.error}`);
      return;
    }

    // 4. Validate — MIGRATE-01 (legacy loop-start/loop-end) blocks start per D-CL-06.
    // Phase 51 D-04 (PICKER-01): inject snippet-file probe so specific-bound
    // SnippetNode references are verified at canvas-open. Legacy directory-bound
    // snippets are unaffected (probe never invoked when radiprotocol_snippetPath is absent).
    // See `.planning/notes/snippet-node-binding-and-picker.md`.
    const validator = new GraphValidator({
      snippetFileProbe: (absPath) => this.app.vault.getAbstractFileByPath(absPath) !== null,
      snippetFolderPath: this.settings.snippetFolderPath,
      // Phase 84 (I18N-02): localized validator messages.
      t: this.i18n.t.bind(this.i18n),
    });
    const errors = validator.validate(parseResult.graph);
    if (errors.length > 0) {
      const firstError = errors[0] ?? 'Canvas validation failed.';
      new Notice(`Canvas validation failed: ${firstError}`);
      return;
    }

    // 5. Build picker options (4 kinds via Plan 45-01)
    const options = buildNodeOptions(parseResult.graph);
    if (options.length === 0) {
      new Notice('No startable nodes in this canvas.');
      return;
    }

    // 6. Active file must be a markdown note
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile === null || activeFile.extension !== 'md') {
      new Notice('Open a Markdown note first, then run this command.');
      return;
    }

    // Open node picker; on pick, launch InlineRunnerModal at the chosen node
    new NodePickerModal(this.app, options, (opt) => {
      const modal = new InlineRunnerModal(this.app, this, canvasPath, activeFile, opt.id);
      void modal.open();
    }).open();
  }

  /**
   * Phase 54: "Run protocol in inline" command callback.
   *
   * Flow:
   *   1. D9 guard — check active file is a markdown note.
   *   2. Protocol folder enumeration — D8 guard.
   *   3. Canvas picker via SuggestModal.
   *   4. Instantiate InlineRunnerModal + open().
   */
  private async handleRunProtocolInline(): Promise<void> {
    // D9 guard: active file must be a markdown note
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile === null || activeFile.extension !== 'md') {
      new Notice('Open a Markdown note first, then run this command.');
      return;
    }

    // Protocol folder enumeration
    const folderPath = this.settings.protocolFolderPath.trim();
    if (folderPath === '') {
      new Notice('Set a protocol folder in settings to get started.');
      return;
    }

    // Protocol document enumeration. Handles trailing/leading slashes, Windows
    // backslash, and vault-index null fallback.
    const protocolFiles = resolveProtocolDocumentFiles(this.app.vault, folderPath);

    // D8 guard: empty list
    if (protocolFiles.length === 0) {
      new Notice(`No protocol files found in '${folderPath}'.`);
      return;
    }

    // Protocol picker via SuggestModal
    this.pickerModal = new ProtocolPickerSuggestModal(this.app, protocolFiles, (item) => {
      this.pickerModal = null;
      void this.openInlineRunner(item.file, activeFile);
    });

    this.pickerModal.open();
  }

  /** Open the InlineRunnerModal for a selected protocol and target note.
   *  Phase 85 INLINE-MULTI-01: if a runner for the same (protocolPath, notePath) is
   *  already open, focus the existing instance instead of spawning a duplicate. */
  private async openInlineRunner(protocolFile: TFile, targetNote: TFile): Promise<void> {
    const key = `${protocolFile.path}#${targetNote.path}`;
    const existing = this.getInlineRunner(key);
    if (existing !== null) {
      existing.focus();
      return;
    }
    const modal = new InlineRunnerModal(this.app, this, protocolFile.path, targetNote);
    await modal.open();
    if (modal.isOpen()) {
      this.registerInlineRunner(key, modal);
    }
  }
}
