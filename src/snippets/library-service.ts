// snippets/library-service.ts
// Phase 86/93: fetch library indexes, download snippets, track installs.
import { App, Notice, requestUrl } from 'obsidian';
import { DEFAULT_LIBRARY_URL, type RadiProtocolSettings } from '../settings';
import { SnippetService } from './snippet-service';
import type { JsonSnippet, MdTemplateSnippet } from './snippet-model';
import { validatePlaceholders } from './snippet-model';
import { parseMarkdownTemplate } from './md-template';
import type { LibraryIndex, LibraryLanguage, LibraryLanguageFilter, LibraryManifest, LibrarySnippetEntry } from './library-model';
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

  /** Fetch one or both generated language indexes. Legacy index.json still works. */
  async fetchIndex(language: LibraryLanguageFilter = this.settings.locale ?? 'ru'): Promise<LibraryIndex | null> {
    if (language === 'all') {
      const [ru, en] = await Promise.all([this.fetchSingleIndex('ru'), this.fetchSingleIndex('en')]);
      const available = [ru, en].filter((index): index is LibraryIndex => index !== null);
      if (available.length === 0) return null;
      return {
        version: available.map((index) => index.version).join('+'),
        snippets: available.flatMap((index) => index.snippets),
      };
    }
    return this.fetchSingleIndex(language);
  }

  private async fetchSingleIndex(language: LibraryLanguage): Promise<LibraryIndex | null> {
    const url = this.getLibraryIndexUrl(language);
    try {
      const response = await requestUrl({ url, method: 'GET' });
      const parsed = JSON.parse(response.text) as LibraryIndex;
      if (!parsed.version || !Array.isArray(parsed.snippets)) {
        console.error('[RadiProtocol][Library] Index JSON missing version or snippets array');
        return null;
      }
      return {
        ...parsed,
        language: parsed.language ?? language,
        snippets: parsed.snippets.map((entry) => ({
          ...entry,
          lang: entry.lang ?? parsed.language ?? language,
          format: entry.format ?? inferFormat(entry.path),
        })),
      };
    } catch (err) {
      // EN can legitimately be empty/missing during phased rollout; keep RU usable.
      console.error('[RadiProtocol][Library] fetchIndex failed:', err);
      if (language === this.settings.locale) new Notice(this.t('library.networkError'));
      return null;
    }
  }

  private getLibraryUrl(): string {
    return this.settings.libraryUrl.trim() || DEFAULT_LIBRARY_URL;
  }

  private getLibraryIndexUrl(language: LibraryLanguage): string {
    const configured = this.getLibraryUrl();
    if (configured.includes('/generated/index.') || configured.endsWith('/index.json')) {
      return configured.replace(/(?:generated\/)?index(?:\.[a-z]{2})?\.json$/, `generated/index.${language}.json`);
    }
    return configured;
  }

  /** Repository root URL for resolving generated snippet paths. */
  private getRepoBaseUrl(): string {
    const url = this.getLibraryUrl();
    const generatedPos = url.lastIndexOf('/generated/');
    if (generatedPos > 0) return url.slice(0, generatedPos + 1);
    const lastSlash = url.lastIndexOf('/');
    return lastSlash > 0 ? url.slice(0, lastSlash + 1) : url;
  }

  async fetchSnippetPreview(entry: LibrarySnippetEntry): Promise<JsonSnippet | MdTemplateSnippet | null> {
    const raw = await this.fetchSnippetText(entry);
    if (raw === null) return null;
    if (entry.path.endsWith('.md')) {
      return parseMarkdownTemplate(entry.path, raw, entry.name, this.t);
    }
    try {
      const parsed = JSON.parse(raw) as Partial<JsonSnippet>;
      if (typeof parsed.template !== 'string' || !Array.isArray(parsed.placeholders)) {
        console.error('[RadiProtocol][Library] preview snippet missing template or placeholders');
        return null;
      }
      return {
        kind: 'json',
        path: entry.path,
        name: typeof parsed.name === 'string' && parsed.name.trim() !== '' ? parsed.name : entry.name,
        template: parsed.template,
        placeholders: parsed.placeholders,
        validationError: validatePlaceholders(parsed.placeholders, this.t),
      };
    } catch (err) {
      console.error('[RadiProtocol][Library] fetchSnippetPreview parse failed:', err);
      return null;
    }
  }

  /** Install a single library snippet into the vault.
   *  New target path: snippetFolderPath/Library/<lang>/<category>/<source basename>.md
   *  Legacy JSON entries still install as .json under Library/<category>/.
   */
  async installSnippet(entry: LibrarySnippetEntry): Promise<boolean> {
    const content = await this.fetchSnippetText(entry);
    if (content === null) return false;

    const targetPath = this.targetPathForEntry(entry);

    try {
      await this.mutex.runExclusive(targetPath, async () => {
        const lastSlash = targetPath.lastIndexOf('/');
        if (lastSlash > 0) {
          await ensureFolderPath(this.app.vault, targetPath.slice(0, lastSlash));
        }
        await this.app.vault.adapter.write(targetPath, content);
      });
    } catch (err) {
      console.error('[RadiProtocol][Library] installSnippet write failed:', err);
      return false;
    }

    const manifest = (await this.readManifest()) ?? { installed: [] };
    const existing = manifest.installed.find((i) => i.id === entry.id && i.lang === entry.lang);
    const version = String(entry.version ?? 'unknown');
    if (existing) {
      existing.version = version;
      existing.path = targetPath;
    } else {
      manifest.installed.push({ id: entry.id, version, lang: entry.lang, path: targetPath });
    }
    await this.writeManifest(manifest);
    return true;
  }

  async installSnippets(entries: LibrarySnippetEntry[]): Promise<{ installed: number; failed: number }> {
    let installed = 0;
    let failed = 0;
    for (const entry of entries) {
      if (entry.path.endsWith('library-manifest.json')) continue;
      const ok = await this.installSnippet(entry);
      if (ok) installed += 1;
      else failed += 1;
    }
    return { installed, failed };
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
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash > 0) {
      await ensureFolderPath(this.app.vault, path.slice(0, lastSlash));
    }
    await this.app.vault.adapter.write(path, JSON.stringify(manifest, null, 2));
  }

  private async fetchSnippetText(entry: LibrarySnippetEntry): Promise<string | null> {
    // URL-encode each path segment: raw.githubusercontent.com requires
    // Cyrillic characters to be percent-encoded or it returns 404.
    const encodedPath = entry.path.split('/').map(encodeURIComponent).join('/');
    const rawUrl = this.getRepoBaseUrl() + encodedPath;
    try {
      const response = await requestUrl({ url: rawUrl, method: 'GET' });
      return response.text;
    } catch (err) {
      console.error('[RadiProtocol][Library] snippet download failed:', err);
      new Notice(this.t('library.networkError'));
      return null;
    }
  }

  private targetPathForEntry(entry: LibrarySnippetEntry): string {
    const root = this.settings.snippetFolderPath;
    const lang = entry.lang ?? this.settings.locale;
    const ext = entry.path.endsWith('.md') ? 'md' : 'json';
    const basename = safeSegment(stripExtension(entry.path.split('/').pop() || entry.id || entry.name));
    if (ext === 'md') {
      return `${root}/Library/${lang}/${safeCategoryPath(entry.category)}/${basename}.md`;
    }
    return `${root}/Library/${safeCategoryPath(entry.category)}/${basename}.json`;
  }
}

function inferFormat(path: string): 'json' | 'md-template' | 'md' {
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md')) return 'md-template';
  return 'md';
}

function stripExtension(name: string): string {
  return name.replace(/\.(json|md)$/i, '');
}

function safeCategoryPath(category: string): string {
  return category
    .split('/')
    .map(safeSegment)
    .filter((segment) => segment !== '')
    .join('/') || 'Uncategorized';
}

function safeSegment(value: string): string {
  return value
    .trim()
    .replace(/[\\/#?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^-+|-+$/g, '') || 'untitled';
}
