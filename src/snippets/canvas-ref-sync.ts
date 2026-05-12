// snippets/canvas-ref-sync.ts
// Vault-wide utility: rewrite SnippetNode.subfolderPath references in every .canvas
// when a snippet folder is renamed or moved (D-04, D-05, D-06, D-11).
import type { App, TFile } from 'obsidian';
import type { CanvasLiveEditor } from '../canvas/canvas-live-editor';
import { WriteMutex } from '../utils/write-mutex';

interface CanvasSyncResult {
  updated: string[];
  skipped: Array<{ path: string; reason: string }>;
}

// Module-level mutex for canvas writes. Key = canvas file path.
const canvasMutex = new WriteMutex();

/**
 * Rewrite radiprotocol_subfolderPath on snippet nodes across every .canvas
 * in the vault, given an old→new folder-path mapping.
 *
 * Matching rules (D-05):
 *   - Exact match: subfolderPath === oldKey → replace with newValue.
 *   - Prefix match with `/` boundary: subfolderPath.startsWith(oldKey + '/')
 *     → replace prefix, keeping the trailing segment(s).
 *
 * Semantics:
 *   - Only nodes with radiprotocol_nodeType === 'snippet' are considered.
 *   - WR-02: empty-string / null / missing subfolderPath == "root" — unchanged.
 *   - Unchanged nodes keep their original raw form (no normalization on write-back
 *     of fields we do not touch; we mutate the parsed object and JSON.stringify).
 *   - Best-effort: a read/parse/write failure on one canvas is recorded in `skipped`
 *     and does not abort the loop. Never throws.
 *   - No-op early return: a canvas whose parsed JSON contains no matching snippet
 *     nodes is not written (avoids churn and mtime bumps).
 *
 * @param app Obsidian App
 * @param mapping old path → new path (paths are relative to
 *   settings.snippetFolderPath, without leading slash)
 */
export async function rewriteCanvasRefs(
  app: App,
  mapping: Map<string, string>,
  canvasLiveEditor?: CanvasLiveEditor,
): Promise<CanvasSyncResult> {
  const updated: string[] = [];
  const skipped: Array<{ path: string; reason: string }> = [];

  if (mapping.size === 0) return { updated, skipped };

  const canvasFiles: TFile[] = app.vault
    .getFiles()
    .filter((f) => f.extension === 'canvas');

  for (const file of canvasFiles) {
    // Phase 41 WR-03: wrap BOTH the live path and the vault.modify fallback in
    // the per-file mutex so concurrent rewriteCanvasRefs invocations for the
    // same canvas cannot interleave saveLiveBatch with vault.modify.
    await canvasMutex.runExclusive(file.path, async () => {
      try {
        // Phase 41: Try live canvas update first (Pattern B)
        if (canvasLiveEditor && canvasLiveEditor.isLiveAvailable(file.path)) {
          try {
            const liveJson = canvasLiveEditor.getCanvasJSON(file.path);
            if (liveJson) {
              const liveParsed = JSON.parse(liveJson) as { nodes?: unknown[] };
              if (liveParsed && Array.isArray(liveParsed.nodes)) {
                // Collect matching nodes and their edits
                const editsToApply: Array<{ nodeId: string; edits: Record<string, unknown> }> = [];
                for (const node of liveParsed.nodes as Array<Record<string, unknown>>) {
                  if (!node || typeof node !== 'object') continue;
                  if (node['radiprotocol_nodeType'] !== 'snippet') continue;

                  const nodeEdits: Record<string, unknown> = {};

                  // subfolderPath arm
                  const currentSubfolder = node['radiprotocol_subfolderPath'];
                  if (typeof currentSubfolder === 'string' && currentSubfolder !== '') {
                    const rewritten = applyMapping(currentSubfolder, mapping);
                    if (rewritten !== null && rewritten !== currentSubfolder) {
                      nodeEdits['radiprotocol_subfolderPath'] = rewritten;
                      const currentText = node['text'];
                      if (typeof currentText === 'string' && currentText !== '') {
                        const rewrittenText = applyMapping(currentText, mapping);
                        if (rewrittenText !== null && rewrittenText !== currentText) {
                          nodeEdits['text'] = rewrittenText;
                        }
                      }
                    }
                  }

                  // snippetPath arm
                  const currentSnippetPath = node['radiprotocol_snippetPath'];
                  if (typeof currentSnippetPath === 'string' && currentSnippetPath !== '') {
                    const rewritten = applyMapping(currentSnippetPath, mapping);
                    if (rewritten !== null && rewritten !== currentSnippetPath) {
                      nodeEdits['radiprotocol_snippetPath'] = rewritten;
                    }
                  }

                  if (Object.keys(nodeEdits).length === 0) continue;

                  // WR-02: guard node.id — malformed canvases may have missing or
                  // non-string ids. Without this guard, saveLive would receive
                  // `undefined` and either mutate the wrong node or return false.
                  const id = node['id'];
                  if (typeof id !== 'string' || id === '') continue;
                  editsToApply.push({ nodeId: id, edits: nodeEdits });
                }

                if (editsToApply.length === 0) return; // No matching nodes

                // Phase 41 WR-01: batched live save — applies every edit in a
                // single setData + single debounced requestSave. If it fails,
                // the view is left untouched (no partial mutation, no stale
                // pending debounce timer to race vault.modify).
                const ok = await canvasLiveEditor.saveLiveBatch(file.path, editsToApply);
                if (ok) {
                  updated.push(file.path);
                  return; // Skip vault.modify -- saveLiveBatch handles persistence
                }
                // live save failed: fall through to vault.modify path below
              }
            }
          } catch (e) {
            // Live path error -- fall through to vault.modify path
            console.error('[RadiProtocol] canvas-ref-sync live path:', file.path, (e as Error).message);
          }
        }

        const raw = await app.vault.read(file);
        let parsed: { nodes?: unknown[]; edges?: unknown[] };
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          const reason = `invalid JSON: ${(e as Error).message}`;
          console.error('[RadiProtocol] canvas-ref-sync:', file.path, reason);
          skipped.push({ path: file.path, reason });
          return;
        }

        if (!parsed || !Array.isArray(parsed.nodes)) {
          // Not a canvas document we recognise — skip silently.
          return;
        }

        let mutated = false;
        for (const node of parsed.nodes as Array<Record<string, unknown>>) {
          if (!node || typeof node !== 'object') continue;
          if (node['radiprotocol_nodeType'] !== 'snippet') continue;

          // subfolderPath arm
          const currentSubfolder = node['radiprotocol_subfolderPath'];
          if (typeof currentSubfolder === 'string' && currentSubfolder !== '') {
            const rewritten = applyMapping(currentSubfolder, mapping);
            if (rewritten !== null && rewritten !== currentSubfolder) {
              node['radiprotocol_subfolderPath'] = rewritten;
              // Phase 37 gap fix: also update text field so canvas displays new name.
              // Canvas nodes store subfolderPath in both `text` (visual) and
              // `radiprotocol_subfolderPath` (logical). Apply the same mapping to text.
              const currentText = node['text'];
              if (typeof currentText === 'string' && currentText !== '') {
                const rewrittenText = applyMapping(currentText, mapping);
                if (rewrittenText !== null && rewrittenText !== currentText) {
                  node['text'] = rewrittenText;
                }
              }
              mutated = true;
            }
          }

          // snippetPath arm
          const currentSnippetPath = node['radiprotocol_snippetPath'];
          if (typeof currentSnippetPath === 'string' && currentSnippetPath !== '') {
            const rewritten = applyMapping(currentSnippetPath, mapping);
            if (rewritten !== null && rewritten !== currentSnippetPath) {
              node['radiprotocol_snippetPath'] = rewritten;
              mutated = true;
            }
          }
        }

        if (!mutated) return;

        try {
          const next = JSON.stringify(parsed, null, 2);
          await app.vault.modify(file, next);
          updated.push(file.path);
        } catch (e) {
          const reason = `write failed: ${(e as Error).message}`;
          console.error('[RadiProtocol] canvas-ref-sync:', file.path, reason);
          skipped.push({ path: file.path, reason });
        }
      } catch (e) {
        const reason = `read failed: ${(e as Error).message}`;
        console.error('[RadiProtocol] canvas-ref-sync:', file.path, reason);
        skipped.push({ path: file.path, reason });
      }
    });
  }

  return { updated, skipped };
}

/**
 * Apply old→new mapping to a single subfolderPath.
 * Returns the rewritten path, or null if no mapping key matched.
 * Exact match wins over prefix match. Longest prefix wins on ties.
 */
function applyMapping(
  current: string,
  mapping: Map<string, string>,
): string | null {
  // Exact match
  const exact = mapping.get(current);
  if (exact !== undefined) return exact;

  // Prefix match with `/` boundary — pick the longest matching key
  let bestKey: string | null = null;
  for (const key of mapping.keys()) {
    if (current.startsWith(key + '/')) {
      if (bestKey === null || key.length > bestKey.length) bestKey = key;
    }
  }
  if (bestKey === null) return null;
  const newPrefix = mapping.get(bestKey)!;
  return newPrefix + current.slice(bestKey.length);
}
