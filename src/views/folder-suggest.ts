import { AbstractInputSuggest, type App, type TFolder } from 'obsidian';

export function getFolderSuggestions(app: App, query: string): string[] {
  const getAllFolders = app.vault?.getAllFolders;
  if (typeof getAllFolders !== 'function') {
    return [];
  }

  const queryLower = query.trim().toLowerCase();

  return getAllFolders.call(app.vault, false)
    .map((folder: TFolder) => folder.path)
    .filter((folderPath: string) => folderPath.length > 0)
    .filter((folderPath: string) => queryLower.length === 0 || folderPath.toLowerCase().includes(queryLower))
    .sort((a: string, b: string) => a.localeCompare(b));
}

export class FolderSuggest extends AbstractInputSuggest<string> {
  private readonly appRef: App;
  private readonly inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.appRef = app;
    this.inputEl = inputEl;
  }

  protected getSuggestions(query: string): string[] {
    return getFolderSuggestions(this.appRef, query);
  }

  renderSuggestion(folderPath: string, el: HTMLElement): void {
    el.createEl('div', { text: folderPath });
  }

  selectSuggestion(folderPath: string, evt: MouseEvent | KeyboardEvent): void {
    this.setValue(folderPath);
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    super.selectSuggestion(folderPath, evt);
  }
}
