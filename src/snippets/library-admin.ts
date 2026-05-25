// snippets/library-admin.ts
// Library Admin service: read/write local library repo files + regenerate indexes.
// Uses Node.js fs/path for external repo path (outside vault).

import { Notice } from 'obsidian';
import type { LibraryIndex, LibrarySnippetEntry } from './library-model';
import type { ProtocolLibraryEntry } from '../protocol/protocol-library-model';
import type { JsonSnippet, Snippet, SnippetPlaceholder } from './snippet-model';
import { validatePlaceholders } from './snippet-model';
import type { Translator } from '../i18n';

import * as nodeFs from 'fs';
import * as nodePath from 'path';
import * as nodeChildProcess from 'child_process';

function ensureModule(mod: unknown, name: string): void {
  if (mod === null || mod === undefined) {
    throw new Error(`${name} is not available in this environment.`);
  }
}

type GitExec = typeof nodeChildProcess.execSync;

export type LibraryAdminSection = 'snippets' | 'protocols';

export interface LibraryAdminDirectoryEntry {
  name: string;
  path: string;
  section: LibraryAdminSection;
}

export class LibraryAdminService {
  private readonly repoPath: string;
  private readonly t: Translator;
  private readonly gitExec: GitExec;

  constructor(repoPath: string, t: Translator, gitExec: GitExec = nodeChildProcess.execSync) {
    this.repoPath = repoPath;
    this.t = t;
    this.gitExec = gitExec;
  }

  // ─── Validation ─────────────────────────────────────────────────────

  /** Validate the repo path is a directory and looks like the library repo. */
  async validateRepoPath(): Promise<{ valid: boolean; error?: string }> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    try {
      const stat = fs.statSync(this.repoPath);
      if (!stat.isDirectory()) {
        return { valid: false, error: this.t('admin.notDirectory') };
      }
      const hasSnippetsDir = fs.existsSync(path.join(this.repoPath, 'snippets'));
      const hasProtocolsDir = fs.existsSync(path.join(this.repoPath, 'protocols'));
      const hasIndex = fs.existsSync(path.join(this.repoPath, 'index.json'));
      if (!hasSnippetsDir && !hasProtocolsDir && !hasIndex) {
        return { valid: false, error: this.t('admin.invalidRepoStructure') };
      }
      return { valid: true };
    } catch (err) {
      return { valid: false, error: String(err) };
    }
  }

  // ─── Read operations ───────────────────────────────────────────────

  /** Read the local index.json. */
  async readSnippetIndex(): Promise<LibraryIndex | null> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    const indexPath = path.join(this.repoPath, 'index.json');
    try {
      if (!fs.existsSync(indexPath)) return null;
      const text = fs.readFileSync(indexPath, 'utf-8');
      return JSON.parse(text) as LibraryIndex;
    } catch {
      return null;
    }
  }

  /** Read the local protocols-index.json. */
  async readProtocolIndex(): Promise<{ version: string; protocols: ProtocolLibraryEntry[] } | null> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    const indexPath = path.join(this.repoPath, 'protocols-index.json');
    try {
      if (!fs.existsSync(indexPath)) return null;
      const text = fs.readFileSync(indexPath, 'utf-8');
      return JSON.parse(text) as { version: string; protocols: ProtocolLibraryEntry[] };
    } catch {
      return null;
    }
  }

  /** List directories under snippets/ or protocols/ with display names from _meta.json. */
  async listDirectories(section: LibraryAdminSection): Promise<LibraryAdminDirectoryEntry[]> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    const rootRel = this.sectionRoot(section);
    const root = path.join(this.repoPath, rootRel);
    if (!fs.existsSync(root)) return [];
    const dirs: LibraryAdminDirectoryEntry[] = [];
    const stack = [root];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        // Skip _meta files that accidentally parse as directories — defensive
        if (entry.name.startsWith('_') && entry.name.endsWith('.json')) continue;
        const fullPath = path.join(current, entry.name);
        const rel = path.relative(this.repoPath, fullPath).split(path.sep).join('/');
        dirs.push({ name: entry.name, path: rel, section });
        stack.push(fullPath);
      }
    }
    return dirs.sort((a, b) => a.path.localeCompare(b.path, 'ru'));
  }

  /** Read the display name for a directory from its _meta.json, or return null if absent. */
  async readDirectoryDisplayName(dirAbsPath: string): Promise<string | null> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    const metaPath = path.join(dirAbsPath, '_meta.json');
    try {
      if (!fs.existsSync(metaPath)) return null;
      const data = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      return typeof data.displayName === 'string' ? data.displayName : null;
    } catch {
      return null;
    }
  }

  /** Resolve a repo-relative path to an absolute path. Public for modal use. */
  resolveRepoPathPublic(relPath: string): string {
    return this.resolveRepoPath(relPath);
  }

  // ─── Write operations ──────────────────────────────────────────────

  /** Import a snippet JSON file from vault into the library repo. */
  async importSnippetFromVault(
    content: string,
    category: string,
    name: string,
    id?: string,
    description?: string,
  ): Promise<LibrarySnippetEntry | null> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    try {
      const parsed = JSON.parse(content);
      const slug = this.slugify(name);
      const categorySlug = this.slugify(category);
      const relPath = `snippets/${categorySlug}/${slug}.json`;
      const fullPath = path.join(this.repoPath, relPath);

      // Ensure parent directory
      const parentDir = path.dirname(fullPath);
      fs.mkdirSync(parentDir, { recursive: true });

      // Write file
      fs.writeFileSync(fullPath, content, 'utf-8');

      // Build entry
      const entryId = id ?? `${categorySlug}-${slug}`;
      const entryName = typeof parsed.name === 'string' && parsed.name.trim() !== '' ? parsed.name.trim() : name;
      const entryDescription = description ?? `${category} / ${entryName}`;

      const entry: LibrarySnippetEntry = {
        id: entryId,
        name: entryName,
        category,
        path: relPath,
        description: entryDescription,
      };

      await this.writeSnippetEntryMetadata(entry);
      await this.regenerateIndexes();

      new Notice(this.t('admin.snippetImported', { name: entryName }));
      return entry;
    } catch (err) {
      console.error('[RadiProtocol][Admin] importSnippet failed:', err);
      new Notice(this.t('admin.snippetImportFailed', { error: String(err) }));
      return null;
    }
  }

  /** Import a snippet JSON file from vault into an existing library directory. */
  async importSnippetFromVaultToDirectory(
    content: string,
    targetDirectory: string,
    fallbackName: string,
    description?: string,
  ): Promise<LibrarySnippetEntry | null> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    try {
      const parsed = JSON.parse(content);
      const name = typeof parsed.name === 'string' && parsed.name.trim() !== '' ? parsed.name.trim() : fallbackName;
      const slug = this.slugify(name);
      const dirRel = this.normaliseDirectoryPath('snippets', targetDirectory);
      const fullDir = this.resolveRepoPath(dirRel);
      fs.mkdirSync(fullDir, { recursive: true });
      const relPath = `${dirRel}/${slug}.json`;
      fs.writeFileSync(path.join(this.repoPath, relPath), content, 'utf-8');

      const category = await this.displayCategoryFromDirectory(dirRel);
      const entry: LibrarySnippetEntry = {
        id: relPath.replace(/^snippets\//, '').replace(/\.json$/, '').replace(/\//g, '-'),
        name,
        category,
        path: relPath,
        description: description ?? `${category} / ${name}`,
      };
      await this.writeSnippetEntryMetadata(entry);
      await this.regenerateIndexes();
      new Notice(this.t('admin.snippetImported', { name }));
      return entry;
    } catch (err) {
      console.error('[RadiProtocol][Admin] importSnippet failed:', err);
      new Notice(this.t('admin.snippetImportFailed', { error: String(err) }));
      return null;
    }
  }

  async readLibrarySnippet(entry: LibrarySnippetEntry): Promise<JsonSnippet | null> {
    ensureModule(nodeFs, 'fs');
    const fs = nodeFs as typeof import('fs');
    try {
      const raw = fs.readFileSync(this.resolveRepoPath(entry.path), 'utf-8');
      const parsed = JSON.parse(raw) as Partial<JsonSnippet>;
      const placeholders: SnippetPlaceholder[] = Array.isArray(parsed.placeholders)
        ? parsed.placeholders as SnippetPlaceholder[]
        : [];
      return {
        kind: 'json',
        path: entry.path,
        name: typeof parsed.name === 'string' && parsed.name.trim() !== '' ? parsed.name.trim() : entry.name,
        template: typeof parsed.template === 'string' ? parsed.template : '',
        placeholders,
        validationError: validatePlaceholders(placeholders, this.t),
      };
    } catch (err) {
      console.error('[RadiProtocol][Admin] readLibrarySnippet failed:', err);
      new Notice(this.t('admin.readFailed'));
      return null;
    }
  }

  async saveLibrarySnippet(snippet: Snippet): Promise<void> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    if (snippet.kind !== 'json') {
      throw new Error('Library admin supports JSON snippets only.');
    }
    const fullPath = this.resolveRepoPath(snippet.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify({
      name: snippet.name,
      template: snippet.template,
      placeholders: snippet.placeholders,
    }, null, 2) + '\n', 'utf-8');
    await this.regenerateIndexes();
    new Notice(this.t('admin.snippetUpdated', { name: snippet.name }));
  }

  async snippetPathExists(relPath: string): Promise<boolean> {
    ensureModule(nodeFs, 'fs');
    const fs = nodeFs as typeof import('fs');
    return fs.existsSync(this.resolveRepoPath(relPath));
  }

  async listSnippetDirectories(): Promise<string[]> {
    const dirs = await this.listDirectories('snippets');
    return ['snippets', ...dirs.map(d => d.path)].sort((a, b) => a.localeCompare(b, 'ru'));
  }

  async moveSnippetToDirectory(entry: LibrarySnippetEntry, targetDirectory: string): Promise<LibrarySnippetEntry | null> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    try {
      const dirRel = this.normaliseDirectoryPath('snippets', targetDirectory);
      const oldFullPath = this.resolveRepoPath(entry.path);
      const newRelPath = `${dirRel}/${path.basename(entry.path)}`;
      const newFullPath = this.resolveRepoPath(newRelPath);
      if (entry.path === newRelPath) return entry;
      if (fs.existsSync(newFullPath)) throw new Error(this.t('snippetService.pathExists', { path: newRelPath }));
      fs.mkdirSync(path.dirname(newFullPath), { recursive: true });
      fs.renameSync(oldFullPath, newFullPath);
      const category = await this.displayCategoryFromDirectory(dirRel);
      const updated: LibrarySnippetEntry = {
        ...entry,
        id: newRelPath.replace(/^snippets\//, '').replace(/\.json$/, '').replace(/\//g, '-'),
        category,
        path: newRelPath,
        description: entry.description === `${entry.category} / ${entry.name}` ? `${category} / ${entry.name}` : entry.description,
      };
      await this.writeSnippetEntryMetadata(updated);
      await this.regenerateIndexes();
      new Notice(this.t('admin.snippetMoved', { name: entry.name }));
      return updated;
    } catch (err) {
      console.error('[RadiProtocol][Admin] moveSnippetToDirectory failed:', err);
      new Notice(this.t('admin.moveSnippetFailed', { error: String(err) }));
      return null;
    }
  }

  /** Import a protocol .rp.json file from vault into the library repo. */
  async importProtocolFromVault(
    content: string,
    category: string,
    description?: string,
  ): Promise<ProtocolLibraryEntry | null> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    try {
      const parsed = JSON.parse(content);
      const title = typeof parsed.title === 'string' && parsed.title.trim() !== '' ? parsed.title.trim() : 'Untitled';
      const slug = this.slugify(title);
      const relPath = `protocols/${slug}.rp.json`;
      const fullPath = path.join(this.repoPath, relPath);

      // Ensure parent directory
      const parentDir = path.dirname(fullPath);
      fs.mkdirSync(parentDir, { recursive: true });

      // Write file
      fs.writeFileSync(fullPath, content, 'utf-8');

      const entry: ProtocolLibraryEntry = {
        id: slug,
        title,
        path: relPath,
        schema: (typeof parsed.schema === 'string' ? parsed.schema : 'radiprotocol.protocol') as ProtocolLibraryEntry['schema'],
        version: typeof parsed.version === 'number' ? parsed.version : 1,
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes.length : 0,
        edges: Array.isArray(parsed.edges) ? parsed.edges.length : 0,
        description: description ?? title,
      };

      await this.writeProtocolEntryMetadata(entry);
      await this.regenerateIndexes();

      new Notice(this.t('admin.protocolImported', { title }));
      return entry;
    } catch (err) {
      console.error('[RadiProtocol][Admin] importProtocol failed:', err);
      new Notice(this.t('admin.protocolImportFailed', { error: String(err) }));
      return null;
    }
  }

  /** Delete a snippet file and remove from index. */
  async deleteSnippet(entry: LibrarySnippetEntry): Promise<boolean> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    try {
      const fullPath = path.join(this.repoPath, entry.path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      await this.regenerateIndexes();
      new Notice(this.t('admin.snippetDeleted', { name: entry.name }));
      return true;
    } catch (err) {
      console.error('[RadiProtocol][Admin] deleteSnippet failed:', err);
      new Notice(this.t('admin.deleteFailed', { error: String(err) }));
      return false;
    }
  }

  /** Delete a protocol file and remove from index. */
  async deleteProtocol(entry: ProtocolLibraryEntry): Promise<boolean> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    try {
      const fullPath = path.join(this.repoPath, entry.path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      await this.regenerateIndexes();
      new Notice(this.t('admin.protocolDeleted', { title: entry.title }));
      return true;
    } catch (err) {
      console.error('[RadiProtocol][Admin] deleteProtocol failed:', err);
      new Notice(this.t('admin.deleteFailed', { error: String(err) }));
      return false;
    }
  }

  /** Create a directory under snippets/ or protocols/. */
  async createDirectory(section: LibraryAdminSection, parentPath: string, name: string): Promise<LibraryAdminDirectoryEntry | null> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    try {
      const safeName = this.safeDirectoryName(name);
      const parentRel = this.normaliseDirectoryPath(section, parentPath);
      const relPath = `${parentRel}/${safeName}`;
      const fullPath = this.resolveRepoPath(relPath);
      if (fs.existsSync(fullPath)) {
        throw new Error(this.t('admin.directoryAlreadyExists'));
      }
      fs.mkdirSync(fullPath, { recursive: false });
      // Store the original display name so Cyrillic names survive slugification
      const displayName = name.trim();
      if (displayName !== safeName) {
        const metaPath = path.join(fullPath, '_meta.json');
        fs.writeFileSync(metaPath, JSON.stringify({ displayName }, null, 2) + '\n', 'utf-8');
      }
      new Notice(this.t('admin.directoryCreated', { name: safeName }));
      return { name: safeName, path: relPath, section };
    } catch (err) {
      console.error('[RadiProtocol][Admin] createDirectory failed:', err);
      new Notice(this.t('admin.directoryCreateFailed', { error: String(err) }));
      return null;
    }
  }

  /** Rename a directory under snippets/ or protocols/. */
  async renameDirectory(section: LibraryAdminSection, dirPath: string, newName: string): Promise<LibraryAdminDirectoryEntry | null> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    try {
      const fromRel = this.normaliseDirectoryPath(section, dirPath);
      if (fromRel === this.sectionRoot(section)) throw new Error(this.t('admin.directoryRootProtected'));
      const safeName = this.safeDirectoryName(newName);
      const toRel = `${path.posix.dirname(fromRel)}/${safeName}`;
      const fromFull = this.resolveRepoPath(fromRel);
      const toFull = this.resolveRepoPath(toRel);
      if (!fs.existsSync(fromFull) || !fs.statSync(fromFull).isDirectory()) {
        throw new Error(this.t('admin.directoryNotFound'));
      }

      // If the slugified name matches the current directory name, only update _meta.json
      // (no filesystem rename needed — this handles display-name-only changes like Cyrillic rename)
      const currentSlug = path.posix.basename(fromRel);
      if (safeName !== currentSlug) {
        if (fs.existsSync(toFull)) {
          throw new Error(this.t('admin.directoryAlreadyExists'));
        }
        fs.renameSync(fromFull, toFull);
      }

      // Write _meta.json with the new display name
      const displayName = newName.trim();
      if (displayName !== safeName) {
        const metaPath = path.join(toFull, '_meta.json');
        fs.writeFileSync(metaPath, JSON.stringify({ displayName }, null, 2) + '\n', 'utf-8');
      } else {
        // If displayName matches slug, remove _meta.json if it exists
        const metaPath = path.join(toFull, '_meta.json');
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      }

      // Update index entry paths to preserve category metadata after directory rename
      const indexPath = path.join(this.repoPath, 'index.json');
      if (fs.existsSync(indexPath)) {
        try {
          const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
          if (Array.isArray(indexData.snippets)) {
            let changed = false;
            for (const entry of indexData.snippets) {
              if (typeof entry.path === 'string' && (entry.path.startsWith(fromRel + '/') || entry.path === fromRel)) {
                entry.path = entry.path.replace(fromRel, toRel);
                changed = true;
              }
            }
            if (changed) {
              fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2) + '\n', 'utf-8');
            }
          }
        } catch { /* ignore — regenerateIndexes will rebuild */ }
      }

      await this.regenerateIndexes();
      new Notice(this.t('admin.directoryRenamed', { name: displayName !== safeName ? displayName : safeName }));
      return { name: safeName, path: toRel, section };
    } catch (err) {
      console.error('[RadiProtocol][Admin] renameDirectory failed:', err);
      new Notice(this.t('admin.directoryRenameFailed', { error: String(err) }));
      return null;
    }
  }

  async deleteDirectory(section: LibraryAdminSection, dirPath: string): Promise<boolean> {
    ensureModule(nodeFs, 'fs');
    const fs = nodeFs as typeof import('fs');
    try {
      const relPath = this.normaliseDirectoryPath(section, dirPath);
      if (relPath === this.sectionRoot(section)) throw new Error(this.t('admin.directoryRootProtected'));
      const fullPath = this.resolveRepoPath(relPath);
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
        throw new Error(this.t('admin.directoryNotFound'));
      }
      this.deleteDirectoryContents(fullPath);
      fs.rmdirSync(fullPath);
      await this.regenerateIndexes();
      new Notice(this.t('admin.directoryDeleted'));
      return true;
    } catch (err) {
      console.error('[RadiProtocol][Admin] deleteDirectory failed:', err);
      new Notice(this.t('admin.directoryDeleteFailed', { error: String(err) }));
      return false;
    }
  }

  /** Update snippet metadata (category, description). Moves file if category changed. */
  async updateSnippetMetadata(
    entry: LibrarySnippetEntry,
    updates: { category?: string; description?: string },
  ): Promise<LibrarySnippetEntry | null> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    try {
      let newPath = entry.path;
      const newName = entry.name;
      let newCategory = entry.category;
      let newDescription = entry.description;

      if (updates.category !== undefined && updates.category !== entry.category) {
        const newCategorySlug = this.slugify(updates.category);
        const fileName = path.basename(entry.path);
        newPath = `snippets/${newCategorySlug}/${fileName}`;
        newCategory = updates.category;

        // Move file
        const oldFullPath = path.join(this.repoPath, entry.path);
        const newFullPath = path.join(this.repoPath, newPath);
        const parentDir = path.dirname(newFullPath);
        fs.mkdirSync(parentDir, { recursive: true });
        if (fs.existsSync(oldFullPath)) {
          fs.renameSync(oldFullPath, newFullPath);
        }
      }

      if (updates.description !== undefined) {
        newDescription = updates.description;
      }

      const updatedEntry: LibrarySnippetEntry = {
        id: entry.id,
        name: newName,
        category: newCategory,
        path: newPath,
        description: newDescription,
      };

      await this.writeSnippetEntryMetadata(updatedEntry);
      await this.regenerateIndexes();
      new Notice(this.t('admin.snippetUpdated', { name: newName }));
      return updatedEntry;
    } catch (err) {
      console.error('[RadiProtocol][Admin] updateSnippetMetadata failed:', err);
      new Notice(this.t('admin.updateFailed', { error: String(err) }));
      return null;
    }
  }

  /** Update protocol metadata (description). */
  async updateProtocolMetadata(
    entry: ProtocolLibraryEntry,
    updates: { description?: string },
  ): Promise<ProtocolLibraryEntry | null> {
    try {
      const updatedEntry: ProtocolLibraryEntry = {
        ...entry,
        description: updates.description ?? entry.description,
      };

      await this.writeProtocolEntryMetadata(updatedEntry);
      await this.regenerateIndexes();
      new Notice(this.t('admin.protocolUpdated', { title: entry.title }));
      return updatedEntry;
    } catch (err) {
      console.error('[RadiProtocol][Admin] updateProtocolMetadata failed:', err);
      new Notice(this.t('admin.updateFailed', { error: String(err) }));
      return null;
    }
  }

  // ─── Index regeneration ─────────────────────────────────────────────

  /** Regenerate index.json, protocols-index.json, and library.json. */
  async regenerateIndexes(): Promise<void> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');

    const previousSnippets = this.readPreviousEntries('index.json', 'snippets') as LibrarySnippetEntry[];
    const previousProtocols = this.readPreviousEntries('protocols-index.json', 'protocols') as ProtocolLibraryEntry[];

    const previousByPathSnippets = new Map(previousSnippets.map(e => [e.path, e]));
    const previousByPathProtocols = new Map(previousProtocols.map(e => [e.path, e]));

    // Scan snippets
    const snippetFiles = this.walkFiles(
      path.join(this.repoPath, 'snippets'),
      (f: string) => f.endsWith('.json'),
    );
    const snippets: LibrarySnippetEntry[] = snippetFiles.map((file) => {
      const rel = path.relative(this.repoPath, file).split(path.sep).join('/');
      const data = this.readJsonFile(file);
      const previous = previousByPathSnippets.get(rel);
      const id = typeof previous?.id === 'string'
        ? previous.id
        : rel.replace(/^snippets\//, '').replace(/\.json$/, '').replace(/\//g, '-');
      const name = typeof previous?.name === 'string'
        ? previous.name
        : (typeof data?.name === 'string' && data.name.trim() !== '' ? data.name.trim() : this.titleFromSlug(path.basename(file, '.json')));
      const category = typeof previous?.category === 'string'
        ? previous.category
        : this.displayCategoryFromRelativePath(rel);
      return {
        id,
        name,
        category,
        path: rel,
        description: typeof previous?.description === 'string' ? previous.description : `${category} / ${name}`,
      };
    });

    // Scan protocols
    const protocolFiles = this.walkFiles(
      path.join(this.repoPath, 'protocols'),
      (f: string) => f.endsWith('.rp.json'),
    );
    const protocols: ProtocolLibraryEntry[] = protocolFiles.map((file) => {
      const rel = path.relative(this.repoPath, file).split(path.sep).join('/');
      const data = this.readJsonFile(file);
      const previous = previousByPathProtocols.get(rel);
      const title = typeof data?.title === 'string' && data.title.trim() !== ''
        ? data.title.trim()
        : this.titleFromSlug(path.basename(file, '.rp.json'));
      return {
        id: typeof previous?.id === 'string' ? previous.id : path.basename(file, '.rp.json'),
        title,
        path: rel,
        schema: (typeof data?.schema === 'string' ? data.schema : 'radiprotocol.protocol') as ProtocolLibraryEntry['schema'],
        version: typeof data?.version === 'number' ? data.version : 1,
        nodes: Array.isArray(data?.nodes) ? data.nodes.length : 0,
        edges: Array.isArray(data?.edges) ? data.edges.length : 0,
        description: typeof previous?.description === 'string' ? previous.description : title,
      };
    });

    // Preserve order from previous indexes
    const orderedSnippets = this.orderByPrevious(snippets, previousSnippets);
    const orderedProtocols = this.orderByPrevious(protocols, previousProtocols);

    // Write indexes
    const VERSION = '1.0.0';
    fs.writeFileSync(
      path.join(this.repoPath, 'index.json'),
      JSON.stringify({ version: VERSION, snippets: orderedSnippets }, null, 2) + '\n',
      'utf-8',
    );
    fs.writeFileSync(
      path.join(this.repoPath, 'protocols-index.json'),
      JSON.stringify({ version: VERSION, protocols: orderedProtocols }, null, 2) + '\n',
      'utf-8',
    );
    fs.writeFileSync(
      path.join(this.repoPath, 'library.json'),
      JSON.stringify({ version: VERSION, snippets: orderedSnippets, protocols: orderedProtocols }, null, 2) + '\n',
      'utf-8',
    );
  }

  // ─── Git operations ──────────────────────────────────────────────────

  /** Fetch and fast-forward from origin/main. Does not overwrite local edits/deletes. */
  async gitPull(): Promise<{ success: boolean; output: string }> {
    const fetch = await this.runGit('fetch', 'origin', 'main');
    if (!fetch.success) return fetch;

    const status = await this.gitStatus();
    if (!status.success) return status;
    if (status.output.trim() !== '') {
      return {
        success: false,
        output: this.t('admin.pullBlockedDirtyTree', { status: status.output }),
      };
    }

    return this.runGit('merge', '--ff-only', 'origin/main');
  }

  /** Restore the local checkout to origin/main, discarding local changes. */
  async gitResetToOriginMain(): Promise<{
    success: boolean;
    output: string;
    ref?: string;
    cleanedCount?: number;
    hint?: string;
  }> {
    const fetch = await this.runGit('fetch', 'origin', 'main');
    if (!fetch.success) {
      return { success: false, output: fetch.output, hint: this.t('admin.resetFetchFailedHint') };
    }

    const reset = await this.runGit('reset', '--hard', 'origin/main');
    if (!reset.success) {
      return { success: false, output: reset.output, hint: this.t('admin.resetFailedHint') };
    }

    const clean = await this.runGit('clean', '-fd');
    if (!clean.success) {
      return { success: false, output: clean.output, hint: this.t('admin.resetFailedHint') };
    }

    const refResult = await this.runGit('rev-parse', '--abbrev-ref', 'HEAD');
    const shortHash = await this.runGit('rev-parse', '--short', 'HEAD');
    let ref: string;
    if (refResult.success && refResult.output.trim()) {
      ref = refResult.output.trim();
      if (shortHash.success && shortHash.output.trim()) {
        ref = `${ref} (${shortHash.output.trim()})`;
      }
    } else if (shortHash.success && shortHash.output.trim()) {
      ref = shortHash.output.trim();
    } else {
      ref = 'origin/main';
    }

    const cleanedCount = this.parseCleanCount(clean.output);

    return {
      success: true,
      output: [reset.output, clean.output].filter(Boolean).join('\n') || this.t('admin.resetSuccess'),
      ref,
      cleanedCount,
    };
  }

  /** Get git status (short format). */
  async gitStatus(): Promise<{ success: boolean; output: string }> {
    return this.runGit('status', '--short');
  }

  /** Get a short diff summary (stat) of staged+unstaged changes. */
  async gitDiffStat(): Promise<{ success: boolean; output: string }> {
    return this.runGit('diff', '--stat', 'HEAD');
  }

  /** Get the current branch name. Returns empty string on failure. */
  async gitBranch(): Promise<string> {
    const result = await this.runGit('rev-parse', '--abbrev-ref', 'HEAD');
    return result.success ? result.output.trim() : '';
  }

  /** Get list of untracked files. */
  async gitUntracked(): Promise<string[]> {
    const result = await this.runGit('ls-files', '--others', '--exclude-standard');
    if (!result.success) return [];
    return result.output.split('\n').map(l => l.trim()).filter(Boolean);
  }

  /** Stage all changes, commit, and push to origin on a new branch. */
  async gitCommitAndPushBranch(branchName: string, commitMessage: string): Promise<{
    success: boolean;
    output: string;
    branchUrl?: string;
    hint?: string;
  }> {
    const checkout = await this.runGit('checkout', '-b', branchName);
    if (!checkout.success) {
      return { success: false, output: checkout.output, hint: this.t('admin.sendBranchCheckoutFailed') };
    }

    const add = await this.runGit('add', '-A');
    if (!add.success) {
      return { success: false, output: add.output, hint: this.t('admin.sendStageFailed') };
    }

    const commit = await this.runGit('commit', '-m', commitMessage);
    if (!commit.success) {
      return { success: false, output: commit.output, hint: this.t('admin.sendCommitFailed') };
    }

    const push = await this.runGit('push', '-u', 'origin', branchName);
    if (!push.success) {
      return { success: false, output: push.output, hint: this.t('admin.sendPushFailed') };
    }

    const remoteUrl = await this.getRemoteHttpUrl();
    return {
      success: true,
      output: commit.output,
      branchUrl: remoteUrl ? `${remoteUrl}/compare/${branchName}` : undefined,
    };
  }

  /** Get the HTTPS remote URL for the origin, or null if unavailable. */
  async getRemoteHttpUrl(): Promise<string | null> {
    const result = await this.runGit('remote', 'get-url', 'origin');
    if (!result.success) return null;
    let url = result.output.trim();
    if (url.endsWith('.git')) url = url.slice(0, -4);
    if (url.startsWith('git@github.com:')) {
      url = url.replace('git@github.com:', 'https://github.com/');
    } else if (url.startsWith('ssh://git@github.com/')) {
      url = url.replace('ssh://git@github.com/', 'https://github.com/');
    }
    if (!url.startsWith('https://')) return null;
    return url;
  }

  // ─── Validation ─────────────────────────────────────────────────────

  /** Validate all snippet entries in the index. */
  async validateSnippets(): Promise<{ valid: boolean; errors: string[] }> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    const errors: string[] = [];
    const index = await this.readSnippetIndex();
    if (index === null) {
      errors.push('index.json not found or invalid');
      return { valid: false, errors };
    }

    const ids = new Set<string>();
    const paths = new Set<string>();

    for (const entry of index.snippets) {
      if (ids.has(entry.id)) {
        errors.push(`Duplicate id: ${entry.id}`);
      }
      ids.add(entry.id);

      if (paths.has(entry.path)) {
        errors.push(`Duplicate path: ${entry.path}`);
      }
      paths.add(entry.path);

      const fullPath = path.join(this.repoPath, entry.path);
      if (!fs.existsSync(fullPath)) {
        errors.push(`Missing file: ${entry.path}`);
      } else {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const data = JSON.parse(content);
          if (typeof data.template !== 'string') {
            errors.push(`Missing template in: ${entry.path}`);
          }
          if (!Array.isArray(data.placeholders)) {
            errors.push(`Missing placeholders in: ${entry.path}`);
          }
        } catch {
          errors.push(`Invalid JSON in: ${entry.path}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ─── Private helpers ────────────────────────────────────────────────

  private runGit(...args: string[]): Promise<{ success: boolean; output: string }> {
    ensureModule(nodeChildProcess, 'child_process');
    try {
      const command = `git ${args.map(arg => this.quoteShellArg(arg)).join(' ')}`;
      const output = this.gitExec(command, {
        cwd: this.repoPath,
        encoding: 'utf-8',
        timeout: 30000,
      });
      return Promise.resolve({ success: true, output: String(output).trim() });
    } catch (err: unknown) {
      return Promise.resolve({ success: false, output: this.formatGitError(err) });
    }
  }

  private quoteShellArg(arg: string): string {
    if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(arg)) return arg;
    return `'${arg.replace(/'/g, `'"'"'`)}'`;
  }

  private formatGitError(err: unknown): string {
    const parts: string[] = [];
    if (typeof err === 'object' && err !== null) {
      const gitError = err as { stderr?: unknown; stdout?: unknown; message?: unknown };
      if (gitError.stderr) parts.push(String(gitError.stderr).trim());
      if (gitError.stdout) parts.push(String(gitError.stdout).trim());
      if (gitError.message) parts.push(String(gitError.message).trim());
    } else {
      parts.push(String(err));
    }
    return parts.filter(Boolean).join('\n');
  }

  private parseCleanCount(cleanOutput: string): number {
    if (!cleanOutput.trim()) return 0;
    const lines = cleanOutput.split('\n').filter(l => l.trim().startsWith('Removing'));
    return lines.length;
  }

  private async writeSnippetEntryMetadata(entry: LibrarySnippetEntry): Promise<void> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    const entries = this.readPreviousEntries('index.json', 'snippets') as LibrarySnippetEntry[];
    const next = entries.filter(existing => existing.path !== entry.path && existing.id !== entry.id);
    next.push(entry);
    fs.writeFileSync(
      path.join(this.repoPath, 'index.json'),
      JSON.stringify({ version: '1.0.0', snippets: next }, null, 2) + '\n',
      'utf-8',
    );
  }

  private async writeProtocolEntryMetadata(entry: ProtocolLibraryEntry): Promise<void> {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    const entries = this.readPreviousEntries('protocols-index.json', 'protocols') as ProtocolLibraryEntry[];
    const next = entries.filter(existing => existing.path !== entry.path && existing.id !== entry.id);
    next.push(entry);
    fs.writeFileSync(
      path.join(this.repoPath, 'protocols-index.json'),
      JSON.stringify({ version: '1.0.0', protocols: next }, null, 2) + '\n',
      'utf-8',
    );
  }

  private readPreviousEntries(fileName: string, key: string): LibrarySnippetEntry[] | ProtocolLibraryEntry[] {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    const filePath = path.join(this.repoPath, fileName);
    if (!fs.existsSync(filePath)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return Array.isArray(data[key]) ? data[key] : [];
    } catch {
      return [];
    }
  }

  private walkFiles(dir: string, predicate: (f: string) => boolean): string[] {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    const stack = [dir];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile() && predicate(fullPath) && entry.name !== '_meta.json') {
          out.push(fullPath);
        }
      }
    }
    return out.sort((a, b) => a.localeCompare(b, 'ru'));
  }

  private readJsonFile(filePath: string): Record<string, unknown> | null {
    ensureModule(nodeFs, 'fs');
    const fs = nodeFs as typeof import('fs');
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  private deleteDirectoryContents(dir: string): void {
    ensureModule(nodeFs, 'fs');
    ensureModule(nodePath, 'path');
    const fs = nodeFs as typeof import('fs');
    const path = nodePath as typeof import('path');
    const children = fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    for (const child of children) {
      const childPath = path.join(dir, child.name);
      if (child.isDirectory()) {
        this.deleteDirectoryContents(childPath);
        fs.rmdirSync(childPath);
      } else {
        fs.unlinkSync(childPath);
      }
    }
  }

  private slugify(text: string): string {
    return this.transliterate(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private transliterate(text: string): string {
    const cyrillicToLatin: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
      'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
      'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
      'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
      'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
    };
    let result = '';
    for (const ch of text) {
      result += cyrillicToLatin[ch] ?? ch;
    }
    return result;
  }

  private titleFromSlug(slug: string): string {
    return slug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  private sectionRoot(section: LibraryAdminSection): string {
    return section === 'snippets' ? 'snippets' : 'protocols';
  }

  private safeDirectoryName(name: string): string {
    const trimmed = name.trim();
    if (trimmed === '' || trimmed === '.' || trimmed === '..' || trimmed.includes('/') || trimmed.includes('\\')) {
      throw new Error(this.t('admin.invalidDirectoryName'));
    }
    return this.slugify(trimmed);
  }

  private normaliseDirectoryPath(section: LibraryAdminSection, dirPath: string): string {
    const root = this.sectionRoot(section);
    const normalised = dirPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (normalised === '') return root;
    if (normalised === root || normalised.startsWith(`${root}/`)) return normalised;
    throw new Error(this.t('admin.invalidDirectoryPath'));
  }

  private resolveRepoPath(relPath: string): string {
    ensureModule(nodePath, 'path');
    const path = nodePath as typeof import('path');
    const fullPath = path.resolve(this.repoPath, relPath);
    const repoRoot = path.resolve(this.repoPath);
    if (fullPath !== repoRoot && !fullPath.startsWith(`${repoRoot}${path.sep}`)) {
      throw new Error(this.t('admin.invalidDirectoryPath'));
    }
    return fullPath;
  }

  private async displayCategoryFromDirectory(dirRel: string): Promise<string> {
    const fullPath = this.resolveRepoPath(dirRel);
    const metaName = await this.readDirectoryDisplayName(fullPath);
    if (metaName !== null && metaName.trim() !== '') return metaName.trim();
    return this.displayCategoryFromRelativePath(`${dirRel}/placeholder.json`);
  }

  private displayCategoryFromRelativePath(relPath: string): string {
    const parts = relPath.split('/');
    if (parts.length < 3) return 'General';
    const categoryPart = parts[1] ?? 'general';
    return categoryPart
      .split('-')
      .map(part => part.length > 0 ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part)
      .join(' ');
  }

  private orderByPrevious<T extends { id: string }>(entries: T[], previous: T[]): T[] {
    return entries.sort((a, b) => {
      const aIdx = previous.findIndex(p => p.id === a.id);
      const bIdx = previous.findIndex(p => p.id === b.id);
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return a.id.localeCompare(b.id, 'ru');
    });
  }
}