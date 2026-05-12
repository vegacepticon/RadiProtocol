// views/snippet-manager-view.ts
// Phase 33 Plan 04 (TREE-01..04, FOLDER-01..03, SYNC-01..03, DEL-02/03, MODAL-04):
// Recursive folder-tree view for the snippet library. Replaces the legacy
// master-detail layout. All create/edit flows route through SnippetEditorModal;
// all destructive actions route through ConfirmModal. Vault watchers provide a
// 120ms-debounced redraw when files change under settings.snippetFolderPath
// (D-18 prefix filter). The chip editor extracted in Plan 02 is reached via
// the modal, not directly.
import { ItemView, Modal, Notice, WorkspaceLeaf, setIcon, type EventRef } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { Snippet } from '../snippets/snippet-model';
import { SnippetEditorModal } from './snippet-editor-modal';
import { ConfirmModal } from './confirm-modal';
import { LibraryBrowserModal } from './library-browser-modal';
import { SnippetTreePicker } from './snippet-tree-picker';
import { rewriteCanvasRefs } from '../snippets/canvas-ref-sync';
import { rewriteProtocolSnippetRefs } from '../snippets/protocol-ref-sync';
import { toCanvasKey } from '../snippets/snippet-service';
import { SnippetManagerTreeRenderer } from './snippet-manager/tree-renderer';
import type { TreeNode, TreeNodeFolder, TreeNodeFile } from './snippet-manager/tree-renderer';
import { basenameNoExt } from './snippet-manager/tree-renderer';

export const SNIPPET_MANAGER_VIEW_TYPE = 'radiprotocol-snippet-manager';

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i > 0 ? path.slice(0, i) : '';
}

// ---------------------------------------------------------------------------
// SnippetManagerView
// ---------------------------------------------------------------------------
export class SnippetManagerView extends ItemView {
  private plugin: RadiProtocolPlugin;

  // DOM refs rebuilt on every render
  private treeRootEl!: HTMLElement;

  // Tree model cache
  private treeData: TreeNode[] = [];

  // Track which file path (if any) is currently being edited in a modal, so
  // renderTree can highlight the row (data-editing=true). Cleared on close.
  private currentlyEditingPath: string | null = null;

  // Phase 82 SPLIT-01 — tree rendering + DnD + inline rename extracted to
  // SnippetManagerTreeRenderer.
  private treeRenderer!: SnippetManagerTreeRenderer;

  // Debounced redraw timer id (window.setTimeout handle).
  private redrawTimer: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return SNIPPET_MANAGER_VIEW_TYPE; }
  getDisplayText(): string { return 'Snippet manager'; }
  getIcon(): string { return 'scissors'; }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------
  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('radi-snippet-tree-root');

    // Header strip with global "+ New" button
    const header = contentEl.createDiv({ cls: 'radi-snippet-tree-header' });
    const newBtn = header.createEl('button', { cls: 'mod-cta radi-snippet-tree-new-btn' });
    const newIcon = newBtn.createSpan({ cls: 'radi-snippet-tree-new-icon' });
    setIcon(newIcon, 'plus');
    newBtn.createSpan({ text: this.plugin.i18n.t('snippetManager.newButton') });
    this.registerDomEvent(newBtn, 'click', () => {
      void this.openCreateModal(this.plugin.settings.snippetFolderPath);
    });

    // Phase 37: Header "Create folder" button (CLEAN-03)
    const folderBtn = header.createEl('button', { cls: 'radi-snippet-tree-new-btn' });
    const folderIcon = folderBtn.createSpan({ cls: 'radi-snippet-tree-new-icon' });
    setIcon(folderIcon, 'folder-plus');
    folderBtn.createSpan({ text: this.plugin.i18n.t('snippetManager.folderButton') });
    this.registerDomEvent(folderBtn, 'click', () => {
      void this.handleCreateSubfolder(this.plugin.settings.snippetFolderPath);
    });

    // Phase 86 (TEMPLATE-LIB-02): Library browser button
    const libBtn = header.createEl('button', { cls: 'radi-snippet-tree-new-btn' });
    const libIcon = libBtn.createSpan({ cls: 'radi-snippet-tree-new-icon' });
    setIcon(libIcon, 'globe');
    libBtn.createSpan({ text: this.plugin.i18n.t('snippetManager.libraryButton') });
    this.registerDomEvent(libBtn, 'click', () => {
      void this.openLibraryBrowser();
    });

    // Tree container
    this.treeRootEl = contentEl.createDiv({ cls: 'radi-snippet-tree-body' });

    // Phase 82 SPLIT-01 — delegate tree rendering to SnippetManagerTreeRenderer.
    this.treeRenderer = new SnippetManagerTreeRenderer({
      container: this.treeRootEl,
      plugin: this.plugin,
      callbacks: {
        openEditModal: (path) => this.openEditModal(path),
        openCreateModal: (folderPath) => this.openCreateModal(folderPath),
        handleCreateSubfolder: (path) => this.handleCreateSubfolder(path),
        handleDeleteSnippet: (path, name) => this.handleDeleteSnippet(path, name),
        handleDeleteFolder: (path, name) => this.handleDeleteFolder(path, name),
        openMovePicker: (node) => this.openMovePicker(node),
        performMove: (srcPath, srcKind, dstFolder) => this.performMove(srcPath, srcKind, dstFolder),
        rebuildTreeModel: () => this.rebuildTreeModel(),
        saveSettings: () => this.plugin.saveSettings(),
        rewriteExpandState: (oldPath, newPath) => this.rewriteExpandState(oldPath, newPath),
      },
    });

    // Initial render
    await this.rebuildTreeModel();
    this.renderTree();

    // Vault watchers (SYNC-01..03 + D-18)
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (this.shouldHandle(file.path)) this.scheduleRedraw();
      }) as EventRef,
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (this.shouldHandle(file.path)) this.scheduleRedraw();
      }) as EventRef,
    );
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (this.shouldHandle(file.path) || this.shouldHandle(oldPath)) this.scheduleRedraw();
      }) as EventRef,
    );
  }

  async onClose(): Promise<void> {
    if (this.redrawTimer !== null) {
      window.clearTimeout(this.redrawTimer);
      this.redrawTimer = null;
    }
    this.contentEl.empty();
    // Vault event refs auto-detach via registerEvent; nothing else to release.
  }

  // -------------------------------------------------------------------------
  // Vault watcher — D-18 prefix filter + 120ms debounce
  // -------------------------------------------------------------------------
  private shouldHandle(filePath: string): boolean {
    const root = this.plugin.settings.snippetFolderPath;
    return filePath === root || filePath.startsWith(root + '/');
  }

  private scheduleRedraw(): void {
    if (this.redrawTimer !== null) window.clearTimeout(this.redrawTimer);
    this.redrawTimer = window.setTimeout(async () => {
      this.redrawTimer = null;
      try {
        await this.rebuildTreeModel();
        this.renderTree();
      } catch (e) {
        new Notice(this.plugin.i18n.t('snippetManager.redrawError'));
        console.error('[RadiProtocol] snippet tree redraw failed', e);
      }
    }, 120);
  }

  // -------------------------------------------------------------------------
  // Tree model build (recursive listFolder walk with D-04 sort)
  // -------------------------------------------------------------------------
  private async rebuildTreeModel(): Promise<void> {
    const root = this.plugin.settings.snippetFolderPath;
    this.treeData = await this.buildTreeChildren(root);
  }

  private async buildTreeChildren(folderPath: string): Promise<TreeNode[]> {
    let listing: { folders: string[]; snippets: Snippet[] };
    try {
      listing = await this.plugin.snippetService.listFolder(folderPath);
    } catch {
      return [];
    }

    const folderNodes: TreeNodeFolder[] = [];
    for (const folderName of listing.folders) {
      const childPath = folderPath + '/' + folderName;
      const children = await this.buildTreeChildren(childPath);
      folderNodes.push({
        kind: 'folder',
        path: childPath,
        name: folderName,
        children,
      });
    }
    folderNodes.sort((a, b) => a.name.localeCompare(b.name));

    const fileNodes: TreeNodeFile[] = listing.snippets.map((s) => ({
      kind: 'file',
      path: s.path,
      name: s.name || basenameNoExt(s.path),
      snippetKind: s.kind,
    }));
    fileNodes.sort((a, b) => a.name.localeCompare(b.name));

    // D-04: folders first, then files
    return [...folderNodes, ...fileNodes];
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  private renderTree(): void {
    this.treeRenderer.setCurrentlyEditingPath(this.currentlyEditingPath);
    this.treeRenderer.render(this.treeData);
  }

  // -------------------------------------------------------------------------
  // Modal wiring — create / edit snippet
  // -------------------------------------------------------------------------
  private async openEditModal(path: string): Promise<void> {
    const snippet = await this.plugin.snippetService.load(path);
    if (snippet === null) {
      new Notice(this.plugin.i18n.t('snippetManager.notFound'));
      await this.rebuildTreeModel();
      this.renderTree();
      return;
    }
    this.currentlyEditingPath = path;
    this.renderTree();
    const modal = new SnippetEditorModal(this.app, this.plugin, {
      mode: 'edit',
      initialFolder: dirname(path),
      snippet,
    });
    modal.open();
    const result = await modal.result;
    this.currentlyEditingPath = null;
    if (result.saved) {
      await this.rebuildTreeModel();
      this.renderTree();
    } else {
      // Cancelled — just drop the editing highlight
      this.renderTree();
    }
  }

  private async openCreateModal(folderPath: string): Promise<void> {
    const modal = new SnippetEditorModal(this.app, this.plugin, {
      mode: 'create',
      initialFolder: folderPath,
    });
    modal.open();
    const result = await modal.result;
    if (result.saved) {
      await this.rebuildTreeModel();
      this.renderTree();
    }
  }

  // -------------------------------------------------------------------------
  // Folder operations
  // -------------------------------------------------------------------------
  private async handleCreateSubfolder(parentPath: string): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    // Build a small form body with a text input for the subfolder name.
    const body = document.createElement('div');
    body.addClass('radi-snippet-subfolder-form');
    const label = body.createEl('label', { text: t('snippetManager.subfolderNameLabel') });
    const input = body.createEl('input', { type: 'text' });
    input.placeholder = t('snippetManager.subfolderNamePlaceholder');
    label.appendChild(input);

    const modal = new ConfirmModal(this.app, {
      title: t('snippetManager.createSubfolderTitle'),
      body,
      confirmLabel: t('snippetManager.createSubfolderConfirm'),
      cancelLabel: t('snippetManager.cancel'),
      destructive: false,
    });
    modal.open();
    // Focus the input after the modal opens
    setTimeout(() => { try { input.focus(); } catch { /* noop */ } }, 0);
    const result = await modal.result;
    if (result !== 'confirm') return;

    const trimmed = (input.value || '').trim();
    if (trimmed === '') {
      new Notice(t('snippetManager.subfolderEmptyName'));
      return;
    }
    if (/[\\/]/.test(trimmed) || trimmed === '..' || trimmed === '.') {
      new Notice(t('snippetManager.subfolderInvalidName'));
      return;
    }
    const newPath = parentPath + '/' + trimmed;
    try {
      await this.plugin.snippetService.createFolder(newPath);
      // Expand both parent and new subfolder so the user can see the result
      const expanded = this.plugin.settings.snippetTreeExpandedPaths;
      if (!expanded.includes(parentPath)) expanded.push(parentPath);
      if (!expanded.includes(newPath)) expanded.push(newPath);
      await this.plugin.saveSettings();
      await this.rebuildTreeModel();
      this.renderTree();
    } catch (e) {
      const error = (e as Error)?.message ?? t('snippetManager.unknownError');
      new Notice(t('snippetManager.createFolderError', { error }));
    }
  }

  private async handleDeleteSnippet(path: string, name: string): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const modal = new ConfirmModal(this.app, {
      title: t('snippetManager.deleteSnippetTitle'),
      body: t('snippetManager.deleteSnippetBody', { name }),
      confirmLabel: t('snippetManager.deleteConfirm'),
      cancelLabel: t('snippetManager.cancel'),
      destructive: true,
    });
    modal.open();
    const result = await modal.result;
    if (result !== 'confirm') return;
    try {
      await this.plugin.snippetService.delete(path);
      new Notice(t('snippetManager.deletedNotice'));
      await this.rebuildTreeModel();
      this.renderTree();
    } catch (e) {
      const error = (e as Error)?.message ?? t('snippetManager.unknownError');
      new Notice(t('snippetManager.deleteError', { error }));
    }
  }

  private async handleDeleteFolder(path: string, name: string): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const descendants = await this.plugin.snippetService.listFolderDescendants(path);
    const total = descendants.total;

    const body = document.createElement('div');
    body.addClass('radi-snippet-folder-delete-body');
    const intro = body.createEl('p');
    intro.setText(
      total === 0
        ? t('snippetManager.emptyFolderBody')
        : t('snippetManager.folderItemsBody', { count: String(total) }),
    );
    if (total > 0) {
      const allPaths = [...descendants.files, ...descendants.folders];
      const shown = allPaths.slice(0, 10);
      const list = body.createEl('ul');
      const rootPrefix = path + '/';
      for (const p of shown) {
        const rel = p.startsWith(rootPrefix) ? p.slice(rootPrefix.length) : p;
        const li = list.createEl('li');
        li.createEl('code', { text: rel });
      }
      if (total > 10) {
        const more = body.createEl('p', { cls: 'radi-muted' });
        more.setText(t('snippetManager.moreItems', { count: String(total - 10) }));
      }
    }

    const modal = new ConfirmModal(this.app, {
      title: t('snippetManager.deleteFolderTitle', { name }),
      body,
      confirmLabel: t('snippetManager.deleteFolderConfirm'),
      cancelLabel: t('snippetManager.cancel'),
      destructive: true,
    });
    modal.open();
    const result = await modal.result;
    if (result !== 'confirm') return;
    try {
      await this.plugin.snippetService.deleteFolder(path);
      new Notice(t('snippetManager.folderDeletedNotice'));
      // Drop the folder path from expanded state so the cached tree does not
      // try to re-expand a now-missing node on next render.
      const expanded = this.plugin.settings.snippetTreeExpandedPaths;
      const idx = expanded.indexOf(path);
      if (idx >= 0) {
        expanded.splice(idx, 1);
        await this.plugin.saveSettings();
      }
      await this.rebuildTreeModel();
      this.renderTree();
    } catch (e) {
      const error = (e as Error)?.message ?? t('snippetManager.unknownError');
      new Notice(t('snippetManager.deleteFolderError', { error }));
    }
  }

  // -------------------------------------------------------------------------
  // Phase 34 Plan 01 — move-to flow
  // -------------------------------------------------------------------------
  private async openMovePicker(node: TreeNode): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    let allFolders: string[];
    try {
      allFolders = await this.plugin.snippetService.listAllFolders();
    } catch (e) {
      const error = (e as Error)?.message ?? t('snippetManager.unknownError');
      new Notice(t('snippetManager.listFoldersError', { error }));
      console.error('[RadiProtocol] openMovePicker listAllFolders failed', e);
      return;
    }

    // Build allowed-destination list.
    let folders: string[];
    if (node.kind === 'file') {
      // For files: all folders are valid destinations except the current parent
      // (no-op move). Still keep the current parent filtered so the UI is clean.
      const currentParent = dirname(node.path);
      folders = allFolders.filter((f) => f !== currentParent);
    } else {
      // For folders: exclude the folder itself AND all descendants (self-nest).
      const src = node.path;
      const prefix = src + '/';
      folders = allFolders.filter((f) => f !== src && !f.startsWith(prefix));
    }

    const onChoose = async (chosen: string): Promise<void> => {
      try {
        await this.performMove(node.path, node.kind, chosen);
      } catch (e) {
        const error = (e as Error)?.message ?? t('snippetManager.unknownError');
        new Notice(t('snippetManager.moveError', { error }));
        console.error('[RadiProtocol] openMovePicker move failed', e);
      }
    };

    // Phase 51 D-07 (PICKER-02) — inline Modal hosting a folder-only SnippetTreePicker
    // replaces the legacy flat-list picker.
    // Host wrapper class `rp-stp-modal-host` is defined in src/styles/snippet-tree-picker.css
    // (owned by Plan 02). This plan does NOT modify CSS.
    // See `.planning/notes/snippet-node-binding-and-picker.md`.
    const rootPath = this.plugin.settings.snippetFolderPath;
    // `folders` is the whitelist of valid move destinations (verified at
    // snippet-manager-view.ts:642-654). Membership check: target is valid iff included
    // in the `folders` whitelist.
    const allowedSet = new Set(folders);

    const modal = new Modal(this.app);
    modal.setTitle(t('snippetManager.moveTitle'));
    let pickerInstance: SnippetTreePicker | null = null;

    const handleSelect = async (result: { kind: 'folder' | 'file'; relativePath: string }): Promise<void> => {
      const absPath = result.relativePath === '' ? rootPath : `${rootPath}/${result.relativePath}`;
      // Move-target safety guard (D-07): block source-self and source-descendant targets.
      if (absPath === node.path && node.kind === 'folder') {
        new Notice(t('snippetManager.moveSelfError'));
        return;
      }
      if (node.kind === 'folder' && absPath.startsWith(node.path + '/')) {
        new Notice(t('snippetManager.moveSelfDescendantError'));
        return;
      }
      // Whitelist membership: target must be in the allow-list of valid destinations.
      if (!allowedSet.has(absPath)) {
        new Notice(t('snippetManager.invalidTargetError'));
        return;
      }
      modal.close();
      await onChoose(absPath);
    };

    modal.onOpen = () => {
      const host = modal.contentEl.createDiv({ cls: 'rp-stp-modal-host' });
      pickerInstance = new SnippetTreePicker({
        app: this.app,
        snippetService: this.plugin.snippetService,
        container: host,
        mode: 'folder-only',
        rootPath,
        onSelect: (result) => { void handleSelect(result); },
        t,
      });
      void pickerInstance.mount();
    };
    modal.onClose = () => {
      if (pickerInstance !== null) {
        pickerInstance.unmount();
        pickerInstance = null;
      }
    };
    modal.open();
  }

  // -------------------------------------------------------------------------
  // Phase 34 Plan 02 — shared move orchestrator. Used by both context-menu
  // move-to (Plan 01) and DnD drop handler (Plan 02). Throws on
  // failure; callers are responsible for Notice/console.error on rejection.
  // -------------------------------------------------------------------------
  private async performMove(
    srcPath: string,
    srcKind: 'file' | 'folder',
    dstFolder: string,
  ): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    if (srcKind === 'file') {
      // No-op: already in the target folder.
      if (dirname(srcPath) === dstFolder) return;
      const newPath = await this.plugin.snippetService.moveSnippet(srcPath, dstFolder);
      const snippetRoot = this.plugin.settings.snippetFolderPath;
      const mapping = new Map<string, string>([
        [toCanvasKey(srcPath, snippetRoot), toCanvasKey(newPath, snippetRoot)],
      ]);
      const canvasResult = await rewriteCanvasRefs(this.app, mapping, this.plugin.canvasLiveEditor);
      const protocolResult = await rewriteProtocolSnippetRefs(this.app, mapping);
      new Notice(t('snippetManager.movedFileNotice', {
        canvasCount: String(canvasResult.updated.length),
        protocolCount: String(protocolResult.updated.length),
      }));
      await this.rebuildTreeModel();
      this.renderTree();
      return;
    }

    // Folder branch — self/descendant guard BEFORE any I/O.
    if (srcPath === dstFolder || dstFolder.startsWith(srcPath + '/')) {
      throw new Error(t('snippetManager.cannotMoveIntoSelf'));
    }
    const oldPath = srcPath;
    const newPath = await this.plugin.snippetService.moveFolder(oldPath, dstFolder);
    const snippetRoot = this.plugin.settings.snippetFolderPath;
    const mapping = new Map<string, string>([
      [toCanvasKey(oldPath, snippetRoot), toCanvasKey(newPath, snippetRoot)],
    ]);
    const canvasResult = await rewriteCanvasRefs(this.app, mapping, this.plugin.canvasLiveEditor);
    const protocolResult = await rewriteProtocolSnippetRefs(this.app, mapping);

    // D-07: expand-state prefix rewrite.
    await this.rewriteExpandState(oldPath, newPath);

    new Notice(t('snippetManager.movedFolderNotice', {
      canvasCount: String(canvasResult.updated.length),
      protocolCount: String(protocolResult.updated.length),
    }));
    await this.rebuildTreeModel();
    this.renderTree();
  }

  // -------------------------------------------------------------------------
  // Phase 34 Plan 02 — HTML5 drag-and-drop handlers on tree rows.
  // Wired from `renderNode` via `registerDomEvent` for auto-cleanup.
  // D-04: `dragover.preventDefault()` is called ONLY when our custom MIME
  // is present in `dataTransfer.types`, so drops from OS, chip-editor, etc.
  // pass through unharmed.
  // -------------------------------------------------------------------------
  private async rewriteExpandState(oldPath: string, newPath: string): Promise<void> {
    const expanded = this.plugin.settings.snippetTreeExpandedPaths;
    let mutated = false;
    for (let i = 0; i < expanded.length; i++) {
      const entry = expanded[i]!;
      if (entry === oldPath) {
        expanded[i] = newPath;
        mutated = true;
      } else if (entry.startsWith(oldPath + '/')) {
        expanded[i] = newPath + entry.slice(oldPath.length);
        mutated = true;
      }
    }
    if (mutated) await this.plugin.saveSettings();
  }

  // Phase 86 (TEMPLATE-LIB-02): open the external snippet library browser.
  private openLibraryBrowser(): void {
    new LibraryBrowserModal(this.app, this.plugin).open();
  }
}