// main.ts
import { Plugin, Notice, TFile, SuggestModal, MarkdownView } from 'obsidian';
import { RadiProtocolSettings, DEFAULT_SETTINGS, RadiProtocolSettingsTab, type InlineRunnerLayout } from './settings';
import { ProtocolDocumentParser } from './protocol/protocol-document-parser';
import { ProtocolDocumentStore } from './protocol/protocol-document-store';
import { SnippetManagerView, SNIPPET_MANAGER_VIEW_TYPE } from './views/snippet-manager-view';
import { SnippetService } from './snippets/snippet-service';
// Phase 6 (library): forward-declared type so LibraryView type-checks standalone;
// the field is initialized in Phase 9.
import { LibraryView, LIBRARY_VIEW_TYPE } from './views/library-view';
import { RegistryClient, DEFAULT_REGISTRY_URL } from './library/registry-client';
import { LibraryService } from './library/library-service';
import type { InstalledRecord } from './library/library-model';
import { WriteMutex } from './utils/write-mutex';
import { I18nService } from './i18n';
import { normalizeProtocolFolderPath, resolveProtocolDocumentFiles } from './protocol/protocol-file-resolver';
// Phase 45 (LOOP-06): start-from-node command dependencies
import { NodePickerModal, buildStartableProtocolNodeOptions } from './views/node-picker-modal';
// Phase 54: inline protocol display mode
import { InlineRunnerModal } from './views/inline-runner-modal';
import { InsertSnippetModal } from './views/insert-snippet-modal';
import { SnippetEditorModal } from './views/snippet-editor-modal';
import { ProtocolEditorView, PROTOCOL_EDITOR_VIEW_TYPE } from './views/protocol-editor-view';
import {
  ProtocolEditorPickerModal,
  ProtocolPickerSuggestModal,
  protocolDisplayName,
  protocolDocumentId,
  type ProtocolEditorPickerSuggestion,
  type ProtocolPickerSuggestion,
  type LibraryPickerContext,
} from './views/protocol-picker-modal';


export default class RadiProtocolPlugin extends Plugin {
  settings!: RadiProtocolSettings;
  i18n!: I18nService;
  protocolDocumentParser!: ProtocolDocumentParser;
  protocolDocumentStore!: ProtocolDocumentStore;
  snippetService!: SnippetService;
  registryClient!: RegistryClient;
  // Forward-declared in Phase 6 so LibraryView type-checks; initialized in Phase 9.
  libraryService!: LibraryService;
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
    this.protocolDocumentParser = new ProtocolDocumentParser(this.i18n.t.bind(this.i18n));
    this.protocolDocumentStore = new ProtocolDocumentStore(this.app);

    // Instantiate services
    // Phase 84 (I18N-01): SnippetService takes the plugin's i18n translator so
    // its error messages and validatePlaceholders output follow the active locale.
    this.snippetService = new SnippetService(this.app, this.settings, this.i18n.t.bind(this.i18n));

    // Slice 9 — community library services (wired here; consumed by Slices 6-8 views).
    // libraryRegistryUrl is the advanced override (empty/undefined → DEFAULT_REGISTRY_URL
    // → "catalog unavailable" when the bundled default is also empty).
    this.registryClient = new RegistryClient({ baseUrl: this.settings.libraryRegistryUrl || DEFAULT_REGISTRY_URL });
    // Step 5 C11: normalize both roots so installer paths match resolver-enumerated
    // paths (trailing slashes/backslashes would otherwise mismatch). There is no
    // snippet-specific normalizer — the shared normalizeProtocolFolderPath is used
    // for both roots.
    const librarySettings = {
      protocolFolderPath: normalizeProtocolFolderPath(this.settings.protocolFolderPath),
      snippetFolderPath: normalizeProtocolFolderPath(this.settings.snippetFolderPath),
    };
    this.libraryService = new LibraryService(this.app, librarySettings, this.registryClient, { t: this.i18n.t.bind(this.i18n) });
    // Recovery on load: finalize any in-flight installs (never throws — rolls back
    // journals without a commit marker, commits valid ones). Runs before views are
    // registered so no user action can race a recovering install.
    await this.libraryService.recoverInterruptedInstalls();

    // Commands — IDs intentionally omit plugin name prefix (NFR-06)

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

    // Slice 9 — Register LibraryView ItemView (community library, D4 first-class view)
    this.registerView(LIBRARY_VIEW_TYPE, (leaf) => new LibraryView(leaf, this));

    // Command: open-community-library (NFR-06: no plugin name prefix)
    this.addCommand({
      id: 'open-community-library',
      name: 'Open community library',
      callback: () => { void this.activateLibraryView(); },
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

    this.addCommand({
      id: 'insert-snippet',
      name: 'Insert snippet',
      callback: () => { void this.handleInsertSnippet(); },
    });

    this.addCommand({
      id: 'create-snippet',
      name: 'Create snippet from selection',
      callback: () => { void this.handleCreateSnippet(); },
    });

    // Settings tab
    this.addSettingTab(new RadiProtocolSettingsTab(this.app, this));

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
    const libraryContext = await this.buildLibraryPickerContext(folderPath);
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
      libraryContext,
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
    const existing = workspace.getLeavesOfType(SNIPPET_MANAGER_VIEW_TYPE)[0];
    const leaf = existing ?? workspace.getLeaf(false);
    if (leaf === null) return;

    if (existing === undefined) {
      await leaf.setViewState({ type: SNIPPET_MANAGER_VIEW_TYPE, active: true });
    }
    void workspace.revealLeaf(leaf);
  }

  /** Slice 9 — activate the community library view (get-or-create leaf, modeled
   *  after activateSnippetManagerView). */
  async activateLibraryView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(LIBRARY_VIEW_TYPE)[0];
    const leaf = existing ?? workspace.getLeaf(false);
    if (leaf === null) return;
    if (existing === undefined) {
      await leaf.setViewState({ type: LIBRARY_VIEW_TYPE, active: true });
    }
    void workspace.revealLeaf(leaf);
  }

  /** Step 5 C12 — recreate the registry client + library service after the
   *  advanced libraryRegistryUrl setting changes, so the override takes effect
   *  without a plugin reload. libraryService.installer/recordStore/cacheStore are
   *  preserved (they own no URL-dependent state); only the URL-bound client is
   *  replaced. The LibraryView picks up the new service on its next refresh. */
  async rebuildLibraryServices(): Promise<void> {
    this.registryClient = new RegistryClient({ baseUrl: this.settings.libraryRegistryUrl || DEFAULT_REGISTRY_URL });
    this.libraryService = new LibraryService(this.app, {
      protocolFolderPath: normalizeProtocolFolderPath(this.settings.protocolFolderPath),
      snippetFolderPath: normalizeProtocolFolderPath(this.settings.snippetFolderPath),
    }, this.registryClient, { t: this.i18n.t.bind(this.i18n) });
  }

  /** Slice 9 — build the library-managed indicator context for protocol pickers.
   *  Best-effort: a listInstalled() failure yields an empty record list (no badge),
   *  never a throw. protocolRoot is the vault-relative protocol folder the picker
   *  is enumerating. */
  private async buildLibraryPickerContext(protocolRoot: string): Promise<LibraryPickerContext> {
    let installedRecords: InstalledRecord[] = [];
    try { installedRecords = await this.libraryService.listInstalled(); }
    catch { installedRecords = []; }
    return { protocolRoot, installedRecords };
  }

  /**
   * Start the inline runner from a selected start-enabled node in a .rp.json protocol.
   *
   * The command intentionally ignores any open Obsidian Canvas leaves: RadiProtocol's
   * active authoring/runtime path is .rp.json, so the node list must come only from
   * the configured protocol picker folder.
   */
  private async handleStartFromNode(): Promise<void> {
    await this.handleStartFromProtocolNode();
  }

  private async handleStartFromProtocolNode(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile === null || activeFile.extension !== 'md') {
      new Notice(this.i18n.t('insertSnippet.openMarkdownFirst'));
      return;
    }

    const folderPath = normalizeProtocolFolderPath(this.settings.protocolFolderPath);
    if (folderPath === '') {
      new Notice(this.i18n.t('protocolEditor.setProtocolFolderFirst'));
      return;
    }

    const protocolFiles = resolveProtocolDocumentFiles(this.app.vault, folderPath);
    if (protocolFiles.length === 0) {
      new Notice(this.i18n.t('command.noProtocolFiles', { folderPath }));
      return;
    }

    const libraryContext = await this.buildLibraryPickerContext(folderPath);
    this.pickerModal = new ProtocolPickerSuggestModal(
      this.app,
      protocolFiles,
      (item) => {
        this.pickerModal = null;
        void this.openProtocolStartNodePicker(item.file, activeFile);
      },
      libraryContext,
      this.i18n.t.bind(this.i18n),
    );
    this.pickerModal.open();
  }

  private async openProtocolStartNodePicker(protocolFile: TFile, activeFile: TFile): Promise<void> {
    let doc;
    try {
      doc = await this.protocolDocumentStore.read(protocolFile.path);
    } catch {
      new Notice(this.i18n.t('protocolEditor.loadFailed'));
      return;
    }

    if (doc === null) {
      new Notice(this.i18n.t('protocolEditor.loadFailed'));
      return;
    }

    const options = buildStartableProtocolNodeOptions(doc.nodes, this.i18n.t.bind(this.i18n));
    if (options.length === 0) {
      new Notice(this.i18n.t('startFromNode.noStartPoints'));
      return;
    }

    new NodePickerModal(this.app, options, (opt) => {
      const modal = new InlineRunnerModal(this.app, this, protocolFile.path, activeFile, opt.id);
      void modal.open();
    }, this).open();
  }

  private async handleInsertSnippet(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile === null || activeFile.extension !== 'md') {
      new Notice(this.i18n.t('insertSnippet.openMarkdownFirst'));
      return;
    }

    const modal = new InsertSnippetModal(this.app, this);
    modal.open();
    const rendered = await modal.result;
    if (rendered === null) return;

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = activeView?.editor;
    if (editor !== undefined) {
      editor.replaceSelection(rendered);
      new Notice(this.i18n.t('insertSnippet.inserted'));
      return;
    }

    await this.insertMutex.runExclusive(activeFile.path, async () => {
      const current = await this.app.vault.read(activeFile);
      const separator = current.endsWith('\n') || current.length === 0 ? '' : '\n';
      await this.app.vault.modify(activeFile, `${current}${separator}${rendered}`);
    });
    new Notice(this.i18n.t('insertSnippet.inserted'));
  }

  /**
   * "Create snippet from selection" command. Opens SnippetEditorModal in create
   * mode with the active Markdown editor's selection pre-filled as the template.
   *
   * No md-guard bail: when there is no active MarkdownView or no selection, the
   * modal still opens with an empty template so the command remains useful for
   * authoring a snippet from scratch.
   */
  private async handleCreateSnippet(): Promise<void> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const initialTemplate = activeView?.editor?.getSelection() ?? '';

    const modal = new SnippetEditorModal(this.app, this, {
      mode: 'create',
      initialFolder: this.settings.snippetFolderPath,
      initialTemplate,
    });
    modal.open();
    const result = await modal.result;
    if (result.saved) {
      new Notice(this.i18n.t('snippetEditor.createdNotice'));
    }
  }

  /**
   * Phase 54: "Run protocol in inline" command callback.
   *
   * Flow:
   *   1. D9 guard — check active file is a markdown note.
   *   2. Protocol folder enumeration — D8 guard.
   *   3. .rp.json protocol picker via SuggestModal.
   *   4. Instantiate InlineRunnerModal + open().
   */
  private async handleRunProtocolInline(): Promise<void> {
    // D9 guard: active file must be a markdown note
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile === null || activeFile.extension !== 'md') {
      new Notice(this.i18n.t('command.openMarkdownFirst'));
      return;
    }

    // Protocol folder enumeration
    const folderPath = normalizeProtocolFolderPath(this.settings.protocolFolderPath);
    if (folderPath === '') {
      new Notice(this.i18n.t('command.setProtocolFolder'));
      return;
    }

    // Protocol document enumeration. Handles trailing/leading slashes, Windows
    // backslash, and vault-index null fallback.
    const protocolFiles = resolveProtocolDocumentFiles(this.app.vault, folderPath);

    // D8 guard: empty list
    if (protocolFiles.length === 0) {
      new Notice(this.i18n.t('command.noProtocolFiles', { folderPath }));
      return;
    }

    const libraryContext = await this.buildLibraryPickerContext(folderPath);

    // Protocol picker via SuggestModal
    this.pickerModal = new ProtocolPickerSuggestModal(
      this.app,
      protocolFiles,
      (item) => {
        this.pickerModal = null;
        void this.openInlineRunner(item.file, activeFile);
      },
      libraryContext,
      this.i18n.t.bind(this.i18n),
    );

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
