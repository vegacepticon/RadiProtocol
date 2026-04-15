// views/confirm-modal.ts
// Phase 33 (DEL-02, FOLDER-02, MODAL-08): Generic confirm modal.
// Reused for snippet delete, folder delete, and unsaved-changes guard.
//
// Pattern: modelled on src/views/node-switch-guard-modal.ts —
// Promise<ConfirmResult> result + safeResolve double-guard.
import { App, Modal } from 'obsidian';

export type ConfirmResult = 'confirm' | 'cancel' | 'discard';

export interface ConfirmModalOptions {
  title: string;
  body: string | HTMLElement;
  confirmLabel: string;
  cancelLabel: string;
  /** When true, the confirm button is rendered as a destructive (red) action. */
  destructive?: boolean;
  /**
   * When set, renders the 3-button variant for unsaved-changes guards
   * (MODAL-08). Button order per UI-SPEC: discard · cancel · confirm.
   */
  discardLabel?: string;
}

/**
 * Generic confirmation dialog with 2-button or 3-button variants.
 *
 * Usage:
 *   const modal = new ConfirmModal(app, {
 *     title: 'Delete snippet?',
 *     body: 'This cannot be undone.',
 *     confirmLabel: 'Delete',
 *     cancelLabel: 'Cancel',
 *     destructive: true,
 *   });
 *   modal.open();
 *   const result = await modal.result; // 'confirm' | 'cancel' | 'discard'
 *
 * Esc / overlay click resolves to 'cancel' (default).
 * Enter key triggers the confirm button.
 */
export class ConfirmModal extends Modal {
  readonly result: Promise<ConfirmResult>;
  private resolve!: (value: ConfirmResult) => void;
  private resolved = false;
  private readonly options: ConfirmModalOptions;

  constructor(app: App, options: ConfirmModalOptions) {
    super(app);
    this.options = options;
    this.result = new Promise<ConfirmResult>(res => {
      this.resolve = res;
    });
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.options.title);
    contentEl.empty();

    if (typeof this.options.body === 'string') {
      contentEl.createEl('p', { text: this.options.body });
    } else {
      contentEl.appendChild(this.options.body);
    }

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

    // 3-button variant: discard (leftmost)
    if (this.options.discardLabel !== undefined) {
      const discardBtn = btnRow.createEl('button', { text: this.options.discardLabel });
      discardBtn.addEventListener('click', () => { this.finish('discard'); });
    }

    const cancelBtn = btnRow.createEl('button', { text: this.options.cancelLabel });
    cancelBtn.addEventListener('click', () => { this.finish('cancel'); });

    const confirmBtn = btnRow.createEl('button', {
      text: this.options.confirmLabel,
      cls: this.options.destructive === true ? 'mod-warning' : 'mod-cta',
    });
    confirmBtn.addEventListener('click', () => { this.finish('confirm'); });

    // Enter key → confirm (Obsidian Modal.scope key binding)
    this.scope.register([], 'Enter', (evt) => {
      evt.preventDefault();
      this.finish('confirm');
      return false;
    });
  }

  onClose(): void {
    // Esc / overlay click — default to 'cancel' if not already resolved
    this.safeResolve('cancel');
    this.contentEl.empty();
  }

  private finish(value: ConfirmResult): void {
    this.safeResolve(value);
    this.close();
  }

  private safeResolve(value: ConfirmResult): void {
    if (!this.resolved) {
      this.resolved = true;
      this.resolve(value);
    }
  }
}
