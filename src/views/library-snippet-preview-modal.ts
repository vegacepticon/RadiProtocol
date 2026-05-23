// views/library-snippet-preview-modal.ts
// Preview a remote library snippet without installing it into the vault.
import { App, Modal } from 'obsidian';
import type { JsonSnippet, SnippetPlaceholder } from '../snippets/snippet-model';
import { renderSnippet } from '../snippets/snippet-model';
import type { Translator } from '../i18n';

export class LibrarySnippetPreviewModal extends Modal {
  private readonly snippet: JsonSnippet;
  private readonly t: Translator;
  private readonly values: Record<string, string> = {};
  private previewTextarea: HTMLTextAreaElement | null = null;

  constructor(app: App, snippet: JsonSnippet, t: Translator) {
    super(app);
    this.snippet = snippet;
    this.t = t;
  }

  onOpen(): void {
    this.titleEl.setText(this.t('library.previewTitle', { name: this.snippet.name }));
    this.contentEl.addClass('rp-library-preview-modal');

    const modalEl = (this as unknown as { modalEl?: { addClass?: (cls: string) => void } }).modalEl;
    if (typeof modalEl?.addClass === 'function') {
      modalEl.addClass('rp-library-preview-modal-container');
    }

    if (this.snippet.validationError) {
      this.contentEl.createEl('p', {
        cls: 'rp-library-preview-error',
        text: this.snippet.validationError,
      });
    }

    for (const placeholder of this.snippet.placeholders) {
      this.values[placeholder.id] = '';
      this.renderField(placeholder);
    }

    this.renderPreview();
    this.renderButtonRow();
  }

  onClose(): void {
    this.contentEl.empty();
    this.previewTextarea = null;
  }

  private renderField(placeholder: SnippetPlaceholder): void {
    const fieldDiv = this.contentEl.createDiv({ cls: 'rp-library-preview-field rp-stack' });
    if (placeholder.type === 'free-text') {
      this.renderFreeTextField(fieldDiv, placeholder);
    } else if (placeholder.type === 'choice') {
      this.renderChoiceField(fieldDiv, placeholder);
    }
  }

  private renderFreeTextField(container: HTMLElement, placeholder: SnippetPlaceholder): void {
    const label = container.createEl('label', { cls: 'rp-library-preview-label' });
    label.textContent = placeholder.label; // User-authored content, not a UI string

    const input = container.createEl('input', { type: 'text' });
    input.addEventListener('input', () => {
      this.values[placeholder.id] = input.value;
      input.toggleClass('rp-snippet-field-filled', input.value.length > 0);
      this.updatePreview();
    });
  }

  private renderChoiceField(container: HTMLElement, placeholder: SnippetPlaceholder): void {
    const fieldset = container.createEl('fieldset');
    const legend = fieldset.createEl('legend', { cls: 'rp-library-preview-label' });
    legend.textContent = placeholder.label; // User-authored content, not a UI string

    const optionsDiv = fieldset.createDiv({ cls: 'rp-library-preview-options' });
    const optionButtons: HTMLButtonElement[] = [];
    let customInput: HTMLInputElement | null = null;

    const recomputeValue = (): void => {
      if (customInput && customInput.value.trim() !== '') {
        this.values[placeholder.id] = customInput.value.trim();
      } else {
        const selected = optionButtons
          .filter((btn) => btn.hasClass('is-selected'))
          .map((btn) => btn.value);
        this.values[placeholder.id] = selected.join(placeholder.separator ?? ', ');
      }
      this.updatePreview();
    };

    for (const opt of placeholder.options ?? []) {
      const btn = optionsDiv.createEl('button', {
        cls: 'rp-library-preview-option-row',
        type: 'button',
      });
      btn.textContent = opt; // User-authored content, not a UI string
      btn.value = opt;
      btn.setAttribute('aria-pressed', 'false');
      optionButtons.push(btn);
      btn.addEventListener('click', () => {
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

    const customWrapper = optionsDiv.createDiv({ cls: 'rp-library-preview-custom-wrapper' });
    const customToggle = customWrapper.createEl('button', {
      cls: 'rp-library-preview-custom-toggle',
      type: 'button',
    });
    customToggle.textContent = '✎';
    customToggle.setAttribute('aria-label', this.t('library.previewCustomAria', { label: placeholder.label }));
    customToggle.setAttribute('aria-expanded', 'false');

    const customRow = customWrapper.createDiv({ cls: 'rp-library-preview-custom-row' });
    customRow.setAttribute('hidden', 'true');
    const customLabel = customRow.createEl('label');
    customLabel.textContent = this.t('library.previewCustom');

    customInput = customRow.createEl('input', { type: 'text' });
    customInput.setAttribute('aria-label', this.t('library.previewCustomValueAria', { label: placeholder.label }));

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
        for (const btn of optionButtons) {
          btn.removeClass('is-selected');
          btn.setAttribute('aria-pressed', 'false');
        }
      }
      recomputeValue();
    });
  }

  private renderPreview(): void {
    const previewSection = this.contentEl.createDiv({ cls: 'rp-library-preview-section' });
    const previewLabel = previewSection.createEl('p', { cls: 'rp-library-preview-label' });
    previewLabel.textContent = this.t('library.previewOutput');

    this.previewTextarea = previewSection.createEl('textarea', { cls: 'rp-library-preview-output' });
    this.previewTextarea.readOnly = true;
    this.previewTextarea.setAttribute('aria-label', this.t('library.previewOutput'));
    this.previewTextarea.value = this.snippet.template;
    this.resizePreview();
  }

  private renderButtonRow(): void {
    const row = this.contentEl.createDiv({ cls: 'rp-library-preview-button-row' });
    const closeBtn = row.createEl('button', { cls: 'mod-cta' });
    closeBtn.textContent = this.t('library.previewClose');
    closeBtn.addEventListener('click', () => {
      this.close();
    });
  }

  private updatePreview(): void {
    if (!this.previewTextarea) return;
    this.previewTextarea.value = renderSnippet(this.snippet, this.values);
    this.resizePreview();
  }

  private resizePreview(): void {
    if (!this.previewTextarea) return;
    const scrollHeight = this.previewTextarea.scrollHeight;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.previewTextarea as any).style.height = `${Math.max(160, scrollHeight)}px`;
  }
}
