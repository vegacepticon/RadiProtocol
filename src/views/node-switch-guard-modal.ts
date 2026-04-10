// views/node-switch-guard-modal.ts
// Confirmation dialog shown when user clicks a canvas node while EditorPanel has unsaved edits.
// Pattern: direct copy of CanvasSwitchModal (Promise<boolean> result, two-button layout).
import { App, Modal } from 'obsidian';

/**
 * NodeSwitchGuardModal presents a confirmation prompt before discarding unsaved
 * node edits when the user clicks a different canvas node (EDITOR-02).
 *
 * Usage:
 *   const modal = new NodeSwitchGuardModal(this.plugin.app);
 *   modal.open();
 *   const confirmed = await modal.result;  // true = discard and switch, false = stay
 */
export class NodeSwitchGuardModal extends Modal {
  /** Resolves with true (discard and switch) or false (stay / Escape). */
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

    contentEl.createEl('h2', { text: 'Unsaved changes' });
    contentEl.createEl('p', {
      text: 'You have unsaved changes. They will be lost.',
      cls: 'mod-warning',
    });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

    const stayBtn = btnRow.createEl('button', { text: 'Stay' });
    stayBtn.addEventListener('click', () => {
      this.confirm(false);
    });

    const discardBtn = btnRow.createEl('button', {
      text: 'Discard and switch',
      cls: 'mod-cta',
    });
    discardBtn.addEventListener('click', () => {
      this.confirm(true);
    });
  }

  onClose(): void {
    // Escape / overlay click — resolve with false (stay) if not already resolved
    if (!this.resolved) {
      this.resolve(false);
      this.resolved = true;
    }
    this.contentEl?.empty();
  }

  private confirm(value: boolean): void {
    if (!this.resolved) {
      this.resolve(value);
      this.resolved = true;
    }
    this.close();
  }
}
