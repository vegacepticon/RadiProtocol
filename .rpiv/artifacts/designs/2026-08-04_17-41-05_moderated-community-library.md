---
date: 2026-08-04T17:41:05+0300
author: Roman Shulgha
commit: 4ad002c
branch: main
repository: RadiProtocol
topic: "Moderated community library — foundation (read + install)"
tags: [design, library, installer, registry, transactional, cache, integrity, i18n]
status: ready
parent: ".rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md"
last_updated: 2026-08-04T17:41:05+0300
last_updated_by: Roman Shulgha
---

# Design: Moderated Community Library — Foundation (read + install)

## Summary
A new `src/library/` lower layer (pure model + Obsidian-touching services, mirroring `src/snippets/`) provides a transactional stage→verify→commit→rollback installer that stages protocol-plus-snippet bundles into immutable isolated namespaces (`library/<packageId>/<version>/`) under the existing protocol/snippet roots, verifies SHA-256 integrity and graph validity before commit, and uses a manifest-as-commit-marker with a replayable journal for atomic commit and recovery from interrupted installs. A network-injected registry client fetches the official catalog (requestUrl via options-object DI), a remote-cache + installed-record store persist under `.radiprotocol/library/`, and a first-class `LibraryView` ItemView (catalog list + search + item trust-preview + install + installed list) consumes the service. This is the foundation scope: read + install only. Submission wizard, auth, moderation, upgrades, ed25519 signature verification, and reports/takedown are explicitly deferred to follow-up designs.

## Requirements
- Dedicated plugin library view (first-class ItemView + command) for catalog discovery — FRD "Dedicated library view".
- Catalog: search, filters, curated lists; item trust-preview page before download — FRD "Search, filters, curated" + "Full trust preview".
- Dependency-aware transactional installer: stages protocol + snippet bundle, rewrites only imported root-relative references, verifies integrity + compatibility, atomically commits or rolls back — FRD Recommended Approach.
- Immutable signed package registry (plugin client half): download immutable release bytes, verify integrity — FRD "Signed immutable releases" (signature itself deferred; SHA-256 integrity in scope).
- Isolated namespace: `library/<packageId>/<version>/` under existing roots; user content never written into managed namespace — FRD "Isolated namespace".
- Pinned, manual upgrade (side-by-side) — upgrade itself deferred; namespace + records must be forward-compatible with it.
- Offline behavior: local use + cache; catalog snapshot + downloaded bytes cached under `.radiprotocol/library/` — FRD "Local use plus cache".
- Interactive under 2s; WCAG 2.2 AA for the plugin surface (ARIA progressbar, exhaustive state dispatch) — FRD perf + a11y.
- Recovery from interrupted installation on plugin load (manifest-as-commit-marker absence → rollback/cleanup) — developer checkpoint refinement.
- SHA-256 framed as **integrity verification, not publisher authenticity**; UI must not mark unsigned releases as trusted — developer checkpoint refinement.
- en/ru i18n parity: new `library.*` block in both locales + a net-new parity gate — developer checkpoint decision.
- "Catalog unavailable" explicit state when no registry endpoint is configured (no fake domain hard-coded) — developer checkpoint refinement.

## Current State Analysis
The codebase has every pure building block an installer needs but is missing the four load-bearing things this feature requires: a cross-file transaction boundary, a traversal/absolute-path gate on imported references, a remote-cache persistence store, and any network/signature code.

### Key Discoveries
- `ProtocolDocumentV1` is closed by sentinels (`src/protocol/protocol-document.ts:14-17,163-183`); the package/release manifest must WRAP it as a value, not extend it. Extra top-level keys round-trip through storage (`protocol-document-store.ts:76`) but cannot carry distinct identity.
- `ProtocolDocumentStore.update()` reads unmutexed then writes mutexed (`src/protocol/protocol-document-store.ts:84-98`) — lost-update gap; four mutually-unaware `WriteMutex` instances exist (`main.ts:34`, `protocol-document-store.ts:25`, `snippet-service.ts:57`, `protocol-ref-sync.ts:15`). The installer must build its own stage→verify→commit→rollback journal under a new module-level coarse `installMutex` (5th lock domain).
- `GraphValidator` is zero-Obsidian with `snippetFileProbe` as the sole I/O seam (`src/graph/graph-validator.ts:14-22`); inject `(absPath) => stagedFileSet.has(absPath)` with `snippetFolderPath: stagedNamespaceRoot` for byte-identical staged validation — zero validator changes. Production injection site: `src/views/inline-runner-modal.ts:95-99`.
- `applyMapping` (`src/snippets/protocol-ref-sync.ts:119-137`) is the pure, deterministic reference-rewriting core (exact → `/`-boundary prefix → longest → null). The production rewriter `rewriteProtocolSnippetRefs` (`:37-110`) is vault-wide, best-effort, non-atomic — the installer must wrap namespace rewriting inside its transaction, scoped to `kind === 'snippet'` nodes of the imported protocol only.
- Two encoders disagree on `.md`: `toSnippetRelativePath` strips `.md` (`src/snippets/snippet-service.ts:41-46`); `toProtocolRelativePath` keeps it (`src/views/snippet-manager-view.ts:41-46`). The stored `.rp.json` reference format is extension-preserving. Installer mapping keys MUST be extension-preserving to match byte-for-byte.
- `assertInsideRoot` (`src/snippets/snippet-service.ts:75-96`) is the only traversal guard (rejects `..`/`.`/leading `/`, requires `/`-boundary containment) but is `private`, doesn't reject backslashes, and is invoked only by `SnippetService`. The installer adds a traversal/absolute/backslash gate at staging chokepoints; the runtime loader (`snippet-service.ts:558-619`) remains the final backstop.
- No network code in `src/`; `requestUrl` is the canonical Obsidian network API (`node_modules/obsidian/obsidian.d.ts:5270`; `obsidian` is esbuild-external at `esbuild.config.mjs:73-86`). The mock `src/__mocks__/obsidian.ts` has no network stub — a new `requestUrl` stub is added.
- The deleted community library (`2ccc66a`→`6657b8d`, ~2,500 lines) was ONLY a command+modal, never `registerView`, and died of non-integration plus 8 network/path/i18n fixes in 9 days (parent-folder bug `9b4a886`, Cyrillic URL-encoding `e14c5c1`, requestUrl double-encoding `d9c9487`, slugify/transliterate `4891e4e`). The new one must be a first-class ItemView from day one.
- No en/ru parity gate exists; `check:consistency.mjs` never reads locale files; EN fallback (`src/i18n/i18n-service.ts:32-35`) silently masks missing RU keys. Drift happened before (`cb41717` — 37 dead keys in one night).

## Scope

### Building
- `src/library/` lower layer: pure package/release/catalog model, namespace + path-safety + reference-mapping helpers, SHA-256 integrity (Web Crypto), registry client (requestUrl DI), remote-cache store, installed-record store, transaction journal, transactional installer, library service facade.
- `LibraryView` first-class ItemView: catalog list + search/filters + installed list.
- Item trust-preview modal + install progress modal (exhaustive state-machine + ARIA progressbar).
- Existing-views integration: `SnippetManagerView` + protocol editor/picker render library-managed items read-only with an installed-package indicator (runner pickers still discover them).
- `main.ts` wiring: register view, command, construct services, interrupted-install recovery hook on load.
- `settings.ts`: advanced `libraryRegistryUrl` override (empty → bundled default → "catalog unavailable" explicit state).
- `scripts/check-consistency.mjs`: net-new en/ru key-set parity gate.
- `src/__mocks__/obsidian.ts`: `requestUrl` stub.
- `library.*` i18n block in both `en.json` and `ru.json`.

### Not Building
- In-plugin submission wizard (follow-up design: submission).
- Email magic-link auth + session (follow-up design: auth).
- 9-state submission lifecycle UI (follow-up design: submission).
- Moderation/review surface — web dashboard is backend (greenfield, out of scope); plugin-side reports/takedown flow deferred (follow-up design: moderation).
- Upgrade flow (side-by-side install of a new version) — deferred (follow-up design: upgrades). Namespace + records are forward-compatible with it.
- ed25519 publisher signature verification — deferred (follow-up design: signature). SHA-256 integrity is in scope; UI must not mark unsigned releases as trusted.
- Revocation handling UI — deferred (follow-up design: moderation).
- Backend/server/API workspace — fully greenfield, out of scope (research Q10: plugin client only).
- Type-sharing across plugin↔backend — duplicated plugin-owned types now (no backend workspace exists); revisit when backend is built.
- A generic repository abstraction over the three stores — no premature abstraction (developer refinement).

## Decisions

### D1: New `src/library/` lower layer, pure-model + Obsidian-service split
**Ambiguity**: directional confirm. **Decision**: Follow the layer split. Pure model files (`library-model.ts`, `library-paths.ts`, `integrity.ts`, `registry-model.ts`) have zero Obsidian imports; Obsidian-touching files (`registry-client.ts`, stores, `library-installer.ts`, `library-service.ts`) take capabilities via constructor/options injection. Views consume lower layers; lower layers never import views. No unnecessary abstraction where a module has one concrete implementation. Modeled after `src/snippets/` (`snippet-model.ts`/`md-template.ts` pure + `snippet-service.ts` Obsidian) and `src/protocol/` (`protocol-document.ts` pure + `protocol-document-store.ts` Obsidian).

### D2: Network client via options-object DI (requestUrl)
**Ambiguity**: directional confirm. **Decision**: Follow the options-object DI seam. `RegistryClient` takes `options.requestUrl?: typeof import('obsidian').requestUrl` defaulting to the real import in production; `vi.fn()` stub in tests. `options.baseUrl` injectable for tests. Injected dependency limited to the network client/service layer; pure models never import Obsidian. No broader network abstraction unless a second transport is actually needed. Modeled after `GraphValidator.snippetFileProbe` (`src/graph/graph-validator.ts:19,33-36`).

### D3: Separate typed stores under `.radiprotocol/library/`, existing storage dialect
**Ambiguity**: directional confirm. **Decision**: Follow the `WriteMutex.runExclusive` + `ensureFolderPath` + `JSON.stringify(doc,null,2)+'\n'` dialect (`protocol-document-store.ts:67-80`, `snippet-service.ts:251-279`). Three separate typed stores (catalog cache, installed records, transaction journal) under a dedicated `.radiprotocol/library/` vault root. NOT through `ProtocolDocumentStore` (a catalog snapshot isn't `ProtocolDocumentV1`; `read` returns null at `:45-47` and would be misclassified as a user protocol) or `SnippetService` (`assertInsideRoot` rejects outside-root). Missing files = empty initial state; **malformed files produce an explicit recoverable error, not a silent reset** (deliberate departure from `ProtocolDocumentStore` null-on-error). Centralize shared low-level JSON read/write helpers only if duplication becomes meaningful; no generic repository abstraction.

### D4: LibraryView first-class ItemView
**Ambiguity**: directional confirm. **Decision**: Follow the ItemView pattern. `LibraryView extends ItemView` with view-type constant, registered via `registerView` + `addCommand` + `activateLibraryView()` (get-or-create leaf + setViewState-if-new + revealLeaf), generation/mounted guard, 120ms-debounced vault watchers scoped to library-owned storage + the `library/` subtrees (NOT the whole vault). Dispose watchers/timers/pending refresh in `onClose`. View state transient unless a clear user-facing reason to persist. Modeled after `SnippetManagerView` (`src/views/snippet-manager-view.ts:50`, `src/main.ts:217-228`). The deleted library was only a command+modal and died of non-integration — this is the strongest precedent lesson.

### D5: Storage layout — immutable managed namespace under existing roots
**Ambiguity**: genuine (scope-bounded). **Explored**: (A) under existing roots in `library/<id>/<ver>/` with cache under `.radiprotocol/library/`; (B) dedicated `libraryFolderPath` setting; (C) hybrid vault-roots + plugin-data. **Decision**: Option A. Installed protocols → `${protocolFolderPath}/library/<packageId>/<version>/*.rp.json`; installed snippets → `${snippetFolderPath}/library/<packageId>/<version>/*.md`; cache + installed records + transaction journal → `.radiprotocol/library/` (NOT data.json). Managed subtrees are immutable from day one. `SnippetManagerView`/protocol editor exclude or render read-only library-managed items with a clear installed-package indicator; runtime pickers and Runner still discover them. User content never written into `library/`. Uninstall/rollback delete only paths recorded as owned by the installed package. Evidence: runner pickers scan `protocolFolderPath`/`snippetFolderPath` (`protocol-file-resolver.ts:31-36`, `snippet-service.ts:342-365`); `assertInsideRoot` gates snippet I/O (`snippet-service.ts:75-96`).

### D6: Catalog URL — bundled default + advanced override, explicit unavailable state
**Ambiguity**: genuine. **Decision**: Single bundled `DEFAULT_REGISTRY_URL` constant as the authoritative production endpoint; override only in an Advanced settings section (empty → bundled default). Normalize + validate URL once in the registry client; allow only `https:` in production; inject `baseUrl` in tests. Not exposed in the primary settings UI. **Do NOT hard-code `https://registry.radiprotocol.org` unless that domain is provisioned** — until then the bundled default is empty/placeholder and the client returns an explicit "catalog unavailable" state (not a throw). Modeled after the old library's settled behavior (`c636747` — bundle defaults, hide URL).

### D7: Transaction boundary — single global installMutex + per-release commit marker + journal
**Ambiguity**: genuine (advisor-flagged at Slice 4 checkpoint). **Explored**: (A) single global `libraryMutex` singleton with one coarse synthetic key per transaction — advisor-recommended, avoids the `ensureFolderPath` shared-parent-folder check-then-create race that per-package locks would reintroduce (two concurrent installs of `p@1` and `p@2` both `ensureFolderPath` the shared `library/p/` parent); (B) per-package lock `'library-install:'+packageId+'@'+version` plus a second global lock for installed-record writes — more granular but reintroduces the shared-parent race. **Decision**: Option A. A single module-level `installMutex` singleton (5th lock domain) with ONE coarse synthetic key used by every transaction (deadlock-free; no per-package or per-path keys — installs are strictly serialized). All transaction I/O via `app.vault`/`adapter` inside that lock, never through `store.write()`/`snippetService.save()` mid-transaction. Stage→verify→commit→rollback journal under `.radiprotocol/library/transactions/`. The per-release installed-record marker file (D15) is written LAST as the commit marker; its absence = incomplete install = rollback/cleanup trigger on next load (recovery). Atomic commit is logical (verify-everything-before-first-write + per-release-marker-as-commit-marker + replayable journal), since Obsidian's `adapter.write` is single-file truncate+write with no cross-file primitive. Rollback = deterministic `adapter.remove` of only-this-transaction-owned paths (NOT `trashFile`). Evidence: `protocol-document-store.ts:84-98` lost-update gap; `protocol-ref-sync.ts:23-29` non-atomic header; `ensureFolderPath` check-then-create at `src/utils/vault-utils.ts:9`.

### D8: Path-safety gate — reuse `assertInsideRoot` semantics at installer chokepoints
**Ambiguity**: simple (research-decided). **Decision**: Extract/reuse `assertInsideRoot` semantics (`snippet-service.ts:75-96`, the reference implementation) into `library-paths.ts` as a pure `assertNoTraversal`/`assertInsideLibraryRoot` gate that also rejects backslashes. Apply at four chokepoints: before D-04 composition, before `applyMapping`, at staged-document write time, and rely on the runtime loader (`snippet-service.ts:558-619`) as the final backstop. Reject `..`/`.` segments, leading `/` absolute, backslashes. Evidence: `getOptionalString` reads verbatim (`protocol-document-parser.ts:47-50,252-261`); D-04 string-concatenates (`graph-validator.ts:142`).

### D9: Reference rewriting — extension-preserving, transactional, scoped
**Ambiguity**: simple (research-decided). **Decision**: Mapping keys are extension-preserving (match `toProtocolRelativePath` at `snippet-manager-view.ts:41-46`, the stored `.rp.json` format) — NOT extension-stripping (`toSnippetRelativePath`). Reuse `applyMapping` semantics (`protocol-ref-sync.ts:119-137`) scoped to `kind === 'snippet'` nodes of the imported protocol only. Wrapped inside the transaction (NOT the non-transactional `rewriteProtocolSnippetRefs` vault-wide behavior). Mapping: original root-relative reference → namespace-relative path.

### D10: Staged validation — reuse GraphValidator with a staged probe
**Ambiguity**: simple (research-decided). **Decision**: Inject `(absPath) => stagedFileSet.has(absPath)` with `snippetFolderPath: stagedNamespaceRoot` into `new GraphValidator({ snippetFileProbe, snippetFolderPath, t })` and run byte-identical validation against the staged tree before commit — zero changes to the validator. Reusable gates: schema check (`isProtocolDocumentV1`), graph checks (`validator.validate` — never throws). Evidence: `graph-validator.ts:14-22`; test matrix `__tests__/graph-validator.test.ts:339-466` uses fabricated probe maps.

### D11: SHA-256 integrity via Web Crypto (integrity, not authenticity)
**Ambiguity**: scope decision. **Decision**: `integrity.ts` uses `crypto.subtle.digest('SHA-256', bytes)` (Web Crypto, available in the Obsidian renderer and Node 19+ test env). Framed as **integrity verification** — detects byte corruption/tampering relative to the manifest hash, NOT publisher authenticity. UI must NOT mark unsigned releases as trusted; the trust-preview shows "integrity verified" only, never "trusted publisher". ed25519 signature verification is deferred. Manifest records per-file SHA-256 hashes; installer verifies every staged file against the manifest before commit.

### D12: Type sharing — duplicated plugin-owned types
**Ambiguity**: simple (only feasible option). **Decision**: Registry/catalog/manifest types are duplicated in `src/library/registry-model.ts` + `src/library/library-model.ts` (plugin-owned). No backend workspace exists (`tsconfig.json:33` includes only `src/**/*.ts`; no `workspaces` field). Revisit when a backend workspace is built. No parity gate for plugin↔backend drift is meaningful yet.

### D13: en/ru parity gate — net-new check
**Ambiguity**: genuine. **Decision**: Extend `scripts/check-consistency.mjs` (phantom-reference scan pattern at `:76-88`) with an en/ru key-set comparison that fails when keys exist in one locale but not the other. Wire into `npm run check`. Directly protects the new `library.*` block from the `cb41717` drift failure mode.

### D15: Installed records — per-release marker files (supersedes global installed-records.json)
**Ambiguity**: genuine (advisor-flagged at Slice 4 checkpoint). **Explored**: (A) per-release marker file at `.radiprotocol/library/installed/<packageIdSlug>/<versionSlug>.json` written LAST by the installer — advisor-recommended, a true per-release commit marker whose presence+validity IS the commit signal (recovery = read one file, no scan); (B) single global `installed-records.json` (original Slice 3 design) — no slice reopening, but the single-file manifest-as-commit-marker conflates "records index written" with "release fully committed" and forces recovery to parse the whole index to decide. **Decision**: Option A. `InstalledRecord` becomes a per-release schema-versioned document with its own `schema: 'radiprotocol.installed-record'` + `version: 1` sentinels (self-describing, like `CatalogSnapshot`/`PackageManifest`). `InstalledRecordsDocument` + `isInstalledRecordsDocument` + `INSTALLED_RECORDS_SCHEMA`/`INSTALLED_RECORDS_VERSION` are removed. `InstalledRecordStore` becomes `read(packageId, version)` / `list()` / `write(record)` / `delete(packageId, version)` over per-release files (read/write/delete a single file; `list()` enumerates `.radiprotocol/library/installed/` and validates each). This is a **cascade revision of locked Slices 1 & 3** (recorded in Design History); read-modify-write atomicity over the index is no longer needed because there is no shared index — each release owns one file. Evidence: per-file atomicity matches Obsidian's single-file `adapter.write`; recovery reads exactly the marker file for the interrupted `(packageId, version)`.

### D16: Storage root spelling — `.radiprotocol/library/`
**Ambiguity**: directional confirm. **Decision**: `.radiprotocol/library/` — matches the existing schema prefix `radiprotocol.protocol` (`src/protocol/protocol-document.ts:14`) and is already used throughout locked Slices 1–3. NOT `.radioprotocol/library/` (no full-name spelling). Confirmed at the Slice 4 checkpoint.

### D14: Manifest wraps ProtocolDocumentV1 (forward-compatible, no speculative fields)
**Ambiguety**: simple (research-decided). **Decision**: `PackageManifest` contains `ProtocolDocumentV1` as a value plus minimal foundation fields: `packageId`, `releaseVersion` (immutable release tag), `protocolDoc`, `snippetFiles: Array<{ relPath, sha256 }>`, `author?: { displayName }`, `catalogEntryId`, `publishedAt`. Forward-compatible shape for submission/upgrade/signature (reserved optional fields are NOT added now — no speculative abstractions). `isPackageManifest` guard checks sentinels `schema: 'radiprotocol.package'`, `version: 1`, AND validates the wrapped `protocolDoc` via `isProtocolDocumentV1` (shape-only, by repo convention — deep node validation is the parser's job, run by the Slice 4 installer). Schema compatibility = binary equality against `PROTOCOL_VERSION` + `ProtocolDocumentParser.parse()` succeeding on the wrapped doc.

## Architecture

### src/library/library-model.ts — NEW
```typescript
// src/library/library-model.ts
// Pure package/release/catalog model for the community library.
// Zero Obsidian imports (NFR-01). The package manifest WRAPS ProtocolDocumentV1
// as a value (isProtocolDocumentV1 rejects extra sentinels — see
// src/protocol/protocol-document.ts:163-183), never extends it.

import { isProtocolDocumentV1, type ProtocolDocumentV1 } from '../protocol/protocol-document';

/** Canonical schema identifier for a library package manifest. */
export const PACKAGE_MANIFEST_SCHEMA = 'radiprotocol.package' as const;
/** Current package manifest schema version. */
export const PACKAGE_MANIFEST_VERSION = 1 as const;

/** Canonical schema identifier for an installed-release record (per-release document — D15).
 *  One record file per installed release at
 *  `.radiprotocol/library/installed/<packageIdSlug>/<versionSlug>.json`; the
 *  record file's presence + validity IS the install commit marker (D7). */
export const INSTALLED_RECORD_SCHEMA = 'radiprotocol.installed-record' as const;
export const INSTALLED_RECORD_VERSION = 1 as const;

/** Canonical schema identifier for a cached catalog snapshot. */
export const CATALOG_SNAPSHOT_SCHEMA = 'radiprotocol.catalog' as const;
export const CATALOG_SNAPSHOT_VERSION = 1 as const;

/**
 * A snippet file carried by a package, with its integrity hash. `relPath` is
 * relative to the package's snippet namespace (extension-preserving, matching
 * the stored .rp.json reference format — see src/views/snippet-manager-view.ts:41-46).
 */
export interface PackageSnippetFile {
  /** Snippet-root-relative path, extension kept (e.g. 'folder/snippet.md'). */
  relPath: string;
  /** SHA-256 hex of the snippet file's UTF-8 bytes. */
  sha256: string;
}

/**
 * A library package release manifest. WRAPS ProtocolDocumentV1 as a value
 * (D14) — the manifest carries identity/release/provenance/hashes that
 * ProtocolDocumentV1 has no slot for. Forward-compatible with submission,
 * upgrade, and signature features, but contains NO speculative fields for
 * them (developer refinement).
 */
export interface PackageManifest {
  readonly schema: typeof PACKAGE_MANIFEST_SCHEMA;
  readonly version: typeof PACKAGE_MANIFEST_VERSION;
  /** Server-controlled opaque package identifier. */
  packageId: string;
  /** Server-controlled immutable release tag (e.g. '1.0.0'). */
  releaseVersion: string;
  /** The wrapped protocol document (validated by isProtocolDocumentV1 in isPackageManifest). */
  protocolDoc: ProtocolDocumentV1;
  /** SHA-256 hex of the canonical JSON of `protocolDoc` (pretty + trailing newline). */
  protocolSha256: string;
  /** Snippet files included in the package, with integrity hashes. */
  snippetFiles: PackageSnippetFile[];
  /** Catalog entry id this release belongs to. */
  catalogEntryId: string;
  /** Author display info (no auth identity in foundation scope). */
  author?: { displayName: string };
  /** ISO 8601 timestamp the release was published server-side. */
  publishedAt: string;
}

/** A catalog list entry (search/discovery surface). */
export interface CatalogEntry {
  packageId: string;
  title: string;
  description: string;
  author: { displayName: string };
  /** Latest immutable release tag available. */
  latestVersion: string;
  categories: string[];
  /** ISO 8601 of the latest release. */
  updatedAt: string;
  summary?: string;
}

/**
 * Cached catalog snapshot. Persisted under .radiprotocol/library/ so offline
 * use serves the last-good list.
 */
export interface CatalogSnapshot {
  readonly schema: typeof CATALOG_SNAPSHOT_SCHEMA;
  readonly version: typeof CATALOG_SNAPSHOT_VERSION;
  /** ISO 8601 timestamp the snapshot was fetched. */
  fetchedAt: string;
  entries: CatalogEntry[];
}

/**
 * Result of fetching the catalog. `unavailable` is the explicit "catalog
 * unavailable" state (no endpoint configured, network failure, non-https
 * rejected) — NEVER a throw (D6). `cachedSnapshot` carries the last-good
 * snapshot when one exists.
 */
export type CatalogFetchResult =
  | { status: 'ok'; snapshot: CatalogSnapshot }
  | { status: 'unavailable'; reason: string; cachedSnapshot: CatalogSnapshot | null };

/**
 * An installed release record — persisted as a per-release schema-versioned
 * document (D15). One file per installed release at
 * `.radiprotocol/library/installed/<packageIdSlug>/<versionSlug>.json`; the
 * file's presence + validity IS the install commit marker (D7 — written LAST
 * by the installer; absence after an interrupt = incomplete install =
 * rollback/cleanup trigger on next load). `snippetFiles`/`protocolPath` are
 * the ONLY paths uninstall/rollback may delete (D5 — delete only owned paths).
 */
export interface InstalledRecord {
  readonly schema: typeof INSTALLED_RECORD_SCHEMA;
  readonly version: typeof INSTALLED_RECORD_VERSION;
  packageId: string;
  releaseVersion: string;
  /** ISO 8601 install timestamp. */
  installedAt: string;
  /** Vault-relative path of the installed protocol file. */
  protocolPath: string;
  /** Vault-relative root of the installed snippet namespace. */
  snippetNamespace: string;
  /** Snippet files owned by this install (namespace-relative + hash). */
  snippetFiles: PackageSnippetFile[];
  /** SHA-256 of the installed protocol document. */
  protocolSha256: string;
  author?: { displayName: string };
}

/**
 * A downloaded release bundle ready to stage. The manifest carries the
 * protocol document and all hashes; `snippetContents` carries the bytes.
 */
export interface ReleaseBundle {
  manifest: PackageManifest;
  /** Snippet file contents keyed by `PackageSnippetFile.relPath`. */
  snippetContents: Array<{ relPath: string; content: string }>;
}

/**
 * Explicit recoverable store error (D3 — malformed files produce an explicit
 * error, never a silent reset). Thrown by the library stores on parse/schema
 * failure; missing files are an empty initial state, NOT this error.
 */
export class LibraryStoreError extends Error {
  readonly kind: 'malformed' | 'write-failed' | 'read-failed';
  readonly path: string;
  constructor(kind: LibraryStoreError['kind'], path: string, message: string) {
    super(`[RadiProtocol] library store ${kind} at ${path}: ${message}`);
    this.name = 'LibraryStoreError';
    this.kind = kind;
    this.path = path;
  }
}

/** Shape guard for a PackageSnippetFile entry. */
function isPackageSnippetFile(value: unknown): value is PackageSnippetFile {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as Record<string, unknown>;
  return typeof f['relPath'] === 'string' && typeof f['sha256'] === 'string';
}

/** Validate an optional author display object. */
function isOptionalAuthor(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Record<string, unknown>)['displayName'] === 'string';
}

/** Validate an optional string field. */
function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

/** Shape guard for PackageManifest (sentinel + structural + wrapped-doc validity + element soundness). */
export function isPackageManifest(value: unknown): value is PackageManifest {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v['schema'] === PACKAGE_MANIFEST_SCHEMA &&
    v['version'] === PACKAGE_MANIFEST_VERSION &&
    typeof v['packageId'] === 'string' &&
    typeof v['releaseVersion'] === 'string' &&
    isProtocolDocumentV1(v['protocolDoc']) &&
    typeof v['protocolSha256'] === 'string' &&
    Array.isArray(v['snippetFiles']) &&
    v['snippetFiles'].every((f) => isPackageSnippetFile(f)) &&
    typeof v['catalogEntryId'] === 'string' &&
    typeof v['publishedAt'] === 'string' &&
    isOptionalAuthor(v['author'])
  );
}

/** Shape guard for CatalogEntry (author required; categories + summary element-validated). */
export function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const author = v['author'];
  const authorOk =
    typeof author === 'object' &&
    author !== null &&
    typeof (author as Record<string, unknown>)['displayName'] === 'string';
  return (
    typeof v['packageId'] === 'string' &&
    typeof v['title'] === 'string' &&
    typeof v['description'] === 'string' &&
    typeof v['latestVersion'] === 'string' &&
    Array.isArray(v['categories']) &&
    v['categories'].every((c) => typeof c === 'string') &&
    typeof v['updatedAt'] === 'string' &&
    isOptionalString(v['summary']) &&
    authorOk
  );
}

/** Shape guard for an InstalledRecord (per-release document — D15). Validates the
 *  schema + version sentinels, all required fields, snippetFiles elements, and
 *  the optional author. Used by InstalledRecordStore.read/list and by the
 *  Slice 4 installer to confirm a commit marker is valid during recovery. */
export function isInstalledRecord(value: unknown): value is InstalledRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    r['schema'] === INSTALLED_RECORD_SCHEMA &&
    r['version'] === INSTALLED_RECORD_VERSION &&
    typeof r['packageId'] === 'string' &&
    typeof r['releaseVersion'] === 'string' &&
    typeof r['installedAt'] === 'string' &&
    typeof r['protocolPath'] === 'string' &&
    typeof r['snippetNamespace'] === 'string' &&
    Array.isArray(r['snippetFiles']) &&
    r['snippetFiles'].every((f) => isPackageSnippetFile(f)) &&
    typeof r['protocolSha256'] === 'string' &&
    isOptionalAuthor(r['author'])
  );
}

/** Shape guard for CatalogSnapshot (entries element-validated via isCatalogEntry). */
export function isCatalogSnapshot(value: unknown): value is CatalogSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v['schema'] === CATALOG_SNAPSHOT_SCHEMA &&
    v['version'] === CATALOG_SNAPSHOT_VERSION &&
    typeof v['fetchedAt'] === 'string' &&
    Array.isArray(v['entries']) &&
    v['entries'].every((e) => isCatalogEntry(e))
  );
}
```

### src/library/library-paths.ts — NEW
```typescript
// src/library/library-paths.ts
// Pure namespace-derivation + path-safety + reference-mapping helpers.
// Zero Obsidian imports (NFR-01). Mirrors assertInsideRoot semantics
// (src/snippets/snippet-service.ts:75-96) made reusable + backslash-rejecting,
// and applyMapping semantics (src/snippets/protocol-ref-sync.ts:119-137) scoped
// to the imported protocol's snippet nodes.

import type { SnippetNode } from '../graph/graph-model';
import type { InstalledRecord } from './library-model';

/** Managed subfolder name under both the protocol and snippet roots. */
export const LIBRARY_SUBROOT = 'library';

/**
 * Slugify a package id (or version tag) into a path-safe segment.
 * Mirrors slugifyLabel (src/snippets/snippet-model.ts:126-132): lowercase,
 * trim, non letter/number runs (Unicode-aware \p{L}\p{N}) -> '-', strip edge
 * dashes. Cyrillic preserved.
 */
export function slugifyPackageId(id: string): string {
  return id
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

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

/**
 * Vault-relative namespace root for a package's installed protocols.
 * `${protocolRoot}/library/<packageIdSlug>/<versionSlug>`.
 */
export function libraryProtocolNamespace(protocolRoot: string, packageId: string, version: string): string {
  const seg = `${LIBRARY_SUBROOT}/${slugifyPackageId(packageId)}/${slugifyPackageId(version)}`;
  return protocolRoot === '' ? seg : `${protocolRoot}/${seg}`;
}

/**
 * Vault-relative namespace root for a package's installed snippets.
 * `${snippetRoot}/library/<packageIdSlug>/<versionSlug>`.
 */
export function librarySnippetNamespace(snippetRoot: string, packageId: string, version: string): string {
  const seg = `${LIBRARY_SUBROOT}/${slugifyPackageId(packageId)}/${slugifyPackageId(version)}`;
  return snippetRoot === '' ? seg : `${snippetRoot}/${seg}`;
}

/**
 * Vault-relative path of the installed protocol file inside its namespace.
 * Filename is `<packageIdSlug>.rp.json` for determinism.
 */
export function libraryProtocolFilePath(protocolRoot: string, packageId: string, version: string): string {
  return `${libraryProtocolNamespace(protocolRoot, packageId, version)}/${slugifyPackageId(packageId)}.rp.json`;
}

/**
 * Vault-relative path of an installed snippet file inside its namespace.
 * `relPath` is the package-relative, extension-preserving path.
 */
export function librarySnippetFilePath(snippetRoot: string, packageId: string, version: string, relPath: string): string {
  return `${librarySnippetNamespace(snippetRoot, packageId, version)}/${relPath}`;
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
  packageId: string,
  version: string,
  snippetNodes: readonly SnippetNode[],
): { mapping: Map<string, string> } | { error: string } {
  const namespaceRel = `${LIBRARY_SUBROOT}/${slugifyPackageId(packageId)}/${slugifyPackageId(version)}`;
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
```

### src/library/integrity.ts — NEW
```typescript
// src/library/integrity.ts
// Pure SHA-256 integrity helpers via Web Crypto (globalThis.crypto.subtle).
// Zero Obsidian imports (NFR-01). Framed as INTEGRITY verification (detects
// byte corruption/tampering relative to a manifest hash), NOT publisher
// authenticity — ed25519 signature verification is deferred (D11). The UI
// must never mark unsigned releases as trusted.

/** Hex-encode an ArrayBuffer to a lowercase SHA-256 hex string. */
function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (s === undefined) {
    throw new Error('[RadiProtocol] Web Crypto subtle.digest unavailable — cannot compute SHA-256');
  }
  return s;
}

/**
 * Compute the SHA-256 hex of a string's UTF-8 bytes.
 * Throws a plain Error if Web Crypto is unavailable (environment misconfig).
 */
export async function sha256String(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await subtle().digest('SHA-256', bytes);
  return toHex(digest as ArrayBuffer);
}

/**
 * Compute the SHA-256 hex of arbitrary bytes (ArrayBuffer or Uint8Array).
 * Copy-constructs a fresh Uint8Array<ArrayBuffer> so the value satisfies the
 * strict lib.dom BufferSource (ArrayBufferView<ArrayBuffer>) typing.
 */
export async function sha256Bytes(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const view =
    bytes instanceof Uint8Array
      ? new Uint8Array(bytes)
      : new Uint8Array(bytes);
  const digest = await subtle().digest('SHA-256', view);
  return toHex(digest as ArrayBuffer);
}

/**
 * Verify a content string's integrity against an expected SHA-256 hex.
 * Returns true on match, false on mismatch. NEVER throws on mismatch —
 * integrity failure is a recoverable install error, not an exception.
 * Throws only if Web Crypto is unavailable (environment misconfiguration).
 */
export async function verifyIntegrity(content: string, expectedSha256: string): Promise<boolean> {
  const actual = await sha256String(content);
  return actual.toLowerCase() === expectedSha256.toLowerCase();
}
```

### src/library/registry-model.ts — NEW
```typescript
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
```

### src/library/registry-client.ts — NEW
```typescript
// src/library/registry-client.ts
// Network client for the official library catalog + release downloads.
// Obsidian-touching ONLY via the injected requestUrl (D2) — imports
// `requestUrl` from 'obsidian' as the production default but never touches the
// vault. `obsidian` is esbuild-external (esbuild.config.mjs) so the import
// resolves at runtime inside the app. Tests inject a vi.fn() stub.

import { requestUrl as obsidianRequestUrl } from 'obsidian';
import {
  CATALOG_SNAPSHOT_SCHEMA, CATALOG_SNAPSHOT_VERSION,
  type CatalogFetchResult, type CatalogSnapshot, type ReleaseBundle,
} from './library-model';
import { isCatalogResponse, isReleaseResponse, type ReleaseFetchResult } from './registry-model';

/**
 * Bundled authoritative production endpoint. EMPTY until the official registry
 * domain is provisioned (D6) — the client returns an explicit "catalog
 * unavailable" state when no endpoint is configured, never a throw. Do NOT
 * hard-code an unprovisioned domain.
 */
export const DEFAULT_REGISTRY_URL = '';

/** Extract a message from an unknown rejection WITHOUT ever throwing. Captures
 *  `e.message` with a SINGLE read (a stateful getter cannot TOCTOU between a
 *  typeof check and a return). Returns a string on every path. */
function safeErrorMessage(e: unknown): string {
  try {
    if (e instanceof Error) {
      const m = e.message;
      if (typeof m === 'string') return m;
    }
    return String(e);
  } catch {
    return 'unknown error';
  }
}

export interface RegistryClientOptions {
  /** Injectable network transport (D2). Defaults to the real Obsidian requestUrl. */
  requestUrl?: typeof obsidianRequestUrl;
  /** Base URL of the registry. Empty/undefined → DEFAULT_REGISTRY_URL → unavailable. */
  baseUrl?: string;
  /** Require https: scheme in production. Defaults true. */
  httpsOnly?: boolean;
}

/**
 * Normalize + validate a registry base URL. Returns '' when no endpoint is
 * configured (empty), the URL is invalid, or (in production) the scheme is not
 * https. Strips trailing slashes for clean path composition.
 */
export function normalizeRegistryUrl(url: string | undefined, httpsOnly = true): string {
  const trimmed = (url ?? '').trim();
  if (trimmed === '') return '';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return '';
  }
  if (httpsOnly && parsed.protocol !== 'https:') return '';
  return trimmed.replace(/\/+$/, '');
}

export class RegistryClient {
  private readonly requestUrl: typeof obsidianRequestUrl;
  private readonly baseUrl: string;

  constructor(options: RegistryClientOptions = {}) {
    this.requestUrl = options.requestUrl ?? obsidianRequestUrl;
    this.baseUrl = normalizeRegistryUrl(
      options.baseUrl ?? DEFAULT_REGISTRY_URL,
      options.httpsOnly ?? true,
    );
  }

  /** True when no usable endpoint is configured. */
  isUnavailable(): boolean {
    return this.baseUrl === '';
  }

  /**
   * Fetch the catalog. Returns an explicit `unavailable` state (never a throw)
   * when no endpoint is configured, the URL is invalid, the network fails, or
   * the response is malformed. `cachedSnapshot` is always null here — the
   * caller (LibraryService) merges with the cached snapshot from the cache store.
   */
  async fetchCatalog(): Promise<CatalogFetchResult> {
    if (this.isUnavailable()) {
      return { status: 'unavailable', reason: 'no registry endpoint configured', cachedSnapshot: null };
    }
    try {
      const res = await this.requestUrl({ url: `${this.baseUrl}/catalog`, method: 'GET', throw: false });
      const body = res.json;
      if (!isCatalogResponse(body)) {
        return { status: 'unavailable', reason: 'malformed catalog response', cachedSnapshot: null };
      }
      const snapshot: CatalogSnapshot = {
        schema: CATALOG_SNAPSHOT_SCHEMA,
        version: CATALOG_SNAPSHOT_VERSION,
        fetchedAt: new Date().toISOString(),
        entries: body.entries,
      };
      return { status: 'ok', snapshot };
    } catch (e) {
      return { status: 'unavailable', reason: `catalog fetch failed: ${safeErrorMessage(e)}`, cachedSnapshot: null };
    }
  }

  /**
   * Fetch a specific release bundle. Returns `ok`, `not-found`, or `unavailable`
   * (never a throw). 404 → not-found; network error → unavailable; malformed → unavailable.
   * packageId and version are URL-encoded per path segment (precedent: e14c5c1 —
   * raw.githubusercontent rejects unencoded non-ASCII). URL composition lives
   * inside the try so a lone-surrogate URIError is caught, not thrown.
   */
  async fetchRelease(packageId: string, version: string): Promise<ReleaseFetchResult> {
    if (this.isUnavailable()) {
      return { status: 'unavailable', reason: 'no registry endpoint configured' };
    }
    try {
      const url = `${this.baseUrl}/packages/${encodeURIComponent(packageId)}/releases/${encodeURIComponent(version)}`;
      const res = await this.requestUrl({ url, method: 'GET', throw: false });
      if (res.status === 404) {
        return { status: 'not-found', reason: `release ${packageId}@${version} not found` };
      }
      const body = res.json;
      if (!isReleaseResponse(body)) {
        return { status: 'unavailable', reason: 'malformed release response' };
      }
      const bundle: ReleaseBundle = { manifest: body.manifest, snippetContents: body.snippetContents };
      return { status: 'ok', bundle };
    } catch (e) {
      return { status: 'unavailable', reason: `release fetch failed: ${safeErrorMessage(e)}` };
    }
  }
}
```

### src/library/library-json-io.ts — NEW
```typescript
// src/library/library-json-io.ts
// Shared low-level JSON vault I/O helpers for the library stores (D3).
// NOT a generic repository — just the WriteMutex + ensureFolderPath + pretty-
// JSON dialect factored out so the cache/record/journal stores don't triplicate
// it. Vault is a type-only import (NFR-01).

import type { Vault } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
import { ensureFolderPath } from '../utils/vault-utils';
import { LibraryStoreError } from './library-model';

/** Extract a message from an unknown rejection WITHOUT ever throwing. Single
 *  read of e.message; returns a string on every path. */
export function safeErrorMessage(e: unknown): string {
  try {
    if (e instanceof Error) {
      const m = e.message;
      if (typeof m === 'string') return m;
    }
    return String(e);
  } catch {
    return 'unknown error';
  }
}

/**
 * Read + parse a JSON file with a shape guard. Missing file → null (empty
 * initial state). Malformed JSON or failed schema → throws LibraryStoreError
 * (explicit recoverable error, never a silent reset — D3). Does NOT take a
 * mutex — callers composing read-modify-write must hold their own lock
 * (D7 — the installer/service owns the transaction boundary).
 */
export async function readJsonFile<T>(
  vault: Vault,
  path: string,
  guard: (value: unknown) => value is T,
  label: string,
): Promise<T | null> {
  const exists = await vault.adapter.exists(path);
  if (!exists) return null;
  let raw: string;
  try {
    raw = await vault.adapter.read(path);
  } catch (e) {
    throw new LibraryStoreError('read-failed', path, safeErrorMessage(e));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new LibraryStoreError('malformed', path, `invalid JSON in ${label}: ${safeErrorMessage(e)}`);
  }
  if (!guard(parsed)) {
    throw new LibraryStoreError('malformed', path, `invalid ${label} schema`);
  }
  return parsed;
}

/**
 * Write a value as pretty JSON + trailing newline under a per-path mutex,
 * ensuring the parent folder exists first (D3 dialect — mirrors
 * ProtocolDocumentStore.write at src/protocol/protocol-document-store.ts:67-80).
 */
export async function writeJsonFile(
  vault: Vault,
  mutex: WriteMutex,
  path: string,
  parentDir: string,
  value: unknown,
): Promise<void> {
  await mutex.runExclusive(path, async () => {
    await ensureFolderPath(vault, parentDir);
    const payload = JSON.stringify(value, null, 2) + '\n';
    await vault.adapter.write(path, payload);
  });
}
```

### src/library/library-cache-store.ts — NEW
```typescript
// src/library/library-cache-store.ts
// Persisted cache for the catalog snapshot (D3 — separate typed store under
// .radiprotocol/library/, NOT through the existing protocol or snippet stores).
import type { App } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
import { isCatalogSnapshot, type CatalogSnapshot } from './library-model';
import { readJsonFile, writeJsonFile } from './library-json-io';

const CACHE_DIR = '.radiprotocol/library';
const CACHE_FILE = `${CACHE_DIR}/catalog-cache.json`;

export class LibraryCacheStore {
  private readonly app: App;
  private readonly mutex = new WriteMutex();
  constructor(app: App) { this.app = app; }

  /** Read the cached catalog snapshot. Missing file → null (empty initial state).
   *  Malformed file → throws LibraryStoreError (D3). */
  async readSnapshot(): Promise<CatalogSnapshot | null> {
    return readJsonFile(this.app.vault, CACHE_FILE, isCatalogSnapshot, 'catalog snapshot');
  }

  /** Persist a catalog snapshot (pretty JSON + trailing newline, mutex-protected). */
  async writeSnapshot(snapshot: CatalogSnapshot): Promise<void> {
    await writeJsonFile(this.app.vault, this.mutex, CACHE_FILE, CACHE_DIR, snapshot);
  }
}
```

### src/library/installed-record-store.ts — NEW
```typescript
// src/library/installed-record-store.ts
// Persisted installed-release records (D3 — separate typed store under
// .radiprotocol/library/). D15: ONE record file per installed release at
// .radiprotocol/library/installed/<packageIdSlug>/<versionSlug>.json; the file's
// presence + validity IS the install commit marker (D7 — written LAST by the
// installer). There is NO shared index document, so read-modify-write
// atomicity over an index is no longer needed (each release owns one file).
// The store exposes per-file read/list/write/delete; the installer/service
// owns the transaction boundary under the single global installMutex (D7).
import type { App } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
import { slugifyPackageId } from './library-paths';
import {
  isInstalledRecord, LibraryStoreError, type InstalledRecord,
} from './library-model';
import { readJsonFile, writeJsonFile, safeErrorMessage } from './library-json-io';

const INSTALLED_DIR = '.radiprotocol/library/installed';

/** Vault-relative path of the per-release record file (D15). */
export function installedRecordPath(packageId: string, version: string): string {
  return `${INSTALLED_DIR}/${slugifyPackageId(packageId)}/${slugifyPackageId(version)}.json`;
}

export class InstalledRecordStore {
  private readonly app: App;
  private readonly mutex = new WriteMutex();
  constructor(app: App) { this.app = app; }

  /** Read one installed-release record by (packageId, version). Missing file
   *  → null (not installed). Malformed JSON/schema → throws LibraryStoreError
   *  (D3). A structurally-valid record whose embedded `packageId`/`releaseVersion`
   *  disagree with the requested path is a malformed marker → throws
   *  LibraryStoreError('malformed') (D15 marker identity — the file at slot
   *  (packageId, version) must carry matching identity fields). */
  async read(packageId: string, version: string): Promise<InstalledRecord | null> {
    const path = installedRecordPath(packageId, version);
    const record = await readJsonFile(this.app.vault, path, isInstalledRecord, 'installed record');
    if (record === null) return null;
    if (record.packageId !== packageId || record.releaseVersion !== version) {
      throw new LibraryStoreError(
        'malformed', path,
        `record identity mismatch: path expects ${packageId}@${version} but record carries ${record.packageId}@${record.releaseVersion}`,
      );
    }
    return record;
  }

  /** List all installed-release records. Recursively enumerates
   *  `.radiprotocol/library/installed/` (adapter.list is non-recursive — mirrors
   *  the queue-walk in src/snippets/snippet-service.ts:350-365). Returns [] when
   *  the directory is absent (empty initial state).
   *
   *  Error handling (D3 + D15): directory enumeration (`adapter.list`) and
   *  single-file read (`adapter.read`) failures are OPERATIONAL I/O errors —
   *  they surface as `LibraryStoreError('read-failed')` (explicit recoverable
   *  error, never a silent reset — D3). Only JSON corruption or a failed shape
   *  guard on a single record is SKIPPED (D15 per-file isolation: one bad record
   *  does not poison the whole list). This is the deliberate asymmetry with
   *  read(), which throws on a malformed single file (authoritative single-read
   *  vs best-effort discovery enumeration). */
  async list(): Promise<InstalledRecord[]> {
    const adapter = this.app.vault.adapter;
    const dirExists = await adapter.exists(INSTALLED_DIR);
    if (!dirExists) return [];
    const records: InstalledRecord[] = [];
    const queue: string[] = [INSTALLED_DIR];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      let listing: { files: string[]; folders: string[] };
      try {
        listing = await adapter.list(current);
      } catch (e) {
        throw new LibraryStoreError('read-failed', current, `failed to list installed records: ${safeErrorMessage(e)}`);
      }
      for (const file of listing.files) {
        let raw: string;
        try {
          raw = await adapter.read(file);
        } catch (e) {
          throw new LibraryStoreError('read-failed', file, `failed to read installed record: ${safeErrorMessage(e)}`);
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue; // corrupt JSON — D15 per-file isolation (skip, do not throw)
        }
        if (!isInstalledRecord(parsed)) continue; // wrong schema — skip (per-file isolation)
        records.push(parsed);
      }
      for (const sub of listing.folders) queue.push(sub);
    }
    return records;
  }

  /** Persist one installed-release record (the commit marker — written LAST by
   *  the installer under the global installMutex, D7/D15). Pretty JSON + trailing
   *  newline, mutex-protected, parent folder ensured. */
  async write(record: InstalledRecord): Promise<void> {
    const path = installedRecordPath(record.packageId, record.releaseVersion);
    const parentDir = path.slice(0, path.lastIndexOf('/'));
    await writeJsonFile(this.app.vault, this.mutex, path, parentDir, record);
  }

  /** Delete one installed-release record file (uninstall). Missing file is a no-op. */
  async delete(packageId: string, version: string): Promise<void> {
    const path = installedRecordPath(packageId, version);
    const exists = await this.app.vault.adapter.exists(path);
    if (exists) await this.app.vault.adapter.remove(path);
  }
}
```

### src/library/transaction-journal.ts — NEW
```typescript
// src/library/transaction-journal.ts
// Stage→verify→commit→rollback journal under .radiprotocol/library/transactions/
// (D7). Written BEFORE any final-path write so an interrupted install can be
// rolled back deterministically: the journal records every owned path the
// transaction will create plus the per-release marker path (the marker entry
// is LAST → its presence = commit).
//
// Recovery (run on plugin load, orchestrated by LibraryInstaller.recoverInterrupted):
// for each in-flight journal, read the marker at its recorded path — marker
// present+valid+identity-matches → install committed, remove the journal only;
// marker absent/invalid → install incomplete, remove every journal entry path
// deepest-first, then the journal itself.
//
// Obsidian-touching via app.vault/adapter only. The installer holds the single
// global installMutex (D7) across all journal + final-path I/O; this module
// passes the caller-supplied mutex to writeJsonFile and owns no separate lock.

import type { App } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
import { slugifyPackageId } from './library-paths';
import { readJsonFile, writeJsonFile, safeErrorMessage } from './library-json-io';
import { LibraryStoreError } from './library-model';

export const TRANSACTIONS_SCHEMA = 'radiprotocol.transaction-journal' as const;
export const TRANSACTIONS_VERSION = 1 as const;

const TRANSACTIONS_DIR = '.radiprotocol/library/transactions';

/** A single planned write in the journal. */
export interface JournalEntry {
  /** Vault-relative path the transaction will create. */
  path: string;
  /** 'owned' = a final-path write the transaction owns (rollback may delete it).
   *  'marker' = the per-release commit marker (written LAST; presence = commit). */
  kind: 'owned' | 'marker';
}

/** The journal document — one per in-flight (packageId, version) transaction. */
export interface TransactionJournal {
  readonly schema: typeof TRANSACTIONS_SCHEMA;
  readonly version: typeof TRANSACTIONS_VERSION;
  packageId: string;
  releaseVersion: string;
  /** ISO 8601 start timestamp. */
  startedAt: string;
  /** All paths the transaction plans to write, in commit order. The marker
   *  entry MUST be last (it is written last → its presence is the commit signal). */
  entries: JournalEntry[];
}

export function isTransactionJournal(value: unknown): value is TransactionJournal {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v['schema'] !== TRANSACTIONS_SCHEMA) return false;
  if (v['version'] !== TRANSACTIONS_VERSION) return false;
  if (typeof v['packageId'] !== 'string') return false;
  if (typeof v['releaseVersion'] !== 'string') return false;
  if (typeof v['startedAt'] !== 'string') return false;
  if (!Array.isArray(v['entries'])) return false;
  return v['entries'].every((e) => {
    if (typeof e !== 'object' || e === null) return false;
    const je = e as Record<string, unknown>;
    return typeof je['path'] === 'string' && (je['kind'] === 'owned' || je['kind'] === 'marker');
  });
}

/** Vault-relative journal file path for an in-flight (packageId, version). */
export function transactionJournalPath(packageId: string, version: string): string {
  return `${TRANSACTIONS_DIR}/${slugifyPackageId(packageId)}@${slugifyPackageId(version)}.json`;
}

/** Typed wrapper around the journal file. The installer calls these under the
 *  single global installMutex (D7); this module passes the caller's mutex to
 *  writeJsonFile and owns no separate lock domain. */
export class TransactionJournalIO {
  private readonly app: App;
  constructor(app: App) { this.app = app; }

  /** Read a journal for (packageId, version). Missing → null (no in-flight tx).
   *  Malformed → throws LibraryStoreError (D3). */
  async read(packageId: string, version: string): Promise<TransactionJournal | null> {
    return readJsonFile(this.app.vault, transactionJournalPath(packageId, version), isTransactionJournal, 'transaction journal');
  }

  /** Write the journal BEFORE any final-path write (D7). Caller holds the global
   *  installMutex; `mutex` is that same lock passed through to writeJsonFile. */
  async write(journal: TransactionJournal, mutex: WriteMutex): Promise<void> {
    const path = transactionJournalPath(journal.packageId, journal.releaseVersion);
    const parentDir = path.slice(0, path.lastIndexOf('/'));
    await writeJsonFile(this.app.vault, mutex, path, parentDir, journal);
  }

  /** Remove the journal file (after successful commit OR after rollback). Missing = no-op. */
  async remove(packageId: string, version: string): Promise<void> {
    const path = transactionJournalPath(packageId, version);
    if (await this.app.vault.adapter.exists(path)) {
      await this.app.vault.adapter.remove(path);
    }
  }

  /** List all in-flight transaction journals (for recovery on load). Recursively
   *  enumerates `.radiprotocol/library/transactions/` (adapter.list is non-recursive
   *  — mirrors src/snippets/snippet-service.ts:350-365). Returns [] when the
   *  directory is absent. I/O failures surface as LibraryStoreError('read-failed')
   *  (D3); malformed single journal files are SKIPPED (a malformed journal has
   *  no usable owned-paths list — its orphaned paths, if any, live harmlessly
   *  under `library/<pkg>/<ver>/` and are out of foundation recovery scope). */
  async listAll(): Promise<TransactionJournal[]> {
    const adapter = this.app.vault.adapter;
    const dirExists = await adapter.exists(TRANSACTIONS_DIR);
    if (!dirExists) return [];
    const journals: TransactionJournal[] = [];
    const queue: string[] = [TRANSACTIONS_DIR];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      let listing: { files: string[]; folders: string[] };
      try {
        listing = await adapter.list(current);
      } catch (e) {
        throw new LibraryStoreError('read-failed', current, `failed to list transactions: ${safeErrorMessage(e)}`);
      }
      for (const file of listing.files) {
        let raw: string;
        try {
          raw = await adapter.read(file);
        } catch (e) {
          throw new LibraryStoreError('read-failed', file, `failed to read transaction journal: ${safeErrorMessage(e)}`);
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue; // corrupt JSON — skip (malformed journal cannot be rolled back)
        }
        if (isTransactionJournal(parsed)) journals.push(parsed);
      }
      for (const sub of listing.folders) queue.push(sub);
    }
    return journals;
  }
}
```

### src/library/library-installer.ts — NEW
```typescript
// src/library/library-installer.ts
// Transactional stage→verify→commit→rollback installer for library packages (D7).
// Stages a protocol-plus-snippet bundle into immutable isolated namespaces
// (`library/<packageId>/<version>/`) under the existing protocol/snippet roots,
// verifies SHA-256 integrity + graph validity + path safety ENTIRELY in memory
// before any final-path write, then commits atomically (journal first, per-release
// marker LAST). All I/O via app.vault/adapter under a single module-level
// installMutex (5th lock domain, one fixed synthetic key — D7/D16), NEVER through
// InstalledRecordStore.write()/SnippetService.save() mid-transaction.
//
// Recovery on load: enumerate in-flight journals; marker present+valid+identity
// → committed, remove journal only; marker absent/invalid → remove every journal
// entry path deepest-first, then the journal.

import type { App } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
import { ensureFolderPath } from '../utils/vault-utils';
import { defaultT, type Translator } from '../i18n';
import type { ProtocolDocumentV1 } from '../protocol/protocol-document';
import { ProtocolDocumentParser } from '../protocol/protocol-document-parser';
import { GraphValidator } from '../graph/graph-validator';
import {
  assertNoTraversal, buildReferenceMapping, libraryProtocolFilePath,
  libraryProtocolNamespace, librarySnippetFilePath, librarySnippetNamespace,
  rewriteSnippetRef, validPackageSlug,
} from './library-paths';
import { sha256String, verifyIntegrity } from './integrity';
import { writeJsonFile, safeErrorMessage } from './library-json-io';
import {
  INSTALLED_RECORD_SCHEMA, INSTALLED_RECORD_VERSION,
  isInstalledRecord, type InstalledRecord, type ReleaseBundle,
} from './library-model';
import {
  TransactionJournalIO, TRANSACTIONS_SCHEMA, TRANSACTIONS_VERSION,
  type JournalEntry, type TransactionJournal,
} from './transaction-journal';
import { installedRecordPath } from './installed-record-store';

/** Single global install lock (D7 — one fixed synthetic key for every
 *  transaction, strictly serializing installs; avoids the ensureFolderPath
 *  shared-parent-folder check-then-create race a per-package key would
 *  reintroduce — see D7). */
const installMutex = new WriteMutex();
const INSTALL_LOCK_KEY = 'library-install';

/** Result of an install attempt. Never throws — failures return `failed`. */
export type InstallResult =
  | { status: 'ok'; packageId: string; releaseVersion: string }
  | { status: 'failed'; packageId: string; releaseVersion: string; reason: string };

/** Result of an uninstall attempt. Never throws — `not-installed` if no valid marker. */
export type UninstallResult =
  | { status: 'ok'; packageId: string; releaseVersion: string }
  | { status: 'not-installed'; packageId: string; releaseVersion: string }
  | { status: 'failed'; packageId: string; releaseVersion: string; reason: string };

/** Result of recovery-on-load. */
export interface RecoveryReport {
  committed: Array<{ packageId: string; releaseVersion: string }>;
  rolledBack: Array<{ packageId: string; releaseVersion: string }>;
}

export interface LibraryInstallerSettings {
  protocolFolderPath: string;
  snippetFolderPath: string;
}

export interface LibraryInstallerOptions {
  /** Injectable journal IO (tests pass a stub; production constructs one). */
  journalIO?: TransactionJournalIO;
  /** Injectable translator (defaults to defaultT for pure-test sites). */
  t?: Translator;
}

export class LibraryInstaller {
  private readonly app: App;
  private readonly settings: LibraryInstallerSettings;
  private readonly t: Translator;
  private readonly journalIO: TransactionJournalIO;

  constructor(app: App, settings: LibraryInstallerSettings, options: LibraryInstallerOptions = {}) {
    this.app = app;
    this.settings = settings;
    this.t = options.t ?? defaultT;
    this.journalIO = options.journalIO ?? new TransactionJournalIO(app);
  }

  /**
   * Install a release bundle transactionally. All validation happens in memory
   * first; the journal is written before any final-path write; the per-release
   * marker is written LAST. NEVER throws — returns `failed` on any error
   * (including an unexpected throw from planInstall, e.g. Web Crypto
   * unavailable). The post-commit journal removal is best-effort: the install is
   * committed once the marker is written, so a failed removal does NOT roll back
   * (recovery-on-load cleans a stale journal when the marker is present+valid).
   */
  async install(bundle: ReleaseBundle): Promise<InstallResult> {
    return installMutex.runExclusive(INSTALL_LOCK_KEY, async () => {
      try {
        const { packageId, releaseVersion: version } = bundle.manifest;
        // 1. Validate entirely in memory (no final-path I/O).
        const plan = await this.planInstall(bundle);
        if ('error' in plan) {
          return { status: 'failed', packageId, releaseVersion: version, reason: plan.error };
        }
        // 2. Write the journal BEFORE any final-path write (D7).
        try {
          await this.journalIO.write(plan.journal, installMutex);
        } catch (e) {
          return { status: 'failed', packageId, releaseVersion: version, reason: `failed to write journal: ${safeErrorMessage(e)}` };
        }
        // 3. Commit; rollback on any failure.
        try {
          const vault = this.app.vault;
          for (const w of plan.snippetWrites) {
            await ensureFolderPath(vault, parentDirOf(w.path));
            await vault.adapter.write(w.path, w.content);
          }
          await writeJsonFile(vault, installMutex, plan.protocolPath, parentDirOf(plan.protocolPath), plan.rewrittenDoc);
          // Per-release marker LAST (D15/D7 — presence+validity = commit signal).
          await writeJsonFile(vault, installMutex, plan.markerPath, parentDirOf(plan.markerPath), plan.record);
        } catch (e) {
          await this.rollbackTransaction(plan.journal);
          return { status: 'failed', packageId, releaseVersion: version, reason: `commit failed: ${safeErrorMessage(e)}` };
        }
        // 4. Commit complete — best-effort journal removal (install is committed;
        //    a stale journal is cleaned by recovery-on-load when the marker is valid).
        try {
          await this.journalIO.remove(packageId, version);
        } catch {
          // best-effort — install is already committed
        }
        return { status: 'ok', packageId, releaseVersion: version };
      } catch (e) {
        // Unexpected throw (e.g. Web Crypto unavailable in verifyIntegrity, a
        // malformed bundle.manifest, or a planInstall throw) — no final-path write
        // happened (planInstall does no final-path I/O), so no rollback is needed.
        const pkg = bundle?.manifest?.packageId ?? '';
        const ver = bundle?.manifest?.releaseVersion ?? '';
        return { status: 'failed', packageId: pkg, releaseVersion: ver, reason: safeErrorMessage(e) };
      }
    });
  }

  /** Recovery on load: enumerate in-flight journals and finalize each. NEVER
   *  throws — a listAll failure (e.g. unreadable transactions dir) returns an
   *  empty report (best-effort; the service may surface a warning). */
  async recoverInterrupted(): Promise<RecoveryReport> {
    return installMutex.runExclusive(INSTALL_LOCK_KEY, async () => {
      let journals: TransactionJournal[];
      try {
        journals = await this.journalIO.listAll();
      } catch {
        return { committed: [], rolledBack: [] };
      }
      const committed: RecoveryReport['committed'] = [];
      const rolledBack: RecoveryReport['rolledBack'] = [];
      for (const journal of journals) {
        try {
          const markerEntry = journal.entries.find((e) => e.kind === 'marker');
          const markerValid = markerEntry
            ? await this.isMarkerCommitted(markerEntry.path, journal.packageId, journal.releaseVersion)
            : false;
          if (markerValid) {
            await this.journalIO.remove(journal.packageId, journal.releaseVersion);
            committed.push({ packageId: journal.packageId, releaseVersion: journal.releaseVersion });
          } else {
            await this.rollbackTransaction(journal);
            rolledBack.push({ packageId: journal.packageId, releaseVersion: journal.releaseVersion });
          }
        } catch {
          // one journal's recovery must not abort the others — continue
        }
      }
      return { committed, rolledBack };
    });
  }

  /** Plan an install: validate everything in memory and compute the journal +
   *  ordered writes. Returns `{error}` on any validation failure, else the plan. */
  private async planInstall(bundle: ReleaseBundle): Promise<InstallPlan | { error: string }> {
    const { manifest } = bundle;
    const { packageId, releaseVersion: version } = manifest;
    const protocolRoot = this.settings.protocolFolderPath;
    const snippetRoot = this.settings.snippetFolderPath;

    // 1a. Nonempty slugs (validPackageSlug rejects all-punctuation ids).
    if (validPackageSlug(packageId) === null) return { error: `invalid package id "${packageId}": slugifies to empty` };
    if (validPackageSlug(version) === null) return { error: `invalid release version "${version}": slugifies to empty` };

    // 1b. Collision preflight — already installed (valid+identity marker) OR a
    // dirty destination (leftover final paths from an unrecovered interrupt). ANY
    // existing final path without a valid marker = dirty slot — refuse to clobber
    // (run recovery or uninstall first). This guards against overwriting user
    // content or a prior failed install's leftover staged files.
    if (await this.readMarker(packageId, version) !== null) {
      return { error: `package ${packageId}@${version} is already installed` };
    }
    const destProtocolPath = libraryProtocolFilePath(protocolRoot, packageId, version);
    if (await this.app.vault.adapter.exists(destProtocolPath)) {
      return { error: `destination occupied (prior incomplete install) — run recovery first: ${destProtocolPath}` };
    }
    if (await this.app.vault.adapter.exists(installedRecordPath(packageId, version))) {
      return { error: `destination occupied (prior incomplete install) — run recovery first: ${installedRecordPath(packageId, version)}` };
    }
    for (const f of manifest.snippetFiles) {
      const p = librarySnippetFilePath(snippetRoot, packageId, version, f.relPath);
      if (await this.app.vault.adapter.exists(p)) {
        return { error: `destination occupied (prior incomplete install) — run recovery first: ${p}` };
      }
    }

    // 1c. Manifest/content closure + .md-only + safe paths.
    const contentMap = new Map(bundle.snippetContents.map((s) => [s.relPath, s.content]));
    if (contentMap.size !== bundle.snippetContents.length) return { error: 'duplicate relPath in snippetContents' };
    for (const f of manifest.snippetFiles) {
      if (!f.relPath.endsWith('.md')) return { error: `snippet file "${f.relPath}" is not .md` };
      if (assertNoTraversal(f.relPath) === null) return { error: `snippet file "${f.relPath}" has an unsafe path` };
      if (!contentMap.has(f.relPath)) return { error: `manifest references snippet "${f.relPath}" but no content was provided` };
    }
    for (const s of bundle.snippetContents) {
      if (!manifest.snippetFiles.some((f) => f.relPath === s.relPath)) {
        return { error: `snippet content "${s.relPath}" is not declared in the manifest` };
      }
    }

    // 1d. Source hashes (SHA-256 integrity — D11).
    for (const f of manifest.snippetFiles) {
      if (!(await verifyIntegrity(contentMap.get(f.relPath)!, f.sha256))) {
        return { error: `integrity check failed for snippet "${f.relPath}"` };
      }
    }
    // 1e. Protocol hash (canonical pretty JSON + trailing newline = stored format).
    const protocolJson = JSON.stringify(manifest.protocolDoc, null, 2) + '\n';
    if (!(await verifyIntegrity(protocolJson, manifest.protocolSha256))) {
      return { error: 'integrity check failed for protocol document' };
    }

    // 1f. Parser success (deep node validation — never throws).
    const parser = new ProtocolDocumentParser(this.t);
    const protocolPath = libraryProtocolFilePath(protocolRoot, packageId, version);
    const parsed = parser.parse(protocolJson, protocolPath);
    if (!parsed.success) return { error: `protocol document failed to parse: ${parsed.error}` };

    // 1g. Build reference mapping from the parsed snippet nodes (extension-preserving).
    const snippetNodes = [...parsed.graph.nodes.values()].filter((n) => n.kind === 'snippet');
    const mappingResult = buildReferenceMapping(packageId, version, snippetNodes);
    if ('error' in mappingResult) return { error: mappingResult.error };
    const mapping = mappingResult.mapping;

    // 1g-bis. Subfolder closure: each subfolderPath-only snippet node must reference
    // a directory that has at least one declared descendant in manifest.snippetFiles.
    // GraphValidator only probes file-bound snippetPath nodes (D-04), so a
    // subfolderPath with no declared content would install an empty directory and
    // silently fail at runtime. (File-bound nodes are covered by the staged probe.)
    for (const node of snippetNodes) {
      const sfp = node.subfolderPath;
      const sp = node.radiprotocol_snippetPath;
      if (typeof sfp === 'string' && sfp !== '' && (sp === undefined || sp === '')) {
        const prefix = sfp.endsWith('/') ? sfp : sfp + '/';
        if (!manifest.snippetFiles.some((f) => f.relPath.startsWith(prefix))) {
          return { error: `snippet node "${node.id}" references subfolder "${sfp}" but no declared snippet file descends into it` };
        }
      }
    }

    // 1h. Rewrite the cloned stored doc's snippet-node fields (extension-preserving).
    // snippetPath and subfolderPath are mutually exclusive on a snippet node (see
    // src/graph/graph-model.ts SnippetNode comment); a manifest carrying both is
    // rejected. The rewritten value is re-gated through assertNoTraversal (D8
    // chokepoint before D-04 composition + staged write — defense-in-depth even
    // though the value is a deterministic transform of an already-safe path).
    const rewrittenDoc = cloneDoc(manifest.protocolDoc);
    for (const node of rewrittenDoc.nodes) {
      if (node.kind !== 'snippet') continue;
      const sp = node.fields['snippetPath'];
      const sfp = node.fields['subfolderPath'];
      const spSet = typeof sp === 'string' && sp !== '';
      const sfpSet = typeof sfp === 'string' && sfp !== '';
      if (spSet && sfpSet) {
        return { error: `snippet node "${node.id}" has both snippetPath and subfolderPath (mutually exclusive)` };
      }
      if (spSet) {
        const rewritten = rewriteSnippetRef(sp, mapping);
        if (rewritten === null) return { error: `cannot rewrite snippetPath "${sp}" for snippet node "${node.id}"` };
        if (assertNoTraversal(rewritten) === null) return { error: `rewritten snippetPath is unsafe for snippet node "${node.id}"` };
        node.fields['snippetPath'] = rewritten;
      } else if (sfpSet) {
        const rewritten = rewriteSnippetRef(sfp, mapping);
        if (rewritten === null) return { error: `cannot rewrite subfolderPath "${sfp}" for snippet node "${node.id}"` };
        if (assertNoTraversal(rewritten) === null) return { error: `rewritten subfolderPath is unsafe for snippet node "${node.id}"` };
        node.fields['subfolderPath'] = rewritten;
      }
    }

    // 1i. Re-parse the rewritten doc and validate with a staged probe (D10).
    const reparsed = parser.parseDocument(rewrittenDoc, protocolPath);
    if (!reparsed.success) return { error: `rewritten protocol document failed to parse: ${reparsed.error}` };
    const plannedFinalPaths = new Set(
      manifest.snippetFiles.map((f) => librarySnippetFilePath(snippetRoot, packageId, version, f.relPath)),
    );
    const validator = new GraphValidator({
      snippetFileProbe: (abs) => plannedFinalPaths.has(abs),
      snippetFolderPath: snippetRoot,
      t: this.t,
    });
    const errors = validator.validate(reparsed.graph);
    if (errors.length > 0) return { error: `rewritten graph is invalid: ${errors.join('; ')}` };

    // Compute the plan: journal entries (owned snippets+protocol, marker LAST),
    // the ordered snippet writes, and the per-release commit-marker record.
    const markerPath = installedRecordPath(packageId, version);
    const snippetNamespace = librarySnippetNamespace(snippetRoot, packageId, version);
    const entries: JournalEntry[] = [];
    const snippetWrites: Array<{ path: string; content: string }> = [];
    for (const f of manifest.snippetFiles) {
      const path = librarySnippetFilePath(snippetRoot, packageId, version, f.relPath);
      entries.push({ path, kind: 'owned' });
      snippetWrites.push({ path, content: contentMap.get(f.relPath)! });
    }
    entries.push({ path: protocolPath, kind: 'owned' });
    entries.push({ path: markerPath, kind: 'marker' }); // LAST

    // The recorded protocolSha256 is the hash of the INSTALLED (rewritten) doc as
    // written to disk (canonical pretty JSON + trailing newline, matching
    // writeJsonFile). The manifest's protocolSha256 verified the SOURCE doc's
    // integrity; the installed doc is a transformed copy whose hash must match
    // the on-disk file so the record's protocolSha256 is verifiable later.
    const installedProtocolSha256 = await sha256String(JSON.stringify(rewrittenDoc, null, 2) + '\n');
    const record: InstalledRecord = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId, releaseVersion: version,
      installedAt: new Date().toISOString(),
      protocolPath, snippetNamespace,
      snippetFiles: manifest.snippetFiles,
      protocolSha256: installedProtocolSha256,
      author: manifest.author,
    };

    return {
      journal: {
        schema: TRANSACTIONS_SCHEMA, version: TRANSACTIONS_VERSION,
        packageId, releaseVersion: version, startedAt: new Date().toISOString(), entries,
      },
      rewrittenDoc, protocolPath, markerPath, snippetWrites, record,
    };
  }

  /** Read the marker for (packageId, version). Missing/malformed/identity-mismatch
   *  → null (treated as not-installed during install preflight). */
  private async readMarker(packageId: string, version: string): Promise<InstalledRecord | null> {
    try {
      const raw = await this.app.vault.adapter.read(installedRecordPath(packageId, version));
      const parsed: unknown = JSON.parse(raw);
      if (isInstalledRecord(parsed) && parsed.packageId === packageId && parsed.releaseVersion === version) return parsed;
      return null;
    } catch {
      return null;
    }
  }

  /** True if the marker at `path` is a valid InstalledRecord with matching
   *  identity → install committed. Absent/malformed/identity-mismatch → rollback. */
  private async isMarkerCommitted(markerPath: string, packageId: string, version: string): Promise<boolean> {
    try {
      const raw = await this.app.vault.adapter.read(markerPath);
      const parsed: unknown = JSON.parse(raw);
      return isInstalledRecord(parsed) && parsed.packageId === packageId && parsed.releaseVersion === version;
    } catch {
      return false;
    }
  }

  /** Uninstall a release: read the per-release marker, delete its owned paths
   *  (protocol + snippet files + marker), then clean now-empty namespace folders.
   *  Under the global installMutex (D7). Never throws — `not-installed` if no
   *  valid+identity marker exists for (packageId, version). */
  async uninstall(packageId: string, version: string): Promise<UninstallResult> {
    return installMutex.runExclusive(INSTALL_LOCK_KEY, async () => {
      const record = await this.readMarker(packageId, version);
      if (record === null) return { status: 'not-installed', packageId, releaseVersion: version };
      const paths = [record.protocolPath, installedRecordPath(packageId, version)];
      for (const f of record.snippetFiles) {
        paths.push(librarySnippetFilePath(this.settings.snippetFolderPath, packageId, version, f.relPath));
      }
      try {
        await this.removeOwnedPaths(packageId, version, paths);
      } catch (e) {
        return { status: 'failed', packageId, releaseVersion: version, reason: `uninstall failed: ${safeErrorMessage(e)}` };
      }
      return { status: 'ok', packageId, releaseVersion: version };
    });
  }

  /** Delete a set of owned paths (deepest-first) that pass the namespace-safety
   *  gate, then remove now-empty parent directories (with an emptiness check).
   *  Shared by rollbackTransaction (paths from journal entries) and uninstall
   *  (paths derived from the InstalledRecord). Does NOT remove the journal —
   *  callers handle that. Called under the global installMutex.
   *
   *  Safety gate (D5): only delete paths that pass `assertNoTraversal` AND fall
   *  within this transaction's expected namespaces or are the expected marker
   *  path — a corrupted journal/record cannot sneak an arbitrary or
   *  traversal-bearing path (e.g. `protoNs/../../user-file.md`) past this gate. */
  private async removeOwnedPaths(packageId: string, version: string, paths: string[]): Promise<void> {
    const adapter = this.app.vault.adapter;
    const protoNs = libraryProtocolNamespace(this.settings.protocolFolderPath, packageId, version);
    const snipNs = librarySnippetNamespace(this.settings.snippetFolderPath, packageId, version);
    const markerPath = installedRecordPath(packageId, version);
    const isOwned = (p: string): boolean =>
      assertNoTraversal(p) !== null &&
      (p === markerPath || p.startsWith(protoNs + '/') || p.startsWith(snipNs + '/'));

    const removedPaths: string[] = [];
    const owned = paths.filter(isOwned);
    owned.sort((a, b) => b.length - a.length); // deepest-first → remove children before parents
    for (const path of owned) {
      try {
        if (await adapter.exists(path)) {
          await adapter.remove(path);
          removedPaths.push(path);
        }
      } catch {
        // best-effort — continue removing remaining paths
      }
    }

    // Empty-folder cleanup: walk each removed file's ancestors (stopping at the
    // configured roots / .radiprotocol/library so we never remove a vault root),
    // and remove a directory ONLY when adapter.list confirms it is empty. This
    // prevents recursive deletion of a non-empty folder that still holds other
    // packages' files (adapter.remove on a folder would otherwise recurse).
    const stopDirs = new Set([
      this.settings.protocolFolderPath, this.settings.snippetFolderPath,
      '.radiprotocol/library', '.radiprotocol',
    ]);
    const dirs = new Set<string>();
    for (const path of removedPaths) {
      let dir = parentDirOf(path);
      while (dir !== '' && !stopDirs.has(dir) && !dirs.has(dir)) {
        dirs.add(dir);
        const parent = parentDirOf(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
    const sortedDirs = [...dirs].sort((a, b) => b.length - a.length);
    for (const dir of sortedDirs) {
      try {
        const listing = await adapter.list(dir);
        if (listing.files.length === 0 && listing.folders.length === 0) await adapter.remove(dir);
      } catch {
        // best-effort
      }
    }
  }

  /** Roll back a transaction: remove every journal entry path (via the shared
   *  namespace-gated remover), then remove the journal. Best-effort. Called under
   *  the global installMutex. */
  private async rollbackTransaction(journal: TransactionJournal): Promise<void> {
    await this.removeOwnedPaths(journal.packageId, journal.releaseVersion, journal.entries.map((e) => e.path));
    try {
      await this.journalIO.remove(journal.packageId, journal.releaseVersion);
    } catch {
      // best-effort
    }
  }
}

/** Install plan produced by planInstall on successful in-memory validation. */
interface InstallPlan {
  journal: TransactionJournal;
  rewrittenDoc: ProtocolDocumentV1;
  protocolPath: string;
  markerPath: string;
  snippetWrites: Array<{ path: string; content: string }>;
  record: InstalledRecord;
}

function parentDirOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

/** Deep-clone the stored protocol document for in-memory rewriting (the manifest
 *  is immutable; the installer rewrites a copy). */
function cloneDoc(doc: ProtocolDocumentV1): ProtocolDocumentV1 {
  return JSON.parse(JSON.stringify(doc)) as ProtocolDocumentV1;
}
```

### src/library/library-service.ts — NEW
```typescript
// src/library/library-service.ts
// Facade for the community library: catalog discovery (fetch + cache +
// filter), install (fetch release → installer), uninstall, installed-record
// listing, and recovery-on-load orchestration. Consumes RegistryClient,
// LibraryInstaller, LibraryCacheStore, InstalledRecordStore. Views consume this;
// this layer never imports views. Modeled after SnippetService
// (src/snippets/snippet-service.ts) — Obsidian-touching via injected stores.

import type { App } from 'obsidian';
import { defaultT, type Translator } from '../i18n';
import type { CatalogEntry, CatalogFetchResult, InstalledRecord, PackageManifest } from './library-model';
import { RegistryClient } from './registry-client';
import { LibraryCacheStore } from './library-cache-store';
import { InstalledRecordStore } from './installed-record-store';
import {
  LibraryInstaller,
  type InstallResult, type LibraryInstallerSettings, type RecoveryReport, type UninstallResult,
} from './library-installer';
import { safeErrorMessage } from './library-json-io';

/** Query for catalog filtering. */
export interface CatalogQuery {
  /** Free-text query matched against title/description/author/categories (case-insensitive). */
  query?: string;
  /** Category filter (exact match against entry.categories). */
  filter?: string;
}

/** Result of listing the catalog. `available=false` = the registry endpoint was
 *  unavailable (no endpoint, network failure, non-https, malformed); entries are
 *  then the cached snapshot (possibly empty) — the explicit "catalog
 *  unavailable" state (D6), never a throw. */
export interface CatalogListResult {
  entries: CatalogEntry[];
  available: boolean;
  /** Set when `available=false`. */
  reason?: string;
  /** ISO 8601 of the snapshot being served (fetched just now, or the cached one). */
  fetchedAt?: string;
}

/** Result of fetching a release manifest for the UI trust preview (Slice 7).
 *  Never throws. A trimmed view of ReleaseFetchResult (the manifest only —
 *  snippet contents are NOT shipped to the preview). */
export type ReleaseManifestResult =
  | { status: 'ok'; manifest: PackageManifest }
  | { status: 'not-found'; reason: string }
  | { status: 'unavailable'; reason: string };

export type LibraryServiceSettings = LibraryInstallerSettings;

export interface LibraryServiceOptions {
  t?: Translator;
  installer?: LibraryInstaller;
  cacheStore?: LibraryCacheStore;
  recordStore?: InstalledRecordStore;
}

export class LibraryService {
  private readonly app: App;
  private readonly registryClient: RegistryClient;
  private readonly t: Translator;
  /** The transactional installer (public for main.ts recovery-on-load wiring). */
  readonly installer: LibraryInstaller;
  private readonly cacheStore: LibraryCacheStore;
  /** The installed-record store (public for Slice 8 read-only integration lookups). */
  readonly recordStore: InstalledRecordStore;

  constructor(
    app: App,
    settings: LibraryServiceSettings,
    registryClient: RegistryClient,
    options: LibraryServiceOptions = {},
  ) {
    this.app = app;
    this.registryClient = registryClient;
    this.t = options.t ?? defaultT;
    this.installer = options.installer ?? new LibraryInstaller(app, settings, { t: this.t });
    this.cacheStore = options.cacheStore ?? new LibraryCacheStore(app);
    this.recordStore = options.recordStore ?? new InstalledRecordStore(app);
  }

  /** List the catalog with optional filtering. Fetches from the registry; on
   *  unavailable, serves the cached snapshot (explicit unavailable state, D6).
   *  Never throws. */
  async listCatalog(query?: CatalogQuery): Promise<CatalogListResult> {
    let entries: CatalogEntry[];
    let available: boolean;
    let reason: string | undefined;
    let fetchedAt: string | undefined;
    try {
      const fetchResult: CatalogFetchResult = await this.registryClient.fetchCatalog();
      if (fetchResult.status === 'ok') {
        available = true;
        entries = fetchResult.snapshot.entries;
        fetchedAt = fetchResult.snapshot.fetchedAt;
        // Persist the fresh snapshot for offline / next-time use (best-effort).
        try { await this.cacheStore.writeSnapshot(fetchResult.snapshot); } catch { /* best-effort cache */ }
      } else {
        available = false;
        reason = fetchResult.reason;
        const cached = await this.readCachedSnapshot();
        entries = cached?.entries ?? [];
        fetchedAt = cached?.fetchedAt;
      }
    } catch (e) {
      // A registry client never throws (D2/D6), but defend-in-depth: treat any
      // unexpected throw as an unavailable catalog serving the cache.
      available = false;
      reason = `catalog fetch error: ${safeErrorMessage(e)}`;
      const cached = await this.readCachedSnapshot();
      entries = cached?.entries ?? [];
      fetchedAt = cached?.fetchedAt;
    }
    return { entries: filterEntries(entries, query), available, reason, fetchedAt };
  }

  /** Install a release by (packageId, version): fetch the release bundle from the
   *  registry, then run the transactional installer. Never throws. */
  async install(packageId: string, version: string): Promise<InstallResult> {
    try {
      const release = await this.registryClient.fetchRelease(packageId, version);
      if (release.status !== 'ok') {
        const reason = release.status === 'not-found' ? release.reason : `release unavailable: ${release.reason}`;
        return { status: 'failed', packageId, releaseVersion: version, reason };
      }
      return await this.installer.install(release.bundle);
    } catch (e) {
      return { status: 'failed', packageId, releaseVersion: version, reason: `install failed: ${safeErrorMessage(e)}` };
    }
  }

  /** Uninstall a release by (packageId, version). Never throws. */
  async uninstall(packageId: string, version: string): Promise<UninstallResult> {
    try {
      return await this.installer.uninstall(packageId, version);
    } catch (e) {
      return { status: 'failed', packageId, releaseVersion: version, reason: `uninstall failed: ${safeErrorMessage(e)}` };
    }
  }

  /** List all installed releases. Never throws — a store read failure returns []. */
  async listInstalled(): Promise<InstalledRecord[]> {
    try {
      return await this.recordStore.list();
    } catch {
      return [];
    }
  }

  /** Read one installed record by (packageId, version) — for the UI's installed
   *  indicator (Slice 8). Missing/malformed → null. Never throws. */
  async getInstalledRecord(packageId: string, version: string): Promise<InstalledRecord | null> {
    try {
      return await this.recordStore.read(packageId, version);
    } catch {
      return null;
    }
  }

  /** Fetch a release manifest for the UI trust preview (Slice 7). Never throws.
   *  Returns the manifest (file list + SHA-256 hashes) WITHOUT snippet contents
   *  — the preview shows what will be installed and its integrity hashes before
   *  the user commits. The actual install re-fetches the full bundle. */
  async getReleaseManifest(packageId: string, version: string): Promise<ReleaseManifestResult> {
    try {
      const release = await this.registryClient.fetchRelease(packageId, version);
      if (release.status === 'ok') return { status: 'ok', manifest: release.bundle.manifest };
      return release;
    } catch (e) {
      return { status: 'unavailable', reason: `manifest fetch error: ${safeErrorMessage(e)}` };
    }
  }

  /** Recovery on load: finalize any in-flight installs. Never throws. */
  async recoverInterruptedInstalls(): Promise<RecoveryReport> {
    try {
      return await this.installer.recoverInterrupted();
    } catch {
      return { committed: [], rolledBack: [] };
    }
  }

  /** Read the cached snapshot (best-effort; malformed/missing → null). */
  private async readCachedSnapshot(): Promise<{ entries: CatalogEntry[]; fetchedAt: string } | null> {
    try {
      const snap = await this.cacheStore.readSnapshot();
      return snap ? { entries: snap.entries, fetchedAt: snap.fetchedAt } : null;
    } catch {
      return null;
    }
  }
}

/** Filter catalog entries by a free-text query (title/description/author/
 *  categories/summary) and an exact category filter. Pure. */
function filterEntries(entries: CatalogEntry[], query?: CatalogQuery): CatalogEntry[] {
  if (!query) return entries;
  const q = query.query?.trim().toLowerCase();
  const cat = query.filter?.trim();
  return entries.filter((e) => {
    if (cat !== undefined && cat !== '' && !e.categories.includes(cat)) return false;
    if (q !== undefined && q !== '') {
      const hay = [e.title, e.description, e.author.displayName, ...e.categories, e.summary ?? ''].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
```

### src/views/library-view.ts — NEW
```typescript
// src/views/library-view.ts
// First-class ItemView for the community library (D4). Catalog discovery
// (search + category filter + list) + installed list. Modeled after
// SnippetManagerView (src/views/snippet-manager-view.ts:50,185-253):
// generation-guarded async refresh, 120ms-debounced vault watchers scoped to
// the library-managed subtrees + the installed-records dir, full dispose in
// onClose. The view consumes LibraryService (this.plugin.libraryService,
// wired in Slice 9); the item-detail modal + install-progress modal + the
// click→detail wiring are added in Slice 7 (MODIFY merge into this file).
//
// Fetch discipline: refresh() fetches the FULL catalog once (listCatalog()
// with no query — the service returns all entries when query is undefined)
// and stores it; search and category-filter changes re-filter the loaded
// catalog CLIENT-SIDE via renderModel() (no network round-trip — Performance
// Considerations). Only open / explicit Refresh button / watcher events
// trigger a fetch.
//
// Watcher scope: the catalog cache is the view's OWN write (Slice 5's
// listCatalog writes the cache on every successful fetch) — watching it
// would self-trigger an infinite refresh cycle, so it is excluded. The
// installer's transient pre-commit journal (Slice 4, written before the
// commit marker) is also excluded — watching it would churn refreshes
// before an install completes. The watcher covers only the library-managed
// subtrees + the installed-records dir; the per-release marker there
// (written LAST by the installer) is the meaningful "install completed"
// signal that warrants a refresh.
//
// All user-visible strings use t('library.*'); user-authored content
// (package titles, author names, categories) is NEVER wrapped in t().
// Integrity is shown as "integrity verified" (D11) — publisher authenticity
// is deferred, so the badge never implies authenticity. The
// catalog-unavailable state is explicit, never a throw (D6).

import { ItemView, Notice, WorkspaceLeaf, type EventRef } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { isLibraryManagedPath } from '../library/library-paths';
import type { CatalogEntry, InstalledRecord } from '../library/library-model';
import type { CatalogListResult } from '../library/library-service';
import { LibraryItemDetailModal } from './library-item-detail-modal';
import { LibraryInstallProgressModal } from './library-install-progress-modal';

export const LIBRARY_VIEW_TYPE = 'radiprotocol-library';

/** Installed-records dir watched for install/uninstall changes (mirrors
 *  INSTALLED_DIR in src/library/installed-record-store.ts — D15/D16; not
 *  exported by the store). The catalog cache (the view's own write via
 *  Slice 5 listCatalog) and the installer's pre-commit journal (Slice 4)
 *  are deliberately NOT watched — the former would self-cycle, the latter
 *  churns before the marker lands. */
const LIBRARY_INSTALLED_DIR = '.radiprotocol/library/installed';

interface LibraryViewModel {
  catalog: CatalogListResult;
  installed: InstalledRecord[];
}

export class LibraryView extends ItemView {
  private plugin: RadiProtocolPlugin;

  private mounted = false;
  /** Single invalidation generation — open, explicit refresh, and watcher
   *  refreshes increment it; post-await commits require both `mounted` and
   *  generation equality so stale work is rejected. Search/filter changes
   *  do NOT bump the generation (they re-filter synchronously). */
  private generation = 0;

  private query = '';
  private filter = '';
  private redrawTimer: number | null = null;

  private model: LibraryViewModel | null = null;

  // DOM refs rebuilt on every render (filterSelect options repopulated).
  private bannerEl!: HTMLElement;
  private catalogListEl!: HTMLElement;
  private installedListEl!: HTMLElement;
  private filterSelect!: HTMLSelectElement;

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return LIBRARY_VIEW_TYPE; }
  getDisplayText(): string { return this.plugin.i18n.t('library.viewTitle'); }
  getIcon(): string { return 'library'; }

  // --- Lifecycle -----------------------------------------------------------

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('radi-library-root');
    this.mounted = true;

    const t = this.plugin.i18n.t.bind(this.plugin.i18n);

    // Header: title + refresh button (the explicit refresh action —
    // Performance Considerations accepts "or explicit refresh action").
    const header = contentEl.createDiv({ cls: 'radi-library-header' });
    header.createEl('h2', { text: t('library.viewTitle') });
    const refreshBtn = header.createEl('button', {
      cls: 'radi-library-refresh',
      attr: { 'aria-label': t('library.refreshLabel') },
    });
    refreshBtn.setText(t('library.refreshLabel'));
    this.registerDomEvent(refreshBtn, 'click', () => { void this.refresh(); });

    // Search + category filter row. Both re-filter the loaded catalog
    // synchronously (no fetch).
    const searchWrap = contentEl.createDiv({ cls: 'radi-library-search' });
    const searchInput = searchWrap.createEl('input', {
      cls: 'radi-library-search-input',
      attr: { type: 'text', 'aria-label': t('library.searchPlaceholder') },
    });
    searchInput.placeholder = t('library.searchPlaceholder');
    this.registerDomEvent(searchInput, 'input', () => {
      this.query = searchInput.value;
      this.renderModel();
    });

    this.filterSelect = searchWrap.createEl('select', {
      cls: 'radi-library-filter',
      attr: { 'aria-label': t('library.filterLabel') },
    });
    this.filterSelect.createEl('option', { value: '', text: t('library.filterAll') });
    this.registerDomEvent(this.filterSelect, 'change', () => {
      this.filter = this.filterSelect.value;
      this.renderModel();
    });

    // Unavailable banner (hidden until a refresh sets it). role=status +
    // aria-live=polite so the unavailable state is announced.
    this.bannerEl = contentEl.createDiv({
      cls: 'radi-library-banner is-hidden',
      attr: { role: 'status', 'aria-live': 'polite' },
    });

    // Catalog section.
    const catalogSection = contentEl.createDiv({ cls: 'radi-library-section' });
    catalogSection.createEl('h3', { text: t('library.catalogSection') });
    this.catalogListEl = catalogSection.createDiv({ cls: 'radi-library-list' });
    this.catalogListEl.setAttr('role', 'list');
    this.catalogListEl.setAttr('aria-label', t('library.catalogSection'));

    // Installed section.
    const installedSection = contentEl.createDiv({ cls: 'radi-library-section' });
    installedSection.createEl('h3', { text: t('library.installedSection') });
    this.installedListEl = installedSection.createDiv({ cls: 'radi-library-list' });
    this.installedListEl.setAttr('role', 'list');
    this.installedListEl.setAttr('aria-label', t('library.installedSection'));

    // Initial loading state.
    this.renderLoading();

    await this.refresh();
    if (!this.mounted) return;

    // Vault watchers — scoped to library-managed subtrees + the
    // installed-records dir ONLY (NOT the catalog cache or the installer's
    // pre-commit journal — see the file header for rationale). 120ms
    // debounce coalesces rapid events.
    this.registerEvent(
      this.app.vault.on('create', (file) => { if (this.shouldHandle(file.path)) this.scheduleRedraw(); }) as EventRef,
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => { if (this.shouldHandle(file.path)) this.scheduleRedraw(); }) as EventRef,
    );
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (this.shouldHandle(file.path) || this.shouldHandle(oldPath)) this.scheduleRedraw();
      }) as EventRef,
    );
    this.registerEvent(
      this.app.vault.on('modify', (file) => { if (this.shouldHandle(file.path)) this.scheduleRedraw(); }) as EventRef,
    );
  }

  async onClose(): Promise<void> {
    this.mounted = false;
    this.generation++;
    this.query = '';
    this.filter = '';
    this.model = null;
    if (this.redrawTimer !== null) { window.clearTimeout(this.redrawTimer); this.redrawTimer = null; }
    this.contentEl.empty();
    // Vault event refs auto-detach via registerEvent; nothing else to release.
  }

  // --- Vault watcher scope -------------------------------------------------

  private shouldHandle(filePath: string): boolean {
    const protocolRoot = this.plugin.settings.protocolFolderPath;
    const snippetRoot = this.plugin.settings.snippetFolderPath;
    return (
      isLibraryManagedPath(filePath, protocolRoot) ||
      isLibraryManagedPath(filePath, snippetRoot) ||
      filePath === LIBRARY_INSTALLED_DIR ||
      filePath.startsWith(LIBRARY_INSTALLED_DIR + '/')
    );
  }

  private scheduleRedraw(): void {
    if (this.redrawTimer !== null) window.clearTimeout(this.redrawTimer);
    this.redrawTimer = window.setTimeout(() => {
      this.redrawTimer = null;
      void this.refresh();
    }, 120);
  }

  // --- Refresh (generation-guarded; fetch path) ---------------------------

  private async refresh(): Promise<boolean> {
    if (!this.mounted) return false;
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const generation = ++this.generation;
    this.contentEl.addClass('is-scanning');
    try {
      // Fetch the FULL catalog (no query) so the category dropdown can be
      // populated from the unfiltered set; display filtering is client-side.
      const catalog = await this.plugin.libraryService.listCatalog();
      if (!this.owns(generation)) return false;
      const installed = await this.plugin.libraryService.listInstalled();
      if (!this.owns(generation)) return false;
      this.model = { catalog, installed };
      this.renderModel();
      return true;
    } catch (e) {
      if (!this.owns(generation)) return false;
      new Notice(t('library.refreshError'));
      console.error('[RadiProtocol] library refresh failed', e);
      return false;
    } finally {
      if (this.owns(generation)) this.contentEl.removeClass('is-scanning');
    }
  }

  private owns(generation: number): boolean {
    return this.mounted && generation === this.generation;
  }

  // --- Render -------------------------------------------------------------

  private renderLoading(): void {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    this.catalogListEl.empty();
    this.catalogListEl.createEl('p', { cls: 'radi-library-empty', text: t('library.loading') });
    this.installedListEl.empty();
    this.installedListEl.createEl('p', { cls: 'radi-library-empty', text: t('library.loading') });
  }

  private renderModel(): void {
    const model = this.model;
    if (model === null) return;
    this.populateFilter(model.catalog.entries);
    this.renderBanner(model.catalog);
    this.renderCatalog(this.applyLocalFilter(model.catalog.entries));
    this.renderInstalled(model.installed);
  }

  /** Rebuild the category filter options from the UNFILTERED loaded entries,
   *  preserving the current selection. Categories are user-authored content
   *  (never wrapped in t()). Because `entries` is the full catalog, every
   *  category is always an option — an active filter never strands the
   *  dropdown with only the selected category. */
  private populateFilter(entries: CatalogEntry[]): void {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const cats = new Set<string>();
    for (const e of entries) for (const c of e.categories) cats.add(c);
    const sorted = [...cats].sort((a, b) => a.localeCompare(b));
    const current = this.filter;
    this.filterSelect.empty();
    this.filterSelect.createEl('option', { value: '', text: t('library.filterAll') });
    for (const c of sorted) {
      this.filterSelect.createEl('option', { value: c, text: c });
    }
    // Preserve the selection if still present; reset to "all" only if the
    // category disappeared from the catalog (legitimate).
    this.filterSelect.value = sorted.includes(current) ? current : '';
    this.filter = this.filterSelect.value;
  }

  /** Client-side display filter. Mirrors filterEntries in
   *  library-service.ts (title/description/author/categories/summary,
   *  case-insensitive includes; exact category match). Duplicated here so
   *  the category dropdown can be populated from the UNFILTERED catalog (one
   *  fetch, correct options) and search/filter changes re-filter without a
   *  network round-trip — without modifying the locked Slice 5 service. */
  private applyLocalFilter(entries: CatalogEntry[]): CatalogEntry[] {
    const q = this.query.trim().toLowerCase();
    const f = this.filter.trim();
    if (q === '' && f === '') return entries;
    return entries.filter((e) => {
      if (f !== '' && !e.categories.includes(f)) return false;
      if (q !== '') {
        const hay = [e.title, e.description, e.author.displayName, ...e.categories, e.summary ?? ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  private renderBanner(catalog: CatalogListResult): void {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    if (catalog.available) {
      this.bannerEl.addClass('is-hidden');
      this.bannerEl.empty();
      return;
    }
    this.bannerEl.removeClass('is-hidden');
    this.bannerEl.empty();
    const reason = catalog.reason ?? '';
    // A cached snapshot exists iff `fetchedAt` is set (the cache records the
    // snapshot's fetchedAt; the unavailable path leaves it undefined when no
    // cache exists). Branching on fetchedAt — NOT on entries.length — avoids
    // mislabeling a zero-match filtered cache as "no cache" (D6).
    if (catalog.fetchedAt !== undefined) {
      this.bannerEl.setText(t('library.unavailableBanner', { reason }));
    } else {
      this.bannerEl.setText(t('library.unavailableNoCache', { reason }));
    }
  }

  private renderCatalog(entries: CatalogEntry[]): void {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    this.catalogListEl.empty();
    if (entries.length === 0) {
      this.catalogListEl.createEl('p', { cls: 'radi-library-empty', text: t('library.noEntries') });
      return;
    }
    for (const entry of entries) {
      this.renderCatalogEntry(entry);
    }
  }

  private renderCatalogEntry(entry: CatalogEntry): void {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const row = this.catalogListEl.createDiv({ cls: 'radi-library-entry', attr: { role: 'listitem' } });
    row.setAttr('aria-label', t('library.catalogEntryAria', { title: entry.title }));
    row.addClass('is-clickable');
    row.setAttr('tabindex', '0');
    row.addEventListener('click', () => { void this.openDetail(entry); });
    row.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); void this.openDetail(entry); }
    });

    const titleEl = row.createDiv({ cls: 'radi-library-entry-title' });
    titleEl.setText(entry.title); // user-authored content — never wrapped in t()

    const metaEl = row.createDiv({ cls: 'radi-library-entry-meta' });
    metaEl.createEl('span', { cls: 'radi-library-entry-author', text: `${t('library.authorLabel')}: ${entry.author.displayName}` });
    metaEl.createEl('span', { cls: 'radi-library-entry-version', text: t('library.latestLabel', { version: entry.latestVersion }) });
    metaEl.createEl('span', { cls: 'radi-library-entry-updated', text: `${t('library.updatedLabel')}: ${formatDate(entry.updatedAt)}` });

    if (entry.categories.length > 0) {
      const cats = row.createDiv({ cls: 'radi-library-entry-categories' });
      cats.createEl('span', { cls: 'radi-library-entry-categories-label', text: `${t('library.categoriesLabel')}:` });
      cats.createEl('span', { cls: 'radi-library-entry-categories-value', text: entry.categories.join(', ') });
    }

    if (entry.summary !== undefined && entry.summary !== '') {
      row.createDiv({ cls: 'radi-library-entry-summary', text: entry.summary });
    }
  }

  private renderInstalled(records: InstalledRecord[]): void {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    this.installedListEl.empty();
    if (records.length === 0) {
      this.installedListEl.createEl('p', { cls: 'radi-library-empty', text: t('library.noInstalled') });
      return;
    }
    // Sort by installedAt descending (most recent first); localeCompare is
    // stable for ISO 8601 UTC strings.
    const sorted = [...records].sort((a, b) => b.installedAt.localeCompare(a.installedAt));
    for (const record of sorted) {
      this.renderInstalledRecord(record);
    }
  }

  private renderInstalledRecord(record: InstalledRecord): void {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const row = this.installedListEl.createDiv({ cls: 'radi-library-installed', attr: { role: 'listitem' } });
    row.setAttr('aria-label', t('library.installedEntryAria', { packageId: record.packageId, version: record.releaseVersion }));

    const titleEl = row.createDiv({ cls: 'radi-library-installed-title' });
    titleEl.setText(record.packageId); // server-controlled opaque id

    const metaEl = row.createDiv({ cls: 'radi-library-installed-meta' });
    metaEl.createEl('span', { cls: 'radi-library-installed-version', text: `${t('library.versionLabel')}: ${record.releaseVersion}` });
    if (record.author !== undefined) {
      metaEl.createEl('span', { cls: 'radi-library-installed-author', text: `${t('library.authorLabel')}: ${record.author.displayName}` });
    }
    metaEl.createEl('span', { cls: 'radi-library-installed-date', text: `${t('library.installedAtLabel')}: ${formatDate(record.installedAt)}` });

    // Integrity-verified indicator (D11); publisher authenticity/signatures
    // are deferred, so the badge never implies authenticity. The record's
    // presence + validity IS the integrity commit marker (D7/D15).
    const badge = row.createDiv({ cls: 'radi-library-integrity-badge' });
    badge.createEl('span', { cls: 'radi-library-integrity-icon', attr: { 'aria-hidden': 'true' } });
    badge.createEl('span', { cls: 'radi-library-integrity-text', text: t('library.integrityVerified') });
  }

  private async openDetail(entry: CatalogEntry): Promise<void> {
    const modal = new LibraryItemDetailModal(this.app, this.plugin, entry);
    modal.open();
    const result = await modal.result;
    if (result.install) {
      await this.openInstall(result.packageId, result.version);
    }
  }

  private async openInstall(packageId: string, version: string): Promise<void> {
    const modal = new LibraryInstallProgressModal(this.app, this.plugin, packageId, version);
    modal.open();
    await modal.result;
    // No explicit refresh — the Slice 6 vault watcher fires on the per-release
    // marker write (under .radiprotocol/library/installed/) and schedules a
    // single 120ms-debounced refresh. An explicit refresh here would duplicate
    // it (Slice 6 single-refresh contract). If the user dismissed the modal
    // mid-install, the install continues under installMutex and the watcher
    // still fires on the eventual marker write.
  }
}

/** Format an ISO 8601 timestamp as a locale date string. Returns the raw
 *  value on parse failure (never throws). */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}
```

### src/views/library-item-detail-modal.ts — NEW
```typescript
// src/views/library-item-detail-modal.ts
// Trust-preview modal for a catalog entry (Slice 7). Promise-based Modal
// modeled after SnippetEditorModal (src/views/snippet-editor-modal.ts:151-154,
// 644-649): discriminated-union result, safeResolve double-guard, onClose
// resolves the cancel result. Shows the catalog metadata + the release
// manifest's file list + SHA-256 hashes with an "integrity verified" framing
// (D11 — publisher authenticity is deferred; the framing never implies
// authenticity). The Install button is DISABLED until the manifest loads
// (trust preview before download); it resolves { install: true } and the
// caller (LibraryView) opens the install-progress modal. The manifest is
// fetched via LibraryService.getReleaseManifest (D2 — views consume the
// service, never RegistryClient).

import { App, Modal } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { CatalogEntry, PackageManifest } from '../library/library-model';
import type { ReleaseManifestResult } from '../library/library-service';

export type LibraryItemDetailResult =
  | { install: true; packageId: string; version: string }
  | { install: false };

export class LibraryItemDetailModal extends Modal {
  readonly result: Promise<LibraryItemDetailResult>;
  private resolve!: (value: LibraryItemDetailResult) => void;
  private resolved = false;

  private readonly plugin: RadiProtocolPlugin;
  private readonly entry: CatalogEntry;
  private fileListEl!: HTMLElement;
  private installBtn!: HTMLButtonElement;

  constructor(app: App, plugin: RadiProtocolPlugin, entry: CatalogEntry) {
    super(app);
    this.plugin = plugin;
    this.entry = entry;
    this.result = new Promise<LibraryItemDetailResult>((res) => { this.resolve = res; });
  }

  async onOpen(): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('radi-library-detail');

    this.titleEl.setText(t('library.detailTitle'));

    const titleEl = contentEl.createEl('h2', { cls: 'radi-library-detail-title' });
    titleEl.setText(this.entry.title); // user-authored — never t()
    this.renderMeta(contentEl);

    const filesHeading = contentEl.createEl('h3', { text: t('library.detailFiles') });
    filesHeading.addClass('radi-library-detail-files-heading');
    this.fileListEl = contentEl.createDiv({ cls: 'radi-library-detail-files' });
    this.fileListEl.createEl('p', { cls: 'radi-library-empty', text: t('library.detailLoading') });

    // Integrity framing (D11) — a process statement; publisher authenticity
    // is NOT verified (signatures deferred), so the framing never implies
    // authenticity.
    contentEl.createEl('p', { cls: 'radi-library-detail-integrity', text: t('library.detailIntegrity') });

    const actions = contentEl.createDiv({ cls: 'radi-library-detail-actions' });
    this.installBtn = actions.createEl('button', {
      cls: 'radi-library-detail-install mod-cta',
      attr: { 'aria-label': t('library.installLabel') },
    });
    this.installBtn.setText(t('library.installLabel'));
    this.installBtn.disabled = true; // enabled once the manifest loads (trust preview before download)
    this.installBtn.addEventListener('click', () => {
      this.safeResolve({ install: true, packageId: this.entry.packageId, version: this.entry.latestVersion });
      this.close();
    });
    const cancelBtn = actions.createEl('button', {
      cls: 'radi-library-detail-cancel',
      attr: { 'aria-label': t('library.cancel') },
    });
    cancelBtn.setText(t('library.cancel'));
    cancelBtn.addEventListener('click', () => {
      this.safeResolve({ install: false });
      this.close();
    });

    void this.loadManifest();
  }

  onClose(): void {
    this.safeResolve({ install: false });
    this.contentEl.empty();
  }

  private safeResolve(value: LibraryItemDetailResult): void {
    if (!this.resolved) { this.resolved = true; this.resolve(value); }
  }

  private renderMeta(container: HTMLElement): void {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const meta = container.createDiv({ cls: 'radi-library-detail-meta' });
    meta.createEl('div', { cls: 'radi-library-detail-author', text: `${t('library.authorLabel')}: ${this.entry.author.displayName}` });
    meta.createEl('div', { cls: 'radi-library-detail-version', text: `${t('library.versionLabel')}: ${this.entry.latestVersion}` });
    meta.createEl('div', { cls: 'radi-library-detail-updated', text: `${t('library.updatedLabel')}: ${formatDate(this.entry.updatedAt)}` });
    if (this.entry.categories.length > 0) {
      meta.createEl('div', { cls: 'radi-library-detail-categories', text: `${t('library.categoriesLabel')}: ${this.entry.categories.join(', ')}` });
    }
    if (this.entry.description !== '') {
      container.createEl('p', { cls: 'radi-library-detail-description', text: this.entry.description });
    }
    if (this.entry.summary !== undefined && this.entry.summary !== '') {
      container.createEl('p', { cls: 'radi-library-detail-summary', text: this.entry.summary });
    }
  }

  private async loadManifest(): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    let result: ReleaseManifestResult;
    try {
      result = await this.plugin.libraryService.getReleaseManifest(this.entry.packageId, this.entry.latestVersion);
    } catch (e) {
      result = { status: 'unavailable', reason: (e as Error)?.message ?? String(e) };
    }
    if (this.resolved) return;
    this.fileListEl.empty();
    if (result.status === 'ok') {
      this.renderFileList(result.manifest);
      this.installBtn.disabled = false; // trust preview ready — enable Install
    } else if (result.status === 'not-found') {
      this.fileListEl.createEl('p', { cls: 'radi-library-empty', text: t('library.detailNotFound') });
    } else {
      this.fileListEl.createEl('p', { cls: 'radi-library-empty', text: t('library.detailLoadFailed', { reason: result.reason }) });
    }
  }

  private renderFileList(manifest: PackageManifest): void {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const proto = this.fileListEl.createDiv({ cls: 'radi-library-detail-file' });
    proto.createEl('span', { cls: 'radi-library-detail-file-name', text: manifest.protocolDoc.title });
    const protoHash = proto.createEl('span', { cls: 'radi-library-detail-file-hash' });
    protoHash.setText(`${t('library.detailProtocolHash')}: ${shortHash(manifest.protocolSha256)}`);
    protoHash.setAttr('title', manifest.protocolSha256);
    for (const f of manifest.snippetFiles) {
      const row = this.fileListEl.createDiv({ cls: 'radi-library-detail-file' });
      row.createEl('span', { cls: 'radi-library-detail-file-name', text: f.relPath });
      const hash = row.createEl('span', { cls: 'radi-library-detail-file-hash' });
      hash.setText(shortHash(f.sha256));
      hash.setAttr('title', f.sha256);
    }
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

function shortHash(sha: string): string {
  return sha.slice(0, 12);
}
```

### src/views/library-install-progress-modal.ts — NEW
```typescript
// src/views/library-install-progress-modal.ts
// Install progress modal (Slice 7). Promise-based Modal. Drives the atomic
// LibraryService.install() and renders an exhaustive state dispatch + ARIA
// progressbar modeled after InlineRunnerModal
// (src/views/inline-runner-modal.ts:330-333,396-404,444-559). The atomic
// install() does NOT emit per-stage events (Slices 4-5 locked — reopening the
// load-bearing installer is out of scope), so the progressbar is indeterminate
// during 'installing' (aria-valuenow omitted per ARIA spec) and finalizes to
// 100% on 'complete' / 0% on 'failed' — no fake stage transitions. Closing
// during 'installing' resolves { done: false }; the install continues in the
// background under installMutex and the LibraryView watcher refreshes on the
// per-release marker write.

import { App, Modal } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { InstallResult } from '../library/library-installer';

export type LibraryInstallProgressResult =
  | { done: true; result: InstallResult }
  | { done: false };

type InstallProgressState = 'installing' | 'complete' | 'failed';

export class LibraryInstallProgressModal extends Modal {
  readonly result: Promise<LibraryInstallProgressResult>;
  private resolve!: (value: LibraryInstallProgressResult) => void;
  private resolved = false;

  private readonly plugin: RadiProtocolPlugin;
  private readonly packageId: string;
  private readonly version: string;

  private state: InstallProgressState = 'installing';
  private installResult: InstallResult | null = null;

  private progressEl!: HTMLElement;
  private fillEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private closeBtn!: HTMLButtonElement;

  constructor(app: App, plugin: RadiProtocolPlugin, packageId: string, version: string) {
    super(app);
    this.plugin = plugin;
    this.packageId = packageId;
    this.version = version;
    this.result = new Promise<LibraryInstallProgressResult>((res) => { this.resolve = res; });
  }

  async onOpen(): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('radi-library-install-progress');

    this.titleEl.setText(t('library.installProgressLabel', { packageId: this.packageId, version: this.version }));

    // ARIA progressbar (D4 a11y). Indeterminate during 'installing' —
    // aria-valuenow is OMITTED at creation (per ARIA spec, absent valuenow =
    // indeterminate); setProgress sets it to 100 on complete / 0 on failed.
    this.progressEl = contentEl.createDiv({
      cls: 'radi-library-progress',
      attr: {
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-label': t('library.installProgressLabel', { packageId: this.packageId, version: this.version }),
      },
    });
    const track = this.progressEl.createDiv({ cls: 'radi-library-progress-track' });
    this.fillEl = track.createDiv({ cls: 'radi-library-progress-fill' });
    this.statusEl = contentEl.createDiv({ cls: 'radi-library-progress-status' });

    this.renderState();

    const closeRow = contentEl.createDiv({ cls: 'radi-library-progress-actions' });
    this.closeBtn = closeRow.createEl('button', {
      cls: 'radi-library-progress-close',
      attr: { 'aria-label': t('library.close') },
    });
    this.closeBtn.setText(t('library.close'));
    this.closeBtn.disabled = true;
    this.closeBtn.addEventListener('click', () => this.close());

    void this.runInstall();
  }

  onClose(): void {
    if (!this.resolved) {
      this.safeResolve(
        this.state === 'installing' ? { done: false } : { done: true, result: this.installResult as InstallResult },
      );
    }
    this.contentEl.empty();
  }

  private safeResolve(value: LibraryInstallProgressResult): void {
    if (!this.resolved) { this.resolved = true; this.resolve(value); }
  }

  private async runInstall(): Promise<void> {
    const result = await this.plugin.libraryService.install(this.packageId, this.version);
    if (this.resolved) return; // modal closed mid-install; install continues
    this.installResult = result;
    this.state = result.status === 'ok' ? 'complete' : 'failed';
    this.setProgress(this.state === 'complete' ? 100 : 0);
    this.renderState();
    this.closeBtn.disabled = false;
  }

  private setProgress(percent: number): void {
    this.fillEl.style.width = `${percent}%`;
    this.progressEl.setAttribute('aria-valuenow', String(percent));
  }

  private renderState(): void {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    this.statusEl.empty();
    switch (this.state) {
      case 'installing':
        this.statusEl.setText(t('library.installInstalling'));
        this.progressEl.setAttribute('aria-label', t('library.installProgressLabel', { packageId: this.packageId, version: this.version }));
        break;
      case 'complete':
        this.statusEl.setText(t('library.installComplete'));
        this.progressEl.setAttribute('aria-label', t('library.installComplete'));
        break;
      case 'failed': {
        const reason = this.installResult !== null && this.installResult.status === 'failed' ? this.installResult.reason : '';
        this.statusEl.setText(t('library.installFailed', { reason }));
        this.progressEl.setAttribute('aria-label', t('library.installFailed', { reason }));
        break;
      }
      default: {
        const _exhaustive: never = this.state;
        void _exhaustive;
      }
    }
  }
}
```

### src/__tests__/library/library-model.test.ts — NEW
```typescript
import { describe, it, expect } from 'vitest';
import {
  PACKAGE_MANIFEST_SCHEMA, PACKAGE_MANIFEST_VERSION,
  INSTALLED_RECORD_SCHEMA, CATALOG_SNAPSHOT_SCHEMA,
  isPackageManifest, isCatalogSnapshot, isInstalledRecord, isCatalogEntry,
  LibraryStoreError,
  type PackageManifest, type CatalogSnapshot, type InstalledRecord, type CatalogEntry,
} from '../../library/library-model';
import { createEmptyProtocolDocument } from '../../protocol/protocol-document';

function validManifest(): PackageManifest {
  return {
    schema: PACKAGE_MANIFEST_SCHEMA,
    version: PACKAGE_MANIFEST_VERSION,
    packageId: 'chest-ct',
    releaseVersion: '1.0.0',
    protocolDoc: createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z')),
    protocolSha256: 'a'.repeat(64),
    snippetFiles: [{ relPath: 'lung-fields.md', sha256: 'b'.repeat(64) }],
    catalogEntryId: 'chest-ct',
    publishedAt: '2026-01-01T00:00:00Z',
  };
}

describe('library-model — isPackageManifest', () => {
  it('accepts a valid manifest', () => { expect(isPackageManifest(validManifest())).toBe(true); });
  it('rejects wrong schema sentinel', () => {
    expect(isPackageManifest({ ...validManifest(), schema: 'radiprotocol.protocol' })).toBe(false);
  });
  it('rejects wrong version', () => {
    expect(isPackageManifest({ ...validManifest(), version: 2 })).toBe(false);
  });
  it('rejects non-object and null', () => {
    expect(isPackageManifest(null)).toBe(false);
    expect(isPackageManifest('x')).toBe(false);
    expect(isPackageManifest(42)).toBe(false);
  });
  it('rejects missing packageId', () => {
    const m = validManifest(); delete (m as Partial<PackageManifest>).packageId;
    expect(isPackageManifest(m)).toBe(false);
  });
  it('rejects snippetFiles with a malformed entry', () => {
    const m = validManifest();
    (m as PackageManifest).snippetFiles = [null as unknown as PackageManifest['snippetFiles'][number]];
    expect(isPackageManifest(m)).toBe(false);
  });
});

describe('library-model — isCatalogSnapshot', () => {
  it('accepts a valid snapshot', () => {
    const s: CatalogSnapshot = { schema: CATALOG_SNAPSHOT_SCHEMA, version: 1, fetchedAt: 't', entries: [] };
    expect(isCatalogSnapshot(s)).toBe(true);
  });
  it('rejects wrong schema', () => {
    expect(isCatalogSnapshot({ schema: 'other', version: 1, fetchedAt: 't', entries: [] })).toBe(false);
  });
  it('rejects missing entries array', () => {
    expect(isCatalogSnapshot({ schema: CATALOG_SNAPSHOT_SCHEMA, version: 1, fetchedAt: 't' })).toBe(false);
  });
  it('rejects a non-CatalogEntry in entries', () => {
    expect(isCatalogSnapshot({ schema: CATALOG_SNAPSHOT_SCHEMA, version: 1, fetchedAt: 't', entries: ['nope'] })).toBe(false);
  });
});

describe('library-model — isInstalledRecord', () => {
  function validRecord(): InstalledRecord {
    return {
      schema: INSTALLED_RECORD_SCHEMA, version: 1,
      packageId: 'chest-ct', releaseVersion: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json',
      snippetNamespace: 'Snippets/library/chest-ct/1-0-0',
      snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }],
      protocolSha256: 'a'.repeat(64),
    };
  }
  it('accepts a valid per-release record', () => { expect(isInstalledRecord(validRecord())).toBe(true); });
  it('rejects wrong schema sentinel', () => {
    expect(isInstalledRecord({ ...validRecord(), schema: 'radiprotocol.installed-records' })).toBe(false);
  });
  it('rejects wrong version', () => {
    expect(isInstalledRecord({ ...validRecord(), version: 2 })).toBe(false);
  });
  it('rejects a malformed snippetFile entry', () => {
    const r = validRecord();
    (r as InstalledRecord).snippetFiles = [null as unknown as InstalledRecord['snippetFiles'][number]];
    expect(isInstalledRecord(r)).toBe(false);
  });
  it('rejects missing protocolPath', () => {
    const r = validRecord(); delete (r as Partial<InstalledRecord>).protocolPath;
    expect(isInstalledRecord(r)).toBe(false);
  });
});

describe('library-model — isCatalogEntry', () => {
  const baseEntry: CatalogEntry = {
    packageId: 'chest-ct', title: 'Chest CT', description: 'd',
    author: { displayName: 'Dr X' }, latestVersion: '1.0.0',
    categories: ['radiology'], updatedAt: 't',
  };
  it('accepts a valid entry', () => { expect(isCatalogEntry(baseEntry)).toBe(true); });
  it('accepts an entry with a string summary', () => {
    expect(isCatalogEntry({ ...baseEntry, summary: 's' })).toBe(true);
  });
  it('rejects a non-string summary', () => {
    expect(isCatalogEntry({ ...baseEntry, summary: 42 })).toBe(false);
  });
  it('rejects missing latestVersion', () => {
    const e = { ...baseEntry }; delete (e as Partial<CatalogEntry>).latestVersion;
    expect(isCatalogEntry(e)).toBe(false);
  });
  it('rejects missing author.displayName', () => {
    expect(isCatalogEntry({ ...baseEntry, author: {} })).toBe(false);
  });
  it('rejects missing author entirely', () => {
    const e = { ...baseEntry }; delete (e as Partial<CatalogEntry>).author;
    expect(isCatalogEntry(e)).toBe(false);
  });
  it('rejects categories with a non-string entry', () => {
    expect(isCatalogEntry({ ...baseEntry, categories: ['ok', null as unknown as string] })).toBe(false);
  });
});

describe('library-model — LibraryStoreError', () => {
  it('carries kind + path + message', () => {
    const err = new LibraryStoreError('malformed', '.radiprotocol/library/x.json', 'invalid JSON');
    expect(err.kind).toBe('malformed');
    expect(err.path).toBe('.radiprotocol/library/x.json');
    expect(err.message).toContain('malformed');
    expect(err.message).toContain('invalid JSON');
    expect(err instanceof Error).toBe(true);
  });
});
```

### src/__tests__/library/library-paths.test.ts — NEW
```typescript
import { describe, it, expect } from 'vitest';
import {
  LIBRARY_SUBROOT, slugifyPackageId, validPackageSlug,
  libraryProtocolNamespace, librarySnippetNamespace,
  libraryProtocolFilePath, librarySnippetFilePath,
  isLibraryManagedPath, assertNoTraversal, assertInsideLibraryRoot,
  rewriteSnippetRef, buildReferenceMapping,
} from '../../library/library-paths';
import type { SnippetNode } from '../../graph/graph-model';

function snippetNode(id: string, opts: { snippetPath?: string; subfolderPath?: string }): SnippetNode {
  return {
    id, kind: 'snippet', x: 0, y: 0, width: 100, height: 100,
    radiprotocol_snippetPath: opts.snippetPath,
    subfolderPath: opts.subfolderPath,
  };
}

describe('library-paths — slugifyPackageId', () => {
  it('lowercases and dashes non letter/number runs', () => {
    expect(slugifyPackageId('Chest CT!')).toBe('chest-ct');
  });
  it('strips edge dashes', () => {
    expect(slugifyPackageId('  --Chest--CT--  ')).toBe('chest-ct');
  });
  it('preserves cyrillic', () => {
    expect(slugifyPackageId('Грудная КТ')).toBe('грудная-кт');
  });
  it('slugifies version tags', () => {
    expect(slugifyPackageId('1.0.0')).toBe('1-0-0');
  });
});

describe('library-paths — validPackageSlug', () => {
  it('returns the slug for a valid id', () => {
    expect(validPackageSlug('Chest CT')).toBe('chest-ct');
  });
  it('returns null when the id slugifies to empty', () => {
    expect(validPackageSlug('!!!')).toBe(null);
    expect(validPackageSlug('   ')).toBe(null);
  });
});

describe('library-paths — namespace derivation', () => {
  it('protocol namespace under root', () => {
    expect(libraryProtocolNamespace('Protocols', 'chest-ct', '1.0.0')).toBe('Protocols/library/chest-ct/1-0-0');
  });
  it('snippet namespace under root', () => {
    expect(librarySnippetNamespace('Snippets', 'chest-ct', '1.0.0')).toBe('Snippets/library/chest-ct/1-0-0');
  });
  it('protocol file path ends with <slug>.rp.json', () => {
    expect(libraryProtocolFilePath('Protocols', 'chest-ct', '1.0.0')).toBe('Protocols/library/chest-ct/1-0-0/chest-ct.rp.json');
  });
  it('snippet file path preserves relPath extension', () => {
    expect(librarySnippetFilePath('Snippets', 'chest-ct', '1.0.0', 'folder/lung.md')).toBe('Snippets/library/chest-ct/1-0-0/folder/lung.md');
  });
});

describe('library-paths — isLibraryManagedPath', () => {
  it('true for path under <root>/library/', () => {
    expect(isLibraryManagedPath('Snippets/library/chest-ct/1-0-0/lung.md', 'Snippets')).toBe(true);
  });
  it('false for user content under root', () => {
    expect(isLibraryManagedPath('Snippets/my-snippet.md', 'Snippets')).toBe(false);
  });
  it('false for sibling root (no partial-segment match)', () => {
    expect(isLibraryManagedPath('SnippetsOther/library/x.md', 'Snippets')).toBe(false);
  });
  it('true for the library folder itself', () => {
    expect(isLibraryManagedPath('Snippets/library', 'Snippets')).toBe(true);
  });
});

describe('library-paths — assertNoTraversal', () => {
  it('accepts a normal relative path', () => { expect(assertNoTraversal('folder/snippet.md')).toBe('folder/snippet.md'); });
  it('accepts root (empty)', () => { expect(assertNoTraversal('')).toBe(''); });
  it('rejects parent traversal', () => { expect(assertNoTraversal('../escape.md')).toBe(null); });
  it('rejects current-dir segments', () => { expect(assertNoTraversal('./x.md')).toBe(null); });
  it('rejects absolute leading slash', () => { expect(assertNoTraversal('/etc/x.md')).toBe(null); });
  it('rejects backslashes', () => { expect(assertNoTraversal('a\\b.md')).toBe(null); });
});

describe('library-paths — assertInsideLibraryRoot', () => {
  it('accepts path inside root with slash boundary', () => {
    expect(assertInsideLibraryRoot('Snippets/folder/x.md', 'Snippets')).toBe('Snippets/folder/x.md');
  });
  it('accepts root itself', () => {
    expect(assertInsideLibraryRoot('Snippets', 'Snippets')).toBe('Snippets');
  });
  it('rejects outside root (no partial-segment match)', () => {
    expect(assertInsideLibraryRoot('SnippetsOther/x.md', 'Snippets')).toBe(null);
  });
  it('rejects traversal', () => {
    expect(assertInsideLibraryRoot('Snippets/../x.md', 'Snippets')).toBe(null);
  });
  it('rejects backslashes', () => {
    expect(assertInsideLibraryRoot('Snippets\\x.md', 'Snippets')).toBe(null);
  });
});

describe('library-paths — rewriteSnippetRef', () => {
  it('exact match wins', () => {
    const m = new Map([['folder/snippet.md', 'library/p/v/folder/snippet.md']]);
    expect(rewriteSnippetRef('folder/snippet.md', m)).toBe('library/p/v/folder/snippet.md');
  });
  it('prefix match with slash boundary, longest wins', () => {
    const m = new Map([['folder', 'library/p/v/folderA'], ['folder/sub', 'library/p/v/folderB']]);
    expect(rewriteSnippetRef('folder/sub/x.md', m)).toBe('library/p/v/folderB/x.md');
  });
  it('no match returns null', () => {
    const m = new Map([['other.md', 'library/p/v/other.md']]);
    expect(rewriteSnippetRef('folder/snippet.md', m)).toBe(null);
  });
});

describe('library-paths — buildReferenceMapping', () => {
  it('maps file-bound snippetPath (extension-preserving)', () => {
    const nodes = [snippetNode('n1', { snippetPath: 'folder/lung.md' })];
    const r = buildReferenceMapping('chest-ct', '1.0.0', nodes);
    expect('mapping' in r).toBe(true);
    if ('mapping' in r) expect(r.mapping.get('folder/lung.md')).toBe('library/chest-ct/1-0-0/folder/lung.md');
  });
  it('maps subfolderPath', () => {
    const nodes = [snippetNode('n1', { subfolderPath: 'folder' })];
    const r = buildReferenceMapping('chest-ct', '1.0.0', nodes);
    if ('mapping' in r) expect(r.mapping.get('folder')).toBe('library/chest-ct/1-0-0/folder');
  });
  it('errors on root-bound node (neither field set)', () => {
    const nodes = [snippetNode('n1', {})];
    const r = buildReferenceMapping('chest-ct', '1.0.0', nodes);
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error).toContain('root-bound');
  });
  it('errors on traversal snippetPath', () => {
    const nodes = [snippetNode('n1', { snippetPath: '../escape.md' })];
    const r = buildReferenceMapping('chest-ct', '1.0.0', nodes);
    expect('error' in r).toBe(true);
  });
});
```

### src/__tests__/library/integrity.test.ts — NEW
```typescript
import { describe, it, expect } from 'vitest';
import { sha256String, sha256Bytes, verifyIntegrity } from '../../library/integrity';

describe('integrity — sha256String', () => {
  it('matches known SHA-256 of "abc"', async () => {
    expect(await sha256String('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('is lowercase 64-char hex', async () => {
    expect(await sha256String('hello')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('integrity — sha256Bytes', () => {
  it('matches sha256String for the same UTF-8 bytes', async () => {
    const bytes = new TextEncoder().encode('abc');
    expect(await sha256Bytes(bytes)).toBe(await sha256String('abc'));
  });
  it('accepts ArrayBuffer', async () => {
    const buf = new TextEncoder().encode('abc').buffer as ArrayBuffer;
    expect(await sha256Bytes(buf)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('integrity — verifyIntegrity', () => {
  const hash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  it('returns true on matching hash', async () => {
    expect(await verifyIntegrity('abc', hash)).toBe(true);
  });
  it('returns false on mismatching hash (no throw)', async () => {
    expect(await verifyIntegrity('abc', '0'.repeat(64))).toBe(false);
  });
  it('is case-insensitive on expected hex', async () => {
    expect(await verifyIntegrity('abc', hash.toUpperCase())).toBe(true);
  });
});
```

### src/__tests__/library/registry-client.test.ts — NEW
```typescript
import { describe, it, expect, vi } from 'vitest';
import { RegistryClient, normalizeRegistryUrl, DEFAULT_REGISTRY_URL } from '../../library/registry-client';
import type { CatalogResponse, ReleaseResponse } from '../../library/registry-model';
import { createEmptyProtocolDocument } from '../../protocol/protocol-document';
import { PACKAGE_MANIFEST_SCHEMA, PACKAGE_MANIFEST_VERSION } from '../../library/library-model';

function makeManifest() {
  return {
    schema: PACKAGE_MANIFEST_SCHEMA, version: PACKAGE_MANIFEST_VERSION,
    packageId: 'chest-ct', releaseVersion: '1.0.0',
    protocolDoc: createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z')),
    protocolSha256: 'a'.repeat(64),
    snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }],
    catalogEntryId: 'chest-ct', publishedAt: '2026-01-01T00:00:00Z',
  };
}

function okResponse(json: unknown) {
  return { status: 200, text: JSON.stringify(json), json, arrayBuffer: new ArrayBuffer(0), headers: {} };
}

describe('registry-client — normalizeRegistryUrl', () => {
  it('returns empty for empty/undefined', () => {
    expect(normalizeRegistryUrl('')).toBe('');
    expect(normalizeRegistryUrl(undefined)).toBe('');
  });
  it('returns empty for non-https in production (httpsOnly=true)', () => {
    expect(normalizeRegistryUrl('http://example.com')).toBe('');
  });
  it('allows http when httpsOnly=false', () => {
    expect(normalizeRegistryUrl('http://example.com', false)).toBe('http://example.com');
  });
  it('accepts https and strips trailing slash', () => {
    expect(normalizeRegistryUrl('https://example.com/')).toBe('https://example.com');
  });
  it('returns empty for invalid URL', () => {
    expect(normalizeRegistryUrl('not a url')).toBe('');
  });
});

describe('registry-client — fetchCatalog', () => {
  it('returns unavailable when no endpoint configured', async () => {
    const c = new RegistryClient({ baseUrl: '' });
    const r = await c.fetchCatalog();
    expect(r.status).toBe('unavailable');
  });
  it('returns ok with a snapshot for a valid response', async () => {
    const body: CatalogResponse = {
      entries: [{ packageId: 'chest-ct', title: 'Chest CT', description: 'd', author: { displayName: 'X' }, latestVersion: '1.0.0', categories: ['radiology'], updatedAt: 't' }],
      serverTime: 't',
    };
    const requestUrl = vi.fn(async () => okResponse(body));
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    const r = await c.fetchCatalog();
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.snapshot.entries).toHaveLength(1);
      expect(r.snapshot.entries[0]!.packageId).toBe('chest-ct');
    }
  });
  it('returns unavailable on network error (no throw)', async () => {
    const requestUrl = vi.fn(async () => { throw new Error('network down'); });
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    const r = await c.fetchCatalog();
    expect(r.status).toBe('unavailable');
  });
  it('returns unavailable on malformed response', async () => {
    const requestUrl = vi.fn(async () => okResponse({ entries: 'not-an-array' }));
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    const r = await c.fetchCatalog();
    expect(r.status).toBe('unavailable');
  });
  it('rejects non-https baseUrl (unavailable)', async () => {
    const c = new RegistryClient({ baseUrl: 'http://example.com' });
    expect(c.isUnavailable()).toBe(true);
  });
});

describe('registry-client — fetchRelease', () => {
  it('returns ok with a bundle for a valid response', async () => {
    const body: ReleaseResponse = { manifest: makeManifest() as never, snippetContents: [{ relPath: 'lung.md', content: '# Lung' }] };
    const requestUrl = vi.fn(async () => okResponse(body));
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    const r = await c.fetchRelease('chest-ct', '1.0.0');
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.bundle.manifest.packageId).toBe('chest-ct');
      expect(r.bundle.snippetContents[0]!.content).toBe('# Lung');
    }
  });
  it('returns not-found on 404', async () => {
    const requestUrl = vi.fn(async () => ({ status: 404, text: '', json: {}, arrayBuffer: new ArrayBuffer(0), headers: {} }));
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    const r = await c.fetchRelease('chest-ct', '9.9.9');
    expect(r.status).toBe('not-found');
  });
  it('returns unavailable when no endpoint configured', async () => {
    const c = new RegistryClient({ baseUrl: '' });
    const r = await c.fetchRelease('chest-ct', '1.0.0');
    expect(r.status).toBe('unavailable');
  });
  it('encodes packageId and version in the URL path', async () => {
    const body: ReleaseResponse = { manifest: makeManifest() as never, snippetContents: [] };
    const requestUrl = vi.fn(async () => okResponse(body));
    const c = new RegistryClient({ baseUrl: 'https://example.com', requestUrl: requestUrl as never });
    await c.fetchRelease('chest ct', '1.0.0');
    expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/packages/chest%20ct/releases/1.0.0' }));
  });
});

describe('registry-client — DEFAULT_REGISTRY_URL', () => {
  it('is empty (no unprovisioned domain hard-coded)', () => {
    expect(DEFAULT_REGISTRY_URL).toBe('');
  });
});
```

### src/__tests__/library/library-cache-store.test.ts — NEW
```typescript
import { describe, it, expect, vi } from 'vitest';
import { LibraryCacheStore } from '../../library/library-cache-store';
import { CATALOG_SNAPSHOT_SCHEMA, CATALOG_SNAPSHOT_VERSION } from '../../library/library-model';
import { TFile } from '../__mocks__/obsidian';

function makeVault(opts: { files?: Record<string, string>; folders?: string[] } = {}) {
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const folderSet = new Set(opts.folders ?? []);
  const vault = {
    adapter: {
      exists: vi.fn(async (p: string) => p in files || folderSet.has(p)),
      read: vi.fn(async (p: string) => { if (!(p in files)) throw new Error('ENOENT: ' + p); return files[p]; }),
      write: vi.fn(async (p: string, data: string) => { files[p] = data; }),
      list: vi.fn(async () => ({ files: [], folders: [] })),
    },
    createFolder: vi.fn(async (p: string) => { folderSet.add(p); }),
    getAbstractFileByPath: vi.fn((p: string) => (p in files ? new TFile(p) : null)),
    getFiles: vi.fn(() => Object.keys(files).map((p) => new TFile(p))),
  };
  return { vault, files, folderSet };
}
const makeApp = (vault: ReturnType<typeof makeVault>['vault']) => ({ vault } as unknown);

describe('LibraryCacheStore — readSnapshot', () => {
  it('returns null when the cache file is missing (empty initial state)', async () => {
    const { vault } = makeVault();
    const store = new LibraryCacheStore(makeApp(vault) as never);
    expect(await store.readSnapshot()).toBe(null);
  });
  it('round-trips a written snapshot', async () => {
    const { vault, files } = makeVault();
    const store = new LibraryCacheStore(makeApp(vault) as never);
    const snap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: 't', entries: [] };
    await store.writeSnapshot(snap);
    expect(files['.radiprotocol/library/catalog-cache.json']).toBeDefined();
    expect(await store.readSnapshot()).toEqual(snap);
  });
  it('throws LibraryStoreError(malformed) on invalid JSON', async () => {
    const { vault } = makeVault({ files: { '.radiprotocol/library/catalog-cache.json': 'not json' }, folders: ['.radiprotocol/library'] });
    const store = new LibraryCacheStore(makeApp(vault) as never);
    await expect(store.readSnapshot()).rejects.toMatchObject({ name: 'LibraryStoreError', kind: 'malformed' });
  });
  it('throws LibraryStoreError(malformed) on wrong schema', async () => {
    const { vault } = makeVault({ files: { '.radiprotocol/library/catalog-cache.json': JSON.stringify({ schema: 'other', version: 1, fetchedAt: 't', entries: [] }) }, folders: ['.radiprotocol/library'] });
    const store = new LibraryCacheStore(makeApp(vault) as never);
    await expect(store.readSnapshot()).rejects.toMatchObject({ name: 'LibraryStoreError', kind: 'malformed' });
  });
  it('writes pretty JSON with a trailing newline', async () => {
    const { vault, files } = makeVault();
    const store = new LibraryCacheStore(makeApp(vault) as never);
    await store.writeSnapshot({ schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: 't', entries: [] });
    const written = files['.radiprotocol/library/catalog-cache.json']!;
    expect(written).toMatch(/\n$/);
    expect(written).toContain('  "schema"');
  });
});
```

### src/__tests__/library/installed-record-store.test.ts — NEW
```typescript
import { describe, it, expect, vi } from 'vitest';
import { InstalledRecordStore, installedRecordPath } from '../../library/installed-record-store';
import { INSTALLED_RECORD_SCHEMA, INSTALLED_RECORD_VERSION, type InstalledRecord } from '../../library/library-model';
import { libraryProtocolFilePath, librarySnippetNamespace } from '../../library/library-paths';

/** Derive a one-level directory listing from the in-memory files map so the
 *  store's recursive `adapter.list` walk works in tests (mirrors the real
 *  adapter.list non-recursive contract — see src/snippets/snippet-service.ts:125). */
function listPath(files: Record<string, string>, dirPath: string): { files: string[]; folders: string[] } {
  const prefix = dirPath === '' ? '' : dirPath + '/';
  const out: string[] = [];
  const folders = new Set<string>();
  for (const p of Object.keys(files)) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length);
    if (rest === '') continue;
    const slash = rest.indexOf('/');
    if (slash === -1) out.push(p);
    else folders.add(prefix + rest.slice(0, slash));
  }
  return { files: out, folders: [...folders] };
}

function makeVault(opts: { files?: Record<string, string> } = {}) {
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const vault = {
    adapter: {
      exists: vi.fn(async (p: string) => p in files || Object.keys(files).some((f) => f.startsWith(p === '' ? '' : p + '/'))),
      read: vi.fn(async (p: string) => { if (!(p in files)) throw new Error('ENOENT: ' + p); return files[p]; }),
      write: vi.fn(async (p: string, data: string) => { files[p] = data; }),
      list: vi.fn(async (p: string) => listPath(files, p)),
      remove: vi.fn(async (p: string) => { delete files[p]; }),
    },
    // ensureFolderPath (src/utils/vault-utils.ts:12) calls vault.createFolder after adapter.exists returns false.
    createFolder: vi.fn(async (_p: string) => { /* no-op in-memory; existence is derived from the files map */ }),
  };
  return { vault, files };
}
const makeApp = (vault: ReturnType<typeof makeVault>['vault']) => ({ vault } as unknown);

function validRecord(packageId: string, version: string): InstalledRecord {
  return {
    schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
    packageId, releaseVersion: version, installedAt: '2026-01-01T00:00:00Z',
    // Use the real slugifying path helpers so stored paths match the installer's
    // actual installed paths (version '1.0.0' slugifies to '1-0-0' — see library-paths.ts).
    protocolPath: libraryProtocolFilePath('Protocols', packageId, version),
    snippetNamespace: librarySnippetNamespace('Snippets', packageId, version),
    snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }],
    protocolSha256: 'a'.repeat(64),
  };
}

describe('InstalledRecordStore — read', () => {
  it('returns null when the record file is missing', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    expect(await store.read('chest-ct', '1.0.0')).toBe(null);
  });
  it('round-trips a written record', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    const rec = validRecord('chest-ct', '1.0.0');
    await store.write(rec);
    expect(await store.read('chest-ct', '1.0.0')).toEqual(rec);
  });
  it('throws LibraryStoreError(malformed) on invalid JSON', async () => {
    const path = installedRecordPath('chest-ct', '1.0.0');
    const { vault } = makeVault({ files: { [path]: 'nope' } });
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await expect(store.read('chest-ct', '1.0.0')).rejects.toMatchObject({ name: 'LibraryStoreError', kind: 'malformed' });
  });
  it('throws LibraryStoreError(malformed) on wrong schema', async () => {
    const path = installedRecordPath('chest-ct', '1.0.0');
    const { vault } = makeVault({ files: { [path]: JSON.stringify({ schema: 'other', version: 1, packageId: 'x', releaseVersion: '1', installedAt: 't', protocolPath: 'a', snippetNamespace: 'b', snippetFiles: [], protocolSha256: 'h' }) } });
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await expect(store.read('chest-ct', '1.0.0')).rejects.toMatchObject({ name: 'LibraryStoreError', kind: 'malformed' });
  });
  it('throws LibraryStoreError(malformed) when record identity mismatches the path (D15 marker identity)', async () => {
    const path = installedRecordPath('chest-ct', '1.0.0');
    // A structurally-valid record carrying a DIFFERENT (packageId, releaseVersion)
    // than its slot — a hand-moved/corrupted marker must not be trusted.
    const mismatched = { ...validRecord('brain-mri', '2.0.0') };
    const { vault } = makeVault({ files: { [path]: JSON.stringify(mismatched) } });
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await expect(store.read('chest-ct', '1.0.0')).rejects.toMatchObject({ name: 'LibraryStoreError', kind: 'malformed' });
  });
});

describe('InstalledRecordStore — list', () => {
  it('returns [] when the installed directory is absent (empty initial state)', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    expect(await store.list()).toEqual([]);
  });
  it('lists records across nested package/version folders', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await store.write(validRecord('chest-ct', '1.0.0'));
    await store.write(validRecord('brain-mri', '2.0.0'));
    const records = await store.list();
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.packageId).sort()).toEqual(['brain-mri', 'chest-ct']);
  });
  it('skips a corrupted single record (D15 per-file isolation, no throw)', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await store.write(validRecord('chest-ct', '1.0.0'));
    await vault.adapter.write(installedRecordPath('brain-mri', '2.0.0'), 'not-json');
    const records = await store.list();
    expect(records).toHaveLength(1);
    expect(records[0]!.packageId).toBe('chest-ct');
  });
});

describe('InstalledRecordStore — write', () => {
  it('writes pretty JSON with a trailing newline at the per-release path', async () => {
    const { vault, files } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await store.write(validRecord('chest-ct', '1.0.0'));
    // Literal slugified path oracle (version '1.0.0' → '1-0-0'), NOT the function under test:
    const written = files['.radiprotocol/library/installed/chest-ct/1-0-0.json']!;
    expect(written).toMatch(/\n$/);
    expect(written).toContain('  "schema"');
    expect(written).toContain('"radiprotocol.installed-record"');
  });
});

describe('InstalledRecordStore — delete', () => {
  it('removes the per-release record file', async () => {
    const { vault, files } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await store.write(validRecord('chest-ct', '1.0.0'));
    await store.delete('chest-ct', '1.0.0');
    expect(files[installedRecordPath('chest-ct', '1.0.0')]).toBeUndefined();
  });
  it('is a no-op when the file is missing', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await expect(store.delete('chest-ct', '1.0.0')).resolves.toBeUndefined();
  });
});
```

### src/__tests__/library/library-installer.test.ts — NEW
```typescript
import { describe, it, expect, vi } from 'vitest';
import { LibraryInstaller, type LibraryInstallerSettings } from '../../library/library-installer';
import {
  TransactionJournalIO, transactionJournalPath,
  TRANSACTIONS_SCHEMA, TRANSACTIONS_VERSION, type TransactionJournal,
} from '../../library/transaction-journal';
import { installedRecordPath } from '../../library/installed-record-store';
import {
  PACKAGE_MANIFEST_SCHEMA, PACKAGE_MANIFEST_VERSION,
  INSTALLED_RECORD_SCHEMA, INSTALLED_RECORD_VERSION,
  type ReleaseBundle, type PackageManifest,
} from '../../library/library-model';
import { sha256String } from '../../library/integrity';
import { createEmptyProtocolDocument } from '../../protocol/protocol-document';
import { WriteMutex } from '../../utils/write-mutex';

/** One-level directory listing derived from the in-memory files map (mirrors the
 *  real non-recursive adapter.list contract — see src/snippets/snippet-service.ts:125). */
function listPath(files: Record<string, string>, dirPath: string): { files: string[]; folders: string[] } {
  const prefix = dirPath === '' ? '' : dirPath + '/';
  const out: string[] = [];
  const folders = new Set<string>();
  for (const p of Object.keys(files)) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length);
    if (rest === '') continue;
    const slash = rest.indexOf('/');
    if (slash === -1) out.push(p);
    else folders.add(prefix + rest.slice(0, slash));
  }
  return { files: out, folders: [...folders] };
}

function makeVault(opts: { files?: Record<string, string>; failWriteFor?: (p: string) => boolean } = {}) {
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const failWriteFor = opts.failWriteFor ?? (() => false);
  const vault = {
    adapter: {
      exists: vi.fn(async (p: string) => p in files || Object.keys(files).some((f) => f.startsWith(p === '' ? '' : p + '/'))),
      read: vi.fn(async (p: string) => { if (!(p in files)) throw new Error('ENOENT: ' + p); return files[p]; }),
      write: vi.fn(async (p: string, data: string) => {
        if (failWriteFor(p)) throw new Error('write blocked: ' + p);
        files[p] = data;
      }),
      list: vi.fn(async (p: string) => listPath(files, p)),
      remove: vi.fn(async (p: string) => { delete files[p]; }),
    },
    createFolder: vi.fn(async (_p: string) => { /* no-op in-memory */ }),
  };
  return { vault, files };
}
const makeApp = (vault: ReturnType<typeof makeVault>['vault']) => ({ vault } as unknown);

const SETTINGS: LibraryInstallerSettings = { protocolFolderPath: 'Protocols', snippetFolderPath: 'Snippets' };

/** Build a valid ReleaseBundle with one start node, one snippet node bound to a
 *  .md file, and correct SHA-256 hashes (computed dynamically so the bundle is
 *  internally consistent). Selectively corruptible via the options. */
async function makeBundle(opts: {
  snippetContent?: string;
  tamperSnippetHash?: boolean;
  tamperProtocolHash?: boolean;
  snippetRelPath?: string;
  nodeSnippetPath?: string;
  undeclaredContent?: string;
} = {}): Promise<ReleaseBundle> {
  const protocolDoc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
  const startId = protocolDoc.nodes[0]!.id;
  const relPath = opts.snippetRelPath ?? 'lung.md';
  const nodeSnippetPath = opts.nodeSnippetPath ?? relPath;
  protocolDoc.nodes.push({
    id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100,
    fields: { snippetPath: nodeSnippetPath },
  });
  protocolDoc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
  const snippetContent = opts.snippetContent ?? '# Lung content\n';
  const snippetSha = await sha256String(snippetContent);
  const protocolJson = JSON.stringify(protocolDoc, null, 2) + '\n';
  const protocolSha = await sha256String(protocolJson);
  const manifest: PackageManifest = {
    schema: PACKAGE_MANIFEST_SCHEMA, version: PACKAGE_MANIFEST_VERSION,
    packageId: 'chest-ct', releaseVersion: '1.0.0',
    protocolDoc,
    protocolSha256: opts.tamperProtocolHash ? '0'.repeat(64) : protocolSha,
    snippetFiles: [{ relPath, sha256: opts.tamperSnippetHash ? '0'.repeat(64) : snippetSha }],
    catalogEntryId: 'chest-ct', publishedAt: '2026-01-01T00:00:00Z',
  };
  const snippetContents = [{ relPath, content: snippetContent }];
  if (opts.undeclaredContent) snippetContents.push({ relPath: opts.undeclaredContent, content: 'extra' });
  return { manifest, snippetContents };
}

describe('LibraryInstaller — install', () => {
  it('installs a valid bundle: writes protocol + snippet + marker, removes journal', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle());
    expect(result.status).toBe('ok');
    expect(files['Protocols/library/chest-ct/1-0-0/chest-ct.rp.json']).toBeDefined();
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBe('# Lung content\n');
    const marker = JSON.parse(files[installedRecordPath('chest-ct', '1.0.0')]!);
    expect(marker.schema).toBe(INSTALLED_RECORD_SCHEMA);
    expect(marker.packageId).toBe('chest-ct');
    expect(marker.releaseVersion).toBe('1.0.0');
    expect(marker.protocolPath).toBe('Protocols/library/chest-ct/1-0-0/chest-ct.rp.json');
    // journal removed after commit
    expect(files[transactionJournalPath('chest-ct', '1.0.0')]).toBeUndefined();
  });

  it('fails on snippet integrity mismatch (no final paths written, no marker)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ tamperSnippetHash: true }));
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('integrity');
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBeUndefined();
    expect(files[installedRecordPath('chest-ct', '1.0.0')]).toBeUndefined();
  });

  it('fails on protocol integrity mismatch', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ tamperProtocolHash: true }));
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('protocol document');
  });

  it('fails on non-.md snippet relPath', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ snippetRelPath: 'lung.txt' }));
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('.md');
  });

  it('fails on traversal snippet relPath', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ snippetRelPath: '../escape.md' }));
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('unsafe');
  });

  it('fails on undeclared snippet content', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ undeclaredContent: 'extra.md' }));
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('not declared');
  });

  it('fails staged graph validation when a snippet node references a file not in the manifest (D-04 probe)', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    // Manifest declares 'lung.md' but the snippet node references 'other.md'. The
    // staged probe composes Snippets/library/.../other.md, which is NOT in
    // plannedFinalPaths (only lung.md is) → GraphValidator D-04 rejects it.
    const result = await installer.install(await makeBundle({ nodeSnippetPath: 'other.md' }));
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('invalid');
  });

  it('fails if already installed (marker present)', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    expect((await installer.install(await makeBundle())).status).toBe('ok');
    const result = await installer.install(await makeBundle());
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('already installed');
  });

  it('rolls back on commit failure: removes staged owned paths, no marker, journal removed', async () => {
    // adapter.write throws for the protocol path only — snippet writes succeed,
    // then the protocol write fails, triggering rollback of all owned paths.
    const { vault, files } = makeVault({ failWriteFor: (p) => p === 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json' });
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle());
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('commit failed');
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBeUndefined();
    expect(files[installedRecordPath('chest-ct', '1.0.0')]).toBeUndefined();
    expect(files[transactionJournalPath('chest-ct', '1.0.0')]).toBeUndefined();
  });
});

describe('LibraryInstaller — uninstall', () => {
  it('uninstalls an installed package: removes protocol + snippet + marker', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    expect((await installer.install(await makeBundle())).status).toBe('ok');
    expect(files[installedRecordPath('chest-ct', '1.0.0')]).toBeDefined();
    const result = await installer.uninstall('chest-ct', '1.0.0');
    expect(result.status).toBe('ok');
    expect(files['Protocols/library/chest-ct/1-0-0/chest-ct.rp.json']).toBeUndefined();
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBeUndefined();
    expect(files[installedRecordPath('chest-ct', '1.0.0')]).toBeUndefined();
  });

  it('returns not-installed when no valid marker exists', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.uninstall('chest-ct', '1.0.0');
    expect(result.status).toBe('not-installed');
  });
});

describe('LibraryInstaller — recoverInterrupted', () => {
  /** Write a synthetic journal directly (simulating an interrupt that left a
   *  journal on disk) without going through the installer. */
  async function seedJournal(vault: unknown, markerPresent: boolean, stagedSnippet: boolean) {
    const files = (vault as { adapter: { write: (p: string, d: string) => Promise<void> } });
    const journal: TransactionJournal = {
      schema: TRANSACTIONS_SCHEMA, version: TRANSACTIONS_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', startedAt: '2026-01-01T00:00:00Z',
      entries: [
        { path: 'Snippets/library/chest-ct/1-0-0/lung.md', kind: 'owned' },
        { path: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json', kind: 'owned' },
        { path: installedRecordPath('chest-ct', '1.0.0'), kind: 'marker' },
      ],
    };
    await new TransactionJournalIO({ vault } as never).write(journal, new WriteMutex());
    if (stagedSnippet) await files.adapter.write('Snippets/library/chest-ct/1-0-0/lung.md', '# Lung content\n');
    if (markerPresent) {
      const marker = {
        schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
        packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
        protocolPath: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json',
        snippetNamespace: 'Snippets/library/chest-ct/1-0-0',
        snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }],
        protocolSha256: 'a'.repeat(64),
      };
      await files.adapter.write(installedRecordPath('chest-ct', '1.0.0'), JSON.stringify(marker, null, 2) + '\n');
    }
  }

  it('finalizes a committed install: marker present → remove journal only', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    await seedJournal(vault, true, true);
    const report = await installer.recoverInterrupted();
    expect(report.committed).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.rolledBack).toEqual([]);
    // committed install's files remain; journal removed
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBeDefined();
    expect(files[installedRecordPath('chest-ct', '1.0.0')]).toBeDefined();
    expect(files[transactionJournalPath('chest-ct', '1.0.0')]).toBeUndefined();
  });

  it('rolls back an incomplete install: marker absent → remove owned paths + journal', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    await seedJournal(vault, false, true);
    const report = await installer.recoverInterrupted();
    expect(report.rolledBack).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.committed).toEqual([]);
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBeUndefined();
    expect(files[transactionJournalPath('chest-ct', '1.0.0')]).toBeUndefined();
  });

  it('rolls back when the marker exists but its identity mismatches the journal slot (D15)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    // Seed a journal for chest-ct@1.0.0 but a marker carrying brain-mri@2.0.0 in
    // the chest-ct slot — a hand-moved/corrupted marker must not be trusted.
    const journalIO = new TransactionJournalIO(makeApp(vault) as never);
    const journal: TransactionJournal = {
      schema: TRANSACTIONS_SCHEMA, version: TRANSACTIONS_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', startedAt: '2026-01-01T00:00:00Z',
      entries: [{ path: 'Snippets/library/chest-ct/1-0-0/lung.md', kind: 'owned' }, { path: installedRecordPath('chest-ct', '1.0.0'), kind: 'marker' }],
    };
    await journalIO.write(journal, new WriteMutex());
    const mismatchedMarker = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'brain-mri', releaseVersion: '2.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/brain-mri/2-0-0/brain-mri.rp.json',
      snippetNamespace: 'Snippets/library/brain-mri/2-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    files[installedRecordPath('chest-ct', '1.0.0')] = JSON.stringify(mismatchedMarker, null, 2) + '\n';
    files['Snippets/library/chest-ct/1-0-0/lung.md'] = '# Lung content\n';
    const report = await installer.recoverInterrupted();
    expect(report.rolledBack).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.committed).toEqual([]);
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBeUndefined();
    expect(files[transactionJournalPath('chest-ct', '1.0.0')]).toBeUndefined();
  });

  it('returns an empty report when no transactions are in flight', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const report = await installer.recoverInterrupted();
    expect(report).toEqual({ committed: [], rolledBack: [] });
  });
});
```

### src/__tests__/library/library-service.test.ts — NEW
```typescript
import { describe, it, expect, vi } from 'vitest';
import { LibraryService } from '../../library/library-service';
import type { RegistryClient } from '../../library/registry-client';
import type { LibraryInstaller, InstallResult, UninstallResult, RecoveryReport } from '../../library/library-installer';
import { LibraryCacheStore } from '../../library/library-cache-store';
import { InstalledRecordStore } from '../../library/installed-record-store';
import {
  CATALOG_SNAPSHOT_SCHEMA, CATALOG_SNAPSHOT_VERSION,
  INSTALLED_RECORD_SCHEMA, INSTALLED_RECORD_VERSION,
  type CatalogEntry, type CatalogFetchResult, type ReleaseBundle,
} from '../../library/library-model';
import type { ReleaseFetchResult } from '../../library/registry-model';
import { installedRecordPath } from '../../library/installed-record-store';

function listPath(files: Record<string, string>, dirPath: string): { files: string[]; folders: string[] } {
  const prefix = dirPath === '' ? '' : dirPath + '/';
  const out: string[] = [];
  const folders = new Set<string>();
  for (const p of Object.keys(files)) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length);
    if (rest === '') continue;
    const slash = rest.indexOf('/');
    if (slash === -1) out.push(p);
    else folders.add(prefix + rest.slice(0, slash));
  }
  return { files: out, folders: [...folders] };
}

function makeVault(opts: { files?: Record<string, string> } = {}) {
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const vault = {
    adapter: {
      exists: vi.fn(async (p: string) => p in files || Object.keys(files).some((f) => f.startsWith(p === '' ? '' : p + '/'))),
      read: vi.fn(async (p: string) => { if (!(p in files)) throw new Error('ENOENT: ' + p); return files[p]; }),
      write: vi.fn(async (p: string, data: string) => { files[p] = data; }),
      list: vi.fn(async (p: string) => listPath(files, p)),
      remove: vi.fn(async (p: string) => { delete files[p]; }),
    },
    createFolder: vi.fn(async (_p: string) => { /* no-op */ }),
  };
  return { vault, files };
}
const makeApp = (vault: ReturnType<typeof makeVault>['vault']) => ({ vault } as unknown);

const SETTINGS = { protocolFolderPath: 'Protocols', snippetFolderPath: 'Snippets' };

function entry(packageId: string, title: string, cats: string[] = []): CatalogEntry {
  return {
    packageId, title, description: 'desc ' + packageId, author: { displayName: 'Dr ' + packageId },
    latestVersion: '1.0.0', categories: cats, updatedAt: '2026-01-01T00:00:00Z',
  };
}

function makeService(opts: {
  fetchCatalog?: CatalogFetchResult;
  fetchRelease?: ReleaseFetchResult;
  installResult?: InstallResult;
  uninstallResult?: UninstallResult;
  recovery?: RecoveryReport;
  files?: Record<string, string>;
} = {}) {
  const { vault } = makeVault({ files: opts.files });
  const app = makeApp(vault);
  const registryClient = {
    fetchCatalog: vi.fn(async () => opts.fetchCatalog ?? { status: 'unavailable', reason: 'no endpoint', cachedSnapshot: null }),
    fetchRelease: vi.fn(async () => opts.fetchRelease ?? { status: 'not-found', reason: 'not found' }),
  } as unknown as RegistryClient;
  const cacheStore = new LibraryCacheStore(app as never);
  const recordStore = new InstalledRecordStore(app as never);
  const installer = {
    install: vi.fn(async (_b: ReleaseBundle): Promise<InstallResult> => opts.installResult ?? { status: 'ok', packageId: 'chest-ct', releaseVersion: '1.0.0' }),
    uninstall: vi.fn(async (_p: string, _v: string): Promise<UninstallResult> => opts.uninstallResult ?? { status: 'ok', packageId: 'chest-ct', releaseVersion: '1.0.0' }),
    recoverInterrupted: vi.fn(async (): Promise<RecoveryReport> => opts.recovery ?? { committed: [], rolledBack: [] }),
  } as unknown as LibraryInstaller;
  const service = new LibraryService(app as never, SETTINGS, registryClient, { installer, cacheStore, recordStore });
  return { service, registryClient, installer, cacheStore, recordStore };
}

describe('LibraryService — listCatalog', () => {
  it('fetches and returns entries with available=true, caching the snapshot', async () => {
    const snap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: '2026-01-01T00:00:00Z', entries: [entry('chest-ct', 'Chest CT', ['radiology'])] };
    const { service, cacheStore } = makeService({ fetchCatalog: { status: 'ok', snapshot: snap } });
    const r = await service.listCatalog();
    expect(r.available).toBe(true);
    expect(r.entries).toHaveLength(1);
    expect(r.fetchedAt).toBe('2026-01-01T00:00:00Z');
    const cached = await cacheStore.readSnapshot();
    expect(cached?.entries).toHaveLength(1);
  });

  it('serves the cached snapshot when unavailable, with available=false + reason', async () => {
    const cachedSnap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: '2025-01-01T00:00:00Z', entries: [entry('brain-mri', 'Brain MRI')] };
    const files: Record<string, string> = { '.radiprotocol/library/catalog-cache.json': JSON.stringify(cachedSnap, null, 2) + '\n' };
    const { service } = makeService({ fetchCatalog: { status: 'unavailable', reason: 'no endpoint', cachedSnapshot: null }, files });
    const r = await service.listCatalog();
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no endpoint');
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.packageId).toBe('brain-mri');
    expect(r.fetchedAt).toBe('2025-01-01T00:00:00Z');
  });

  it('returns empty entries when unavailable and no cache', async () => {
    const { service } = makeService({ fetchCatalog: { status: 'unavailable', reason: 'down', cachedSnapshot: null } });
    const r = await service.listCatalog();
    expect(r.available).toBe(false);
    expect(r.entries).toEqual([]);
  });

  it('filters by free-text query (case-insensitive across title/description/author/categories)', async () => {
    const snap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: 't', entries: [entry('chest-ct', 'Chest CT', ['radiology']), entry('brain-mri', 'Brain MRI', ['neuro'])] };
    const { service } = makeService({ fetchCatalog: { status: 'ok', snapshot: snap } });
    const r = await service.listCatalog({ query: 'chest' });
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.packageId).toBe('chest-ct');
  });

  it('filters by exact category', async () => {
    const snap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: 't', entries: [entry('chest-ct', 'Chest CT', ['radiology']), entry('brain-mri', 'Brain MRI', ['neuro'])] };
    const { service } = makeService({ fetchCatalog: { status: 'ok', snapshot: snap } });
    const r = await service.listCatalog({ filter: 'neuro' });
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.packageId).toBe('brain-mri');
  });

  it('matches a query against the description field only (field isolation)', async () => {
    const a = entry('a', 'Alpha'); a.description = 'uniqueword';
    const b = entry('b', 'Beta');
    const snap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: 't', entries: [a, b] };
    const { service } = makeService({ fetchCatalog: { status: 'ok', snapshot: snap } });
    const r = await service.listCatalog({ query: 'uniqueword' });
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.packageId).toBe('a');
  });

  it('matches a query against the summary field', async () => {
    const a = entry('a', 'Alpha'); a.summary = 'hidden-term';
    const b = entry('b', 'Beta');
    const snap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: 't', entries: [a, b] };
    const { service } = makeService({ fetchCatalog: { status: 'ok', snapshot: snap } });
    const r = await service.listCatalog({ query: 'hidden-term' });
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.packageId).toBe('a');
  });
});

describe('LibraryService — install', () => {
  it('fetches the release and delegates to installer.install', async () => {
    const bundle = { manifest: { packageId: 'chest-ct', releaseVersion: '1.0.0' }, snippetContents: [] } as unknown as ReleaseBundle;
    const { service, registryClient, installer } = makeService({ fetchRelease: { status: 'ok', bundle } });
    const r = await service.install('chest-ct', '1.0.0');
    expect(r.status).toBe('ok');
    expect(registryClient.fetchRelease).toHaveBeenCalledWith('chest-ct', '1.0.0');
    expect(installer.install).toHaveBeenCalledWith(bundle);
  });

  it('returns failed on not-found without calling installer', async () => {
    const { service, installer } = makeService({ fetchRelease: { status: 'not-found', reason: 'no such release' } });
    const r = await service.install('chest-ct', '9.9.9');
    expect(r.status).toBe('failed');
    expect(r.reason).toContain('no such release');
    expect(installer.install).not.toHaveBeenCalled();
  });

  it('returns failed on unavailable', async () => {
    const { service } = makeService({ fetchRelease: { status: 'unavailable', reason: 'down' } });
    const r = await service.install('chest-ct', '1.0.0');
    expect(r.status).toBe('failed');
  });
});

describe('LibraryService — uninstall / listInstalled / recovery', () => {
  it('delegates uninstall to installer.uninstall', async () => {
    const { service, installer } = makeService({ uninstallResult: { status: 'ok', packageId: 'chest-ct', releaseVersion: '1.0.0' } });
    const r = await service.uninstall('chest-ct', '1.0.0');
    expect(r.status).toBe('ok');
    expect(installer.uninstall).toHaveBeenCalledWith('chest-ct', '1.0.0');
  });

  it('delegates listInstalled to recordStore.list and returns seeded records', async () => {
    const record = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json',
      snippetNamespace: 'Snippets/library/chest-ct/1-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    const files: Record<string, string> = { [installedRecordPath('chest-ct', '1.0.0')]: JSON.stringify(record, null, 2) + '\n' };
    const { service, recordStore } = makeService({ files });
    const spy = vi.spyOn(recordStore, 'list');
    const r = await service.listInstalled();
    expect(r).toHaveLength(1);
    expect(r[0]!.packageId).toBe('chest-ct');
    expect(spy).toHaveBeenCalled();
  });

  it('listInstalled returns [] when the store throws (dependency-throw safe-default)', async () => {
    const { service, recordStore } = makeService({});
    vi.spyOn(recordStore, 'list').mockRejectedValueOnce(new Error('store down'));
    const r = await service.listInstalled();
    expect(r).toEqual([]);
  });

  it('getInstalledRecord delegates to recordStore.read (seeded → record, missing → null)', async () => {
    const record = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json',
      snippetNamespace: 'Snippets/library/chest-ct/1-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    const files: Record<string, string> = { [installedRecordPath('chest-ct', '1.0.0')]: JSON.stringify(record, null, 2) + '\n' };
    const { service } = makeService({ files });
    expect((await service.getInstalledRecord('chest-ct', '1.0.0'))?.packageId).toBe('chest-ct');
    expect(await service.getInstalledRecord('chest-ct', '9.9.9')).toBe(null);
  });

  it('delegates recoverInterruptedInstalls to installer.recoverInterrupted', async () => {
    const { service, installer } = makeService({ recovery: { committed: [{ packageId: 'a', releaseVersion: '1' }], rolledBack: [] } });
    const r = await service.recoverInterruptedInstalls();
    expect(r.committed).toHaveLength(1);
    expect(installer.recoverInterrupted).toHaveBeenCalled();
  });
});
```

### src/__mocks__/obsidian.ts:line-range — MODIFY
```typescript
/** Mock requestUrl — tests inject a vi.fn() via RegistryClient options (D2).
 *  This default stub returns a 503 so a client constructed without the DI
 *  option fails safe (catalog unavailable) rather than crashing. Type-check
 *  resolves `obsidian` to the real obsidian.d.ts; this export is runtime-only. */
export function requestUrl(_request: unknown): Promise<{
  status: number;
  text: string;
  json: unknown;
  arrayBuffer: ArrayBuffer;
  headers: Record<string, string>;
}> {
  return Promise.resolve({ status: 503, text: '', json: {}, arrayBuffer: new ArrayBuffer(0), headers: {} });
}
```

### src/i18n/locales/en.json:line-range — MODIFY
```json
"library": {
  "viewTitle": "Community library",
  "refreshLabel": "Refresh",
  "refreshError": "Failed to refresh the library. See console for details.",
  "searchPlaceholder": "Search community library…",
  "filterLabel": "Category",
  "filterAll": "All categories",
  "catalogSection": "Catalog",
  "installedSection": "Installed",
  "unavailableBanner": "Catalog unavailable. Showing cached list. ({reason})",
  "unavailableNoCache": "Catalog unavailable: {reason}",
  "loading": "Loading…",
  "noEntries": "No catalog entries.",
  "noInstalled": "No installed packages.",
  "integrityVerified": "Integrity verified",
  "versionLabel": "Version",
  "authorLabel": "Author",
  "updatedLabel": "Updated",
  "latestLabel": "Latest: {version}",
  "categoriesLabel": "Categories",
  "installedAtLabel": "Installed",
  "catalogEntryAria": "Catalog entry: {title}",
  "installedEntryAria": "Installed package: {packageId} ({version})",
  "installLabel": "Install",
  "cancel": "Cancel",
  "close": "Close",
  "detailTitle": "Package details",
  "detailDescription": "Description",
  "detailFiles": "Files",
  "detailProtocolHash": "Protocol hash",
  "detailIntegrity": "Integrity will be verified on install (SHA-256). Publisher authenticity is not verified.",
  "detailLoading": "Loading release details…",
  "detailLoadFailed": "Failed to load release details: {reason}",
  "detailNotFound": "Release not found.",
  "installProgressLabel": "Installing {packageId} {version}",
  "installInstalling": "Installing…",
  "installComplete": "Installed successfully.",
  "installFailed": "Install failed: {reason}",
  "managedBadge": "Library",
  "readOnlyBanner": "Library package — read-only",
  "readOnlyNotice": "This item is part of an installed library package and is read-only."
}
```

```json
// settings.* additions (Slice 9) — append these keys to the existing "settings" object
"advancedHeading": "Advanced",
"libraryRegistryUrl": "Library registry URL",
"libraryRegistryUrlDesc": "Override the community library registry endpoint. Leave empty to use the bundled default; an invalid or non-https URL falls back to 'catalog unavailable'.",
"libraryRegistryUrlPlaceholder": "https://registry.example.com"
```

### src/i18n/locales/ru.json:line-range — MODIFY
```json
"library": {
  "viewTitle": "Библиотека сообщества",
  "refreshLabel": "Обновить",
  "refreshError": "Не удалось обновить библиотеку. Подробности в консоли.",
  "searchPlaceholder": "Поиск по библиотеке сообщества…",
  "filterLabel": "Категория",
  "filterAll": "Все категории",
  "catalogSection": "Каталог",
  "installedSection": "Установленные",
  "unavailableBanner": "Каталог недоступен. Показан кэшированный список. ({reason})",
  "unavailableNoCache": "Каталог недоступен: {reason}",
  "loading": "Загрузка…",
  "noEntries": "В каталоге нет записей.",
  "noInstalled": "Нет установленных пакетов.",
  "integrityVerified": "Целостность проверена",
  "versionLabel": "Версия",
  "authorLabel": "Автор",
  "updatedLabel": "Обновлено",
  "latestLabel": "Последняя: {version}",
  "categoriesLabel": "Категории",
  "installedAtLabel": "Установлено",
  "catalogEntryAria": "Запись каталога: {title}",
  "installedEntryAria": "Установленный пакет: {packageId} ({version})",
  "installLabel": "Установить",
  "cancel": "Отмена",
  "close": "Закрыть",
  "detailTitle": "Сведения о пакете",
  "detailDescription": "Описание",
  "detailFiles": "Файлы",
  "detailProtocolHash": "Хэш протокола",
  "detailIntegrity": "Целостность будет проверена при установке (SHA-256). Подлинность издателя не проверяется.",
  "detailLoading": "Загрузка сведений о выпуске…",
  "detailLoadFailed": "Не удалось загрузить сведения о выпуске: {reason}",
  "detailNotFound": "Выпуск не найден.",
  "installProgressLabel": "Установка {packageId} {version}",
  "installInstalling": "Установка…",
  "installComplete": "Установка завершена.",
  "installFailed": "Ошибка установки: {reason}",
  "managedBadge": "Библиотека",
  "readOnlyBanner": "Пакет библиотеки — только чтение",
  "readOnlyNotice": "Этот элемент входит в состав установленного пакета библиотеки и доступен только для чтения."
}
```

```json
// settings.* additions (Slice 9) — append these keys to the existing "settings" object
"advancedHeading": "Дополнительно",
"libraryRegistryUrl": "URL реестра библиотеки",
"libraryRegistryUrlDesc": "Переопределение адреса реестра библиотеки сообщества. Оставьте пустым для использования значения по умолчанию; недействительный или не-https URL приводит к состоянию «каталог недоступен».",
"libraryRegistryUrlPlaceholder": "https://registry.example.com"
```

### src/views/snippet-manager/tree-renderer.ts:line-range — MODIFY
```typescript
// src/views/snippet-manager/tree-renderer.ts — MODIFY (Slice 8)
// Library-managed read-only rendering: managed nodes get an installed-package
// badge, no add-button, suppressed edit/rename/drag, and drop-into-library is
// forbidden. The renderer is given installedRecords via render() options.

// ——— Imports (add next to `import type RadiProtocolPlugin from '../../main';`) ———
import { isLibraryManagedPath, findInstalledRecordForPath } from '../../library/library-paths';
import type { InstalledRecord } from '../../library/library-model';

// ——— Field (add next to `private selectedFolderPath = '';`) ———
  // Slice 8 — installed records for the library-managed indicator badge.
  private installedRecords: readonly InstalledRecord[] = [];

// ——— render(options): add installedRecords to the options interface + store ———
  render(options: {
    folderTree: TreeNodeFolder;
    snippets: TreeNodeFile[];
    selectedFolderPath: string;
    searchResults?: import('../../snippets/snippet-service').SnippetSearchResult[];
    searchQuery?: string;
    installedRecords?: readonly InstalledRecord[];
  }): void {
    // ...unchanged empty/reset...
    this.selectedFolderPath = options.selectedFolderPath;
    this.installedRecords = options.installedRecords ?? [];
    // ...unchanged heading creation + renderNode calls...
  }

// ——— renderNode: managed-node gating (insert after `this.rowLabelEls.set(node.path, labelEl);`) ———
    const snippetRoot = this.plugin.settings.snippetFolderPath;
    const managed = isLibraryManagedPath(node.path, snippetRoot);
    if (managed) {
      const record = findInstalledRecordForPath(this.installedRecords, node.path);
      const badge = row.createSpan({ cls: 'radi-snippet-tree-library-badge' });
      const badgeLabel = this.plugin.i18n.t('library.managedBadge');
      badge.setText(record !== null ? `${badgeLabel} · ${record.packageId} @ ${record.releaseVersion}` : badgeLabel);
      row.addClass('is-library-managed');
    }

// ——— Folder add-btn: render only for non-root, non-managed folders (replace `if (node.kind === 'folder' && !node.isRoot) {`) ———
    if (node.kind === 'folder' && !node.isRoot && !managed) {
      const actions = row.createSpan({ cls: 'radi-snippet-tree-actions' });
      const addBtn = createButton(actions, {
        cls: 'radi-snippet-tree-add-btn',
        attr: { 'aria-label': this.plugin.i18n.t('snippetManager.createInThisFolder') },
      });
      setIcon(addBtn, 'plus');
      addBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        void this.callbacks.openCreateModal(node.path);
      });
    }

// ——— click handler (replace the existing row.addEventListener('click', ...)) ———
    row.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (target !== null && target.closest('button') !== null && target !== row) return;
      if (node.kind === 'file') {
        if (managed) { new Notice(this.plugin.i18n.t('library.readOnlyNotice')); return; }
        void this.callbacks.openEditModal(node.path);
      } else {
        void this.callbacks.selectFolder(node.path);
      }
    });

// ——— contextmenu handler (replace existing) ———
    row.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (managed) { new Notice(this.plugin.i18n.t('library.readOnlyNotice')); return; }
      if (node.kind === 'folder' && node.isRoot) this.openRootContextMenu(event as MouseEvent);
      else this.openContextMenu(event as MouseEvent, node);
    });

// ——— keydown handler (replace existing) ———
    row.addEventListener('keydown', (event) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        keyEvent.preventDefault();
        if (node.kind === 'file') {
          if (managed) { new Notice(this.plugin.i18n.t('library.readOnlyNotice')); return; }
          void this.callbacks.openEditModal(node.path);
        } else {
          void this.callbacks.selectFolder(node.path);
          if (!node.isRoot) void this.callbacks.toggleFolder(node.path);
        }
      } else if (keyEvent.key === 'F2' && !(node.kind === 'folder' && node.isRoot) && !managed) {
        keyEvent.preventDefault();
        this.startInlineRename(node, labelEl);
      }
    });

// ——— draggable block (replace `if (!(node.kind === 'folder' && node.isRoot)) {`) ———
    if (!(node.kind === 'folder' && node.isRoot) && !managed) {
      row.setAttribute('draggable', 'true');
      row.addEventListener('dragstart', (event) =>
        this.handleDragStart(row, node, event as DragEvent));
      row.addEventListener('dragend', () => this.handleDragEnd(row));
    }

// ——— handleDragOver: managed-target forbidden (insert after `const target = this.computeDropTarget(node);`) ———
    if (isLibraryManagedPath(target, this.plugin.settings.snippetFolderPath)) {
      row.addClass('radi-snippet-tree-drop-forbidden');
      return;
    }
```

### src/views/snippet-manager-view.ts:line-range — MODIFY
```typescript
// src/views/snippet-manager-view.ts — MODIFY (Slice 8)
// Library-managed snippets render read-only with an installed-package
// indicator. installedRecords is part of the generation-guarded model
// (fetched in loadModel, committed in commitModel) so a stale refresh cannot
// overwrite it. Mutating callbacks get defense-in-depth guards (the renderer
// already suppresses; the view is the backstop). this.plugin.libraryService is
// wired in Slice 9 (forward reference, consistent with Slices 6-7).

// ——— Imports (add next to `import { SnippetManagerTreeRenderer } from './snippet-manager/tree-renderer';`) ———
import { isLibraryManagedPath } from '../library/library-paths';
import type { InstalledRecord } from '../library/library-model';

// ——— SnippetManagerModel interface (add installedRecords) ———
interface SnippetManagerModel {
  folderTree: TreeNodeFolder;
  snippets: TreeNodeFile[];
  selectedFolderPath: string;
  searchResults: SnippetSearchResult[];
  installedRecords: InstalledRecord[];
}

// ——— Field (add next to `private requestedFolderPath: string;`) ———
  // Slice 8 — installed records for the library-managed read-only indicator.
  private installedRecords: InstalledRecord[] = [];

// ——— loadModel: fetch records best-effort, part of the returned model ———
  private async loadModel(
    selectedFolderPath: string,
    query: string,
  ): Promise<SnippetManagerModel> {
    const folderTree = await this.loadFolderTree();
    const reconciledFolderPath = this.resolveSelectedFolder(folderTree, selectedFolderPath);
    const snippets = await this.loadSnippetData(reconciledFolderPath);
    const searchResults = query === ''
      ? []
      : await this.plugin.snippetService.searchSnippets(query);
    let installedRecords: InstalledRecord[] = [];
    try { installedRecords = await this.plugin.libraryService.listInstalled(); }
    catch { installedRecords = []; }
    return { folderTree, snippets, selectedFolderPath: reconciledFolderPath, searchResults, installedRecords };
  }

// ——— commitModel: commit installedRecords (runs only after ownsRefresh(generation)) ———
  private commitModel(model: SnippetManagerModel): void {
    this.folderTreeData = model.folderTree;
    this.snippetData = model.snippets;
    this.selectedFolderPath = model.selectedFolderPath;
    this.requestedFolderPath = model.selectedFolderPath;
    this.searchResults = model.searchResults;
    this.installedRecords = model.installedRecords;
  }

// ——— renderTree: pass installedRecords to the renderer ———
  private renderTree(): void {
    this.treeRenderer.setCurrentlyEditingPath(this.currentlyEditingPath);
    this.treeRenderer.render({
      folderTree: this.folderTreeData,
      snippets: this.snippetData,
      selectedFolderPath: this.selectedFolderPath,
      searchResults: this.searchQuery.trim() === '' ? undefined : this.searchResults,
      searchQuery: this.searchQuery,
      installedRecords: this.installedRecords,
    });
  }

// ——— Helper (add near shouldHandle) ———
  private isLibraryManagedSnippetPath(path: string): boolean {
    return isLibraryManagedPath(path, this.plugin.settings.snippetFolderPath);
  }

// ——— Defense-in-depth guards at the top of each mutating callback ———
  private async openEditModal(path: string): Promise<void> {
    if (this.isLibraryManagedSnippetPath(path)) { new Notice(this.plugin.i18n.t('library.readOnlyNotice')); return; }
    // ...existing body...
  }

  private async openCreateModal(folderPath: string): Promise<void> {
    if (this.isLibraryManagedSnippetPath(folderPath)) { new Notice(this.plugin.i18n.t('library.readOnlyNotice')); return; }
    // ...existing body...
  }

  private async handleCreateSubfolder(parentPath: string): Promise<void> {
    if (this.isLibraryManagedSnippetPath(parentPath)) { new Notice(this.plugin.i18n.t('library.readOnlyNotice')); return; }
    // ...existing body...
  }

  private async handleDeleteSnippet(path: string, name: string): Promise<void> {
    if (this.isLibraryManagedSnippetPath(path)) { new Notice(this.plugin.i18n.t('library.readOnlyNotice')); return; }
    // ...existing body...
  }

  private async handleDeleteFolder(path: string, name: string): Promise<void> {
    if (this.isLibraryManagedSnippetPath(path)) { new Notice(this.plugin.i18n.t('library.readOnlyNotice')); return; }
    // ...existing body...
  }

  private async openMovePicker(node: TreeNode): Promise<void> {
    if (this.isLibraryManagedSnippetPath(node.path)) { new Notice(this.plugin.i18n.t('library.readOnlyNotice')); return; }
    // ...existing body...
  }

  private async duplicateSnippet(path: string): Promise<void> {
    if (this.isLibraryManagedSnippetPath(path)) { new Notice(this.plugin.i18n.t('library.readOnlyNotice')); return; }
    // ...existing body...
  }

  private async performMove(srcPath: string, srcKind: 'file' | 'folder', dstFolder: string): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    if (this.isLibraryManagedSnippetPath(srcPath) || this.isLibraryManagedSnippetPath(dstFolder)) {
      new Notice(t('library.readOnlyNotice'));
      return;
    }
    // ...existing body...
  }
```


### src/views/protocol-editor-view.ts:line-range — MODIFY
```typescript
// src/views/protocol-editor-view.ts — MODIFY (Slice 8)
// Library-managed protocols are read-only. A `libraryReadOnly` flag is set in
// loadProtocol and a banner is rendered in renderShell. A single
// isLibraryReadOnly() helper guards every mutating entry point. Drag/resize
// get a SILENT gesture-start guard so managed nodes never visibly move/resize
// (the banner conveys state; a Notice on every mousedown would be noisy).

// ——— Import (add at top, after the obsidian import line) ———
import { isLibraryManagedPath } from '../library/library-paths';

// ——— Field (add next to `private protocolPath: string | null = null;`) ———
  private libraryReadOnly = false;

// ——— onClose reset block (where `this.protocolPath = null;` is set) ——— add:
    this.libraryReadOnly = false;

// ——— loadProtocol: set the flag after `this.protocolPath = file.path;` ———
    this.protocolPath = file.path;
    this.libraryReadOnly = isLibraryManagedPath(file.path, this.plugin.settings.protocolFolderPath);

// ——— renderShell: read-only banner after the `rp-protocol-editor-canvas-title` div ———
    if (this.libraryReadOnly) {
      const banner = workspace.createDiv({ cls: 'rp-protocol-editor-library-banner' });
      banner.createEl('span', { cls: 'radi-library-managed-badge', text: this.plugin.i18n.t('library.managedBadge') });
      banner.createEl('span', { text: this.plugin.i18n.t('library.readOnlyBanner') });
    }

// ——— Helper (add near the other private methods) ———
  /** Slice 8 — library-managed protocols are read-only. Returns true (and shows
   *  a Notice) when the loaded protocol lives under the managed library subtree,
   *  so every mutating entry point can early-return with a single guard. */
  private isLibraryReadOnly(): boolean {
    if (this.libraryReadOnly) {
      new Notice(this.plugin.i18n.t('library.readOnlyNotice'));
      return true;
    }
    return false;
  }

// ——— addNodeAtWorldPoint (:783) — after the doc/protocolPath null guard (DEFENSE-IN-DEPTH at the update site) ———
  private addNodeAtWorldPoint(kind: RPNodeKind | null, x: number, y: number, options: ProtocolEditorCreateNodeOptions = {}): void {
    if (this.doc === null || this.protocolPath === null) { options.onCreateAbandoned?.(); return; }
    if (this.isLibraryReadOnly()) { options.onCreateAbandoned?.(); return; }
    // ...existing body...
  }

// ——— addNodeAndConnectAtWorldPoint (:930) — after the doc/protocolPath null guard (DEFENSE-IN-DEPTH) ———
  private addNodeAndConnectAtWorldPoint(fromNodeId: string, kind: RPNodeKind | null, x: number, y: number, options: ProtocolEditorCreateNodeOptions = {}): void {
    if (this.doc === null || this.protocolPath === null) { options.onCreateAbandoned?.(); return; }
    if (this.isLibraryReadOnly()) { options.onCreateAbandoned?.(); return; }
    // ...existing body...
  }

// ——— openNodeKindPickerAtWorldPoint (:823) — after the doc/protocolPath null guard ———
  private openNodeKindPickerAtWorldPoint(x: number, y: number): void {
    if (this.doc === null || this.protocolPath === null) return;
    if (this.isLibraryReadOnly()) return;
    // ...existing body...
  }

// ——— openNodeKindPickerAndConnectAtWorldPoint (:877) — after the doc/protocolPath null guard ———
  private openNodeKindPickerAndConnectAtWorldPoint(fromNodeId: string, x: number, y: number): void {
    if (this.doc === null || this.protocolPath === null) return;
    if (this.isLibraryReadOnly()) return;
    // ...existing body...
  }

// ——— deleteEdge (:1371) — after the protocolPath null guard ———
  private async deleteEdge(edgeId: string): Promise<void> {
    if (this.protocolPath === null) return;
    if (this.isLibraryReadOnly()) return;
    try {
      await this.plugin.protocolDocumentStore.update(this.protocolPath, (existing) => {
        // ...existing mutator...
      });
      await this.loadProtocol(this.protocolPath);
    } catch (e) { /* ...existing... */ }
  }

// ——— finishConnectionDrag (:1504) — after the state/doc/protocolPath null guard ———
  private async finishConnectionDrag(ev: MouseEvent): Promise<void> {
    // ...existing state extraction...
    if (state === null || this.doc === null || this.protocolPath === null) return;
    if (this.isLibraryReadOnly()) return;
    // ...existing body (update + loadProtocol)...
  }

// ——— bindDrag (:1640) — SILENT guard in the mousedown handler before the gesture starts ———
  private bindDrag(nodeEl: HTMLElement, node: ProtocolNodeRecord): void {
    nodeEl.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('.rp-protocol-editor-port') !== null) return;
      if (this.libraryReadOnly) return;
      e.preventDefault();
      e.stopPropagation();
      // ...existing drag gesture (onMove mutates node.x/y; onUp calls saveNodeGeometry —
      //     never reached for managed protocols because the gesture never starts)...
    });
  }

// ——— bindResize (:1701) — SILENT guard in the mousedown handler before the gesture starts ———
  private bindResize(handleEl: HTMLElement, nodeEl: HTMLElement, node: ProtocolNodeRecord): void {
    handleEl.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (this.libraryReadOnly) return;
      e.preventDefault();
      e.stopPropagation();
      // ...existing resize gesture...
    });
  }

// ——— openSelfCheckModal persist (:~1576) — at the top of the inner `const persist = async () => {...}` ———
    const persist = async () => {
      if (this.isLibraryReadOnly()) return;
      // ...existing items + update...
    };

// ——— saveNodeGeometry (:1759) — after the protocolPath null guard ———
  private async saveNodeGeometry(node: ProtocolNodeRecord): Promise<void> {
    const protocolPath = this.protocolPath;
    if (protocolPath === null) return;
    if (this.isLibraryReadOnly()) return;
    // ...existing body...
  }

// ——— autoLayoutNodes (:1881) — after the doc/protocolPath null guard ———
  private autoLayoutNodes(direction: ProtocolEditorLayoutDirection): void {
    if (this.doc === null || this.protocolPath === null) return;
    if (this.isLibraryReadOnly()) return;
    // ...existing body (update + loadProtocol)...
  }

// ——— persistViewportState (:2087) — after the protocolPath/doc null guard ———
  private async persistViewportState(): Promise<void> {
    if (this.protocolPath === null || this.doc === null) return;
    if (this.isLibraryReadOnly()) return;
    this.clearPendingViewportSave();
    // ...existing body...
  }

// ——— openEdgeModal saveBtn click listener (:~2179) — at the top of the click handler, before `try {` ———
    saveBtn.addEventListener('click', async () => {
      // ...existing form-value gathering...
      if (this.isLibraryReadOnly()) return;
      try {
        const updated = await this.plugin.protocolDocumentStore.update(this.protocolPath!, (existing) => {
          // ...existing mutator...
        });
        // ...existing closeModal + Notice + loadProtocol...
      } catch (e) { /* ...existing... */ }
    });

// ——— openEditModal saveBtn click listener (:~2561) — at the top of the click handler, before `try {` ———
    saveBtn.addEventListener('click', async () => {
      // ...existing form-value gathering...
      if (this.isLibraryReadOnly()) return;
      try {
        await this.plugin.protocolDocumentStore.update(this.protocolPath!, (existing) => {
          // ...existing mutator...
        });
        // ...existing closeModal + Notice + loadProtocol...
      } catch (e) { /* ...existing... */ }
    });

// ——— openEditModal delete-confirmBtn click listener (:~2602) — at the top of the click handler ———
    confirmBtn.addEventListener('click', async () => {
      if (this.isLibraryReadOnly()) return;
      const protocolPath = this.protocolPath!;
      const generation = this.loadGeneration;
      // ...existing body (update + closeModal + loadProtocol)...
    });
```


### src/views/protocol-picker-modal.ts:line-range — MODIFY
```typescript
// src/views/protocol-picker-modal.ts — MODIFY (Slice 8)
// Component-level library-managed indicator: both SuggestModals accept an
// optional LibraryPickerContext and render a badge for library-managed
// protocols when provided. Runtime wiring (passing listInstalled() + the
// protocol root) is done by the caller in Slice 9 (main.ts). When the context
// is omitted the pickers behave exactly as before.

// ——— Imports (add at top) ———
import type { Translator } from '../i18n';
import type { InstalledRecord } from '../library/library-model';
import { isLibraryManagedPath, findInstalledRecordForPath } from '../library/library-paths';

/** Slice 8 — context for the library-managed indicator badge on picker
 *  suggestions. Optional; when omitted the picker behaves as before.
 *  Runtime wiring is done by the caller in Slice 9 (main.ts). */
export interface LibraryPickerContext {
  /** Vault-relative protocol root (e.g. 'Protocols') for managed-path detection. */
  protocolRoot: string;
  /** Current installed records (from LibraryService.listInstalled()). */
  installedRecords: readonly InstalledRecord[];
}

// ——— ProtocolPickerSuggestModal — add optional ctor params + badge rendering ———
export class ProtocolPickerSuggestModal extends SuggestModal<ProtocolPickerSuggestion> {
  constructor(
    app: App,
    private readonly protocolFiles: TFile[],
    private readonly onChoose: (item: ProtocolPickerSuggestion) => void,
    private readonly libraryContext?: LibraryPickerContext,
    private readonly t?: Translator,
  ) {
    super(app);
  }

  getSuggestions(query: string): ProtocolPickerSuggestion[] {
    const q = query.toLowerCase();
    return this.protocolFiles
      .map(f => ({ file: f, name: protocolDisplayName(f) }))
      .filter(item => item.name.toLowerCase().includes(q));
  }

  renderSuggestion(item: ProtocolPickerSuggestion, el: HTMLElement): void {
    el.createEl('div', { text: item.name });
    this.renderLibraryBadge(item.file.path, el);
  }

  onChooseSuggestion(item: ProtocolPickerSuggestion): void {
    this.onChoose(item);
  }

  private renderLibraryBadge(path: string, el: HTMLElement): void {
    if (this.libraryContext === undefined || this.t === undefined) return;
    if (!isLibraryManagedPath(path, this.libraryContext.protocolRoot)) return;
    const record = findInstalledRecordForPath(this.libraryContext.installedRecords, path);
    const badge = el.createEl('span', { cls: 'radi-library-managed-badge' });
    const label = this.t('library.managedBadge');
    badge.setText(record !== null ? `${label} · ${record.packageId} @ ${record.releaseVersion}` : label);
  }
}

// ——— ProtocolEditorPickerModal — add optional libraryContext ctor param + badge on existing items ———
export class ProtocolEditorPickerModal extends SuggestModal<ProtocolEditorPickerSuggestion> {
  private lastQuery = '';

  constructor(
    app: App,
    private readonly protocolFiles: TFile[],
    private readonly t: (key: string, vars?: Record<string, string>) => string,
    private readonly onOpenExisting: (file: TFile) => void,
    private readonly onCreate: (title: string) => void,
    private readonly libraryContext?: LibraryPickerContext,
  ) {
    super(app);
    this.setPlaceholder(this.t('protocolEditor.openPickerPlaceholder'));
  }

  getSuggestions(query: string): ProtocolEditorPickerSuggestion[] {
    this.lastQuery = query.trim();
    const q = this.lastQuery.toLowerCase();
    const existing = this.protocolFiles
      .map(file => ({ kind: 'existing' as const, file, name: protocolDisplayName(file) }))
      .filter(item => item.name.toLowerCase().includes(q));

    if (this.lastQuery === '') return existing;
    if (existing.some(item => item.name.toLowerCase() === q)) return existing;
    return [{ kind: 'create', title: this.lastQuery }, ...existing];
  }

  renderSuggestion(item: ProtocolEditorPickerSuggestion, el: HTMLElement): void {
    if (item.kind === 'create') {
      el.createEl('div', { text: this.t('protocolEditor.createProtocolSuggestion', { title: item.title }) });
      el.createEl('small', { text: this.t('protocolEditor.createProtocolHint') });
      return;
    }
    el.createEl('div', { text: item.name });
    el.createEl('small', { text: item.file.path });
    this.renderLibraryBadge(item.file.path, el);
  }

  onChooseSuggestion(item: ProtocolEditorPickerSuggestion): void {
    if (item.kind === 'create') { this.onCreate(item.title); return; }
    this.onOpenExisting(item.file);
  }

  private renderLibraryBadge(path: string, el: HTMLElement): void {
    if (this.libraryContext === undefined) return;
    if (!isLibraryManagedPath(path, this.libraryContext.protocolRoot)) return;
    const record = findInstalledRecordForPath(this.libraryContext.installedRecords, path);
    const badge = el.createEl('span', { cls: 'radi-library-managed-badge' });
    const label = this.t('library.managedBadge');
    badge.setText(record !== null ? `${label} · ${record.packageId} @ ${record.releaseVersion}` : label);
  }
}
```


### src/main.ts:line-range — MODIFY
```typescript
// src/main.ts — MODIFY (Slice 9 — terminal slice)
// Wires the community library: constructs RegistryClient + LibraryService onto
// the plugin (the forward reference Slices 6-8 views consume), registers the
// LibraryView + command, runs interrupted-install recovery on load, and
// threads the library-managed indicator context into the 3 protocol picker
// sites (all using the normalized protocol root so isLibraryManagedPath
// matches resolver-enumerated paths).

// ——— Imports ——— extend the existing protocol-picker-modal import with LibraryPickerContext:
import {
  ProtocolEditorPickerModal,
  ProtocolPickerSuggestModal,
  protocolDisplayName,
  protocolDocumentId,
  type ProtocolEditorPickerSuggestion,
  type ProtocolPickerSuggestion,
  type LibraryPickerContext,
} from './views/protocol-picker-modal';
// ——— New imports (add near the other view/service imports) ———
import { LibraryView, LIBRARY_VIEW_TYPE } from './views/library-view';
import { RegistryClient, DEFAULT_REGISTRY_URL } from './library/registry-client';
import { LibraryService } from './library/library-service';
import type { InstalledRecord } from './library/library-model';

// ——— Plugin fields (add near the other service fields, after snippetService) ———
  registryClient!: RegistryClient;
  libraryService!: LibraryService;

// ——— onload ——— after `this.snippetService = new SnippetService(...)` and before the registerView blocks:
    // Slice 9 — community library services (wired here; consumed by Slices 6-8 views).
    // libraryRegistryUrl is the advanced override (empty/undefined → DEFAULT_REGISTRY_URL
    // → "catalog unavailable" when the bundled default is also empty).
    this.registryClient = new RegistryClient({ baseUrl: this.settings.libraryRegistryUrl || DEFAULT_REGISTRY_URL });
    this.libraryService = new LibraryService(this.app, this.settings, this.registryClient, { t: this.i18n.t.bind(this.i18n) });
    // Recovery on load: finalize any in-flight installs (never throws — rolls back
    // journals without a commit marker, commits valid ones). Runs before views are
    // registered so no user action can race a recovering install.
    await this.libraryService.recoverInterruptedInstalls();

// ——— Register LibraryView + command ——— add after the `addCommand({ id: 'open-snippet-manager', ... })` block:
    // Slice 9 — Register LibraryView ItemView (community library, D4 first-class view)
    this.registerView(LIBRARY_VIEW_TYPE, (leaf) => new LibraryView(leaf, this));

    // Command: open-community-library (NFR-06: no plugin name prefix)
    this.addCommand({
      id: 'open-community-library',
      name: 'Open community library',
      callback: () => { void this.activateLibraryView(); },
    });

// ——— activateLibraryView ——— add after `activateSnippetManagerView()`:
  /** Slice 9 — activate the community library view (get-or-create leaf, modeled
   *  after activateSnippetManagerView). */
  async activateLibraryView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(LIBRARY_VIEW_TYPE)[0];
    const leaf = existing ?? workspace.getLeaf(false);
    if (leaf === null) return;
    if (existing === undefined) {
      await leaf.setViewState({ type: LIBRARY_VIEW_TYPE, active: true });
    }
    void workspace.revealLeaf(leaf);
  }

// ——— buildLibraryPickerContext ——— add near the other private helpers:
  /** Slice 9 — build the library-managed indicator context for protocol pickers.
   *  Best-effort: a listInstalled() failure yields an empty record list (no badge),
   *  never a throw. protocolRoot is the vault-relative protocol folder the picker
   *  is enumerating. */
  private async buildLibraryPickerContext(protocolRoot: string): Promise<LibraryPickerContext> {
    let installedRecords: InstalledRecord[] = [];
    try { installedRecords = await this.libraryService.listInstalled(); }
    catch { installedRecords = []; }
    return { protocolRoot, installedRecords };
  }

// ——— Picker site 1: handleOpenProtocolEditor ——— insert `const libraryContext = await this.buildLibraryPickerContext(folderPath);` before the modal and pass it as the 6th ctor arg:
  private async handleOpenProtocolEditor(): Promise<void> {
    const folderPath = normalizeProtocolFolderPath(this.settings.protocolFolderPath);
    if (folderPath === '') {
      new Notice(this.i18n.t('protocolEditor.setProtocolFolderFirst'));
      await this.activateProtocolEditorView();
      return;
    }

    const protocolFiles = resolveProtocolDocumentFiles(this.app.vault, folderPath);
    const libraryContext = await this.buildLibraryPickerContext(folderPath);
    const modal = new ProtocolEditorPickerModal(
      this.app,
      protocolFiles,
      this.i18n.t.bind(this.i18n),
      (file) => { this.pickerModal = null; void this.activateProtocolEditorView(file.path); },
      (title) => { this.pickerModal = null; void this.createAndOpenProtocol(folderPath, title); },
      libraryContext,
    );
    this.pickerModal = modal;
    modal.open();
  }

// ——— Picker site 2: handleStartFromProtocolNode ——— NORMALIZED root + libraryContext + t:
    const folderPath = normalizeProtocolFolderPath(this.settings.protocolFolderPath);
    if (folderPath === '') {
      new Notice(this.i18n.t('protocolEditor.setProtocolFolderFirst'));
      return;
    }

    const protocolFiles = resolveProtocolDocumentFiles(this.app.vault, folderPath);
    if (protocolFiles.length === 0) {
      new Notice(this.i18n.t('command.noProtocolFiles', { folderPath }));
      return;
    }

    const libraryContext = await this.buildLibraryPickerContext(folderPath);
    this.pickerModal = new ProtocolPickerSuggestModal(
      this.app,
      protocolFiles,
      (item) => { this.pickerModal = null; void this.openProtocolStartNodePicker(item.file, activeFile); },
      libraryContext,
      this.i18n.t.bind(this.i18n),
    );
    this.pickerModal.open();

// ——— Picker site 3: handleRunProtocolInline ——— NORMALIZED root + libraryContext + t:
    const folderPath = normalizeProtocolFolderPath(this.settings.protocolFolderPath);
    if (folderPath === '') {
      new Notice(this.i18n.t('command.setProtocolFolder'));
      return;
    }

    const protocolFiles = resolveProtocolDocumentFiles(this.app.vault, folderPath);
    if (protocolFiles.length === 0) {
      new Notice(this.i18n.t('command.noProtocolFiles', { folderPath }));
      return;
    }

    const libraryContext = await this.buildLibraryPickerContext(folderPath);
    this.pickerModal = new ProtocolPickerSuggestModal(
      this.app,
      protocolFiles,
      (item) => { this.pickerModal = null; void this.openInlineRunner(item.file, activeFile); },
      libraryContext,
      this.i18n.t.bind(this.i18n),
    );
    this.pickerModal.open();
```


### src/settings.ts:line-range — MODIFY
```typescript
// src/settings.ts — MODIFY (Slice 9)
// Advanced section: libraryRegistryUrl override (empty → bundled default →
// "catalog unavailable"; non-https/invalid normalized to '' by the registry client).

// ——— RadiProtocolSettings interface ——— add after the `locale` field:
  /** Slice 9 — community library registry endpoint override (advanced).
   *  Empty/undefined → bundled DEFAULT_REGISTRY_URL (empty → "catalog unavailable").
   *  Non-https/invalid URLs are normalized to '' by the registry client. */
  libraryRegistryUrl?: string;

// ——— DEFAULT_SETTINGS ——— add:
  libraryRegistryUrl: '',

// ——— display(): Advanced section ——— insert after the snippetFolder Setting and before the donate heading:
    // Group — Advanced (Slice 9 — community library)
    new Setting(containerEl).setName(this.plugin.i18n.t('settings.advancedHeading')).setHeading();

    new Setting(containerEl)
      .setName(this.plugin.i18n.t('settings.libraryRegistryUrl'))
      .setDesc(this.plugin.i18n.t('settings.libraryRegistryUrlDesc'))
      .addText(text => {
        text
          .setPlaceholder(this.plugin.i18n.t('settings.libraryRegistryUrlPlaceholder'))
          .setValue(this.plugin.settings.libraryRegistryUrl ?? '')
          .onChange(async (value) => {
            this.plugin.settings.libraryRegistryUrl = value.trim();
            await this.plugin.saveSettings();
          });
      });
```


### scripts/check-consistency.mjs:line-range — MODIFY
```javascript
// scripts/check-consistency.mjs — MODIFY (Slice 9)
// Net-new en/ru i18n key-set parity gate. Already enrolled in `npm run check`
// (the "consistency" step) — adding a check here automatically wires it in.

// ——— Check 7: en/ru i18n key parity ——— insert BEFORE the final summary block (`console.log('\n═══...`):
console.log('\n▸ Check 7: en/ru i18n key parity');
const enLocale = readJson('src/i18n/locales/en.json');
const ruLocale = readJson('src/i18n/locales/ru.json');
function flatKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix === '' ? k : `${prefix}.${k}`;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) keys.push(...flatKeys(v, path));
    else keys.push(path);
  }
  return keys;
}
const enKeys = new Set(flatKeys(enLocale));
const ruKeys = new Set(flatKeys(ruLocale));
const missingInRu = [...enKeys].filter((k) => !ruKeys.has(k));
const missingInEn = [...ruKeys].filter((k) => !enKeys.has(k));
if (missingInRu.length > 0) fail(`en.json keys missing from ru.json: ${missingInRu.join(', ')}`);
if (missingInEn.length > 0) fail(`ru.json keys missing from en.json: ${missingInEn.join(', ')}`);
if (missingInRu.length === 0 && missingInEn.length === 0) info(`OK: en/ru i18n key sets match (${enKeys.size} keys)`);
```


## Slices

### Slice 1: Pure model + paths + integrity (foundation types)

**Files**: `src/library/library-model.ts`, `src/library/library-paths.ts`, `src/library/integrity.ts`, `src/__tests__/library/library-model.test.ts`, `src/__tests__/library/library-paths.test.ts`, `src/__tests__/library/integrity.test.ts`

#### Automated Verification:
- [ ] Type checking passes: `npm run build`
- [ ] Tests pass: `npm test`

#### Manual Verification:
- [ ] Pure modules have zero Obsidian imports (`grep -r "from 'obsidian'" src/library/library-model.ts src/library/library-paths.ts src/library/integrity.ts` returns nothing)

### Slice 2: Registry client + API types + network mock

**Files**: `src/library/registry-model.ts`, `src/library/registry-client.ts`, `src/__mocks__/obsidian.ts`, `src/__tests__/library/registry-client.test.ts`

#### Automated Verification:
- [ ] Type checking passes: `npm run build`
- [ ] Tests pass: `npm test`

#### Manual Verification:
- [ ] Empty `baseUrl` → `RegistryClient` returns an explicit "catalog unavailable" state (no throw)
- [ ] Non-`https` URL rejected in production-mode validation

### Slice 3: Cache + installed-record stores

**Files**: `src/library/library-json-io.ts`, `src/library/library-cache-store.ts`, `src/library/installed-record-store.ts`, `src/__tests__/library/library-cache-store.test.ts`, `src/__tests__/library/installed-record-store.test.ts`

#### Automated Verification:
- [ ] Type checking passes: `npm run build`
- [ ] Tests pass: `npm test`

#### Manual Verification:
- [ ] Missing store file → empty initial state (no throw)
- [ ] Malformed store file → explicit recoverable error (NOT silent reset)

### Slice 4: Transaction journal + transactional installer

**Files**: `src/library/transaction-journal.ts`, `src/library/library-installer.ts`, `src/__tests__/library/library-installer.test.ts`

#### Automated Verification:
- [ ] Type checking passes: `npm run build`
- [ ] Tests pass: `npm test`

#### Manual Verification:
- [ ] Failed verification mid-install → staged owned paths removed, no manifest written, vault restored to pre-install state
- [ ] Manifest written LAST (commit marker); absence after interrupt → recovery rolls back

### Slice 5: Library service facade (catalog, install, uninstall, recovery)

**Files**: `src/library/library-service.ts` (NEW), `src/__tests__/library/library-service.test.ts` (NEW), `src/library/library-installer.ts` (MODIFY — add `uninstall` + `removeOwnedPaths` refactor shared with `rollbackTransaction`), `src/__tests__/library/library-installer.test.ts` (MODIFY — uninstall tests)

#### Automated Verification:
- [ ] Type checking passes: `npm run build`
- [ ] Tests pass: `npm test`

#### Manual Verification:
- [ ] `recoverInterruptedInstalls()` returns a report finalizing in-flight journals (committed when marker valid; rolled back when absent/invalid) — the on-load wiring itself is Slice 9
- [ ] Catalog list returns cached snapshot when "catalog unavailable"

### Slice 6: LibraryView ItemView + i18n library.* block

**Files**: `src/views/library-view.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`

#### Automated Verification:
- [ ] Type checking passes: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] en/ru `library.*` key sets are identical: `node -e "const e=Object.keys(require('./src/i18n/locales/en.json').library).sort().join();const r=Object.keys(require('./src/i18n/locales/ru.json').library).sort().join();process.exit(e===r?0:1)"` exits 0
- [ ] Integrity label never implies authenticity: `grep -in "trusted" src/views/library-view.ts` returns nothing
- [ ] CatalogListResult imported from the service layer: `grep -n "CatalogListResult" src/views/library-view.ts` shows import from `../library/library-service`
- [ ] Watcher anchored to the installed-records dir: `grep -n "LIBRARY_INSTALLED_DIR" src/views/library-view.ts` returns >= 3 (constant def + 2 shouldHandle refs)
- [ ] Search/filter do not fetch (client-side): `grep -n "listCatalog" src/views/library-view.ts` shows a call only inside `refresh()`

#### Manual Verification:
- [ ] LibraryView opens as a first-class view via command (Slice 9 wires the command); catalog list + search + category filter render
- [ ] Search and category filter re-filter the loaded catalog instantly without a network fetch; the category dropdown lists all categories from the unfiltered catalog (an active filter does not strand the dropdown)
- [ ] Installed list shows installed packages with version + integrity-verified indicator (never an authenticity claim)
- [ ] Catalog-unavailable state shows an explicit banner (cached list when a cached snapshot exists; reason-only when no cache)
- [ ] No refresh self-cycle: an install completion (marker write under installed/) triggers one refresh; the catalog-cache write does not trigger a refresh

### Slice 7: Item detail + install progress modals

**Files**: `src/views/library-item-detail-modal.ts` (NEW), `src/views/library-install-progress-modal.ts` (NEW), `src/library/library-service.ts` (MODIFY — add `getReleaseManifest` + `ReleaseManifestResult`), `src/views/library-view.ts` (MODIFY — click→detail wiring + openInstall + keyboard activation), `src/i18n/locales/en.json` (MODIFY — extend library.* by 15 keys), `src/i18n/locales/ru.json` (MODIFY — extend library.* by 15 keys)

#### Automated Verification:
- [ ] Type checking passes: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] en/ru `library.*` key sets identical: `node -e "const e=Object.keys(require('./src/i18n/locales/en.json').library).sort().join();const r=Object.keys(require('./src/i18n/locales/ru.json').library).sort().join();process.exit(e===r?0:1)"` exits 0
- [ ] Integrity label never implies authenticity: `grep -in "trusted" src/views/library-item-detail-modal.ts src/views/library-install-progress-modal.ts` returns nothing
- [ ] ARIA progressbar: `grep -n 'role.*progressbar' src/views/library-install-progress-modal.ts` returns a match; `grep -nE "aria-valuemin|aria-valuemax|aria-valuenow|aria-label" src/views/library-install-progress-modal.ts` returns >= 4
- [ ] Exhaustive state dispatch: `grep -n "_exhaustive: never" src/views/library-install-progress-modal.ts` returns a match
- [ ] Keyboard activation (WCAG 2.2 AA): `grep -n "tabindex" src/views/library-view.ts` returns a match in renderCatalogEntry; `grep -n "keydown" src/views/library-view.ts` returns a match
- [ ] Views consume the service, not RegistryClient: `grep -n "registryClient" src/views/library-item-detail-modal.ts src/views/library-install-progress-modal.ts src/views/library-view.ts` returns nothing
- [ ] No duplicate completion refresh: `grep -n "this.refresh" src/views/library-view.ts` shows no call inside openInstall

#### Manual Verification:
- [ ] Item detail modal shows trust preview (author, version, file list + SHA-256 hashes, integrity framing) and an Install button; the Install button is DISABLED until the manifest loads and stays disabled on manifest failure (trust preview before download); "integrity verified" framing only, never an authenticity claim
- [ ] Install progress modal renders exhaustive state dispatch (installing/complete/failed) + ARIA progressbar; indeterminate during installing (aria-valuenow omitted per ARIA spec), 100% on complete, 0% on failed
- [ ] Catalog entry rows are keyboard-focusable (tabindex=0) and activatable (Enter/Space), WCAG 2.2 AA; click opens the detail modal; Install opens the progress modal; the Slice 6 watcher refreshes on the marker write (no explicit duplicate refresh)
- [ ] Atomic install() does not emit stage events (Slices 4-5 locked) — no fake stage transitions

### Slice 8: Existing-views integration (read-only for managed items)

**Files**: `src/library/library-paths.ts` (MODIFY — additive `findInstalledRecordForPath`), `src/views/snippet-manager/tree-renderer.ts` (MODIFY), `src/views/snippet-manager-view.ts` (MODIFY), `src/views/protocol-editor-view.ts` (MODIFY), `src/views/protocol-picker-modal.ts` (MODIFY — component-level), `src/i18n/locales/en.json` (MODIFY — +3 keys), `src/i18n/locales/ru.json` (MODIFY — +3 keys)

#### Automated Verification:
- [ ] Type checking passes: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] en/ru `library.*` key sets are identical: `node -e "const e=Object.keys(require('./src/i18n/locales/en.json').library).sort().join();const r=Object.keys(require('./src/i18n/locales/ru.json').library).sort().join();process.exit(e===r?0:1)"` exits 0
- [ ] Pure path-matching helper added: `grep -n "findInstalledRecordForPath" src/library/library-paths.ts` returns a match
- [ ] Read-only gating present across the integration surface: `grep -n "isLibraryManagedPath" src/views/snippet-manager-view.ts src/views/protocol-editor-view.ts src/views/protocol-picker-modal.ts src/views/snippet-manager/tree-renderer.ts` returns >= 4 matches
- [ ] Editor read-only flag wired: `grep -n "libraryReadOnly" src/views/protocol-editor-view.ts` returns >= 5 matches
- [ ] Drag/resize blocked at gesture start for managed protocols: `grep -n "this.libraryReadOnly" src/views/protocol-editor-view.ts` returns >= 4 matches
- [ ] Installed records are generation-guarded (part of the model, not a top-of-refresh side fetch): `grep -n "installedRecords" src/views/snippet-manager-view.ts` shows matches in the `SnippetManagerModel` interface, `loadModel` return, `commitModel`, the field, and `renderTree` (>= 5)
- [ ] Picker indicator is component-level (no Slice 8 caller wiring): `grep -n "libraryContext" src/views/protocol-picker-modal.ts` returns >= 4 matches
- [ ] No authenticity implication in new code: `grep -in "trusted" src/views/snippet-manager-view.ts src/views/protocol-editor-view.ts src/views/protocol-picker-modal.ts src/views/snippet-manager/tree-renderer.ts src/library/library-paths.ts` returns nothing

#### Manual Verification:
- [ ] Library-managed snippets under `Snippets/library/...` render read-only in SnippetManagerView: not editable (double-click/Enter shows a Notice), not deletable (context menu suppressed with a Notice), not movable (no drag handle; dropping into a library folder is forbidden), and show an installed-package badge (packageId @ version when a record is found)
- [ ] Library-managed protocols render read-only in the protocol editor: a "Library package — read-only" banner shows; node create (kind-picker + addNode helpers blocked), node delete, edge delete, connection draw, node drag/resize (gesture never starts — no visible mutation), auto-layout, self-check save, edge edit, and viewport persist are all blocked; pan/zoom view adjustments still work locally but do not persist
- [ ] Protocol picker modals render an installed-package indicator badge for library-managed protocols when `libraryContext` is provided (component-level; runtime wiring is Slice 9); when omitted, behavior is unchanged
- [ ] Runner pickers still discover library-managed protocols/snippets (unchanged — out of scope)


### Slice 9: main.ts wiring + settings + parity gate

**Files**: `src/main.ts` (MODIFY), `src/settings.ts` (MODIFY), `scripts/check-consistency.mjs` (MODIFY — en/ru parity gate), `src/i18n/locales/en.json` (MODIFY — +4 settings.* keys), `src/i18n/locales/ru.json` (MODIFY — +4 settings.* keys)

#### Automated Verification:
- [ ] Full build passes: `npm run build`
- [ ] Full test suite passes: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] Whole-repo check passes: `npm run check` (build + lint + tests + planning + consistency + agent-docs, now including the en/ru i18n key parity gate)
- [ ] Library view registered: `grep -n "registerView(LIBRARY_VIEW_TYPE" src/main.ts` returns a match
- [ ] Library command added: `grep -n "'open-community-library'" src/main.ts` returns a match
- [ ] Services wired onto the plugin: `grep -n "this.libraryService = new LibraryService\|this.registryClient = new RegistryClient" src/main.ts` returns >= 2 matches
- [ ] Recovery on load: `grep -n "recoverInterruptedInstalls" src/main.ts` returns a match
- [ ] Picker indicator wired at all 3 construction sites: `grep -n "buildLibraryPickerContext\|libraryContext" src/main.ts` returns >= 4 matches (helper def + 3 sites)
- [ ] All 3 picker sites use the normalized protocol root: `grep -n "normalizeProtocolFolderPath(this.settings.protocolFolderPath)" src/main.ts` returns >= 3 matches
- [ ] Settings override field: `grep -n "libraryRegistryUrl" src/settings.ts` returns >= 3 matches
- [ ] Parity gate added: `grep -n "i18n key parity\|flatKeys" scripts/check-consistency.mjs` returns >= 2 matches
- [ ] en/ru settings.* key parity (4 new keys each): `node -e "const e=require('./src/i18n/locales/en.json').settings;const r=require('./src/i18n/locales/ru.json').settings;const need=['advancedHeading','libraryRegistryUrl','libraryRegistryUrlDesc','libraryRegistryUrlPlaceholder'];process.exit(need.every(k=>e[k]!==undefined&&r[k]!==undefined)?0:1)"` exits 0
- [ ] No authenticity implication in new code: `grep -in "trusted" src/main.ts src/settings.ts scripts/check-consistency.mjs` returns nothing

#### Manual Verification:
- [ ] Command palette shows "Open community library"; the LibraryView opens as a first-class sidebar view (Slices 6-7 catalog + modals now functional end-to-end)
- [ ] Advanced settings section exposes `libraryRegistryUrl` override (empty → default → "catalog unavailable"); an invalid or non-https URL → "catalog unavailable" banner, no crash
- [ ] Interrupted-install recovery runs on plugin load (an interrupted install is finalized or rolled back; the vault is left clean — Slice 4 recovery exercised through the Slice 9 on-load wiring)
- [ ] Protocol picker suggestions show the installed-package indicator badge for library-managed protocols at all 3 picker entry points, including when the protocol folder setting has a trailing slash or backslash (all 3 sites normalize the root before managed-path detection)
- [ ] `npm run check` fails when a key exists in en.json but not ru.json (and vice versa) — verified by temporarily removing a RU key (the Slice 9 parity gate enforces it)


## Desired End State

A radiologist opens the community library via the command palette ("Open community library"). The `LibraryView` opens as a first-class sidebar view, fetches the official catalog (or shows the cached snapshot + "catalog unavailable" banner when offline/no endpoint), and lists browsable protocols with search and filters. Selecting an item opens a trust-preview modal showing the author, version, file list, and **integrity-verified** status (never "trusted publisher" — signature is deferred). Clicking Install opens a progress modal with an ARIA progressbar that walks: download → stage into `.radiprotocol/library/` → SHA-256 verify → graph-validate the staged protocol → rewrite snippet references to the immutable namespace → commit. On success the protocol appears at `Protocols/library/<packageId>/<version>/` and its snippets at `Snippets/library/<packageId>/<version>/`, immediately selectable in the existing protocol/snippet pickers and runnable by the inline runner (instant reuse). In `SnippetManagerView` and the protocol editor, those managed items render read-only with a clear installed-package indicator. If Obsidian crashes mid-install, the next plugin load detects the journal without a commit marker and rolls back the staged owned paths, leaving the vault clean.

```typescript
// main.ts wiring (consumer perspective)
this.registryClient = new RegistryClient({ baseUrl: this.settings.libraryRegistryUrl || DEFAULT_REGISTRY_URL });
this.libraryService = new LibraryService(this.app, this.settings, this.registryClient, this.i18n.t.bind(this.i18n));
this.registerView(LIBRARY_VIEW_TYPE, (leaf) => new LibraryView(leaf, this));
this.addCommand({ id: 'open-community-library', name: 'Open community library', callback: () => void this.activateLibraryView() });
await this.libraryService.recoverInterruptedInstalls(); // on load

// LibraryView consumer
const items = await this.plugin.libraryService.listCatalog({ query: 'chest', filter: 'radiology' });
const installed = await this.plugin.libraryService.listInstalled();
await this.plugin.libraryService.install(entry.packageId, entry.version); // transactional
```

## File Map
```
src/library/library-model.ts              # NEW — PackageManifest, ReleaseRecord, CatalogEntry, CatalogSnapshot, InstalledRecord, guards
src/library/library-paths.ts              # NEW — namespace derivation, slugifyPackageId, assertNoTraversal/assertInsideLibraryRoot, mapping builder
src/library/integrity.ts                  # NEW — SHA-256 via Web Crypto (integrity, not authenticity)
src/library/registry-model.ts             # NEW — registry API request/response types (plugin-owned, duplicated)
src/library/registry-client.ts            # NEW — requestUrl DI, fetchCatalog, fetchRelease, URL normalize/validate https-only
src/library/library-json-io.ts            # NEW — shared low-level JSON I/O (readJsonFile/writeJsonFile/safeErrorMessage) for the library stores
src/library/library-cache-store.ts        # NEW — catalog snapshot cache under .radiprotocol/library/ (downloaded release bytes are transient staging owned by the installer, not a persistent cache)
src/library/installed-record-store.ts     # NEW — per-release installed record files (read/list/write/delete) under .radiprotocol/library/installed/<packageIdSlug>/<versionSlug>.json (the file IS the commit marker — D15)
src/library/transaction-journal.ts        # NEW — stage→verify→commit→rollback journal under .radiprotocol/library/transactions/
src/library/library-installer.ts          # NEW — transactional orchestrator + module-level installMutex
src/library/library-service.ts            # NEW — facade: catalog, install, uninstall, recovery-on-load
src/views/library-view.ts                 # NEW — LibraryView ItemView (catalog list + search + installed list)
src/views/library-item-detail-modal.ts    # NEW — trust-preview modal (author, version, files, integrity, Install)
src/views/library-install-progress-modal.ts # NEW — install state-machine modal + ARIA progressbar
src/__tests__/library/library-model.test.ts        # NEW
src/__tests__/library/library-paths.test.ts        # NEW
src/__tests__/library/integrity.test.ts            # NEW
src/__tests__/library/registry-client.test.ts      # NEW
src/__tests__/library/library-cache-store.test.ts  # NEW
src/__tests__/library/installed-record-store.test.ts # NEW
src/__tests__/library/library-installer.test.ts    # NEW
src/__tests__/library/library-service.test.ts      # NEW
src/__mocks__/obsidian.ts                 # MODIFY — add requestUrl stub
src/i18n/locales/en.json                  # MODIFY — add library.* block
src/i18n/locales/ru.json                  # MODIFY — add library.* block (parity)
src/views/snippet-manager/tree-renderer.ts # MODIFY — managed-node read-only rendering + indicator badge (Slice 8)
src/views/snippet-manager-view.ts         # MODIFY — read-only + installed indicator for library-managed snippets
src/views/protocol-editor-view.ts         # MODIFY — read-only for library-managed protocols
src/views/protocol-picker-modal.ts        # MODIFY — installed-package indicator on library protocols
src/main.ts                               # MODIFY — register view, command, construct services, recovery hook
src/settings.ts                           # MODIFY — advanced libraryRegistryUrl override
scripts/check-consistency.mjs             # MODIFY — en/ru key-set parity gate
```

## Ordering Constraints
- Slice 1 is the foundation; Slices 2-5 depend on it and on each other strictly sequentially (2→3→4→5) because the installer (4) uses the stores (3) and the service (5) uses the installer + client + stores.
- Slices 6-7 (views) depend on Slice 5 (service). Slice 6 before 7 (view shell before modals it hosts).
- Slice 8 depends on Slice 1 (path helpers to detect `library/` prefix) and Slice 5 (record lookup for the installed indicator) — can run in parallel with Slices 6-7 in principle, but sequenced after 5.
- Slice 9 (wiring) depends on Slices 5, 6, 7 — must be last (it constructs everything).
- The `__mocks__/obsidian.ts` `requestUrl` stub is added in Slice 2 (first thing that needs network in tests); later slices reuse it.
- The en/ru `library.*` i18n block is added in Slice 6 (first view that renders library strings); Slice 7 reuses it; Slice 9 adds the parity gate that enforces it.

## Verification Notes
- **Transaction boundary**: verify the installer never calls `store.write()`/`snippetService.save()` mid-transaction — `grep -n "snippetService\.\|protocolDocumentStore\." src/library/library-installer.ts` should return nothing inside the install path. All I/O via `app.vault`/`adapter` under `installMutex`.
- **Manifest-as-commit-marker**: the installed-record manifest is the LAST write in the commit phase; test that a forced failure before it leaves no manifest and triggers rollback on next load.
- **Path safety**: `assertNoTraversal` rejects `'../escape.md'`, `'/etc/x.md'`, `'a\\b.md'` — unit-test all three; `grep -n "assertNoTraversal\|assertInsideLibraryRoot" src/library/library-installer.ts` shows chokepoint usage.
- **Reference rewrite byte-match**: mapping keys are extension-preserving; test that a `snippetPath: 'folder/snippet.md'` rewrites to `'library/<id>/<ver>/folder/snippet.md'` (extension kept), and `subfolderPath: 'folder'` rewrites to `'library/<id>/<ver>/folder'`.
- **Staged validation**: `GraphValidator` constructed with a staged `Set.has` probe passes for a complete staged tree and fails D-04 for a missing staged snippet — reuse the `__tests__/graph-validator.test.ts:339-466` fabricated-probe pattern.
- **Integrity vs authenticity**: the item-detail modal string is `library.integrityVerified` (e.g. "Integrity verified"), NEVER a "trusted" label — `grep -in "trusted" src/views/library-item-detail-modal.ts` returns nothing.
- **i18n parity**: `npm run check` fails when a key exists in `en.json` but not `ru.json` (and vice versa) — test by temporarily removing a RU key.
- **Catalog unavailable**: empty `baseUrl` → `RegistryClient.fetchCatalog()` returns a result with an explicit `unavailable` status, no throw — `grep -n "throw" src/library/registry-client.ts` shows no throw on the empty-endpoint path.
- **No fake domain**: `DEFAULT_REGISTRY_URL` is empty or a clearly-marked placeholder, NOT `https://registry.radiprotocol.org` — `grep -n "registry.radiprotocol.org" src/library/registry-client.ts` returns nothing.
- **Network DI**: `RegistryClient` constructed with a `vi.fn()` `requestUrl` stub in tests; production defaults to the real import — `grep -n "import.*requestUrl" src/library/registry-client.ts` shows the default.
- **Build/release gates**: `npm run build` + `npm test` + `npm run lint` + `npm run check` all green on the terminal slice.
- Precedent lesson (deleted library): the new library MUST be `registerView`-ed (not just a command+modal) — `grep -n "registerView(LIBRARY_VIEW_TYPE" src/main.ts` returns a match.

## Performance Considerations
- Catalog fetch is the single network round-trip on view open; cache the snapshot in `.radiprotocol/library/` so offline/available-from-cache is O(1) read. Avoid refetch on every view activation — use a TTL or explicit refresh action.
- Dependency-closure walk over `snippetPath`/`subfolderPath` is O(snippets) per protocol; for `subfolderPath` it's a recursive subtree walk (`snippet-service.ts:342-365` pattern). Cap at the package's declared snippet set, not a vault-wide scan.
- Staged validation runs `GraphValidator.validate` once per install (not per file) — already O(nodes+edges).
- The `LibraryView` vault watchers are scoped to `library/` subtrees + `.radiprotocol/library/` only (NOT the whole vault) — 120ms debounce coalesces rapid events, mirroring `SnippetManagerView`.
- SHA-256 over package bytes is O(file size); Web Crypto `subtle.digest` is native and fast. Hashes are computed once at stage time and re-verified at commit.
- No N+1: catalog entries are fetched in one snapshot; installed records enumerate O(marker files) via recursive `adapter.list` under `.radiprotocol/library/installed/` (one read per installed release — D15 per-release files; one read per release, not a single index).

## Migration Notes
No existing persisted schema changes. New storage is additive:
- New vault folders `Protocols/library/`, `Snippets/library/`, `.radiprotocol/library/` are created on first install (via `ensureFolderPath`); their absence is the empty initial state.
- New optional settings field `libraryRegistryUrl` (advanced); existing installs without it fall back to `DEFAULT_REGISTRY_URL` (empty → "catalog unavailable"). No migration of existing settings — `Object.assign({}, DEFAULT_SETTINGS, await loadData())` (`main.ts:38`) handles the additive default.
- No change to `ProtocolDocumentV1` schema (manifest wraps it; `PROTOCOL_VERSION` untouched).
- The deleted library's orphaned i18n trio (`snippetManager.emptyStateTitle` "Snippet library is empty" + `emptyStateBody/Button`, unreferenced) is NOT touched by this design — out of scope; a future cleanup can remove it.
- Rollback strategy: if the foundation is reverted, deleting `src/library/`, the view registration, and the `library/` vault subtrees (user can trash `Protocols/library/`, `Snippets/library/`, `.radiprotocol/library/`) restores the pre-feature state. No existing user content lives under those paths.

## Pattern References
- `src/snippets/snippet-service.ts:55-279` — service layer split, `assertInsideRoot`, WriteMutex+ensureFolderPath dialect (model for library services + path gate)
- `src/protocol/protocol-document-store.ts:67-80` — pretty-JSON + trailing-newline store dialect (model for the three new stores, minus the null-on-error behavior)
- `src/snippets/protocol-ref-sync.ts:119-137` — `applyMapping` pure core (reuse semantics, scoped + transactional)
- `src/graph/graph-validator.ts:14-22` — `snippetFileProbe` DI seam (reuse for staged validation)
- `src/views/inline-runner-modal.ts:94-98,192-198,330-333,396-404,444-559` — GraphValidator injection, pre-run gate, ARIA progressbar, exhaustive state dispatch (model for install-progress modal)
- `src/views/snippet-manager-view.ts:50,185-253` — ItemView lifecycle, generation guard, debounced watchers (model for LibraryView)
- `src/views/snippet-editor-modal.ts:31-54,151-154,644-649` — promise Modal, `safeResolve`, `snippetServiceOverride` adapter (model for promise-based modals + DI)
- `src/main.ts:217-228` — `activateSnippetManagerView` get-or-create-leaf pattern (model for `activateLibraryView`)
- `src/__tests__/protocol-document-store.test.ts:16-96` — `makeVault()`/`makeApp()` factory (model for library store tests + `vi.fn()` network stub)

## Developer Context

### Directional confirms (batched, all "Follow" with refinements)
- **Layer split**: "Follow the layer split. Keep pure model files free of Obsidian imports and UI dependencies. Put Vault, filesystem, network, and persistence operations behind service interfaces. Views may consume services, but services and models must never import views. Avoid unnecessary abstractions where a module has only one concrete implementation."
- **Network DI**: "Follow the options-object DI pattern. Keep the injected dependency limited to the network client/service layer; pure library models must not import Obsidian. Default to Obsidian requestUrl in production and inject stubs in tests. Avoid introducing a broader network abstraction unless a second transport implementation is actually needed."
- **Store dialect**: "Follow the existing storage dialect, but keep separate typed stores for catalog cache, installed records, and transaction journal under a dedicated library root. Do not reuse ProtocolDocumentStore or SnippetService. Centralize shared low-level JSON read/write helpers if duplication becomes meaningful, but do not create a generic repository abstraction prematurely. Treat missing files as an empty initial state, while malformed files must produce an explicit recoverable error rather than silently resetting data."
- **Library view**: "Follow the ItemView pattern. Mirror the existing SnippetManagerView activation and lifecycle where practical. Scope vault watchers only to library-owned storage and protocol/snippet locations that can affect installed packages; do not watch the whole vault unnecessarily. Dispose watchers, timers, and pending refresh state in onClose. Keep view state transient unless there is a clear user-facing reason to persist it."

### Scope decision
- "Choose foundation-first. Fully design the read-and-install path, including transactional rollback, recovery after interrupted installation, path-safety validation, package validation, SHA-256 integrity checks, cache behavior, and explicit error states. Keep manifest and service boundaries forward-compatible with submission, upgrades, and signed releases, but do not implement speculative abstractions for deferred features. SHA-256 verification must be described as integrity verification, not publisher authenticity; the UI must not mark unsigned releases as trusted. Define clear follow-up design boundaries for submission/auth/moderation, upgrades, and signature verification."

### Storage layout decision
- "Use the existing protocol and snippet roots, with library-managed content isolated under library/<package-id>/<version>/. Treat these subtrees as immutable managed content from day one. SnippetManagerView and ProtocolManager must either exclude library-managed items from ordinary editing or render them as read-only with a clear installed-package indicator. Runtime pickers and Runner must still discover them. User-created content must never be written inside the managed library/ namespace. Uninstall and rollback may delete only paths recorded as owned by the installed package. Keep catalog cache, installed records, and transaction journals under .radiprotocol/library/, not in plugin data.json."

### Catalog URL decision
- "Use a single bundled DEFAULT_REGISTRY_URL as the authoritative production endpoint. Expose an override only in an Advanced settings section; an empty value must fall back to the bundled default. Normalize and validate the URL once in the registry client, allow only https: in production, and inject baseUrl in tests. Do not expose the registry URL in the primary settings UI. Do not hard-code https://registry.radiprotocol.org unless that domain and endpoint are actually provisioned; until then, keep the endpoint clearly configurable for development and fail with an explicit 'catalog unavailable' state."

### i18n parity gate decision
- "Add net-new parity check." (Extend `scripts/check-consistency.mjs` with en/ru key-set comparison; wire into `npm run check`.)

## Design History
- Slice 1: Pure model + paths + integrity — approved as generated (3 slice-verifier rounds: fixed D8 absolute-path rejection, D14 wrapped-doc validation + element soundness, slugify \p{L}\p{N} regex, sha256Bytes BufferSource typing, summary/author/categories element validation; surface-and-proceed on isProtocolDocumentV1 shallow guard — deep node validation is the parser's job in Slice 4) — **REOPENED at Slice 4 checkpoint (D15 cascade)**: InstalledRecord becomes a per-release schema-versioned document (schema 'radiprotocol.installed-record' + version sentinels); InstalledRecordsDocument + isInstalledRecordsDocument + INSTALLED_RECORDS_SCHEMA/VERSION removed; library-model.test.ts updated (isInstalledRecordsDocument block dropped, isInstalledRecord tests include sentinels). Re-verified.
- Slice 2: Registry client + API types + network mock — approved as generated (4 slice-verifier rounds: fixed never-throw contract — moved URL composition inside try, safeErrorMessage single-read helper for null-prototype/stateful-getter rejections; removed unused isCatalogEntry import; dropped inexact esbuild line citation)
- Slice 3: Cache + installed-record stores — approved as generated (added shared library-json-io.ts per D3 refinement; 2 verifier rounds: fixed version-literal widening (use constants), .endsWith matcher → toMatch, reworded comments to avoid grep false-positives, reconciled File Map: downloaded bytes are transient staging not persistent cache) — **REOPENED at Slice 4 checkpoint (D15 cascade)**: InstalledRecordStore becomes read(packageId,version)/list()/write(record)/delete(packageId,version) over per-release files at .radiprotocol/library/installed/<packageIdSlug>/<versionSlug>.json; readAll/writeAll/emptyRecords() removed; installed-record-store.test.ts rewritten to the new surface. Re-verified.
- Slice 4: Transaction journal + transactional installer — approved (3 slice-verifier rounds: R1 found 12 issues — subfolder closure, destination-free collision check, dual-binding rejection, rewritten-path assertNoTraversal gate, installed-protocol hash (record the rewritten doc's hash not the source manifest hash), never-throws contract (destructuring inside try + best-effort post-commit journal removal), recoverInterrupted never-throws, namespace-safe rollback (assertNoTraversal-gated isOwned — closes a `..`-traversal-past-prefix hole), emptiness-checked empty-folder cleanup, test App-wrapper fix, unused-import removal; added graph-validation + recovery-identity-mismatch tests; surface-and-proceed on malformed-journal skip in listAll — recovery robustness, mirrors InstalledRecordStore.list per-file isolation)
- Slice 5: Library service facade — approved (2 slice-verifier rounds: R1 found never-throws install (fetchRelease outside try), non-Promise async mock return annotations (build error), weak query/listInstalled tests, missing getInstalledRecord + throw-safe-default tests, Slice 5 Files didn't list the installer uninstall merge, on-load criterion forward-referenced Slice 9; R2 confirmed all fixes — fetchRelease inside try, Promise<...> mocks, field-isolated description/summary query tests, listInstalled delegation+throw-safe, getInstalledRecord, uninstall tests in installer test fence, Files line updated, criterion reworded + Slice 9 deferral) — cross-slice merge: uninstall + removeOwnedPaths added to library-installer.ts (Slice 4 file), rollbackTransaction refactored to delegate to removeOwnedPaths
- Slice 6: LibraryView ItemView + i18n library.* block — approved (4 slice-verifier rounds: R1 fixed CatalogListResult wrong-module import [library-service not library-model], D6 banner fetchedAt-vs-entries.length, D11 "trusted" literal in comments → reworded to "publisher authenticity", added category filter control; R2 fixed watcher self-refresh cycle [narrowed scope to library subtrees + installed/ dir, excluding the catalog cache + installer journal] + filter-dropdown-from-filtered-results bug [fetch full catalog once, populate dropdown from unfiltered set, filter client-side via applyLocalFilter; search/filter now call renderModel not refresh — no refetch]; R3 fixed comment ownership attribution [catalog cache = view's own write via Slice 5; transaction journal = installer's Slice 4 pre-commit write] + self-defeating grep criterion → positive LIBRARY_INSTALLED_DIR grep; R4 clean — Decisions/Cross-slice/Research all OK; surface-and-proceed: this.plugin.libraryService wired in Slice 9, npm run build/test pass after Slice 9, applyLocalFilter mirrors filterEntries to avoid a Slice 5 reopen)
- Slice 7: Item detail + install progress modals — approved (3 slice-verifier rounds: R1 fixed D11 "trusted" literal in comments → reworded to "publisher authenticity"; Install button disabled until manifest loads (trust preview before download) — stays disabled on failure; WCAG 2.2 AA keyboard activation (tabindex=0 + Enter/Space); indeterminate progressbar (aria-valuenow omitted at creation per ARIA spec, set on complete/failed). R2 fixed duplicate completion refresh (openInstall no longer calls refresh — Slice 6 watcher owns the post-install marker-refresh). R3 clean — Decisions/Cross-slice/Research all OK; surface-and-proceed: getReleaseManifest fetches the full ReleaseBundle and discards contents [no vault write before Install — manifest-only endpoint deferred], detailIntegrity future-tense vs integrityVerified past-tense [pre-install preview honesty], .radi-library-progress* CSS is implementation-layer)
- Slice 8: Existing-views integration (read-only for managed items) — approved (3 slice-verifier rounds: R1 found 2 violations — D5 protocol-editor drag/resize mutated node state locally before the save guard + addNode helpers not guarded directly, and cross-slice en.json `unavailableBanner` drift [transcribed "Showing the cached list" vs locked "Showing cached list"]; R2 resolved both — direct guards on addNodeAtWorldPoint/addNodeAndConnectAtWorldPoint, silent gesture-start guards in bindDrag/bindResize, en.json corrected to locked value verbatim; R2 also flagged a generation-guard WARNING — listInstalled fetched at top of refresh before generation capture; R3 resolved by moving the fetch into loadModel + committing installedRecords via commitModel, so it is generation-guarded like the rest of the model. Surface-and-proceed: this.plugin.libraryService wired in Slice 9 [forward ref, consistent with Slices 6-7], protocol-picker indicator is component-level in Slice 8 with runtime wiring deferred to Slice 9 main.ts [explicit developer decomposition decision], persistViewportState guard blocks pan/zoom persistence for read-only [view adjusts locally, no write], .radi-library-* + radi-snippet-tree-library-badge + rp-protocol-editor-library-banner CSS is implementation-layer [no stylesheet in File Map, consistent with Slices 1-7])
- Slice 9: main.ts wiring + settings + parity gate — approved (2 slice-verifier rounds: R1 found 1 violation — picker sites 2 and 3 passed unnormalized `this.settings.protocolFolderPath.trim()` as `protocolRoot` to `buildLibraryPickerContext`, so `isLibraryManagedPath` could mismatch for settings with a trailing slash or backslash (site 1 already used `normalizeProtocolFolderPath`); R2 resolved by normalizing the root at all 3 sites via `normalizeProtocolFolderPath(this.settings.protocolFolderPath)` — consistent with the resolver-enumerated paths. Terminal slice: wires `this.registryClient` + `this.libraryService` onto `RadiProtocolPlugin` (the forward reference Slices 6-8 consume), registers `LibraryView` via `registerView` + `addCommand('open-community-library')` + `activateLibraryView()` (modeled after `activateSnippetManagerView`), awaits `recoverInterruptedInstalls()` on load before view registration, threads `libraryContext` + `t` into all 3 picker construction sites. settings.ts adds the advanced `libraryRegistryUrl` override (empty → DEFAULT_REGISTRY_URL → "catalog unavailable"). check-consistency.mjs adds Check 7 (en/ru i18n key parity via flattened bidirectional key-set comparison) — already enrolled in `npm run check` (the consistency step). en/ru get +4 settings.* keys (advancedHeading, libraryRegistryUrl, libraryRegistryUrlDesc, libraryRegistryUrlPlaceholder, parity). Surface-and-proceed: recovery is awaited in onload before view registration [bounded local I/O, never throws]; `.radi-library-*` + settings CSS is implementation-layer [no stylesheet in File Map, consistent with Slices 1-8])

## References
- Research artifact: `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md`
- Source FRD: `.rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md`
- Cleanup FRD (abandoned library): `.rpiv/artifacts/discover/2026-06-02_11-55-28_cleanup-and-ux-fixes.md`
- Cleanup research: `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md`
- Prior handoff: `.rpiv/artifacts/handoffs/2026-08-03_22-59-16_moderated-community-library-research.md`
- Deleted library commits: `2ccc66a` (MVP) → `4258647` (browser) → `e884baf` (admin) → `6657b8d` (removal); follow-up fixes `9b4a886`, `e14c5c1`, `d9c9487`, `4891e4e`, `c636747`