// views/snippet-fill-in-modal.ts
// Runtime fill-in modal for dynamic snippets (SNIP-04, SNIP-05, SNIP-09, D-10 through D-13)
import { Modal, App } from 'obsidian';
import type { JsonSnippet, SnippetPlaceholder } from '../snippets/snippet-model';
import { renderSnippet } from '../snippets/snippet-model';

// Phase 32 (D-01): JsonSnippet is the canonical type for fill-in modal input.
// Previously typed as `SnippetFile`, which is now an alias for `JsonSnippet`.

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
 * The modal has zero knowledge of the runner — it receives a SnippetFile and
 * resolves its promise. The caller decides what to do with the result.
 */
export class SnippetFillInModal extends Modal {
  private readonly snippet: JsonSnippet;
  private resolve!: (value: string | null) => void;
  /** Double-resolve guard (T-5-11, RESEARCH.md Pitfall 3) */
  private resolved = false;
  /** Awaitable promise resolved on Confirm or null on Cancel/Escape */
  readonly result: Promise<string | null>;

  /** Map of placeholder id → current string value used for live preview */
  private readonly values: Record<string, string> = {};

  /** Live preview textarea reference for updatePreview() calls */
  private previewTextarea: HTMLTextAreaElement | null = null;

  constructor(app: App, snippet: JsonSnippet) {
    super(app);
    this.snippet = snippet;
    this.result = new Promise<string | null>(res => {
      this.resolve = res;
    });
  }

  onOpen(): void {
    this.titleEl.setText(this.snippet.name);
    this.contentEl.addClass('rp-snippet-modal');

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

  /** free-text: visible label + full-width text input */
  private renderFreeTextField(container: HTMLElement, placeholder: SnippetPlaceholder): void {
    const label = container.createEl('label', { cls: 'rp-snippet-modal-label' });
    label.textContent = placeholder.label;

    const input = container.createEl('input', { type: 'text' });

    input.addEventListener('input', () => {
      this.values[placeholder.id] = input.value;
      this.updatePreview();
    });
  }

  /**
   * Phase 52 D-05: unified choice field — checkbox-list always.
   * Includes a "Custom:" free-text override at the bottom (SNIP-09, D-06/D-09).
   * Selecting a checkbox clears custom input; typing in custom clears all checkboxes.
   * 0 checked + empty Custom → empty string (D-09).
   */
  private renderChoiceField(
    container: HTMLElement,
    placeholder: SnippetPlaceholder,
  ): void {
    const fieldset = container.createEl('fieldset');
    const legend = fieldset.createEl('legend', { cls: 'rp-snippet-modal-label' });
    legend.textContent = placeholder.label;

    const optionsDiv = fieldset.createDiv({ cls: 'rp-snippet-modal-options rp-stack' });
    const options = placeholder.options ?? [];

    const checkboxEls: HTMLInputElement[] = [];
    let customInput: HTMLInputElement | null = null;

    /** Recompute the current value from custom input or checkbox state. */
    const recomputeValue = (): void => {
      if (customInput && customInput.value.trim() !== '') {
        // Custom value takes precedence over checkbox selection (D-06)
        this.values[placeholder.id] = customInput.value.trim();
      } else {
        const selected = checkboxEls
          .filter(cb => cb.checked)
          .map(cb => cb.value);
        const sep = placeholder.separator ?? ', ';
        this.values[placeholder.id] = selected.join(sep);
      }
      this.updatePreview();
    };

    // Render one checkbox per predefined option
    for (const opt of options) {
      const row = optionsDiv.createDiv({ cls: 'rp-snippet-fill-option-row' });

      const ctrl = row.createEl('input', { type: 'checkbox' });
      ctrl.name = `rp-${placeholder.id}`;
      ctrl.value = opt;

      const lbl = row.createEl('label');
      lbl.textContent = opt;

      checkboxEls.push(ctrl);

      ctrl.addEventListener('change', () => {
        // Clear custom input when a checkbox is toggled (D-06)
        if (customInput) {
          customInput.value = '';
        }
        recomputeValue();
      });
    }

    // Custom: free-text override (SNIP-09, D-06/D-09) — always shown below options
    const customRow = optionsDiv.createDiv({ cls: 'rp-snippet-modal-custom-row' });
    const customLabel = customRow.createEl('label');
    customLabel.textContent = 'Custom:';

    customInput = customRow.createEl('input', { type: 'text' });
    customInput.setAttribute('aria-label', `Custom value for ${placeholder.label}`);

    customInput.addEventListener('input', () => {
      if (customInput && customInput.value.trim() !== '') {
        // Deselect all checkboxes when custom is typed (D-06)
        for (const cb of checkboxEls) {
          cb.checked = false;
        }
      }
      recomputeValue();
    });
  }

  /** Render the live preview section below all placeholder fields (D-13). */
  private renderPreview(): void {
    const previewSection = this.contentEl.createDiv();

    const previewLabel = previewSection.createEl('p', { cls: 'rp-snippet-preview-label' });
    previewLabel.textContent = 'Preview';

    this.previewTextarea = previewSection.createEl('textarea', { cls: 'rp-snippet-preview' });
    this.previewTextarea.readOnly = true;
    this.previewTextarea.setAttribute('aria-label', 'Snippet preview');
    // Show the raw template initially (unfilled tokens visible per UI-SPEC empty state)
    this.previewTextarea.value = this.snippet.template;
  }

  /** Update the live preview textarea with current field values. */
  private updatePreview(): void {
    if (this.previewTextarea) {
      this.previewTextarea.value = renderSnippet(this.snippet, this.values);
    }
  }

  /** Render the Cancel / Confirm button row. Confirm is the last tab stop (D-12). */
  private renderButtonRow(): void {
    const row = this.contentEl.createDiv({ cls: 'rp-snippet-modal-btn-row' });

    const cancelBtn = row.createEl('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      this.safeResolve(null);
      this.close();
    });

    const confirmBtn = row.createEl('button', { cls: 'mod-cta' });
    confirmBtn.textContent = 'Confirm';
    confirmBtn.addEventListener('click', () => {
      const rendered = renderSnippet(this.snippet, this.values);
      this.safeResolve(rendered);
      this.close();
    });
  }
}
