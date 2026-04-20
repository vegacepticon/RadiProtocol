// views/folder-picker-modal.ts
// Phase 34 Plan 01 — SuggestModal<string> listing snippet folders for the
// «Переместить в…» context-menu flow. Mirrors the structure of
// `src/views/node-picker-modal.ts`. This modal is a dumb picker: filtering
// of invalid targets (source folder + descendants on folder moves) happens
// in the caller before the `folders` array is passed in.
import { App, SuggestModal } from 'obsidian';

/**
 * @deprecated Phase 51 D-07 (PICKER-02) — superseded by an inline SnippetTreePicker-hosting
 *   Modal in `src/views/snippet-manager-view.ts` (openMovePicker). This file is retained per
 *   CLAUDE.md Shared Pattern G ("never remove existing code you didn't add") and may be
 *   safely deleted in a future cleanup phase if `git grep FolderPickerModal` returns zero
 *   imports outside this file.
 */
export class FolderPickerModal extends SuggestModal<string> {
  private readonly folders: string[];
  private readonly onChooseCb: (folder: string) => void | Promise<void>;

  constructor(app: App, folders: string[], onChoose: (folder: string) => void | Promise<void>) {
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
