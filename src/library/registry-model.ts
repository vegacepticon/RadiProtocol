// src/library/registry-model.ts
// Pure wire-format types + guards for the registry HTTP API (D12 — plugin-
// owned, duplicated; no backend workspace exists). Zero Obsidian imports.

import type { CatalogEntry, PackageManifest, ReleaseBundle } from './library-model';
import { isCatalogEntry, isPackageManifest } from './library-model';

/** GET /catalog response body. */
export interface CatalogResponse {
  entries: CatalogEntry[];
  serverTime: string;
}

/** GET /packages/{id}/releases/{ver} response body (maps to ReleaseBundle). */
export interface ReleaseResponse {
  manifest: PackageManifest;
  snippetContents: Array<{ relPath: string; content: string }>;
}

/** Result of fetching a release. Never a throw. */
export type ReleaseFetchResult =
  | { status: 'ok'; bundle: ReleaseBundle }
  | { status: 'not-found'; reason: string }
  | { status: 'unavailable'; reason: string };

/** Result of fetching a release MANIFEST only (Step 5 C8 — trust preview does
 *  not need snippet contents). Never a throw. */
export type ReleaseManifestFetchResult =
  | { status: 'ok'; manifest: PackageManifest }
  | { status: 'not-found'; reason: string }
  | { status: 'unavailable'; reason: string };

export function isCatalogResponse(value: unknown): value is CatalogResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v['entries']) &&
    v['entries'].every((e) => isCatalogEntry(e)) &&
    typeof v['serverTime'] === 'string'
  );
}

export function isReleaseResponse(value: unknown): value is ReleaseResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!isPackageManifest(v['manifest'])) return false;
  if (!Array.isArray(v['snippetContents'])) return false;
  return v['snippetContents'].every((s) => {
    if (typeof s !== 'object' || s === null) return false;
    const sc = s as Record<string, unknown>;
    return typeof sc['relPath'] === 'string' && typeof sc['content'] === 'string';
  });
}
