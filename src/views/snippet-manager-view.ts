// views/snippet-manager-view.ts — Phase 5: SnippetManagerView full master-detail UI
import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { SnippetFile, SnippetPlaceholder } from '../snippets/snippet-model';
import { slugifyLabel } from '../snippets/snippet-model';

export const SNIPPET_MANAGER_VIEW_TYPE = 'radiprotocol-snippet-manager';

// --- Helper: insertAtCursor (D-04) -----------------------------------------------
function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
  textarea.selectionStart = start + text.length;
  textarea.selectionEnd = start + text.length;
  textarea.dispatchEvent(new Event('input'));
}

// Phase 27 D-02: fixed colour bar per placeholder type
const PH_COLOR: Record<SnippetPlaceholder['type'], string> = {
  'free-text':    'var(--color-cyan)',
  'choice':       'var(--color-orange)',
  'multi-choice': 'var(--color-purple)',
  'number':       'var(--color-green)',
};

// ---------------------------------------------------------------------------------

export class SnippetManagerView extends ItemView {
  private plugin: RadiProtocolPlugin;

  // State
  private snippets: SnippetFile[] = [];
  // draft is either an unsaved new snippet or a copy of the selected saved snippet
  private draft: SnippetFile | null = null;

  // DOM references rebuilt on render
  private listPanel!: HTMLElement;
  private formPanel!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return SNIPPET_MANAGER_VIEW_TYPE; }
  getDisplayText(): string { return 'Snippet manager'; }
  getIcon(): string { return 'scissors'; }

  async onOpen(): Promise<void> {
    await this.loadAndRender();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  // ---------------------------------------------------------------------------
  // Load + render
  // ---------------------------------------------------------------------------

  private async loadAndRender(): Promise<void> {
    // Phase 32 (D-03): legacy `list()` removed. Use listFolder(root) + filter
    // to JsonSnippet. Full replacement of this legacy view is Phase 33 scope.
    try {
      const listing = await this.plugin.snippetService.listFolder(
        this.plugin.settings.snippetFolderPath,
      );
      this.snippets = listing.snippets.filter(
        (s): s is Extract<typeof s, { kind: 'json' }> => s.kind === 'json',
      );
    } catch {
      this.snippets = [];
    }
    this.renderLayout();
  }

  private renderLayout(): void {
    this.contentEl.empty();

    const root = this.contentEl.createDiv({ cls: 'rp-snippet-manager' });

    // Left column: list panel
    this.listPanel = root.createDiv({ cls: 'rp-snippet-list-panel' });

    // Right column: form panel
    this.formPanel = root.createDiv({ cls: 'rp-snippet-form' });

    this.renderListPanel();
    this.renderFormPanel();
  }

  // ---------------------------------------------------------------------------
  // Left column
  // ---------------------------------------------------------------------------

  private renderListPanel(): void {
    this.listPanel.empty();

    // [+ New snippet] button at top
    const newBtn = this.listPanel.createEl('button', {
      text: '+ New snippet',
      cls: 'mod-cta',
    });
    newBtn.style.margin = 'var(--size-4-1)';
    this.registerDomEvent(newBtn, 'click', () => { void this.handleNewSnippet(); });

    // Empty list state
    if (this.snippets.length === 0) {
      const emptyMsg = this.listPanel.createEl('p', {
        text: 'No snippets yet. Click + New snippet to create your first one.',
      });
      emptyMsg.style.color = 'var(--text-muted)';
      emptyMsg.style.padding = 'var(--size-4-1) var(--size-4-2)';
      emptyMsg.style.fontSize = 'var(--font-smaller)';
      return;
    }

    // List items
    for (const snippet of this.snippets) {
      this.renderListItem(snippet);
    }
  }

  private renderListItem(snippet: SnippetFile): HTMLElement {
    const row = this.listPanel.createDiv({ cls: 'rp-snippet-list-item' });
    row.dataset['snippetId'] = snippet.id;
    row.textContent = snippet.name || 'Untitled';

    if (this.draft?.id === snippet.id) {
      row.addClass('is-active');
    }

    this.registerDomEvent(row, 'click', () => {
      // Load the clicked snippet into the form (discard unsaved edits — v1 per CONTEXT.md)
      this.draft = { ...snippet, placeholders: snippet.placeholders.map(p => ({ ...p, options: p.options ? [...p.options] : undefined })) };
      this.updateActiveListItem();
      this.renderFormPanel();
    });

    return row;
  }

  private updateActiveListItem(): void {
    const rows = this.listPanel.querySelectorAll('.rp-snippet-list-item');
    rows.forEach(row => {
      const el = row as HTMLElement;
      if (el.dataset['snippetId'] === this.draft?.id) {
        el.addClass('is-active');
      } else {
        el.removeClass('is-active');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Right column (form panel)
  // ---------------------------------------------------------------------------

  private renderFormPanel(): void {
    this.formPanel.empty();

    if (!this.draft) {
      // Empty state (D-02)
      const msg = this.formPanel.createEl('p', {
        text: 'Select a snippet to edit, or click + New snippet to create one.',
      });
      msg.style.color = 'var(--text-muted)';
      return;
    }

    const draft = this.draft;

    // --- Name section ---
    const nameSection = this.formPanel.createDiv({ cls: 'rp-snippet-form-section' });
    const nameLabel = nameSection.createEl('label');
    nameLabel.textContent = 'Name';
    nameLabel.htmlFor = 'rp-snippet-name-input';
    const nameInput = nameSection.createEl('input', { type: 'text' });
    nameInput.id = 'rp-snippet-name-input';
    nameInput.value = draft.name;
    nameInput.placeholder = 'Snippet name';
    this.registerDomEvent(nameInput, 'input', () => {
      draft.name = nameInput.value;
      // Update list row label in real time (D-08 copywriting)
      const row = this.listPanel.querySelector(`[data-snippet-id="${(draft.id ?? draft.name)}"]`) as HTMLElement | null;
      if (row) {
        row.textContent = nameInput.value || 'Untitled';
      }
    });

    // --- Template section ---
    const templateSection = this.formPanel.createDiv({ cls: 'rp-snippet-form-section' });
    const templateLabel = templateSection.createEl('label');
    templateLabel.textContent = 'Template';
    templateLabel.htmlFor = 'rp-snippet-template-input';
    const templateArea = templateSection.createEl('textarea');
    templateArea.id = 'rp-snippet-template-input';
    templateArea.value = draft.template;
    templateArea.placeholder = 'Enter template text. Use {{placeholder-id}} to insert placeholders.';
    this.registerDomEvent(templateArea, 'input', () => {
      draft.template = templateArea.value;
      this.refreshOrphanBadges(draft, placeholderList);
    });

    // --- [+ Add placeholder] button and inline mini-form (D-04) ---
    const addPlaceholderBtn = templateSection.createEl('button', { text: '+ Add placeholder' });
    const addPlaceholderForm = templateSection.createDiv({ cls: 'rp-add-placeholder-form' });
    addPlaceholderForm.style.display = 'none';

    // Mini-form contents
    const miniLabelEl = addPlaceholderForm.createEl('label');
    miniLabelEl.textContent = 'Label';
    miniLabelEl.htmlFor = 'rp-add-ph-label';
    const miniLabelInput = addPlaceholderForm.createEl('input', { type: 'text' });
    miniLabelInput.id = 'rp-add-ph-label';
    miniLabelInput.placeholder = 'e.g. Patient age';

    const miniTypeLabel = addPlaceholderForm.createEl('label');
    miniTypeLabel.textContent = 'Type';
    miniTypeLabel.htmlFor = 'rp-add-ph-type';
    const miniTypeSelect = addPlaceholderForm.createEl('select');
    miniTypeSelect.id = 'rp-add-ph-type';
    const phTypes: Array<{ value: SnippetPlaceholder['type']; label: string }> = [
      { value: 'free-text', label: 'Free text' },
      { value: 'choice', label: 'Choice' },
      { value: 'multi-choice', label: 'Multi-choice' },
      { value: 'number', label: 'Number' },
    ];
    for (const { value, label } of phTypes) {
      const opt = miniTypeSelect.createEl('option', { text: label });
      opt.value = value;
    }

    const miniActionRow = addPlaceholderForm.createDiv();
    miniActionRow.style.display = 'flex';
    miniActionRow.style.gap = 'var(--size-4-1)';

    const miniAddBtn = miniActionRow.createEl('button', { text: 'Add' });
    miniAddBtn.addClass('mod-cta');
    miniAddBtn.setAttribute('type', 'button');
    const miniCancelBtn = miniActionRow.createEl('button', { text: 'Cancel' });
    miniCancelBtn.setAttribute('type', 'button');

    // Placeholder list (built/rebuilt below)
    const placeholderSection = this.formPanel.createDiv({ cls: 'rp-snippet-form-section' });
    const placeholderHeading = placeholderSection.createEl('label');
    placeholderHeading.textContent = 'Placeholders';
    const placeholderList = placeholderSection.createDiv({ cls: 'rp-placeholder-list' });

    // Wire [+ Add placeholder] button: show mini-form
    this.registerDomEvent(addPlaceholderBtn, 'click', () => {
      addPlaceholderForm.style.display = '';
      miniLabelInput.value = '';
      miniTypeSelect.value = 'free-text';
      miniLabelInput.focus();
    });

    // Wire [Add] in mini-form
    this.registerDomEvent(miniAddBtn, 'click', () => {
      const rawLabel = miniLabelInput.value.trim();
      if (!rawLabel) { miniLabelInput.focus(); return; }
      const slug = slugifyLabel(rawLabel);
      if (!slug) { miniLabelInput.focus(); return; }

      const phType = miniTypeSelect.value as SnippetPlaceholder['type'];
      const newPh: SnippetPlaceholder = {
        id: slug,
        label: rawLabel,
        type: phType,
        ...(phType === 'choice' || phType === 'multi-choice' ? { options: [] } : {}),
        ...(phType === 'multi-choice' ? { joinSeparator: ', ' } : {}),
        ...(phType === 'number' ? { unit: '' } : {}),
      };

      draft.placeholders.push(newPh);
      insertAtCursor(templateArea, `{{${slug}}}`);
      draft.template = templateArea.value;

      addPlaceholderForm.style.display = 'none';
      this.renderPlaceholderList(draft, placeholderList, templateArea);
    });

    // Wire [Cancel] in mini-form
    this.registerDomEvent(miniCancelBtn, 'click', () => {
      addPlaceholderForm.style.display = 'none';
    });

    // Initial placeholder list render
    this.renderPlaceholderList(draft, placeholderList, templateArea);

    // --- Action row: Save + Delete ---
    const actionRow = this.formPanel.createDiv({ cls: 'rp-snippet-action-row' });

    // [Save snippet] button (T-5-06: disable during save)
    const saveBtn = actionRow.createEl('button', { text: 'Save snippet' });
    saveBtn.addClass('mod-cta');
    this.registerDomEvent(saveBtn, 'click', () => { void this.handleSave(draft, saveBtn); });

    // [Delete] button — two-step inline confirm (D-08 interaction contract)
    const deleteContainer = actionRow.createDiv();
    const deleteBtn = deleteContainer.createEl('button', { text: 'Delete' });
    deleteBtn.addClass('mod-warning');
    let deleteConfirmMode = false;

    const cancelDeleteSpan = deleteContainer.createEl('span', { text: ' Cancel' });
    cancelDeleteSpan.style.cursor = 'pointer';
    cancelDeleteSpan.style.marginLeft = 'var(--size-2-1)';
    cancelDeleteSpan.style.display = 'none';

    this.registerDomEvent(deleteBtn, 'click', () => {
      if (!deleteConfirmMode) {
        deleteBtn.textContent = 'Confirm delete?';
        cancelDeleteSpan.style.display = '';
        deleteConfirmMode = true;
      } else {
        void this.handleDelete(draft);
      }
    });

    this.registerDomEvent(cancelDeleteSpan, 'click', () => {
      deleteBtn.textContent = 'Delete';
      cancelDeleteSpan.style.display = 'none';
      deleteConfirmMode = false;
    });

    // Focus the name input for new drafts
    if (!draft.template && draft.name === 'Untitled') {
      nameInput.focus();
      nameInput.select();
    }
  }

  // ---------------------------------------------------------------------------
  // Placeholder list rendering (D-05, D-06, D-07, D-08)
  // ---------------------------------------------------------------------------

  private renderPlaceholderList(
    draft: SnippetFile,
    container: HTMLElement,
    templateArea: HTMLTextAreaElement
  ): void {
    container.empty();

    for (let i = 0; i < draft.placeholders.length; i++) {
      const ph = draft.placeholders[i];
      if (!ph) continue;
      this.renderPlaceholderChip(draft, ph, i, container, templateArea);
    }
  }

  private renderPlaceholderChip(
    draft: SnippetFile,
    ph: SnippetPlaceholder,
    index: number,
    container: HTMLElement,
    templateArea: HTMLTextAreaElement
  ): void {
    const chip = container.createDiv({ cls: 'rp-placeholder-chip' });
    // D-02: colour bar via border-left inline style
    chip.style.borderLeftColor = PH_COLOR[ph.type] ?? 'transparent';
    chip.setAttribute('draggable', 'true');

    // D-04: drag handle — far-left, 24px, cursor:grab via CSS
    const handle = chip.createSpan({ cls: 'rp-placeholder-chip-handle' });
    handle.textContent = '⠿';
    handle.setAttribute('aria-label', `Drag to reorder ${ph.label}`);

    // D-01: label — human-readable, NEVER {{id}} (CHIP-01)
    const labelSpan = chip.createSpan({ cls: 'rp-placeholder-chip-label' });
    labelSpan.textContent = ph.label;

    // D-01: type badge — reuses rp-placeholder-type-badge token
    const badge = chip.createSpan({ cls: 'rp-placeholder-chip-badge' });
    badge.textContent = ph.type;

    // D-01 / D-08: [×] remove button — always visible at right edge
    const removeBtn = chip.createEl('button', {
      cls: 'rp-placeholder-chip-remove',
      text: '×',
    });
    removeBtn.setAttribute('aria-label', `Remove placeholder ${ph.label}`);

    // D-05: HTML5 native drag events (addEventListener — chips recreated on each re-render)
    // WR-01: store drag index on dataset so it reflects the current render cycle index
    chip.dataset['dragIndex'] = String(index);

    chip.addEventListener('dragstart', (e: DragEvent) => {
      e.dataTransfer?.setData('text/plain', chip.dataset['dragIndex'] ?? String(index));
    });
    chip.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault(); // REQUIRED or drop will never fire
      chip.addClass('drag-over');
    });
    chip.addEventListener('dragenter', (e: DragEvent) => {
      e.preventDefault();
      chip.addClass('drag-over');
    });
    // WR-02: only remove drag-over when pointer truly leaves this chip (not a child element)
    chip.addEventListener('dragleave', (e: DragEvent) => {
      if (chip.contains(e.relatedTarget as Node | null)) return;
      chip.removeClass('drag-over');
    });
    chip.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      chip.removeClass('drag-over');
      const fromStr = e.dataTransfer?.getData('text/plain');
      const from = fromStr !== undefined ? parseInt(fromStr, 10) : -1;
      const to = parseInt(chip.dataset['dragIndex'] ?? '-1', 10);
      // WR-01: guard against NaN, same-slot, and out-of-range indices
      if (isNaN(from) || isNaN(to) || from === to || from < 0 || to < 0) return;
      if (from >= draft.placeholders.length || to >= draft.placeholders.length) return;
      const [moved] = draft.placeholders.splice(from, 1);
      if (moved) draft.placeholders.splice(to, 0, moved);
      this.renderPlaceholderList(draft, container, templateArea);
      void this.autoSaveAfterDrop(draft);
    });
    chip.addEventListener('dragend', () => {
      // Cleanup guard: dragover may not fire dragleave on every chip if drag exits list
      // WR-04: cast to HTMLElement so Obsidian's removeClass is available
      container.querySelectorAll('.drag-over').forEach(el => (el as HTMLElement).removeClass('drag-over'));
    });

    // D-03: click-to-expand — guard: not handle, not removeBtn
    this.registerDomEvent(chip, 'click', (e: MouseEvent) => {
      if (
        e.target === removeBtn ||
        (e.target as HTMLElement).closest('.rp-placeholder-chip-handle')
      ) return;
      chip.toggleClass('is-expanded', !chip.hasClass('is-expanded'));
      if (chip.hasClass('is-expanded')) {
        if (ph.type === 'number') {
          this.renderNumberExpanded(ph, chip);
        } else {
          this.renderExpandedPlaceholder(draft, ph, chip, templateArea, container, labelSpan, badge);
        }
      } else {
        chip.querySelector('.rp-placeholder-expanded')?.remove();
      }
    });

    // D-08: remove button click — stopPropagation so chip click handler doesn't fire
    this.registerDomEvent(removeBtn, 'click', (e: MouseEvent) => {
      e.stopPropagation();
      const removedId = ph.id;
      draft.placeholders.splice(index, 1);
      const isOrphaned = draft.template.includes(`{{${removedId}}}`);
      this.renderPlaceholderList(draft, container, templateArea);
      if (isOrphaned) {
        const orphanBadge = container.createDiv({ cls: 'rp-placeholder-orphan-badge' });
        orphanBadge.setAttribute('role', 'alert');
        orphanBadge.textContent = `Template still contains {{${removedId}}} — remove from template or re-add this placeholder.`;
      }
    });
  }

  private renderExpandedPlaceholder(
    draft: SnippetFile,
    ph: SnippetPlaceholder,
    row: HTMLElement,
    templateArea: HTMLTextAreaElement,
    container: HTMLElement,
    labelSpan: HTMLElement,
    badge: HTMLElement
  ): void {
    // Remove any existing expanded content
    const existing = row.querySelector('.rp-placeholder-expanded');
    if (existing) existing.remove();

    const expanded = row.createDiv({ cls: 'rp-placeholder-expanded' });

    // Label field
    const labelSec = expanded.createDiv({ cls: 'rp-snippet-form-section' });
    const labelLbl = labelSec.createEl('label');
    labelLbl.textContent = 'Label';
    labelLbl.htmlFor = `rp-ph-label-${ph.id}`;
    const labelInput = labelSec.createEl('input', { type: 'text' });
    labelInput.id = `rp-ph-label-${ph.id}`;
    labelInput.value = ph.label;
    // WR-05: use bare addEventListener — this element is transient (destroyed on collapse),
    // so registerDomEvent would accumulate ghost listeners in the view registry.
    labelInput.addEventListener('input', () => {
      ph.label = labelInput.value;
      labelSpan.textContent = ph.label;
    });

    // Type dropdown
    const typeSec = expanded.createDiv({ cls: 'rp-snippet-form-section' });
    const typeLbl = typeSec.createEl('label');
    typeLbl.textContent = 'Type';
    typeLbl.htmlFor = `rp-ph-type-${ph.id}`;
    const typeSelect = typeSec.createEl('select');
    typeSelect.id = `rp-ph-type-${ph.id}`;
    const phTypes: Array<{ value: SnippetPlaceholder['type']; label: string }> = [
      { value: 'free-text', label: 'Free text' },
      { value: 'choice', label: 'Choice' },
      { value: 'multi-choice', label: 'Multi-choice' },
      { value: 'number', label: 'Number' },
    ];
    for (const { value, label } of phTypes) {
      const opt = typeSelect.createEl('option', { text: label });
      opt.value = value;
    }
    typeSelect.value = ph.type;
    // WR-05: bare addEventListener — transient element, avoid view-registry accumulation
    typeSelect.addEventListener('change', () => {
      ph.type = typeSelect.value as SnippetPlaceholder['type'];
      badge.textContent = ph.type;
      // Update options/joinSeparator/unit based on new type
      if (ph.type === 'choice' || ph.type === 'multi-choice') {
        if (!ph.options) ph.options = [];
        if (ph.type === 'multi-choice' && !ph.joinSeparator) ph.joinSeparator = ', ';
        if (ph.type === 'choice') ph.joinSeparator = undefined;
        ph.unit = undefined;
      } else if (ph.type === 'number') {
        ph.options = undefined;
        ph.joinSeparator = undefined;
      } else {
        ph.options = undefined;
        ph.joinSeparator = undefined;
        ph.unit = undefined;
      }
      // Re-render expanded section
      this.renderExpandedPlaceholder(draft, ph, row, templateArea, container, labelSpan, badge);
    });

    // Options list (D-06)
    const optionsSec = expanded.createDiv({ cls: 'rp-snippet-form-section' });
    const optionsLbl = optionsSec.createEl('label');
    optionsLbl.textContent = 'Options';
    const optionList = optionsSec.createDiv({ cls: 'rp-option-list' });

    if (!ph.options) ph.options = [];

    const renderOptionRows = (): void => {
      optionList.empty();
      const options = ph.options ?? [];
      options.forEach((opt, oi) => {
        const optRow = optionList.createDiv({ cls: 'rp-option-row' });
        const optLabel = optRow.createEl('label');
        optLabel.htmlFor = `rp-opt-${ph.id}-${oi}`;
        optLabel.style.display = 'none'; // visually hidden but present for a11y; text is in input placeholder
        optLabel.textContent = `Option ${oi + 1}`;
        const optInput = optRow.createEl('input', { type: 'text' });
        optInput.id = `rp-opt-${ph.id}-${oi}`;
        optInput.value = opt;
        optInput.placeholder = `Option ${oi + 1}`;
        // WR-05: bare addEventListener — transient elements inside expanded section
        optInput.addEventListener('input', () => {
          if (ph.options) ph.options[oi] = optInput.value;
        });
        const removeOptBtn = optRow.createEl('button', { text: '×' });
        removeOptBtn.setAttribute('aria-label', `Remove ${opt || `option ${oi + 1}`}`);
        removeOptBtn.addEventListener('click', () => {
          ph.options?.splice(oi, 1);
          renderOptionRows();
        });
      });
    };
    renderOptionRows();

    const addOptionBtn = optionsSec.createEl('button', { text: '+ Add option' });
    // WR-05: bare addEventListener — transient element
    addOptionBtn.addEventListener('click', () => {
      if (!ph.options) ph.options = [];
      ph.options.push('');
      renderOptionRows();
    });

    // Join separator for multi-choice (D-07)
    if (ph.type === 'multi-choice') {
      const sepSec = expanded.createDiv({ cls: 'rp-snippet-form-section' });
      const sepLabel = sepSec.createEl('label');
      sepLabel.textContent = 'Join separator';
      sepLabel.htmlFor = `rp-ph-sep-${ph.id}`;
      const sepInput = sepSec.createEl('input', { type: 'text' });
      sepInput.id = `rp-ph-sep-${ph.id}`;
      sepInput.value = ph.joinSeparator ?? ', ';
      sepInput.placeholder = ', ';
      // WR-05: bare addEventListener — transient element
      sepInput.addEventListener('input', () => {
        ph.joinSeparator = sepInput.value;
      });
    }
  }

  private renderNumberExpanded(ph: SnippetPlaceholder, row: HTMLElement): void {
    const existing = row.querySelector('.rp-placeholder-expanded');
    if (existing) existing.remove();

    const expanded = row.createDiv({ cls: 'rp-placeholder-expanded' });

    // Unit field (D-08)
    const unitSec = expanded.createDiv({ cls: 'rp-snippet-form-section' });
    const unitLabel = unitSec.createEl('label');
    unitLabel.textContent = 'Unit (optional)';
    unitLabel.htmlFor = `rp-ph-unit-${ph.id}`;
    const unitInput = unitSec.createEl('input', { type: 'text' });
    unitInput.id = `rp-ph-unit-${ph.id}`;
    unitInput.value = ph.unit ?? '';
    unitInput.placeholder = 'e.g. mm';
    // WR-05: bare addEventListener — transient element, avoid view-registry accumulation
    unitInput.addEventListener('input', () => {
      ph.unit = unitInput.value || undefined;
    });
  }

  // ---------------------------------------------------------------------------
  // Orphan badge refresh (called on every template textarea input event)
  // ---------------------------------------------------------------------------

  private refreshOrphanBadges(draft: SnippetFile, container: HTMLElement): void {
    // Remove existing orphan badges
    container.querySelectorAll('.rp-placeholder-orphan-badge').forEach(el => el.remove());

    // Check for any {{id}} references with no matching placeholder
    const templateText = draft.template;
    const activeIds = new Set(draft.placeholders.map(p => p.id));
    const usedTokens = Array.from(templateText.matchAll(/\{\{([^}]+)\}\}/g)).map(m => m[1]);

    for (const token of usedTokens) {
      if (token && !activeIds.has(token)) {
        const badge = container.createDiv({ cls: 'rp-placeholder-orphan-badge' });
        badge.setAttribute('role', 'alert');
        badge.textContent = `Template still contains {{${token}}} — remove from template or re-add this placeholder.`;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  private async handleNewSnippet(): Promise<void> {
    // D-03: create unsaved draft, add to top of list, select it
    const newId = crypto.randomUUID();
    const newSnippet: SnippetFile = {
      kind: 'json',
      path: `${this.plugin.settings.snippetFolderPath}/${newId}.json`,
      id: newId,
      name: 'Untitled',
      template: '',
      placeholders: [],
    };

    // Add to top of local list (not saved yet)
    this.snippets.unshift(newSnippet);
    this.draft = newSnippet;

    // Rebuild list panel and form panel
    this.renderListPanel();
    this.renderFormPanel();
  }

  private async handleSave(draft: SnippetFile, saveBtn: HTMLButtonElement): Promise<void> {
    // T-5-06: disable during save to prevent rapid-click DoS
    saveBtn.disabled = true;
    try {
      // Phase 32 fix: draft.path is the authoritative on-disk location
      // (listFolder sets it; handleNewSnippet sets it to a UUID path). Derive
      // the new slug-based path from the current name; if it differs from
      // draft.path, delete the old file before writing the new one. Using
      // draft.path instead of draft.id avoids the stale-leftover bug where
      // snippets loaded via listFolder have no id field and the fallback
      // (draft.name) reads the already-updated name.
      const oldPath = draft.path;
      const slug = slugifyLabel(draft.name) || draft.id || 'untitled';
      draft.id = slug;
      const newPath = `${this.plugin.settings.snippetFolderPath}/${slug}.json`;

      if (oldPath !== newPath) {
        await this.plugin.snippetService.delete(oldPath);
      }

      draft.path = newPath;
      await this.plugin.snippetService.save(draft);

      // Sync local list — match by path (id is unreliable post-listFolder)
      const idx = this.snippets.findIndex(s => s.path === oldPath || s.path === newPath);
      if (idx !== -1) {
        this.snippets[idx] = draft;
      } else {
        this.snippets.unshift(draft);
      }

      new Notice('Snippet saved.');
      this.renderListPanel();
    } catch {
      new Notice('Failed to save snippet. Check that the vault is writable and try again.');
    } finally {
      saveBtn.disabled = false;
    }
  }

  private async handleDelete(draft: SnippetFile): Promise<void> {
    try {
      // Phase 32 fix: use draft.path (authoritative on-disk location).
      // Snippets loaded via listFolder have no id field, so draft.id ?? draft.name
      // would fall back to the (possibly-edited) name and miss the real file.
      const p = draft.path;
      await this.plugin.snippetService.delete(p);

      // Remove from local list — match by path (id is unreliable post-listFolder)
      const idx = this.snippets.findIndex(s => s.path === p);
      if (idx !== -1) {
        this.snippets.splice(idx, 1);
      }

      this.draft = null;
      new Notice('Snippet deleted.');
      this.renderListPanel();
      this.renderFormPanel();
    } catch {
      new Notice('Failed to delete snippet. Check file permissions and try again.');
    }
  }

  private async autoSaveAfterDrop(draft: SnippetFile): Promise<void> {
    // WR-03: new drafts still carry a raw UUID id (set in handleNewSnippet).
    // Auto-saving them here would bypass the id-from-name slug logic in handleSave
    // and create an orphaned UUID-keyed file. Skip silently; the in-memory order
    // is already correct and will be persisted when the user clicks "Save snippet".
    const isNewDraft = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((draft.id ?? draft.name));
    if (isNewDraft) return;
    try {
      await this.plugin.snippetService.save(draft);
      // Sync this.snippets so list panel reflects new order if user switches snippet
      const idx = this.snippets.findIndex(s => s.id === (draft.id ?? draft.name));
      if (idx !== -1) this.snippets[idx] = draft;
      new Notice('Snippet saved.');
    } catch {
      new Notice('Failed to save snippet. Check that the vault is writable and try again.');
    }
  }
}
