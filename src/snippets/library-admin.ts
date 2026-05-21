// snippets/library-admin.ts
// Library Admin service: read/write local library repo files + regenerate indexes.
// Uses Node.js fs/path for external repo path (outside vault).

import { Notice } from 'obsidian';
import type { LibraryIndex, LibrarySnippetEntry } from './library-model';
import type { ProtocolLibraryEntry } from '../protocol/protocol-library-model';
import type { Translator } from '../i18n';

import * as nodeFs from 'fs';
import * as nodePath from 'path';
import * as nodeChildProcess from 'child_process';

function ensureModule(mod: unknown, name: string): void {
  if (mod === null || mod === undefined) {
    throw new Error(`${name} is not available in this environment.`);
  }
}

export class LibraryAdminService {
  private readonly repoPath: string;
  private readonly t: Translator;

  constructor(repoPath: string, t: Translator) {
    this.repoPath = repoPath;
    this.t = t;
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
        return { valid: false, error: 'Not a directory' };
      }
      const hasSnippetsDir = fs.existsSync(path.join(this.repoPath, 'snippets'));
      const hasProtocolsDir = fs.existsSync(path.join(this.repoPath, 'protocols'));
      const hasIndex = fs.existsSync(path.join(this.repoPath, 'index.json'));
      if (!hasSnippetsDir && !hasProtocolsDir && !hasIndex) {
        return { valid: false, error: 'Directory does not look like a RadiProtocol-Library repo (no snippets/, protocols/, or index.json found)' };
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

  /** Run git pull in the repo directory. */
  async gitPull(): Promise<{ success: boolean; output: string }> {
    return this.runGit('pull');
  }

  /** Get git status. */
  async gitStatus(): Promise<{ success: boolean; output: string }> {
    return this.runGit('status', '--short');
  }

  /** Copy git commit & push commands to clipboard. */
  getGitPushCommands(): string {
    return `cd ${this.repoPath} && git add . && git commit -m "update library" && git push origin main`;
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
    const { execSync } = nodeChildProcess as typeof import('child_process');
    try {
      const output = execSync(`git ${args.join(' ')}`, {
        cwd: this.repoPath,
        encoding: 'utf-8',
        timeout: 30000,
      });
      return Promise.resolve({ success: true, output: output.trim() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return Promise.resolve({ success: false, output: message });
    }
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
        } else if (entry.isFile() && predicate(fullPath)) {
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

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private titleFromSlug(slug: string): string {
    return slug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
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