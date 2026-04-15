// snippets/snippet-service.ts
// Receives App and settings as constructor parameters — no direct Obsidian imports (NFR-01)
import type { App } from 'obsidian';
import type { RadiProtocolSettings } from '../settings';
import type { Snippet, JsonSnippet } from './snippet-model';
import { WriteMutex } from '../utils/write-mutex';
import { ensureFolderPath } from '../utils/vault-utils';

/**
 * Phase 34 (D-03): Build a canvas-ref mapping key from a vault-relative path.
 * - Strips `snippetRoot + '/'` prefix if present
 * - Strips trailing `.json` / `.md` (case-insensitive), once
 * - Returns '' when vaultPath === snippetRoot
 *
 * This is the single source of truth for converting between vault-relative
 * paths (what SnippetService deals in) and the snippet-root-relative,
 * extension-less format that `rewriteCanvasRefs` expects.
 */
export function toCanvasKey(vaultPath: string, snippetRoot: string): string {
  if (vaultPath === snippetRoot) return '';
  const prefix = snippetRoot + '/';
  let rel = vaultPath.startsWith(prefix) ? vaultPath.slice(prefix.length) : vaultPath;
  rel = rel.replace(/\.(json|md)$/i, '');
  return rel;
}

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

  /**
   * Phase 32 (D-10): Pre-I/O path-safety gate. Normalises and validates that
   * `path` is inside `this.settings.snippetFolderPath`. Returns the normalised
   * path on success, or null on rejection. Callers MUST return a safe
   * empty/null result when this returns null.
   */
  private assertInsideRoot(path: string): string | null {
    const root = this.settings.snippetFolderPath;
    const stripped = path.replace(/^\/+/, '');
    const rawSegments = stripped.split('/');
    const hasTraversal = rawSegments.some((s) => s === '..' || s === '.');
    const isAbsolute = path.startsWith('/');
    const normalized = rawSegments.filter((s) => s !== '').join('/');
    const insideRoot =
      !hasTraversal &&
      !isAbsolute &&
      (normalized === root || normalized.startsWith(root + '/'));
    if (!insideRoot) {
      console.error('[RadiProtocol] snippet-service rejected unsafe path:', path);
      return null;
    }
    return normalized;
  }

  /**
   * Phase 32: basename of a vault-relative path with its extension stripped.
   * Used to derive snippet `name` when loading/listing.
   */
  private basenameNoExt(path: string): string {
    const base = path.slice(path.lastIndexOf('/') + 1);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
  }

  /**
   * List direct children of a folder within the snippet root.
   * Phase 30 D-18..D-21. Used by the runner picker.
   *
   * @param folderPath Full vault-relative path (D-19). Caller composes
   *   `${settings.snippetFolderPath}/${node.subfolderPath}` when subfolderPath is set.
   * @returns Direct-children folders (basenames, sorted) and parsed SnippetFile objects (sorted by name).
   *   Missing folder → empty. Corrupt JSON → skipped silently.
   *   Path outside snippet root → silently rejected (T-30-01).
   */
  async listFolder(
    folderPath: string,
  ): Promise<{ folders: string[]; snippets: Snippet[] }> {
    // Phase 32 (D-10): path-safety gate via assertInsideRoot helper.
    const normalized = this.assertInsideRoot(folderPath);
    if (normalized === null) return { folders: [], snippets: [] };

    const exists = await this.app.vault.adapter.exists(normalized);
    if (!exists) return { folders: [], snippets: [] };

    let listing: { files: string[]; folders: string[] };
    try {
      listing = await this.app.vault.adapter.list(normalized);
    } catch {
      return { folders: [], snippets: [] };
    }

    // Folder basenames (strip `${normalized}/` prefix). Only direct children.
    const folders: string[] = [];
    for (const f of listing.folders) {
      const rel = f.slice(normalized.length + 1);
      if (rel !== '' && !rel.includes('/')) folders.push(rel);
    }
    folders.sort((a, b) => a.localeCompare(b));

    // Phase 32 (D-01, D-02): parse .json as JsonSnippet, read .md as MdSnippet.
    // basename is authoritative for `name` (D-02); corrupt files skipped silently.
    const snippets: Snippet[] = [];
    for (const filePath of listing.files) {
      const basename = this.basenameNoExt(filePath);
      if (filePath.endsWith('.json')) {
        try {
          const raw = await this.app.vault.adapter.read(filePath);
          const parsed = JSON.parse(raw) as Partial<JsonSnippet>;
          snippets.push({
            kind: 'json',
            path: filePath,
            name: basename,
            template: parsed.template ?? '',
            placeholders: parsed.placeholders ?? [],
          });
        } catch {
          // Corrupt file — skip silently.
        }
      } else if (filePath.endsWith('.md')) {
        try {
          const raw = await this.app.vault.adapter.read(filePath);
          snippets.push({
            kind: 'md',
            path: filePath,
            name: basename,
            content: raw,
          });
        } catch {
          // Unreadable — skip silently.
        }
      }
      // Other extensions: skip.
    }
    snippets.sort((a, b) => a.name.localeCompare(b.name));

    return { folders, snippets };
  }

  /**
   * Phase 32 (D-03): Load a snippet by full vault-relative path.
   * Routes by extension: `.json` → JsonSnippet, `.md` → MdSnippet.
   * Returns null if path is unsafe, file missing, or JSON corrupt.
   */
  async load(path: string): Promise<Snippet | null> {
    const normalized = this.assertInsideRoot(path);
    if (normalized === null) return null;
    const exists = await this.app.vault.adapter.exists(normalized);
    if (!exists) return null;
    try {
      const raw = await this.app.vault.adapter.read(normalized);
      const basename = this.basenameNoExt(normalized);
      if (normalized.endsWith('.json')) {
        const parsed = JSON.parse(raw) as Partial<JsonSnippet>;
        return {
          kind: 'json',
          path: normalized,
          name: basename,
          template: parsed.template ?? '',
          placeholders: parsed.placeholders ?? [],
        };
      }
      if (normalized.endsWith('.md')) {
        return { kind: 'md', path: normalized, name: basename, content: raw };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Phase 32 (D-03): Save a snippet. Branches on `kind`:
   *   - `json` → sanitize + JSON.stringify
   *   - `md`   → write raw content (free-text, no sanitisation)
   * Wraps write in WriteMutex per-path (D-11). Ensures parent folder exists.
   * Throws on unsafe path (D-10).
   */
  async save(snippet: Snippet): Promise<void> {
    const normalized = this.assertInsideRoot(snippet.path);
    if (normalized === null) {
      throw new Error(`[RadiProtocol] save rejected unsafe path: ${snippet.path}`);
    }
    await this.mutex.runExclusive(normalized, async () => {
      await ensureFolderPath(this.app.vault, this.settings.snippetFolderPath);
      const lastSlash = normalized.lastIndexOf('/');
      const parent = lastSlash > 0 ? normalized.slice(0, lastSlash) : '';
      if (parent !== '' && parent !== this.settings.snippetFolderPath) {
        await ensureFolderPath(this.app.vault, parent);
      }
      let payload: string;
      if (snippet.kind === 'json') {
        const clean = this.sanitizeJson(snippet);
        payload = JSON.stringify(clean, null, 2);
      } else {
        // md: raw free-text content, no sanitisation (D-01)
        payload = snippet.content;
      }
      const exists = await this.app.vault.adapter.exists(normalized);
      if (exists) {
        await this.app.vault.adapter.write(normalized, payload);
      } else {
        await this.app.vault.create(normalized, payload);
      }
    });
  }

  /**
   * Phase 32 (D-03, D-08, D-11): Delete a snippet file by path.
   * Uses `vault.trash(file, false)` — file goes to Obsidian's `.trash/`,
   * never permanent-destroy. No-op on unsafe path or missing file.
   * Wrapped in WriteMutex per-path.
   */
  async delete(path: string): Promise<void> {
    const normalized = this.assertInsideRoot(path);
    if (normalized === null) return;
    await this.mutex.runExclusive(normalized, async () => {
      const file = this.app.vault.getAbstractFileByPath(normalized);
      if (file === null) return;
      // D-08: Obsidian trash (.trash/), not system trash.
      await this.app.vault.trash(file, false);
    });
  }

  /**
   * Phase 32 (D-03): Check if a snippet file exists at the given path.
   * Returns false on unsafe path.
   */
  async exists(path: string): Promise<boolean> {
    const normalized = this.assertInsideRoot(path);
    if (normalized === null) return false;
    return this.app.vault.adapter.exists(normalized);
  }

  /**
   * Phase 33 (D-17): Create an empty folder inside the snippet root.
   * Path-safety gated via assertInsideRoot; rejects unsafe path by throwing.
   * Idempotent — ensureFolderPath is a no-op when the folder already exists.
   * Wrapped in WriteMutex per normalized path.
   */
  async createFolder(path: string): Promise<void> {
    const normalized = this.assertInsideRoot(path);
    if (normalized === null) {
      throw new Error(`[RadiProtocol] createFolder rejected unsafe path: ${path}`);
    }
    await this.mutex.runExclusive(normalized, async () => {
      await ensureFolderPath(this.app.vault, normalized);
    });
  }

  /**
   * Phase 33 (D-16, D-17): Trash a folder (recursive) via a single vault.trash call.
   * Path-safety gated; unsafe path or missing folder → silent no-op (no throw).
   * Per D-17 refined: does NOT call rewriteCanvasRefs — deletes leave canvas refs broken.
   * Wrapped in WriteMutex per normalized path.
   */
  async deleteFolder(path: string): Promise<void> {
    const normalized = this.assertInsideRoot(path);
    if (normalized === null) return;
    await this.mutex.runExclusive(normalized, async () => {
      const folder = this.app.vault.getAbstractFileByPath(normalized);
      if (folder === null) return;
      // D-08: Obsidian trash (.trash/), not system trash. Recursive = single call.
      await this.app.vault.trash(folder, false);
    });
  }

  /**
   * Phase 33 (D-15): Recursively walk a folder and return every descendant
   * file + subfolder (vault-relative paths as adapter.list returns them).
   * Used by the folder-delete confirm dialog to display the exact count of
   * items that will be trashed.
   * Unsafe path → { files: [], folders: [], total: 0 }.
   */
  async listFolderDescendants(
    path: string,
  ): Promise<{ files: string[]; folders: string[]; total: number }> {
    const normalized = this.assertInsideRoot(path);
    if (normalized === null) return { files: [], folders: [], total: 0 };
    const files: string[] = [];
    const folders: string[] = [];
    const queue: string[] = [normalized];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      let listing: { files: string[]; folders: string[] };
      try {
        listing = await this.app.vault.adapter.list(current);
      } catch {
        continue;
      }
      for (const f of listing.files) files.push(f);
      for (const sub of listing.folders) {
        folders.push(sub);
        queue.push(sub);
      }
    }
    return { files, folders, total: files.length + folders.length };
  }

  /**
   * Phase 34 (MOVE-01, RENAME-03): Rename a snippet file in place (same folder).
   * Preserves the original extension (.json or .md). Rejects basenames that
   * contain slashes or are empty/whitespace-only. Collision-checks destination
   * before touching the source. Wrapped in WriteMutex per normalized source.
   * Returns the new normalized path. No-op (returns unchanged path) when the
   * normalized old and new paths are identical.
   */
  async renameSnippet(oldPath: string, newBasename: string): Promise<string> {
    const normalizedOld = this.assertInsideRoot(oldPath);
    if (normalizedOld === null) {
      throw new Error(`[RadiProtocol] renameSnippet rejected unsafe path: ${oldPath}`);
    }
    if (/[\\/]/.test(newBasename) || newBasename.trim() === '') {
      throw new Error('Имя не может быть пустым и не должно содержать «/» или «\\».');
    }
    const lastSlash = normalizedOld.lastIndexOf('/');
    const parent = lastSlash > 0 ? normalizedOld.slice(0, lastSlash) : '';
    const lower = normalizedOld.toLowerCase();
    const ext = lower.endsWith('.md') ? '.md' : '.json';
    const newPath = parent === '' ? `${newBasename}${ext}` : `${parent}/${newBasename}${ext}`;
    const normalizedNew = this.assertInsideRoot(newPath);
    if (normalizedNew === null) {
      throw new Error(`[RadiProtocol] renameSnippet rejected unsafe new path: ${newPath}`);
    }
    if (normalizedOld === normalizedNew) return normalizedNew;
    if (await this.app.vault.adapter.exists(normalizedNew)) {
      throw new Error(`Путь уже существует: ${normalizedNew}`);
    }
    await this.mutex.runExclusive(normalizedOld, async () => {
      const file = this.app.vault.getAbstractFileByPath(normalizedOld);
      if (file === null) throw new Error(`Файл не найден: ${normalizedOld}`);
      await this.app.vault.rename(file, normalizedNew);
    });
    return normalizedNew;
  }

  /**
   * Phase 34 (MOVE-01): Move a snippet file into another folder under the
   * snippet root, preserving its basename + extension. Ensures the destination
   * folder exists before the rename. Collision-checks destination.
   */
  async moveSnippet(oldPath: string, newFolder: string): Promise<string> {
    const normalizedOld = this.assertInsideRoot(oldPath);
    if (normalizedOld === null) {
      throw new Error(`[RadiProtocol] moveSnippet rejected unsafe path: ${oldPath}`);
    }
    const normalizedFolder = this.assertInsideRoot(newFolder);
    if (normalizedFolder === null) {
      throw new Error(`[RadiProtocol] moveSnippet rejected unsafe destination: ${newFolder}`);
    }
    const basename = normalizedOld.slice(normalizedOld.lastIndexOf('/') + 1);
    const normalizedNew =
      normalizedFolder === '' ? basename : `${normalizedFolder}/${basename}`;
    if (normalizedOld === normalizedNew) return normalizedNew;
    if (await this.app.vault.adapter.exists(normalizedNew)) {
      throw new Error(`Путь уже существует: ${normalizedNew}`);
    }
    await this.mutex.runExclusive(normalizedOld, async () => {
      await ensureFolderPath(this.app.vault, normalizedFolder);
      const file = this.app.vault.getAbstractFileByPath(normalizedOld);
      if (file === null) throw new Error(`Файл не найден: ${normalizedOld}`);
      await this.app.vault.rename(file, normalizedNew);
    });
    return normalizedNew;
  }

  /**
   * Phase 34 (RENAME-03): Rename a folder in place (within the same parent).
   * Rejects basenames with slashes. Collision-checks destination.
   */
  async renameFolder(oldPath: string, newBasename: string): Promise<string> {
    const normalizedOld = this.assertInsideRoot(oldPath);
    if (normalizedOld === null) {
      throw new Error(`[RadiProtocol] renameFolder rejected unsafe path: ${oldPath}`);
    }
    if (/[\\/]/.test(newBasename) || newBasename.trim() === '') {
      throw new Error('Имя не может быть пустым и не должно содержать «/» или «\\».');
    }
    const lastSlash = normalizedOld.lastIndexOf('/');
    const parent = lastSlash > 0 ? normalizedOld.slice(0, lastSlash) : '';
    const newPath = parent === '' ? newBasename : `${parent}/${newBasename}`;
    const normalizedNew = this.assertInsideRoot(newPath);
    if (normalizedNew === null) {
      throw new Error(`[RadiProtocol] renameFolder rejected unsafe new path: ${newPath}`);
    }
    if (normalizedOld === normalizedNew) return normalizedNew;
    // Self-descendant guard: renaming into own subtree is nonsensical but
    // guard defensively (e.g. parent == '' edge cases).
    if (
      normalizedNew === normalizedOld ||
      normalizedNew.startsWith(normalizedOld + '/')
    ) {
      throw new Error('Нельзя переместить папку внутрь самой себя.');
    }
    if (await this.app.vault.adapter.exists(normalizedNew)) {
      throw new Error(`Путь уже существует: ${normalizedNew}`);
    }
    await this.mutex.runExclusive(normalizedOld, async () => {
      const folder = this.app.vault.getAbstractFileByPath(normalizedOld);
      if (folder === null) throw new Error(`Папка не найдена: ${normalizedOld}`);
      await this.app.vault.rename(folder, normalizedNew);
    });
    return normalizedNew;
  }

  /**
   * Phase 34 (MOVE-02): Move a folder into another parent folder under the
   * snippet root. Guards against moving a folder into itself or into any of
   * its descendants. Ensures the new parent exists. Collision-checks destination.
   */
  async moveFolder(oldPath: string, newParent: string): Promise<string> {
    const normalizedOld = this.assertInsideRoot(oldPath);
    if (normalizedOld === null) {
      throw new Error(`[RadiProtocol] moveFolder rejected unsafe path: ${oldPath}`);
    }
    const normalizedParent = this.assertInsideRoot(newParent);
    if (normalizedParent === null) {
      throw new Error(`[RadiProtocol] moveFolder rejected unsafe destination: ${newParent}`);
    }
    const basename = normalizedOld.slice(normalizedOld.lastIndexOf('/') + 1);
    const normalizedNew =
      normalizedParent === '' ? basename : `${normalizedParent}/${basename}`;
    // Self-descendant guard: reject move onto self OR into any descendant.
    // Also reject when the target parent IS the source or inside the source
    // subtree, since the resulting path would be nested under itself.
    if (
      normalizedParent === normalizedOld ||
      normalizedParent.startsWith(normalizedOld + '/') ||
      normalizedNew === normalizedOld ||
      normalizedNew.startsWith(normalizedOld + '/')
    ) {
      throw new Error('Нельзя переместить папку внутрь самой себя.');
    }
    if (await this.app.vault.adapter.exists(normalizedNew)) {
      throw new Error(`Путь уже существует: ${normalizedNew}`);
    }
    await this.mutex.runExclusive(normalizedOld, async () => {
      await ensureFolderPath(this.app.vault, normalizedParent);
      const folder = this.app.vault.getAbstractFileByPath(normalizedOld);
      if (folder === null) throw new Error(`Папка не найдена: ${normalizedOld}`);
      await this.app.vault.rename(folder, normalizedNew);
    });
    return normalizedNew;
  }

  /**
   * Phase 34 (D-06): Return the sorted list of every folder under the snippet
   * root, including the root itself. Used by FolderPickerModal and by
   * SnippetEditorModal's "Папка" field. Delegates to listFolderDescendants.
   */
  async listAllFolders(): Promise<string[]> {
    const root = this.settings.snippetFolderPath;
    const { folders } = await this.listFolderDescendants(root);
    const set = new Set<string>([root, ...folders]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Phase 32: Strip control characters (U+0000–U+001F, U+007F) from all
   * string values in a JsonSnippet and produce a plain disk payload object
   * (without runtime-only `kind` / `path` / deprecated `id`). Preserves
   * ASVS V5 input sanitization (T-5-01).
   */
  private sanitizeJson(snippet: JsonSnippet): {
    name: string;
    template: string;
    placeholders: JsonSnippet['placeholders'];
  } {
    const clean = (s: string): string => s.replace(/[\u0000-\u001F\u007F]/g, '');
    return {
      name: clean(snippet.name),
      template: clean(snippet.template),
      placeholders: snippet.placeholders.map((p) => ({
        ...p,
        label: clean(p.label),
        options: p.options?.map(clean),
        unit: p.unit !== undefined ? clean(p.unit) : undefined,
        joinSeparator: p.joinSeparator !== undefined ? clean(p.joinSeparator) : undefined,
      })),
    };
  }
}
