// views/snippet-fill-in-modal.ts
// Runtime fill-in modal for dynamic snippets (SNIP-04, SNIP-05, SNIP-09, D-10 through D-13)
import { Modal, App } from 'obsidian';
import type { MdTemplateSnippet, SnippetPlaceholder } from '../snippets/snippet-model';
import { renderMdTemplateSnippet } from '../snippets/snippet-model';
import type { Translator } from '../i18n';
import { defaultT } from '../i18n';
import { createTextarea } from '../utils/dom-helpers';

// Phase 2 (JSON-removal): the fill-in modal accepts Markdown template snippets
// only and renders exclusively via renderMdTemplateSnippet.

/**
 * SnippetFillInModal — presented by a runner host when the runner reaches a text-block
 * node with a snippetId attached.
 *
 * Usage:
 *   const modal = new SnippetFillInModal(this.app, snippet);
 *   modal.open();
 *   const rendered = await modal.result;  // string | null
 *
 * Returns:
 *   - string  — fully-rendered snippet text (Confirm path)
 *   - null    — user cancelled or pressed Escape (runner skips snippet, D-11)
 *
 * The modal has zero knowledge of the runner — it receives a Markdown template
 * snippet and resolves its promise. The caller decides what to do with the result.
 */
export class SnippetFillInModal extends Modal {
  private readonly snippet: MdTemplateSnippet;
  private resolve!: (value: string | null) => void;
  /** Double-resolve guard (T-5-11, RESEARCH.md Pitfall 3) */
  private resolved = false;
  /** Awaitable promise resolved on Confirm or null on Cancel/Escape */
  readonly result: Promise<string | null>;

  /** Map of placeholder id → current string value used for live preview */
  private readonly values: Record<string, string> = {};

  /** Live preview container reference for updatePreview() calls */
  private previewEl: HTMLDivElement | null = null;
  private readonly t: Translator;

  constructor(app: App, snippet: MdTemplateSnippet, t?: Translator) {
    super(app);
    this.snippet = snippet;
    this.t = t ?? defaultT;
    this.result = new Promise<string | null>(res => {
      this.resolve = res;
    });
  }

  onOpen(): void {
    this.titleEl.setText(this.snippet.name);
    this.contentEl.addClass('rp-snippet-modal');

    // D-07: wide Obsidian modal (same pattern as snippet-editor-modal)
    const modalEl = (this as unknown as { modalEl?: { addClass?: (cls: string) => void } }).modalEl;
    if (typeof modalEl?.addClass === 'function') {
      modalEl.addClass('rp-snippet-fill-modal');
    }

    // Darken the entire workspace behind the modal (.modal-bg lives inside
    // containerEl) so attention stays on placeholder filling. containerEl is
    // torn down with the modal — no explicit cleanup needed.
    const containerEl = this.containerEl as HTMLElement | undefined;
    if (containerEl && typeof containerEl.addClass === 'function') {
      containerEl.addClass('rp-snippet-fill-modal-backdrop');
    }

    // Initialize values map with empty strings for every placeholder
    for (const p of this.snippet.placeholders) {
      this.values[p.id] = '';
    }

    // Render one field per placeholder in array order (D-12: tab order = array order)
    for (const placeholder of this.snippet.placeholders) {
      this.renderField(placeholder);
    }

    // Live preview section (D-13)
    this.renderPreview();

    // Button row — [Confirm] is last tab stop (D-12)
    this.renderButtonRow();
  }

  onClose(): void {
    // Escape key or external close — resolve with null if not already resolved (T-5-11)
    this.safeResolve(null);
    this.contentEl.empty();
  }

  /**
   * Resolve the result promise at most once (T-5-11).
   * Guards against null overwriting a prior Confirm resolution.
   */
  private safeResolve(value: string | null): void {
    if (!this.resolved) {
      this.resolved = true;
      this.resolve(value);
    }
  }

  /** Render the appropriate input field for a single placeholder. */
  private renderField(placeholder: SnippetPlaceholder): void {
    const fieldDiv = this.contentEl.createDiv({ cls: 'rp-snippet-modal-field rp-stack' });
    if (placeholder.type === 'free-text') {
      this.renderFreeTextField(fieldDiv, placeholder);
    } else if (placeholder.type === 'choice') {
      this.renderChoiceField(fieldDiv, placeholder);
    }
    // Phase 52: unknown types render nothing. Plan 04 guards upstream via validationError.
  }

  /**
   * free-text: visible label + auto-growing textarea. Same compact-start /
   * grow-with-content behavior as the runner's free-text Answer fields
   * (rows=1, CSS min-height, JS grow via scrollHeight).
   */
  private renderFreeTextField(container: HTMLElement, placeholder: SnippetPlaceholder): void {
    const label = container.createEl('label', { cls: 'rp-snippet-modal-label' });
    label.textContent = placeholder.label; // User-authored content, not a UI string

    const textarea = createTextarea(label, {
      cls: 'rp-snippet-modal-free-text',
      // Start at a single compact line; growInput expands it as content grows.
      attr: { rows: 1 },
    });

    textarea.addEventListener('input', () => {
      this.values[placeholder.id] = textarea.value;
      textarea.toggleClass('rp-snippet-field-filled', textarea.value.length > 0);
      this.growInput(textarea);
      this.updatePreview();
    });
  }

  /** Expand a single-line input textarea to fit its content (runner free-text pattern). */
  private growInput(textarea: HTMLTextAreaElement): void {
    textarea.setCssProps({ height: 'auto' });
    textarea.setCssProps({ height: `${textarea.scrollHeight}px` });
  }

  /**
   * Phase 52 D-05: unified choice field — multi-select option buttons.
   * Includes a "Custom:" free-text override at the bottom (SNIP-09, D-06/D-09).
   * Selecting an option clears custom input; typing in custom clears all selected options.
   * 0 selected + empty Custom → empty string (D-09).
   */
  private renderChoiceField(
    container: HTMLElement,
    placeholder: SnippetPlaceholder,
  ): void {
    const fieldset = container.createEl('fieldset');
    const legend = fieldset.createEl('legend', { cls: 'rp-snippet-modal-label' });
    legend.textContent = placeholder.label; // User-authored content, not a UI string

    const optionsDiv = fieldset.createDiv({ cls: 'rp-snippet-modal-options' });
    const options = placeholder.options ?? [];

    const optionButtons: HTMLButtonElement[] = [];
    let customInput: HTMLTextAreaElement | null = null;

    /** Recompute the current value from custom input or toggle-button state. */
    const recomputeValue = (): void => {
      if (customInput && customInput.value.trim() !== '') {
        // Custom value takes precedence over option selection (D-06)
        this.values[placeholder.id] = customInput.value.trim();
      } else {
        const selected = optionButtons
          .filter(btn => btn.hasClass('is-selected'))
          .map(btn => btn.value);
        const sep = placeholder.separator ?? ', ';
        this.values[placeholder.id] = selected.join(sep);
      }
      this.updatePreview();
    };

    // Render one toggle pill button per predefined option
    for (const opt of options) {
      const btn = optionsDiv.createEl('button', {
        cls: 'rp-snippet-fill-option-row',
        type: 'button',
      });
      btn.textContent = opt; // User-authored content, not a UI string
      btn.name = `rp-${placeholder.id}`;
      btn.value = opt;
      btn.setAttribute('aria-pressed', 'false');

      optionButtons.push(btn);

      btn.addEventListener('click', () => {
        // Clear custom input when an option button is toggled (D-06)
        if (customInput) {
          customInput.value = '';
          customInput.removeClass('rp-snippet-field-filled');
        }

        const selected = !btn.hasClass('is-selected');
        btn.toggleClass('is-selected', selected);
        btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
        recomputeValue();
      });
    }

    // Custom: free-text override (SNIP-09, D-06/D-09), collapsed by default to reduce visual noise.
    // The toggle sits inline right after the predefined option pills; the
    // input row expands below the option list when opened.
    const customToggle = optionsDiv.createEl('button', {
      cls: 'rp-snippet-modal-custom-toggle',
      type: 'button',
    });
    customToggle.textContent = '✎'; // Non-translatable edit-toggle symbol
    customToggle.setAttribute('aria-label', this.t('snippetPreview.showCustomAria', { label: placeholder.label }));
    customToggle.setAttribute('aria-expanded', 'false');

    const customRow = fieldset.createDiv({ cls: 'rp-snippet-modal-custom-row' });
    customRow.setAttribute('hidden', 'true');
    const customLabel = customRow.createEl('label');
    customLabel.textContent = this.t('snippetFillIn.customLabel');

    customInput = createTextarea(customRow, {
      cls: 'rp-snippet-modal-custom-input',
      // Same compact auto-growing behavior as free-text placeholder fields.
      attr: { rows: 1 },
    });
    customInput.setAttribute('aria-label', this.t('snippetPreview.customValueAria', { label: placeholder.label }));

    const setCustomOpen = (open: boolean): void => {
      customToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        customRow.removeAttribute('hidden');
        customRow.addClass('is-open');
        customInput?.focus();
      } else {
        customRow.setAttribute('hidden', 'true');
        customRow.removeClass('is-open');
      }
    };

    customToggle.addEventListener('click', () => {
      setCustomOpen(customToggle.getAttribute('aria-expanded') !== 'true');
    });

    customInput.addEventListener('input', () => {
      customInput.toggleClass('rp-snippet-field-filled', customInput.value.length > 0);
      if (customInput.value.trim() !== '') {
        // Deselect all option buttons when custom is typed (D-06)
        for (const btn of optionButtons) {
          btn.removeClass('is-selected');
          btn.setAttribute('aria-pressed', 'false');
        }
      }
      this.growInput(customInput);
      recomputeValue();
    });
  }

  /** Render the live preview section below all placeholder fields (D-13). */
  private renderPreview(): void {
    const previewSection = this.contentEl.createDiv();

    const previewLabel = previewSection.createEl('p', { cls: 'rp-snippet-preview-label' });
    previewLabel.textContent = this.t('snippetFillIn.preview');

    // A div (not a textarea) so inserted placeholder values can be highlighted
    // with spans; static text is preserved verbatim via text nodes.
    this.previewEl = previewSection.createDiv({ cls: 'rp-snippet-preview' });
    this.previewEl.setAttribute('role', 'textbox');
    this.previewEl.setAttribute('aria-readonly', 'true');
    // No aria-label here: Obsidian renders it as a hover tooltip over the
    // preview, and the visible "Preview" heading above already names this
    // region (hover-noise policy, see 3.5.8).
    // Show the raw template initially (unfilled tokens visible per UI-SPEC empty state)
    this.renderPreviewContent();
    this.resizePreview();
  }

  /** Rebuild the preview content: static text nodes + highlighted value spans. */
  private renderPreviewContent(): void {
    if (!this.previewEl) return;
    this.previewEl.empty();
    for (const segment of this.buildPreviewSegments()) {
      if (segment.filled) {
        const span = this.previewEl.createSpan({ cls: 'rp-snippet-preview-value' });
        span.textContent = segment.text;
      } else {
        this.previewEl.appendText(segment.text);
      }
    }
  }

  /**
   * Split the rendered snippet into segments around filled placeholder values.
   * Unfilled placeholders stay as raw `{{id}}` tokens in static text.
   */
  private buildPreviewSegments(): Array<{ text: string; filled: boolean }> {
    const segments: Array<{ text: string; filled: boolean }> = [];
    let output = this.snippet.template;
    for (const placeholder of this.snippet.placeholders) {
      const raw = this.values[placeholder.id] ?? '';
      if (raw.length === 0) continue;
      const token = `{{${placeholder.id}}}`;
      const index = output.indexOf(token);
      if (index < 0) continue;
      if (index > 0) segments.push({ text: output.slice(0, index), filled: false });
      segments.push({ text: raw, filled: true });
      output = output.slice(index + token.length);
    }
    if (output.length > 0) segments.push({ text: output, filled: false });
    return segments;
  }

  /** Keep preview compact for short text and readable for long rendered snippets. */
  private resizePreview(): void {
    if (!this.previewEl) return;
    const scrollHeight = this.previewEl.scrollHeight;
    this.previewEl.style.height = `${Math.max(160, scrollHeight)}px`;
  }

  /** True when every placeholder has a selected/typed value. */
  private areAllPlaceholdersFilled(): boolean {
    return this.snippet.placeholders.length > 0
      && this.snippet.placeholders.every((placeholder) => (this.values[placeholder.id] ?? '').length > 0);
  }

  /** Update the live preview with current field values. */
  private updatePreview(): void {
    if (this.previewEl) {
      this.renderPreviewContent();
      this.previewEl.toggleClass(
        'rp-snippet-preview-complete',
        this.areAllPlaceholdersFilled(),
      );
      this.resizePreview();
    }
  }

  private renderCurrentSnippet(): string {
    return renderMdTemplateSnippet(this.snippet, this.values);
  }

  /** Render the Cancel / Confirm button row. Confirm is the last tab stop (D-12). */
  private renderButtonRow(): void {
    const row = this.contentEl.createDiv({ cls: 'rp-snippet-modal-btn-row' });

    const cancelBtn = row.createEl('button');
    cancelBtn.textContent = this.t('snippetEditor.cancel');
    cancelBtn.addEventListener('click', () => {
      this.safeResolve(null);
      this.close();
    });

    const confirmBtn = row.createEl('button', { cls: 'mod-cta' });
    confirmBtn.textContent = this.t('snippetFillIn.confirm');
    confirmBtn.addEventListener('click', () => {
      const rendered = this.renderCurrentSnippet();
      this.safeResolve(rendered);
      this.close();
    });
  }
}
