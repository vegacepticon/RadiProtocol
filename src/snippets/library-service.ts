// snippets/library-service.ts
// Phase 86 (TEMPLATE-LIB-01): fetch library index, download snippets, track installs.
import { App, Notice, requestUrl } from 'obsidian';
import type { RadiProtocolSettings } from '../settings';
import { SnippetService } from './snippet-service';
import type { LibraryIndex, LibrarySnippetEntry, LibraryManifest } from './library-model';
import type { Translator } from '../i18n';
import { ensureFolderPath } from '../utils/vault-utils';
import { WriteMutex } from '../utils/write-mutex';

export class LibraryService {
  private readonly app: App;
  private readonly settings: RadiProtocolSettings;
  private readonly snippetService: SnippetService;
  private readonly t: Translator;
  private readonly mutex = new WriteMutex();

  constructor(
    app: App,
    settings: RadiProtocolSettings,
    snippetService: SnippetService,
    t: Translator,
  ) {
    this.app = app;
    this.settings = settings;
    this.snippetService = snippetService;
    this.t = t;
  }

  /** Fetch library index JSON from settings.libraryUrl via requestUrl().
   *  Returns null on network or parse failure. */
  async fetchIndex(): Promise<LibraryIndex | null> {
    const url = this.settings.libraryUrl.trim();
    if (url === '') {
      new Notice(this.t('library.noUrl'));
      return null;
    }
    try {
      const response = await requestUrl({ url, method: 'GET' });
      const parsed = JSON.parse(response.text) as LibraryIndex;
      if (!parsed.version || !Array.isArray(parsed.snippets)) {
        console.error('[RadiProtocol][Library] Index JSON missing version or snippets array');
        return null;
      }
      return parsed;
    } catch (err) {
      console.error('[RadiProtocol][Library] fetchIndex failed:', err);
      new Notice(this.t('library.networkError'));
      return null;
    }
  }

  /** Derive the base URL (directory of the index file) so snippet paths can be resolved. */
  private getBaseUrl(): string {
    const url = this.settings.libraryUrl.trim();
    const lastSlash = url.lastIndexOf('/');
    return lastSlash > 0 ? url.slice(0, lastSlash + 1) : url;
  }

  /** Install a single library snippet into the vault.
   *  Target path: snippetFolderPath/Library/<category>/<name>.json
   *  Overwrites silently if already present. */
  async installSnippet(entry: LibrarySnippetEntry): Promise<boolean> {
    const baseUrl = this.getBaseUrl();
    const rawUrl = baseUrl + entry.path;
    let content: string;
    try {
      const response = await requestUrl({ url: rawUrl, method: 'GET' });
      content = response.text;
    } catch (err) {
      console.error('[RadiProtocol][Library] installSnippet download failed:', err);
      new Notice(this.t('library.networkError'));
      return false;
    }

    const root = this.settings.snippetFolderPath;
    const targetPath = `${root}/Library/${entry.category}/${entry.name}.json`;

    try {
      await this.mutex.runExclusive(targetPath, async () => {
        await ensureFolderPath(this.app.vault, targetPath);
        await this.app.vault.adapter.write(targetPath, content);
      });
    } catch (err) {
      console.error('[RadiProtocol][Library] installSnippet write failed:', err);
      return false;
    }

    // Update manifest
    const manifest = (await this.readManifest()) ?? { installed: [] };
    const existing = manifest.installed.find((i) => i.id === entry.id);
    if (existing) {
      existing.version = 'unknown'; // MVP: no remote version tracking yet
    } else {
      manifest.installed.push({ id: entry.id, version: 'unknown' });
    }
    await this.writeManifest(manifest);
    return true;
  }

  /** Read local library-manifest.json or return null if absent. */
  async readManifest(): Promise<LibraryManifest | null> {
    const path = `${this.settings.snippetFolderPath}/Library/library-manifest.json`;
    try {
      const exists = await this.app.vault.adapter.exists(path);
      if (!exists) return null;
      const text = await this.app.vault.adapter.read(path);
      return JSON.parse(text) as LibraryManifest;
    } catch (err) {
      console.error('[RadiProtocol][Library] readManifest failed:', err);
      return null;
    }
  }

  /** Write library-manifest.json. */
  async writeManifest(manifest: LibraryManifest): Promise<void> {
    const path = `${this.settings.snippetFolderPath}/Library/library-manifest.json`;
    await ensureFolderPath(this.app.vault, path);
    await this.app.vault.adapter.write(path, JSON.stringify(manifest, null, 2));
  }
}
