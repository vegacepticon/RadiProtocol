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
import { SnippetTreePicker } from './snippet-tree-picker';
import type RadiProtocolPlugin from '../main';
import { CSS_CLASS } from '../constants/css-classes';
import { createButton, createInput, createTextarea } from '../utils/dom-helpers';

type SnippetEditorResult =
  | { saved: true; snippet: Snippet; movedFrom: string | null }
  | { saved: false };

interface SnippetEditorOptions {
  mode: 'create' | 'edit';
  /** Pre-fill folder (create mode); edit mode derives from snippet.path */
  initialFolder: string;
  /** Required when mode === 'edit' */
  snippet?: Snippet;
  /** Create mode only; defaults to 'json' */
  initialKind?: 'json' | 'md';
}

// Phase 84 (I18N-02): copy keys; resolved at render time via this.plugin.i18n.t().
const COLLISION_ERROR_KEY = 'snippetEditor.collisionError';
const UNSAVED_GUARD_TITLE_KEY = 'snippetEditor.unsavedTitle';

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
    validationError: null, // Phase 52 D-03
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
  /** @deprecated Phase 51 D-07 — superseded by snippetTreePicker (folder-only
   *  SnippetTreePicker mounted in renderFolderDropdown). Field retained per
   *  CLAUDE.md Shared Pattern G (never remove existing code you didn't add);
   *  no new writes occur to this field. */
  private folderSelectEl!: HTMLSelectElement;

  /** Phase 51 D-07 — SnippetTreePicker instance for the folder row.
   *  Replaces the legacy <select> dropdown; null until renderFolderDropdown mounts it. */
  private snippetTreePicker: SnippetTreePicker | null = null;

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
      this.draftKind = options.initialKind ?? 'json';
      this.currentFolder = options.initialFolder;
      this.savedFolder = this.currentFolder; // Phase 56 D-08 baseline
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

    // Type toggle (create only — D-06)
    if (this.options.mode === 'create') {
      this.renderTypeToggle(contentEl);
    } else {
      // Edit mode: static type label (kind locked)
      const typeRow = contentEl.createDiv({ cls: 'radi-snippet-editor-row' });
      typeRow.createEl('label', { text: this.plugin.i18n.t('snippetEditor.type') });
      typeRow.createEl('span', {
        text: this.draftKind === 'json' ? 'JSON' : 'Markdown',
        cls: 'radi-snippet-editor-type-static',
      });
    }

    // Folder dropdown
    await this.renderFolderDropdown(contentEl);

    // Name input
    this.renderNameInput(contentEl);

    // Phase 52 D-04: render validation banner BEFORE content region so the user
    // sees it immediately. Banner is rendered above the chip editor; the form
    // remains mounted but is locked further down (Save disabled + aria-disabled
    // on contentRegionEl). Uses textContent only — T-52-09 mitigation.
    if (this.draftKind === 'json') {
      const vErr = (this.draft as JsonSnippet).validationError;
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
    // Phase 51 D-07 — unmount the SnippetTreePicker to release its DOM listeners.
    if (this.snippetTreePicker !== null) {
      this.snippetTreePicker.unmount();
      this.snippetTreePicker = null;
    }
    // Phase 52 D-04: release banner reference so a subsequent onOpen sees null.
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

  // -------------------- Rendering --------------------

  private renderTypeToggle(container: HTMLElement): void {
    const row = container.createDiv({ cls: 'radi-snippet-editor-row' });
    row.createEl('label', { text: this.plugin.i18n.t('snippetEditor.type') });

    const toggleWrap = row.createDiv({ cls: 'radi-snippet-editor-type-toggle' });
    toggleWrap.setAttribute('role', 'radiogroup');

    const makeOption = (value: 'json' | 'md', label: string): HTMLButtonElement => {
      const btn = createButton(toggleWrap, { text: label });
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
    // Phase 51 D-07 (PICKER-02) — folder-only SnippetTreePicker replaces the legacy
    // flat-list <select>. Same contract: writing this.currentFolder + setting
    // hasUnsavedChanges + scheduling collision check.
    // Host wrapper class `rp-stp-editor-host` is defined in src/styles/snippet-tree-picker.css
    // (owned by Plan 02). This plan does NOT modify CSS.
    // See `docs/ARCHITECTURE-NOTES.md#snippet-node-binding-and-picker`.
    const row = container.createDiv({ cls: 'radi-snippet-editor-row' });
    const folderLabel = row.createEl('label', { text: this.plugin.i18n.t('snippetEditor.folder') });
    // Phase 56 D-08: bullet indicator inside the label; toggled by
    // updateFolderUnsavedDot() whenever currentFolder !== savedFolder.
    this.folderUnsavedDotEl = folderLabel.createEl('span', {
      cls: 'rp-snippet-editor-unsaved-dot',
      text: '\u2022',
    }) as unknown as HTMLSpanElement;
    this.folderUnsavedDotEl.setAttribute('aria-label', this.plugin.i18n.t('snippetEditor.unsavedAriaLabel'));
    this.updateFolderUnsavedDot();
    const pickerHost = row.createDiv({ cls: CSS_CLASS.STP_EDITOR_HOST });

    const rootPath = this.plugin.settings.snippetFolderPath;
    // Compute relative initialSelection from absolute currentFolder.
    const initialSelection: string | undefined =
      this.currentFolder === rootPath
        ? ''
        : this.currentFolder.startsWith(rootPath + '/')
          ? this.currentFolder.slice(rootPath.length + 1)
          : undefined;

    if (this.snippetTreePicker !== null) {
      this.snippetTreePicker.unmount();
      this.snippetTreePicker = null;
    }

    this.snippetTreePicker = new SnippetTreePicker({
      app: this.app,
      snippetService: this.plugin.snippetService,
      container: pickerHost,
      mode: 'folder-only',
      rootPath,
      initialSelection,
      onSelect: (result) => {
        // folder-only mode emits kind: 'folder' only
        this.currentFolder = result.relativePath === ''
          ? rootPath
          : `${rootPath}/${result.relativePath}`;
        this.hasUnsavedChanges = true;
        void this.runCollisionCheck();
        this.updateFolderUnsavedDot(); // Phase 56 D-08
      },
    });
    void this.snippetTreePicker.mount();
  }

  /** Phase 56 D-08 — toggle the folder-label bullet based on whether the
   *  current pending folder selection differs from the saved baseline. */
  private updateFolderUnsavedDot(): void {
    if (this.folderUnsavedDotEl === null) return;
    const diff = this.currentFolder !== this.savedFolder;
    this.folderUnsavedDotEl.toggleClass('is-visible', diff);
  }

  /** @deprecated Phase 51 D-07 — replaced by SnippetTreePicker. Retained per
   *  CLAUDE.md Shared Pattern G; safe to remove in a future cleanup phase if
   *  confirmed orphaned. */
  private async buildFolderOptions(): Promise<string[]> {
    const root = this.plugin.settings.snippetFolderPath;
    const descendants = await this.plugin.snippetService.listFolderDescendants(root);
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

    if (this.draftKind === 'json') {
      const jsonDraft = this.draft as JsonSnippet;
      this.chipEditorHandle = mountChipEditor(
        this.contentRegionEl,
        jsonDraft,
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
    // Assign banner.textContent to the Russian header + blank-line + the
    // validationError verbatim. textContent treats the entire string as
    // literal text — a `<script>` substring becomes the characters `<`, `s`,
    // `c`, ... and is NEVER parsed as a DOM child (T-52-09 XSS mitigation).
    // Plan 01 tests B3/B4 assert on `banner.textContent` (via the mock's
    // `_text`) so the msg must live on the banner node itself, not on a
    // child element.
    banner.textContent =
      this.plugin.i18n.t('snippetEditor.validationBannerHeader') + '\n' + msg;
    this.validationBannerEl = banner;
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

    const cancelBtn = createButton(row, { text: this.plugin.i18n.t('snippetEditor.cancel') });
    cancelBtn.setAttribute('type', 'button');
    cancelBtn.addEventListener('click', () => {
      void this.handleCancel();
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
      this.showSaveError(this.plugin.i18n.t('snippetEditor.emptyName'));
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
    this.saveErrorEl.textContent = msg;
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

function cloneSnippet(s: Snippet): JsonSnippet | MdSnippet {
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
  return {
    kind: 'md',
    path: s.path,
    name: s.name,
    content: s.content,
  };
}
