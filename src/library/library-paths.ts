// src/library/library-paths.ts
// Pure namespace-derivation + path-safety + reference-mapping helpers.
// Zero Obsidian imports (NFR-01). Mirrors assertInsideRoot semantics
// (src/snippets/snippet-service.ts:75-96) made reusable + backslash-rejecting,
// and applyMapping semantics (src/snippets/protocol-ref-sync.ts:119-137) scoped
// to the imported protocol's snippet nodes.

import type { SnippetNode } from '../graph/graph-model';
import type { InstalledRecord } from './library-model';
import { slugifyLabel } from '../snippets/snippet-model';
import { sha256String } from './integrity';

/** Managed subfolder name under both the protocol and snippet roots. */
export const LIBRARY_SUBROOT = 'library';

/**
 * Slugify a package id (or version tag) into a path-safe segment.
 * Step 5 S1: reuses `slugifyLabel` (src/snippets/snippet-model.ts:126-132)
 * rather than duplicating the Unicode-aware slugifier. `slugifyLabel` lowercases,
 * trims, replaces non letter/number runs (\p{L}\p{N}) with '-', and strips edge
 * dashes. Cyrillic preserved. Aliased as `slugifyPackageId` for the library domain.
 */
export const slugifyPackageId = slugifyLabel;

/**
 * Validate that a package id slugifies to a non-empty path segment. The
 * installer MUST call this before deriving namespace paths — an empty slug
 * (e.g. an id of all punctuation) would produce a malformed `library//<ver>`
 * path. Returns the slug on success, null on empty.
 *
 * Collision-check between distinct packageIds that slugify identically is the
 * installer pre-flight's responsibility (D5 — collision-check-and-throw before
 * staging, mirroring renameSnippet at src/snippets/snippet-service.ts:419-421);
 * a pure lossy slug cannot be injective by construction.
 */
export function validPackageSlug(id: string): string | null {
  const slug = slugifyPackageId(id);
  return slug === '' ? null : slug;
}

/** 12 hex = 48 bits of collision space — far beyond any vault's package count.
 *  Matches the display shortHash length (src/views/library-item-detail-modal.ts:159). */
const NAMESPACE_HASH_LENGTH = 12;

/** `slugifyPackageId(rawPackageId) + '-' + firstNHex(sha256String(rawPackageId))`. The
 *  hash is over the RAW packageId (hashing the slug would re-collapse colliding ids).
 *  Path-safe (slug is [a-z0-9-]; hex suffix is [0-9a-f]); passes assertNoTraversal.
 *  Async because sha256String uses Web Crypto. Callers compute ONCE and thread the
 *  resulting string through the synchronous derivation helpers (D1 — no helper newly
 *  becomes async). The version slug needs no hash (immutable release tag). */
export async function packageNamespaceSegment(packageId: string): Promise<string> {
  const slug = slugifyPackageId(packageId);
  const hash = await sha256String(packageId);
  return `${slug}-${hash.slice(0, NAMESPACE_HASH_LENGTH)}`;
}

/**
 * Vault-relative namespace root for a package's installed protocols.
 * `${protocolRoot}/library/<pkgSegment>/<versionSlug>`. Callers precompute both.
 */
export function libraryProtocolNamespace(protocolRoot: string, pkgSegment: string, versionSlug: string): string {
  const seg = `${LIBRARY_SUBROOT}/${pkgSegment}/${versionSlug}`;
  return protocolRoot === '' ? seg : `${protocolRoot}/${seg}`;
}

/**
 * Vault-relative namespace root for a package's installed snippets.
 * `${snippetRoot}/library/<pkgSegment>/<versionSlug>`. Callers precompute both.
 */
export function librarySnippetNamespace(snippetRoot: string, pkgSegment: string, versionSlug: string): string {
  const seg = `${LIBRARY_SUBROOT}/${pkgSegment}/${versionSlug}`;
  return snippetRoot === '' ? seg : `${snippetRoot}/${seg}`;
}

/**
 * Vault-relative path of the installed protocol file inside its namespace.
 * Filename is `<pkgSegment>.rp.json` for determinism (moves in lockstep with
 * the segment). Callers precompute both.
 */
export function libraryProtocolFilePath(protocolRoot: string, pkgSegment: string, versionSlug: string): string {
  return `${libraryProtocolNamespace(protocolRoot, pkgSegment, versionSlug)}/${pkgSegment}.rp.json`;
}

/**
 * Vault-relative path of an installed snippet file inside its namespace.
 * `relPath` is the package-relative, extension-preserving path. Callers precompute both.
 */
export function librarySnippetFilePath(snippetRoot: string, pkgSegment: string, versionSlug: string, relPath: string): string {
  return `${librarySnippetNamespace(snippetRoot, pkgSegment, versionSlug)}/${relPath}`;
}

/**
 * True if `path` is inside the managed library subtree of `root`
 * (`${root}/library/...`). Used by existing views to detect library-managed
 * items and render them read-only (D5). Slash-boundary prefix match.
 */
export function isLibraryManagedPath(path: string, root: string): boolean {
  const libraryFolder = root === '' ? LIBRARY_SUBROOT : `${root}/${LIBRARY_SUBROOT}`;
  return path === libraryFolder || path.startsWith(libraryFolder + '/');
}

/**
 * Pure path-safety gate for a relative path that must stay within a namespace.
 * Mirrors assertInsideRoot (src/snippets/snippet-service.ts:75-96) and ALSO
 * rejects backslashes (assertInsideRoot does not). Returns the normalized
 * path on success, or null on rejection.
 *
 * Rejects: '..' or '.' segments, leading '/' (absolute), any backslash,
 * empty-after-normalization (except the explicit empty-root case).
 */
export function assertNoTraversal(relPath: string): string | null {
  if (relPath === '') return '';
  if (relPath.includes('\\')) return null;
  if (relPath.startsWith('/')) return null;
  const segments = relPath.split('/');
  if (segments.some((s) => s === '..' || s === '.')) return null;
  const normalized = segments.filter((s) => s !== '').join('/');
  if (normalized === '') return null;
  return normalized;
}

/**
 * Pure containment gate: assert `path` is inside `root` (slash-boundary).
 * Reusable extracted form of SnippetService.assertInsideRoot, also rejecting
 * backslashes and absolute paths. Returns the normalized path or null.
 */
export function assertInsideLibraryRoot(path: string, root: string): string | null {
  if (path.includes('\\')) return null;
  if (path.startsWith('/')) return null;
  const segments = path.split('/');
  if (segments.some((s) => s === '..' || s === '.')) return null;
  const normalized = segments.filter((s) => s !== '').join('/');
  const inside = normalized === root || normalized.startsWith(root + '/');
  return inside ? normalized : null;
}

/**
 * Apply an old->new reference mapping to a single path, mirroring applyMapping
 * semantics (src/snippets/protocol-ref-sync.ts:119-137): exact match wins,
 * then `/`-boundary prefix match (longest wins), null = no match. Pure and
 * transaction-scoped — does NOT validate the resulting path (the installer
 * gates that separately via assertNoTraversal).
 */
export function rewriteSnippetRef(current: string, mapping: Map<string, string>): string | null {
  const exact = mapping.get(current);
  if (exact !== undefined) return exact;
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

/**
 * Build the extension-preserving reference mapping for an imported protocol's
 * snippet nodes (D9). Mapping keys are the original root-relative references
 * (extension-preserving — matches the stored .rp.json format); values are the
 * namespace-relative paths under the installed snippet namespace.
 *
 * Returns `{ mapping }` on success, or `{ error }` when a snippet node is
 * root-bound (neither snippetPath nor subfolderPath set) — root-bound nodes
 * cannot be isolated into a namespace and are refused in foundation scope
 * (the package must declare explicit snippetPath/subfolderPath references),
 * or when a reference is traversal-unsafe.
 */
export function buildReferenceMapping(
  pkgSegment: string,
  versionSlug: string,
  snippetNodes: readonly SnippetNode[],
): { mapping: Map<string, string> } | { error: string } {
  const namespaceRel = `${LIBRARY_SUBROOT}/${pkgSegment}/${versionSlug}`;
  const mapping = new Map<string, string>();
  for (const node of snippetNodes) {
    const snippetPath = node.radiprotocol_snippetPath;
    const subfolderPath = node.subfolderPath;
    if (typeof snippetPath === 'string' && snippetPath !== '') {
      const safe = assertNoTraversal(snippetPath);
      if (safe === null) {
        return { error: `library package snippet node has unsafe snippetPath: "${snippetPath}"` };
      }
      mapping.set(safe, `${namespaceRel}/${safe}`);
    } else if (typeof subfolderPath === 'string' && subfolderPath !== '') {
      const safe = assertNoTraversal(subfolderPath);
      if (safe === null) {
        return { error: `library package snippet node has unsafe subfolderPath: "${subfolderPath}"` };
      }
      mapping.set(safe, `${namespaceRel}/${safe}`);
    } else {
      return {
        error: `library package snippet node "${node.id}" is root-bound (no snippetPath or subfolderPath); root-bound snippet nodes are not supported in library packages`,
      };
    }
  }
  return { mapping };
}

/** Find the installed record that owns a vault-relative path (Slice 8).
 *  Matches a protocol's `protocolPath` exactly, or a snippet's
 *  `snippetNamespace` (slash-boundary prefix) — a snippet at
 *  `${namespace}/folder/snippet.md` is owned by the record whose
 *  `snippetNamespace` is `${namespace}`. Returns the record (for the
 *  installed-package indicator label) or null when no installed release
 *  owns the path. Pure — callers pass the current `listInstalled()` result. */
export function findInstalledRecordForPath(
  records: readonly InstalledRecord[],
  path: string,
): InstalledRecord | null {
  for (const r of records) {
    if (r.protocolPath === path) return r;
    if (path === r.snippetNamespace || path.startsWith(r.snippetNamespace + '/')) return r;
  }
  return null;
}
