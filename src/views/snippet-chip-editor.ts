// views/snippet-chip-editor.ts
// Phase 33 (MODAL-06): Reusable placeholder chip editor extracted from legacy
// SnippetManagerView. This module owns ZERO plugin/view state — the caller
// passes a JsonSnippet draft, which is mutated in place, and an onChange
// callback invoked after every user-visible mutation so the consumer can
// track `hasUnsavedChanges` for the modal guard (MODAL-08).
//
// Transformation contract (per 33-PATTERNS.md):
//   - No plugin or app references (pure DOM + draft mutation)
//   - No `registerDomEvent` — bare `addEventListener` tracked in a listeners
//     array so destroy() can detach everything and empty the container.
//   - No path derivation — the modal save handler (Plan 03) owns path logic.
//   - insertAtCursor and PH_COLOR are module-local helpers (not exported).

import type { JsonSnippet, SnippetPlaceholder } from '../snippets/snippet-model';

// --- Module-local helpers (copied verbatim from legacy snippet-manager-view.ts) ---

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

// --- Public surface ---------------------------------------------------------

export interface ChipEditorHandle {
  /** Detach event listeners and clear the container. Called on modal close. */
  destroy(): void;
}

type ListenerTuple = {
  el: EventTarget;
  type: string;
  handler: EventListenerOrEventListenerObject;
};

/**
 * Phase 33 (MODAL-06): Reusable placeholder chip editor.
 *
 * The caller owns the `draft` — this helper mutates it in-place as the user
 * edits, and calls `onChange()` after every mutation so the caller can track
 * `hasUnsavedChanges`.
 *
 * The container is emptied on mount; the returned handle's `destroy()`
 * removes all listeners and empties the container again.
 */
export function mountChipEditor(
  container: HTMLElement,
  draft: JsonSnippet,
  onChange: () => void,
): ChipEditorHandle {
  container.empty();
  const listeners: ListenerTuple[] = [];

  // Local helper: track listeners for destroy()
  const on = <K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    handler: (ev: HTMLElementEventMap[K]) => void,
  ): void => {
    el.addEventListener(type, handler as EventListener);
    listeners.push({ el, type, handler: handler as EventListener });
  };
  const onRaw = (el: EventTarget, type: string, handler: EventListener): void => {
    el.addEventListener(type, handler);
    listeners.push({ el, type, handler });
  };

  // --- Name section ---
  const nameSection = container.createDiv({ cls: 'rp-snippet-form-section' });
  const nameLabel = nameSection.createEl('label');
  nameLabel.textContent = 'Name';
  nameLabel.htmlFor = 'rp-snippet-name-input';
  const nameInput = nameSection.createEl('input', { type: 'text' });
  nameInput.id = 'rp-snippet-name-input';
  nameInput.value = draft.name;
  nameInput.placeholder = 'Snippet name';
  on(nameInput, 'input', () => {
    draft.name = nameInput.value;
    onChange();
  });

  // --- Template section ---
  const templateSection = container.createDiv({ cls: 'rp-snippet-form-section' });
  const templateLabel = templateSection.createEl('label');
  templateLabel.textContent = 'Template';
  templateLabel.htmlFor = 'rp-snippet-template-input';
  const templateArea = templateSection.createEl('textarea');
  templateArea.id = 'rp-snippet-template-input';
  templateArea.value = draft.template;
  templateArea.placeholder = 'Enter template text. Use {{placeholder-id}} to insert placeholders.';
  on(templateArea, 'input', () => {
    draft.template = templateArea.value;
    refreshOrphanBadges(draft, placeholderList);
    onChange();
  });

  // --- [+ Add placeholder] button and inline mini-form (D-04) ---
  const addPlaceholderBtn = templateSection.createEl('button', { text: '+ Add placeholder' });
  addPlaceholderBtn.setAttribute('type', 'button');
  const addPlaceholderForm = templateSection.createDiv({ cls: 'rp-add-placeholder-form' });
  addPlaceholderForm.style.display = 'none';

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
  const placeholderSection = container.createDiv({ cls: 'rp-snippet-form-section' });
  const placeholderHeading = placeholderSection.createEl('label');
  placeholderHeading.textContent = 'Placeholders';
  const placeholderList = placeholderSection.createDiv({ cls: 'rp-placeholder-list' });

  // Wire [+ Add placeholder] button: show mini-form
  on(addPlaceholderBtn, 'click', () => {
    addPlaceholderForm.style.display = '';
    miniLabelInput.value = '';
    miniTypeSelect.value = 'free-text';
    miniLabelInput.focus();
  });

  // Wire [Add] in mini-form
  on(miniAddBtn, 'click', () => {
    const rawLabel = miniLabelInput.value.trim();
    if (!rawLabel) { miniLabelInput.focus(); return; }
    // Inline slugify to avoid importing slugifyLabel — keeps module lean and
    // matches the legacy behaviour (the same regex used by snippet-model).
    const slug = rawLabel
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');
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
    renderPlaceholderList();
    onChange();
  });

  // Wire [Cancel] in mini-form
  on(miniCancelBtn, 'click', () => {
    addPlaceholderForm.style.display = 'none';
  });

  // --- Placeholder list rendering ------------------------------------------
  //
  // These are closures (not methods) so destroy() can sever them cleanly.
  // Chip-level listeners are added via onRaw() so they land in the
  // tracked-listeners array just like top-level ones.

  function renderPlaceholderList(): void {
    placeholderList.empty();
    for (let i = 0; i < draft.placeholders.length; i++) {
      const ph = draft.placeholders[i];
      if (!ph) continue;
      renderPlaceholderChip(ph, i);
    }
    refreshOrphanBadges(draft, placeholderList);
  }

  function renderPlaceholderChip(ph: SnippetPlaceholder, index: number): void {
    const chip = placeholderList.createDiv({ cls: 'rp-placeholder-chip' });
    chip.style.borderLeftColor = PH_COLOR[ph.type] ?? 'transparent';
    chip.setAttribute('draggable', 'true');

    const handle = chip.createSpan({ cls: 'rp-placeholder-chip-handle' });
    handle.textContent = '⠿';
    handle.setAttribute('aria-label', `Drag to reorder ${ph.label}`);

    const labelSpan = chip.createSpan({ cls: 'rp-placeholder-chip-label' });
    labelSpan.textContent = ph.label;

    const badge = chip.createSpan({ cls: 'rp-placeholder-chip-badge' });
    badge.textContent = ph.type;

    const removeBtn = chip.createEl('button', {
      cls: 'rp-placeholder-chip-remove',
      text: '×',
    });
    removeBtn.setAttribute('type', 'button');
    removeBtn.setAttribute('aria-label', `Remove placeholder ${ph.label}`);

    chip.dataset['dragIndex'] = String(index);

    onRaw(chip, 'dragstart', ((e: DragEvent) => {
      e.dataTransfer?.setData('text/plain', chip.dataset['dragIndex'] ?? String(index));
    }) as EventListener);
    onRaw(chip, 'dragover', ((e: DragEvent) => {
      e.preventDefault();
      chip.addClass('drag-over');
    }) as EventListener);
    onRaw(chip, 'dragenter', ((e: DragEvent) => {
      e.preventDefault();
      chip.addClass('drag-over');
    }) as EventListener);
    onRaw(chip, 'dragleave', ((e: DragEvent) => {
      if (chip.contains(e.relatedTarget as Node | null)) return;
      chip.removeClass('drag-over');
    }) as EventListener);
    onRaw(chip, 'drop', ((e: DragEvent) => {
      e.preventDefault();
      chip.removeClass('drag-over');
      const fromStr = e.dataTransfer?.getData('text/plain');
      const from = fromStr !== undefined ? parseInt(fromStr, 10) : -1;
      const to = parseInt(chip.dataset['dragIndex'] ?? '-1', 10);
      if (isNaN(from) || isNaN(to) || from === to || from < 0 || to < 0) return;
      if (from >= draft.placeholders.length || to >= draft.placeholders.length) return;
      const [moved] = draft.placeholders.splice(from, 1);
      if (moved) draft.placeholders.splice(to, 0, moved);
      renderPlaceholderList();
      onChange();
    }) as EventListener);
    onRaw(chip, 'dragend', (() => {
      placeholderList.querySelectorAll('.drag-over').forEach(el => (el as HTMLElement).removeClass('drag-over'));
    }) as EventListener);

    on(chip, 'click', (e: MouseEvent) => {
      if (
        e.target === removeBtn ||
        (e.target as HTMLElement).closest('.rp-placeholder-chip-handle')
      ) return;
      chip.toggleClass('is-expanded', !chip.hasClass('is-expanded'));
      if (chip.hasClass('is-expanded')) {
        if (ph.type === 'number') {
          renderNumberExpanded(ph, chip);
        } else {
          renderExpandedPlaceholder(ph, chip, labelSpan, badge);
        }
      } else {
        chip.querySelector('.rp-placeholder-expanded')?.remove();
      }
    });

    on(removeBtn, 'click', (e: MouseEvent) => {
      e.stopPropagation();
      const removedId = ph.id;
      draft.placeholders.splice(index, 1);
      const isOrphaned = draft.template.includes(`{{${removedId}}}`);
      renderPlaceholderList();
      if (isOrphaned) {
        const orphanBadge = placeholderList.createDiv({ cls: 'rp-placeholder-orphan-badge' });
        orphanBadge.setAttribute('role', 'alert');
        orphanBadge.textContent = `Template still contains {{${removedId}}} — remove from template or re-add this placeholder.`;
      }
      onChange();
    });
  }

  function renderExpandedPlaceholder(
    ph: SnippetPlaceholder,
    row: HTMLElement,
    labelSpan: HTMLElement,
    badge: HTMLElement,
  ): void {
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
    on(labelInput, 'input', () => {
      ph.label = labelInput.value;
      labelSpan.textContent = ph.label;
      onChange();
    });

    // Type dropdown
    const typeSec = expanded.createDiv({ cls: 'rp-snippet-form-section' });
    const typeLbl = typeSec.createEl('label');
    typeLbl.textContent = 'Type';
    typeLbl.htmlFor = `rp-ph-type-${ph.id}`;
    const typeSelect = typeSec.createEl('select');
    typeSelect.id = `rp-ph-type-${ph.id}`;
    const phTypesLocal: Array<{ value: SnippetPlaceholder['type']; label: string }> = [
      { value: 'free-text', label: 'Free text' },
      { value: 'choice', label: 'Choice' },
      { value: 'multi-choice', label: 'Multi-choice' },
      { value: 'number', label: 'Number' },
    ];
    for (const { value, label } of phTypesLocal) {
      const opt = typeSelect.createEl('option', { text: label });
      opt.value = value;
    }
    typeSelect.value = ph.type;
    on(typeSelect, 'change', () => {
      ph.type = typeSelect.value as SnippetPlaceholder['type'];
      badge.textContent = ph.type;
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
      renderExpandedPlaceholder(ph, row, labelSpan, badge);
      onChange();
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
        optLabel.style.display = 'none';
        optLabel.textContent = `Option ${oi + 1}`;
        const optInput = optRow.createEl('input', { type: 'text' });
        optInput.id = `rp-opt-${ph.id}-${oi}`;
        optInput.value = opt;
        optInput.placeholder = `Option ${oi + 1}`;
        on(optInput, 'input', () => {
          if (ph.options) ph.options[oi] = optInput.value;
          onChange();
        });
        const removeOptBtn = optRow.createEl('button', { text: '×' });
        removeOptBtn.setAttribute('type', 'button');
        removeOptBtn.setAttribute('aria-label', `Remove ${opt || `option ${oi + 1}`}`);
        on(removeOptBtn, 'click', () => {
          ph.options?.splice(oi, 1);
          renderOptionRows();
          onChange();
        });
      });
    };
    renderOptionRows();

    const addOptionBtn = optionsSec.createEl('button', { text: '+ Add option' });
    addOptionBtn.setAttribute('type', 'button');
    on(addOptionBtn, 'click', () => {
      if (!ph.options) ph.options = [];
      ph.options.push('');
      renderOptionRows();
      onChange();
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
      on(sepInput, 'input', () => {
        ph.joinSeparator = sepInput.value;
        onChange();
      });
    }
  }

  function renderNumberExpanded(ph: SnippetPlaceholder, row: HTMLElement): void {
    const existing = row.querySelector('.rp-placeholder-expanded');
    if (existing) existing.remove();

    const expanded = row.createDiv({ cls: 'rp-placeholder-expanded' });

    const unitSec = expanded.createDiv({ cls: 'rp-snippet-form-section' });
    const unitLabel = unitSec.createEl('label');
    unitLabel.textContent = 'Unit (optional)';
    unitLabel.htmlFor = `rp-ph-unit-${ph.id}`;
    const unitInput = unitSec.createEl('input', { type: 'text' });
    unitInput.id = `rp-ph-unit-${ph.id}`;
    unitInput.value = ph.unit ?? '';
    unitInput.placeholder = 'e.g. mm';
    on(unitInput, 'input', () => {
      ph.unit = unitInput.value || undefined;
      onChange();
    });
  }

  // Initial placeholder list render
  renderPlaceholderList();

  return {
    destroy(): void {
      for (const { el, type, handler } of listeners) {
        el.removeEventListener(type, handler);
      }
      listeners.length = 0;
      container.empty();
    },
  };
}

// --- Orphan badge refresh --------------------------------------------------

function refreshOrphanBadges(draft: JsonSnippet, container: HTMLElement): void {
  container.querySelectorAll('.rp-placeholder-orphan-badge').forEach(el => el.remove());
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
