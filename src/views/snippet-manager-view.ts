// views/snippet-manager-view.ts
// Phase 33 Plan 04 (TREE-01..04, FOLDER-01..03, SYNC-01..03, DEL-02/03, MODAL-04):
// Recursive folder-tree view for the snippet library. Replaces the legacy
// master-detail layout. All create/edit flows route through SnippetEditorModal;
// all destructive actions route through ConfirmModal. Vault watchers provide a
// 120ms-debounced redraw when files change under settings.snippetFolderPath
// (D-18 prefix filter). The chip editor extracted in Plan 02 is reached via
// the modal, not directly.
import { ItemView, Menu, Notice, WorkspaceLeaf, setIcon, type EventRef } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { Snippet } from '../snippets/snippet-model';
import { SnippetEditorModal } from './snippet-editor-modal';
import { ConfirmModal } from './confirm-modal';
// Phase 34 Plan 01: «Переместить в…» context-menu flow
import { FolderPickerModal } from './folder-picker-modal';
import { rewriteCanvasRefs } from '../snippets/canvas-ref-sync';
import { toCanvasKey } from '../snippets/snippet-service';

export const SNIPPET_MANAGER_VIEW_TYPE = 'radiprotocol-snippet-manager';

// Phase 34 Plan 02: HTML5 DnD custom MIME types (D-04).
// Kept private to this module so foreign drops (OS files, Obsidian file
// explorer, chip-editor) are never accidentally intercepted.
const MIME_FILE = 'application/x-radi-snippet-file';
const MIME_FOLDER = 'application/x-radi-snippet-folder';

// ---------------------------------------------------------------------------
// Internal tree model
// ---------------------------------------------------------------------------
interface TreeNodeFolder {
  kind: 'folder';
  path: string;
  name: string;
  children: TreeNode[];
}
interface TreeNodeFile {
  kind: 'file';
  path: string;
  name: string;
  snippetKind: 'json' | 'md';
}
type TreeNode = TreeNodeFolder | TreeNodeFile;

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i > 0 ? path.slice(0, i) : '';
}

function basenameNoExt(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function iconForNode(node: TreeNode, expanded: boolean): string {
  if (node.kind === 'folder') return expanded ? 'folder-open' : 'folder';
  return node.snippetKind === 'json' ? 'file-json' : 'file-text';
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

  // Phase 34 Plan 03 — inline rename state.
  // `currentlyRenamingPath` gates startInlineRename so only one row at a
  // time can be in rename mode. `rowLabelEls` is a path → label span map
  // populated during renderNode so context-menu «Переименовать» can locate
  // the label element without walking the DOM.
  private currentlyRenamingPath: string | null = null;
  private rowLabelEls: Map<string, HTMLElement> = new Map();

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

    // Header strip with global "+ Новый" button
    const header = contentEl.createDiv({ cls: 'radi-snippet-tree-header' });
    const newBtn = header.createEl('button', { cls: 'mod-cta radi-snippet-tree-new-btn' });
    const newIcon = newBtn.createSpan({ cls: 'radi-snippet-tree-new-icon' });
    setIcon(newIcon, 'plus');
    newBtn.createSpan({ text: 'Новый' });
    this.registerDomEvent(newBtn, 'click', () => {
      void this.openCreateModal(this.plugin.settings.snippetFolderPath);
    });

    // Phase 37: Header "Create folder" button (CLEAN-03)
    const folderBtn = header.createEl('button', { cls: 'radi-snippet-tree-new-btn' });
    const folderIcon = folderBtn.createSpan({ cls: 'radi-snippet-tree-new-icon' });
    setIcon(folderIcon, 'folder-plus');
    folderBtn.createSpan({ text: 'Папка' });
    this.registerDomEvent(folderBtn, 'click', () => {
      void this.handleCreateSubfolder(this.plugin.settings.snippetFolderPath);
    });

    // Tree container
    this.treeRootEl = contentEl.createDiv({ cls: 'radi-snippet-tree-body' });

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
    this.rowLabelEls.clear();
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
        new Notice('Не удалось обновить список сниппетов. Подробности в консоли.');
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
    this.treeRootEl.empty();
    this.rowLabelEls.clear();

    if (this.treeData.length === 0) {
      this.renderEmptyState(this.treeRootEl);
      return;
    }

    for (const node of this.treeData) {
      this.renderNode(this.treeRootEl, node, 0);
    }
  }

  private renderEmptyState(container: HTMLElement): void {
    const wrap = container.createDiv({ cls: 'radi-snippet-tree-empty-state' });
    wrap.createEl('h3', { text: 'Библиотека сниппетов пуста' });
    wrap.createEl('p', {
      text: 'Создайте первый сниппет, чтобы вставлять фрагменты текста при прохождении протоколов.',
    });
    const ghost = wrap.createEl('button', {
      cls: 'mod-cta',
      text: '+ Новый сниппет',
    });
    this.registerDomEvent(ghost, 'click', () => {
      void this.openCreateModal(this.plugin.settings.snippetFolderPath);
    });
  }

  private isExpanded(path: string): boolean {
    return this.plugin.settings.snippetTreeExpandedPaths.includes(path);
  }

  private renderNode(container: HTMLElement, node: TreeNode, depth: number): void {
    const row = container.createDiv({ cls: 'radi-snippet-tree-row' });
    row.setAttribute('data-path', node.path);
    row.setAttribute('data-kind', node.kind);
    // Phase 34 Plan 03: F2 keydown requires row to be focusable.
    row.setAttribute('tabindex', '0');
    if (node.kind === 'file' && this.currentlyEditingPath === node.path) {
      row.setAttribute('data-editing', 'true');
    }

    const indent = row.createSpan({ cls: 'radi-snippet-tree-indent' });
    indent.style.width = `${depth * 16}px`;
    indent.style.display = 'inline-block';

    const expanded = node.kind === 'folder' ? this.isExpanded(node.path) : false;

    if (node.kind === 'folder') {
      const chev = row.createSpan({ cls: 'radi-snippet-tree-chevron' });
      setIcon(chev, expanded ? 'chevron-down' : 'chevron-right');
    } else {
      // Spacer to keep labels aligned when there is no chevron
      const spacer = row.createSpan({ cls: 'radi-snippet-tree-chevron-spacer' });
      spacer.style.display = 'inline-block';
      spacer.style.width = '12px';
    }

    const iconEl = row.createSpan({ cls: 'radi-snippet-tree-icon' });
    setIcon(iconEl, iconForNode(node, expanded));

    const labelEl = row.createSpan({ cls: 'radi-snippet-tree-label', text: node.name });
    // Phase 34 Plan 03 — cache label for context-menu «Переименовать».
    this.rowLabelEls.set(node.path, labelEl);

    if (node.kind === 'folder') {
      const actions = row.createSpan({ cls: 'radi-snippet-tree-actions' });
      const addBtn = actions.createEl('button', {
        cls: 'radi-snippet-tree-add-btn',
        attr: { 'aria-label': 'Создать в этой папке', title: 'Создать в этой папке' },
      });
      setIcon(addBtn, 'plus');
      this.registerDomEvent(addBtn, 'click', (ev) => {
        ev.stopPropagation();
        void this.openCreateModal(node.path);
      });
    }

    // Row click: file → open edit modal; folder → toggle expand
    this.registerDomEvent(row, 'click', (ev) => {
      // Ignore clicks on embedded buttons (hover "+" / actions)
      const target = ev.target as HTMLElement | null;
      if (target !== null && target.closest('button') !== null && target !== row) return;
      if (node.kind === 'file') {
        void this.openEditModal(node.path);
      } else {
        void this.toggleExpand(node.path);
      }
    });

    // Context menu (right-click)
    this.registerDomEvent(row, 'contextmenu', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.openContextMenu(ev as MouseEvent, node);
    });

    // Phase 34 Plan 02 — HTML5 drag-and-drop lifecycle.
    row.setAttribute('draggable', 'true');
    this.registerDomEvent(row, 'dragstart', (ev) => {
      this.handleDragStart(row, node, ev as DragEvent);
    });
    this.registerDomEvent(row, 'dragover', (ev) => {
      this.handleDragOver(row, node, ev as DragEvent);
    });
    this.registerDomEvent(row, 'dragleave', (ev) => {
      this.handleDragLeave(row, ev as DragEvent);
    });
    this.registerDomEvent(row, 'drop', (ev) => {
      void this.handleDrop(node, row, ev as DragEvent);
    });
    this.registerDomEvent(row, 'dragend', () => {
      this.handleDragEnd(row);
    });

    // Phase 34 Plan 03 — F2 keydown inline rename trigger.
    this.registerDomEvent(row, 'keydown', (ev) => {
      const ke = ev as KeyboardEvent;
      if (ke.key !== 'F2') return;
      ke.preventDefault();
      this.startInlineRename(node, labelEl);
    });

    // Children (folders only, when expanded)
    if (node.kind === 'folder' && expanded) {
      if (node.children.length === 0) {
        const empty = container.createDiv({ cls: 'radi-snippet-tree-row radi-snippet-tree-empty-placeholder' });
        const emptyIndent = empty.createSpan({ cls: 'radi-snippet-tree-indent' });
        emptyIndent.style.width = `${(depth + 1) * 16}px`;
        emptyIndent.style.display = 'inline-block';
        empty.createSpan({ text: '(пусто)', cls: 'radi-snippet-tree-empty-label' });
      } else {
        for (const child of node.children) {
          this.renderNode(container, child, depth + 1);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Expand / collapse persistence
  // -------------------------------------------------------------------------
  private async toggleExpand(path: string): Promise<void> {
    const list = this.plugin.settings.snippetTreeExpandedPaths;
    const idx = list.indexOf(path);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(path);
    }
    await this.plugin.saveSettings();
    this.renderTree();
  }

  // -------------------------------------------------------------------------
  // Context menu
  // -------------------------------------------------------------------------
  private openContextMenu(ev: MouseEvent, node: TreeNode): void {
    const menu = new Menu();
    if (node.kind === 'file') {
      menu.addItem((item) =>
        item
          .setTitle('Редактировать')
          .setIcon('pencil')
          .onClick(() => { void this.openEditModal(node.path); }),
      );
      // Phase 34 Plan 03: «Переименовать»
      menu.addItem((item) =>
        item
          .setTitle('Переименовать')
          .setIcon('pencil-line')
          .onClick(() => {
            const labelEl = this.rowLabelEls.get(node.path);
            if (labelEl !== undefined) this.startInlineRename(node, labelEl);
          }),
      );
      // Phase 34 Plan 01: «Переместить в…»
      menu.addItem((item) =>
        item
          .setTitle('Переместить в…')
          .setIcon('folder-input')
          .onClick(() => { void this.openMovePicker(node); }),
      );
      menu.addSeparator();
      menu.addItem((item) =>
        item
          .setTitle('Удалить')
          .setIcon('trash')
          .onClick(() => { void this.handleDeleteSnippet(node.path, node.name); }),
      );
    } else {
      menu.addItem((item) =>
        item
          .setTitle('Создать сниппет здесь')
          .setIcon('plus')
          .onClick(() => { void this.openCreateModal(node.path); }),
      );
      menu.addItem((item) =>
        item
          .setTitle('Создать подпапку')
          .setIcon('folder-plus')
          .onClick(() => { void this.handleCreateSubfolder(node.path); }),
      );
      // Phase 34 Plan 03: «Переименовать»
      menu.addItem((item) =>
        item
          .setTitle('Переименовать')
          .setIcon('pencil-line')
          .onClick(() => {
            const labelEl = this.rowLabelEls.get(node.path);
            if (labelEl !== undefined) this.startInlineRename(node, labelEl);
          }),
      );
      // Phase 34 Plan 01: «Переместить в…»
      menu.addItem((item) =>
        item
          .setTitle('Переместить в…')
          .setIcon('folder-input')
          .onClick(() => { void this.openMovePicker(node); }),
      );
      menu.addSeparator();
      menu.addItem((item) =>
        item
          .setTitle('Удалить папку')
          .setIcon('trash')
          .onClick(() => { void this.handleDeleteFolder(node.path, node.name); }),
      );
    }
    menu.showAtMouseEvent(ev);
  }

  // -------------------------------------------------------------------------
  // Modal wiring — create / edit snippet
  // -------------------------------------------------------------------------
  private async openEditModal(path: string): Promise<void> {
    const snippet = await this.plugin.snippetService.load(path);
    if (snippet === null) {
      new Notice('Сниппет не найден.');
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
    // Build a small form body with a text input for the subfolder name.
    const body = document.createElement('div');
    body.addClass('radi-snippet-subfolder-form');
    const label = body.createEl('label', { text: 'Имя подпапки' });
    const input = body.createEl('input', { type: 'text' });
    input.placeholder = 'например: обследования';
    label.appendChild(input);

    const modal = new ConfirmModal(this.app, {
      title: 'Создать подпапку',
      body,
      confirmLabel: 'Создать',
      cancelLabel: 'Отмена',
      destructive: false,
    });
    modal.open();
    // Focus the input after the modal opens
    setTimeout(() => { try { input.focus(); } catch { /* noop */ } }, 0);
    const result = await modal.result;
    if (result !== 'confirm') return;

    const trimmed = (input.value || '').trim();
    if (trimmed === '') {
      new Notice('Имя подпапки не может быть пустым.');
      return;
    }
    if (/[\\/]/.test(trimmed)) {
      new Notice('Имя подпапки не должно содержать «/» или «\\».');
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
      new Notice('Не удалось создать папку: ' + ((e as Error)?.message ?? 'неизвестная ошибка'));
    }
  }

  private async handleDeleteSnippet(path: string, name: string): Promise<void> {
    const modal = new ConfirmModal(this.app, {
      title: 'Удалить сниппет?',
      body: `Сниппет «${name}» будет перемещён в корзину Obsidian. Его можно восстановить через системный файловый менеджер.`,
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      destructive: true,
    });
    modal.open();
    const result = await modal.result;
    if (result !== 'confirm') return;
    try {
      await this.plugin.snippetService.delete(path);
      new Notice('Сниппет перемещён в корзину.');
      await this.rebuildTreeModel();
      this.renderTree();
    } catch (e) {
      new Notice('Не удалось удалить: ' + ((e as Error)?.message ?? 'неизвестная ошибка'));
    }
  }

  private async handleDeleteFolder(path: string, name: string): Promise<void> {
    const descendants = await this.plugin.snippetService.listFolderDescendants(path);
    const total = descendants.total;

    const body = document.createElement('div');
    body.addClass('radi-snippet-folder-delete-body');
    const intro = body.createEl('p');
    intro.setText(
      total === 0
        ? 'Папка пуста и будет перемещена в корзину.'
        : `В папке находится ${total} элементов. Все они будут перемещены в корзину:`,
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
        more.setText(`…и ещё ${total - 10} элементов.`);
      }
    }

    const modal = new ConfirmModal(this.app, {
      title: `Удалить папку ${name}?`,
      body,
      confirmLabel: 'Удалить папку',
      cancelLabel: 'Отмена',
      destructive: true,
    });
    modal.open();
    const result = await modal.result;
    if (result !== 'confirm') return;
    try {
      await this.plugin.snippetService.deleteFolder(path);
      new Notice('Папка перемещена в корзину.');
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
      new Notice('Не удалось удалить папку: ' + ((e as Error)?.message ?? 'неизвестная ошибка'));
    }
  }

  // -------------------------------------------------------------------------
  // Phase 34 Plan 01 — «Переместить в…» flow
  // -------------------------------------------------------------------------
  private async openMovePicker(node: TreeNode): Promise<void> {
    let allFolders: string[];
    try {
      allFolders = await this.plugin.snippetService.listAllFolders();
    } catch (e) {
      new Notice('Не удалось получить список папок: ' + ((e as Error)?.message ?? 'неизвестная ошибка'));
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
        new Notice('Не удалось переместить: ' + ((e as Error)?.message ?? 'неизвестная ошибка'));
        console.error('[RadiProtocol] openMovePicker move failed', e);
      }
    };

    new FolderPickerModal(this.app, folders, onChoose).open();
  }

  // -------------------------------------------------------------------------
  // Phase 34 Plan 02 — shared move orchestrator. Used by both context-menu
  // «Переместить в…» (Plan 01) and DnD drop handler (Plan 02). Throws on
  // failure; callers are responsible for Notice/console.error on rejection.
  // -------------------------------------------------------------------------
  private async performMove(
    srcPath: string,
    srcKind: 'file' | 'folder',
    dstFolder: string,
  ): Promise<void> {
    if (srcKind === 'file') {
      // No-op: already in the target folder.
      if (dirname(srcPath) === dstFolder) return;
      // D-03 следствие 2: file rename/move is canvas-invisible — no
      // rewriteCanvasRefs, no «Обновлено канвасов» Notice.
      await this.plugin.snippetService.moveSnippet(srcPath, dstFolder);
      new Notice('Сниппет перемещён.');
      await this.rebuildTreeModel();
      this.renderTree();
      return;
    }

    // Folder branch — self/descendant guard BEFORE any I/O.
    if (srcPath === dstFolder || dstFolder.startsWith(srcPath + '/')) {
      throw new Error('Нельзя переместить папку внутрь самой себя.');
    }
    const oldPath = srcPath;
    const newPath = await this.plugin.snippetService.moveFolder(oldPath, dstFolder);
    const snippetRoot = this.plugin.settings.snippetFolderPath;
    const mapping = new Map<string, string>([
      [toCanvasKey(oldPath, snippetRoot), toCanvasKey(newPath, snippetRoot)],
    ]);
    const result = await rewriteCanvasRefs(this.app, mapping);

    // D-07: expand-state prefix rewrite.
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
    if (mutated) {
      await this.plugin.saveSettings();
    }

    new Notice(
      'Папка перемещена. Обновлено канвасов: ' + result.updated.length +
        ', пропущено: ' + result.skipped.length + '.',
    );
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
  private computeDropTarget(node: TreeNode): string {
    return node.kind === 'folder' ? node.path : dirname(node.path);
  }

  private isDropForbidden(
    srcPath: string,
    srcKind: 'file' | 'folder',
    targetFolder: string,
  ): boolean {
    if (srcKind === 'file') {
      // Already in target → no-op, render as forbidden so we don't
      // preventDefault (cursor stays as "not-allowed").
      return dirname(srcPath) === targetFolder;
    }
    // Folder into itself or a descendant.
    return srcPath === targetFolder || targetFolder.startsWith(srcPath + '/');
  }

  private readDragSource(ev: DragEvent): { path: string; kind: 'file' | 'folder' } | null {
    const types = ev.dataTransfer?.types;
    if (!types) return null;
    const hasFile = Array.from(types as unknown as Iterable<string>).includes(MIME_FILE);
    const hasFolder = Array.from(types as unknown as Iterable<string>).includes(MIME_FOLDER);
    if (hasFile) {
      const p = ev.dataTransfer?.getData(MIME_FILE) ?? '';
      return p === '' ? { path: '', kind: 'file' } : { path: p, kind: 'file' };
    }
    if (hasFolder) {
      const p = ev.dataTransfer?.getData(MIME_FOLDER) ?? '';
      return p === '' ? { path: '', kind: 'folder' } : { path: p, kind: 'folder' };
    }
    return null;
  }

  private handleDragStart(row: HTMLElement, node: TreeNode, ev: DragEvent): void {
    if (ev.dataTransfer === null) return;
    const mime = node.kind === 'file' ? MIME_FILE : MIME_FOLDER;
    ev.dataTransfer.setData(mime, node.path);
    ev.dataTransfer.effectAllowed = 'move';
    row.addClass('is-dragging');
  }

  private handleDragOver(row: HTMLElement, node: TreeNode, ev: DragEvent): void {
    const src = this.readDragSource(ev);
    if (src === null) return; // D-04: do NOT preventDefault — foreign drag
    const target = this.computeDropTarget(node);
    const forbidden = this.isDropForbidden(src.path, src.kind, target);
    if (forbidden) {
      row.addClass('radi-snippet-tree-drop-forbidden');
      return;
    }
    ev.preventDefault();
    if (ev.dataTransfer !== null) ev.dataTransfer.dropEffect = 'move';
    row.addClass('radi-snippet-tree-drop-target');
  }

  private handleDragLeave(row: HTMLElement, ev: DragEvent): void {
    // Ignore child enter/leave noise when relatedTarget is inside the row.
    const rel = (ev as unknown as { relatedTarget: Node | null }).relatedTarget;
    if (rel !== null && typeof (row as unknown as { contains?: (n: Node) => boolean }).contains === 'function') {
      try {
        if ((row as unknown as { contains: (n: Node) => boolean }).contains(rel)) return;
      } catch { /* noop */ }
    }
    row.removeClass('radi-snippet-tree-drop-target');
    row.removeClass('radi-snippet-tree-drop-forbidden');
  }

  private async handleDrop(node: TreeNode, row: HTMLElement, ev: DragEvent): Promise<void> {
    const src = this.readDragSource(ev);
    if (src === null) return; // foreign drag — do not preventDefault
    ev.preventDefault();
    row.removeClass('radi-snippet-tree-drop-target');
    row.removeClass('radi-snippet-tree-drop-forbidden');
    const target = this.computeDropTarget(node);
    try {
      await this.performMove(src.path, src.kind, target);
    } catch (e) {
      new Notice('Не удалось переместить: ' + ((e as Error)?.message ?? 'неизвестная ошибка'));
      console.error('[RadiProtocol] drop move failed', e);
    }
  }

  // -------------------------------------------------------------------------
  // Phase 34 Plan 03 — F2 inline rename.
  // Swap the row's label span for a transient <input>. Enter commits via
  // `renameSnippet` / `renameFolder` (D-03: folder branch also fans out to
  // rewriteCanvasRefs with snippet-root-relative keys and rewrites
  // expand-state prefixes). Escape cancels. Blur commits once unless the
  // value is empty/unchanged, in which case it cancels. A closure-scoped
  // `settled` flag guards against the Enter→commit→blur→double-commit race
  // (D-05).
  // -------------------------------------------------------------------------
  private startInlineRename(node: TreeNode, labelEl: HTMLElement): void {
    if (this.currentlyRenamingPath !== null) return;
    this.currentlyRenamingPath = node.path;

    // Build a transient input in the row container, hide the label, and
    // insert the input at the label's position. We use the row (label's
    // parent) as the container so DOM event propagation + row-level CSS
    // still apply.
    //
    // Phase 34 post-UAT fix: real DOM exposes `parentElement`, not `.parent`.
    // The test mock sets `.parent`, so we check both — parentElement first
    // for the real browser, `.parent` fallback for the mock.
    const realParent = (labelEl as unknown as { parentElement?: HTMLElement | null }).parentElement;
    const mockParent = (labelEl as unknown as { parent?: HTMLElement | null }).parent;
    const rowEl: HTMLElement = (realParent ?? mockParent ?? labelEl) as HTMLElement;

    const initialValue = node.kind === 'file' ? basenameNoExt(node.path) : node.name;
    const input = (rowEl as unknown as { createEl: (t: string, o?: { cls?: string; type?: string }) => HTMLElement })
      .createEl('input', { cls: 'radi-snippet-tree-rename-input', type: 'text' });
    (input as unknown as { value: string }).value = initialValue;
    // Best-effort label hide — in real DOM we'd detach; the mock doesn't
    // need this, and we leave the label in place so cancelInlineRename can
    // simply remove the input without rebuilding the row.
    try {
      (labelEl as unknown as { style: Record<string, string> }).style['display'] = 'none';
    } catch { /* noop */ }
    try {
      (input as unknown as { focus: () => void }).focus();
    } catch { /* noop */ }
    try {
      (input as unknown as { select: () => void }).select();
    } catch { /* noop */ }

    let settled = false;

    const cleanup = (): void => {
      // Remove listeners — use raw removeEventListener (listeners were
      // attached raw, not via registerDomEvent, because the input is
      // short-lived and not part of view lifetime).
      try {
        (input as unknown as { removeEventListener: (t: string, h: (ev: unknown) => void) => void })
          .removeEventListener('keydown', onKeyDown as unknown as (ev: unknown) => void);
        (input as unknown as { removeEventListener: (t: string, h: (ev: unknown) => void) => void })
          .removeEventListener('blur', onBlur as unknown as (ev: unknown) => void);
      } catch { /* noop */ }
      // Detach the input and restore label visibility.
      try {
        (input as unknown as { remove: () => void }).remove();
      } catch { /* noop */ }
      try {
        (labelEl as unknown as { style: Record<string, string> }).style['display'] = '';
      } catch { /* noop */ }
      this.currentlyRenamingPath = null;
    };

    const onKeyDown = (ev: KeyboardEvent): void => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (settled) return;
        settled = true;
        const value = (input as unknown as { value: string }).value;
        void this.commitInlineRename(node, value, cleanup);
        return;
      }
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (settled) return;
        settled = true;
        cleanup();
        return;
      }
    };

    const onBlur = (_ev: Event): void => {
      if (settled) return;
      settled = true;
      const value = (input as unknown as { value: string }).value;
      const trimmed = value.trim();
      const initialTrimmed = initialValue.trim();
      if (trimmed === '' || trimmed === initialTrimmed) {
        cleanup();
        return;
      }
      void this.commitInlineRename(node, value, cleanup);
    };

    (input as unknown as { addEventListener: (t: string, h: (ev: unknown) => void) => void })
      .addEventListener('keydown', onKeyDown as unknown as (ev: unknown) => void);
    (input as unknown as { addEventListener: (t: string, h: (ev: unknown) => void) => void })
      .addEventListener('blur', onBlur as unknown as (ev: unknown) => void);
  }

  private async commitInlineRename(
    node: TreeNode,
    rawValue: string,
    cleanup: () => void,
  ): Promise<void> {
    const newValue = rawValue.trim();
    const oldBasename = node.kind === 'file' ? basenameNoExt(node.path) : node.name;
    if (newValue === '' || newValue === oldBasename) {
      cleanup();
      return;
    }
    try {
      if (node.kind === 'file') {
        await this.plugin.snippetService.renameSnippet(node.path, newValue);
        new Notice('Сниппет переименован.');
      } else {
        const oldPath = node.path;
        const newPath = await this.plugin.snippetService.renameFolder(oldPath, newValue);
        const snippetRoot = this.plugin.settings.snippetFolderPath;
        const mapping = new Map<string, string>([
          [toCanvasKey(oldPath, snippetRoot), toCanvasKey(newPath, snippetRoot)],
        ]);
        const result = await rewriteCanvasRefs(this.app, mapping);

        // D-07: expand-state prefix rewrite.
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
        if (mutated) {
          await this.plugin.saveSettings();
        }

        new Notice(
          'Папка переименована. Обновлено канвасов: ' + result.updated.length +
            ', пропущено: ' + result.skipped.length + '.',
        );
      }
      // Vault 'rename' watcher will trigger the debounced redraw.
    } catch (e) {
      new Notice('Не удалось переименовать: ' + ((e as Error)?.message ?? 'неизвестная ошибка'));
      console.error('[RadiProtocol] inline rename commit failed', e);
    } finally {
      cleanup();
    }
  }

  private handleDragEnd(row: HTMLElement): void {
    row.removeClass('is-dragging');
    // Clean up any stray drop-target/drop-forbidden classes left on the tree
    // (a late dragleave may have been skipped if the drop happened elsewhere).
    const tree = this.treeRootEl;
    if (tree !== undefined && tree !== null) {
      const strayTargets = tree.querySelectorAll('.radi-snippet-tree-drop-target');
      strayTargets.forEach((el: Element) => (el as HTMLElement).removeClass?.('radi-snippet-tree-drop-target'));
      const strayForbidden = tree.querySelectorAll('.radi-snippet-tree-drop-forbidden');
      strayForbidden.forEach((el: Element) => (el as HTMLElement).removeClass?.('radi-snippet-tree-drop-forbidden'));
    }
  }
}

// Phase 36: TreeNode types are used only within this file — no external consumers.
// Silence "declared but not used" noise for the basename helper when the
// linter considers it dead in some builds.
void basename;
