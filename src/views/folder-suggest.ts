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

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.appRef = app;
  }

  protected getSuggestions(query: string): string[] {
    return getFolderSuggestions(this.appRef, query);
  }

  renderSuggestion(_folderPath: string, _el: HTMLElement): void {
    // Implemented in Task 2.
  }

  selectSuggestion(_folderPath: string, _evt: MouseEvent | KeyboardEvent): void {
    // Implemented in Task 2.
  }
}
