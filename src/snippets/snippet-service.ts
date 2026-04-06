// snippets/snippet-service.ts
// Receives App and settings as constructor parameters — no direct Obsidian imports (NFR-01)
import type { App, TFile } from 'obsidian';
import type { RadiProtocolSettings } from '../settings';
import type { SnippetFile } from './snippet-model';
import { WriteMutex } from '../utils/write-mutex';
import { ensureFolderPath } from '../utils/vault-utils';

/**
 * Full CRUD for snippet JSON files stored in {snippetFolderPath}/{id}.json (SNIP-01, D-14, D-15).
 * Every vault.modify() / vault.adapter.write() is wrapped in WriteMutex.runExclusive().
 * Folder existence is guaranteed via ensureFolderPath() before every write.
 */
export class SnippetService {
  private readonly app: App;
  private readonly settings: RadiProtocolSettings;
  private readonly mutex = new WriteMutex();

  constructor(app: App, settings: RadiProtocolSettings) {
    this.app = app;
    this.settings = settings;
  }

  private filePath(id: string): string {
    return `${this.settings.snippetFolderPath}/${id}.json`;
  }

  /** List all snippet files in the configured folder. Returns [] if folder is missing or empty. */
  async list(): Promise<SnippetFile[]> {
    const folderPath = this.settings.snippetFolderPath;
    const folderExists = await this.app.vault.adapter.exists(folderPath);
    if (!folderExists) return [];

    // vault.adapter.list() returns { files, folders }
    const listing = await this.app.vault.adapter.list(folderPath);
    const snippets: SnippetFile[] = [];

    for (const filePath of listing.files) {
      if (!filePath.endsWith('.json')) continue;
      try {
        const raw = await this.app.vault.adapter.read(filePath);
        const parsed = JSON.parse(raw) as SnippetFile;
        snippets.push(parsed);
      } catch {
        // Corrupt file — skip silently; callers show Notice if needed
      }
    }

    return snippets;
  }

  /** Load a single snippet by id. Returns null if file does not exist or JSON is corrupt. */
  async load(id: string): Promise<SnippetFile | null> {
    const path = this.filePath(id);
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) return null;
    try {
      const raw = await this.app.vault.adapter.read(path);
      return JSON.parse(raw) as SnippetFile;
    } catch {
      return null;
    }
  }

  /**
   * Save (create or update) a snippet file.
   * Sanitizes snippet content before JSON serialization (V5 Input Validation — T-5-01).
   * Ensures folder exists; wraps write in WriteMutex (SNIP-07, SNIP-08).
   */
  async save(snippet: SnippetFile): Promise<void> {
    // Sanitize: strip control characters from all string fields to prevent JSON injection (T-5-01)
    const clean = this.sanitize(snippet);
    const path = this.filePath(clean.id);
    const payload = JSON.stringify(clean, null, 2);

    await this.mutex.runExclusive(path, async () => {
      await ensureFolderPath(this.app.vault, this.settings.snippetFolderPath);
      const exists = await this.app.vault.adapter.exists(path);
      if (exists) {
        await this.app.vault.adapter.write(path, payload);
      } else {
        await this.app.vault.create(path, payload);
      }
    });
  }

  /** Delete a snippet file by id. No-op if file does not exist. */
  async delete(id: string): Promise<void> {
    const path = this.filePath(id);
    const file = this.app.vault.getAbstractFileByPath(path) as TFile | null;
    if (file !== null && file instanceof Object && 'stat' in file) {
      await this.app.vault.delete(file as TFile);
    }
  }

  /** Check if a snippet with the given id exists on disk. */
  async exists(id: string): Promise<boolean> {
    return this.app.vault.adapter.exists(this.filePath(id));
  }

  /**
   * Strip control characters (U+0000–U+001F, U+007F) from all string values
   * in a SnippetFile before JSON serialization (ASVS V5 input sanitization — T-5-01).
   */
  private sanitize(snippet: SnippetFile): SnippetFile {
    const clean = (s: string): string => s.replace(/[\u0000-\u001F\u007F]/g, '');
    return {
      ...snippet,
      name: clean(snippet.name),
      template: clean(snippet.template),
      placeholders: snippet.placeholders.map(p => ({
        ...p,
        label: clean(p.label),
        options: p.options?.map(clean),
        unit: p.unit !== undefined ? clean(p.unit) : undefined,
        joinSeparator: p.joinSeparator !== undefined ? clean(p.joinSeparator) : undefined,
      })),
    };
  }
}
