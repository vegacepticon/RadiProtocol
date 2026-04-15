// views/folder-picker-modal.ts
// Phase 34 Plan 01 — SuggestModal<string> listing snippet folders for the
// «Переместить в…» context-menu flow. Mirrors the structure of
// `src/views/node-picker-modal.ts`. This modal is a dumb picker: filtering
// of invalid targets (source folder + descendants on folder moves) happens
// in the caller before the `folders` array is passed in.
import { App, SuggestModal } from 'obsidian';

export class FolderPickerModal extends SuggestModal<string> {
  private readonly folders: string[];
  private readonly onChooseCb: (folder: string) => void;

  constructor(app: App, folders: string[], onChoose: (folder: string) => void) {
    super(app);
    this.folders = folders;
    this.onChooseCb = onChoose;
    this.setPlaceholder('Выберите папку…');
  }

  getSuggestions(query: string): string[] {
    if (query.trim() === '') return this.folders;
    const q = query.toLowerCase();
    return this.folders.filter((f) => f.toLowerCase().includes(q));
  }

  renderSuggestion(folder: string, el: HTMLElement): void {
    el.createEl('div', { text: folder });
  }

  onChooseSuggestion(folder: string, _evt: MouseEvent | KeyboardEvent): void {
    this.onChooseCb(folder);
  }
}
