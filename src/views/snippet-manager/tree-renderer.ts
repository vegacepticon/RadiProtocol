// views/snippet-manager/tree-renderer.ts
// Phase 82 SPLIT-01 — extracted tree rendering, DnD, and inline rename from
// SnippetManagerView so the original god-file shrinks by ≥30%.

import { Menu, Notice, setIcon } from 'obsidian';
import type RadiProtocolPlugin from '../../main';
import type { Snippet } from '../../snippets/snippet-model';
import { rewriteCanvasRefs } from '../../snippets/canvas-ref-sync';
import { toCanvasKey } from '../../snippets/snippet-service';
import { createButton } from '../../utils/dom-helpers';

// Phase 34 Plan 02: HTML5 DnD custom MIME types.
const MIME_FILE = 'application/x-radi-snippet-file';
const MIME_FOLDER = 'application/x-radi-snippet-folder';

// ---------------------------------------------------------------------------
// Internal tree model (mirrors snippet-manager-view.ts)
// ---------------------------------------------------------------------------
export interface TreeNodeFolder {
  kind: 'folder';
  path: string;
  name: string;
  children: TreeNode[];
}
export interface TreeNodeFile {
  kind: 'file';
  path: string;
  name: string;
  snippetKind: 'json' | 'md';
}
export type TreeNode = TreeNodeFolder | TreeNodeFile;

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i > 0 ? path.slice(0, i) : '';
}

export function basenameNoExt(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

function iconForNode(node: TreeNode, expanded: boolean): string {
  if (node.kind === 'folder') return expanded ? 'folder-open' : 'folder';
  return node.snippetKind === 'json' ? 'file-json' : 'file-text';
}

// ---------------------------------------------------------------------------
// Callback interface — SnippetManagerView implements these
// ---------------------------------------------------------------------------
export interface TreeRendererCallbacks {
  openEditModal(path: string): Promise<void>;
  openCreateModal(folderPath: string): Promise<void>;
  handleCreateSubfolder(path: string): Promise<void>;
  handleDeleteSnippet(path: string, name: string): Promise<void>;
  handleDeleteFolder(path: string, name: string): Promise<void>;
  openMovePicker(node: TreeNode): Promise<void>;
  performMove(srcPath: string, srcKind: 'file' | 'folder', dstFolder: string): Promise<void>;
  rebuildTreeModel(): Promise<void>;
  saveSettings(): Promise<void>;
  rewriteExpandState(oldPath: string, newPath: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// SnippetManagerTreeRenderer
// ---------------------------------------------------------------------------
export class SnippetManagerTreeRenderer {
  private readonly container: HTMLElement;
  private readonly plugin: RadiProtocolPlugin;
  private readonly callbacks: TreeRendererCallbacks;

  // Mutable state synced with the view
  private currentlyEditingPath: string | null = null;
  private currentlyRenamingPath: string | null = null;
  private rowLabelEls: Map<string, HTMLElement> = new Map();

  constructor(options: {
    container: HTMLElement;
    plugin: RadiProtocolPlugin;
    callbacks: TreeRendererCallbacks;
  }) {
    this.container = options.container;
    this.plugin = options.plugin;
    this.callbacks = options.callbacks;
  }

  // ——— Public accessors ———

  getRowLabelEls(): Map<string, HTMLElement> {
    return this.rowLabelEls;
  }

  getCurrentlyRenamingPath(): string | null {
    return this.currentlyRenamingPath;
  }

  setCurrentlyEditingPath(path: string | null): void {
    this.currentlyEditingPath = path;
  }

  // ——— Render entry ———

  render(treeData: TreeNode[]): void {
    this.container.empty();
    this.rowLabelEls.clear();

    if (treeData.length === 0) {
      this.renderEmptyState(this.container);
      return;
    }

    for (const node of treeData) {
      this.renderNode(this.container, node, 0);
    }
  }

  // ——— Empty state ———

  private renderEmptyState(container: HTMLElement): void {
    const wrap = container.createDiv({ cls: 'radi-snippet-tree-empty-state' });
    wrap.createEl('h3', { text: 'Библиотека сниппетов пуста' });
    wrap.createEl('p', {
      text: 'Создайте первый сниппет, чтобы вставлять фрагменты текста при прохождении протоколов.',
    });
    const ghost = createButton(wrap, {
      cls: 'mod-cta',
      text: '+ Новый сниппет',
    });
    ghost.addEventListener('click', () => {
      void this.callbacks.openCreateModal(this.plugin.settings.snippetFolderPath);
    });
  }

  // ——— Expand state ———

  private isExpanded(path: string): boolean {
    return this.plugin.settings.snippetTreeExpandedPaths.includes(path);
  }

  private async toggleExpand(path: string): Promise<void> {
    const list = this.plugin.settings.snippetTreeExpandedPaths;
    const idx = list.indexOf(path);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(path);
    }
    await this.callbacks.saveSettings();
    await this.callbacks.rebuildTreeModel();
    this.render(await this.getTreeData());
  }

  // Helper: read current tree data from the view's model.  Because the view
  // owns rebuildTreeModel, we ask it to rebuild then pull the data back.
  // In practice the view calls render(treeData) immediately after rebuild,
  // so this is only used internally after toggleExpand.
  private async getTreeData(): Promise<TreeNode[]> {
    await this.callbacks.rebuildTreeModel();
    // The view's treeData is private; we rely on the view calling render()
    // with fresh data.  For toggleExpand we rebuild here ourselves.
    // Rebuild from root:
    const root = this.plugin.settings.snippetFolderPath;
    return this.buildTreeChildren(root);
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

    return [...folderNodes, ...fileNodes];
  }

  // ——— Node render ———

  private renderNode(container: HTMLElement, node: TreeNode, depth: number): void {
    const row = container.createDiv({ cls: 'radi-snippet-tree-row' });
    row.setAttribute('data-path', node.path);
    row.setAttribute('data-kind', node.kind);
    row.setAttribute('tabindex', '0');
    if (node.kind === 'file' && this.currentlyEditingPath === node.path) {
      row.setAttribute('data-editing', 'true');
    }

    const indent = row.createSpan({ cls: 'radi-snippet-tree-indent rp-snippet-tree-indent-inline' });
    indent.style.width = `${depth * 16}px`;

    const expanded = node.kind === 'folder' ? this.isExpanded(node.path) : false;

    if (node.kind === 'folder') {
      const chev = row.createSpan({ cls: 'radi-snippet-tree-chevron' });
      setIcon(chev, expanded ? 'chevron-down' : 'chevron-right');
    } else {
      row.createSpan({ cls: 'radi-snippet-tree-chevron-spacer rp-snippet-tree-spacer' });
    }

    const iconEl = row.createSpan({ cls: 'radi-snippet-tree-icon' });
    setIcon(iconEl, iconForNode(node, expanded));

    const labelEl = row.createSpan({ cls: 'radi-snippet-tree-label', text: node.name });
    this.rowLabelEls.set(node.path, labelEl);

    if (node.kind === 'folder') {
      const actions = row.createSpan({ cls: 'radi-snippet-tree-actions' });
      const addBtn = createButton(actions, {
        cls: 'radi-snippet-tree-add-btn',
        attr: { 'aria-label': 'Создать в этой папке', title: 'Создать в этой папке' },
      });
      setIcon(addBtn, 'plus');
      addBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        void this.callbacks.openCreateModal(node.path);
      });
    }

    // Row click
    row.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      if (target !== null && target.closest('button') !== null && target !== row) return;
      if (node.kind === 'file') {
        void this.callbacks.openEditModal(node.path);
      } else {
        void this.toggleExpand(node.path);
      }
    });

    // Context menu
    row.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.openContextMenu(ev as MouseEvent, node);
    });

    // DnD lifecycle
    row.setAttribute('draggable', 'true');
    row.addEventListener('dragstart', (ev) => {
      this.handleDragStart(row, node, ev as DragEvent);
    });
    row.addEventListener('dragover', (ev) => {
      this.handleDragOver(row, node, ev as DragEvent);
    });
    row.addEventListener('dragleave', (ev) => {
      this.handleDragLeave(row, ev as DragEvent);
    });
    row.addEventListener('drop', (ev) => {
      void this.handleDrop(node, row, ev as DragEvent);
    });
    row.addEventListener('dragend', () => {
      this.handleDragEnd(row);
    });

    // F2 inline rename
    row.addEventListener('keydown', (ev) => {
      const ke = ev as KeyboardEvent;
      if (ke.key !== 'F2') return;
      ke.preventDefault();
      this.startInlineRename(node, labelEl);
    });

    // Children (folders only, when expanded)
    if (node.kind === 'folder' && expanded) {
      if (node.children.length === 0) {
        const empty = container.createDiv({ cls: 'radi-snippet-tree-row radi-snippet-tree-empty-placeholder' });
        const emptyIndent = empty.createSpan({ cls: 'radi-snippet-tree-indent rp-snippet-tree-indent-inline' });
        emptyIndent.style.width = `${(depth + 1) * 16}px`;
        empty.createSpan({ text: '(пусто)', cls: 'radi-snippet-tree-empty-label' });
      } else {
        for (const child of node.children) {
          this.renderNode(container, child, depth + 1);
        }
      }
    }
  }

  // ——— Context menu ———

  private openContextMenu(ev: MouseEvent, node: TreeNode): void {
    const menu = new Menu();
    if (node.kind === 'file') {
      menu.addItem((item) =>
        item
          .setTitle('Редактировать')
          .setIcon('pencil')
          .onClick(() => { void this.callbacks.openEditModal(node.path); }),
      );
      menu.addItem((item) =>
        item
          .setTitle('Переименовать')
          .setIcon('pencil-line')
          .onClick(() => {
            const labelEl = this.rowLabelEls.get(node.path);
            if (labelEl !== undefined) this.startInlineRename(node, labelEl);
          }),
      );
      menu.addItem((item) =>
        item
          .setTitle('Переместить в…')
          .setIcon('folder-input')
          .onClick(() => { void this.callbacks.openMovePicker(node); }),
      );
      menu.addSeparator();
      menu.addItem((item) =>
        item
          .setTitle('Удалить')
          .setIcon('trash')
          .onClick(() => { void this.callbacks.handleDeleteSnippet(node.path, node.name); }),
      );
    } else {
      menu.addItem((item) =>
        item
          .setTitle('Создать сниппет здесь')
          .setIcon('plus')
          .onClick(() => { void this.callbacks.openCreateModal(node.path); }),
      );
      menu.addItem((item) =>
        item
          .setTitle('Создать подпапку')
          .setIcon('folder-plus')
          .onClick(() => { void this.callbacks.handleCreateSubfolder(node.path); }),
      );
      menu.addItem((item) =>
        item
          .setTitle('Переименовать')
          .setIcon('pencil-line')
          .onClick(() => {
            const labelEl = this.rowLabelEls.get(node.path);
            if (labelEl !== undefined) this.startInlineRename(node, labelEl);
          }),
      );
      menu.addItem((item) =>
        item
          .setTitle('Переместить в…')
          .setIcon('folder-input')
          .onClick(() => { void this.callbacks.openMovePicker(node); }),
      );
      menu.addSeparator();
      menu.addItem((item) =>
        item
          .setTitle('Удалить папку')
          .setIcon('trash')
          .onClick(() => { void this.callbacks.handleDeleteFolder(node.path, node.name); }),
      );
    }
    menu.showAtMouseEvent(ev);
  }

  // ——— DnD helpers ———

  private computeDropTarget(node: TreeNode): string {
    return node.kind === 'folder' ? node.path : dirname(node.path);
  }

  private isDropForbidden(
    srcPath: string,
    srcKind: 'file' | 'folder',
    targetFolder: string,
  ): boolean {
    if (srcPath === '') return false;
    if (srcKind === 'file') {
      return dirname(srcPath) === targetFolder;
    }
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
    if (src === null) return;
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
    if (src === null) return;
    ev.preventDefault();
    row.removeClass('radi-snippet-tree-drop-target');
    row.removeClass('radi-snippet-tree-drop-forbidden');
    const target = this.computeDropTarget(node);
    try {
      await this.callbacks.performMove(src.path, src.kind, target);
    } catch (e) {
      new Notice('Не удалось переместить: ' + ((e as Error)?.message ?? 'неизвестная ошибка'));
      console.error('[RadiProtocol] drop move failed', e);
    }
  }

  private handleDragEnd(row: HTMLElement): void {
    row.removeClass('is-dragging');
    row.removeClass('radi-snippet-tree-drop-target');
    row.removeClass('radi-snippet-tree-drop-forbidden');
  }

  // ——— Inline rename ———

  startInlineRename(node: TreeNode, labelEl: HTMLElement): void {
    if (this.currentlyRenamingPath !== null) return;
    this.currentlyRenamingPath = node.path;

    const realParent = (labelEl as unknown as { parentElement?: HTMLElement | null }).parentElement;
    const mockParent = (labelEl as unknown as { parent?: HTMLElement | null }).parent;
    const rowEl: HTMLElement = (realParent ?? mockParent ?? labelEl) as HTMLElement;

    const initialValue = node.kind === 'file' ? basenameNoExt(node.path) : node.name;
    const input = (rowEl as unknown as { createEl: (t: string, o?: { cls?: string; type?: string }) => HTMLElement })
      .createEl('input', { cls: 'radi-snippet-tree-rename-input', type: 'text' });
    (input as unknown as { value: string }).value = initialValue;
    try {
      labelEl.toggleClass('rp-snippet-tree-label-hidden', true);
    } catch { /* noop */ }
    try {
      (input as unknown as { focus: () => void }).focus();
    } catch { /* noop */ }
    try {
      (input as unknown as { select: () => void }).select();
    } catch { /* noop */ }

    let settled = false;

    const cleanup = (): void => {
      try {
        (input as unknown as { removeEventListener: (t: string, h: (ev: unknown) => void) => void })
          .removeEventListener('keydown', onKeyDown as unknown as (ev: unknown) => void);
        (input as unknown as { removeEventListener: (t: string, h: (ev: unknown) => void) => void })
          .removeEventListener('blur', onBlur as unknown as (ev: unknown) => void);
      } catch { /* noop */ }
      try {
        (input as unknown as { remove: () => void }).remove();
      } catch { /* noop */ }
      try {
        labelEl.toggleClass('rp-snippet-tree-label-hidden', false);
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
      void _ev;
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
        const result = await rewriteCanvasRefs(this.plugin.app, mapping, this.plugin.canvasLiveEditor);
        await this.callbacks.rewriteExpandState(oldPath, newPath);
        new Notice(
          'Папка переименована. Обновлено канвасов: ' + result.updated.length +
            ', пропущено: ' + result.skipped.length + '.',
        );
      }
      cleanup();
      await this.callbacks.rebuildTreeModel();
      this.render(await this.getTreeData());
    } catch (e) {
      new Notice('Не удалось переименовать: ' + ((e as Error)?.message ?? 'неизвестная ошибка'));
      cleanup();
    }
  }
}
