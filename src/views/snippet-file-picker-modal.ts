// views/snippet-file-picker-modal.ts
// FuzzySuggestModal for selecting a snippet file from a scoped folder (SNIPPET-03, D-01, D-02)
import { App, FuzzySuggestModal, TFile } from 'obsidian';

/**
 * File picker modal for snippet nodes in the Protocol Runner.
 *
 * Accepts a pre-filtered list of TFile objects (scoped to the configured folder).
 * Displays only filename (D-01 — no path prefix).
 * Calls onChoose callback when a file is selected.
 * On cancel (Esc), closes without calling the callback (D-03 — runner stays on node).
 */
export class SnippetFilePickerModal extends FuzzySuggestModal<TFile> {
  private readonly files: TFile[];
  private readonly onChooseCb: (file: TFile) => void;

  constructor(app: App, files: TFile[], onChoose: (file: TFile) => void) {
    super(app);
    this.files = files;
    this.onChooseCb = onChoose;
    this.setPlaceholder('Search snippet files\u2026');
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(file: TFile): string {
    return file.name;  // D-01: filename only, no path prefix
  }

  onChooseItem(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
    this.onChooseCb(file);
  }
}
