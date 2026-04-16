// views/snippet-editor-modal.ts
// Phase 33 (MODAL-01..08, D-05..D-12, D-09): Unified create/edit modal for
// snippets. The single create/edit surface used by the new tree view — every
// click row, "+ Новый", and context-menu "Редактировать / Создать сниппет
// здесь" routes through this class.
//
// Responsibilities:
//   - Create or edit a Snippet (JsonSnippet | MdSnippet)
//   - JSON ↔ Markdown type toggle (create only; locked in edit mode per D-06)
//   - «Папка» dropdown populated from listFolderDescendants(root)
//   - Name collision pre-flight via snippetService.exists (debounced, D-12)
//   - Unsaved-changes 3-button guard via ConfirmModal (D-08)
//   - Phase 34 (MOVE-04 cleanup): move-on-save uses atomic snippetService.moveSnippet
//     (replaces Phase 33 save+delete+placebo rewriteCanvasRefs pipeline, D-03/D-10)
//
// Not in scope here (deferred to Phase 34):
//   - Multi-file / folder-level moves
//   - Drag-and-drop
//   - Inline F2 rename
import { App, Modal, Notice } from 'obsidian';
import type { Snippet, JsonSnippet, MdSnippet } from '../snippets/snippet-model';
import { slugifyLabel } from '../snippets/snippet-model';
import { mountChipEditor, type ChipEditorHandle } from './snippet-chip-editor';
import { ConfirmModal } from './confirm-modal';
import type RadiProtocolPlugin from '../main';

type SnippetEditorResult =
  | { saved: true; snippet: Snippet; movedFrom: string | null }
  | { saved: false };

interface SnippetEditorOptions {
  mode: 'create' | 'edit';
  /** Pre-fill «Папка» (create mode); edit mode derives from snippet.path */
  initialFolder: string;
  /** Required when mode === 'edit' */
  snippet?: Snippet;
  /** Create mode only; defaults to 'json' */
  initialKind?: 'json' | 'md';
}

const COLLISION_ERROR_TEXT = 'Файл с таким именем уже существует в этой папке.';
const UNSAVED_GUARD_TITLE = 'Несохранённые изменения';

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i > 0 ? path.slice(0, i) : '';
}

function emptyJsonDraft(folder: string): JsonSnippet {
  return {
    kind: 'json',
    path: folder + '/.json', // placeholder — recomputed on save from slugifyLabel(name)
    name: '',
    template: '',
    placeholders: [],
  };
}

function emptyMdDraft(folder: string): MdSnippet {
  return {
    kind: 'md',
    path: folder + '/.md',
    name: '',
    content: '',
  };
}

export class SnippetEditorModal extends Modal {
  readonly result: Promise<SnippetEditorResult>;
  private resolve!: (value: SnippetEditorResult) => void;
  private resolved = false;

  private readonly plugin: RadiProtocolPlugin;
  private readonly options: SnippetEditorOptions;

  // Form state
  private draft: JsonSnippet | MdSnippet;
  private draftKind: 'json' | 'md';
  private currentFolder: string;
  private hasUnsavedChanges = false;

  // DOM refs
  private chipEditorHandle: ChipEditorHandle | null = null;
  private nameInputEl!: HTMLInputElement;
  private collisionErrorEl!: HTMLElement;
  private saveBtnEl!: HTMLButtonElement;
  private contentRegionEl!: HTMLElement;
  private saveErrorEl!: HTMLElement;
  private folderSelectEl!: HTMLSelectElement;

  // Debounce
  private collisionCheckTimer: number | null = null;
  private hasCollision = false;

  constructor(app: App, plugin: RadiProtocolPlugin, options: SnippetEditorOptions) {
    super(app);
    this.plugin = plugin;
    this.options = options;

    if (options.mode === 'edit') {
      if (!options.snippet) {
        throw new Error('SnippetEditorModal: mode="edit" requires options.snippet');
      }
      this.draft = cloneSnippet(options.snippet);
      this.draftKind = options.snippet.kind;
      this.currentFolder = dirname(options.snippet.path);
    } else {
      this.draftKind = options.initialKind ?? 'json';
      this.currentFolder = options.initialFolder;
      this.draft = this.draftKind === 'json'
        ? emptyJsonDraft(this.currentFolder)
        : emptyMdDraft(this.currentFolder);
    }

    this.result = new Promise<SnippetEditorResult>((res) => {
      this.resolve = res;
    });
  }

  async onOpen(): Promise<void> {
    // D-07: wide Obsidian modal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modalEl = (this as unknown as { modalEl?: { style?: { maxWidth: string } } }).modalEl;
    if (modalEl && modalEl.style) {
      modalEl.style.maxWidth = '800px';
    }

    const { contentEl, titleEl } = this;
    contentEl.empty();
    contentEl.addClass('radi-snippet-editor-modal');

    // Title (copy contract)
    if (this.options.mode === 'create') {
      titleEl.setText('Новый сниппет');
    } else {
      titleEl.setText('Редактирование: ' + (this.options.snippet?.name ?? ''));
    }

    // Type toggle (create only — D-06)
    if (this.options.mode === 'create') {
      this.renderTypeToggle(contentEl);
    } else {
      // Edit mode: static type label (kind locked)
      const typeRow = contentEl.createDiv({ cls: 'radi-snippet-editor-row' });
      typeRow.createEl('label', { text: 'Тип' });
      typeRow.createEl('span', {
        text: this.draftKind === 'json' ? 'JSON' : 'Markdown',
        cls: 'radi-snippet-editor-type-static',
      });
    }

    // Folder dropdown
    await this.renderFolderDropdown(contentEl);

    // Name input
    this.renderNameInput(contentEl);

    // Content region (chip editor or textarea)
    // Phase 33 gap-fix: no separate «Содержимое» label above — the chip editor
    // has its own Template/Placeholders sections, and Markdown mode uses a
    // single textarea whose placeholder text is self-explanatory.
    this.contentRegionEl = contentEl.createDiv({ cls: 'radi-snippet-editor-content' });
    this.renderContentRegion();

    // Save-error placeholder
    this.saveErrorEl = contentEl.createDiv({ cls: 'radi-snippet-editor-save-error' });
    this.saveErrorEl.style.display = 'none';
    this.saveErrorEl.style.color = 'var(--text-error)';

    // Button row
    this.renderButtonRow(contentEl);

    // Initial collision check (edit mode pre-populated name shouldn't collide with self)
    void this.runCollisionCheck();
  }

  onClose(): void {
    this.safeResolve({ saved: false });
    if (this.chipEditorHandle) {
      this.chipEditorHandle.destroy();
      this.chipEditorHandle = null;
    }
    if (this.collisionCheckTimer !== null) {
      clearTimeout(this.collisionCheckTimer);
      this.collisionCheckTimer = null;
    }
    this.contentEl.empty();
  }

  // --- Close interception for unsaved-changes guard (D-08) ---
  // Obsidian's Modal.close() is called by Esc, overlay click, or our own code.
  // We override it to run the guard when there are unsaved changes.
  close(): void {
    if (!this.resolved && this.hasUnsavedChanges) {
      // Fire-and-forget: the guard itself will call super.close() on resolution.
      void this.runUnsavedGuard();
      return;
    }
    super.close();
  }

  // -------------------- Rendering --------------------

  private renderTypeToggle(container: HTMLElement): void {
    const row = container.createDiv({ cls: 'radi-snippet-editor-row' });
    row.createEl('label', { text: 'Тип' });

    const toggleWrap = row.createDiv({ cls: 'radi-snippet-editor-type-toggle' });
    toggleWrap.setAttribute('role', 'radiogroup');

    const makeOption = (value: 'json' | 'md', label: string): HTMLButtonElement => {
      const btn = toggleWrap.createEl('button', { text: label });
      btn.setAttribute('type', 'button');
      btn.setAttribute('role', 'radio');
      btn.setAttribute('data-kind', value);
      btn.setAttribute('aria-checked', String(this.draftKind === value));
      if (this.draftKind === value) btn.addClass('is-active');
      btn.addEventListener('click', () => {
        if (this.draftKind === value) return;
        this.switchKind(value);
        // Update button states
        toggleWrap.querySelectorAll('button').forEach((b) => {
          const kind = b.getAttribute('data-kind');
          const active = kind === value;
          b.setAttribute('aria-checked', String(active));
          if (active) b.addClass('is-active');
          else b.removeClass('is-active');
        });
      });
      return btn;
    };

    makeOption('json', 'JSON');
    makeOption('md', 'Markdown');
  }

  private async renderFolderDropdown(container: HTMLElement): Promise<void> {
    const row = container.createDiv({ cls: 'radi-snippet-editor-row' });
    row.createEl('label', { text: 'Папка' });

    const select = row.createEl('select') as HTMLSelectElement;
    this.folderSelectEl = select;

    const folderOptions = await this.buildFolderOptions();
    for (const folder of folderOptions) {
      const opt = select.createEl('option', { text: folder });
      (opt as HTMLOptionElement).value = folder;
    }
    select.value = this.currentFolder;
    // If initial folder isn't in options (shouldn't happen normally), append it.
    if (select.value !== this.currentFolder && this.currentFolder) {
      const opt = select.createEl('option', { text: this.currentFolder });
      (opt as HTMLOptionElement).value = this.currentFolder;
      select.value = this.currentFolder;
    }

    select.addEventListener('change', () => {
      this.currentFolder = select.value;
      this.hasUnsavedChanges = true;
      void this.runCollisionCheck();
    });
  }

  private async buildFolderOptions(): Promise<string[]> {
    const root = this.plugin.settings.snippetFolderPath;
    const descendants = await this.plugin.snippetService.listFolderDescendants(root);
    const folders = new Set<string>([root]);
    for (const f of descendants.folders) folders.add(f);
    return Array.from(folders).sort((a, b) => a.localeCompare(b));
  }

  private renderNameInput(container: HTMLElement): void {
    const row = container.createDiv({ cls: 'radi-snippet-editor-row' });
    row.createEl('label', { text: 'Имя' });

    const input = row.createEl('input', { type: 'text' }) as HTMLInputElement;
    input.placeholder = 'Например: greeting-template';
    input.value = this.draft.name;
    this.nameInputEl = input;

    this.collisionErrorEl = row.createDiv({ cls: 'radi-snippet-editor-collision-error' });
    this.collisionErrorEl.style.display = 'none';
    this.collisionErrorEl.style.color = 'var(--text-error)';
    this.collisionErrorEl.textContent = COLLISION_ERROR_TEXT;

    input.addEventListener('input', () => {
      this.draft.name = input.value;
      this.hasUnsavedChanges = true;
      this.scheduleCollisionCheck();
    });
  }

  private renderContentRegion(): void {
    this.contentRegionEl.empty();
    if (this.chipEditorHandle) {
      this.chipEditorHandle.destroy();
      this.chipEditorHandle = null;
    }

    if (this.draftKind === 'json') {
      const jsonDraft = this.draft as JsonSnippet;
      this.chipEditorHandle = mountChipEditor(
        this.contentRegionEl,
        jsonDraft,
        () => {
          this.hasUnsavedChanges = true;
        },
        { skipName: true },
      );
    } else {
      const mdDraft = this.draft as MdSnippet;
      const ta = this.contentRegionEl.createEl('textarea') as HTMLTextAreaElement;
      ta.placeholder = 'Введите текст сниппета…';
      ta.value = mdDraft.content;
      ta.rows = 10;
      ta.addClass('radi-snippet-editor-md-textarea');
      ta.addEventListener('input', () => {
        mdDraft.content = ta.value;
        this.hasUnsavedChanges = true;
      });
    }
  }

  private switchKind(newKind: 'json' | 'md'): void {
    // Create mode only — preserves folder; resets draft content but keeps name.
    const preservedName = this.draft.name;
    this.draftKind = newKind;
    if (newKind === 'json') {
      this.draft = emptyJsonDraft(this.currentFolder);
    } else {
      this.draft = emptyMdDraft(this.currentFolder);
    }
    this.draft.name = preservedName;
    this.hasUnsavedChanges = true;
    this.renderContentRegion();
  }

  private renderButtonRow(container: HTMLElement): void {
    const row = container.createDiv({ cls: 'modal-button-container' });

    const cancelBtn = row.createEl('button', { text: 'Отмена' });
    cancelBtn.setAttribute('type', 'button');
    cancelBtn.addEventListener('click', () => {
      void this.handleCancel();
    });

    const saveBtn = row.createEl('button', {
      text: this.options.mode === 'create' ? 'Создать' : 'Сохранить',
      cls: 'mod-cta',
    }) as HTMLButtonElement;
    saveBtn.setAttribute('type', 'button');
    saveBtn.addEventListener('click', () => {
      void this.handleSave();
    });
    this.saveBtnEl = saveBtn;
  }

  // -------------------- Collision pre-flight (D-12) --------------------

  private scheduleCollisionCheck(): void {
    if (this.collisionCheckTimer !== null) {
      clearTimeout(this.collisionCheckTimer);
    }
    this.collisionCheckTimer = setTimeout(() => {
      this.collisionCheckTimer = null;
      void this.runCollisionCheck();
    }, 150) as unknown as number;
  }

  private async runCollisionCheck(): Promise<void> {
    const name = this.draft.name.trim();
    if (name === '') {
      this.hasCollision = false;
      this.updateCollisionUI();
      return;
    }
    const candidatePath = this.computeCandidatePath();
    // Edit mode: if candidate equals the snippet's own path, no collision.
    if (
      this.options.mode === 'edit' &&
      this.options.snippet &&
      candidatePath === this.options.snippet.path
    ) {
      this.hasCollision = false;
      this.updateCollisionUI();
      return;
    }
    try {
      const exists = await this.plugin.snippetService.exists(candidatePath);
      this.hasCollision = exists;
    } catch {
      this.hasCollision = false;
    }
    this.updateCollisionUI();
  }

  private updateCollisionUI(): void {
    if (!this.collisionErrorEl || !this.saveBtnEl) return;
    if (this.hasCollision) {
      this.collisionErrorEl.style.display = '';
      this.saveBtnEl.disabled = true;
      this.saveBtnEl.setAttribute(
        'title',
        'Устраните конфликт имени, чтобы сохранить.',
      );
    } else {
      this.collisionErrorEl.style.display = 'none';
      this.saveBtnEl.disabled = false;
      this.saveBtnEl.removeAttribute('title');
    }
  }

  private computeCandidatePath(): string {
    const ext = this.draftKind === 'json' ? 'json' : 'md';
    const slug = slugifyLabel(this.draft.name);
    return this.currentFolder + '/' + slug + '.' + ext;
  }

  // -------------------- Save pipeline (D-09) --------------------

  private async handleSave(): Promise<void> {
    if (this.hasCollision) return;
    const name = this.draft.name.trim();
    if (name === '') {
      this.showSaveError('Введите имя сниппета.');
      return;
    }

    // Phase 33 (D-09 resolved): Pass exact file paths, NOT folder paths.
    // canvas-ref-sync applies prefix match; (oldFolder → newFolder) on a
    // single-file move would redirect ALL canvas refs in that folder.
    // Phase 34 will add folder-drag and multi-file operations — deliberately
    // out of scope here.
    const newPath = this.computeCandidatePath();
    // Build the persisted draft with the canonical path.
    const draftToSave: Snippet =
      this.draftKind === 'json'
        ? { ...(this.draft as JsonSnippet), path: newPath }
        : { ...(this.draft as MdSnippet), path: newPath };

    const oldPath =
      this.options.mode === 'edit' && this.options.snippet
        ? this.options.snippet.path
        : null;

    try {
      if (this.options.mode === 'create' || oldPath === null || oldPath === newPath) {
        // Simple save (no move) — unchanged Phase 33 flow
        await this.plugin.snippetService.save(draftToSave);
        this.safeResolve({ saved: true, snippet: draftToSave, movedFrom: null });
        super.close();
        return;
      }

      // Phase 34 (MOVE-04 cleanup, D-03 / D-10): atomic move/rename via service API.
      // 1. Save any content changes to the OLD path first.
      // 2. If the folder changed, moveSnippet → atomic folder move.
      // 3. If the basename also changed (or instead of folder), renameSnippet →
      //    atomic in-folder rename. Post-UAT fix: previously moveSnippet was
      //    called unconditionally, which silently dropped pure name changes
      //    (basename delta with unchanged folder).
      // 4. No canvas-ref-sync — SnippetNode.subfolderPath is a folder-only
      //    reference, so file moves/renames are canvas-invisible (D-03 Phase 34).
      const draftAtOldPath: Snippet =
        this.draftKind === 'json'
          ? { ...(this.draft as JsonSnippet), path: oldPath }
          : { ...(this.draft as MdSnippet), path: oldPath };
      await this.plugin.snippetService.save(draftAtOldPath);

      const oldFolder = dirname(oldPath);
      const newFolder = newPath.slice(0, newPath.lastIndexOf('/'));
      const oldBasenameNoExt = oldPath
        .slice(oldPath.lastIndexOf('/') + 1)
        .replace(/\.(json|md)$/, '');
      const newBasenameNoExt = newPath
        .slice(newPath.lastIndexOf('/') + 1)
        .replace(/\.(json|md)$/, '');

      let currentPath = oldPath;
      const folderChanged = newFolder !== oldFolder;
      const basenameChanged = newBasenameNoExt !== oldBasenameNoExt;

      if (folderChanged) {
        currentPath = await this.plugin.snippetService.moveSnippet(currentPath, newFolder);
      }
      if (basenameChanged) {
        currentPath = await this.plugin.snippetService.renameSnippet(currentPath, newBasenameNoExt);
      }

      const finalDraft: Snippet =
        this.draftKind === 'json'
          ? { ...(this.draft as JsonSnippet), path: currentPath }
          : { ...(this.draft as MdSnippet), path: currentPath };

      // Phase 34 MOVE-04 regression guard: folder-only change still emits the
      // exact string «Сниппет перемещён.» (asserted by the move-on-save test).
      if (folderChanged && !basenameChanged) {
        new Notice('Сниппет перемещён.');
      } else if (basenameChanged && !folderChanged) {
        new Notice('Сниппет переименован.');
      } else {
        new Notice('Сниппет перемещён и переименован.');
      }
      this.safeResolve({ saved: true, snippet: finalDraft, movedFrom: oldPath });
      super.close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.showSaveError('Не удалось сохранить: ' + msg + '. Попробуйте ещё раз.');
    }
  }

  private showSaveError(msg: string): void {
    if (!this.saveErrorEl) return;
    this.saveErrorEl.textContent = msg;
    this.saveErrorEl.style.display = '';
  }

  private async handleCancel(): Promise<void> {
    if (this.hasUnsavedChanges) {
      await this.runUnsavedGuard();
      return;
    }
    this.safeResolve({ saved: false });
    super.close();
  }

  /**
   * D-08 unsaved-changes guard. Opens a ConfirmModal with the 3-button variant:
   *   - Сохранить (confirm)    → runs handleSave(); closes only if save succeeds
   *   - Не сохранять (discard) → resolves { saved: false }, closes
   *   - Отмена (cancel)        → stays in the editor
   *
   * Safe to call from either close() or handleCancel().
   */
  private async runUnsavedGuard(): Promise<void> {
    const name = this.draft.name || (this.options.snippet?.name ?? '');
    const guard = new ConfirmModal(this.app, {
      title: UNSAVED_GUARD_TITLE,
      body: 'Изменения в сниппете «' + name + '» не сохранены. Что сделать?',
      confirmLabel: 'Сохранить',
      cancelLabel: 'Отмена',
      discardLabel: 'Не сохранять',
    });
    guard.open();
    const decision = await guard.result;
    if (decision === 'confirm') {
      await this.handleSave();
      // handleSave closes on success; on failure keep the editor open.
    } else if (decision === 'discard') {
      this.safeResolve({ saved: false });
      super.close();
    }
    // 'cancel' → stay open, do nothing
  }

  private safeResolve(value: SnippetEditorResult): void {
    if (!this.resolved) {
      this.resolved = true;
      this.resolve(value);
    }
  }
}

// ------------- helpers -------------

function cloneSnippet(s: Snippet): JsonSnippet | MdSnippet {
  if (s.kind === 'json') {
    return {
      kind: 'json',
      path: s.path,
      name: s.name,
      template: s.template,
      placeholders: s.placeholders.map((p) => ({ ...p })),
    };
  }
  return {
    kind: 'md',
    path: s.path,
    name: s.name,
    content: s.content,
  };
}
