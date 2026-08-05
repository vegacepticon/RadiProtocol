---
template_version: 1
date: 2026-08-05T19:24:00+0300
author: Roman Shulgha
commit: 4ad002c
branch: main
repository: RadiProtocol
topic: "Validation of Moderated community library — foundation (read + install)"
status: ready
verdict: pass
parent: ".rpiv/artifacts/plans/2026-08-05_16-24-25_moderated-community-library.md"
tags: [validation, library, installer, registry, transactional, cache, integrity, i18n]
last_updated: 2026-08-05T19:24:00+0300
---

## Validation Report: Moderated community library — foundation (read + install)

### Implementation Status

- ✓ Phase 1: Pure model + paths + integrity — Fully implemented (`src/library/library-model.ts`, `library-paths.ts`, `integrity.ts` + 3 test files). Zero Obsidian imports in the pure modules (grep confirms 0).
- ✓ Phase 2: Registry client + API types + network mock — Fully implemented (`registry-model.ts`, `registry-client.ts`, `__mocks__/obsidian.ts` requestUrl stub, `registry-client.test.ts`). 2xx status gate + manifest identity check present in both fetches (C1/C2); `fetchReleaseManifest` manifest-only endpoint present (C8).
- ✓ Phase 3: Cache + installed-record stores — Fully implemented (`library-json-io.ts`, `library-cache-store.ts`, `installed-record-store.ts` + 2 test files). `writeJsonFile` wraps failures as `LibraryStoreError('write-failed')` (C3).
- ✓ Phase 4: Transaction journal + transactional installer — Fully implemented (`transaction-journal.ts`, `library-installer.ts` + test file). Marker written LAST (journal entry order + commit order both verified); `removeOwnedPaths` returns boolean + takes expected namespaces (C4/C5/C6); `rollbackTransaction` preserves journal on incomplete removal; `uninstall` derives paths from the record and returns `failed` when deletion is incomplete.
- ✓ Phase 5: Library service facade — Fully implemented (`library-service.ts` + test file). `CatalogListResult.cacheError` + `console.warn` on throw-safe defaults (C7); `getReleaseManifest` uses the manifest-only `fetchReleaseManifest` (C8).
- ✓ Phase 6: LibraryView ItemView + i18n library.* block — Fully implemented (`library-view.ts` shell, `main.ts` forward-declares `libraryService!`, en/ru `library.*` block, `src/styles/library.css` + esbuild CSS_FILES registration). Phase 6 shell correctly omits modal imports (B3 split).
- ✓ Phase 7: Item detail + install progress modals — Fully implemented (`library-item-detail-modal.ts`, `library-install-progress-modal.ts`, `library-view.ts` MODIFY re-adds `openDetail`/`openInstall`). ARIA progressbar + exhaustive `_exhaustive: never` dispatch + keyboard activation present.
- ✓ Phase 8: Existing-views integration (read-only for managed items) — Fully implemented (`tree-renderer.ts`, `snippet-manager-view.ts`, `protocol-editor-view.ts`, `protocol-picker-modal.ts`). `findInstalledRecordForPath` in `library-paths.ts`; `libraryReadOnly` flag + `bindConnectionDrag` silent guard (C10); `installedRecords` generation-guarded in the snippet-manager model; component-level `libraryContext` in pickers.
- ✓ Phase 9: main.ts wiring + settings + parity gate — Fully implemented (`main.ts`, `settings.ts`, `scripts/check-consistency.mjs`, en/ru `settings.*` keys). `registerView` + `open-community-library` command + recovery-on-load + `rebuildLibraryServices` (C12) + normalized roots at all 3 picker sites (C11) + en/ru i18n key parity gate (Check 7, 329 keys match).

### Automated Verification Results

- ✓ Type checking + build: `npm run build` — tsc -noEmit + esbuild production bundle succeed, no errors.
- ✓ Tests: `npm test` — 69 test files, 949/949 tests pass (includes the 8 new `src/__tests__/library/` suites).
- ✓ Lint: `npm run lint` — ESLint + Stylelint clean (max-warnings 0).
- ✓ Whole-repo check: `npm run check` — passes (build + lint + tests + planning freshness + consistency + agent-docs). Check 7 (en/ru i18n key parity) reports 329 keys match. The single "PASSED with 1 warning(s)" line is the Knip advisory skip (non-blocking, pre-existing).
- ✓ No regressions detected — pre-existing test count and suites remain green.

Per-phase grep-based automated criteria (all pass):

- ✓ Phase 1: pure modules have zero `from 'obsidian'` imports (0/0/0).
- ✓ Phase 6: no `trusted` in `library-view.ts`; `CatalogListResult` imported from `../library/library-service`; `LIBRARY_INSTALLED_DIR` referenced 3× (constant + 2 `shouldHandle` refs); `listCatalog` called only inside `refresh()`; en/ru `library.*` key sets identical (exit 0).
- ✓ Phase 7: no `trusted` in the two modals; ARIA `role=progressbar` present; `aria-valuemin/max/now/label` matches = 10 (≥4); `_exhaustive: never` present; `tabindex` + `keydown` in `renderCatalogEntry`; no `registryClient` import in views; no `this.refresh` inside `openInstall`.
- ✓ Phase 8: `findInstalledRecordForPath` in `library-paths.ts`; `isLibraryManagedPath` across the 4 integration files = 10 (≥4); `libraryReadOnly` in editor = 8 (≥5); `this.libraryReadOnly` = 7 (≥4); `installedRecords` in `snippet-manager-view.ts` = 8 (≥5); `libraryContext` in `protocol-picker-modal.ts` = 8 (≥4); no `trusted` in integration files.
- ✓ Phase 9: `registerView(LIBRARY_VIEW_TYPE` present; `'open-community-library'` command present; services wired = 4 matches (≥2); `recoverInterruptedInstalls` in `main.ts`; `buildLibraryPickerContext|libraryContext` = 7 (≥4); `normalizeProtocolFolderPath(this.settings.protocolFolderPath)` = 5 (≥3); `libraryRegistryUrl` in `settings.ts` = 7 (≥3); parity gate `i18n key parity|flatKeys` = 5 (≥2); settings.* 4-key parity exit 0; no `trusted` in `main.ts`/`settings.ts`/`check-consistency.mjs`.

### Code Review Findings

#### Matches Plan:

- `src/library/library-installer.ts:321-322` — journal entries push protocol (`owned`) then marker (`marker`) LAST, matching the D7/D15 commit-signal invariant.
- `src/library/library-installer.ts` commit block — commit order is snippet writes → `writeJsonFile(protocolPath)` → `writeJsonFile(markerPath)` (marker LAST), matching the plan's stage→verify→commit→rollback contract.
- `src/library/library-installer.ts:364` `isMarkerCommitted` + recovery branches (`committed.push` / `rollbackTransaction` / `rolledBack.push`) — recovery-on-load finalizes in-flight journals per the plan.
- `src/library/registry-client.ts:95,131,165` — 2xx status gate before body validation in all three fetch methods (C1); `release identity mismatch` checks in `fetchRelease` and `fetchReleaseManifest` (C2).
- `src/library/library-service.ts:181` — `getReleaseManifest` calls `fetchReleaseManifest` (manifest-only, no snippet bytes shipped to the preview — C8).
- `src/library/library-installer.ts:387-400` — `uninstall` derives `protoNs`/`snipNs`/paths from `record.protocolPath`/`record.snippetNamespace` (not current settings — C6) and returns `failed` when `!allRemoved` (C5).
- `src/views/protocol-editor-view.ts:1473-1480` — `bindConnectionDrag` has a silent `if (this.libraryReadOnly) return;` guard at gesture start (C10).
- `src/main.ts:287-292` — `rebuildLibraryServices` recreates the registry client + service with normalized roots (C11/C12); `src/settings.ts:140` calls it on `libraryRegistryUrl` change.
- `src/__tests__/settings-tab.test.ts:83` — `expect(textComponents).toHaveLength(3)` (Reconciliation 1 applied).
- `src/__tests__/library/library-paths.test.ts` — `LIBRARY_SUBROOT` removed from imports (Reconciliation 2 applied).
- `esbuild.config.mjs:41` — `'library'` registered in `CSS_FILES`; bundled `styles.css` contains 14 library class matches.

#### Deviations from Plan:

- `esbuild.config.mjs:41` — the plan's Phase 6 §5 pseudocode showed adding `'src/styles/library.css'` to `CSS_FILES`, but the implementer added the bare name `'library'` instead. This is the correct application: the existing `CSS_FILES` convention uses bare names (`'_utilities'`, `'snippet-manager'`, …) that the `cssPlugin` resolves to `src/styles/<name>.css`. The literal pseudocode would have broken the concat. Acceptable adaptation, not a gap — the build bundles the stylesheet correctly (verified in `styles.css`).

Otherwise the implementation is a faithful realization of the plan, including all 16 Step-4 reviewer findings (3 blockers + 12 concerns + 1 suggestion) triaged `applied (plan-local)` and the two manual reconciliation directives.

#### Pattern Conformance:

- ✓ New `src/library/` layer mirrors `src/snippets/` (pure model + Obsidian-touching services, constructor-injected `Translator` defaulting to `defaultT`, `WriteMutex` + `ensureFolderPath` + pretty-JSON dialect).
- ✓ Test structure mirrors source (`src/__tests__/library/`), uses `makeVault()`/`makeApp()` mock factory + `vi.fn()` host spies per the project test conventions; in-memory `adapter.list` derived one-level to match the real non-recursive contract.
- ✓ i18n keys follow `componentName.stringName` (`library.*`, `settings.libraryRegistryUrl*`); user-authored content (package titles, author names, categories) not wrapped in `t()`; en/ru parity enforced by the new Check 7 gate.
- Minor observation: `safeErrorMessage` is duplicated in `registry-client.ts` and `library-json-io.ts`. Acceptable variation — the registry client is Obsidian-external (network) and the json-io helper is vault-internal; keeping them independent avoids a cross-concern import. Not a deviation.

### Manual Testing Required:

The plan's automated criteria are all marked `- [x]` and verified. The manual criteria (marked `- [ ]` in the plan) require running the plugin inside Obsidian against a provisioned registry and are reproduced here for user verification:

1. Library view end-to-end:
   - [ ] Command palette shows "Open community library"; `LibraryView` opens as a first-class sidebar view with catalog list + search + category filter.
   - [ ] Search and category filter re-filter the loaded catalog instantly without a network fetch; the category dropdown lists all categories from the unfiltered catalog (an active filter does not strand the dropdown).
   - [ ] Installed list shows installed packages with version + integrity-verified indicator (never an authenticity claim).
   - [ ] Catalog-unavailable state shows an explicit banner (cached list when a cached snapshot exists; reason-only when no cache).

2. Trust preview + install:
   - [ ] Item detail modal shows author, version, file list + SHA-256 hashes, integrity framing; Install button is disabled until the manifest loads and stays disabled on manifest failure.
   - [ ] Install progress modal renders exhaustive state dispatch + ARIA progressbar (indeterminate during installing, 100% on complete, 0% on failed).
   - [ ] An install against a provisioned registry commits atomically; the protocol+snippets land under `library/<packageId>/<version>/` and are immediately selectable/runnable.

3. Interrupted-install recovery:
   - [ ] Simulate an interrupt (kill Obsidian mid-install); reload; the journal-without-marker is rolled back and the vault is clean.

4. Read-only integration:
   - [ ] Library-managed snippets render read-only in `SnippetManagerView` (no edit/delete/move; installed-package badge; drop-into-library forbidden).
   - [ ] Library-managed protocols render read-only in the protocol editor (banner; create/delete/connect/drag/resize/auto-layout/self-check/edge-edit/viewport-persist blocked; pan/zoom work locally but do not persist).
   - [ ] Protocol picker suggestions show the installed-package indicator badge at all 3 picker entry points, including when the protocol folder setting has a trailing slash or backslash.

5. Settings + parity gate:
   - [ ] Advanced settings exposes `libraryRegistryUrl`; empty/invalid/non-https → "catalog unavailable" banner, no crash.
   - [ ] Temporarily remove a RU `library.*` key; `npm run check` fails (parity gate).

### Recommendations:

- Ready to commit — implementation is complete and validated. All automated verification passes (build, 949/949 tests, lint, `npm run check`); all 9 phases' grep-based criteria pass; all 16 Step-4 reviewer fixes and both reconciliation directives are present in the code; the load-bearing transactional invariants (marker-LAST commit, recovery-on-load) are correctly implemented.
- The Knip advisory warning in `npm run check` is pre-existing and non-blocking (advisory skip, not a failure) — no action required for this feature.
- Manual Obsidian-side testing (above) remains pending and should be performed before release; it cannot be exercised in this terminal-only validation run.