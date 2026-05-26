import { AbstractInputSuggest, type App, type TFolder } from 'obsidian';

export function getFolderSuggestions(
  app: App,
  query: string,
  opts?: { rootPath?: string; relativeToRoot?: boolean; includeRoot?: boolean },
): string[] {
  const getAllFolders = app.vault?.getAllFolders;
  if (typeof getAllFolders !== 'function') {
    return [];
  }

  const queryLower = query.trim().toLowerCase();
  const root = opts?.rootPath;

  const folders = getAllFolders.call(app.vault, false)
    .map((folder: TFolder) => folder.path)
    .filter((folderPath: string) => folderPath.length > 0)
    .filter((folderPath: string) => {
      if (root !== undefined && !folderPath.startsWith(root === '' ? '/' : root + '/') && folderPath !== root) return false;
      return true;
    })
    .filter((folderPath: string) => queryLower.length === 0 || folderPath.toLowerCase().includes(queryLower))
    .sort((a: string, b: string) => a.localeCompare(b));

  if (opts?.relativeToRoot && root !== undefined) {
    const result = folders.map((fp) => (fp === root ? '' : fp.slice(root.length + 1)));
    if (opts.includeRoot && !result.includes('')) result.unshift('');
    return result.sort((a: string, b: string) => a.localeCompare(b));
  }

  if (opts?.includeRoot && root !== undefined) {
    if (!folders.includes(root)) folders.unshift(root);
  }

  return folders;
}

export class FolderSuggest extends AbstractInputSuggest<string> {
  private readonly appRef: App;
  private readonly inputEl: HTMLInputElement;
  private readonly opts?: { rootPath?: string; relativeToRoot?: boolean; includeRoot?: boolean };

  constructor(app: App, inputEl: HTMLInputElement, opts?: { rootPath?: string; relativeToRoot?: boolean; includeRoot?: boolean }) {
    super(app, inputEl);
    this.appRef = app;
    this.inputEl = inputEl;
    this.opts = opts;
  }

  protected getSuggestions(query: string): string[] {
    return getFolderSuggestions(this.appRef, query, this.opts);
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
