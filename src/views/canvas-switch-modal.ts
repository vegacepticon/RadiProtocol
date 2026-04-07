// views/canvas-switch-modal.ts
// Confirmation dialog for mid-session canvas switch (SELECTOR-03, D-12)
import { App, Modal } from 'obsidian';

/**
 * CanvasSwitchModal presents a confirmation prompt when the user selects a
 * different canvas while a session is at-node or awaiting-snippet-fill.
 *
 * Usage:
 *   const modal = new CanvasSwitchModal(this.app);
 *   modal.open();
 *   const confirmed = await modal.result;  // true = continue, false = cancel
 */
export class CanvasSwitchModal extends Modal {
  /** Resolves with true (confirmed) or false (cancelled / Escape). */
  readonly result: Promise<boolean>;
  private resolve!: (value: boolean) => void;
  private resolved = false;

  constructor(app: App) {
    super(app);
    this.result = new Promise<boolean>(res => {
      this.resolve = res;
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Switch protocol canvas?' });
    contentEl.createEl('p', {
      text: 'The active session will be reset. Any unsaved progress will be lost.',
      cls: 'mod-warning',
    });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

    const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => {
      this.confirm(false);
    });

    const continueBtn = btnRow.createEl('button', {
      text: 'Continue',
      cls: 'mod-cta',
    });
    continueBtn.addEventListener('click', () => {
      this.confirm(true);
    });
  }

  onClose(): void {
    // Escape / overlay click — resolve with false (cancel) if not already resolved
    if (!this.resolved) {
      this.resolve(false);
      this.resolved = true;
    }
    this.contentEl.empty();
  }

  private confirm(value: boolean): void {
    if (!this.resolved) {
      this.resolve(value);
      this.resolved = true;
    }
    this.close();
  }
}
