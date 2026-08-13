---
date: 2026-08-13T09:42:22+0300
author: Roman Shulgha
commit: bdd06f9
branch: main
repository: RadiProtocol
topic: "Library production-ready: install slug-collision fix, snippet package publish/export, uninstall UI, recovery hardening"
tags: [research, codebase, library, library-installer, library-paths, library-service, registry-client, transaction-journal, installed-record-store, library-model, registry-model, integrity, library-view, library-item-detail-modal, confirm-modal, i18n, snippets, snippet-model]
status: ready
last_updated: 2026-08-13T09:42:22+0300
last_updated_by: Roman Shulgha
---

# Research: Library production-ready — install slug-collision fix, snippet package publish/export, uninstall UI, recovery hardening

## Research Question
Bring the community-library prototype (`src/library/`, `src/views/library-*.ts`) to production-ready by (1) fixing the "Chest CT (space id)" install failure — a slug collision where two distinct opaque packageIds collapse to one destination folder — by keying install destinations on `slug + shortHash(rawPackageId)` with a one-time migration of already-installed packages; (2) adding a local package authoring/export path (protocol + referenced snippets → SHA-256-hashed bundle, no hosted backend); (3) wiring the existing uninstall service into the library UI; and (4) hardening install recovery to clean orphaned destination files and replacing the misleading "destination occupied (prior incomplete install)" error with collision-vs-dirty-slot messaging. Source prompt: `.rpiv/artifacts/discover/2026-08-13_09-07-46_library-production-ready.md`.

## Summary
The library cluster is a fresh, unhardened prototype (born in commit `d4eb13f`, zero follow-up fixes) built on a transactional journal-first/marker-last installer whose destination paths are derived from a single lossy slugifier aliased as `slugifyPackageId`. The collision root cause is confirmed by code structure: `slugifyLabel` (`src/snippets/snippet-model.ts:126-132`) is non-injective by construction, and that same slug propagates identically to **four** independent derivation sites — protocol namespace, snippet namespace, journal filename, and marker path — so two distinct opaque packageIds that slugify identically wedge each other at every layer. The fix keys destinations on `slug(rawPackageId) + '-' + shortHash(rawPackageId)` (hash over the RAW id, not the slug, or the collision persists); a one-time migration must rewrite each installed record's stored `protocolPath`/`snippetNamespace` (which `uninstall` derives deletion namespaces from) AND the embedded snippet references inside the on-disk `.rp.json`. The preflight split and recovery hardening both require injecting an `InstalledRecordStore` reference (or a lister) into `LibraryInstaller`, which today only holds `app`/`settings`/`t`/`journalIO`. The local package builder emits a source (un-rewritten) `ReleaseBundle` whose `{ manifest, snippetContents }` shape is structurally identical to `ReleaseResponse`, so `isReleaseResponse` accepts it and a single-JSON export round-trips through `installer.install()` via the public `LibraryService.installer`. The uninstall UI is a small view-local wiring mirroring `handleDeleteSnippet`; it needs an explicit `await this.refresh()` because the installer deletes the marker via `adapter.remove()` on a dotfolder file, which does not reliably fire Obsidian's `vault.on('delete')`. Three research checkpoints resolved: synthetic colliding packageIds for the FR-1 test (the real opaque IDs are unobtainable from code and the three titles slugify distinctly); i18n refactor scoped to the 3 destination-occupied literals + new strings (not the full 31-string sweep); and a "skip if any marker file present" safety check for the recovery scan.

## Detailed Findings

### Thread 1 — Slug+hash destination keying (the collision root cause)
- The collision is structural, not incidental. `slugifyPackageId` at `src/library/library-paths.ts:22` is a direct alias of the lossy `slugifyLabel` at `src/snippets/snippet-model.ts:126-132` (lowercases, trims, replaces `[^\p{L}\p{N}]+` with `-`, strips edge dashes — non-injective by construction). The doc comment at `src/library/library-paths.ts:24-33` explicitly defers collision-handling to the installer preflight, but the preflight never checks for two distinct packageIds that slugify identically.
- That same slug propagates to **four** independent derivation sites, each of which must thread the slug+hash change or reintroduce the collision at a different layer:
  - **Protocol namespace** — `libraryProtocolNamespace` at `src/library/library-paths.ts:44-46` → `${protocolRoot}/library/<pkgSlug>/<verSlug>`.
  - **Snippet namespace** — `librarySnippetNamespace` at `src/library/library-paths.ts:53-55` → `${snippetRoot}/library/<pkgSlug>/<verSlug>`.
  - **Journal filename** — `transactionJournalPath` at `src/library/transaction-journal.ts:68-69` → `${TRANSACTIONS_DIR}/<pkgSlug>@<verSlug>.json`. Two colliding packages would overwrite each other's in-flight journal (`write` at `:87`) and a `remove` for one would delete the other's (`:94`).
  - **Marker path** — `installedRecordPath` at `src/library/installed-record-store.ts:21-22` → `${INSTALLED_DIR}/<pkgSlug>/<verSlug>.json`. A partial fix that rekeys only destination folders but leaves the marker on slug-only would wedge `readMarker`/`isMarkerCommitted` (the marker slot is shared, so only one package's marker can exist at a time).
- A **fifth** slug consumer is `buildReferenceMapping` at `src/library/library-paths.ts:152`, which embeds `${LIBRARY_SUBROOT}/<pkgSlug>/<verSlug>` into the rewritten `snippetPath`/`subfolderPath` fields of the installed `.rp.json`. And `libraryProtocolFilePath` at `:62-63` appends `/<pkgSlug>.rp.json` as the protocol filename. Both must move in lockstep with the namespace change.
- The hash MUST be computed on the **raw `packageId`** (before slugification), not on the slug — hashing the slug would re-collapse both packages to the same hash suffix and the collision persists unchanged. The version slug needs no hash (versions are immutable release tags within a package).
- The reusable hashing primitive is `sha256String` at `src/library/integrity.ts:30` (async, returns the full 64-char hex). The `shortHash` at `src/views/library-item-detail-modal.ts:159` is a display-only truncation (`sha.slice(0, 12)`) of an already-computed hex — NOT a hasher, and cannot be reused for the segment. A new pure path-segment helper (`slug + '-' + firstNHex(sha256String(rawPackageId))`) is needed.
- **Async constraint**: all four derivation functions are synchronous, but `sha256String` is async. `planInstall` (`:181`), `readMarker` (`:351`), the stores, `uninstall` (`:382`), and `rollbackTransaction` (`:487`) are already async and could `await` a segment computation. `buildReferenceMapping` (`:152`) is synchronous and called from `planInstall` (`:247`) — it would either become async or receive the precomputed segment as a parameter. The lower-ripple option is to compute the segment once in `planInstall` and thread a precomputed `namespaceSegment` string through the synchronous helpers (changing their signatures from `(root, packageId, version)` to accept the segment), so no function newly becomes async.

### Thread 2 — One-time legacy-path migration
- The migration hook is `LibraryInstaller.recoverInterrupted` at `src/library/library-installer.ts:148`, already serialized under the single global `installMutex` (`:43`, fixed key `INSTALL_LOCK_KEY`), invoked on plugin load via `LibraryService.recoverInterruptedInstalls()` at `src/main.ts:87` (runs before views register at `:91`). The migration should run AFTER `recoverInterrupted` completes (so in-flight legacy journals are committed/rolled back first), still under the mutex — no concurrent install/uninstall can race it.
- Legacy records are enumerated via `InstalledRecordStore.list` at `src/library/installed-record-store.ts:62` (recursively walks `INSTALLED_DIR` at `:18`), accessible via `LibraryService.listInstalled` at `src/library/library-service.ts:152`.
- The two `InstalledRecord` fields a migration MUST rewrite are `protocolPath` (`src/library/library-model.ts:110` ff.) and `snippetNamespace` — because `uninstall` at `src/library/library-installer.ts:382` derives `protoNs = parentDirOf(record.protocolPath)` (`:387`) and `snipNs = record.snippetNamespace` (`:388`) **from the record** (Step 5 C6 — survives folder-setting changes), and `removeOwnedPaths` at `:423` gates deletion by `p.startsWith(protoNs + '/') || p.startsWith(snipNs + '/')` (`:430-432`). If files move to slug+hash paths but the record still carries slug-only paths, uninstall reports `ok` vacuously (paths don't exist) while orphaning the new-namespace files.
- Additionally, the on-disk `.rp.json` at `protocolPath` contains rewritten `snippetPath`/`subfolderPath` node fields (set at `:269`/`:276` via `rewriteSnippetRef`) that embed the slug-based namespace. When the namespace changes, these embedded references inside the protocol file must be re-rewritten or the runtime graph resolver cannot locate the moved snippet files.
- **Asymmetry to preserve**: unlike `uninstall`, `rollbackTransaction` at `:487` **re-derives** `protoNs`/`snipNs` from `(packageId, version)` via the helpers using current settings (`:489-490`), and takes its deletion paths from `journal.entries[].path`. Post-fix, new journals carry slug+hash paths and re-derive slug+hash namespaces → consistent. Legacy journals (slug-only paths) are handled by `recoverInterrupted` before migration runs, so `rollbackTransaction` only ever sees new-scheme journals after migration.
- **Atomicity**: the migration must mirror `install`'s commit order (journal FIRST at `:108`, snippet writes, protocol write, marker LAST at the `install` method's commit step) — write a migration journal listing old→new path moves, move snippet files, move+re-rewrite the protocol file, rewrite the marker LAST. A crash after moving files but before rewriting the marker leaves the old marker pointing at non-existent paths (silent orphan on uninstall). Idempotency: re-running on an already-migrated vault must be a no-op (detect legacy-vs-new by checking whether the stored path matches the new-scheme derivation).
- Whether to bump `INSTALLED_RECORD_VERSION` (`src/library/library-model.ts:19`) or add an explicit `namespaceSegment` field: bumping the version lets `isInstalledRecord` (`:218`) distinguish migrated records and lets migration detect already-migrated state; an explicit stored segment would let `rollbackTransaction` use the stored segment instead of re-deriving (but it only ever sees post-fix journals anyway). No `ProtocolDocumentV1` or manifest wire-shape change is needed — keep the blast radius inside `src/library/` + views + tests + i18n.

### Thread 3 — Collision-vs-dirty-slot preflight split + i18n
- The preflight is inside `planInstall` at `src/library/library-installer.ts:181`. After `readMarker` at `:196` (→ "already installed" at `:197`), three `adapter.exists` checks at `:200`/`:203`/`:208` each return the SAME hard-coded literal `destination occupied (prior incomplete install) — run recovery first: …` at `:201`/`:204`/`:209`.
- `readMarker` at `:351-360` returns `null` for BOTH a collision and a dirty slot: on a collision, the foreign marker at the shared slot IS structurally valid (`isInstalledRecord` passes) but `parsed.packageId === packageId` fails at `:355` (identity mismatch) → `null`; on a dirty slot, the marker is absent/malformed → catch → `null`. The current preflight cannot distinguish them because the three `adapter.exists` branches only check THAT something exists, not WHAT owns it.
- To name BOTH colliding packageIds, enumerate `InstalledRecordStore.list` (`src/library/installed-record-store.ts:62`) and match each occupied path against `findInstalledRecordForPath` at `src/library/library-paths.ts:190` (exact `protocolPath` match at `:194`, `snippetNamespace` prefix match at `:195`). If a returned record's `packageId !== incomingPackageId` → collision (name both); if no record owns the path → dirty slot ("incomplete install of X — run recovery").
- **Dependency gap**: `LibraryInstaller` does NOT hold an `InstalledRecordStore` reference — its constructor at `src/library/library-installer.ts:79-85` injects only `app`, `settings`, `t` (`:84`), and `journalIO`. `LibraryService` holds both separately at `src/library/library-service.ts:68` (`installer`) and `:71` (`recordStore`), constructing the installer at `:83` with only `{ t: this.t }`. The fix injects a record-store reference (or a `() => Promise<InstalledRecord[]>` lister, to avoid granting write access) into `LibraryInstallerOptions`. This same gap blocks Thread 4's orphan scan — one injection serves both.
- **i18n seam**: the installer accepts an injected `t: Translator` at `:84` (defaulting to `defaultT` at `src/i18n/index.ts:18`) but the preflight literals bypass it. `I18nService.t` at `src/i18n/i18n-service.ts:39` fully supports `{param}` interpolation (`:50`: `text.replace(/\{(\w+)\}/g, …)`), so `this.t('library.collisionError', { incoming, existing })` works. The `reason` from `planInstall` propagates to the UI as the `{reason}` param inside `library.installFailed` (`src/i18n/locales/en.json:378`: `"Install failed: {reason}"`) at `src/views/library-install-progress-modal.ts` — the new collision/dirty-slot strings nest inside that wrapper.
- **Scope (resolved checkpoint)**: the i18n refactor is scoped to the 3 destination-occupied literals (`:201`/`:204`/`:209`, replaced by the split) + all NEW strings (uninstall, export, collision, dirty-slot, recovery). The other ~28 hard-coded preflight/validation literals and `buildReferenceMapping`'s 3 (`src/library/library-paths.ts:165`/`:171`/`:175`) stay hard-coded this round — a full 31-string sweep would break 8 `toContain` test assertions (`src/__tests__/library/library-installer.test.ts:115-179`) and require injecting a `Translator` into the pure `buildReferenceMapping`.

### Thread 4 — Recovery hardening (destination-folder scan for orphaned files)
- `recoverInterrupted` at `src/library/library-installer.ts:148` takes its SOLE input from `journalIO.listAll()` at `:152`. `TransactionJournalIO.listAll` at `src/library/transaction-journal.ts:108` recursively walks ONLY `TRANSACTIONS_DIR` (`:27`) — destination folders under `${root}/library/` are never enumerated. A dirty slot with destination files but NO journal (corrupted journal skipped at `:132`; a manual folder; or stale files after a marker deletion) is invisible to recovery.
- The hardening adds a second phase after the journal loop: recursively scan `${protocolRoot}/library/` and `${snippetRoot}/library/` (the `LIBRARY_SUBROOT` constant at `src/library/library-paths.ts:13`) for namespace folders, mirror the BFS queue pattern in `listAll` (`:113-136`) and `InstalledRecordStore.list` (`:62-89`), and use `adapter.list(dir)` which returns full vault-relative paths.
- The ownership check reuses `findInstalledRecordForPath` (`src/library/library-paths.ts:190`) against `InstalledRecordStore.list` (`src/library/installed-record-store.ts:62`): a discovered file whose path matches no valid record → orphan candidate; a file owned by a valid record → skip (never delete a valid package's files).
- **Safety (resolved checkpoint)**: before deleting an orphaned namespace, check whether ANY `.json` file exists at the installed marker slot `.radiprotocol/library/installed/<pkgSlug>/<verSlug>.json` — constructed directly from the discovered folder's slug names (the scan has the slugs; it does not need the raw packageId). If a marker file is present (even if corrupt/unparseable), block deletion. This is safe because `list` skips corrupt markers at `src/library/installed-record-store.ts:87` (so a corrupt-marker package would otherwise be misclassified as orphaned), and because journal-less interrupt orphans have NO marker file (the marker is written LAST at the `install` commit step) — so the check still cleans the FR-4 target.
- Cleanup reuses the existing namespace-gated `removeOwnedPaths` at `src/library/library-installer.ts:423` (`isOwned` gate at `:430-432` requires `assertNoTraversal` AND within `protoNs`/`snipNs` or the marker path; deepest-first deletion at `:437`; empty-folder cleanup with an emptiness check at `:461-463` and `stopDirs` at `:453-456` so a non-empty folder holding another package's files is never recursively deleted). The scan passes the discovered namespace folder as `protoNs`/`snipNs` (it IS the namespace); all files within pass the prefix gate, and all slug-derived paths pass `assertNoTraversal`.
- The scan cannot call `readMarker`/`isMarkerCommitted` directly (they require the raw packageId, which the folder-name slug does not round-trip to) — it relies on `findInstalledRecordForPath` + the marker-file-exists check. A new `orphansCleaned` field on `RecoveryReport` (`src/library/library-installer.ts:63-66`) records what was cleaned.

### Thread 5 — Local package builder/export (publish path, no backend)
- The target type is `ReleaseBundle` at `src/library/library-model.ts:132` (`{ manifest: PackageManifest, snippetContents: Array<{ relPath, content }> }`). `PackageManifest` at `:44` carries `packageId`, `releaseVersion`, `protocolDoc: ProtocolDocumentV1`, `protocolSha256`, `snippetFiles: PackageSnippetFile[]`, `catalogEntryId`, `publishedAt` (required) + optional `author`. The only optional field is `author` (`:60`).
- The new `buildLocalPackage`/`exportPackage` method sits on `LibraryService` at `src/library/library-service.ts:63` alongside `install` (`:127`) and `uninstall` (`:141`).
- **SOURCE vs INSTALLED hash (critical)**: the builder MUST emit the SOURCE hash, not the installed hash. `planInstall` verifies the source at `src/library/library-installer.ts:233-236` (`verifyIntegrity(JSON.stringify(manifest.protocolDoc, null, 2) + '\n', manifest.protocolSha256)`) BEFORE the rewrite runs; the installed hash is computed separately at `:329` (`sha256String(JSON.stringify(rewrittenDoc, null, 2) + '\n')`) and stored in the record at `:336`. The builder computes `protocolSha256 = sha256String(JSON.stringify(protocolDoc, null, 2) + '\n')` via `src/library/integrity.ts:30` — matching the exact canonical form (2-space indent + trailing newline). Per-snippet `sha256 = sha256String(content)` is verified at `:227-230`.
- The builder MUST emit the SOURCE (un-rewritten) bundle so the installer's full rewrite pipeline (`buildReferenceMapping` at `:247`, `rewriteSnippetRef`) runs again on re-install. A pre-rewritten bundle would fail the source-integrity check at `:235` and double-rewrite the snippet refs. The round-trip (build → export → re-install) requires the source doc + source snippet contents.
- **Snippet-file collection**: extract snippet nodes identically to `planInstall` at `src/library/library-installer.ts:246` (`[...parsed.graph.nodes.values()].filter((n) => n.kind === 'snippet')`), then read `node.radiprotocol_snippetPath` (file-bound → collect that file) or `node.subfolderPath` (directory-bound → collect all `.md` files under it) via the same logic as `buildReferenceMapping` at `src/library/library-paths.ts:152-180`. The builder reads SOURCE files from the vault (the installer receives pre-collected content). The `.md`-only gate (`:217`) and `assertNoTraversal` (`:218`) apply to every collected `relPath`.
- The 1g-bis subfolder-closure check at `src/library/library-installer.ts:256-265` requires every subfolder-bound node to have ≥1 declared descendant in `manifest.snippetFiles` — `GraphValidator` only probes file-bound nodes (`src/graph/graph-validator.ts`), so the builder must collect ALL `.md` files under each referenced subfolder or `planInstall` rejects the bundle at `:263`.
- **FR-7 authoring-time collision warning**: validate the slug via `validPackageSlug` at `src/library/library-paths.ts:35-37`, then compare `slugifyPackageId(builderPackageId)` against each installed record's `slugifyPackageId(record.packageId)` via `LibraryService.listInstalled` (`src/library/library-service.ts:152`) — because the slugifier is lossy, compare slugs not raw ids.
- **Round-trip serialization (confirmed)**: `ReleaseResponse` at `src/library/registry-model.ts:15-18` is structurally identical to `ReleaseBundle` (`src/library/library-model.ts:132-135`) — same two fields, same types. `isReleaseResponse` at `src/library/registry-model.ts:43` accepts any JSON object with a valid `manifest` (passing `isPackageManifest` at `src/library/library-model.ts:174`) + an array of `{ relPath, content }`. A single JSON file `JSON.stringify({ manifest, snippetContents })` passes the guard. The re-install bypasses the network: `LibraryService.installer` is public at `src/library/library-service.ts:68`, so `isReleaseResponse(parsed) → installer.install({ manifest, snippetContents })` completes the FR-10 round-trip with no folder structure or multi-file serialization.

### Thread 6 — Uninstall UI wiring
- `renderInstalledRecord` at `src/views/library-view.ts:391` builds a title (`:397`), a meta row (version/author/installedAt), and an integrity badge — but NO action button (method ends after the badge). The `record.packageId` (`src/library/library-model.ts:110` ff.) and `record.releaseVersion` are in scope and are the two args for the uninstall call.
- The wiring mirrors `handleDeleteSnippet` at `src/views/snippet-manager-view.ts:533-552`: construct `new ConfirmModal(this.app, { title, body, confirmLabel, cancelLabel, destructive: true })` (`src/views/confirm-modal.ts:42`; Promise resolves `'confirm'|'cancel'|'discard'`, Esc/overlay → `'cancel'`), `modal.open()`, `await modal.result`, guard `!== 'confirm'`, call the facade, `new Notice(...)`, refresh.
- **Facade entry**: `this.plugin.libraryService.uninstall(record.packageId, record.releaseVersion)` at `src/library/library-service.ts:141` (never throws — returns `UninstallResult` with `status: 'ok'|'not-installed'|'failed'`). The view must check `status`, not try/catch (unlike `handleDeleteSnippet` which calls a throwing `snippetService.delete`). The `'not-installed'` case (`src/library/library-installer.ts:385`) carries no `reason` field.
- **Explicit refresh IS required**. The vault watcher registers a `delete` handler at `src/views/library-view.ts:171` and `shouldHandle` at `:196-203` matches marker paths under `LIBRARY_INSTALLED_DIR` (`:54`). BUT the installer deletes the marker via `adapter.remove()` inside `removeOwnedPaths` (`src/library/library-installer.ts:436`) — NOT via `vault.delete(file)` and NOT via `InstalledRecordStore.delete` (`src/library/installed-record-store.ts:107`, which exists but is never called by the uninstall path). `adapter.remove()` on a dotfolder file does not reliably fire Obsidian's `vault.on('delete')` (dotfolder files may not be tracked TFiles). The `handleDeleteSnippet` template includes `await this.refresh()` at `:549`; the uninstall handler must too. `refresh()` at `:217` is generation-guarded, so a concurrent watcher-triggered refresh is harmless. (Note: `openInstall` at `:423` omits the explicit refresh and relies on the watcher — an unverified assumption for the same dotfolder reason; the uninstall wiring should not repeat it.)

## Code References
- `src/library/library-paths.ts:13` — `LIBRARY_SUBROOT = 'library'` (scan roots)
- `src/library/library-paths.ts:22` — `slugifyPackageId = slugifyLabel` (lossy alias; collision root)
- `src/library/library-paths.ts:35-37` — `validPackageSlug` (FR-7 slug validation)
- `src/library/library-paths.ts:44-46` — `libraryProtocolNamespace` (derivation site 1)
- `src/library/library-paths.ts:53-55` — `librarySnippetNamespace` (derivation site 2)
- `src/library/library-paths.ts:62-63` — `libraryProtocolFilePath` (filename = `<pkgSlug>.rp.json`)
- `src/library/library-paths.ts:70-71` — `librarySnippetFilePath`
- `src/library/library-paths.ts:79` — `isLibraryManagedPath` (picker scoping)
- `src/library/library-paths.ts:93` — `assertNoTraversal` (path-safety gate for deletion + relPaths)
- `src/library/library-paths.ts:126` — `rewriteSnippetRef` (installer reference rewrite)
- `src/library/library-paths.ts:152` — `buildReferenceMapping` (5th slug consumer; embeds namespace into `.rp.json`)
- `src/library/library-paths.ts:190` — `findInstalledRecordForPath` (reverse-lookup for collision naming + orphan ownership)
- `src/library/library-installer.ts:43` — `installMutex` (single global lock)
- `src/library/library-installer.ts:84` — `this.t = options.t ?? defaultT` (injected translator, unused by preflight)
- `src/library/library-installer.ts:97` — `install` (journal-first/marker-last commit order)
- `src/library/library-installer.ts:148` — `recoverInterrupted` (journal-only loop; migration + scan hook here)
- `src/library/library-installer.ts:181` — `planInstall` (in-memory validation)
- `src/library/library-installer.ts:196-209` — preflight (`readMarker` + 3 `adapter.exists` → misleading literal)
- `src/library/library-installer.ts:246` — snippet-node extraction (`kind === 'snippet'`)
- `src/library/library-installer.ts:256-265` — 1g-bis subfolder-closure check
- `src/library/library-installer.ts:329` — `installedProtocolSha256` (INSTALLED hash; builder must NOT emit this)
- `src/library/library-installer.ts:351-360` — `readMarker` (returns null for both collision and dirty slot)
- `src/library/library-installer.ts:364` — `isMarkerCommitted`
- `src/library/library-installer.ts:382-405` — `uninstall` (derives namespaces from the RECORD at `:387-388`)
- `src/library/library-installer.ts:423-470` — `removeOwnedPaths` (`isOwned` gate at `:430-432`; `adapter.remove` at `:436`)
- `src/library/library-installer.ts:487-497` — `rollbackTransaction` (re-derives namespaces from settings at `:489-490`)
- `src/library/installed-record-store.ts:18` — `INSTALLED_DIR`
- `src/library/installed-record-store.ts:21-22` — `installedRecordPath` (derivation site 4; marker slot)
- `src/library/installed-record-store.ts:62-89` — `list` (skips corrupt markers at `:87`)
- `src/library/installed-record-store.ts:107` — `delete` (exists; NOT called by uninstall path)
- `src/library/transaction-journal.ts:27` — `TRANSACTIONS_DIR`
- `src/library/transaction-journal.ts:68-69` — `transactionJournalPath` (derivation site 3)
- `src/library/transaction-journal.ts:108-140` — `listAll` (walks ONLY `TRANSACTIONS_DIR`)
- `src/library/library-service.ts:63` — `LibraryService` facade
- `src/library/library-service.ts:68` — `readonly installer` (public; round-trip re-install entry)
- `src/library/library-service.ts:71` — `readonly recordStore` (not yet injected into installer)
- `src/library/library-service.ts:127` — `install`; `:141` — `uninstall`; `:152` — `listInstalled`; `:179` — `getReleaseManifest`
- `src/library/library-model.ts:44-62` — `PackageManifest` (only `author` optional)
- `src/library/library-model.ts:66` — `CatalogEntry.packageId` (opaque server id)
- `src/library/library-model.ts:110-124` — `InstalledRecord` (`protocolPath` + `snippetNamespace` must migrate)
- `src/library/library-model.ts:132-135` — `ReleaseBundle` (structurally identical to `ReleaseResponse`)
- `src/library/library-model.ts:174` — `isPackageManifest`; `:218` — `isInstalledRecord`
- `src/library/registry-model.ts:15-18` — `ReleaseResponse` (= `ReleaseBundle` shape)
- `src/library/registry-model.ts:43-52` — `isReleaseResponse` (accepts single-JSON `{ manifest, snippetContents }`)
- `src/library/registry-client.ts:22` — `DEFAULT_REGISTRY_URL = ''` (backend deferred)
- `src/library/registry-client.ts:89` — `fetchCatalog`; `:121` — `fetchRelease`; `:155` — `fetchReleaseManifest`
- `src/library/integrity.ts:30` — `sha256String` (async hashing primitive); `:56` — `verifyIntegrity`
- `src/views/library-view.ts:54` — `LIBRARY_INSTALLED_DIR`; `:171` — `delete` watcher; `:196-203` — `shouldHandle`; `:217` — `refresh`; `:391` — `renderInstalledRecord`; `:423` — `openInstall`
- `src/views/library-item-detail-modal.ts:23` — modal pattern; `:91` — `safeResolve`; `:112-116` — `loadManifest`; `:159` — `shortHash` (display-only truncation, NOT a hasher)
- `src/views/confirm-modal.ts:42` — `ConfirmModal`
- `src/views/snippet-manager-view.ts:533-552` — `handleDeleteSnippet` (confirm+service+refresh template)
- `src/views/protocol-picker-modal.ts:39` — `ProtocolPickerSuggestModal` (caller pre-collects files; `isLibraryManagedPath` scoping at `:68`)
- `src/snippets/snippet-model.ts:126-132` — `slugifyLabel` (lossy; shared with snippet-folder slugs — DO NOT change globally)
- `src/i18n/i18n-service.ts:39-52` — `t()` with `{param}` interpolation at `:50`
- `src/i18n/index.ts:10` — `Translator` type; `:18` — `defaultT`
- `src/i18n/locales/en.json:341-381` — `library.*` namespace (no uninstall/collision/export/recovery keys present)
- `src/main.ts:83` — `libraryService` construction; `:87` — `recoverInterruptedInstalls()` (before view registration); `:287` — `rebuildLibraryServices`

## Integration Points

### Inbound References
- `src/main.ts:87` — calls `libraryService.recoverInterruptedInstalls()` on load; the migration + hardened scan attach here (run after journal recovery, under the mutex).
- `src/views/library-view.ts:391` — `renderInstalledRecord` is the sole render site for installed records; the Uninstall button slots in after the integrity badge.
- `src/views/library-view.ts:414`/`:423` — `openDetail`/`openInstall` consume `LibraryService.getReleaseManifest`/`install`; the new export modal is a sibling of `LibraryItemDetailModal`.
- `src/views/library-install-progress-modal.ts` — displays `planInstall`'s `reason` as `{reason}` inside `library.installFailed`; the collision/dirty-slot strings nest here.
- `src/views/snippet-manager-view.ts` / `protocol-picker-modal.ts:68` / `protocol-editor-view.ts` — consume `isLibraryManagedPath` + `findInstalledRecordForPath` for read-only indicators; a missed slug+hash derivation site would silently break these indicators.

### Outbound Dependencies
- `src/library/library-installer.ts:247` → `buildReferenceMapping` (`src/library/library-paths.ts:152`) — must receive the new namespace segment.
- `src/library/library-installer.ts:240`/`:305` → `ProtocolDocumentParser` / `GraphValidator` — the builder reuses both for source-doc validation before building.
- `src/library/library-installer.ts:329`/`:227-230` → `sha256String`/`verifyIntegrity` (`src/library/integrity.ts`) — the builder mirrors the source-hash computation.
- `src/library/library-service.ts:144` → `installer.uninstall` (`src/library/library-installer.ts:382`) — the view's uninstall handler goes through the facade, never the installer directly.
- `src/library/library-service.ts:68` — `installer` is public; the round-trip re-install calls `installer.install(bundle)` directly, bypassing `RegistryClient`.

### Infrastructure Wiring
- `src/main.ts:83` — `new LibraryService(app, librarySettings, registryClient, { t })`; the installer's new `recordStore`/lister injection is constructed here (`rebuildLibraryServices` at `:287` mirrors it on registry-URL change).
- `src/library/library-installer.ts:43` — single global `installMutex` + `INSTALL_LOCK_KEY` serializes install/uninstall/recovery/migration — the migration and scan reuse it, no new lock domain.
- `src/i18n/locales/en.json:341` + `ru.json` — new `library.*` keys (collision, dirtySlot, uninstall*, export*, recovery*) added to BOTH locales; `check-consistency.mjs` Check 7 enforces en/ru key-set parity for `library.*` (added in `d4eb13f`).
- `src/views/library-view.ts:167-180` — vault watchers (`create`/`delete`/`rename`/`modify`) scoped via `shouldHandle` (`:196-203`); 120ms debounce at `scheduleRedraw`. The uninstall handler adds an explicit `await this.refresh()` rather than relying on the `delete` watcher firing for a dotfolder `adapter.remove`.

## Architecture Insights
- **Lossy slug aliased everywhere** — `slugifyPackageId = slugifyLabel` is shared with snippet-folder slug usage (`src/snippets/snippet-model.ts:126`); the slug+hash fix MUST stay localized to `library-paths.ts` namespace derivation and MUST NOT re-touch `slugifyLabel` globally (precedents `a0e4237`/`4891e4e` each had a same-week follow-up when the slugifier was touched).
- **Four derivation sites + two more** — any partial slug+hash fix that rekeys some sites but not all reintroduces the collision or wedges a different layer. All four sites (`libraryProtocolNamespace`, `librarySnippetNamespace`, `transactionJournalPath`, `installedRecordPath`) plus `buildReferenceMapping` and the protocol filename must share ONE precomputed segment helper.
- **Record-derived vs settings-derived namespaces** — `uninstall` uses the record (`:387-388`, Step 5 C6); `rollbackTransaction` re-derives from settings (`:489-490`). The migration must rewrite the record's stored paths or `uninstall` silently orphans files; `rollbackTransaction` is safe post-migration because it only sees new-scheme journals.
- **Journal-first / marker-last atomicity** — the marker's presence+validity IS the commit signal (`isMarkerCommitted` at `:364`); the migration mirrors this (marker rewrite LAST) so an interrupted migration is detectable and recoverable.
- **Pure vs Obsidian split (NFR-01)** — `library-paths`/`library-model`/`registry-model`/`integrity` are pure; the new path-segment hasher is pure (builds on `sha256String`); the builder's vault reads and the migration's file moves are Obsidian-layer (on `LibraryService`/`LibraryInstaller`); the export modal is a view.
- **Never-throws contract** — `LibraryService` wraps everything in try/catch → result unions; the uninstall handler checks `status`, not exceptions. `RegistryClient` is GET-only (`fetchRelease` at `:121`); no write-transport this round (Decision 8 — deferred; empty default URL at `registry-client.ts:22`).
- **Round-trip is structural** — `ReleaseResponse` ≡ `ReleaseBundle`; a single-JSON export re-installs via the public `installer` with no parallel parser. The builder emits the SOURCE bundle so the installer's rewrite pipeline runs identically on re-install.
- **Compose, never extend** — `PackageManifest` WRAPS `ProtocolDocumentV1` (`src/library/library-model.ts:44`); the production-ready round does NOT touch `ProtocolDocumentV1` or the manifest wire shape, keeping the blast radius inside `src/library/` + views + tests + i18n (the `b895736` precedent's 40-file blast radius is the warning for violating this).

## Precedents & Lessons
4 precedent clusters analyzed.

### Precedent: The current `src/library/` cluster's birth — the baseline being hardened
**Commit(s)**: `d4eb13f` — "feat: add moderated community library" (2026-08-05)
**Blast radius**: 35 files, +4473/−17 across every layer (9 new `src/library/` modules, 3 new library views, `main.ts` +112, `library.css`, i18n +46 each, 8 new `src/__tests__/library/` suites).
**Follow-up fixes**: NONE. `git log d4eb13f..HEAD` shows only docs commits + the `bdd06f9` "3.0.0" version bump. The cluster is fresh and untested in the wild — this production-ready round is its first hardening pass with no field bug-fix history.
**Lessons from docs**:
- `.rpiv/artifacts/designs/2026-08-04_17-41-05_moderated-community-library.md` (lines 411-414) — the collision was a KNOWN, explicitly-deferred risk: "Collision-check between distinct packageIds that slugify identically is the installer pre-flight's responsibility (D5) — a pure lossy slug cannot be injective by construction." The deferral IS the bug.
- Same design, lines 1401-1419 — the committed preflight lumps every occupied-destination case into one `destination occupied (prior incomplete install) — run recovery first` literal. This is the exact misleading message being split.
- `.rpiv/guidance/src/library/architecture.md` — `recoverInterrupted` enumerates ONLY journals; confirmed in committed code (`library-installer.ts:148-175`). This is the FR-4 blind spot.
**Takeaway**: The production-ready round closes gaps the original design explicitly deferred — treat D5's preflight deferral and the journal-only recovery as the precise seams to fix, not new discoveries. Cite D5 in the plan so reviewers know this is intentional completion.

### Precedent: The abandoned community library — added, grown, then fully deleted (lifecycle warning)
**Commit(s)**: `2ccc66a` (MVP, 2026-05-03) → `6657b8d` (complete removal, 2026-06-02)
**Blast radius**: ~2,500 lines added, 8,365 deleted across `src/snippets/library-*`, `src/protocol/protocol-library-*`, `src/views/library-*`, styles, i18n (~131 keys ×2), settings, main.ts. Only `md-template.ts` survived.
**Follow-up fixes** (8+ in 9 days — the install/network/path/i18n bug magnet): `9b4a886` (create parent folder on install), `cb41717` (37 dead i18n keys ×2 + dead CSS), `e14c5c1` (URL-encode Cyrillic download paths), `fa3d478`/`d9c9487` (fetch/requestUrl re-encoding cascade), `4802750`/`4891e4e` (slugify/transliterate Cyrillic admin names), `7231c9a` (harden CSS selectors), `c636747` (bundle default URLs).
**Lessons from docs**:
- `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` — root cause of the deletion was "wired but not integrated into active workflows"; the new cluster's design states the lesson: "The deleted library was only a command+modal and died of non-integration."
**Takeaway**: A library surface that isn't a first-class `registerView`-ed ItemView wired into real workflows gets deleted within 30 days. The current cluster already passed that bar (`d4eb13f` registers `LIBRARY_VIEW_TYPE`); the Uninstall UI + export modal must preserve the integration invariant.

### Precedent: slugifyLabel Cyrillic fix + admin slugify — do NOT change the slugifier globally
**Commit(s)**: `a0e4237` (Cyrillic via Unicode property escapes, 2026-04-09); `4891e4e` (slugify admin directory names, 2026-05-21); `9cb7ca0` (follow-up: skip filesystem rename when slug unchanged, 2026-05-22)
**Blast radius**: small (2-3 files each) but each slugifier touch had a same-week follow-up.
**Takeaway**: The slugifier has been tuned twice and each change had a follow-up. The slug+hash fix is the correct avoidance — keep it inside `library-paths.ts` namespace derivation; hash the RAW packageId, not the slug.

### Precedent: md-template library migration — a prior in-place format/path migration
**Commit(s)**: `1e9996c` — "feat: migrate library to md-template format with ru/en support" (2026-05-26)
**Blast radius**: 17 files, +593/−111.
**Lessons from docs**: `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` — "Format/state migration precedents — idempotency + fallback-on-error + immediate snapshot regression tests."
**Takeaway**: The legacy slug→slug+hash migration (FR-2) is structurally a path-scheme migration. Budget for: idempotent re-run (no-op on already-migrated vaults), atomic-per-package rollback, a seeded-legacy regression test, and `ensureFolderPath` + `assertNoTraversal` on the new slug+hash paths (the `9b4a886` parent-folder lesson).

### Composite Lessons
- The slug collision is a documented deferral (D5), not a discovery — cite D5 in the plan as intentional completion, not rework. (`d4eb13f`, design lines 411-414)
- `recoverInterrupted()` enumerates journals only — never destination folders. The FR-4 hardening adds a destination-folder scan as a SECOND pass; keep the journal-driven path (marker present+valid → commit) and add the scan for marker-less orphans. Do not replace the journal path. (`library-installer.ts:148-175`)
- Do NOT change `slugifyLabel` globally — it's aliased into `library-paths.ts` AND shared with snippet-folder slugs AND `snippet-chip-editor.ts` inlines its own copy. Each prior touch (`a0e4237`, `4891e4e`) had a same-week follow-up (`9cb7ca0`). Keep `slug+shortHash(rawPackageId)` inside `library-paths.ts`; hash the RAW id. (`a0e4237`/`4891e4e`/`9cb7ca0`)
- The current cluster has ZERO follow-up fix commits — it's fresh. The deleted library accrued 8+ fixes in 9 days once it hit real install/network/path/i18n seams. Budget for the same seam failures in manual Obsidian testing — especially Cyrillic/Unicode packageIds through the new slug+hash path and the export→re-install round-trip. (`d4eb13f` vs `2ccc66a`→`6657b8d`)
- i18n parity is enforced by `check-consistency.mjs` Check 7 (en/ru key-set parity for `library.*`); add every new error/Uninstall/export/recovery string to BOTH `en.json` and `ru.json` in the same commit or the gate fails. (`d4eb13f` added the gate; `cb41717` is the dead-keys precedent)
- Migration must be idempotent + atomic-per-package + seeded-legacy-tested — precedents (`1e9996c`, `1dd1f78`) show migrations need re-runnable no-op behavior, per-unit rollback, and a seeded pre-migration-state regression test. (`1e9996c`)
- Path-safety is net-new per surface — `assertNoTraversal` (`library-paths.ts:93`) gates current paths; the new `slug+hash` segment must pass the same gate, and the export bundle's `relPath` values must be re-validated on install, not trusted from build. (`e14c5c1`, `9b4a886`)
- Keep the blast radius inside `src/library/` + views + tests + i18n — the slug+hash migration and export path do NOT change `ProtocolDocumentV1` or the manifest wire shape. The `b895736` precedent (40-file blast radius for a format change) is the warning for violating "compose, never extend." (`b895736`)
- The export/publish path reuses the installer's own bundle shape (`registry-model.ts:15-18`); the local builder assembles exactly that shape so the round-trip test is structural, not a parallel parser. Do not add write-transport this round (Decision 8). (`registry-client.ts:22`, `:121`)
- Verify integration before touching shared components — before changing `library-paths.ts`, grep every consumer of `libraryProtocolFilePath`/`librarySnippetFilePath`/`libraryProtocolNamespace`/`installedRecordPath` and confirm the slug+hash derivation is the single source; a missed call site would silently break the read-only integration indicators (Slice 8 of the original design). (`d4eb13f`)

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-08-13_09-07-46_library-production-ready.md` — input FRD: 10 decisions, the slug+hash recommended approach, and the collision-verification open question this research resolves.
- `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` — prior research for the current cluster; contains the deleted-library lifecycle lessons and the slugifier precedents.
- `.rpiv/artifacts/designs/2026-08-04_17-41-05_moderated-community-library.md` — the cluster's design; D5 collision deferral (lines 411-414) and the single misleading preflight literal (lines 1401-1419) are the seams being closed.
- `.rpiv/guidance/src/library/architecture.md` — layer guidance: empty default registry URL, ed25519 deferred, journal-first/marker-last installer, pure/Obsidian split.

## Developer Context
**Q (discover: Primary intent: maintainer ship-to-production): When the library reaches production-ready, whose workflow is the primary one being fixed, and what does a working state let them do that they can't do today?**
A: Maintainer (Roman) — ship the library feature reliably; today the prototype has known gaps blocking release; success = scope known and gaps closed for a production ship.

**Q (discover: Vault snippet edit is already implemented): Vault snippet create AND edit are already fully implemented (`src/snippets/snippet-service.ts:251`; `src/views/snippet-editor-modal.ts:92`). Keep (reuse) or is the existing edit broken/incomplete?**
A: Keep — reuse existing editor. "Editing snippets" is not missing work.

**Q (discover: Publish path is a real, large build; backend stays future): No upload/publish path at any layer; registry client GET-only (`src/library/registry-client.ts:121`). Keep (build publish path, backend future) or narrow/defer?**
A: Keep — build publish path (local builder + export); hosted backend deferred.

**Q (discover: Uninstall UI wiring in scope): Uninstall service+installer exist (`src/library/library-service.ts:141`) but no UI wiring (`src/views/library-view.ts:391` renders no button). Include in scope or defer?**
A: Keep — wire uninstall UI.

**Q (discover: "Ct space" is a package, not a file): What is "Ct space"?**
A: "Ct space" is the "Chest CT (space id)" PACKAGE — it fails to install with "destination occupied (prior incomplete install)"; two of three library packages install, the third fails. A package-level install refusal, not a file-level silent drop.

**Q (discover: Root cause — slug collision on opaque packageIds): Repro pattern — consistent/order-dependent (slug collision) or one-time stuck after an interrupt (dirty slot)?**
A: Consistent / order-dependent. Two distinct opaque packageIds collapse to one destination folder; the third sees the first's files with a mismatched marker.

**Q (discover: Fix — slug + short hash of raw packageId): How should the plugin handle the collision?**
A: Slug + short hash (e.g. `library/chest-ct-protocol-a1b2c3/`). Optimizes readable paths + collision-resistance + coexistence; less invasive than non-lossy raw-id keying.

**Q (discover: Publish shape — local package builder + export): What does "upload" look like now?**
A: Local package builder + export. Shippable + testable now with no backend; packaging logic reuses for a future write-transport.

**Q (discover: Uploadable unit — full package): Uploadable unit — full package or standalone snippets?**
A: Full package: protocol + its referenced snippets. Matches the bundle model the installer consumes (`src/library/registry-model.ts:15-18`).

**Q (discover: Scope bar — core + production hardening): Production-ready bar — core threads only, core + production hardening, or core + error messaging only?**
A: Core + production hardening (recovery hardening + error-messaging refactor in scope). True production-ready requires closing the recovery blind spot and the misleading collision/dirty-slot message.

**Q (research checkpoint / `src/snippets/snippet-model.ts:126-132`): The collision assumption is unverified against real data — the three titles slugify distinctly and no catalog fixture exists in `src/__tests__/library/`. Can you provide the real packageId values (or a `/catalog` capture), or should the FR-1 test use synthetic colliding IDs?**
A: Use synthetic colliding IDs (e.g. `'chest.ct'` + `'chest-ct'` both slugify to `chest-ct`). No registry access needed; root cause already established by the consistent, order-dependent repro.

**Q (research checkpoint / `src/library/library-installer.ts:201,204,209`): The FRD NFR-UX scopes the i18n refactor to the "destination occupied" literal, but analysis found 31 hard-coded English strings. How broad should the i18n refactor be this round?**
A: FRD scope only — i18n the 3 destination-occupied literals (replaced by the collision/dirty-slot split) + all NEW strings (uninstall, export, collision, dirty-slot, recovery). Leave the other ~28 preflight/validation literals and `buildReferenceMapping`'s 3 hard-coded this round.

**Q (research checkpoint / `src/library/library-installer.ts:148` + `src/library/installed-record-store.ts:87`): Recovery's orphan scan treats any folder with no matching valid record as orphaned, but `list` skips a corrupt-but-present marker — risking deletion of a valid package with a rotted marker. What data-loss tolerance for the scan?**
A: Skip if any marker file present — before deleting an orphaned namespace, check whether ANY `.json` exists at the installed slot `.radiprotocol/library/installed/<pkgSlug>/<verSlug>.json` (built from the discovered folder slugs); a present-but-corrupt marker blocks deletion. Safer; still cleans journal-less interrupt orphans (which have no marker).

## Related Research
- `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` — prior research for the current library cluster (deleted-library lifecycle, slugifier precedents, migration patterns).

## Open Questions
- **Async-vs-precomputed-segment threading**: the four derivation functions are synchronous but `sha256String` is async. Two implementation strategies — (a) make the derivation functions async (ripples through all call sites; `buildReferenceMapping` would newly become async or take a precomputed segment), or (b) compute the segment once in `planInstall` and thread a precomputed `namespaceSegment` string through the synchronous helpers (changes signatures from `(root, packageId, version)` to accept the segment). Both are viable; this is a design-phase decision, not a research gap.
- **Migration detection mechanism**: bump `INSTALLED_RECORD_VERSION` (`src/library/library-model.ts:19`) vs add an explicit `namespaceSegment` field on `InstalledRecord` — both let migration detect already-migrated state and preserve `rollbackTransaction` consistency. Design-phase decision.
- **Export serialization target**: a single JSON file vs a folder. The round-trip works with a single JSON file (`isReleaseResponse` accepts it); the export modal's file-write target (vault file vs filesystem) is a design-phase UX decision.
- **`InstalledRecordStore` injection shape**: inject the store directly vs a `() => Promise<InstalledRecord[]>` lister function (avoids granting the installer write access to the record store). Both unblock the preflight split and the orphan scan; design-phase decision.