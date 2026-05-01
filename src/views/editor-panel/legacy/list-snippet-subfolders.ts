// Phase 76 (SPLIT-01 G9) — relocated `listSnippetSubfolders` from
// `editor-panel-view.ts`. Body unchanged. The Node Editor's `case 'snippet'`
// branch now mounts SnippetTreePicker (Phase 51 Plan 03) instead of this
// BFS-flat-list helper, so this file has zero remaining callers in `src/`
// (grep-verified). Retained per CLAUDE.md Shared Pattern G — "never delete
// code authored by prior phases."
import type RadiProtocolPlugin from '../../../main';

/**
 * Recursively lists all subfolder paths (relative to basePath) within basePath.
 * Uses BFS via vault.adapter.list(). Returns [] if basePath does not exist.
 * Phase 29, D-07.
 *
 * @deprecated Phase 51 Plan 03 — Node Editor's `case 'snippet'` now mounts
 * SnippetTreePicker (hierarchical + search) instead of this BFS-flat-list helper.
 * Retained per CLAUDE.md Shared Pattern G (never delete code authored by prior
 * phases). No remaining callers in src/ as of Phase 51-03 (grep-verified).
 */
export async function listSnippetSubfolders(
  plugin: RadiProtocolPlugin,
  basePath: string
): Promise<string[]> {
  const exists = await plugin.app.vault.adapter.exists(basePath);
  if (!exists) return [];

  const results: string[] = [];
  const queue: string[] = [basePath];
  const visited = new Set<string>([basePath]); // WR-01: cycle guard for symlink/junction loops

  while (queue.length > 0) {
    const current = queue.shift()!;
    let listing: { files: string[]; folders: string[] };
    try {
      listing = await plugin.app.vault.adapter.list(current);
    } catch {
      continue; // Skip inaccessible directories silently
    }

    for (const folder of listing.folders) {
      if (visited.has(folder)) continue; // WR-01: skip already-seen paths
      visited.add(folder);
      // vault.adapter.list returns full vault-relative paths (e.g. .radiprotocol/snippets/CT/adrenal)
      // Compute relative path: strip basePath + '/' prefix (Pitfall 3 from RESEARCH.md)
      const rel = folder.slice(basePath.length + 1);
      if (rel) {
        results.push(rel);
      }
      queue.push(folder); // BFS: recurse into subfolder
    }
  }

  return results;
}
