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
    try {
      this.snippets = await this.plugin.snippetService.list();
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
      const row = this.listPanel.querySelector(`[data-snippet-id="${draft.id}"]`) as HTMLElement | null;
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
    const miniCancelBtn = miniActionRow.createEl('button', { text: 'Cancel' });

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
      this.renderPlaceholderRow(draft, ph, i, container, templateArea);
    }
  }

  private renderPlaceholderRow(
    draft: SnippetFile,
    ph: SnippetPlaceholder,
    index: number,
    container: HTMLElement,
    templateArea: HTMLTextAreaElement
  ): void {
    const row = container.createDiv({ cls: 'rp-placeholder-row' });

    // Row header: label, type badge, [×] remove
    const header = row.createDiv({ cls: 'rp-placeholder-row-header' });
    const labelSpan = header.createSpan();
    labelSpan.textContent = ph.label;
    const badge = header.createSpan({ cls: 'rp-placeholder-type-badge' });
    badge.textContent = ph.type;

    // Spacer
    header.createSpan().style.flex = '1';

    const removeBtn = header.createEl('button', { text: '×' });
    removeBtn.setAttribute('aria-label', `Remove placeholder ${ph.label}`);
    removeBtn.style.padding = '0 var(--size-4-1)';

    this.registerDomEvent(removeBtn, 'click', (e: MouseEvent) => {
      e.stopPropagation();
      const removedId = ph.id;
      draft.placeholders.splice(index, 1);

      // Check for orphaned {{id}} in template (D-05)
      const isOrphaned = draft.template.includes(`{{${removedId}}}`);

      this.renderPlaceholderList(draft, container, templateArea);

      if (isOrphaned) {
        const orphanBadge = container.createDiv({ cls: 'rp-placeholder-orphan-badge' });
        orphanBadge.setAttribute('role', 'alert');
        orphanBadge.textContent = `Template still contains {{${removedId}}} — remove from template or re-add this placeholder.`;
      }
    });

    // Expand inline for choice/multi-choice (D-06) or show unit for number (D-08)
    if (ph.type === 'choice' || ph.type === 'multi-choice') {
      this.registerDomEvent(header, 'click', (e: MouseEvent) => {
        // Don't expand when clicking remove
        if (e.target === removeBtn) return;
        row.toggleClass('is-expanded', !row.hasClass('is-expanded'));
        if (row.hasClass('is-expanded')) {
          this.renderExpandedPlaceholder(draft, ph, row, templateArea, container, labelSpan, badge);
        } else {
          // Collapse: remove expanded content
          const expanded = row.querySelector('.rp-placeholder-expanded');
          if (expanded) expanded.remove();
        }
      });
    } else if (ph.type === 'number') {
      this.registerDomEvent(header, 'click', (e: MouseEvent) => {
        if (e.target === removeBtn) return;
        row.toggleClass('is-expanded', !row.hasClass('is-expanded'));
        if (row.hasClass('is-expanded')) {
          this.renderNumberExpanded(ph, row);
        } else {
          const expanded = row.querySelector('.rp-placeholder-expanded');
          if (expanded) expanded.remove();
        }
      });
    }
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
    this.registerDomEvent(labelInput, 'input', () => {
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
    this.registerDomEvent(typeSelect, 'change', () => {
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
        this.registerDomEvent(optInput, 'input', () => {
          if (ph.options) ph.options[oi] = optInput.value;
        });
        const removeOptBtn = optRow.createEl('button', { text: '×' });
        removeOptBtn.setAttribute('aria-label', `Remove ${opt || `option ${oi + 1}`}`);
        this.registerDomEvent(removeOptBtn, 'click', () => {
          ph.options?.splice(oi, 1);
          renderOptionRows();
        });
      });
    };
    renderOptionRows();

    const addOptionBtn = optionsSec.createEl('button', { text: '+ Add option' });
    this.registerDomEvent(addOptionBtn, 'click', () => {
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
      this.registerDomEvent(sepInput, 'input', () => {
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
    this.registerDomEvent(unitInput, 'input', () => {
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
    const newSnippet: SnippetFile = {
      id: crypto.randomUUID(),
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
      // Derive id from name so canvas files can reference snippets by human-readable slug
      const oldId = draft.id;
      draft.id = slugifyLabel(draft.name) || oldId;

      // If the id changed (e.g. was a UUID on first save), delete the old file
      if (oldId !== draft.id) {
        await this.plugin.snippetService.delete(oldId);
      }

      await this.plugin.snippetService.save(draft);

      // Sync local list — update existing or add if not present
      const idx = this.snippets.findIndex(s => s.id === draft.id);
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
      await this.plugin.snippetService.delete(draft.id);

      // Remove from local list
      const idx = this.snippets.findIndex(s => s.id === draft.id);
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
}
