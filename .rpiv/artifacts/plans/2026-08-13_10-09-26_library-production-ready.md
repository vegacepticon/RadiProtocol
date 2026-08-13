---
date: 2026-08-13T10:09:26+0300
author: Roman Shulgha
commit: bdd06f9
branch: main
repository: RadiProtocol
topic: "Library production-ready: slug+hash destination keying, migration, preflight split, recovery hardening, local builder/export, uninstall UI"
tags: [plan, library, library-installer, library-paths, library-service, library-migration, installed-record-store, transaction-journal, library-model, integrity, registry-model, library-view, library-export-modal, confirm-modal, i18n, snippets, snippet-model, main]
status: in-review
parent: .rpiv/artifacts/research/2026-08-13_09-42-22_library-production-ready.md
phase_count: 7
unresolved_phase_count: 0
phases:
  - { n: 1, title: "Slug+hash namespace segment + derivation signatures", files: [src/library/library-paths.ts, src/library/installed-record-store.ts, src/library/transaction-journal.ts, src/library/library-installer.ts, src/__tests__/library/library-paths.test.ts, src/__tests__/library/library-installer.test.ts, src/__tests__/library/installed-record-store.test.ts, src/__tests__/library/library-service.test.ts], depends_on: [] }
  - { n: 2, title: "Preflight collision-vs-dirty-slot split + lister injection", files: [src/library/library-installer.ts, src/library/library-service.ts, src/i18n/locales/en.json, src/i18n/locales/ru.json, src/__tests__/library/library-installer.test.ts], depends_on: [1] }
  - { n: 3, title: "Recovery destination-folder orphan scan", files: [src/library/library-installer.ts, src/library/library-service.ts, src/__tests__/library/library-installer.test.ts, src/__tests__/library/library-service.test.ts], depends_on: [2] }
  - { n: 4, title: "One-time slug to slug+hash migration", files: [src/library/library-migration.ts, src/library/library-installer.ts, src/library/library-service.ts, src/__tests__/library/library-migration.test.ts, src/__tests__/library/library-installer.test.ts], depends_on: [1, 2] }
  - { n: 5, title: "Local package builder", files: [src/library/library-service.ts, src/__tests__/library/library-service.test.ts], depends_on: [1] }
  - { n: 6, title: "Export modal + command", files: [src/views/library-export-modal.ts, src/main.ts, src/i18n/locales/en.json, src/i18n/locales/ru.json, src/__tests__/views/library-export-modal.test.ts], depends_on: [5] }
  - { n: 7, title: "Uninstall UI", files: [src/views/library-view.ts, src/i18n/locales/en.json, src/i18n/locales/ru.json, src/__tests__/views/library-view-uninstall.test.ts], depends_on: [] }
last_updated: 2026-08-13T10:09:26+0300
last_updated_by: Roman Shulgha
---

# Library Production-Ready Implementation Plan

## Overview

Bring the community-library prototype (`src/library/`, `src/views/library-*.ts`) to production-ready by keying install destinations on `slug + shortHash(rawPackageId)` via a precomputed namespace segment threaded through the synchronous path helpers, running a one-time idempotent migration of already-installed packages, splitting the misleading "destination occupied" preflight into collision-vs-dirty-slot messaging, hardening recovery with a marker-file-guarded destination-folder orphan scan, adding a local package builder + export modal that round-trips a single-JSON `ReleaseBundle` through the existing installer, and wiring the uninstall UI. The blast radius stays inside `src/library/` + views + tests + i18n — `ProtocolDocumentV1` and the manifest wire shape are untouched.

## Requirements

- **FR-1 Slug+hash destination keying**: two distinct opaque packageIds that slugify identically (e.g. `'chest.ct'` + `'chest-ct'` → `chest-ct`) MUST install to distinct destination folders. The hash is computed over the RAW packageId (not the slug), threaded as a precomputed segment through all four derivation sites + `buildReferenceMapping` + the protocol filename.
- **FR-2 One-time migration**: already-installed packages (slug-only paths) MUST be migrated to slug+hash paths on plugin load — rewrite each `InstalledRecord`'s `protocolPath`/`snippetNamespace`, re-rewrite the embedded `snippetPath`/`subfolderPath` refs inside the on-disk `.rp.json`, and move the marker + snippet + protocol files. Idempotent (no-op on already-migrated vaults), atomic-per-package (marker rewrite LAST), serialized under the global `installMutex`, runs after `recoverInterrupted` and before view registration.
- **FR-3 Collision-vs-dirty-slot preflight**: replace the three hard-coded "destination occupied (prior incomplete install)" literals in `planInstall` with (a) collision messaging that names BOTH colliding packageIds, and (b) dirty-slot messaging ("incomplete install of X — run recovery"). i18n the three literals via the injected `t` with `{param}` interpolation.
- **FR-4 Recovery hardening**: add a destination-folder scan to `recoverInterrupted` that cleans orphaned namespace folders (journal-less interrupt leftovers), guarded by a "skip if any marker `.json` is present at the installed slot" safety check so a valid package with a corrupt marker is never deleted.
- **FR-5 Local package builder**: `LibraryService.buildLocalPackage` assembles a SOURCE (un-rewritten) `ReleaseBundle` from a protocol doc + its referenced snippets, computing source SHA-256 hashes (canonical pretty JSON + trailing newline for the protocol; raw content for snippets). Emits the SOURCE bundle so the installer's rewrite pipeline re-runs on re-install.
- **FR-6 Export modal**: serialize `{ manifest, snippetContents }` to a single `.json` file in the vault (FolderSuggest destination + filename + collision preflight + `writeJsonFile`). Round-trips through `isReleaseResponse` → `installer.install()`.
- **FR-7 Authoring-time collision warning**: the builder validates the slug via `validPackageSlug` and compares `slugifyPackageId(builderPackageId)` against each installed record's `slugifyPackageId(record.packageId)` — compare slugs not raw ids (the slugifier is lossy).
- **FR-8 Uninstall UI**: wire the existing `LibraryService.uninstall` into `LibraryView.renderInstalledRecord` (Uninstall button → `ConfirmModal` → facade → status check → Notice → explicit `await this.refresh()`).
- **FR-9 Scoped i18n**: i18n the 3 destination-occupied literals + all NEW strings (collision, dirty-slot, uninstall, export, recovery) in BOTH `en.json` and `ru.json`. The other ~28 hard-coded preflight/validation literals stay hard-coded this round.
- **NFR**: no hosted backend/write-transport (registry client stays GET-only); no ed25519 signatures; `slugifyLabel` is NOT changed globally; no `ProtocolDocumentV1` or manifest wire-shape change.

## Current State Analysis

The library cluster is a fresh, unhardened prototype (born in commit `d4eb13f`, zero follow-up fixes) built on a transactional journal-first/marker-last installer whose destination paths derive from a single lossy slugifier aliased as `slugifyPackageId` (`src/library/library-paths.ts:22` = `slugifyLabel` at `src/snippets/snippet-model.ts:126-132`, non-injective by construction). That same slug propagates to four independent derivation sites — protocol namespace (`library-paths.ts:44-46`), snippet namespace (`:53-55`), journal filename (`transaction-journal.ts:68-69`), marker path (`installed-record-store.ts:21-22`) — plus `buildReferenceMapping` (`library-paths.ts:152`) and the protocol filename (`:62-63`). Two distinct opaque packageIds that slugify identically wedge each other at every layer.

The collision was a KNOWN, explicitly-deferred risk: design `D5` (`.rpiv/artifacts/designs/2026-08-04_17-41-05_moderated-community-library.md` lines 411-414) deferred collision-checking to the installer preflight, but the preflight never checks for two distinct packageIds that slugify identically — it lumps every occupied-destination case into one "destination occupied (prior incomplete install)" literal (`library-installer.ts:201,204,209`). `recoverInterrupted` (`:148`) enumerates ONLY journals (`transaction-journal.ts:108` walks only `TRANSACTIONS_DIR`), so a dirty slot with destination files but no journal is invisible to recovery. `LibraryInstaller` does NOT hold an `InstalledRecordStore` reference (`:79-85` injects only `app`/`settings`/`t`/`journalIO`), blocking both the preflight split and the orphan scan. The uninstall service exists (`library-service.ts:141`) but `renderInstalledRecord` (`library-view.ts:391`) renders no action button. There is no local package builder or export path.

### Key Discoveries

- **`sha256String` is async** (`src/library/integrity.ts:30`); the four derivation functions are synchronous today. Decision: compute the segment once in `planInstall` (already async) and thread a precomputed `namespaceSegment` string through the synchronous helpers — no function newly becomes async.
- **`rollbackTransaction` re-derives namespaces from settings** (`library-installer.ts:489-490`); `uninstall` derives from the RECORD (`:387-388`, Step 5 C6). Post-migration, new journals carry slug+hash paths and re-derive slug+hash namespaces → consistent. Legacy journals are handled by `recoverInterrupted` before migration runs.
- **`isReleaseResponse` (`registry-model.ts:43`) accepts a single JSON `{ manifest, snippetContents }`** — structurally identical to `ReleaseBundle` (`library-model.ts:132-135`). The round-trip is structural, no parallel parser.
- **`LibraryService.installer` is public** (`library-service.ts:68`) — the re-install calls `installer.install(bundle)` directly, bypassing `RegistryClient`.
- **The codebase has NO version-bump upgrade path** — `isInstalledRecord` (`library-model.ts:218`) rejects any `version !== 1`. `migrateProtocolDocument` (`protocol-document-migration.ts:1-110`) is the in-codebase migration template: pure, discriminator-first, idempotent, lossless spreads, injectable `now()`.
- **`rewriteSnippetRef` + `buildReferenceMapping`** (`library-paths.ts:126,152`) are directly reusable for rewriting embedded snippet refs in migrated `.rp.json` files.
- **`SnippetEditorModal` create-mode** (`snippet-editor-modal.ts:287-540`) is the export-modal template: `FolderSuggest` folder input + name input + collision preflight + `writeJsonFile` (pretty JSON + trailing newline, `library-json-io.ts:55`).
- **i18n parity is enforced** by `scripts/check-consistency.mjs` Check 7 (lines 95-113): en/ru key-set parity for ALL keys; a missing key in either locale fails the gate.
- **`adapter.remove()` on a dotfolder file does not reliably fire `vault.on('delete')`** — the uninstall handler needs an explicit `await this.refresh()` (the `handleDeleteSnippet` template at `snippet-manager-view.ts:549` includes it).

## Desired End State

Two colliding packages install to distinct folders and coexist:

```typescript
// 'chest.ct' and 'chest-ct' both slugify to 'chest-ct' but have distinct raw ids.
// After the fix, their destinations differ by the hash segment:
//   Protocols/library/chest-ct-a1b2c3d4e5f6/1-0-0/chest-ct-a1b2c3d4e5f6.rp.json
//   Protocols/library/chest-ct-9f8e7d6c5b4a/1-0-0/chest-ct-9f8e7d6c5b4a.rp.json
const r1 = await installer.install(bundleChestCtDot);   // status: 'ok'
const r2 = await installer.install(bundleChestCtDash);  // status: 'ok' (no collision)
```

A collision is named, not mislabeled:

```typescript
// Installing a third package whose slug collides with an already-installed one:
const result = await installer.install(bundleColliding);
// result.status === 'failed'
// result.reason === t('library.collisionError', { incoming: 'chest-ct', existing: 'chest.ct' })
// (nested inside library.installFailed's {reason} in the progress modal)
```

A local protocol is authored and exported, then re-installed from the exported file:

```typescript
// "Export protocol as library package" command → pick protocol → export modal:
const build = await libraryService.buildLocalPackage('Protocols/chest-ct.rp.json', {
  packageId: 'chest-ct', releaseVersion: '1.0.0', author: { displayName: 'Roman' },
});
// build.status === 'ok'; build.bundle is a SOURCE ReleaseBundle.
await libraryService.writePackageExport(build.bundle, 'Exports/chest-ct-1.0.0.json');
// ...later, re-install from the exported file:
const parsed = JSON.parse(await vault.adapter.read('Exports/chest-ct-1.0.0.json'));
if (isReleaseResponse(parsed)) await libraryService.installer.install(parsed);  // status: 'ok'
```

An installed package is uninstalled from the library view:

```typescript
// LibraryView: Uninstall button → ConfirmModal → facade → refresh
const result = await this.plugin.libraryService.uninstall(record.packageId, record.releaseVersion);
if (result.status === 'ok') new Notice(t('library.uninstalledNotice'));
await this.refresh();  // explicit — dotfolder adapter.remove doesn't fire vault.on('delete')
```

Recovery cleans a journal-less orphan but spares a valid package with a corrupt marker:

```typescript
// A leftover namespace folder with NO journal and NO marker → orphan, cleaned.
// A namespace folder whose marker .json is present (even corrupt) → skipped (never delete).
const report = await installer.recoverInterrupted();
// report.orphansCleaned lists the cleaned namespaces.
```

## What We're NOT Doing

- **No hosted registry backend / write-transport** — `RegistryClient` stays GET-only (`registry-client.ts:22` empty default URL). The local builder + export is the publish path; a hosted backend is future/deferred (Decision 8).
- **No ed25519 signature verification** — integrity is SHA-256 corruption detection, NOT authenticity (`integrity.ts`). Unsigned installs are never presented as authenticated.
- **No global `slugifyLabel` change** — the slug+hash fix stays localized to `library-paths.ts` namespace derivation. `slugifyLabel` is shared with snippet-folder slugs; each prior touch (`a0e4237`/`4891e4e`) had a same-week follow-up (`9cb7ca0`).
- **No full 31-string i18n sweep** — only the 3 destination-occupied literals + new strings are i18n'd this round. The other ~28 hard-coded preflight/validation literals and `buildReferenceMapping`'s 3 literals stay hard-coded (would break 8 `toContain` test assertions + require injecting a `Translator` into the pure `buildReferenceMapping`).
- **No `ProtocolDocumentV1` or manifest wire-shape change** — the migration rewrites field VALUES (paths), not the schema. `INSTALLED_RECORD_VERSION` stays `1`. Blast radius stays inside `src/library/` + views + tests + i18n (the `b895736` precedent's 40-file blast radius is the warning for violating "compose, never extend").
- **No sidebar/RunnerView** (ADR-0001) — the library is an inline-only ItemView.

## Decisions

### D1: Segment threading — precomputed `namespaceSegment` string
**Ambiguity**: `sha256String` (`integrity.ts:30`) is async; the four derivation functions are synchronous. Make them async (ripples through all call sites, `buildReferenceMapping` newly becomes async) OR thread a precomputed segment?
**Explored**: (A) Make the 4 derivation functions async — each awaits `sha256String`; ripples through `planInstall`, `readMarker`, `uninstall` (`:382`), `rollbackTransaction` (`:487`), the stores, and `buildReferenceMapping` would newly become async or take a precomputed segment anyway. (B) Compute the segment once in `planInstall` (already async, `:181`) and thread a precomputed `namespaceSegment` string through the synchronous helpers (signatures change from `(root, packageId, version)` to accept the segment).
**Decision**: **(B) Precomputed segment** — no function newly becomes async; `buildReferenceMapping` (`library-paths.ts:152`) receives the segment as a param. Lowest ripple. (Developer checkpoint, confirmed.)

### D2: Migration detection — path-shape discriminator
**Ambiguity**: The migration must detect already-migrated records (idempotent no-op). Bump `INSTALLED_RECORD_VERSION` to 2 (sets the first version-bump precedent) OR add an explicit `namespaceSegment` field OR use a path-shape discriminator?
**Explored**: (A) Path-shape discriminator — keep `INSTALLED_RECORD_VERSION = 1`; detect already-migrated by checking whether the stored `protocolPath` matches the new slug+hash derivation (path contains the hash segment). `isInstalledRecord` keeps accepting records both before and after. Modeled on `migrateProtocolDocument`'s discriminator (`protocol-document-migration.ts:23`). (B) Bump version to 2 + relaxed v1 guard. (C) Add `namespaceSegment` field (denormalized).
**Decision**: **(A) Path-shape discriminator** — no schema change, no wire-shape change, lowest blast radius. The codebase has no version-bump upgrade path today; this avoids setting that precedent for a value-only rewrite. (Developer checkpoint, confirmed.)

### D3: Export serialization target — single JSON file in the vault
**Ambiguity**: Single JSON file vs folder; vault file vs filesystem?
**Explored**: (A) Single `.json` in the vault via `FolderSuggest` + `writeJsonFile` — round-trips through `isReleaseResponse` → `installer.install()`; matches `SnippetEditorModal` create-mode (`snippet-editor-modal.ts:287-540`). (B) Single JSON to filesystem (browser download) — diverges from the vault-write pattern, bypasses mutex/`ensureFolderPath`. (C) Folder bundle — breaks the structural single-JSON round-trip, requires a custom re-import parser.
**Decision**: **(A) Single JSON in the vault** — matches the established modal + `writeJsonFile` dialect (pretty JSON + trailing newline). (Developer checkpoint, confirmed.)

### D4: InstalledRecordStore injection shape — lister function
**Ambiguity**: Inject the full `InstalledRecordStore` vs a `() => Promise<InstalledRecord[]>` lister?
**Explored**: (A) Lister function — read-only; the installer already writes markers via `adapter` directly (`:336`), so it needs no write access to the store. One injection serves the preflight split + orphan scan + migration enumeration. (B) Inject the store directly — grants redundant write access; wider coupling.
**Decision**: **(A) Lister function** — narrowest capability, read-only. (Developer checkpoint, confirmed.)

### D5: Builder emits SOURCE (un-rewritten) bundle
The builder computes `protocolSha256 = sha256String(JSON.stringify(protocolDoc, null, 2) + '\n')` (matching `planInstall`'s source-integrity check at `library-installer.ts:233-236`) and per-snippet `sha256 = sha256String(content)` (`:227-230`). It emits the SOURCE doc + SOURCE snippet contents so the installer's full rewrite pipeline (`buildReferenceMapping` → `rewriteSnippetRef`) runs identically on re-install. A pre-rewritten bundle would fail the source-integrity check (`:235`) and double-rewrite the refs. (Research Thread 5; `library-installer.ts:329` is the INSTALLED hash the builder must NOT emit.)

### D6: Recovery scan — skip orphan deletion if any marker `.json` is present
Before deleting an orphaned namespace, check whether ANY `.json` exists at the installed marker slot `.radiprotocol/library/installed/<pkgSlug>/<verSlug>.json` (constructed from the discovered folder's slug names — the scan has the slugs, not the raw packageId). A present-but-corrupt marker blocks deletion. Safe because `list` skips corrupt markers (`installed-record-store.ts:87`) — a corrupt-marker package would otherwise be misclassified as orphaned — and journal-less interrupt orphans have NO marker (marker written LAST). (Research checkpoint, confirmed.)

### D7: Migration + scan reuse the existing `installMutex`; run after `recoverInterrupted`, before views
The migration and the orphan scan both hold the single global `installMutex` (`library-installer.ts:43`, fixed `INSTALL_LOCK_KEY`) — no new lock domain. `recoverInterruptedInstalls` (`main.ts:87`) runs `recoverInterrupted` (with the scan) THEN `migrateInstalledRecords`, before views register at `:91`, so no user action can race either. `rebuildLibraryServices` (`main.ts:287`) mirrors the lister injection. (Research Thread 2/4.)

### D8: i18n scoped to 3 literals + new strings, BOTH en/ru
The 3 destination-occupied literals (`library-installer.ts:201,204,209`, replaced by the split) + all NEW strings (collision, dirty-slot, uninstall, export, recovery) are added to BOTH `en.json` and `ru.json` under the `library.*` namespace with `{param}` interpolation (`i18n-service.ts:50`). `check-consistency.mjs` Check 7 (lines 95-113) enforces en/ru key-set parity. (Research checkpoint, confirmed.)

### D9: Export entry point — command reusing `ProtocolPickerSuggestModal`
The "Export protocol as library package" command (in `main.ts`, matching the existing command pattern) opens `ProtocolPickerSuggestModal` to pick the source protocol, then opens `LibraryExportModal` which collects `packageId`/`releaseVersion`/`author`/destination and calls `buildLocalPackage` → `writePackageExport`. The export modal is a sibling of `LibraryItemDetailModal` (Promise-based Modal + `safeResolve` double-guard). (Research Thread 5/6; pattern-finder Shape 2.)

## Ordering Constraints

- **Phase 1 (foundation) MUST land first** — the segment helper + derivation signature change is the atomic unit every later phase's path derivation depends on. No phase can type-check against half-changed signatures.
- **Phase 2 depends on Phase 1** — the preflight split + lister injection use the new signatures in `planInstall`.
- **Phase 3 depends on Phase 2** — the orphan scan uses the lister injection.
- **Phase 4 depends on Phases 1 + 2** — the migration uses the segment helper + path helpers + lister (for enumeration). It can run in PARALLEL with Phase 3 (independent methods on the installer; both called from `recoverInterruptedInstalls`). In the load sequence, recovery (Phase 3's scan) runs before migration (Phase 4).
- **Phase 5 depends on Phase 1** (loosely — uses `slugifyPackageId`/`assertNoTraversal`, both unchanged). It can run in PARALLEL with Phases 2, 3, 4.
- **Phase 6 depends on Phase 5** — the export modal calls `buildLocalPackage` + `writePackageExport`.
- **Phase 7 depends on nothing structural** — the uninstall service already exists. It can run in PARALLEL with Phases 2-6. Ordered last per the UI-last convention.
- **Cross-phase shared files**: `library-installer.ts` (Phases 1-4), `library-service.ts` (Phases 2, 4, 5), `main.ts` (Phases 2, 6), `en.json`/`ru.json` (Phases 2, 6, 7), `library-installer.test.ts` (Phases 1-4). Each phase's code fence contains ONLY that phase's incremental changes; implement applies phases sequentially and the codebase state evolves between them.

## Verification Notes

Carry forward from research — verifiable checks:

- **FR-1 collision test**: synthetic colliding IDs — `'chest.ct'` + `'chest-ct'` both slugify to `chest-ct` but have distinct raw ids → both install `status: 'ok'` to DISTINCT destination folders (assert the two `protocolPath` values differ AND both markers exist). The real opaque IDs are unobtainable from code; the three library titles slugify distinctly. (Research checkpoint.)
- **Hash over RAW packageId**: the segment is `slugifyPackageId(rawPackageId) + '-' + firstNHex(sha256String(rawPackageId))`. Hashing the SLUG would re-collapse both packages to the same suffix — assert `'chest.ct'` and `'chest-ct'` produce DIFFERENT segments. (Research Thread 1.)
- **All 4 derivation sites + buildReferenceMapping + protocol filename share ONE segment**: `grep` the four functions + `buildReferenceMapping` + `libraryProtocolFilePath` to confirm none still call `slugifyPackageId(packageId)` for the package segment (only `slugifyPackageId(version)` for the version slug remains). (Research Thread 1.)
- **Migration idempotency**: `migrate(migrate(records))` second call is a no-op (path-shape discriminator returns `changed: false`, same reference). Model the test on `protocol-document-migration.test.ts:23`. (Research Thread 2; pattern-finder Shape 1.)
- **Migration rewrites record fields + embedded refs**: after migration, `record.protocolPath`/`record.snippetNamespace` contain the hash segment, AND the on-disk `.rp.json`'s snippet-node `snippetPath`/`subfolderPath` fields embed the new namespace. `uninstall` (which derives from the record) then removes the new-namespace files. (Research Thread 2.)
- **Migration atomicity**: marker rewrite LAST (mirror install's commit order). A crash after moving files but before rewriting the marker leaves the old marker pointing at non-existent paths (silent orphan on uninstall) — the migration journal + marker-last order makes an interrupted migration detectable. (Research Thread 2.)
- **Recovery scan cleans journal-less orphan**: seed a namespace folder with destination files but NO journal and NO marker → `recoverInterrupted` deletes it; `report.orphansCleaned` lists it. (Research Thread 4.)
- **Recovery scan spares corrupt-marker package**: seed a namespace folder whose marker `.json` is present but corrupt/unparseable → `recoverInterrupted` does NOT delete it (the marker-file-exists check blocks deletion). (Research checkpoint; `installed-record-store.ts:87` skips corrupt markers in `list`.)
- **Builder emits SOURCE hash**: `manifest.protocolSha256` matches `sha256String(JSON.stringify(protocolDoc, null, 2) + '\n')` (the source form), NOT the installed/rewritten hash. Assert the bundle's `protocolDoc` has UN-rewritten `snippetPath`/`subfolderPath` fields. (Research Thread 5; `library-installer.ts:233-236` vs `:329`.)
- **Round-trip**: `buildLocalPackage` → `writePackageExport` → read the JSON → `isReleaseResponse(parsed)` is `true` → `installer.install(parsed)` returns `status: 'ok'`. (Research Thread 5; `registry-model.ts:43`.)
- **FR-7 collision warning**: `buildLocalPackage` with a `packageId` whose slug collides with an installed record's slug returns a collision result naming the existing package. Compare slugs (`slugifyPackageId`), not raw ids. (Research Thread 5.)
- **Uninstall UI explicit refresh**: `grep` `handleUninstall` in `library-view.ts` for `await this.refresh()` — the dotfolder `adapter.remove` does not reliably fire `vault.on('delete')`. (Research Thread 6; `snippet-manager-view.ts:549` template.)
- **i18n parity**: every new `library.*` key added to `en.json` is present in `ru.json` and vice versa — `node scripts/check-consistency.mjs` Check 7 passes. (Research; `check-consistency.mjs:95-113`.)
- **slugifyLabel unchanged**: `grep` `slugifyLabel` in `src/snippets/snippet-model.ts` — the function body is unchanged (the fix is localized to `library-paths.ts`). (Precedent `a0e4237`/`4891e4e`/`9cb7ca0`.)
- **No wire-shape change**: `isPackageManifest` (`library-model.ts:174`) and `isInstalledRecord` (`:218`) are unchanged in their sentinels/required fields (the migration rewrites values, not schema). `INSTALLED_RECORD_VERSION` stays `1`.

## Performance Considerations

- **Migration is a one-time sweep** over installed records (typically a handful in a personal vault). Runs once on load after recovery; idempotent no-op thereafter. Not perf-sensitive.
- **Recovery scan** adds a destination-folder BFS walk (mirrors `listAll`'s queue pattern, `transaction-journal.ts:113-136`). `findInstalledRecordForPath` matches against an in-memory `list()` result (list once, match in memory — no N+1 vault reads).
- **Segment computation** adds one `sha256String` per install (Web Crypto, sub-millisecond for a short id). Negligible.
- **Builder** reads source files from the vault (one read per snippet file) — not a hot path (authoring-time, user-initiated).

## Migration Notes

This is a one-time path-scheme migration (FR-2), structurally analogous to the `md-template` library migration (commit `1e9996c`) and modeled on `migrateProtocolDocument` (`protocol-document-migration.ts`):

- **Detection**: path-shape discriminator (D2) — a record whose `protocolPath` already contains the hash segment (matches the new-scheme derivation) is already-migrated → skip. No `INSTALLED_RECORD_VERSION` bump; `isInstalledRecord` keeps accepting records both before and after.
- **Per-package atomicity**: mirror `install`'s commit order — write a migration journal listing old→new path moves FIRST, move snippet files, move + re-rewrite the protocol file, rewrite the marker LAST. A crash after moving files but before rewriting the marker leaves the old marker pointing at non-existent paths (detectable; the next recovery/migration run re-detects the legacy marker and completes).
- **Idempotency**: re-running on an already-migrated vault is a no-op (the discriminator returns `changed: false`).
- **Rollback**: per-package; a single record's failure does not abort the sweep (per-record try/catch continue, mirroring `recoverInterrupted` at `library-installer.ts:170`).
- **Backwards compatibility**: `uninstall` derives deletion paths from the RECORD (`:387-388`), so it works for both slug-only (pre-migration) and slug+hash (post-migration) records. `rollbackTransaction` re-derives from settings (`:489-490`) and only sees new-scheme journals after migration (legacy journals are handled by `recoverInterrupted` first).
- **No `ProtocolDocumentV1` or manifest wire-shape change** — the migration rewrites the `.rp.json`'s snippet-node field values (paths) via `rewriteSnippetRef`, not the schema.

## Pattern References

- `src/protocol/protocol-document-migration.ts:1-110` — pure, idempotent, discriminator-first, lossless-spreads migration template (the per-record migration function shape).
- `src/library/library-installer.ts:148-176` — `recoverInterrupted` sweep orchestrator (hold `installMutex`, enumerate, per-record try/catch continue, detect already-done) — the migration orchestrator + orphan-scan shape.
- `src/library/library-installer.ts:247-290` — `buildReferenceMapping` + `rewriteSnippetRef` pipeline (directly reusable for rewriting embedded snippet refs in migrated `.rp.json` files).
- `src/library/installed-record-store.ts:50-91` — `list()` queue-walk + per-file isolation (the enumeration pattern for migration + orphan scan).
- `src/views/snippet-editor-modal.ts:287-540` — create-mode modal: `FolderSuggest` + name input + collision preflight + `computeCandidatePath` + save (the export-modal template).
- `src/views/folder-suggest.ts:1-62` — `FolderSuggest` (destination folder input; dispatches bubbling `input` event on pick).
- `src/library/library-json-io.ts:55-77` — `writeJsonFile` (pretty JSON + trailing newline, mutex-protected, `ensureFolderPath` first — the export-write dialect).
- `src/views/snippet-manager-view.ts:533-552` — `handleDeleteSnippet` (ConfirmModal → service → Notice → `await this.refresh()` — the uninstall-handler template).
- `src/views/library-item-detail-modal.ts:23,91` — Promise-based Modal + `safeResolve` double-guard (the export-modal skeleton).
- `src/__tests__/protocol-document-migration.test.ts:1-35` — discriminator + idempotency test shape (the migration test template).
- `src/__tests__/library/library-installer.test.ts:207-291` — recovery sweep two-branch test shape (the orphan-scan + migration test template).

## Developer Context

**Q (Segment API threading, `library-paths.ts:44,53` + `transaction-journal.ts:68` + `installed-record-store.ts:21` + `integrity.ts:30`): The slug+hash segment needs `sha256String` (async), but the 4 derivation functions are synchronous today. How should the segment be threaded?**
A: Precomputed segment — compute once in `planInstall` (already async), thread the precomputed `namespaceSegment` string through the synchronous helpers (signatures change from `(root, packageId, version)` to accept the segment). No function newly becomes async. (Recorded as D1.)

**Q (Migration detection, `library-model.ts:218` + `protocol-document-migration.ts:23`): The one-time migration must detect already-migrated records (idempotent no-op). The codebase has NO version-bump upgrade path today. Which detection mechanism?**
A: Path-shape discriminator — keep `INSTALLED_RECORD_VERSION = 1`, detect by whether the stored `protocolPath` matches the new slug+hash derivation. No schema change. (Recorded as D2.)

**Q (Export target, `library-model.ts:132` + `registry-model.ts:43`): The local builder emits a `ReleaseBundle` structurally identical to `ReleaseResponse`; `isReleaseResponse` accepts a single JSON object. Where does the export modal write the file?**
A: Single JSON in the vault — FolderSuggest + filename + collision preflight + `writeJsonFile`. Round-trips through `isReleaseResponse` → `installer.install()`. (Recorded as D3.)

**Q (DI shape, `library-installer.ts:79-85` + `library-service.ts:68,71`): The preflight split + orphan scan both need to enumerate installed records. `LibraryInstaller` injects only `app`/`settings`/`t`/`journalIO` today. What injection shape?**
A: Lister function — inject `() => Promise<InstalledRecord[]>` into `LibraryInstallerOptions` (read-only; the installer writes markers via `adapter` directly). (Recorded as D4.)

**Design summary confirmed**: "Proceed (Recommended)" — decompose into vertical slices, then generate code slice-by-slice with micro-checkpoints.

**Decomposition confirmed**: "Approve (Recommended)" — 7 slices as listed in the `phases` frontmatter.

## Plan History

- Phase 1: Slug+hash namespace segment + derivation signatures — approved as generated (slice-verifier caught 2 gaps: added installed-record-store.test.ts + library-service.test.ts to the slice, and a legacy slug-only fallback in journalIO.remove; both fixed before approval)
- Phase 2: Preflight collision-vs-dirty-slot split + lister injection — approved as generated (main.ts dropped — the lister is internal to LibraryService; slice-verifier cleared 3 rows OK)
- Phase 3: Recovery destination-folder orphan scan — approved as generated (library-model.ts dropped — RecoveryReport lives in library-installer.ts; added library-service.ts + library-service.test.ts for the orphansCleaned ripple; slice-verifier cleared 3 rows OK)
- Phase 4: One-time slug to slug+hash migration — approved as generated (pure planRecordMigration + journal-based orchestrator; slice-verifier cleared 3 rows OK)
- Phase 5: Local package builder — approved as generated (buildLocalPackage SOURCE bundle + writePackageExport; slice-verifier cleared 3 rows OK after fixing 2 import issues)
- Phase 6: Export modal + command — approved as generated (LibraryExportModal with file-collision disable + FR-7 slug-collision warning; command reuses ProtocolPickerSuggestModal; slice-verifier cleared 3 rows OK after fixing the file-collision disable)
- Phase 7: Uninstall UI — approved as generated (Uninstall button + handleUninstall mirroring handleDeleteSnippet; explicit refresh; slice-verifier cleared 3 rows OK after fixing the AV-line grep count)

## References

- `.rpiv/artifacts/research/2026-08-13_09-42-22_library-production-ready.md` — upstream research artifact (Summary, Code References, Integration Points, Precedents & Lessons, Developer Context, Open Questions).
- `.rpiv/artifacts/discover/2026-08-13_09-07-46_library-production-ready.md` — input FRD (10 decisions, slug+hash recommended approach).
- `.rpiv/artifacts/designs/2026-08-04_17-41-05_moderated-community-library.md` — the cluster's design; D5 collision deferral (lines 411-414) + single misleading preflight literal (lines 1401-1419) are the seams being closed.
- `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` — prior research (deleted-library lifecycle, slugifier precedents, migration patterns).
- `.rpiv/guidance/src/library/architecture.md` — layer guidance (empty default registry URL, ed25519 deferred, journal-first/marker-last installer, pure/Obsidian split).

---

## Phase 1: Slug+hash namespace segment + derivation signatures

### Overview
Depends on nothing (foundation). Introduces the async `packageNamespaceSegment` helper and changes the four derivation sites + `buildReferenceMapping` to accept a precomputed `(pkgSegment, versionSlug)` pair, updating all internal callers (installer, stores, journal IO) in lockstep so the build type-checks.

### Changes Required:

#### 1. src/library/library-paths.ts
**File**: src/library/library-paths.ts
**Changes**: MODIFY — add async `packageNamespaceSegment` helper (slug + shortHash of raw packageId via `sha256String`); change `libraryProtocolNamespace`/`librarySnippetNamespace`/`libraryProtocolFilePath`/`librarySnippetFilePath`/`buildReferenceMapping` signatures from `(root, packageId, version)` to accept a precomputed `pkgSegment` + `versionSlug`. `slugifyPackageId`/`validPackageSlug`/`isLibraryManagedPath`/`assertNoTraversal`/`assertInsideLibraryRoot`/`rewriteSnippetRef`/`findInstalledRecordForPath` UNCHANGED.

```typescript
// ADD import after `import { slugifyLabel } from '../snippets/snippet-model';`:
import { sha256String } from './integrity';

// ADD after `validPackageSlug` (new helper — the collision-resistant segment):
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

// REPLACE `libraryProtocolNamespace`:
/** `${protocolRoot}/library/<pkgSegment>/<versionSlug>`. Callers precompute both. */
export function libraryProtocolNamespace(protocolRoot: string, pkgSegment: string, versionSlug: string): string {
  const seg = `${LIBRARY_SUBROOT}/${pkgSegment}/${versionSlug}`;
  return protocolRoot === '' ? seg : `${protocolRoot}/${seg}`;
}

// REPLACE `librarySnippetNamespace`:
export function librarySnippetNamespace(snippetRoot: string, pkgSegment: string, versionSlug: string): string {
  const seg = `${LIBRARY_SUBROOT}/${pkgSegment}/${versionSlug}`;
  return snippetRoot === '' ? seg : `${snippetRoot}/${seg}`;
}

// REPLACE `libraryProtocolFilePath` (filename moves in lockstep with the segment):
export function libraryProtocolFilePath(protocolRoot: string, pkgSegment: string, versionSlug: string): string {
  return `${libraryProtocolNamespace(protocolRoot, pkgSegment, versionSlug)}/${pkgSegment}.rp.json`;
}

// REPLACE `librarySnippetFilePath`:
export function librarySnippetFilePath(snippetRoot: string, pkgSegment: string, versionSlug: string, relPath: string): string {
  return `${librarySnippetNamespace(snippetRoot, pkgSegment, versionSlug)}/${relPath}`;
}

// REPLACE `buildReferenceMapping` (signature + namespaceRel; loop body unchanged):
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
      if (safe === null) return { error: `library package snippet node has unsafe snippetPath: "${snippetPath}"` };
      mapping.set(safe, `${namespaceRel}/${safe}`);
    } else if (typeof subfolderPath === 'string' && subfolderPath !== '') {
      const safe = assertNoTraversal(subfolderPath);
      if (safe === null) return { error: `library package snippet node has unsafe subfolderPath: "${subfolderPath}"` };
      mapping.set(safe, `${namespaceRel}/${safe}`);
    } else {
      return { error: `library package snippet node "${node.id}" is root-bound (no snippetPath or subfolderPath); root-bound snippet nodes are not supported in library packages` };
    }
  }
  return { mapping };
}
```

#### 2. src/library/installed-record-store.ts
**File**: src/library/installed-record-store.ts
**Changes**: MODIFY — `installedRecordPath(pkgSegment, versionSlug)` (no longer slugifies); `read`/`write`/`delete` compute the segment internally (already async). `list` UNCHANGED (path-agnostic walk). Public API stays `(packageId, version)`.

```typescript
// REPLACE import `import { slugifyPackageId } from './library-paths';`:
import { slugifyPackageId, packageNamespaceSegment } from './library-paths';

// REPLACE `installedRecordPath`:
/** Vault-relative path of the per-release record file (D15). `pkgSegment` is the
 *  precomputed `packageNamespaceSegment(packageId)` (slug + shortHash); `versionSlug`
 *  is `slugifyPackageId(version)`. */
export function installedRecordPath(pkgSegment: string, versionSlug: string): string {
  return `${INSTALLED_DIR}/${pkgSegment}/${versionSlug}.json`;
}

// REPLACE `read` (compute segment internally; readJsonFile + identity check unchanged):
  async read(packageId: string, version: string): Promise<InstalledRecord | null> {
    const pkgSegment = await packageNamespaceSegment(packageId);
    const versionSlug = slugifyPackageId(version);
    const path = installedRecordPath(pkgSegment, versionSlug);
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

// REPLACE `write`:
  async write(record: InstalledRecord): Promise<void> {
    const pkgSegment = await packageNamespaceSegment(record.packageId);
    const versionSlug = slugifyPackageId(record.releaseVersion);
    const path = installedRecordPath(pkgSegment, versionSlug);
    const parentDir = path.slice(0, path.lastIndexOf('/'));
    await writeJsonFile(this.app.vault, this.mutex, path, parentDir, record);
  }

// REPLACE `delete`:
  async delete(packageId: string, version: string): Promise<void> {
    const pkgSegment = await packageNamespaceSegment(packageId);
    const versionSlug = slugifyPackageId(version);
    const path = installedRecordPath(pkgSegment, versionSlug);
    const exists = await this.app.vault.adapter.exists(path);
    if (exists) await this.app.vault.adapter.remove(path);
  }
// `list` UNCHANGED — walks INSTALLED_DIR recursively, path-agnostically.
```

#### 3. src/library/transaction-journal.ts
**File**: src/library/transaction-journal.ts
**Changes**: MODIFY — `transactionJournalPath(pkgSegment, versionSlug)`; `read`/`write`/`remove` compute the segment internally. `remove` adds a legacy slug-only path fallback so a pre-migration interrupt's stale journal is cleaned. `listAll` UNCHANGED.

```typescript
// REPLACE import `import { slugifyPackageId } from './library-paths';`:
import { slugifyPackageId, packageNamespaceSegment } from './library-paths';

// REPLACE `transactionJournalPath`:
export function transactionJournalPath(pkgSegment: string, versionSlug: string): string {
  return `${TRANSACTIONS_DIR}/${pkgSegment}@${versionSlug}.json`;
}

// REPLACE `read`:
  async read(packageId: string, version: string): Promise<TransactionJournal | null> {
    const pkgSegment = await packageNamespaceSegment(packageId);
    const versionSlug = slugifyPackageId(version);
    return readJsonFile(this.app.vault, transactionJournalPath(pkgSegment, versionSlug), isTransactionJournal, 'transaction journal');
  }

// REPLACE `write`:
  async write(journal: TransactionJournal, mutex: WriteMutex): Promise<void> {
    const pkgSegment = await packageNamespaceSegment(journal.packageId);
    const versionSlug = slugifyPackageId(journal.releaseVersion);
    const path = transactionJournalPath(pkgSegment, versionSlug);
    const parentDir = path.slice(0, path.lastIndexOf('/'));
    await writeJsonFile(this.app.vault, mutex, path, parentDir, journal);
  }

// REPLACE `remove` (tries slug+hash first, then the legacy slug-only path so a
// pre-migration interrupt's stale journal is cleaned — not re-processed every load):
  async remove(packageId: string, version: string): Promise<void> {
    const pkgSegment = await packageNamespaceSegment(packageId);
    const versionSlug = slugifyPackageId(version);
    const path = transactionJournalPath(pkgSegment, versionSlug);
    if (await this.app.vault.adapter.exists(path)) { await this.app.vault.adapter.remove(path); return; }
    // Legacy slug-only journal path (pre-migration interrupt). Best-effort cleanup.
    const legacyPath = `${TRANSACTIONS_DIR}/${slugifyPackageId(packageId)}@${versionSlug}.json`;
    if (await this.app.vault.adapter.exists(legacyPath)) await this.app.vault.adapter.remove(legacyPath);
  }
// `listAll` UNCHANGED — walks TRANSACTIONS_DIR recursively, path-agnostically.
```

#### 4. src/library/library-installer.ts
**File**: src/library/library-installer.ts
**Changes**: MODIFY — `planInstall` computes `pkgSegment`+`versionSlug` once and threads through every derivation call; `readMarker`/`uninstall` compute the segment for the marker path; `rollbackTransaction` derives `markerPath`/`protoNs`/`snipNs` from the JOURNAL's own entries (self-consistent for legacy + new journals) via a new `commonNamespacePrefix` helper. Preflight literals unchanged (Phase 2 splits them). `isMarkerCommitted`/`removeOwnedPaths` UNCHANGED.

```typescript
// REPLACE the `./library-paths` import block (add packageNamespaceSegment + slugifyPackageId):
import {
  assertNoTraversal, buildReferenceMapping, libraryProtocolFilePath,
  libraryProtocolNamespace, librarySnippetFilePath, librarySnippetNamespace,
  packageNamespaceSegment, rewriteSnippetRef, slugifyPackageId, validPackageSlug,
} from './library-paths';

// In `planInstall`, AFTER the two `validPackageSlug` checks and BEFORE the `readMarker`
// preflight, ADD (then every derivation call uses pkgSegment/versionSlug):
    // Collision-resistant namespace segment (slug + shortHash of the RAW packageId),
    // computed ONCE and threaded through every synchronous derivation helper (D1).
    const pkgSegment = await packageNamespaceSegment(packageId);
    const versionSlug = slugifyPackageId(version);

// In `planInstall`, REPLACE every derivation call:
//   libraryProtocolFilePath(protocolRoot, packageId, version) -> (protocolRoot, pkgSegment, versionSlug)
//   installedRecordPath(packageId, version) -> (pkgSegment, versionSlug)
//   librarySnippetFilePath(snippetRoot, packageId, version, f.relPath) -> (snippetRoot, pkgSegment, versionSlug, f.relPath)
//   buildReferenceMapping(packageId, version, snippetNodes) -> (pkgSegment, versionSlug, snippetNodes)
//   librarySnippetNamespace(snippetRoot, packageId, version) -> (snippetRoot, pkgSegment, versionSlug)
// The 3 preflight literals stay hard-coded (Phase 2 splits them). The record's
// protocolPath/snippetNamespace are derived from the new helpers (slug+hash). The
// rest of planInstall (1c-1i, rewrite, staged probe, journal entries, record) is
// unchanged except the segment threading.

// REPLACE `readMarker`:
  private async readMarker(packageId: string, version: string): Promise<InstalledRecord | null> {
    const pkgSegment = await packageNamespaceSegment(packageId);
    const versionSlug = slugifyPackageId(version);
    try {
      const raw = await this.app.vault.adapter.read(installedRecordPath(pkgSegment, versionSlug));
      const parsed: unknown = JSON.parse(raw);
      if (isInstalledRecord(parsed) && parsed.packageId === packageId && parsed.releaseVersion === version) return parsed;
      return null;
    } catch {
      return null;
    }
  }
// `isMarkerCommitted` UNCHANGED — takes markerPath from the journal/caller.

// REPLACE `uninstall` (only markerPath derivation changes; protoNs/snipNs still from the RECORD per Step 5 C6):
  async uninstall(packageId: string, version: string): Promise<UninstallResult> {
    return installMutex.runExclusive(INSTALL_LOCK_KEY, async () => {
      const record = await this.readMarker(packageId, version);
      if (record === null) return { status: 'not-installed', packageId, releaseVersion: version };
      const pkgSegment = await packageNamespaceSegment(packageId);
      const versionSlug = slugifyPackageId(version);
      const markerPath = installedRecordPath(pkgSegment, versionSlug);
      const protoNs = parentDirOf(record.protocolPath);
      const snipNs = record.snippetNamespace;
      const paths = [record.protocolPath, markerPath];
      for (const f of record.snippetFiles) paths.push(`${snipNs}/${f.relPath}`);
      let allRemoved = true;
      try {
        allRemoved = await this.removeOwnedPaths(paths, markerPath, protoNs, snipNs);
      } catch (e) {
        return { status: 'failed', packageId, releaseVersion: version, reason: `uninstall failed: ${safeErrorMessage(e)}` };
      }
      if (!allRemoved) return { status: 'failed', packageId, releaseVersion: version, reason: 'uninstall could not remove all owned paths (see console)' };
      return { status: 'ok', packageId, releaseVersion: version };
    });
  }

// REPLACE `rollbackTransaction` (derive namespaces + markerPath from the JOURNAL's
// own entries so the isOwned gate is self-consistent with whatever path scheme the
// journal carries — slug-only legacy OR slug+hash new):
  private async rollbackTransaction(journal: TransactionJournal): Promise<void> {
    const markerEntry = journal.entries.find((e) => e.kind === 'marker');
    const markerPath = markerEntry?.path ?? '';
    const ownedEntries = journal.entries.filter((e) => e.kind === 'owned');
    const protocolEntry = ownedEntries.find((e) => e.path.endsWith('.rp.json'));
    const snippetEntries = ownedEntries.filter((e) => !e.path.endsWith('.rp.json'));
    const protoNs = protocolEntry ? parentDirOf(protocolEntry.path) : '';
    const snipNs = commonNamespacePrefix(snippetEntries.map((e) => e.path));
    const allRemoved = await this.removeOwnedPaths(journal.entries.map((e) => e.path), markerPath, protoNs, snipNs);
    if (!allRemoved) return; // preserve the journal — recovery-on-load will retry
    try { await this.journalIO.remove(journal.packageId, journal.releaseVersion); } catch { /* best-effort */ }
  }

// ADD near `parentDirOf` at the file bottom:
/** Longest '/'-boundary path prefix that contains every path (the common namespace
 *  of a set of journal snippet entries). Returns '' for an empty set or when no
 *  common ancestor exists. A namespace is always a directory, so the seed is the
 *  parent of the first path (not the file path itself). */
function commonNamespacePrefix(paths: string[]): string {
  if (paths.length === 0) return '';
  let prefix = parentDirOf(paths[0]!);
  for (const p of paths) {
    while (prefix !== '' && p !== prefix && !p.startsWith(prefix + '/')) {
      prefix = parentDirOf(prefix);
    }
    if (prefix === '') break;
  }
  return prefix;
}
```

#### 5. src/__tests__/library/library-paths.test.ts
**File**: src/__tests__/library/library-paths.test.ts
**Changes**: MODIFY (complete replacement) — import `packageNamespaceSegment`; NEW `describe('library-paths — packageNamespaceSegment')` (distinct segments for colliding raw ids; hash over raw id; cyrillic; deterministic; path-safe); derivation tests pass synthetic segment `'chest-ct-a1b2'` + versionSlug `'1-0-0'`; `buildReferenceMapping` tests pass `('chest-ct-a1b2', '1-0-0', nodes)`. The `slugifyPackageId`/`validPackageSlug`/`isLibraryManagedPath`/`assertNoTraversal`/`assertInsideLibraryRoot`/`rewriteSnippetRef` blocks UNCHANGED.

```typescript
import { describe, it, expect } from 'vitest';
import {
  slugifyPackageId, validPackageSlug, packageNamespaceSegment,
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

describe('library-paths — packageNamespaceSegment', () => {
  it('produces slug + 12-hex suffix', async () => {
    const seg = await packageNamespaceSegment('Chest CT');
    expect(seg).toMatch(/^chest-ct-[0-9a-f]{12}$/);
  });
  it('hashes the RAW id — colliding-slug ids produce DISTINCT segments', async () => {
    const a = await packageNamespaceSegment('chest.ct');
    const b = await packageNamespaceSegment('chest-ct');
    expect(a).not.toBe(b);
    expect(a.startsWith('chest-ct-')).toBe(true);
    expect(b.startsWith('chest-ct-')).toBe(true);
  });
  it('preserves cyrillic in the slug portion', async () => {
    const seg = await packageNamespaceSegment('Грудная КТ');
    expect(seg).toMatch(/^грудная-кт-[0-9a-f]{12}$/);
  });
  it('is deterministic for the same raw id', async () => {
    expect(await packageNamespaceSegment('chest-ct')).toBe(await packageNamespaceSegment('chest-ct'));
  });
  it('produces a path-safe segment (passes assertNoTraversal)', async () => {
    const seg = await packageNamespaceSegment('Chest CT');
    expect(assertNoTraversal(seg)).toBe(seg);
  });
});

describe('library-paths — namespace derivation', () => {
  it('protocol namespace under root', () => {
    expect(libraryProtocolNamespace('Protocols', 'chest-ct-a1b2', '1-0-0')).toBe('Protocols/library/chest-ct-a1b2/1-0-0');
  });
  it('snippet namespace under root', () => {
    expect(librarySnippetNamespace('Snippets', 'chest-ct-a1b2', '1-0-0')).toBe('Snippets/library/chest-ct-a1b2/1-0-0');
  });
  it('protocol file path ends with <segment>.rp.json', () => {
    expect(libraryProtocolFilePath('Protocols', 'chest-ct-a1b2', '1-0-0')).toBe('Protocols/library/chest-ct-a1b2/1-0-0/chest-ct-a1b2.rp.json');
  });
  it('snippet file path preserves relPath extension', () => {
    expect(librarySnippetFilePath('Snippets', 'chest-ct-a1b2', '1-0-0', 'folder/lung.md')).toBe('Snippets/library/chest-ct-a1b2/1-0-0/folder/lung.md');
  });
  it('empty root produces a root-relative namespace', () => {
    expect(libraryProtocolNamespace('', 'chest-ct-a1b2', '1-0-0')).toBe('library/chest-ct-a1b2/1-0-0');
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
    const r = buildReferenceMapping('chest-ct-a1b2', '1-0-0', nodes);
    expect('mapping' in r).toBe(true);
    if ('mapping' in r) expect(r.mapping.get('folder/lung.md')).toBe('library/chest-ct-a1b2/1-0-0/folder/lung.md');
  });
  it('maps subfolderPath', () => {
    const nodes = [snippetNode('n1', { subfolderPath: 'folder' })];
    const r = buildReferenceMapping('chest-ct-a1b2', '1-0-0', nodes);
    if ('mapping' in r) expect(r.mapping.get('folder')).toBe('library/chest-ct-a1b2/1-0-0/folder');
  });
  it('errors on root-bound node (neither field set)', () => {
    const nodes = [snippetNode('n1', {})];
    const r = buildReferenceMapping('chest-ct-a1b2', '1-0-0', nodes);
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error).toContain('root-bound');
  });
  it('errors on traversal snippetPath', () => {
    const nodes = [snippetNode('n1', { snippetPath: '../escape.md' })];
    const r = buildReferenceMapping('chest-ct-a1b2', '1-0-0', nodes);
    expect('error' in r).toBe(true);
  });
});
```

#### 6. src/__tests__/library/library-installer.test.ts
**File**: src/__tests__/library/library-installer.test.ts
**Changes**: MODIFY (complete replacement) — import `packageNamespaceSegment, slugifyPackageId`; add `pathsFor(packageId, version)` helper returning the slug+hash protocol/snippet/marker/journal paths; `makeBundle` gains optional `packageId`/`version`; every `installedRecordPath`/`transactionJournalPath` call + expected path -> `pathsFor`; NEW FR-1 test (two colliding-slug packages -> distinct destinations, both ok); `seedJournal` uses `pathsFor`; rollback test computes `p` before `makeVault({failWriteFor})`.

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
import { packageNamespaceSegment, slugifyPackageId } from '../../library/library-paths';
import { createEmptyProtocolDocument } from '../../protocol/protocol-document';
import { WriteMutex } from '../../utils/write-mutex';

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

/** Expected vault-relative paths for a (packageId, version), using the slug+hash segment. */
async function pathsFor(packageId: string, version: string) {
  const s = await packageNamespaceSegment(packageId);
  const v = slugifyPackageId(version);
  return {
    segment: s,
    versionSlug: v,
    protocol: `Protocols/library/${s}/${v}/${s}.rp.json`,
    snippet: (relPath: string) => `Snippets/library/${s}/${v}/${relPath}`,
    snippetNs: `Snippets/library/${s}/${v}`,
    marker: installedRecordPath(s, v),
    journal: transactionJournalPath(s, v),
  };
}

async function makeBundle(opts: {
  packageId?: string; version?: string;
  snippetContent?: string; tamperSnippetHash?: boolean; tamperProtocolHash?: boolean;
  snippetRelPath?: string; nodeSnippetPath?: string; undeclaredContent?: string;
} = {}): Promise<ReleaseBundle> {
  const packageId = opts.packageId ?? 'chest-ct';
  const version = opts.version ?? '1.0.0';
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
    packageId, releaseVersion: version,
    protocolDoc,
    protocolSha256: opts.tamperProtocolHash ? '0'.repeat(64) : protocolSha,
    snippetFiles: [{ relPath, sha256: opts.tamperSnippetHash ? '0'.repeat(64) : snippetSha }],
    catalogEntryId: packageId, publishedAt: '2026-01-01T00:00:00Z',
  };
  const snippetContents = [{ relPath, content: snippetContent }];
  if (opts.undeclaredContent) snippetContents.push({ relPath: opts.undeclaredContent, content: 'extra' });
  return { manifest, snippetContents };
}

describe('LibraryInstaller — install', () => {
  it('installs a valid bundle: writes protocol + snippet + marker, removes journal', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    const result = await installer.install(await makeBundle());
    expect(result.status).toBe('ok');
    expect(files[p.protocol]).toBeDefined();
    expect(files[p.snippet('lung.md')]).toBe('# Lung content\n');
    const marker = JSON.parse(files[p.marker]!);
    expect(marker.schema).toBe(INSTALLED_RECORD_SCHEMA);
    expect(marker.packageId).toBe('chest-ct');
    expect(marker.releaseVersion).toBe('1.0.0');
    expect(marker.protocolPath).toBe(p.protocol);
    expect(files[p.journal]).toBeUndefined();
  });

  it('installs two colliding-slug packages to DISTINCT destinations (FR-1)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const r1 = await installer.install(await makeBundle({ packageId: 'chest.ct' }));
    const r2 = await installer.install(await makeBundle({ packageId: 'chest-ct' }));
    expect(r1.status).toBe('ok');
    expect(r2.status).toBe('ok');
    const p1 = await pathsFor('chest.ct', '1.0.0');
    const p2 = await pathsFor('chest-ct', '1.0.0');
    expect(p1.segment).not.toBe(p2.segment);
    expect(p1.segment.startsWith('chest-ct-')).toBe(true);
    expect(p2.segment.startsWith('chest-ct-')).toBe(true);
    expect(files[p1.protocol]).toBeDefined();
    expect(files[p2.protocol]).toBeDefined();
    expect(files[p1.marker]).toBeDefined();
    expect(files[p2.marker]).toBeDefined();
  });

  it('fails on snippet integrity mismatch (no final paths written, no marker)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    const result = await installer.install(await makeBundle({ tamperSnippetHash: true }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('integrity');
    expect(files[p.snippet('lung.md')]).toBeUndefined();
    expect(files[p.marker]).toBeUndefined();
  });

  it('fails on protocol integrity mismatch', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ tamperProtocolHash: true }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('protocol document');
  });

  it('fails on non-.md snippet relPath', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ snippetRelPath: 'lung.txt' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('.md');
  });

  it('fails on traversal snippet relPath', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ snippetRelPath: '../escape.md' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('unsafe');
  });

  it('fails on undeclared snippet content', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ undeclaredContent: 'extra.md' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('not declared');
  });

  it('fails staged graph validation when a snippet node references a file not in the manifest (D-04 probe)', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ nodeSnippetPath: 'other.md' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('invalid');
  });

  it('fails if already installed (marker present)', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    expect((await installer.install(await makeBundle())).status).toBe('ok');
    const result = await installer.install(await makeBundle());
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('already installed');
  });

  it('rolls back on commit failure: removes staged owned paths, no marker, journal removed', async () => {
    const p = await pathsFor('chest-ct', '1.0.0');
    const { vault, files } = makeVault({ failWriteFor: (path) => path === p.protocol });
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle());
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('commit failed');
    expect(files[p.snippet('lung.md')]).toBeUndefined();
    expect(files[p.marker]).toBeUndefined();
    expect(files[p.journal]).toBeUndefined();
  });
});

describe('LibraryInstaller — uninstall', () => {
  it('uninstalls an installed package: removes protocol + snippet + marker', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    expect((await installer.install(await makeBundle())).status).toBe('ok');
    const p = await pathsFor('chest-ct', '1.0.0');
    expect(files[p.marker]).toBeDefined();
    const result = await installer.uninstall('chest-ct', '1.0.0');
    expect(result.status).toBe('ok');
    expect(files[p.protocol]).toBeUndefined();
    expect(files[p.snippet('lung.md')]).toBeUndefined();
    expect(files[p.marker]).toBeUndefined();
  });

  it('returns not-installed when no valid marker exists', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.uninstall('chest-ct', '1.0.0');
    expect(result.status).toBe('not-installed');
  });
});

describe('LibraryInstaller — recoverInterrupted', () => {
  async function seedJournal(vault: unknown, markerPresent: boolean, stagedSnippet: boolean) {
    const p = await pathsFor('chest-ct', '1.0.0');
    const journalIO = new TransactionJournalIO({ vault } as never);
    const journal: TransactionJournal = {
      schema: TRANSACTIONS_SCHEMA, version: TRANSACTIONS_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', startedAt: '2026-01-01T00:00:00Z',
      entries: [
        { path: p.snippet('lung.md'), kind: 'owned' },
        { path: p.protocol, kind: 'owned' },
        { path: p.marker, kind: 'marker' },
      ],
    };
    await journalIO.write(journal, new WriteMutex());
    const files = vault as { adapter: { write: (path: string, data: string) => Promise<void> } };
    if (stagedSnippet) await files.adapter.write(p.snippet('lung.md'), '# Lung content\n');
    if (markerPresent) {
      const marker = {
        schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
        packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
        protocolPath: p.protocol,
        snippetNamespace: p.snippetNs,
        snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }],
        protocolSha256: 'a'.repeat(64),
      };
      await files.adapter.write(p.marker, JSON.stringify(marker, null, 2) + '\n');
    }
  }

  it('finalizes a committed install: marker present -> remove journal only', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    await seedJournal(vault, true, true);
    const p = await pathsFor('chest-ct', '1.0.0');
    const report = await installer.recoverInterrupted();
    expect(report.committed).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.rolledBack).toEqual([]);
    expect(files[p.snippet('lung.md')]).toBeDefined();
    expect(files[p.marker]).toBeDefined();
    expect(files[p.journal]).toBeUndefined();
  });

  it('rolls back an incomplete install: marker absent -> remove owned paths + journal', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    await seedJournal(vault, false, true);
    const p = await pathsFor('chest-ct', '1.0.0');
    const report = await installer.recoverInterrupted();
    expect(report.rolledBack).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.committed).toEqual([]);
    expect(files[p.snippet('lung.md')]).toBeUndefined();
    expect(files[p.journal]).toBeUndefined();
  });

  it('rolls back when the marker exists but its identity mismatches the journal slot (D15)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    const journalIO = new TransactionJournalIO(makeApp(vault) as never);
    const journal: TransactionJournal = {
      schema: TRANSACTIONS_SCHEMA, version: TRANSACTIONS_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', startedAt: '2026-01-01T00:00:00Z',
      entries: [
        { path: p.snippet('lung.md'), kind: 'owned' },
        { path: p.marker, kind: 'marker' },
      ],
    };
    await journalIO.write(journal, new WriteMutex());
    const mismatchedMarker = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'brain-mri', releaseVersion: '2.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/brain-mri/2-0-0/brain-mri.rp.json',
      snippetNamespace: 'Snippets/library/brain-mri/2-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    files[p.marker] = JSON.stringify(mismatchedMarker, null, 2) + '\n';
    files[p.snippet('lung.md')] = '# Lung content\n';
    const report = await installer.recoverInterrupted();
    expect(report.rolledBack).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.committed).toEqual([]);
    expect(files[p.snippet('lung.md')]).toBeUndefined();
    expect(files[p.journal]).toBeUndefined();
  });

  it('returns an empty report when no transactions are in flight', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const report = await installer.recoverInterrupted();
    expect(report).toEqual({ committed: [], rolledBack: [] });
  });
});
```

#### 7. src/__tests__/library/installed-record-store.test.ts
**File**: src/__tests__/library/installed-record-store.test.ts
**Changes**: MODIFY (complete replacement) — import `packageNamespaceSegment, slugifyPackageId`; `validRecord` becomes async (computes the segment, feeds `libraryProtocolFilePath`/`librarySnippetNamespace`); add `recPath(packageId, version)` helper; every `installedRecordPath(...)` call -> `await recPath(...)` so fixtures seed at the slug+hash path `store.read` looks up.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { InstalledRecordStore, installedRecordPath } from '../../library/installed-record-store';
import { INSTALLED_RECORD_SCHEMA, INSTALLED_RECORD_VERSION, type InstalledRecord } from '../../library/library-model';
import { libraryProtocolFilePath, librarySnippetNamespace, packageNamespaceSegment, slugifyPackageId } from '../../library/library-paths';

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
    createFolder: vi.fn(async (_p: string) => { /* no-op in-memory */ }),
  };
  return { vault, files };
}
const makeApp = (vault: ReturnType<typeof makeVault>['vault']) => ({ vault } as unknown);

/** Real per-release record path for (packageId, version), using the slug+hash segment. */
async function recPath(packageId: string, version: string): Promise<string> {
  return installedRecordPath(await packageNamespaceSegment(packageId), slugifyPackageId(version));
}

async function validRecord(packageId: string, version: string): Promise<InstalledRecord> {
  const pkgSegment = await packageNamespaceSegment(packageId);
  const versionSlug = slugifyPackageId(version);
  return {
    schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
    packageId, releaseVersion: version, installedAt: '2026-01-01T00:00:00Z',
    protocolPath: libraryProtocolFilePath('Protocols', pkgSegment, versionSlug),
    snippetNamespace: librarySnippetNamespace('Snippets', pkgSegment, versionSlug),
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
    const rec = await validRecord('chest-ct', '1.0.0');
    await store.write(rec);
    expect(await store.read('chest-ct', '1.0.0')).toEqual(rec);
  });
  it('throws LibraryStoreError(malformed) on invalid JSON', async () => {
    const path = await recPath('chest-ct', '1.0.0');
    const { vault } = makeVault({ files: { [path]: 'nope' } });
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await expect(store.read('chest-ct', '1.0.0')).rejects.toMatchObject({ name: 'LibraryStoreError', kind: 'malformed' });
  });
  it('throws LibraryStoreError(malformed) on wrong schema', async () => {
    const path = await recPath('chest-ct', '1.0.0');
    const { vault } = makeVault({ files: { [path]: JSON.stringify({ schema: 'other', version: 1, packageId: 'x', releaseVersion: '1', installedAt: 't', protocolPath: 'a', snippetNamespace: 'b', snippetFiles: [], protocolSha256: 'h' }) } });
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await expect(store.read('chest-ct', '1.0.0')).rejects.toMatchObject({ name: 'LibraryStoreError', kind: 'malformed' });
  });
  it('throws LibraryStoreError(malformed) when record identity mismatches the path (D15 marker identity)', async () => {
    const path = await recPath('chest-ct', '1.0.0');
    const mismatched = { ...(await validRecord('brain-mri', '2.0.0')) };
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
    await store.write(await validRecord('chest-ct', '1.0.0'));
    await store.write(await validRecord('brain-mri', '2.0.0'));
    const records = await store.list();
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.packageId).sort()).toEqual(['brain-mri', 'chest-ct']);
  });
  it('skips a corrupted single record (D15 per-file isolation, no throw)', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await store.write(await validRecord('chest-ct', '1.0.0'));
    await vault.adapter.write(await recPath('brain-mri', '2.0.0'), 'not-json');
    const records = await store.list();
    expect(records).toHaveLength(1);
    expect(records[0]!.packageId).toBe('chest-ct');
  });
});

describe('InstalledRecordStore — write', () => {
  it('writes pretty JSON with a trailing newline at the per-release path', async () => {
    const { vault, files } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await store.write(await validRecord('chest-ct', '1.0.0'));
    const path = await recPath('chest-ct', '1.0.0');
    const written = files[path]!;
    expect(written).toMatch(/\n$/);
    expect(written).toContain('  "schema"');
    expect(written).toContain('"radiprotocol.installed-record"');
  });
});

describe('InstalledRecordStore — delete', () => {
  it('removes the per-release record file', async () => {
    const { vault, files } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await store.write(await validRecord('chest-ct', '1.0.0'));
    await store.delete('chest-ct', '1.0.0');
    expect(files[await recPath('chest-ct', '1.0.0')]).toBeUndefined();
  });
  it('is a no-op when the file is missing', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await expect(store.delete('chest-ct', '1.0.0')).resolves.toBeUndefined();
  });
});
```

#### 8. src/__tests__/library/library-service.test.ts
**File**: src/__tests__/library/library-service.test.ts
**Changes**: MODIFY (scoped) — import `packageNamespaceSegment, slugifyPackageId`; add `recPath` helper; the `listInstalled` + `getInstalledRecord` seeding keys `[installedRecordPath('chest-ct', '1.0.0')]` -> `[await recPath('chest-ct', '1.0.0')]` (computed before `makeService`). All catalog/install/uninstall tests + `makeService`/`makeVault`/`entry` UNCHANGED.

```typescript
// ADD to imports:
import { packageNamespaceSegment, slugifyPackageId } from '../../library/library-paths';

// ADD helper near the top (after makeApp):
async function recPath(packageId: string, version: string): Promise<string> {
  return installedRecordPath(await packageNamespaceSegment(packageId), slugifyPackageId(version));
}

// REPLACE the `listInstalled` test's seeding (compute rp before makeService):
  it('delegates listInstalled to recordStore.list and returns seeded records', async () => {
    const record = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json',
      snippetNamespace: 'Snippets/library/chest-ct/1-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    const rp = await recPath('chest-ct', '1.0.0');
    const files: Record<string, string> = { [rp]: JSON.stringify(record, null, 2) + '\n' };
    const { service, recordStore } = makeService({ files });
    const spy = vi.spyOn(recordStore, 'list');
    const r = await service.listInstalled();
    expect(r).toHaveLength(1);
    expect(r[0]!.packageId).toBe('chest-ct');
    expect(spy).toHaveBeenCalled();
  });

// REPLACE the `getInstalledRecord` test's seeding (compute rp before makeService):
  it('getInstalledRecord delegates to recordStore.read (seeded -> record, missing -> null)', async () => {
    const record = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json',
      snippetNamespace: 'Snippets/library/chest-ct/1-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    const rp = await recPath('chest-ct', '1.0.0');
    const files: Record<string, string> = { [rp]: JSON.stringify(record, null, 2) + '\n' };
    const { service } = makeService({ files });
    expect((await service.getInstalledRecord('chest-ct', '1.0.0'))?.packageId).toBe('chest-ct');
    expect(await service.getInstalledRecord('chest-ct', '9.9.9')).toBe(null);
  });
// All other tests (listCatalog, install, uninstall, recoverInterruptedInstalls, listInstalled-throw-safe)
// are UNCHANGED — they either use vi.fn() stubs or list() (path-agnostic).
```

### Success Criteria:

#### Automated Verification:
- [ ] `npx vitest run src/__tests__/library/library-paths.test.ts` exits 0 — `packageNamespaceSegment` (distinct segments for colliding raw ids; hash over raw id; path-safe; deterministic) + derivation signatures take `(pkgSegment, versionSlug)`.
- [ ] `npx vitest run src/__tests__/library/library-installer.test.ts` exits 0 — slug+hash destinations; FR-1 two-colliding-ids coexist at distinct paths; uninstall + recovery use the segment; rollback is self-consistent with the journal's own paths.
- [ ] `npx vitest run src/__tests__/library/installed-record-store.test.ts` exits 0 — read/write/delete/list use the slug+hash path; malformed + identity-mismatch tests seed at the real path.
- [ ] `npx vitest run src/__tests__/library/library-service.test.ts` exits 0 — getInstalledRecord finds the seeded record at the slug+hash path.
- [ ] `grep -n "export async function packageNamespaceSegment" src/library/library-paths.ts` returns a match (the helper is exported).
- [ ] `git diff --exit-code HEAD -- src/snippets/snippet-model.ts` exits 0 (slugifyLabel body unchanged — the slug+hash fix is localized to library-paths.ts; NFR).

#### Manual Verification:
- [ ] Two packages whose ids slugify identically (e.g. 'chest.ct' + 'chest-ct') install to distinct visible folders under `Protocols/library/` and `Snippets/library/` and coexist (both appear in the installed list).
- [ ] An installed package's destination folder name includes the 12-hex hash suffix (e.g. `chest-ct-a1b2c3d4e5f6`), visible in the file explorer under the configured protocol/snippet roots.

---

## Phase 2: Preflight collision-vs-dirty-slot split + lister injection

### Overview
Depends on Phase 1. Injects a `() => Promise<InstalledRecord[]>` lister into `LibraryInstallerOptions`, splits the three "destination occupied" preflight checks into collision (names both packageIds via `findInstalledRecordForPath` + `t('library.collisionError', …)`) vs dirty-slot (`t('library.dirtySlotError', …)`), and wires the lister in `LibraryService` (the lister is internal to the service — `main.ts` is unchanged). New i18n keys in BOTH en/ru.

### Changes Required:

#### 1. src/library/library-installer.ts
**File**: src/library/library-installer.ts
**Changes**: MODIFY — add `listInstalled?: () => Promise<InstalledRecord[]>` to `LibraryInstallerOptions`; in `planInstall`'s preflight, replace the 3 hard-coded "destination occupied" literals with collision-vs-dirty-slot detection (enumerate installed records, match each occupied path via `findInstalledRecordForPath`, name both packageIds on collision).

```typescript
// ADD `findInstalledRecordForPath` to the `./library-paths` import block (Phase 1 added packageNamespaceSegment + slugifyPackageId):
import {
  assertNoTraversal, buildReferenceMapping, findInstalledRecordForPath,
  libraryProtocolFilePath, libraryProtocolNamespace, librarySnippetFilePath,
  librarySnippetNamespace, packageNamespaceSegment, rewriteSnippetRef,
  slugifyPackageId, validPackageSlug,
} from './library-paths';

// ADD to `LibraryInstallerOptions`:
  /** Injectable lister for collision detection in the install preflight (D4).
   *  Read-only — the installer never writes to the record store. Undefined in
   *  pure-test sites → collision detection degrades to dirty-slot messaging. */
  listInstalled?: () => Promise<InstalledRecord[]>;

// ADD a private field + constructor assignment (after `this.journalIO = ...`):
  private readonly listInstalled?: () => Promise<InstalledRecord[]>;
// ...
    this.listInstalled = options.listInstalled;

// REPLACE the 1b preflight block in `planInstall` (the `readMarker !== null` "already installed" check stays; the 3 hard-coded literals become the unified loop). `pkgSegment`/`versionSlug` are already computed (Phase 1):
    if (await this.readMarker(packageId, version) !== null) {
      return { error: `package ${packageId}@${version} is already installed` };
    }
    const records = this.listInstalled ? await this.listInstalled() : [];
    const occupiedDestPaths = [
      libraryProtocolFilePath(protocolRoot, pkgSegment, versionSlug),
      installedRecordPath(pkgSegment, versionSlug),
      ...manifest.snippetFiles.map((f) => librarySnippetFilePath(snippetRoot, pkgSegment, versionSlug, f.relPath)),
    ];
    for (const destPath of occupiedDestPaths) {
      if (!(await this.app.vault.adapter.exists(destPath))) continue;
      const c = await this.classifyOccupiedPath(destPath, packageId, records);
      if (c.collision) {
        return { error: this.t('library.collisionError', { incoming: packageId, existing: c.existing }) };
      }
      return { error: this.t('library.dirtySlotError', { packageId, version, path: destPath }) };
    }

// ADD the `classifyOccupiedPath` private helper (after `readMarker`):
  /** Classify an occupied destination path as a collision (a different package
   *  owns it) or a dirty slot (leftover files, no owner). `findInstalledRecordForPath`
   *  matches protocol/snippet paths against installed records; the marker path is
   *  not matched by it, so a raw read detects a foreign marker at the slot. */
  private async classifyOccupiedPath(
    path: string, incomingPackageId: string, records: InstalledRecord[],
  ): Promise<{ collision: true; existing: string } | { collision: false }> {
    const owner = findInstalledRecordForPath(records, path);
    if (owner !== null && owner.packageId !== incomingPackageId) {
      return { collision: true, existing: owner.packageId };
    }
    if (owner === null) {
      try {
        const raw = await this.app.vault.adapter.read(path);
        const parsed: unknown = JSON.parse(raw);
        if (isInstalledRecord(parsed) && parsed.packageId !== incomingPackageId) {
          return { collision: true, existing: parsed.packageId };
        }
      } catch { /* not a valid record — dirty slot */ }
    }
    return { collision: false };
  }
```

#### 2. src/library/library-service.ts
**File**: src/library/library-service.ts
**Changes**: MODIFY — reorder the constructor (recordStore before installer) + pass `listInstalled: () => this.recordStore.list()` to the installer default. `main.ts` unchanged (the lister is internal to the service; `rebuildLibraryServices` constructs `new LibraryService(...)` the same way).

```typescript
// REPLACE the constructor's installer/cacheStore/recordStore wiring block:
    this.t = options.t ?? defaultT;
    this.cacheStore = options.cacheStore ?? new LibraryCacheStore(app);
    this.recordStore = options.recordStore ?? new InstalledRecordStore(app);
    this.installer = options.installer ?? new LibraryInstaller(app, settings, {
      t: this.t,
      listInstalled: () => this.recordStore.list(),
    });
// The closure accesses this.recordStore lazily (called during an install, long after
// construction); assigning recordStore first is cleaner. options.recordStore (test
// injection) still works — the closure reads this.recordStore whichever it is.
```

#### 3. src/i18n/locales/en.json
**File**: src/i18n/locales/en.json
**Changes**: MODIFY — add `library.collisionError` + `library.dirtySlotError` keys (with `{incoming}`/`{existing}`/`{packageId}`/`{version}`/`{path}` params) to the `library` namespace, after `readOnlyNotice`.

```json
    "collisionError": "Destination collision: package '{incoming}' collides with already-installed package '{existing}' at the same location.",
    "dirtySlotError": "Incomplete install of {packageId}@{version} — run recovery first: {path}"
```
(Added before the `library` namespace's closing `}` — i.e. after the `readOnlyNotice` line, with a trailing comma added to the `readOnlyNotice` line.)

#### 4. src/i18n/locales/ru.json
**File**: src/i18n/locales/ru.json
**Changes**: MODIFY — add the same `library.collisionError` + `library.dirtySlotError` keys (Russian text) to the `library` namespace, after `readOnlyNotice`.

```json
    "collisionError": "Конфликт назначения: пакет «{incoming}» конфликтует с уже установленным пакетом «{existing}» в том же расположении.",
    "dirtySlotError": "Незавершённая установка {packageId}@{version} — сначала выполните восстановление: {path}"
```
(Added before the `library` namespace's closing `}` — i.e. after the `readOnlyNotice` line, with a trailing comma added to the `readOnlyNotice` line.)

#### 5. src/__tests__/library/library-installer.test.ts
**File**: src/__tests__/library/library-installer.test.ts
**Changes**: MODIFY (incremental — Phase 1 rewrote this file completely; Phase 2 ADDS a describe block + 1 import). Add `type InstalledRecord` to the library-model import; add a new `preflight collision/dirty-slot split` describe block at the end.

```typescript
// ADD `type InstalledRecord` to the library-model import:
import {
  PACKAGE_MANIFEST_SCHEMA, PACKAGE_MANIFEST_VERSION,
  INSTALLED_RECORD_SCHEMA, INSTALLED_RECORD_VERSION,
  type ReleaseBundle, type PackageManifest, type InstalledRecord,
} from '../../library/library-model';

// ADD a new describe block at the end of the file (Phase 1 already defines makeVault/makeApp/pathsFor/makeBundle/SETTINGS + the imports):
describe('LibraryInstaller — preflight collision/dirty-slot split', () => {
  it('detects a collision via a foreign marker at the slot and names both packageIds', async () => {
    const { vault, files } = makeVault();
    const p = await pathsFor('chest-ct', '1.0.0');
    const foreignMarker = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'brain-mri', releaseVersion: '2.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/brain-mri/2-0-0/brain-mri.rp.json',
      snippetNamespace: 'Snippets/library/brain-mri/2-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    files[p.marker] = JSON.stringify(foreignMarker, null, 2) + '\n';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ packageId: 'chest-ct' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toContain('collision');
      expect(result.reason).toContain('brain-mri');
    }
  });

  it('detects a dirty slot (leftover files, no marker) and reports dirtySlotError', async () => {
    const { vault, files } = makeVault();
    const p = await pathsFor('chest-ct', '1.0.0');
    files[p.protocol] = 'partial-leftover';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ packageId: 'chest-ct' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toContain('recovery');
      expect(result.reason).toContain('chest-ct');
    }
  });

  it('detects a collision via a foreign record owning the protocol path (with a lister)', async () => {
    const { vault, files } = makeVault();
    const p = await pathsFor('chest-ct', '1.0.0');
    files[p.protocol] = 'foreign-protocol';
    const foreignRecord: InstalledRecord = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'brain-mri', releaseVersion: '2.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: p.protocol,
      snippetNamespace: 'Snippets/library/brain-mri/2-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS, {
      listInstalled: async () => [foreignRecord],
    });
    const result = await installer.install(await makeBundle({ packageId: 'chest-ct' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toContain('collision');
      expect(result.reason).toContain('brain-mri');
    }
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `npx vitest run src/__tests__/library/library-installer.test.ts` exits 0 — the new `preflight collision/dirty-slot split` describe block passes (foreign-marker collision, dirty slot, foreign-record collision via lister) + all Phase 1 tests still pass.
- [ ] `grep -n "library.collisionError" src/i18n/locales/en.json src/i18n/locales/ru.json` returns a match in BOTH files (en/ru parity).
- [ ] `grep -n "library.dirtySlotError" src/i18n/locales/en.json src/i18n/locales/ru.json` returns a match in BOTH files (en/ru parity).
- [ ] `grep -n "listInstalled" src/library/library-installer.ts` returns >= 3 matches (the option field, the constructor assignment, the preflight usage).

#### Manual Verification:
- [ ] Installing a package whose destination has leftover files (no marker) shows "Incomplete install of X@Y — run recovery first: <path>" (not the old misleading "destination occupied (prior incomplete install)").
- [ ] `node scripts/check-consistency.mjs` Check 7 passes (en/ru key-set parity — the 2 new keys are in both locales).

---

## Phase 3: Recovery destination-folder orphan scan

### Overview
Depends on Phase 2 (uses the lister injection). Adds a second phase to `recoverInterrupted`: BFS-scan `${protocolRoot}/library/` + `${snippetRoot}/library/` for namespace folders, match discovered files against installed records via `findInstalledRecordForPath`, delete orphans via `removeOwnedPaths` guarded by a marker-file-exists check (skip if any `.json` exists at the installed slot built from the discovered folder's slugs). Adds `orphansCleaned` to `RecoveryReport`.

### Changes Required:

#### 1. src/library/library-installer.ts
**File**: src/library/library-installer.ts
**Changes**: MODIFY — add `orphansCleaned` to the `RecoveryReport` interface (defined HERE, not library-model.ts); add the destination-folder scan phase to `recoverInterrupted` (after the journal loop); add `findOrphanedNamespaces`/`cleanOrphanedNamespace`/`listChildrenFolders`/`listFilesRecursive` helpers; import `LIBRARY_SUBROOT`. The Phase 1 journal loop is preserved.

```typescript
// ADD `LIBRARY_SUBROOT` to the `./library-paths` import (Phase 2 added findInstalledRecordForPath):
import {
  LIBRARY_SUBROOT, assertNoTraversal, buildReferenceMapping, findInstalledRecordForPath,
  libraryProtocolFilePath, libraryProtocolNamespace, librarySnippetFilePath,
  librarySnippetNamespace, packageNamespaceSegment, rewriteSnippetRef,
  slugifyPackageId, validPackageSlug,
} from './library-paths';

// REPLACE the `RecoveryReport` interface (add the REQUIRED orphansCleaned field):
/** Result of recovery-on-load. */
export interface RecoveryReport {
  committed: Array<{ packageId: string; releaseVersion: string }>;
  rolledBack: Array<{ packageId: string; releaseVersion: string }>;
  /** Namespace folders cleaned by the FR-4 destination-folder orphan scan
   *  (journal-less interrupt leftovers with no valid marker). */
  orphansCleaned: Array<{ namespace: string }>;
}

// REPLACE `recoverInterrupted` (add the scan phase after the journal loop + orphansCleaned in BOTH returns):
  async recoverInterrupted(): Promise<RecoveryReport> {
    return installMutex.runExclusive(INSTALL_LOCK_KEY, async () => {
      let journals: TransactionJournal[];
      try {
        journals = await this.journalIO.listAll();
      } catch {
        return { committed: [], rolledBack: [], orphansCleaned: [] };
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
      // Second phase (FR-4): scan destination folders for journal-less orphans.
      const orphansCleaned: RecoveryReport['orphansCleaned'] = [];
      try {
        const records = this.listInstalled ? await this.listInstalled() : [];
        const orphanNamespaces = await this.findOrphanedNamespaces(records);
        for (const ns of orphanNamespaces) {
          if (await this.cleanOrphanedNamespace(ns)) orphansCleaned.push({ namespace: ns });
        }
      } catch {
        // best-effort — a scan failure must not abort recovery (committed/rolledBack stand)
      }
      return { committed, rolledBack, orphansCleaned };
    });
  }

// ADD the scan helpers (private, after rollbackTransaction/removeOwnedPaths):
  /** Discover namespace folders under ${root}/library/ that are NOT owned by any
   *  valid installed record (FR-4). A namespace folder is <root>/library/<pkgSegment>/<versionSlug>. */
  private async findOrphanedNamespaces(records: InstalledRecord[]): Promise<string[]> {
    const orphans: string[] = [];
    for (const root of [this.settings.protocolFolderPath, this.settings.snippetFolderPath]) {
      if (root === '') continue;
      const libraryFolder = `${root}/${LIBRARY_SUBROOT}`;
      if (!(await this.app.vault.adapter.exists(libraryFolder))) continue;
      const pkgFolders = await this.listChildrenFolders(libraryFolder);
      for (const pkgFolder of pkgFolders) {
        const versionFolders = await this.listChildrenFolders(pkgFolder);
        for (const versionFolder of versionFolders) {
          const files = await this.listFilesRecursive(versionFolder);
          if (files.length === 0) continue;
          const owned = files.some((f) => findInstalledRecordForPath(records, f) !== null);
          if (!owned) orphans.push(versionFolder);
        }
      }
    }
    return orphans;
  }

  /** Delete an orphaned namespace folder's files, guarded by the marker-file-exists
   *  safety check (D6). Returns true if cleaned, false if skipped (marker present). */
  private async cleanOrphanedNamespace(namespace: string): Promise<boolean> {
    const parts = namespace.split('/');
    const versionSlug = parts[parts.length - 1]!;
    const pkgSegment = parts[parts.length - 2]!;
    // D6 safety: skip if the marker .json is present at the installed slot — a
    // present-but-corrupt marker means a valid package might own this namespace.
    const markerSlot = installedRecordPath(pkgSegment, versionSlug);
    try {
      if (await this.app.vault.adapter.exists(markerSlot)) return false;
    } catch { return false; }
    const files = await this.listFilesRecursive(namespace);
    await this.removeOwnedPaths(files, '', namespace, namespace);
    return true;
  }

  private async listChildrenFolders(dir: string): Promise<string[]> {
    try { return (await this.app.vault.adapter.list(dir)).folders; }
    catch { return []; }
  }

  private async listFilesRecursive(dir: string): Promise<string[]> {
    const out: string[] = [];
    const queue: string[] = [dir];
    while (queue.length > 0) {
      const current = queue.shift()!;
      let listing: { files: string[]; folders: string[] };
      try { listing = await this.app.vault.adapter.list(current); }
      catch { continue; }
      out.push(...listing.files);
      queue.push(...listing.folders);
    }
    return out;
  }
```

#### 2. src/library/library-service.ts
**File**: src/library/library-service.ts
**Changes**: MODIFY — `recoverInterruptedInstalls` catch returns `orphansCleaned: []` (RecoveryReport now requires the field).

```typescript
// REPLACE the `recoverInterruptedInstalls` catch return:
  async recoverInterruptedInstalls(): Promise<RecoveryReport> {
    try {
      return await this.installer.recoverInterrupted();
    } catch {
      return { committed: [], rolledBack: [], orphansCleaned: [] };
    }
  }
```

#### 3. src/__tests__/library/library-installer.test.ts
**File**: src/__tests__/library/library-installer.test.ts
**Changes**: MODIFY (incremental) — update the Phase 1 empty-report test to assert `orphansCleaned: []`; ADD a new `recoverInterrupted orphan scan` describe block (3 tests). Uses Phase 1's `pathsFor` + Phase 2's `type InstalledRecord` import.

```typescript
// REPLACE the empty-report test (Phase 1 asserted { committed: [], rolledBack: [] }):
  it('returns an empty report when no transactions are in flight', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const report = await installer.recoverInterrupted();
    expect(report).toEqual({ committed: [], rolledBack: [], orphansCleaned: [] });
  });

// ADD a new describe block at the end:
describe('LibraryInstaller — recoverInterrupted orphan scan', () => {
  it('cleans a journal-less orphan namespace (no marker, no record)', async () => {
    const { vault, files } = makeVault();
    const p = await pathsFor('orphan-pkg', '1.0.0');
    files[p.protocol] = 'orphan-protocol';
    files[p.snippet('lung.md')] = 'orphan-snippet';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const report = await installer.recoverInterrupted();
    const protoNs = p.protocol.slice(0, p.protocol.lastIndexOf('/'));
    expect(report.orphansCleaned.map((o) => o.namespace).sort()).toEqual([protoNs, p.snippetNs].sort());
    expect(files[p.protocol]).toBeUndefined();
    expect(files[p.snippet('lung.md')]).toBeUndefined();
  });

  it('does NOT clean a namespace whose marker .json is present (D6 safety)', async () => {
    const { vault, files } = makeVault();
    const p = await pathsFor('chest-ct', '1.0.0');
    files[p.protocol] = 'orphan-protocol';
    files[p.marker] = 'corrupt-not-json';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const report = await installer.recoverInterrupted();
    expect(report.orphansCleaned).toEqual([]);
    expect(files[p.protocol]).toBeDefined();
  });

  it('does NOT clean a namespace owned by a valid installed record', async () => {
    const { vault, files } = makeVault();
    const p = await pathsFor('chest-ct', '1.0.0');
    files[p.protocol] = 'real-protocol';
    files[p.snippet('lung.md')] = 'real-snippet';
    const record: InstalledRecord = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: p.protocol, snippetNamespace: p.snippetNs,
      snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }], protocolSha256: 'a'.repeat(64),
    };
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS, {
      listInstalled: async () => [record],
    });
    const report = await installer.recoverInterrupted();
    expect(report.orphansCleaned).toEqual([]);
    expect(files[p.protocol]).toBeDefined();
  });
});
```

#### 4. src/__tests__/library/library-service.test.ts
**File**: src/__tests__/library/library-service.test.ts
**Changes**: MODIFY (incremental) — the `recovery` option default + the `recoverInterruptedInstalls` test stub must include `orphansCleaned: []` (RecoveryReport now requires it).

```typescript
// In makeService, REPLACE the recoverInterrupted stub default:
    recoverInterrupted: vi.fn(async (): Promise<RecoveryReport> => opts.recovery ?? { committed: [], rolledBack: [], orphansCleaned: [] }),

// In the recoverInterruptedInstalls test, REPLACE the recovery stub:
    const { service, installer } = makeService({ recovery: { committed: [{ packageId: 'a', releaseVersion: '1' }], rolledBack: [], orphansCleaned: [] } });
```

### Success Criteria:

#### Automated Verification:
- [ ] `npx vitest run src/__tests__/library/library-installer.test.ts` exits 0 — the new `recoverInterrupted orphan scan` describe block passes (orphan cleaned, corrupt-marker skipped, owned-namespace skipped) + the empty-report test asserts `orphansCleaned: []` + all Phase 1/2 tests still pass.
- [ ] `npx vitest run src/__tests__/library/library-service.test.ts` exits 0 — the `recoverInterruptedInstalls` test passes with the `orphansCleaned: []` stub.
- [ ] `grep -n "orphansCleaned" src/library/library-installer.ts` returns >= 4 matches (the interface field, the catch return, the local array, the final return).
- [ ] `grep -n "findOrphanedNamespaces\|cleanOrphanedNamespace" src/library/library-installer.ts` returns matches (the scan helpers exist).

#### Manual Verification:
- [ ] After an interrupted install that left destination files but NO journal and NO marker, reloading the plugin cleans the orphaned namespace folder and `orphansCleaned` lists it.
- [ ] A namespace whose marker `.json` is present (even corrupt) is NOT deleted on reload (D6 safety).

---

## Phase 4: One-time slug to slug+hash migration

### Overview
Depends on Phases 1 + 2 (segment helper + path helpers + lister). Can run in parallel with Phase 3. Adds a pure `library-migration.ts` (detect legacy by path-shape discriminator, compute new paths, rewrite record fields + embedded snippet refs via `rewriteSnippetRef`) + a `LibraryInstaller.migrateInstalledRecords` orchestrator (under `installMutex`, per-record try/catch continue, marker rewrite LAST). `recoverInterruptedInstalls` runs it after `recoverInterrupted`.

### Changes Required:

#### 1. src/library/library-migration.ts
**File**: src/library/library-migration.ts
**Changes**: NEW — pure per-record migration: `planRecordMigration(record, protocolDoc, pkgSegment, versionSlug, protocolRoot, snippetRoot)` returns `{ changed: false }` (D2 path-shape discriminator → skip if already migrated) or `{ changed: true, plan }` (rewrites `protocolPath`/`snippetNamespace` + the embedded `snippetPath`/`subfolderPath` refs via `rewriteSnippetRef` + an old→new namespace prefix mapping; lossless spread). Modeled on `migrateProtocolDocument`. Zero Obsidian imports.

```typescript
// src/library/library-migration.ts
// Pure one-time slug-only → slug+hash path migration for installed records (D2/D5).
// Zero Obsidian imports (NFR-01). Modeled on migrateProtocolDocument
// (src/protocol/protocol-document-migration.ts): discriminator-first, idempotent,
// lossless via layered spreads. The Obsidian-touching orchestrator lives on
// LibraryInstaller (src/library/library-installer.ts); this module only plans.

import type { InstalledRecord } from './library-model';
import type { ProtocolDocumentV1 } from '../protocol/protocol-document';
import {
  LIBRARY_SUBROOT, libraryProtocolFilePath, librarySnippetNamespace,
  rewriteSnippetRef, slugifyPackageId,
} from './library-paths';
import { installedRecordPath } from './installed-record-store';

/** A planned old→new move for one installed record. */
export interface MigrationPlan {
  record: InstalledRecord;
  rewrittenDoc: ProtocolDocumentV1;
  oldProtocolPath: string;
  newProtocolPath: string;
  oldSnippetNamespace: string;
  newSnippetNamespace: string;
  oldMarkerPath: string;
  newMarkerPath: string;
  snippetMoves: Array<{ relPath: string; oldPath: string; newPath: string }>;
}

/** Plan a single record's slug-only → slug+hash migration. Pure + idempotent:
 *  a record whose `protocolPath` already matches the new-scheme derivation (D2 —
 *  path-shape discriminator) returns `{ changed: false }`. Lossless — the returned
 *  record spreads the input so author/installedAt/snippetFiles/packageId/
 *  releaseVersion are preserved; only protocolPath + snippetNamespace change.
 *  `pkgSegment` is the precomputed `packageNamespaceSegment(record.packageId)`
 *  (slug + shortHash of the RAW id); `versionSlug` is `slugifyPackageId(record.releaseVersion)`. */
export function planRecordMigration(
  record: InstalledRecord,
  protocolDoc: ProtocolDocumentV1,
  pkgSegment: string,
  versionSlug: string,
  protocolRoot: string,
  snippetRoot: string,
): { changed: false } | { changed: true; plan: MigrationPlan } | { changed: false; error: string } {
  const newProtocolPath = libraryProtocolFilePath(protocolRoot, pkgSegment, versionSlug);
  if (record.protocolPath === newProtocolPath) return { changed: false }; // D2 discriminator

  const newSnippetNamespace = librarySnippetNamespace(snippetRoot, pkgSegment, versionSlug);
  const oldSnippetNamespace = record.snippetNamespace;
  // The installed doc's snippetPath/subfolderPath are namespace-RELATIVE
  // (library/<slug>/<versionSlug>/<relPath> — set at install time via rewriteSnippetRef).
  const oldNsRel = `${LIBRARY_SUBROOT}/${slugifyPackageId(record.packageId)}/${versionSlug}`;
  const newNsRel = `${LIBRARY_SUBROOT}/${pkgSegment}/${versionSlug}`;
  const mapping = new Map<string, string>([[oldNsRel, newNsRel]]);

  const rewrittenDoc: ProtocolDocumentV1 = JSON.parse(JSON.stringify(protocolDoc));
  for (const node of rewrittenDoc.nodes) {
    if (node.kind !== 'snippet') continue;
    const sp = node.fields['snippetPath'];
    const sfp = node.fields['subfolderPath'];
    if (typeof sp === 'string' && sp !== '') {
      const rewritten = rewriteSnippetRef(sp, mapping);
      // C6: fail (not silently skip) when a ref doesn't match the legacy namespace —
      // otherwise the ref dangles after removeOwnedPaths deletes the old namespace.
      if (rewritten === null) return { changed: false, error: `snippet node "${node.id}" has a snippetPath ("${sp}") not under the legacy namespace — cannot migrate` };
      node.fields['snippetPath'] = rewritten;
    } else if (typeof sfp === 'string' && sfp !== '') {
      const rewritten = rewriteSnippetRef(sfp, mapping);
      if (rewritten === null) return { changed: false, error: `snippet node "${node.id}" has a subfolderPath ("${sfp}") not under the legacy namespace — cannot migrate` };
      node.fields['subfolderPath'] = rewritten;
    }
  }

  const snippetMoves = record.snippetFiles.map((f) => ({
    relPath: f.relPath,
    oldPath: `${oldSnippetNamespace}/${f.relPath}`,
    newPath: `${newSnippetNamespace}/${f.relPath}`,
  }));

  return {
    changed: true,
    plan: {
      record: { ...record, protocolPath: newProtocolPath, snippetNamespace: newSnippetNamespace },
      rewrittenDoc,
      oldProtocolPath: record.protocolPath, newProtocolPath,
      oldSnippetNamespace, newSnippetNamespace,
      oldMarkerPath: installedRecordPath(slugifyPackageId(record.packageId), versionSlug),
      newMarkerPath: installedRecordPath(pkgSegment, versionSlug),
      snippetMoves,
    },
  };
}
```

#### 2. src/library/library-installer.ts
**File**: src/library/library-installer.ts
**Changes**: MODIFY — add `MigrationReport` type + `migrateInstalledRecords(): Promise<MigrationReport>` (under `installMutex`; enumerate via the injected lister; per-record: read legacy doc → `planRecordMigration` → migration journal FIRST → write new snippets + new protocol → new marker LAST → remove old → remove journal; per-record try/catch continue; idempotent). Import `planRecordMigration`.

```typescript
// ADD import:
import { planRecordMigration } from './library-migration';
// EXTEND the existing `from '../protocol/protocol-document'` import to a MIXED import (C7 — isProtocolDocumentV1 is a runtime value, ProtocolDocumentV1 is a type):
//   import { isProtocolDocumentV1, type ProtocolDocumentV1 } from '../protocol/protocol-document';

// ADD the MigrationReport type (near RecoveryReport):
/** Result of the one-time slug→slug+hash migration (FR-2). Never throws. */
export interface MigrationReport {
  migrated: Array<{ packageId: string; releaseVersion: string }>;
  skipped: Array<{ packageId: string; releaseVersion: string }>;
  failed: Array<{ packageId: string; releaseVersion: string; reason: string }>;
}

// ADD the method (after recoverInterrupted):
  /** One-time slug-only → slug+hash migration of installed records (FR-2). Runs
   *  under the global installMutex (D7), per-record try/catch continue, marker
   *  rewrite LAST. Uses the existing transaction journal for interrupt atomicity:
   *  an interrupted migration leaves a journal at the new slot — recoverInterrupted
   *  (next load) rolls back the partial new files before this re-runs. Idempotent
   *  (D2 — path-shape discriminator skips already-migrated records). Never throws. */
  async migrateInstalledRecords(): Promise<MigrationReport> {
    return installMutex.runExclusive(INSTALL_LOCK_KEY, async () => {
      if (!this.listInstalled) return { migrated: [], skipped: [], failed: [] };
      let records: InstalledRecord[];
      try { records = await this.listInstalled(); }
      catch { return { migrated: [], skipped: [], failed: [] }; }
      const migrated: MigrationReport['migrated'] = [];
      const skipped: MigrationReport['skipped'] = [];
      const failed: MigrationReport['failed'] = [];
      for (const record of records) {
        try {
          const pkgSegment = await packageNamespaceSegment(record.packageId);
          const versionSlug = slugifyPackageId(record.releaseVersion);
          let raw: string;
          try { raw = await this.app.vault.adapter.read(record.protocolPath); }
          catch { skipped.push({ packageId: record.packageId, releaseVersion: record.releaseVersion }); continue; }
          const protocolDoc: unknown = JSON.parse(raw);
          if (!isProtocolDocumentV1(protocolDoc)) { failed.push({ packageId: record.packageId, releaseVersion: record.releaseVersion, reason: 'protocol file is not a valid ProtocolDocumentV1' }); continue; }
          const result = planRecordMigration(record, protocolDoc, pkgSegment, versionSlug, this.settings.protocolFolderPath, this.settings.snippetFolderPath);
          if ('error' in result) { failed.push({ packageId: record.packageId, releaseVersion: record.releaseVersion, reason: result.error }); continue; }
          if (!result.changed) { skipped.push({ packageId: record.packageId, releaseVersion: record.releaseVersion }); continue; }
          const plan = result.plan;
          // Migration journal (new paths, marker LAST) — for interrupt recovery.
          const entries: JournalEntry[] = [
            ...plan.snippetMoves.map((m) => ({ path: m.newPath, kind: 'owned' as const })),
            { path: plan.newProtocolPath, kind: 'owned' as const },
            { path: plan.newMarkerPath, kind: 'marker' as const },
          ];
          await this.journalIO.write({
            schema: TRANSACTIONS_SCHEMA, version: TRANSACTIONS_VERSION,
            packageId: record.packageId, releaseVersion: record.releaseVersion,
            startedAt: new Date().toISOString(), entries,
          }, installMutex);
          for (const move of plan.snippetMoves) {
            const content = await this.app.vault.adapter.read(move.oldPath);
            await ensureFolderPath(this.app.vault, parentDirOf(move.newPath));
            await this.app.vault.adapter.write(move.newPath, content);
          }
          await writeJsonFile(this.app.vault, installMutex, plan.newProtocolPath, parentDirOf(plan.newProtocolPath), plan.rewrittenDoc);
          // C5: recompute the record's protocolSha256 to match the MIGRATED on-disk doc
          // (the rewrite changed the snippet refs → the old installed hash no longer matches).
          plan.record.protocolSha256 = await sha256String(JSON.stringify(plan.rewrittenDoc, null, 2) + '\n');
          // New marker LAST (commit signal).
          await writeJsonFile(this.app.vault, installMutex, plan.newMarkerPath, parentDirOf(plan.newMarkerPath), plan.record);
          // Remove old files (legacy protocol + snippets + marker).
          await this.removeOwnedPaths(
            [plan.oldProtocolPath, ...plan.snippetMoves.map((m) => m.oldPath), plan.oldMarkerPath],
            plan.oldMarkerPath, parentDirOf(plan.oldProtocolPath), plan.oldSnippetNamespace,
          );
          try { await this.journalIO.remove(record.packageId, record.releaseVersion); } catch { /* best-effort */ }
          migrated.push({ packageId: record.packageId, releaseVersion: record.releaseVersion });
        } catch (e) {
          failed.push({ packageId: record.packageId, releaseVersion: record.releaseVersion, reason: safeErrorMessage(e) });
        }
      }
      return { migrated, skipped, failed };
    });
  }
```

#### 3. src/library/library-service.ts
**File**: src/library/library-service.ts
**Changes**: MODIFY — `recoverInterruptedInstalls` runs `recoverInterrupted` THEN `migrateInstalledRecords` (logs a warning on failure; preserves the Phase 3 `orphansCleaned: []` catch). Never throws.

```typescript
// REPLACE recoverInterruptedInstalls:
  async recoverInterruptedInstalls(): Promise<RecoveryReport> {
    try {
      const report = await this.installer.recoverInterrupted();
      // One-time slug→slug+hash migration AFTER recovery (in-flight legacy journals
      // are committed/rolled back first), still under the installMutex. Idempotent;
      // a failure is logged but does not surface as a recovery failure.
      try {
        const migration = await this.installer.migrateInstalledRecords();
        if (migration.failed.length > 0) {
          console.warn('[RadiProtocol] library migration completed with failures', migration.failed);
        }
      } catch (e) {
        console.warn('[RadiProtocol] library migration failed — will retry on next load', e);
      }
      return report;
    } catch {
      return { committed: [], rolledBack: [], orphansCleaned: [] };
    }
  }
```

#### 4. src/__tests__/library/library-migration.test.ts
**File**: src/__tests__/library/library-migration.test.ts
**Changes**: NEW — pure migration tests: discriminator (already-migrated → `changed: false`), idempotency, lossless (preserves author/installedAt/snippetFiles), rewrites protocolPath/snippetNamespace + embedded snippet refs, computes old/new marker paths + snippet moves.

```typescript
import { describe, it, expect } from 'vitest';
import { planRecordMigration } from '../../library/library-migration';
import type { InstalledRecord } from '../../library/library-model';
import type { ProtocolDocumentV1 } from '../../protocol/protocol-document';
import { PROTOCOL_SCHEMA, PROTOCOL_VERSION } from '../../protocol/protocol-document';
import { packageNamespaceSegment, slugifyPackageId, libraryProtocolFilePath, librarySnippetNamespace } from '../../library/library-paths';
import { installedRecordPath } from '../../library/installed-record-store';

const NOW = '2026-01-01T00:00:00Z';

function legacyRecord(packageId: string, version: string, protocolRoot: string, snippetRoot: string): InstalledRecord {
  const slug = slugifyPackageId(packageId);
  const vSlug = slugifyPackageId(version);
  return {
    schema: 'radiprotocol.installed-record' as never, version: 1 as never,
    packageId, releaseVersion: version, installedAt: NOW,
    protocolPath: `${protocolRoot}/library/${slug}/${vSlug}/${slug}.rp.json`,
    snippetNamespace: `${snippetRoot}/library/${slug}/${vSlug}`,
    snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }], protocolSha256: 'a'.repeat(64),
    author: { displayName: 'Dr Test' },
  };
}

function docWithSnippetNode(slug: string, vSlug: string): ProtocolDocumentV1 {
  return {
    schema: PROTOCOL_SCHEMA, version: PROTOCOL_VERSION, id: 'id-1', title: 'Chest CT',
    createdAt: NOW, updatedAt: NOW, layoutDirection: 'LR',
    nodes: [
      { id: 'start', kind: 'start', x: 0, y: 0, width: 200, height: 80, fields: {} },
      { id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: `library/${slug}/${vSlug}/lung.md` } },
    ],
    edges: [{ id: 'e1', fromNodeId: 'start', toNodeId: 'snip-1' }],
  };
}

describe('library-migration — planRecordMigration', () => {
  it('returns changed:false for an already-migrated record (D2 discriminator)', async () => {
    const pkgSegment = await packageNamespaceSegment('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const record = { ...legacyRecord('chest-ct', '1.0.0', 'Protocols', 'Snippets'), protocolPath: libraryProtocolFilePath('Protocols', pkgSegment, vSlug) };
    const doc = docWithSnippetNode(pkgSegment, vSlug);
    expect(planRecordMigration(record, doc, pkgSegment, vSlug, 'Protocols', 'Snippets')).toEqual({ changed: false });
  });

  it('rewrites record.protocolPath + snippetNamespace to slug+hash paths', async () => {
    const pkgSegment = await packageNamespaceSegment('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const record = legacyRecord('chest-ct', '1.0.0', 'Protocols', 'Snippets');
    const doc = docWithSnippetNode(slugifyPackageId('chest-ct'), vSlug);
    const r = planRecordMigration(record, doc, pkgSegment, vSlug, 'Protocols', 'Snippets');
    expect(r.changed).toBe(true);
    if (!r.changed) return;
    expect(r.plan.record.protocolPath).toBe(libraryProtocolFilePath('Protocols', pkgSegment, vSlug));
    expect(r.plan.record.snippetNamespace).toBe(librarySnippetNamespace('Snippets', pkgSegment, vSlug));
  });

  it('is lossless — preserves author/installedAt/snippetFiles/packageId', async () => {
    const pkgSegment = await packageNamespaceSegment('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const record = legacyRecord('chest-ct', '1.0.0', 'Protocols', 'Snippets');
    const doc = docWithSnippetNode(slugifyPackageId('chest-ct'), vSlug);
    const r = planRecordMigration(record, doc, pkgSegment, vSlug, 'Protocols', 'Snippets');
    if (!r.changed) return;
    expect(r.plan.record.author).toEqual({ displayName: 'Dr Test' });
    expect(r.plan.record.installedAt).toBe(NOW);
    expect(r.plan.record.snippetFiles).toEqual(record.snippetFiles);
    expect(r.plan.record.packageId).toBe('chest-ct');
    expect(r.plan.record.releaseVersion).toBe('1.0.0');
  });

  it('rewrites the embedded snippetPath ref to the new namespace', async () => {
    const pkgSegment = await packageNamespaceSegment('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const slug = slugifyPackageId('chest-ct');
    const record = legacyRecord('chest-ct', '1.0.0', 'Protocols', 'Snippets');
    const doc = docWithSnippetNode(slug, vSlug);
    const r = planRecordMigration(record, doc, pkgSegment, vSlug, 'Protocols', 'Snippets');
    if (!r.changed) return;
    const snipNode = r.plan.rewrittenDoc.nodes.find((n) => n.id === 'snip-1')!;
    expect(snipNode.fields['snippetPath']).toBe(`library/${pkgSegment}/${vSlug}/lung.md`);
  });

  it('computes old/new marker paths + snippet moves', async () => {
    const pkgSegment = await packageNamespaceSegment('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const slug = slugifyPackageId('chest-ct');
    const record = legacyRecord('chest-ct', '1.0.0', 'Protocols', 'Snippets');
    const doc = docWithSnippetNode(slug, vSlug);
    const r = planRecordMigration(record, doc, pkgSegment, vSlug, 'Protocols', 'Snippets');
    if (!r.changed) return;
    expect(r.plan.oldMarkerPath).toBe(installedRecordPath(slug, vSlug));
    expect(r.plan.newMarkerPath).toBe(installedRecordPath(pkgSegment, vSlug));
    expect(r.plan.snippetMoves).toEqual([{ relPath: 'lung.md', oldPath: `Snippets/library/${slug}/${vSlug}/lung.md`, newPath: `Snippets/library/${pkgSegment}/${vSlug}/lung.md` }]);
  });

  it('is idempotent — migrating the migrated record+doc returns changed:false', async () => {
    const pkgSegment = await packageNamespaceSegment('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const slug = slugifyPackageId('chest-ct');
    const record = legacyRecord('chest-ct', '1.0.0', 'Protocols', 'Snippets');
    const doc = docWithSnippetNode(slug, vSlug);
    const first = planRecordMigration(record, doc, pkgSegment, vSlug, 'Protocols', 'Snippets');
    if (!first.changed) return;
    const second = planRecordMigration(first.plan.record, first.plan.rewrittenDoc, pkgSegment, vSlug, 'Protocols', 'Snippets');
    expect(second.changed).toBe(false);
  });
});
```

#### 5. src/__tests__/library/library-installer.test.ts
**File**: src/__tests__/library/library-installer.test.ts
**Changes**: MODIFY (incremental) — ADD a new `migrateInstalledRecords` describe block (3 tests: legacy→slug+hash with embedded refs rewritten + old removed; idempotent re-run skips; uninstall-after-migration removes new files). Uses Phase 1's `makeVault`/`makeApp`/`pathsFor`/`SETTINGS`/`createEmptyProtocolDocument`/`INSTALLED_RECORD_SCHEMA/VERSION`/`packageNamespaceSegment`/`slugifyPackageId`/`installedRecordPath`.

```typescript
// ADD a new describe block at the end of the file:
describe('LibraryInstaller — migrateInstalledRecords', () => {
  it('migrates a legacy slug-only record to slug+hash paths + rewrites embedded refs', async () => {
    const { vault, files } = makeVault();
    const slug = slugifyPackageId('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const legacyProtoPath = `Protocols/library/${slug}/${vSlug}/${slug}.rp.json`;
    const legacySnipNs = `Snippets/library/${slug}/${vSlug}`;
    const legacyMarker = installedRecordPath(slug, vSlug);
    const doc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = doc.nodes[0]!.id;
    doc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: `library/${slug}/${vSlug}/lung.md` } });
    doc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    files[legacyProtoPath] = JSON.stringify(doc, null, 2) + '\n';
    files[`${legacySnipNs}/lung.md`] = '# Lung content\n';
    const legacyRecord = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: legacyProtoPath, snippetNamespace: legacySnipNs,
      snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }], protocolSha256: 'a'.repeat(64),
    };
    files[legacyMarker] = JSON.stringify(legacyRecord, null, 2) + '\n';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS, { listInstalled: async () => [legacyRecord] });
    const report = await installer.migrateInstalledRecords();
    expect(report.migrated).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    const p = await pathsFor('chest-ct', '1.0.0');
    expect(files[p.protocol]).toBeDefined();
    expect(files[p.snippet('lung.md')]).toBe('# Lung content\n');
    expect(files[p.marker]).toBeDefined();
    expect(files[legacyProtoPath]).toBeUndefined();
    expect(files[`${legacySnipNs}/lung.md`]).toBeUndefined();
    expect(files[legacyMarker]).toBeUndefined();
    const migratedDoc = JSON.parse(files[p.protocol]!);
    expect(migratedDoc.nodes.find((n: { id: string }) => n.id === 'snip-1').fields.snippetPath).toBe(`library/${p.segment}/${vSlug}/lung.md`);
    const migratedRecord = JSON.parse(files[p.marker]!);
    expect(migratedRecord.protocolPath).toBe(p.protocol);
    expect(migratedRecord.snippetNamespace).toBe(p.snippetNs);
  });

  it('is idempotent — re-running on a migrated vault skips with no changes', async () => {
    const { vault, files } = makeVault();
    const slug = slugifyPackageId('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const legacyProtoPath = `Protocols/library/${slug}/${vSlug}/${slug}.rp.json`;
    const legacySnipNs = `Snippets/library/${slug}/${vSlug}`;
    const legacyMarker = installedRecordPath(slug, vSlug);
    const doc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = doc.nodes[0]!.id;
    doc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: `library/${slug}/${vSlug}/lung.md` } });
    doc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    files[legacyProtoPath] = JSON.stringify(doc, null, 2) + '\n';
    files[`${legacySnipNs}/lung.md`] = '# Lung content\n';
    const legacyRecord = { schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION, packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z', protocolPath: legacyProtoPath, snippetNamespace: legacySnipNs, snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }], protocolSha256: 'a'.repeat(64) };
    files[legacyMarker] = JSON.stringify(legacyRecord, null, 2) + '\n';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS, { listInstalled: async () => [JSON.parse(files[legacyMarker]!)] });
    await installer.migrateInstalledRecords();
    const p = await pathsFor('chest-ct', '1.0.0');
    const installer2 = new LibraryInstaller(makeApp(vault) as never, SETTINGS, { listInstalled: async () => [JSON.parse(files[p.marker]!)] });
    const report2 = await installer2.migrateInstalledRecords();
    expect(report2.migrated).toEqual([]);
    expect(report2.skipped).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
  });

  it('uninstall after migration removes the new-namespace files', async () => {
    const { vault, files } = makeVault();
    const slug = slugifyPackageId('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const legacyProtoPath = `Protocols/library/${slug}/${vSlug}/${slug}.rp.json`;
    const legacySnipNs = `Snippets/library/${slug}/${vSlug}`;
    const legacyMarker = installedRecordPath(slug, vSlug);
    const doc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = doc.nodes[0]!.id;
    doc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: `library/${slug}/${vSlug}/lung.md` } });
    doc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    files[legacyProtoPath] = JSON.stringify(doc, null, 2) + '\n';
    files[`${legacySnipNs}/lung.md`] = '# Lung content\n';
    const legacyRecord = { schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION, packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z', protocolPath: legacyProtoPath, snippetNamespace: legacySnipNs, snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }], protocolSha256: 'a'.repeat(64) };
    files[legacyMarker] = JSON.stringify(legacyRecord, null, 2) + '\n';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS, { listInstalled: async () => [legacyRecord] });
    await installer.migrateInstalledRecords();
    const p = await pathsFor('chest-ct', '1.0.0');
    const result = await installer.uninstall('chest-ct', '1.0.0');
    expect(result.status).toBe('ok');
    expect(files[p.protocol]).toBeUndefined();
    expect(files[p.snippet('lung.md')]).toBeUndefined();
    expect(files[p.marker]).toBeUndefined();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `npx vitest run src/__tests__/library/library-migration.test.ts` exits 0 — discriminator (changed:false), idempotency, lossless, record/doc rewriting, marker/snippet-move computation.
- [ ] `npx vitest run src/__tests__/library/library-installer.test.ts` exits 0 — the new `migrateInstalledRecords` describe block passes (legacy → slug+hash, embedded refs rewritten, old removed, idempotent re-run, uninstall-after-migration) + all Phase 1/2/3 tests still pass.
- [ ] `grep -n "export function planRecordMigration" src/library/library-migration.ts` returns a match (the pure migration fn exists).
- [ ] `grep -n "migrateInstalledRecords" src/library/library-installer.ts` returns >= 2 matches (the method + the type).
- [ ] `grep -n "INSTALLED_RECORD_VERSION = 1" src/library/library-model.ts` returns a match (D2 — no version bump; the migration rewrites values, not the schema).
- [ ] `git diff --exit-code HEAD -- src/library/library-model.ts` exits 0 (isPackageManifest/isInstalledRecord sentinels unchanged — no wire-shape change).

#### Manual Verification:
- [ ] A vault with a pre-upgrade (slug-only) installed package, on first load after the upgrade, has the package migrated to slug+hash paths (visible in the file explorer) with the marker + protocol + snippet files at the new namespace; the old slug-only files are gone.
- [ ] Reloading again is a no-op (the migration skips the already-migrated record); the package still uninstalls cleanly.

---

## Phase 5: Local package builder

### Overview
Depends on Phase 1 (loosely — uses `slugifyPackageId`/`assertNoTraversal`; can run in parallel with Phases 2-4). Adds `LibraryService.buildLocalPackage(protocolPath, { packageId, releaseVersion, author })` — assembles a SOURCE `ReleaseBundle` from the protocol doc + referenced snippets, computes source SHA-256 hashes, FR-7 authoring-time collision warning — and `writePackageExport(bundle, destPath)` — writes a single JSON via `writeJsonFile`.

### Changes Required:

#### 1. src/library/library-service.ts
**File**: src/library/library-service.ts
**Changes**: MODIFY — add `buildLocalPackage(protocolPath, meta): Promise<BuildResult>` (read + parse the source protocol; extract snippet nodes; collect snippet files (snippetPath file-bound, subfolderPath directory-bound) via `assertNoTraversal` + vault reads; compute SOURCE hashes; FR-7 slug collision warning via `listInstalled`; assemble `ReleaseBundle` with SOURCE doc + SOURCE contents) + `writePackageExport(bundle, destPath): Promise<void>` (single JSON via `writeJsonFile`). `BuildResult` is `{ status: 'ok'; bundle; collisionWith? } | { status: 'failed'; reason }`. Store `this.settings`; add `exportMutex`. Never throws.

```typescript
// NEW standalone imports (these modules are NOT yet imported at HEAD):
import { ProtocolDocumentParser } from '../protocol/protocol-document-parser';
import { isProtocolDocumentV1, type ProtocolDocumentV1 } from '../protocol/protocol-document';
import { sha256String } from './integrity';
import { assertNoTraversal, slugifyPackageId, validPackageSlug } from './library-paths';
import { WriteMutex } from '../utils/write-mutex';
import { isReleaseResponse } from './registry-model';
// EXTEND the existing `from './library-json-io'` import to ALSO include: writeJsonFile (safeErrorMessage is already imported there).
// EXTEND the existing `from './library-model'` import — IMPORTANT: the HEAD import is `import type { ... }` but
// PACKAGE_MANIFEST_SCHEMA/VERSION are runtime `export const` VALUES, so CONVERT to a MIXED import:
//   import { PACKAGE_MANIFEST_SCHEMA, PACKAGE_MANIFEST_VERSION, type CatalogEntry, type CatalogFetchResult, type InstalledRecord, type PackageManifest, type PackageSnippetFile, type ReleaseBundle } from './library-model';

// ADD fields + store settings in the constructor:
  private readonly settings: LibraryServiceSettings;
  private readonly exportMutex = new WriteMutex();
// At the TOP of the constructor body (before the Phase 2 recordStore-before-installer reorder):
    this.settings = settings;

// ADD the types (near the other exported types):
/** Metadata for building a local package (FR-5). */
export interface PackageBuildMeta {
  packageId: string;
  releaseVersion: string;
  author?: { displayName: string };
}
/** Result of building a local package. Never throws. `collisionWith` (FR-7) is set when a
 *  package with the same slug is already installed (DATA, not an i18n string — the modal i18n's it). */
export type BuildResult =
  | { status: 'ok'; bundle: ReleaseBundle; collisionWith?: string }
  | { status: 'failed'; reason: string };

// ADD the methods (after getReleaseManifest):
  /** Build a local package (FR-5): assemble a SOURCE (un-rewritten) ReleaseBundle from a
   *  protocol doc + its referenced snippets, with source SHA-256 hashes. Never throws. */
  async buildLocalPackage(protocolPath: string, meta: PackageBuildMeta): Promise<BuildResult> {
    try {
      if (validPackageSlug(meta.packageId) === null) return { status: 'failed', reason: `invalid package id "${meta.packageId}": slugifies to empty` };
      if (validPackageSlug(meta.releaseVersion) === null) return { status: 'failed', reason: `invalid release version "${meta.releaseVersion}": slugifies to empty` };
      const snippetRoot = this.settings.snippetFolderPath;
      let raw: string;
      try { raw = await this.app.vault.adapter.read(protocolPath); }
      catch { return { status: 'failed', reason: `could not read protocol file: ${protocolPath}` }; }
      let doc: unknown;
      try { doc = JSON.parse(raw); }
      catch { return { status: 'failed', reason: 'protocol file is not valid JSON' }; }
      if (!isProtocolDocumentV1(doc)) return { status: 'failed', reason: 'protocol file is not a valid ProtocolDocumentV1' };
      const parser = new ProtocolDocumentParser(this.t);
      const parsed = parser.parse(raw, protocolPath);
      if (!parsed.success) return { status: 'failed', reason: `protocol document failed to parse: ${parsed.error}` };
      const snippetNodes = [...parsed.graph.nodes.values()].filter((n) => n.kind === 'snippet');
      const seenRel = new Set<string>();
      const snippetFiles: PackageSnippetFile[] = [];
      const snippetContents: Array<{ relPath: string; content: string }> = [];
      const rootPrefix = snippetRoot === '' ? '' : snippetRoot + '/';
      for (const node of snippetNodes) {
        const sp = node.radiprotocol_snippetPath;
        const sfp = node.subfolderPath;
        if (typeof sp === 'string' && sp !== '') {
          if (!sp.endsWith('.md')) return { status: 'failed', reason: `snippet file "${sp}" is not .md` };
          if (assertNoTraversal(sp) === null) return { status: 'failed', reason: `snippet file "${sp}" has an unsafe path` };
          if (!seenRel.has(sp)) {
            let content: string;
            try { content = await this.app.vault.adapter.read(`${rootPrefix}${sp}`); }
            catch { return { status: 'failed', reason: `snippet file not found: ${sp}` }; }
            seenRel.add(sp);
            snippetFiles.push({ relPath: sp, sha256: await sha256String(content) });
            snippetContents.push({ relPath: sp, content });
          }
        } else if (typeof sfp === 'string' && sfp !== '') {
          if (assertNoTraversal(sfp) === null) return { status: 'failed', reason: `subfolder path "${sfp}" is unsafe` };
          let files: string[];
          try { files = await this.listFilesRecursive(`${rootPrefix}${sfp}`); }
          catch { return { status: 'failed', reason: `subfolder not found: ${sfp}` }; }
          const mdFiles = files.filter((f) => f.endsWith('.md'));
          if (mdFiles.length === 0) return { status: 'failed', reason: `snippet node "${node.id}" references subfolder "${sfp}" but it has no .md files` };
          for (const f of mdFiles) {
            const relPath = snippetRoot === '' ? f : f.slice(`${snippetRoot}/`.length);
            if (seenRel.has(relPath)) continue;
            let content: string;
            try { content = await this.app.vault.adapter.read(f); }
            catch { return { status: 'failed', reason: `snippet file not found: ${relPath}` }; }
            seenRel.add(relPath);
            snippetFiles.push({ relPath, sha256: await sha256String(content) });
            snippetContents.push({ relPath, content });
          }
        } else {
          return { status: 'failed', reason: `snippet node "${node.id}" is root-bound (no snippetPath or subfolderPath)` };
        }
      }
      const protocolSha256 = await sha256String(JSON.stringify(doc, null, 2) + '\n');
      const manifest: PackageManifest = {
        schema: PACKAGE_MANIFEST_SCHEMA, version: PACKAGE_MANIFEST_VERSION,
        packageId: meta.packageId, releaseVersion: meta.releaseVersion,
        protocolDoc: doc as ProtocolDocumentV1, protocolSha256, snippetFiles,
        catalogEntryId: meta.packageId, publishedAt: new Date().toISOString(), author: meta.author,
      };
      let collisionWith: string | undefined;
      try {
        const records = await this.listInstalled();
        const builderSlug = slugifyPackageId(meta.packageId);
        const colliding = records.find((r) => slugifyPackageId(r.packageId) === builderSlug && r.packageId !== meta.packageId);
        if (colliding) collisionWith = colliding.packageId;
      } catch { /* best-effort */ }
      return { status: 'ok', bundle: { manifest, snippetContents }, collisionWith };
    } catch (e) {
      return { status: 'failed', reason: safeErrorMessage(e) };
    }
  }

  /** Write a package bundle as a single JSON file (FR-6/D3) — round-trips through `isReleaseResponse`. */
  async writePackageExport(bundle: ReleaseBundle, destPath: string): Promise<void> {
    const parentDir = destPath.slice(0, destPath.lastIndexOf('/'));
    await writeJsonFile(this.app.vault, this.exportMutex, destPath, parentDir, bundle);
  }

  private async listFilesRecursive(dir: string): Promise<string[]> {
    const out: string[] = [];
    const queue: string[] = [dir];
    while (queue.length > 0) {
      const current = queue.shift()!;
      let listing: { files: string[]; folders: string[] };
      try { listing = await this.app.vault.adapter.list(current); }
      catch { continue; }
      out.push(...listing.files);
      queue.push(...listing.folders);
    }
    return out;
  }
```

#### 2. src/__tests__/library/library-service.test.ts
**File**: src/__tests__/library/library-service.test.ts
**Changes**: MODIFY (incremental) — add a `buildLocalPackage / writePackageExport` describe block (SOURCE hashes + un-rewritten refs; FR-7 collisionWith; subfolder closure; write round-trip via `isReleaseResponse`). ADD only `createEmptyProtocolDocument`/`sha256String`/`isReleaseResponse` imports (Phase 1 already imported `packageNamespaceSegment`/`slugifyPackageId`/`installedRecordPath`).

```typescript
// ADD imports (Phase 1 already imported packageNamespaceSegment + slugifyPackageId from library-paths AND installedRecordPath from installed-record-store — do NOT re-add those):
import { createEmptyProtocolDocument } from '../../protocol/protocol-document';
import { sha256String } from '../../library/integrity';
import { isReleaseResponse } from '../../library/registry-model';

// ADD a new describe block (uses the existing makeService + makeVault + SETTINGS):
describe('LibraryService — buildLocalPackage / writePackageExport', () => {
  it('assembles a SOURCE bundle with correct hashes + un-rewritten refs', async () => {
    const protocolDoc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = protocolDoc.nodes[0]!.id;
    protocolDoc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: 'lung.md' } });
    protocolDoc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    const protoJson = JSON.stringify(protocolDoc, null, 2) + '\n';
    const snippetContent = '# Lung content\n';
    const files: Record<string, string> = { 'Protocols/chest-ct.rp.json': protoJson, 'Snippets/lung.md': snippetContent };
    const { service } = makeService({ files });
    const result = await service.buildLocalPackage('Protocols/chest-ct.rp.json', { packageId: 'chest-ct', releaseVersion: '1.0.0', author: { displayName: 'Roman' } });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.bundle.manifest.protocolSha256).toBe(await sha256String(protoJson));
    expect(result.bundle.manifest.protocolDoc.nodes.find((n) => n.id === 'snip-1')!.fields['snippetPath']).toBe('lung.md');
    expect(result.bundle.snippetContents).toEqual([{ relPath: 'lung.md', content: snippetContent }]);
    expect(result.bundle.manifest.snippetFiles[0]!.sha256).toBe(await sha256String(snippetContent));
    expect(isReleaseResponse(result.bundle)).toBe(true);
  });

  it('FR-7: sets collisionWith when a same-slug package is already installed', async () => {
    const protocolDoc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = protocolDoc.nodes[0]!.id;
    protocolDoc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: 'lung.md' } });
    protocolDoc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    const protoJson = JSON.stringify(protocolDoc, null, 2) + '\n';
    const existingRecord = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'chest.ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json',
      snippetNamespace: 'Snippets/library/chest-ct/1-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    const seg = await packageNamespaceSegment('chest.ct');
    const vSlug = slugifyPackageId('1.0.0');
    const files: Record<string, string> = {
      'Protocols/chest-ct.rp.json': protoJson,
      'Snippets/lung.md': '# Lung\n',
      [installedRecordPath(seg, vSlug)]: JSON.stringify(existingRecord, null, 2) + '\n',
    };
    const { service } = makeService({ files });
    const result = await service.buildLocalPackage('Protocols/chest-ct.rp.json', { packageId: 'chest-ct', releaseVersion: '1.0.0' });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.collisionWith).toBe('chest.ct');
  });

  it('fails on a subfolderPath-only node whose subfolder has no .md files (subfolder closure)', async () => {
    const protocolDoc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = protocolDoc.nodes[0]!.id;
    protocolDoc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { subfolderPath: 'empty-folder' } });
    protocolDoc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    const files: Record<string, string> = { 'Protocols/chest-ct.rp.json': JSON.stringify(protocolDoc, null, 2) + '\n' };
    const { service } = makeService({ files });
    const result = await service.buildLocalPackage('Protocols/chest-ct.rp.json', { packageId: 'chest-ct', releaseVersion: '1.0.0' });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('no .md files');
  });

  it('writePackageExport writes a single JSON that passes isReleaseResponse', async () => {
    const protocolDoc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = protocolDoc.nodes[0]!.id;
    protocolDoc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: 'lung.md' } });
    protocolDoc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    const files: Record<string, string> = { 'Protocols/chest-ct.rp.json': JSON.stringify(protocolDoc, null, 2) + '\n', 'Snippets/lung.md': '# Lung\n' };
    const { service } = makeService({ files });
    const build = await service.buildLocalPackage('Protocols/chest-ct.rp.json', { packageId: 'chest-ct', releaseVersion: '1.0.0' });
    if (build.status !== 'ok') throw new Error('build failed');
    await service.writePackageExport(build.bundle, 'Exports/chest-ct-1.0.0.json');
    const vault = (service as unknown as { app: { vault: { adapter: { read: (p: string) => Promise<string> } } } }).app.vault;
    const written = await vault.adapter.read('Exports/chest-ct-1.0.0.json');
    expect(isReleaseResponse(JSON.parse(written))).toBe(true);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `npx vitest run src/__tests__/library/library-service.test.ts` exits 0 — the new `buildLocalPackage / writePackageExport` describe block passes (SOURCE hashes, un-rewritten refs, FR-7 collision, subfolder closure, write round-trip) + all prior tests still pass.
- [ ] `grep -n "buildLocalPackage\|writePackageExport" src/library/library-service.ts` returns matches (both methods exist).

#### Manual Verification:
- [ ] Building a package from a local protocol produces a `.json` export that re-installs via the library view's install flow (the round-trip works end-to-end — verified fully in Phase 6's export modal).

---

## Phase 6: Export modal + command

### Overview
Depends on Phase 5 (uses `buildLocalPackage` + `writePackageExport`). Adds `LibraryExportModal` (Promise-based Modal: `FolderSuggest` destination + packageId/releaseVersion/author inputs + filename + collision preflight → build → write) and an "Export protocol as library package" command in `main.ts` that reuses `ProtocolPickerSuggestModal` to pick the source protocol. New i18n keys in BOTH en/ru.

### Changes Required:

#### 1. src/views/library-export-modal.ts
**File**: src/views/library-export-modal.ts
**Changes**: NEW — Promise-based Modal (modeled after `SnippetEditorModal` create-mode + `LibraryItemDetailModal`): `FolderSuggest` destination folder input + filename input + packageId/releaseVersion/author inputs + debounced file-collision preflight (`adapter.exists` — DISABLES Export on collision, mirroring SnippetEditorModal) → on confirm, `libraryService.buildLocalPackage(protocolPath, meta)` → surface FR-7 slug-collision warning (`collisionWith`, informational — proceeds) / error → `libraryService.writePackageExport(bundle, destPath)` → Notice + `safeResolve`. `safeResolve` double-guard; onClose resolves cancel.

```typescript
// src/views/library-export-modal.ts
// Export-package modal (FR-6/D3): collects a destination folder (FolderSuggest) +
// filename + packageId/releaseVersion/author, calls LibraryService.buildLocalPackage
// (FR-5) → writePackageExport (single JSON in the vault). Promise-based Modal with
// safeResolve double-guard, modeled after LibraryItemDetailModal + SnippetEditorModal
// (create-mode). Surfaces the FR-7 collision warning (informational) + proceeds.

import { App, Modal, Notice } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { FolderSuggest } from './folder-suggest';
import type { BuildResult } from '../library/library-service';

export type LibraryExportResult =
  | { exported: true; path: string }
  | { exported: false };

export class LibraryExportModal extends Modal {
  readonly result: Promise<LibraryExportResult>;
  private resolve!: (value: LibraryExportResult) => void;
  private resolved = false;

  private readonly plugin: RadiProtocolPlugin;
  private readonly protocolPath: string;
  private folderPath = '';
  private fileName = '';
  private packageId = '';
  private releaseVersion = '';
  private authorDisplayName = '';
  private exportBtn!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private collisionTimer: number | null = null;
  private hasFileCollision = false;

  constructor(app: App, plugin: RadiProtocolPlugin, protocolPath: string) {
    super(app);
    this.plugin = plugin;
    this.protocolPath = protocolPath;
    this.result = new Promise<LibraryExportResult>((res) => { this.resolve = res; });
  }

  async onOpen(): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('radi-library-export');
    this.titleEl.setText(t('library.exportTitle'));

    const folderRow = contentEl.createDiv({ cls: 'radi-library-export-field' });
    folderRow.createEl('label', { text: t('library.exportDestination'), attr: { for: 'radi-library-export-folder' } });
    const folderInput = folderRow.createEl('input', { cls: 'radi-library-export-folder', attr: { type: 'text' } });
    folderInput.placeholder = t('library.exportFolderPlaceholder');
    new FolderSuggest(this.app, folderInput);
    folderInput.addEventListener('input', () => { this.folderPath = folderInput.value; this.scheduleCollisionCheck(); });

    const nameRow = contentEl.createDiv({ cls: 'radi-library-export-field' });
    nameRow.createEl('label', { text: t('library.exportFilename'), attr: { for: 'radi-library-export-name' } });
    const nameInput = nameRow.createEl('input', { cls: 'radi-library-export-name', attr: { type: 'text' } });
    nameInput.placeholder = t('library.exportFilenamePlaceholder');
    nameInput.addEventListener('input', () => { this.fileName = nameInput.value; this.scheduleCollisionCheck(); });

    const pkgRow = contentEl.createDiv({ cls: 'radi-library-export-field' });
    pkgRow.createEl('label', { text: t('library.exportPackageId'), attr: { for: 'radi-library-export-pkgid' } });
    const pkgInput = pkgRow.createEl('input', { cls: 'radi-library-export-pkgid', attr: { type: 'text' } });
    pkgInput.placeholder = 'e.g. chest-ct';
    pkgInput.addEventListener('input', () => { this.packageId = pkgInput.value; this.updateExportEnabled(); });

    const verRow = contentEl.createDiv({ cls: 'radi-library-export-field' });
    verRow.createEl('label', { text: t('library.exportReleaseVersion'), attr: { for: 'radi-library-export-version' } });
    const verInput = verRow.createEl('input', { cls: 'radi-library-export-version', attr: { type: 'text' } });
    verInput.placeholder = 'e.g. 1.0.0';
    verInput.addEventListener('input', () => { this.releaseVersion = verInput.value; this.updateExportEnabled(); });

    const authorRow = contentEl.createDiv({ cls: 'radi-library-export-field' });
    authorRow.createEl('label', { text: t('library.exportAuthor'), attr: { for: 'radi-library-export-author' } });
    const authorInput = authorRow.createEl('input', { cls: 'radi-library-export-author', attr: { type: 'text' } });
    authorInput.placeholder = t('library.exportAuthorPlaceholder');
    authorInput.addEventListener('input', () => { this.authorDisplayName = authorInput.value; });

    this.statusEl = contentEl.createDiv({ cls: 'radi-library-export-status' });

    const actions = contentEl.createDiv({ cls: 'radi-library-export-actions' });
    this.exportBtn = actions.createEl('button', { cls: 'radi-library-detail-install mod-cta', attr: { 'aria-label': t('library.exportLabel') } });
    this.exportBtn.setText(t('library.exportLabel'));
    this.exportBtn.disabled = true;
    this.exportBtn.addEventListener('click', () => { void this.handleExport(); });
    const cancelBtn = actions.createEl('button', { cls: 'radi-library-detail-cancel', attr: { 'aria-label': t('library.cancel') } });
    cancelBtn.setText(t('library.cancel'));
    cancelBtn.addEventListener('click', () => { this.safeResolve({ exported: false }); this.close(); });
  }

  onClose(): void {
    this.safeResolve({ exported: false });
    this.contentEl.empty();
  }

  private safeResolve(value: LibraryExportResult): void {
    if (!this.resolved) { this.resolved = true; this.resolve(value); }
  }

  private scheduleCollisionCheck(): void {
    if (this.collisionTimer !== null) window.clearTimeout(this.collisionTimer);
    this.collisionTimer = window.setTimeout(() => { this.collisionTimer = null; void this.checkFileCollision(); }, 150);
  }

  private async checkFileCollision(): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    this.statusEl.empty();
    const destPath = this.computeDestPath();
    if (destPath === null) { this.hasFileCollision = false; this.updateExportEnabled(); return; }
    const exists = await this.app.vault.adapter.exists(destPath);
    this.hasFileCollision = exists;
    if (exists) this.statusEl.setText(t('library.exportCollisionFile', { path: destPath }));
    this.updateExportEnabled();
  }

  private computeDestPath(): string | null {
    const folder = this.folderPath.trim();
    const name = this.fileName.trim();
    if (name === '') return null;
    const safeName = name.endsWith('.json') ? name : `${name}.json`;
    return folder === '' ? safeName : `${folder}/${safeName}`;
  }

  private updateExportEnabled(): void {
    const destPath = this.computeDestPath();
    this.exportBtn.disabled = !(this.packageId.trim() !== '' && this.releaseVersion.trim() !== '' && destPath !== null && !this.hasFileCollision);
  }

  private async handleExport(): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const destPath = this.computeDestPath();
    if (destPath === null) return;
    this.exportBtn.disabled = true;
    const build: BuildResult = await this.plugin.libraryService.buildLocalPackage(this.protocolPath, {
      packageId: this.packageId.trim(),
      releaseVersion: this.releaseVersion.trim(),
      author: this.authorDisplayName.trim() === '' ? undefined : { displayName: this.authorDisplayName.trim() },
    });
    if (build.status === 'failed') {
      this.statusEl.setText(t('library.exportError', { reason: build.reason }));
      this.exportBtn.disabled = false;
      return;
    }
    if (build.collisionWith !== undefined) {
      // FR-7: informational warning — a same-slug package is installed (post-fix they coexist).
      this.statusEl.setText(t('library.exportCollisionWarning', { existing: build.collisionWith }));
    }
    try {
      await this.plugin.libraryService.writePackageExport(build.bundle, destPath);
      new Notice(t('library.exportedNotice', { path: destPath }));
      this.safeResolve({ exported: true, path: destPath });
      this.close();
    } catch (e) {
      this.statusEl.setText(t('library.exportError', { reason: (e as Error)?.message ?? String(e) }));
      this.exportBtn.disabled = false;
    }
  }
}
```

#### 2. src/main.ts
**File**: src/main.ts
**Changes**: MODIFY — add the `LibraryExportModal` import + the "Export protocol as library package" command (reuses `ProtocolPickerSuggestModal` like `handleRunProtocolInline`) + the `handleExportProtocolPackage` handler.

```typescript
// ADD import (near the other library-view imports):
import { LibraryExportModal } from './views/library-export-modal';

// ADD the command in onload (near the other addCommand blocks, e.g. after open-community-library):
    // Slice 6 — Export a local protocol as a library package (FR-6/D9).
    this.addCommand({
      id: 'export-protocol-as-library-package',
      name: 'Export protocol as library package',
      callback: () => { void this.handleExportProtocolPackage(); },
    });

// ADD the handler method (near handleRunProtocolInline):
  /** Slice 6 — pick a source protocol, then open the export modal. */
  private async handleExportProtocolPackage(): Promise<void> {
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
      (item) => {
        this.pickerModal = null;
        new LibraryExportModal(this.app, this, item.file.path).open();
      },
      libraryContext,
      this.i18n.t.bind(this.i18n),
    );
    this.pickerModal.open();
  }
```

#### 3. src/i18n/locales/en.json
**File**: src/i18n/locales/en.json
**Changes**: MODIFY — add the `library.export*` keys to the `library` namespace, after the Phase 2 `dirtySlotError` key (incremental — do NOT re-emit the Phase 2 keys). `library.cancel` is reused (already exists).

```json
    "exportTitle": "Export package",
    "exportDestination": "Destination folder",
    "exportFolderPlaceholder": "e.g. Exports",
    "exportFilename": "File name",
    "exportFilenamePlaceholder": "e.g. chest-ct-1.0.0",
    "exportPackageId": "Package ID",
    "exportReleaseVersion": "Release version",
    "exportAuthor": "Author (optional)",
    "exportAuthorPlaceholder": "e.g. Roman Shulgha",
    "exportLabel": "Export",
    "exportedNotice": "Package exported: {path}",
    "exportError": "Export failed: {reason}",
    "exportCollisionFile": "A file with this name already exists: {path}",
    "exportCollisionWarning": "A package with a colliding slug ('{existing}') is already installed — they will coexist, but this may be confusing."
```
(Added after `dirtySlotError` — with a trailing comma added to the `dirtySlotError` line — before the `library` namespace's closing `}`.)

#### 4. src/i18n/locales/ru.json
**File**: src/i18n/locales/ru.json
**Changes**: MODIFY — add the same `library.export*` keys (Russian text) to the `library` namespace, after the Phase 2 `dirtySlotError` key (incremental).

```json
    "exportTitle": "Экспорт пакета",
    "exportDestination": "Папка назначения",
    "exportFolderPlaceholder": "напр. Exports",
    "exportFilename": "Имя файла",
    "exportFilenamePlaceholder": "напр. chest-ct-1.0.0",
    "exportPackageId": "ID пакета",
    "exportReleaseVersion": "Версия выпуска",
    "exportAuthor": "Автор (необязательно)",
    "exportAuthorPlaceholder": "напр. Роман Шульга",
    "exportLabel": "Экспортировать",
    "exportedNotice": "Пакет экспортирован: {path}",
    "exportError": "Ошибка экспорта: {reason}",
    "exportCollisionFile": "Файл с таким именем уже существует: {path}",
    "exportCollisionWarning": "Пакет с совпадающим слагом («{existing}») уже установлен — они будут сосуществовать, но это может вызвать путаницу."
```
(Added after `dirtySlotError` — with a trailing comma — before the `library` namespace's closing `}`.)

#### 5. src/__tests__/views/library-export-modal.test.ts
**File**: src/__tests__/views/library-export-modal.test.ts
**Changes**: NEW — source-grep wiring guard (the codebase has no library-view modal tests — LibraryItemDetailModal/LibraryInstallProgressModal are untested — so a source-grep guard is the consistent lightweight pattern; the build→write round-trip is covered at the service level in Phase 5). Asserts the modal exports + `safeResolve`; `buildLocalPackage`/`writePackageExport` calls; `FolderSuggest`; FR-7 `collisionWith`; file-collision `hasFileCollision` disable; main.ts command; en/ru key parity.

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const modalSrc = fs.readFileSync(path.resolve(__dirname, '../../views/library-export-modal.ts'), 'utf8');
const mainSrc = fs.readFileSync(path.resolve(__dirname, '../../main.ts'), 'utf8');
const enSrc = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf8');
const ruSrc = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ru.json'), 'utf8');

describe('library-export-modal — wiring guard', () => {
  it('exports LibraryExportModal with a Promise result + safeResolve double-guard', () => {
    expect(modalSrc).toContain('export class LibraryExportModal');
    expect(modalSrc).toContain('readonly result: Promise<');
    expect(modalSrc).toContain('safeResolve');
  });
  it('calls buildLocalPackage + writePackageExport on export', () => {
    expect(modalSrc).toContain('buildLocalPackage');
    expect(modalSrc).toContain('writePackageExport');
  });
  it('attaches FolderSuggest to the destination input', () => {
    expect(modalSrc).toContain('FolderSuggest');
  });
  it('surfaces the FR-7 collision warning (collisionWith)', () => {
    expect(modalSrc).toContain('collisionWith');
    expect(modalSrc).toContain('exportCollisionWarning');
  });
  it('disables Export when the destination file already exists (file-collision preflight)', () => {
    expect(modalSrc).toContain('hasFileCollision');
    expect(modalSrc).toContain('!this.hasFileCollision');
  });
  it('main.ts registers the export command + opens the modal via ProtocolPickerSuggestModal', () => {
    expect(mainSrc).toContain("id: 'export-protocol-as-library-package'");
    expect(mainSrc).toContain('LibraryExportModal');
    expect(mainSrc).toContain('ProtocolPickerSuggestModal');
  });
  it('en/ru export key parity (Check 7)', () => {
    for (const key of ['exportTitle', 'exportDestination', 'exportLabel', 'exportedNotice', 'exportError', 'exportCollisionFile', 'exportCollisionWarning']) {
      expect(enSrc).toContain(`"${key}"`);
      expect(ruSrc).toContain(`"${key}"`);
    }
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `npx vitest run src/__tests__/views/library-export-modal.test.ts` exits 0 — the wiring guard passes (modal exports + safeResolve, buildLocalPackage+writePackageExport calls, FolderSuggest, collisionWith, hasFileCollision disable, main.ts command, en/ru key parity).
- [ ] `grep -n "export-protocol-as-library-package" src/main.ts` returns a match (the command is registered).
- [ ] `grep -c "export" src/i18n/locales/en.json` returns >= 14 AND `grep -c "export" src/i18n/locales/ru.json` returns >= 14 (the export keys are in both locales).

#### Manual Verification:
- [ ] The "Export protocol as library package" command appears in the command palette; picking a protocol opens the export modal; entering packageId/version/destination + Export writes a `.json` file to the vault; the file re-installs via the library view's install flow (build → export → re-install round-trip works end-to-end).
- [ ] `node scripts/check-consistency.mjs` Check 7 passes (en/ru key-set parity — the export keys are in both locales).

---

## Phase 7: Uninstall UI

### Overview
Depends on nothing structural (the uninstall service already exists at `library-service.ts:141`); can run in parallel with Phases 2-6. Ordered last per the UI-last convention. Adds an Uninstall button to `LibraryView.renderInstalledRecord` (after the integrity badge) + a `handleUninstall` method mirroring `handleDeleteSnippet` (`ConfirmModal` → `libraryService.uninstall` → status check → Notice → explicit `await this.refresh()`). New i18n keys in BOTH en/ru.

### Changes Required:

#### 1. src/views/library-view.ts
**File**: src/views/library-view.ts
**Changes**: MODIFY — add `ConfirmModal` import; in `renderInstalledRecord`, add an Uninstall button after the integrity badge; add `handleUninstall(record)` (ConfirmModal destructive → `await modal.result` → guard `!== 'confirm'` → facade → status check → Notice → explicit `await this.refresh()`).

```typescript
// ADD import (near the other view imports):
import { ConfirmModal } from './confirm-modal';

// In `renderInstalledRecord`, ADD after the integrity badge (the method currently ends after the badge):
    // FR-8: Uninstall button (wires the existing LibraryService.uninstall).
    const uninstallBtn = row.createEl('button', {
      cls: 'radi-library-uninstall-btn',
      attr: { 'aria-label': t('library.uninstallLabel') },
    });
    uninstallBtn.setText(t('library.uninstallLabel'));
    uninstallBtn.addEventListener('click', () => { void this.handleUninstall(record); });

// ADD the `handleUninstall` method (after `openInstall`):
  /** FR-8: uninstall an installed package — ConfirmModal → facade (status check,
   *  not try/catch — the facade never throws) → Notice → explicit refresh (the
   *  installer deletes the marker via adapter.remove on a dotfolder file, which
   *  does not reliably fire vault.on('delete')). Mirrors handleDeleteSnippet. */
  private async handleUninstall(record: InstalledRecord): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const modal = new ConfirmModal(this.app, {
      title: t('library.uninstallTitle'),
      body: t('library.uninstallBody', { packageId: record.packageId, version: record.releaseVersion }),
      confirmLabel: t('library.uninstallConfirm'),
      cancelLabel: t('library.cancel'),
      destructive: true,
    });
    modal.open();
    const result = await modal.result;
    if (result !== 'confirm') return;
    const uninstallResult = await this.plugin.libraryService.uninstall(record.packageId, record.releaseVersion);
    if (uninstallResult.status === 'ok') {
      new Notice(t('library.uninstalledNotice', { packageId: record.packageId }));
    } else if (uninstallResult.status === 'not-installed') {
      new Notice(t('library.notInstalledNotice', { packageId: record.packageId }));
    } else {
      new Notice(t('library.uninstallError', { reason: uninstallResult.reason }));
    }
    await this.refresh();
  }
```

#### 2. src/i18n/locales/en.json
**File**: src/i18n/locales/en.json
**Changes**: MODIFY — add the `library.uninstall*` keys to the `library` namespace, after the Phase 6 `exportCollisionWarning` key (incremental). `library.cancel` is reused.

```json
    "uninstallLabel": "Uninstall",
    "uninstallTitle": "Uninstall package?",
    "uninstallBody": "Package {packageId}@{version} will be removed. Snippet and protocol files under the library namespace are deleted; your own snippets and protocols are untouched.",
    "uninstallConfirm": "Uninstall",
    "uninstalledNotice": "Package uninstalled: {packageId}",
    "notInstalledNotice": "Package not installed: {packageId}",
    "uninstallError": "Uninstall failed: {reason}"
```
(Added after `exportCollisionWarning` — with a trailing comma — before the `library` namespace's closing `}`.)

#### 3. src/i18n/locales/ru.json
**File**: src/i18n/locales/ru.json
**Changes**: MODIFY — add the same `library.uninstall*` keys (Russian text) to the `library` namespace, after the Phase 6 `exportCollisionWarning` key (incremental).

```json
    "uninstallLabel": "Удалить",
    "uninstallTitle": "Удалить пакет?",
    "uninstallBody": "Пакет {packageId}@{version} будет удалён. Файлы сниппетов и протоколов в пространстве имён библиотеки удаляются; ваши собственные сниппеты и протоколы не затрагиваются.",
    "uninstallConfirm": "Удалить",
    "uninstalledNotice": "Пакет удалён: {packageId}",
    "notInstalledNotice": "Пакет не установлен: {packageId}",
    "uninstallError": "Ошибка удаления: {reason}"
```
(Added after `exportCollisionWarning` — with a trailing comma — before the `library` namespace's closing `}`.)

#### 4. src/__tests__/views/library-view-uninstall.test.ts
**File**: src/__tests__/views/library-view-uninstall.test.ts
**Changes**: NEW — source-grep wiring guard (the codebase has no library-view modal tests; the uninstall service is tested at the installer level in Phase 1). Asserts `handleUninstall` + `ConfirmModal` + facade call `(record.packageId, record.releaseVersion)` + explicit `await this.refresh()` + the uninstall button + status check + en/ru key parity.

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const viewSrc = fs.readFileSync(path.resolve(__dirname, '../../views/library-view.ts'), 'utf8');
const enSrc = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf8');
const ruSrc = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ru.json'), 'utf8');

describe('library-view — uninstall UI wiring guard', () => {
  it('has a handleUninstall method that uses ConfirmModal + the facade + explicit refresh', () => {
    expect(viewSrc).toContain('handleUninstall');
    expect(viewSrc).toContain('ConfirmModal');
    expect(viewSrc).toContain('this.plugin.libraryService.uninstall');
    expect(viewSrc).toContain('await this.refresh()');
  });
  it('renders an Uninstall button in renderInstalledRecord', () => {
    expect(viewSrc).toContain('radi-library-uninstall-btn');
    expect(viewSrc).toContain('library.uninstallLabel');
  });
  it('checks the uninstall status (ok/not-installed/failed), not try/catch', () => {
    expect(viewSrc).toContain("'not-installed'");
    expect(viewSrc).toContain('uninstallError');
  });
  it('calls uninstall with (record.packageId, record.releaseVersion) — the facade, not the installer', () => {
    expect(viewSrc).toContain('this.plugin.libraryService.uninstall(record.packageId, record.releaseVersion)');
  });
  it('en/ru uninstall key parity (Check 7)', () => {
    for (const key of ['uninstallLabel', 'uninstallTitle', 'uninstallBody', 'uninstallConfirm', 'uninstalledNotice', 'notInstalledNotice', 'uninstallError']) {
      expect(enSrc).toContain(`"${key}"`);
      expect(ruSrc).toContain(`"${key}"`);
    }
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `npx vitest run src/__tests__/views/library-view-uninstall.test.ts` exits 0 — the wiring guard passes (handleUninstall + ConfirmModal + facade + refresh, uninstall button, status check, en/ru parity).
- [ ] `grep -n "handleUninstall" src/views/library-view.ts` returns >= 2 matches (the method + the button's click handler).
- [ ] `grep -cE "uninstallLabel|uninstallTitle|uninstallBody|uninstallConfirm|uninstalledNotice|notInstalledNotice|uninstallError" src/i18n/locales/en.json` returns 7 AND the same grep on `src/i18n/locales/ru.json` returns 7 (all 7 uninstall keys present in both locales — `notInstalledNotice` does not contain the substring "uninstall", so a bare `grep -c uninstall` would undercount).
- [ ] `npm run check` exits 0 — build + lint + tests + planning + consistency + agent-docs (the FINAL whole-plan gate; this is the terminal phase so the project-baseline check goes here).

#### Manual Verification:
- [ ] The library view's Installed section shows an Uninstall button on each installed package; clicking it opens a confirm dialog; confirming removes the package's files + marker + the row disappears (the explicit refresh updates the list).
- [ ] `node scripts/check-consistency.mjs` Check 7 passes (en/ru key-set parity — the uninstall keys are in both locales).

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source   | plan-loc                | codebase-loc                | severity   | dimension             | finding                                                                                                                                                                                                                                                                                                                                 | recommendation                                                                                                                                                                                                                     | resolution         |
| -------- | ----------------------- | --------------------------- | ---------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| coverage | ## Verification Notes §14 | <n/a>                      | blocker    | verification-coverage | `slugifyLabel` unchanged: no Success Criteria bullet greps `slugifyLabel`/`snippet-model.ts` in any phase; `snippet-model.ts` is absent from all 7 phases' file lists/code fences → the NFR ships with no guard against an accidental edit.                                                                                              | Add to Phase 1's `#### Automated Verification:`: `git diff --exit-code HEAD -- src/snippets/snippet-model.ts` (slugifyLabel body unchanged — the fix is localized to library-paths.ts).                                            | (filled at Step 9) |
| coverage | ## Verification Notes §15 | <n/a>                      | blocker    | verification-coverage | No wire-shape change: no bullet guards `INSTALLED_RECORD_VERSION` stays 1 / `isPackageManifest`/`isInstalledRecord` sentinels unchanged; `library-model.ts` absent from all phases; test fixtures use `INSTALLED_RECORD_VERSION` as a pass-through → a version bump ships undetected.                                                  | Add to Phase 4's `#### Automated Verification:`: `grep -n "INSTALLED_RECORD_VERSION = 1" src/library/library-model.ts` returns a match + `git diff --exit-code HEAD -- src/library/library-model.ts` (sentinels unchanged).      | (filled at Step 9) |
| code     | Phase 2 §1              | <n/a>                      | concern    | actionability         | `LIBRARY_SUBROOT` appears in Phase 2's import-block code fence, but Phase 3 §1's prose then says "ADD `LIBRARY_SUBROOT`" — an implementer following both prosea literally would re-insert `LIBRARY_SUBROOT,` causing a duplicate-import compile error.                                                                               | Remove `LIBRARY_SUBROOT` from Phase 2's code fence (defer it to Phase 3 per its prose), or change Phase 3's prose to "no-op — already imported in Phase 2".                                                                       | (filled at Step 9) |
| code     | Phase 1 §4              | src/library/library-installer.ts:487-491 | concern    | code-quality          | The new `rollbackTransaction` derives `snipNs` via `commonNamespacePrefix` from the journal's own snippet entries; for a corrupted journal with cross-package snippet entries the common prefix collapses to `Snippets/library`, making `removeOwnedPaths`'s `isOwned` gate accept ANY library snippet path — a defense-in-depth regression. | Clamp `commonNamespacePrefix`'s result to at most the `library/<segment>/<version>` depth, or fall back to the settings-derived namespace when the common prefix is broader than one package namespace.        | (filled at Step 9) |
| code     | Phase 4 §1              | src/library/library-installer.ts:324-329 | concern    | code-quality          | `planRecordMigration` preserves the original `protocolSha256` via the lossless spread but rewrites the on-disk doc's snippet refs, so the stored `protocolSha256` no longer matches the rewritten on-disk doc — breaking the installer's "the record's protocolSha256 is verifiable later" contract.                                | Compute `newInstalledProtocolSha256 = sha256String(JSON.stringify(plan.rewrittenDoc, null, 2) + '\n')` in the orchestrator and override `plan.record.protocolSha256` before writing the new marker.                              | (filled at Step 9) |
| code     | Phase 4 §1              | <n/a>                      | concern    | code-quality          | `planRecordMigration`'s `if (rewritten !== null) node.fields['snippetPath'] = rewritten` silently skips snippet refs that don't match the old namespace prefix, leaving them pointing at the old namespace after `removeOwnedPaths` deletes it — a dangling ref for a hand-edited/non-standard installed doc.                          | Return an error result from `planRecordMigration` when any snippet ref fails to match; the orchestrator pushes the record to `failed`.                                                                                            | (filled at Step 9) |
| code     | Phase 4 §2              | <n/a>                      | concern    | code-quality          | `const protocolDoc = JSON.parse(raw) as ProtocolDocumentV1;` is an unsafe cast without `isProtocolDocumentV1` validation, unlike `planInstall` which validates via `isProtocolDocumentV1` + parser — a malformed but valid-JSON doc is silently fed to `planRecordMigration`.                                                          | Import `isProtocolDocumentV1` and guard: `if (!isProtocolDocumentV1(protocolDoc)) { skipped.push(...); continue; }` before calling `planRecordMigration`.                                                                          | (filled at Step 9) |
| code     | Phase 4 §3              | src/__tests__/library/library-service.test.ts:74 | concern    | actionability         | `recoverInterruptedInstalls` now calls `this.installer.migrateInstalledRecords()`, but Phase 4 does not add a `migrateInstalledRecords` stub to the `installer` object in `makeService`, so the existing `recoverInterruptedInstalls` test calls `undefined()` → caught TypeError + console.warn (test passes but the stub is incomplete/noisy). | Add `migrateInstalledRecords: vi.fn(async () => ({ migrated: [], skipped: [], failed: [] }))` to the installer stub in `makeService`.                                                                                          | (filled at Step 9) |
| code     | Phase 1 §4              | src/library/library-installer.ts:181,382 | suggestion | code-quality          | `planInstall` computes `pkgSegment` once but `readMarker(packageId, version)` recomputes `packageNamespaceSegment(packageId)` internally (same in `uninstall`), doubling the sha256 call per install/uninstall.                                                                                                                       | Accept a precomputed `pkgSegment` parameter in `readMarker` and pass the already-computed segment from each caller.                                                                                                                 | (filled at Step 9) |
| code     | Phase 5 §1              | src/library/library-installer.ts (Phase 3 §1) | suggestion | codebase-fit          | `listFilesRecursive` is duplicated verbatim from Phase 3 §1's `LibraryInstaller` helper onto `LibraryService` — same BFS walk, same `catch { continue }`.                                                                                                                                                                              | Factor `listFilesRecursive` into a shared pure utility (e.g. `src/utils/vault-utils.ts`) and import from both classes.                                                                                                              | (filled at Step 9) |