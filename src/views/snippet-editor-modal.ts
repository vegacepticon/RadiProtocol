// views/snippet-editor-modal.ts
// Phase 33 (MODAL-01..08, D-05..D-12, D-09): Unified create/edit modal for
// snippets. The single create/edit surface used by the new tree view — every
// click row, "+ New", and context-menu "Edit / Create snippet here"
// routes through this class.
//
// Responsibilities:
//   - Create or edit a Snippet (JsonSnippet | MdSnippet)
//   - JSON ↔ Markdown type toggle (create only; locked in edit mode per D-06)
//   - Folder dropdown populated from listFolderDescendants(root)
//   - Name collision pre-flight via snippetService.exists (debounced, D-12)
//   - Unsaved-changes 3-button guard via ConfirmModal (D-08)
//   - Phase 34 (MOVE-04 cleanup): move-on-save uses atomic snippetService.moveSnippet
//     (replaces Phase 33 save+delete+placebo rewriteProtocolSnippetRefs pipeline, D-03/D-10)
//
// Not in scope here (deferred to Phase 34):
//   - Multi-file / folder-level moves
//   - Drag-and-drop
//   - Inline F2 rename
import { App, Modal, Notice } from 'obsidian';
import type { Snippet, JsonSnippet, MdSnippet, MdTemplateSnippet } from '../snippets/snippet-model';
import { mountChipEditor, type ChipEditorHandle } from './snippet-chip-editor';
import { ConfirmModal } from './confirm-modal';
import type RadiProtocolPlugin from '../main';
import { createButton, createInput, createTextarea } from '../utils/dom-helpers';
import { FolderSuggest } from './folder-suggest';

type SnippetEditorResult =
  | { saved: true; snippet: Snippet; movedFrom: string | null }
  | { saved: false; duplicatedTo?: string };

interface SnippetEditorOptions {
  mode: 'create' | 'edit';
  /** Pre-fill folder (create mode); edit mode derives from snippet.path */
  initialFolder: string;
  /** Required when mode === 'edit' */
  snippet?: Snippet;
  /** @deprecated ignored since 1.22.4 — create always uses md-template */
  initialKind?: never;
  /** Optional storage adapter for non-vault snippet stores such as Library Admin. */
  snippetServiceOverride?: {
    save(snippet: Snippet): Promise<void>;
    exists(path: string): Promise<boolean>;
    listFolderDescendants(root: string): Promise<{ folders: string[] }>;
    moveSnippet(oldPath: string, newFolder: string): Promise<string>;
    renameSnippet(oldPath: string, newBasename: string): Promise<string>;
    duplicateSnippet(path: string): Promise<string>;
  };
  /** Hide the folder picker when the caller manages moves separately. */
  disableFolderPicker?: boolean;
}

// Phase 84 (I18N-02): copy keys; resolved at render time via this.plugin.i18n.t().
const COLLISION_ERROR_KEY = 'snippetEditor.collisionError';
const UNSAVED_GUARD_TITLE_KEY = 'snippetEditor.unsavedTitle';

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i > 0 ? path.slice(0, i) : '';
}

function basename(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}

function normalizeSnippetBasename(name: string): string {
  return name.trim().replace(/[\\/]/g, '-');
}

function emptyMdTemplateDraft(folder: string, locale: string, cat: string): MdTemplateSnippet {
  return {
    kind: 'md-template',
    path: folder + '/.md',
    name: '',
    template: '',
    placeholders: [],
    validationError: null,
    lang: locale as 'ru' | 'en' | undefined,
    category: cat,
  };
}

export class SnippetEditorModal extends Modal {
  readonly result: Promise<SnippetEditorResult>;
  private resolve!: (value: SnippetEditorResult) => void;
  private resolved = false;

  private readonly plugin: RadiProtocolPlugin;
  private readonly options: SnippetEditorOptions;

  // Form state
  private draft: JsonSnippet | MdSnippet | MdTemplateSnippet;
  private draftKind: 'json' | 'md' | 'md-template';
  private currentFolder: string;
  /** Phase 56 D-08 — baseline against which the folder-row unsaved-dot is computed.
   *  Initialised to the same value as currentFolder; advanced to the new
   *  currentFolder on every successful save commit. */
  private savedFolder: string;
  private hasUnsavedChanges = false;

  // DOM refs
  private chipEditorHandle: ChipEditorHandle | null = null;
  private nameInputEl!: HTMLInputElement;
  private collisionErrorEl!: HTMLElement;
  private saveBtnEl!: HTMLButtonElement;
  private contentRegionEl!: HTMLElement;
  private saveErrorEl!: HTMLElement;
  /** Phase 52 D-04: banner shown when the loaded snippet carries a validationError. */
  private validationBannerEl: HTMLElement | null = null;
  /** Phase 56 D-08 — bullet ("•") rendered inside the folder label; toggles
   *  via the .is-visible modifier whenever currentFolder !== savedFolder. */
  private folderUnsavedDotEl: HTMLSpanElement | null = null;
  private folderPathInputEl: HTMLInputElement | null = null;

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
      this.savedFolder = this.currentFolder; // Phase 56 D-08 baseline
    } else {
      this.draftKind = 'md-template';
      this.currentFolder = options.initialFolder;
      this.savedFolder = this.currentFolder; // Phase 56 D-08 baseline
      this.draft = emptyMdTemplateDraft(
        this.currentFolder,
        this.plugin.settings.locale ?? 'ru',
        basename(this.currentFolder),
      );
    }

    this.result = new Promise<SnippetEditorResult>((res) => {
      this.resolve = res;
    });
  }

  async onOpen(): Promise<void> {
    // D-07: wide Obsidian modal
    const modalEl = (this as unknown as { modalEl?: { addClass?: (cls: string) => void } }).modalEl;
    if (typeof modalEl?.addClass === 'function') {
      modalEl.addClass('rp-snippet-editor-modal');
    }

    const { contentEl, titleEl } = this;
    contentEl.empty();
    contentEl.addClass('radi-snippet-editor-modal');

    // Title (copy contract)
    if (this.options.mode === 'create') {
      titleEl.setText(this.plugin.i18n.t('snippetEditor.newTitle'));
    } else {
      titleEl.setText(this.plugin.i18n.t('snippetEditor.editTitle', {
        name: this.options.snippet?.name ?? '',
      }));
    }

    // Type: always "Markdown Template" for create; static label for edit
    if (this.options.mode === 'create') {
      const typeRow = contentEl.createDiv({ cls: 'radi-snippet-editor-row' });
      typeRow.createEl('label', { text: this.plugin.i18n.t('snippetEditor.type') });
      typeRow.createEl('span', {
        text: 'Markdown template',
        cls: 'radi-snippet-editor-type-static',
      });
    } else {
      // Edit mode: static type label (kind locked)
      const typeRow = contentEl.createDiv({ cls: 'radi-snippet-editor-row' });
      typeRow.createEl('label', { text: this.plugin.i18n.t('snippetEditor.type') });
      typeRow.createEl('span', {
        text: this.draftKind === 'json' ? 'JSON' : 'Markdown',
        cls: 'radi-snippet-editor-type-static',
      });
    }

    // Folder input (after type row, before name)
    await this.renderFolderDropdown(contentEl);

    // Name input
    this.renderNameInput(contentEl);

    // Phase 52 D-04: render validation banner BEFORE content region so the user
    // sees it immediately. Banner is rendered above the chip editor; the form
    // remains mounted but is locked further down (Save disabled + aria-disabled
    // on contentRegionEl). Uses textContent only — T-52-09 mitigation.
    if (this.draftKind === 'json' || this.draftKind === 'md-template') {
      const vErr = (this.draft as JsonSnippet | MdTemplateSnippet).validationError;
      if (vErr !== null) {
        this.renderValidationBanner(contentEl, vErr);
      }
    }

    // Content region (chip editor or textarea)
    // Phase 33 gap-fix: no separate content label above — the chip editor
    // has its own Template/Placeholders sections, and Markdown mode uses a
    // single textarea whose placeholder text is self-explanatory.
    this.contentRegionEl = contentEl.createDiv({ cls: 'radi-snippet-editor-content' });
    this.renderContentRegion();

    // Save-error placeholder
    this.saveErrorEl = contentEl.createDiv({ cls: 'radi-snippet-editor-save-error rp-snippet-editor-save-error' });
    this.saveErrorEl.toggleClass('rp-snippet-banner-hidden', true);

    // Button row
    this.renderButtonRow(contentEl);

    // Phase 52 D-04: lock the form when the snippet is unusable. Save is
    // disabled and the content region is visually disabled (aria-disabled +
    // pointerEvents:none + opacity:0.5) so the user cannot interact with a
    // broken snippet's chip editor. Valid snippets are byte-identical to the
    // pre-Phase-52 behaviour.
    if (this.validationBannerEl !== null) {
      this.saveBtnEl.disabled = true;
      this.saveBtnEl.setAttribute(
        'title',
        this.plugin.i18n.t('snippetEditor.validationLockTitle'),
      );
      this.contentRegionEl.setAttribute('aria-disabled', 'true');
      this.contentRegionEl.toggleClass('rp-snippet-form-locked', true);
    }

    this.nameInputEl.focus();

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
    this.folderPathInputEl = null;
    // Phase 52 D-04: release banner reference so a subsequent onOpen sees null;
    this.validationBannerEl = null;
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

  private snippetService(): {
    save(snippet: Snippet): Promise<void>;
    exists(path: string): Promise<boolean>;
    listFolderDescendants(root: string): Promise<{ folders: string[] }>;
    moveSnippet(oldPath: string, newFolder: string): Promise<string>;
    renameSnippet(oldPath: string, newBasename: string): Promise<string>;
    duplicateSnippet(path: string): Promise<string>;
  } {
    return this.options.snippetServiceOverride ?? this.plugin.snippetService;
  }

  // -------------------- Rendering --------------------

  private computeCandidatePath(): string {
    const ext = this.draftKind === 'json' ? 'json' : 'md';
    const basename = normalizeSnippetBasename(this.draft.name);
    return this.currentFolder + '/' + basename + '.' + ext;
  }

  private async renderFolderDropdown(container: HTMLElement): Promise<void> {
    const row = container.createDiv({ cls: 'radi-snippet-editor-row rp-snippet-editor-folder-row' });
    const folderLabel = row.createEl('label', { text: this.plugin.i18n.t('snippetEditor.folder') });
    this.folderUnsavedDotEl = folderLabel.createEl('span', {
      cls: 'rp-snippet-editor-unsaved-dot',
      text: '\u2022',
    }) as unknown as HTMLSpanElement;
    this.folderUnsavedDotEl.setAttribute('aria-label', this.plugin.i18n.t('snippetEditor.unsavedAriaLabel'));
    this.updateFolderUnsavedDot();

    if (this.options.disableFolderPicker) {
      row.createEl('span', { cls: 'rp-snippet-editor-folder-static', text: this.currentFolder });
      return;
    }

    const input = createInput(row, { type: 'text' });
    input.value = this.folderInputValue();
    input.placeholder = this.plugin.i18n.t('snippetEditor.folderPathPlaceholder');
    input.setAttribute('aria-label', this.plugin.i18n.t('snippetEditor.folder'));
    this.folderPathInputEl = input;
    new FolderSuggest(this.app, input, {
      rootPath: this.plugin.settings.snippetFolderPath,
      relativeToRoot: true,
      includeRoot: true,
    });

    input.addEventListener('input', () => {
      this.currentFolder = this.folderFromInput(input.value);
      this.hasUnsavedChanges = true;
      this.scheduleCollisionCheck();
      this.updateFolderUnsavedDot();
    });
  }

  /** Phase 56 D-08 — toggle the folder-label bullet based on whether the
   *  current pending folder selection differs from the saved baseline. */
  private updateFolderUnsavedDot(): void {
    if (this.folderUnsavedDotEl === null) return;
    const diff = this.currentFolder !== this.savedFolder;
    this.folderUnsavedDotEl.toggleClass('is-visible', diff);
  }

  /** Compute the relative path from snippet root for display in the input. */
  private folderInputValue(): string {
    const root = this.plugin.settings.snippetFolderPath;
    if (this.currentFolder === root) return '';
    if (this.currentFolder.startsWith(root + '/')) {
      return this.currentFolder.slice(root.length + 1);
    }
    return this.currentFolder;
  }

  /** Convert the user's input (relative to snippet root) back to an absolute folder path. */
  private folderFromInput(value: string): string {
    const root = this.plugin.settings.snippetFolderPath;
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === root) return root;
    return root + '/' + trimmed;
  }

  /** @deprecated Phase 51 D-07 — replaced by folder input. Safe to remove in future cleanup. */
  private async buildFolderOptions(): Promise<string[]> {
    const root = this.plugin.settings.snippetFolderPath;
    const descendants = await this.snippetService().listFolderDescendants(root);
    const folders = new Set<string>([root]);
    for (const f of descendants.folders) folders.add(f);
    return Array.from(folders).sort((a, b) => a.localeCompare(b));
  }

  private renderNameInput(container: HTMLElement): void {
    const row = container.createDiv({ cls: 'radi-snippet-editor-row' });
    row.createEl('label', { text: this.plugin.i18n.t('snippetEditor.name') });

    const input = createInput(row, { type: 'text' });
    input.placeholder = this.plugin.i18n.t('snippetEditor.namePlaceholder');
    input.value = this.draft.name;
    this.nameInputEl = input;

    this.collisionErrorEl = row.createDiv({ cls: 'radi-snippet-editor-collision-error rp-snippet-editor-save-error' });
    this.collisionErrorEl.toggleClass('rp-snippet-banner-hidden', true);
    this.collisionErrorEl.textContent = this.plugin.i18n.t(COLLISION_ERROR_KEY);

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

    if (this.draftKind === 'json' || this.draftKind === 'md-template') {
      const templateDraft = this.draft as JsonSnippet | MdTemplateSnippet;
      this.chipEditorHandle = mountChipEditor(
        this.contentRegionEl,
        templateDraft,
        () => {
          this.hasUnsavedChanges = true;
        },
        { skipName: true, t: this.plugin.i18n.t.bind(this.plugin.i18n) },
      );
    } else {
      const mdDraft = this.draft as MdSnippet;
      const ta = createTextarea(this.contentRegionEl);
      ta.placeholder = this.plugin.i18n.t('snippetEditor.contentPlaceholder');
      ta.value = mdDraft.content;
      ta.rows = 10;
      ta.addClass('radi-snippet-editor-md-textarea');
      ta.addEventListener('input', () => {
        mdDraft.content = ta.value;
        this.hasUnsavedChanges = true;
      });
    }
  }

  /**
   * Phase 52 D-04: render a red banner above the form when the loaded snippet
   * carries a non-null validationError (emitted by validatePlaceholders in
   * Plan 02's snippet-service load path). Uses `createEl({ text })` +
   * `textContent` exclusively — no HTML parsing anywhere on this path
   * (T-52-09 mitigation).
   */
  private renderValidationBanner(container: HTMLElement, msg: string): void {
    const banner = container.createDiv({ cls: 'radi-snippet-editor-validation-banner' });
    banner.setAttribute('role', 'alert');
    // Assign banner.textContent to the localized header + blank-line + the
    // dynamic validationError text (not hardcoded UI copy — msg comes from
    // model validation). textContent treats the entire string as
    // literal text — a `<script>` substring becomes the characters `<`, `s`,
    // `c`, ... and is NEVER parsed as a DOM child (T-52-09 XSS mitigation).
    // Plan 01 tests B3/B4 assert on `banner.textContent` (via the mock's
    // `_text`) so the msg must live on the banner node itself, not on a
    // child element.
    banner.textContent =
      this.plugin.i18n.t('snippetEditor.validationBannerHeader') + '\n' + msg;
    this.validationBannerEl = banner;
  }

  private renderButtonRow(container: HTMLElement): void {
    const row = container.createDiv({ cls: 'modal-button-container' });

    const cancelBtn = createButton(row, { text: this.plugin.i18n.t('snippetEditor.cancel') });
    cancelBtn.setAttribute('type', 'button');
    cancelBtn.addEventListener('click', () => {
      void this.handleCancel();
    });

    const duplicateBtn = createButton(row, {
      text: this.plugin.i18n.t('snippetEditor.duplicate'),
    });
    duplicateBtn.setAttribute('aria-label', this.plugin.i18n.t('snippetEditor.duplicateTitle'));
    duplicateBtn.setAttribute('type', 'button');
    duplicateBtn.addEventListener('click', () => {
      void this.handleDuplicate();
    });

    const saveBtn = createButton(row, {
      text: this.options.mode === 'create'
        ? this.plugin.i18n.t('snippetEditor.create')
        : this.plugin.i18n.t('snippetEditor.save'),
      cls: 'mod-cta',
    });
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
    // Edit mode: unchanged display name may map to a different filename after
    // pre-1.22.5 slugification, so it must not collide with itself.
    if (this.options.mode === 'edit' && this.options.snippet) {
      const original = this.options.snippet;
      const originalExt = original.path.toLowerCase().endsWith('.json') ? 'json' : 'md';
      const originalNamePath = dirname(original.path) + '/' + normalizeSnippetBasename(original.name) + '.' + originalExt;
      const unchangedName = this.draft.name.trim() === original.name.trim();
      if (candidatePath === original.path || (unchangedName && candidatePath === originalNamePath)) {
        this.hasCollision = false;
        this.updateCollisionUI();
        return;
      }
    }
    try {
      const exists = await this.snippetService().exists(candidatePath);
      this.hasCollision = exists;
    } catch {
      this.hasCollision = false;
    }
    this.updateCollisionUI();
  }

  private updateCollisionUI(): void {
    if (!this.collisionErrorEl || !this.saveBtnEl) return;
    // Phase 52 D-04: validation banner locks Save regardless of collision state.
    // Bail so the banner's disabled flag + Russian title are not clobbered by a
    // subsequent «no collision» pass.
    if (this.validationBannerEl !== null) return;
    if (this.hasCollision) {
      this.collisionErrorEl.toggleClass('rp-snippet-banner-hidden', false);
      this.saveBtnEl.disabled = true;
      this.saveBtnEl.setAttribute(
        'title',
        this.plugin.i18n.t('snippetEditor.collisionTitle'),
      );
    } else {
      this.collisionErrorEl.toggleClass('rp-snippet-banner-hidden', true);
      this.saveBtnEl.disabled = false;
      this.saveBtnEl.removeAttribute('title');
    }
  }

  // -------------------- Save pipeline (D-09) --------------------

  private async handleSave(): Promise<void> {
    if (this.hasCollision) return;
    const name = this.draft.name.trim();
    if (name === '') {
      this.showSaveError(this.plugin.i18n.t('snippetEditor.emptyName'));
      return;
    }

    const newPath = this.computeCandidatePath();
    let draftToSave: Snippet;
    if (this.draftKind === 'json') {
      draftToSave = { ...(this.draft as JsonSnippet), path: newPath } as JsonSnippet;
    } else if (this.draftKind === 'md-template') {
      draftToSave = { ...(this.draft as MdTemplateSnippet), path: newPath } as MdTemplateSnippet;
    } else {
      draftToSave = { ...(this.draft as MdSnippet), path: newPath } as MdSnippet;
    }

    const oldPath =
      this.options.mode === 'edit' && this.options.snippet
        ? this.options.snippet.path
        : null;

    try {
      if (this.options.mode === 'create' || oldPath === null || oldPath === newPath) {
        // Simple save (no move) — unchanged Phase 33 flow
        await this.snippetService().save(draftToSave);
        this.savedFolder = this.currentFolder; // Phase 56 D-08 — commit baseline
        this.updateFolderUnsavedDot();
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
          : this.draftKind === 'md-template'
            ? { ...(this.draft as MdTemplateSnippet), path: oldPath }
            : { ...(this.draft as MdSnippet), path: oldPath };
      await this.snippetService().save(draftAtOldPath);

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
        currentPath = await this.snippetService().moveSnippet(currentPath, newFolder);
      }
      if (basenameChanged) {
        currentPath = await this.snippetService().renameSnippet(currentPath, newBasenameNoExt);
      }

      const finalDraft: Snippet =
        this.draftKind === 'json'
          ? { ...(this.draft as JsonSnippet), path: currentPath }
          : this.draftKind === 'md-template'
            ? { ...(this.draft as MdTemplateSnippet), path: currentPath }
            : { ...(this.draft as MdSnippet), path: currentPath };

      // Phase 34 MOVE-04 regression guard: folder-only change still emits the
      // i18n-keyed «Snippet moved» notice (asserted by the move-on-save test).
      if (folderChanged && !basenameChanged) {
        new Notice(this.plugin.i18n.t('snippetEditor.movedNotice'));
      } else if (basenameChanged && !folderChanged) {
        new Notice(this.plugin.i18n.t('snippetEditor.renamedNotice'));
      } else {
        new Notice(this.plugin.i18n.t('snippetEditor.movedAndRenamedNotice'));
      }
      this.savedFolder = this.currentFolder; // Phase 56 D-08 — commit baseline
      this.updateFolderUnsavedDot();
      this.safeResolve({ saved: true, snippet: finalDraft, movedFrom: oldPath });
      super.close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.showSaveError(this.plugin.i18n.t('snippetEditor.saveError', { error: msg }));
    }
  }

  private showSaveError(msg: string): void {
    if (!this.saveErrorEl) return;
    this.saveErrorEl.textContent = msg; // msg is pass-through localized text from callers
    this.saveErrorEl.toggleClass('rp-snippet-banner-hidden', false);
  }

  private async handleCancel(): Promise<void> {
    if (this.hasUnsavedChanges) {
      await this.runUnsavedGuard();
      return;
    }
    this.safeResolve({ saved: false });
    super.close();
  }

  private async handleDuplicate(): Promise<void> {
    if (this.options.mode !== 'edit' || !this.options.snippet) return;
    try {
      const newPath = await this.snippetService().duplicateSnippet(this.options.snippet.path);
      this.safeResolve({ saved: false, duplicatedTo: newPath });
      super.close();
    } catch (err) {
      new Notice(this.plugin.i18n.t('snippetEditor.duplicateError', { error: String(err) }));
    }
  }

  /**
   * D-08 unsaved-changes guard. Opens a ConfirmModal with the 3-button variant:
   *   - Save (confirm)    → runs handleSave(); closes only if save succeeds
   *   - Discard           → resolves { saved: false }, closes
   *   - Cancel            → stays in the editor
   *
   * Safe to call from either close() or handleCancel().
   */
  private async runUnsavedGuard(): Promise<void> {
    const name = this.draft.name || (this.options.snippet?.name ?? '');
    const guard = new ConfirmModal(this.app, {
      title: this.plugin.i18n.t(UNSAVED_GUARD_TITLE_KEY),
      body: this.plugin.i18n.t('snippetEditor.unsavedBody', { name }),
      confirmLabel: this.plugin.i18n.t('snippetEditor.save'),
      cancelLabel: this.plugin.i18n.t('snippetEditor.cancel'),
      discardLabel: this.plugin.i18n.t('snippetEditor.discard'),
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

function cloneSnippet(s: Snippet): JsonSnippet | MdSnippet | MdTemplateSnippet {
  if (s.kind === 'json') {
    return {
      kind: 'json',
      path: s.path,
      name: s.name,
      template: s.template,
      placeholders: s.placeholders.map((p) => ({ ...p })),
      validationError: s.validationError, // Phase 52 D-03
    };
  }
  if (s.kind === 'md-template') {
    return {
      kind: 'md-template',
      path: s.path,
      name: s.name,
      template: s.template,
      placeholders: s.placeholders.map((p) => ({ ...p })),
      validationError: s.validationError ?? null,
    };
  }
  const mdSnippet = s as Extract<Snippet, { kind: 'md' }>;
  return {
    kind: 'md' as const,
    path: mdSnippet.path,
    name: mdSnippet.name,
    content: mdSnippet.content,
  };
}
