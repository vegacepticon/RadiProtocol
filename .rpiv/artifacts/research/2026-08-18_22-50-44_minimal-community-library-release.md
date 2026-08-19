---
date: 2026-08-18T22:50:44+0300
author: Roman Shulgha
commit: d74dfad
branch: main
repository: RadiProtocol
topic: "Minimal Community Library release"
tags: [research, codebase, community-library, registry, installation, obsidian-indexing]
status: ready
last_updated: 2026-08-18T22:50:44+0300
last_updated_by: Roman Shulgha
---

# Research: Minimal Community Library release

## Research Question

What current code paths, incomplete integrations, validation evidence, and documentation gaps must be addressed to ship the existing command → catalog → manifest preview → install flow as a minimal Community Library release, while preserving the `RegistryClient` → `LibraryService` → transactional `LibraryInstaller` layering and existing wire/persistence contracts?

## Summary

The narrow release seam is substantially implemented. Registry access is explicit, HTTPS-only, and never-throw; catalog fallback, client-side filtering, manifest preview gating, full-release refetch, transactional validation, marker-last commit, rollback, recovery, import/export, and uninstall all have live code and lower-layer coverage. The current working tree based on `d74dfad` is dirty with pre-existing source and artifact changes; findings and citations describe that live tree rather than a pristine commit. In that tree, `npm run check` passed with 74 test files and 1013 tests; consistency emitted one non-failing Knip advisory.

Four release gaps remain. First, protocol and snippet folder callbacks only persist mutable settings, while the library service and installer retain construction-time root values; only the registry URL callback currently rebuilds them (`src/settings.ts:97-140`, `src/main.ts:304-310`). Second, successful install visibility relies on adapter-write events even though the uninstall path documents those events as unreliable (`src/views/library-view.ts:432-468`). Third, normal selection and execution require indexed `TFile` objects, while installation writes protocol files through the storage adapter (`src/library/library-installer.ts:130-138`, `src/protocol/protocol-file-resolver.ts:19-60`). Fourth, both READMEs omit Community Library setup and use (`README.md:44-50`, `README.ru.md:44-50`).

Obsidian's public API exposes Vault-level creation, lookup, and events, but no targeted public refresh/reindex method for adopting an adapter-created file into the Vault tree. The developer selected a bounded readiness barrier as the canonical design direction: retain transactional adapter writes, wait for post-install `TFile` visibility, and explicitly synchronize Installed state. Exact timeout/result semantics remain a design question.

## Detailed Findings

### Mutable storage settings and reconstruction

- `RadiProtocolSettings` owns the mutable protocol, snippet, and registry values; startup creates a detached, normalized two-root object for `LibraryService` (`src/settings.ts:20-47`, `src/main.ts:78-86`).
- `LibraryService` retains that object and passes it to a newly constructed `LibraryInstaller`; both read construction-captured roots during later work (`src/library/library-service.ts:91-118`, `src/library/library-installer.ts:90-102`).
- Protocol and snippet handlers mutate and save only. The registry handler uses the required sequential precedent: mutate → await save → await `rebuildLibraryServices()` (`src/settings.ts:97-140`).
- Reconstruction rereads and normalizes both current roots with `normalizeProtocolFolderPath()` (`src/main.ts:304-310`, `src/protocol/protocol-file-resolver.ts:10-16`). This means a later registry URL change can accidentally mask stale-root behavior by rebuilding after root changes.
- Existing settings tests assert trimming/defaulting and persistence counts, but their mock exposes no reconstruction method; they cannot distinguish save-only behavior from service rebuilding (`src/__tests__/settings-tab.test.ts:90-118`).
- The reconstruction comment says installer/cache/record-store objects are preserved, but the implementation creates a new `LibraryService` without injecting old dependencies, so the constructor creates new object instances over the same vault data (`src/main.ts:298-310`, `src/library/library-service.ts:103-118`).
- Same-session drift affects adjacent flows too: registry and local import use the captured installer roots; export reads snippets from the captured service root; uninstall remains record-derived and therefore does not orphan old installs after a root change (`src/library/library-service.ts:180-217`, `src/library/library-service.ts:260-338`, `src/library/library-installer.ts:506-529`).

### Catalog discovery and unavailable states

- `DEFAULT_REGISTRY_URL` is empty. `normalizeRegistryUrl()` trims, rejects invalid/non-HTTPS values, and strips trailing slashes; an unusable endpoint becomes explicit unavailable state (`src/library/registry-client.ts:17-22`, `src/library/registry-client.ts:47-82`).
- `fetchCatalog()` maps no endpoint, non-2xx, malformed response, transport failure, and unexpected errors to an `unavailable` result rather than throwing (`src/library/registry-client.ts:84-112`).
- `LibraryService.listCatalog()` preserves `available=false` while serving a valid cached snapshot. Missing cache yields an empty list; malformed/unreadable cache is captured as `cacheError`; an unexpected client throw follows the same fallback path (`src/library/library-service.ts:28-45`, `src/library/library-service.ts:124-150`).
- `LibraryView.refresh()` fetches the complete catalog and installed records under a generation guard (`src/views/library-view.ts:218-245`). Search and category controls re-render the loaded model locally and do not fetch per input (`src/views/library-view.ts:114-135`, `src/views/library-view.ts:293-312`).
- The model distinguishes cache corruption through `cacheError`, but `renderBanner()` only branches on `available` and `fetchedAt`; corruption and no-cache currently render the same unavailable branch (`src/library/library-service.ts:28-45`, `src/views/library-view.ts:314-327`).

### Trust preview and installation gating

- Manifest preview has an explicit `ok | not-found | unavailable` union and no snippet-content payload (`src/library/library-service.ts:46-60`).
- `fetchReleaseManifest()` requires a 2xx response, a structurally valid `PackageManifest`, and exact requested package/version identity; all failure paths remain result data (`src/library/registry-client.ts:151-179`, `src/library/library-model.ts:174-187`).
- The detail modal creates Install disabled, fetches through `LibraryService`, and enables it only for `ok`; not-found, malformed, mismatched, unavailable, and defensive-catch paths leave it disabled (`src/views/library-item-detail-modal.ts:39-85`, `src/views/library-item-detail-modal.ts:112-130`).
- The preview lists the protocol title/hash and every snippet path/hash. The UI explicitly frames SHA-256 as integrity verification and does not claim publisher authenticity (`src/views/library-item-detail-modal.ts:53-60`, `src/views/library-item-detail-modal.ts:132-146`).
- Install does not reuse preview bytes. `LibraryService.install()` fetches the full release bundle and invokes the transactional installer only for `ok` (`src/library/library-service.ts:153-171`).

### Transactional installation and failure behavior

- `InstallResult` remains `ok | failed`; network, planning, journal, commit, and unexpected errors are converted to `failed` rather than thrown (`src/library/library-installer.ts:47-50`, `src/library/library-service.ts:161-171`).
- Planning validates destination occupancy, path safety, manifest/content closure, `.md` snippets, protocol/snippet SHA-256, parser validity, reference rewriting, subfolder closure, and staged graph validity before final writes (`src/library/library-installer.ts:274-407`).
- The plan orders snippet entries, protocol, then the marker entry last and records the rewritten protocol hash and owned paths (`src/library/library-installer.ts:409-445`).
- Commit writes the journal first, snippets next, protocol next, and the valid installed-record marker last. A commit error invokes namespace-gated rollback; post-marker journal cleanup is best-effort because the install is already committed (`src/library/library-installer.ts:114-150`).
- Rollback and uninstall share deepest-first, namespace-gated deletion. An incomplete rollback deliberately preserves its journal for startup recovery (`src/library/library-installer.ts:506-627`).
- The progress modal maps the canonical result into exhaustive `installing | complete | failed` UI states. Closing during installation resolves the modal early but does not cancel the running service operation (`src/views/library-install-progress-modal.ts:87-136`).

### Installed-section refresh and runtime visibility

- The Library view watches managed roots and `.radiprotocol/library/installed`, debounces events for 120 ms, then runs a generation-guarded refresh (`src/views/library-view.ts:161-245`).
- Installed records are enumerated directly through adapter list/read operations, so an explicit post-marker refresh can observe a committed record without waiting for Vault `TFile` indexing (`src/library/installed-record-store.ts:66-98`, `src/library/library-service.ts:221-227`).
- Network install currently performs no explicit refresh after the progress modal. It assumes the marker adapter write emits a watched event, including when the modal closes mid-install (`src/views/library-view.ts:432-441`).
- The same file documents the inverse assumption as unreliable: uninstall explicitly refreshes because adapter removal of the dotfolder marker may not emit `vault.on('delete')` (`src/views/library-view.ts:442-468`).
- Protocol discovery is index-only. Both the `TFolder.children` path and `vault.getFiles()` fallback return indexed `TFile`s rather than scanning adapter storage (`src/protocol/protocol-file-resolver.ts:19-60`).
- Runner commands resolve a fresh `TFile[]` before opening the picker (`src/main.ts:341-360`, `src/main.ts:508-540`). The picker stores that snapshot, and `InlineRunnerModal` independently rejects a path unless `getAbstractFileByPath()` returns a `TFile` (`src/views/protocol-picker-modal.ts:39-69`, `src/views/inline-runner-modal.ts:136-143`).
- Consequently, four states are distinct: committed marker visibility, Installed-section rendering, protocol `TFile` visibility, and actual runner usability. The current code directly guarantees only the committed marker and adapter-readable record.
- Public Obsidian surfaces provide Vault create/modify/lookups and file events but no documented targeted refresh/reindex operation. Events are eventual notifications, not a command that constructs or refreshes the Vault file tree. The developer chose a bounded readiness barrier over changing the transactional write path or retaining watcher-only behavior.

### Adjacent import, export, and uninstall boundary

- Import and export command entry points remain registered independently of browse-to-install (`src/main.ts:116-130`). Uninstall remains an Installed-row action (`src/views/library-view.ts:411-420`).
- Local import validates the single-JSON wire shape before invoking the same transactional installer; unreadable/invalid packages produce zero installer mutation (`src/library/library-service.ts:174-207`).
- Export resolves a current protocol picker selection but reads package snippets through the service's captured snippet root, then emits the same release-bundle shape accepted by import (`src/main.ts:446-469`, `src/library/library-service.ts:258-338`).
- Uninstall derives owned protocol/snippet paths from the persisted record, not current root settings, and explicitly refreshes the view afterward (`src/library/library-installer.ts:506-529`, `src/views/library-view.ts:448-468`).
- Root reconstruction and index-readiness work therefore affect local imports and exports indirectly even though expansion of these flows remains outside release scope.

### Automated and manual evidence

- The canonical gate is a fail-fast chain of build, lint, Vitest, planning freshness, consistency, and agent-guidance checks (`package.json:8-19`).
- In the dirty working tree based on `d74dfad`, `npm run check` passed: 74 test files and 1013 tests passed; planning and agent-guidance checks passed; consistency passed with one non-failing Knip advisory. This is not evidence for a pristine `d74dfad` checkout.
- Installer tests cover valid commit, namespace isolation, integrity/path/graph rejection, duplicate refusal, and rollback (`src/__tests__/library/library-installer.test.ts:161-270`). Service tests cover cache success/fallback, filtering, full-release delegation, failed fetch mapping, installed records, and recovery delegation (`src/__tests__/library/library-service.test.ts:90-235`).
- The only focused LibraryView suite is a source-level uninstall wiring guard, not an Obsidian-host behavioral seam test (`src/__tests__/views/library-view-uninstall.test.ts:1-31`).
- Existing Node/Vitest mocks cannot prove real adapter-event ordering or Vault index adoption. The selected release mode therefore requires a repeatable Obsidian checklist for same-session root changes, browse/search/filter, preview gating, successful commit, automatic Installed refresh, picker visibility, execution, unavailable registry, preflight rejection, commit failure, and physical residue checks.
- UI absence alone is not rollback evidence. A valid marker plus files but no Installed row indicates refresh failure; physical files plus no picker entry indicate indexing failure; a journal without a valid marker indicates recovery is pending; zero residue requires checking protocol, snippets, marker, and journal paths.

### Documentation gap

- Both setup sections currently stop at protocol folder, snippet folder, separator, and language; neither contains Community Library setup or workflow instructions (`README.md:44-50`, `README.ru.md:44-50`).
- Required documentation facts already exist in code: explicit empty-default HTTPS endpoint (`src/library/registry-client.ts:17-22`, `src/library/registry-client.ts:47-82`), **Open community library** command (`src/main.ts:107-115`), preview/install flow (`src/views/library-view.ts:423-435`), managed protocol/snippet namespaces (`src/library/library-paths.ts:57-91`), and integrity-not-authenticity language (`src/views/library-view.ts:28-34`).
- English and Russian documents need equivalent coverage and must retain literal command names where those commands are registered only in English.

## Code References

- `src/settings.ts:20-47` — canonical mutable settings and empty registry default.
- `src/settings.ts:97-140` — root save-only handlers and registry save-then-rebuild precedent.
- `src/main.ts:78-90` — normalized startup service construction and recovery-before-views ordering.
- `src/main.ts:107-130` — browse, export, and import command registrations.
- `src/main.ts:288-310` — Library view activation and service reconstruction.
- `src/main.ts:508-540` — normal inline-runner discovery and picker construction.
- `src/protocol/protocol-file-resolver.ts:10-60` — normalization and index-only `TFile` resolution.
- `src/library/registry-client.ts:47-82` — HTTPS URL normalization and unavailable state.
- `src/library/registry-client.ts:84-179` — catalog, release, and manifest never-throw fetches.
- `src/library/library-service.ts:91-171` — captured dependencies, catalog fallback, and install facade.
- `src/library/library-service.ts:174-256` — local import, uninstall, installed records, and manifest facade.
- `src/library/library-service.ts:258-338` — export bundle construction and write.
- `src/library/library-installer.ts:114-150` — journal-first, marker-last transaction.
- `src/library/library-installer.ts:274-445` — complete in-memory install planning and record construction.
- `src/library/library-installer.ts:506-627` — uninstall and shared rollback deletion semantics.
- `src/library/installed-record-store.ts:66-98` — adapter-based installed-record enumeration.
- `src/views/library-item-detail-modal.ts:39-85` — initially disabled preview action.
- `src/views/library-item-detail-modal.ts:112-146` — manifest result gating and file/hash display.
- `src/views/library-install-progress-modal.ts:87-136` — closed-mid-install behavior and exhaustive terminal states.
- `src/views/library-view.ts:161-245` — watcher, debounce, path scope, and generation-guarded refresh.
- `src/views/library-view.ts:423-468` — preview/install orchestration and contrasting uninstall refresh.
- `src/views/protocol-picker-modal.ts:39-69` — immutable picker `TFile[]` snapshot.
- `src/views/inline-runner-modal.ts:136-143` — runtime `TFile` guard.
- `src/__tests__/settings-tab.test.ts:90-118` — persistence-only root setting evidence.
- `src/__tests__/library/library-installer.test.ts:161-270` — transactional validation and rollback evidence.
- `src/__tests__/library/library-service.test.ts:90-235` — cache/facade/recovery evidence.
- `package.json:8-19` — canonical repository gate.
- `README.md:44-50` — English setup gap.
- `README.ru.md:44-50` — Russian setup gap.

## Integration Points

### Inbound References

- `src/main.ts:107-115` — command palette opens the Community Library view.
- `src/views/library-view.ts:218-232` — mounted view consumes catalog and installed-record methods.
- `src/views/library-item-detail-modal.ts:112-130` — preview modal consumes `getReleaseManifest()`.
- `src/views/library-install-progress-modal.ts:100-107` — progress modal consumes `install()` and maps its result.
- `src/main.ts:446-496` — export and import commands consume the current `libraryService`.
- `src/views/library-view.ts:448-468` — Installed-row uninstall consumes the facade and explicitly refreshes.

### Outbound Dependencies

- `src/library/library-service.ts:103-118` — facade constructs cache store, record store, and installer.
- `src/library/library-service.ts:128-150` — catalog combines registry and cache-store results.
- `src/library/library-installer.ts:274-445` — install depends on path derivation, integrity, parser, graph validation, and transaction journal.
- `src/library/installed-record-store.ts:66-98` — Installed state depends on adapter enumeration, not Vault indexing.
- `src/protocol/protocol-file-resolver.ts:19-60` — runtime picker discovery depends on Vault-indexed `TFile`s.
- `src/views/inline-runner-modal.ts:136-143` — execution repeats the Vault-index requirement.

### Infrastructure Wiring

- `src/main.ts:78-90` — startup constructs the registry/service stack and runs recovery.
- `src/main.ts:304-310` — reconstruction swaps client and service references using current roots.
- `src/settings.ts:97-140` — settings callbacks are the mutable-root/registry integration boundary.
- `src/views/library-view.ts:161-213` — Vault events currently drive Installed invalidation.
- `src/library/library-installer.ts:35-45` — one module-level mutex serializes every library transaction.
- `src/library/library-installer.ts:123-150` — journal and marker ordering define the persistence commit boundary.

## Architecture Insights

- Preserve the existing dependency direction: views consume `LibraryService`; services and installer do not import views.
- Root and registry values are construction-bound in the Community Library stack. Reconstruction, rather than mutable settings injection, is the established KISS pattern.
- Marker validity is the transaction commit truth; Installed rendering and Vault indexing are separate derived states and must not be conflated with commit success.
- The existing watcher/debounce/generation pattern is appropriate for incidental invalidation, but current code already treats adapter events as insufficient for deterministic post-mutation refresh.
- Runtime selection depends on Vault identity (`TFile`), while installed records depend only on storage identity. The release seam must account for both.
- A bounded readiness barrier was selected as the canonical post-install direction. This retains the transactional storage path and avoids undocumented Obsidian internals.
- Cache corruption is represented in the service model but not distinctly rendered, creating a smaller explicit-failure-state inconsistency.
- Rebuilding the service replaces object instances but preserves wire formats and vault persistence; startup recovery remains a separate, load-only operation.

## Precedents & Lessons

4 similar change families were analyzed.

### Precedent: Community Library production hardening

**Commit(s)**: `841191a` — "feat: add slug+hash library namespaces with migration, export, and uninstall" (2026-08-14)

**Blast radius**: 18 files across 4 layers
- `src/library/` — namespace, migration, installer, record, journal, and service hardening.
- `src/main.ts` — plugin wiring.
- `src/views/` — Installed and export surfaces.
- `src/__tests__/`, `src/i18n/` — verification and bilingual strings.

**Follow-up fixes**: None in code before this research revision.

**Takeaway**: This commit is the persistence-safety foundation, but it does not establish live browse → install → run readiness.

### Precedent: Moderated Community Library foundation

**Commit(s)**: `d4eb13f` — "feat: add moderated community library" (2026-08-05)

**Blast radius**: 35 files across 6 layers
- `src/library/` — initial models, registry, stores, installer, and service.
- `src/main.ts`, `src/settings.ts` — construction and command/settings wiring.
- `src/views/`, `src/styles/` — Library view and modals.
- `src/i18n/`, `src/__tests__/` — locale and automated evidence.

**Follow-up fixes**:
- `841191a` — "feat: add slug+hash library namespaces with migration, export, and uninstall" (2026-08-14) — addressed collision, migration, recovery, export, and uninstall gaps.

**Takeaway**: A green lower-layer implementation did not settle host-level root, refresh, or indexing behavior.

### Precedent: Protocol resolver extraction and release hygiene

**Commit(s)**: `9d3cfc1` — "Dev/optimize for release (#12)" (2026-05-27)

**Blast radius**: 26 files across 6 layers
- `src/protocol/` — extracted `protocol-file-resolver.ts`.
- `src/main.ts`, `src/views/` — picker integration.
- tests, release metadata, README, and CI — release surface updates.

**Follow-up fixes**: Later README/version synchronization commits showed documentation surfaces can drift independently.

**Takeaway**: Library roots must reuse resolver normalization, and both README variants must be mapped explicitly.

### Precedent: Abandoned library lifecycle

**Commit(s)**: `2ccc66a` (2026-05-03), `4258647` (2026-05-19), `e884baf` (2026-05-21), `1e9996c` (2026-05-26), `7e2918f` and `6657b8d` (2026-06-02)

**Blast radius**: 45 unique files across 7 layers over the lifecycle.

**Follow-up fixes**:
- `9b4a886` — nested parent-folder creation (2026-05-21).
- `cb41717` — dead CSS/i18n drift (2026-05-22).
- `e14c5c1`, `fa3d478`, `d9c9487` — Unicode URL and transport behavior (2026-05-29).
- `6657b8d` — complete subsystem removal after integration failure (2026-06-02).

**Takeaway**: First-class workflow integration, nested paths, transport behavior, bilingual strings, and host-level validation are release-critical for avoiding another disconnected subsystem.

### Composite Lessons

- `d4eb13f` and `841191a` show that persistence hardening and an automated green gate do not prove live Obsidian usability.
- `9d3cfc1` establishes the canonical folder normalization and index-based discovery behavior the library must match.
- The earlier removal lifecycle shows that entry-point presence alone is insufficient; the complete user workflow and cleanup behavior must be observable.
- Adapter events should be treated as invalidation hints, not the sole success signal for Installed visibility or runtime readiness.

## Historical Context (from `.rpiv/artifacts/`)

- `.rpiv/artifacts/discover/2026-08-18_22-29-22_minimal-community-library-release.md` — current minimal-release intent and constraints.
- `.rpiv/artifacts/research/2026-08-14_15-45-02_library-readiness-and-phase2-gap.md` — previous Library readiness research.
- `.rpiv/artifacts/research/2026-08-13_09-42-22_library-production-ready.md` — prior production-readiness investigation.
- `.rpiv/artifacts/designs/2026-08-04_17-41-05_moderated-community-library.md` — original Community Library design.
- `.rpiv/artifacts/plans/2026-08-05_16-24-25_moderated-community-library.md` — original implementation plan.
- `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md` — foundation validation record.
- `.rpiv/artifacts/plans/2026-08-14_17-04-27_library-readiness-phase1-refinement-phase2-design.md` — later readiness plan.

## Developer Context

**Q (discover: Primary beneficiary): Who is currently blocked by the incomplete Community Library?**
A: Plugin maintainer.

**Q (discover: Explicit registry configuration): Keep the explicitly configured HTTPS endpoint with no bundled default?**
A: Keep explicit.

**Q (discover: Integrity-only trust boundary): Keep SHA-256 integrity without publisher authentication?**
A: Keep integrity.

**Q (discover: Transactional installation guarantees): Preserve journal-first install, rollback, and startup recovery?**
A: Keep guarantees.

**Q (discover: Narrow shipping seam): Keep command → catalog → manifest preview → install as the release seam?**
A: Keep narrow seam.

**Q (discover: Release goal): What should “finished” mean for this pass?**
A: Close blockers.

**Q (discover: Contract compatibility): How strictly should existing data and wire contracts be preserved?**
A: No migrations.

**Q (discover: Folder-setting synchronization): How should root changes reach library installs?**
A: Rebuild service.

**Q (discover: Successful-install behavior): What marks a successful install?**
A: Immediately usable.

**Q (discover: Failure-handling bar): Which failure behavior must be preserved?**
A: Preserve hardening.

**Q (discover: Verification mode): What seam-level verification should be added?**
A: Manual only, while existing automated suites and the final gate still run.

**Q (discover: Documentation languages): Which documentation surfaces must be updated?**
A: Both READMEs.

**Q (discover: Automated quality gate): Which command is final acceptance?**
A: `npm run check`.

**Q (discover: Manual validation depth): What must the Obsidian checklist demonstrate?**
A: Success and failure.

**Q (discover: Unrelated check failures): How should unrelated failures be treated?**
A: Classify them separately; do not expand feature scope, but require a green final gate.

**Q (`src/library/library-installer.ts:132-138`, `src/protocol/protocol-file-resolver.ts:19-60`): Which mechanism should make adapter-written protocols immediately usable when Obsidian exposes no public targeted refresh API?**
A: Use a bounded readiness barrier; keep transactional writes unchanged, wait for `TFile` visibility, and explicitly synchronize Installed state.

## Related Research

- `.rpiv/artifacts/research/2026-08-14_15-45-02_library-readiness-and-phase2-gap.md`
- `.rpiv/artifacts/research/2026-08-13_09-42-22_library-production-ready.md`
- `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md`

## External Sources

- [Obsidian Vault API](https://docs.obsidian.md/Reference/TypeScript+API/Vault) — public Vault creation, lookup, and event surface.
- [Obsidian API declarations](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) — `DataAdapter`, `Vault`, `Events`, and `MetadataCache` declarations; no targeted public Vault refresh/reindex method is declared.
- [Obsidian API architecture](https://github.com/obsidianmd/obsidian-api/blob/master/README.md#app-architecture) — distinguishes Vault file access from Markdown metadata caching.
- [Obsidian maintainer comment on file watchers](https://forum.obsidian.md/t/vault-cache-truncation-after-adapter-write/113139/3) — watcher events are notifications, not a file writer or refresh command.

## Open Questions

- After the marker is committed, how should a bounded readiness timeout be represented without falsely reporting a rollback or weakening the existing `InstallResult` truth? This requires design-level treatment because persisted install success and temporary index unavailability are distinct states.
