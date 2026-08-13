---
date: 2026-08-13T09:07:46+0300
author: Roman Shulgha
commit: bdd06f9
branch: main
repository: RadiProtocol
topic: "Library production-ready: install slug-collision fix, snippet package publish/export, uninstall UI, recovery hardening"
tags: [intent, frd, library, library-installer, library-paths, registry-client, library-service, transaction-journal, snippets, snippet-service, library-view]
status: ready
last_updated: 2026-08-13T09:07:46+0300
last_updated_by: Roman Shulgha
---

# FRD: Library production-ready — install collision fix, snippet package publish, uninstall UI, recovery hardening

## Summary
Bring the community-library prototype to production-ready by (1) fixing the "Chest CT (space id)" install failure — a slug collision where two distinct opaque packageIds collapse to one destination folder — by keying install destinations on `slug + shortHash(rawPackageId)` with a one-time migration of already-installed packages; (2) adding a local package authoring/export path so a maintainer can build a protocol+snippets bundle for manual registry submission (no hosted backend required); (3) wiring the existing uninstall service into the library UI; and (4) hardening install recovery to clean orphaned destination files and replacing the misleading "destination occupied (prior incomplete install)" error with messages that distinguish collision vs dirty-slot.

## Problem & Intent
The maintainer (Roman) is bringing the library prototype to production and wants to understand where development left off, fix the known gaps, and estimate remaining scope. In the maintainer's own words:

> "Let's continue developing the snippets/protocols library and bring the working prototype to a production-ready state. … File integration: Currently, when the library is installed, all files are copied except for Ct space. We need to identify and fix the issue preventing Ct space from being installed. Snippet CRUD: We need to implement the missing functionality for editing and uploading (creating) snippets in the library. We need to estimate the scope of the remaining work and continue development."

On probing the install bug, the maintainer clarified the actual repro:

> "There are currently three files available for download in the library: 1. Chest CT Protocol — downloads successfully. 2. КТ грудной клетки — downloads successfully. 3. Chest CT (space id) — does not download. I want to understand why item 3 cannot be downloaded and fix the issue. When I try to download it, I get the following error: 'destination occupied (prior incomplete install)'."

So "Ct space" is a *package* (one of three in the library), not a file inside a package; the failure is a package-level install refusal, not a silent file drop. The maintainer's success bar: scope known and the gaps closed for a production ship.

## Goals
- Fix the "Chest CT (space id)" install failure so all three library packages install and coexist, and no future pair of distinct packageIds can wedge each other.
- Add a local package authoring/export path: a maintainer can build a protocol + its referenced snippets into a manifest+contents bundle (SHA-256-hashed) and export it for manual registry submission, with no hosted backend.
- Wire the existing uninstall service to the library UI (Uninstall button on installed records, with confirm + refresh).
- Harden install recovery to detect/clean orphaned destination files (dirty slots with no journal) and replace the misleading "destination occupied" error with distinct collision-vs-dirty-slot messaging + correct remedies.
- Produce a clear scope estimate for the remaining library production work (this FRD's Goals/Non-Goals/FRs + Recommended Approach).

## Non-Goals
- Hosted registry backend — deferred (empty default registry URL; `.rpiv/guidance/src/library/architecture.md`).
- Write-transport / remote upload (POST/PUT to a registry URL) — deferred; publish is local export only this round.
- Standalone-snippet publishing (snippet-only packages without a protocol) — the uploadable unit is a full package; standalone is a follow-up.
- New vault snippet create/edit UI — already implemented (`src/snippets/snippet-service.ts:251`, `src/views/snippet-editor-modal.ts:92`); reused as-is.
- ed25519 publisher authenticity — deferred (`.rpiv/guidance/src/library/architecture.md`).
- Editing/deleting library-managed snippets in the vault — intentionally read-only by design (`isLibraryManagedSnippetPath` guards); not a gap.

## Functional Requirements
1. The installer SHALL key each install destination folder by `slug(rawPackageId) + '-' + shortHash(rawPackageId)` (e.g. `library/chest-ct-protocol-a1b2c3/`) so two distinct packageIds that slugify identically occupy distinct folders and coexist. `slugifyLabel` itself stays unchanged (it's shared with snippet-folder slug usage).
2. The installer SHALL migrate already-installed packages from the legacy slug-only path scheme to the new slug+hash scheme (on plugin load / first install), moving their protocol + snippet files and updating their marker records, preserving installed identity; migration is atomic per package (rollback-safe).
3. The installer preflight (`src/library/library-installer.ts:199-211`) SHALL distinguish two cases when destination files exist with no valid marker: (a) **slug collision** with another installed package — surface "slug collision: package X and Y map to the same folder"; (b) **dirty slot** from an interrupted install — surface "incomplete install of X — run recovery".
4. Recovery (`recoverInterrupted()`, `src/library/library-installer.ts:148-175`) SHALL scan destination folders — not only journal files (`transaction-journal.ts:108-113` enumerates only `.radiprotocol/library/transactions/`) — for orphaned files with no valid marker, and clean them (remove owned paths) so a dirty slot with no journal is recoverable.
5. The publish path SHALL provide a local package builder that collects a protocol document + all its referenced snippet files, computes SHA-256 integrity hashes, and assembles a bundle in the registry's expected shape (`{ manifest, snippetContents }`, `src/library/registry-model.ts:13-16`).
6. The publish path SHALL export the assembled bundle to a file (or folder) in the vault/filesystem for manual submission to a registry, without requiring a configured registry URL.
7. The publish path SHALL validate at authoring time that the package's raw packageId is non-empty and slugifies to a non-empty slug, and SHALL warn/reject if its slug collides with an already-installed package's slug (defense at the source, complementing the install-side slug+hash fix).
8. The library view SHALL render an Uninstall button on each installed record (`src/views/library-view.ts:391`) that, after a confirm modal, calls `libraryService.uninstall()` (`src/library/library-service.ts:141`) and refreshes the installed list.
9. Uninstall SHALL use a confirm modal matching the existing snippet-delete confirm pattern (`src/views/snippet-manager-view.ts:533`) before removing files.
10. All new/changed behavior SHALL be covered by Vitest tests in `src/__tests__/library/`, including: slug+hash path scheme; migration of a legacy install; collision-vs-dirty-slot error distinction; recovery cleaning an orphaned destination (no journal); and a package build/export round-trip (built bundle re-parses + re-validates + re-installs).

## Non-Functional Requirements
- **Performance**: Install/migration of a handful of packages (each a protocol + a few snippets) completes well under a second; recovery's destination-folder scan is bounded by the library subfolder size (small).
- **Security**: SHA-256 integrity of exported package contents preserved; no authenticity (ed25519) — deferred. Exported bundles contain only the author's own content; no telemetry/cloud. Path-safety (`assertNoTraversal`, `src/library/library-paths.ts:79-90`) must remain enforced for the new slug+hash paths.
- **UX / Accessibility**: The Uninstall button is keyboard-reachable and confirmed via a modal; error messages are plain-language and actionable (name the colliding package or the recovery action), replacing the opaque "destination occupied (prior incomplete install)". i18n: new user-facing strings added to BOTH `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`; the existing "destination occupied" literal is currently hard-coded English (`library-installer.ts:199-211`) and SHALL be i18n'd as part of the error refactor.
- **Reliability**: The install remains transactional (plan→journal→commit→rollback); migration is atomic per package; recovery never deletes a valid installed package's files (identity check before removal — `readMarker` identity match at `library-installer.ts:349-359`).

## Constraints & Assumptions
- **Technical**: Obsidian plugin, TypeScript + esbuild + Vitest; pure/Obsidian split per NFR-01 (installer/recovery/views are Obsidian-layer; path/slug helpers + bundle assembly are pure). Registry URL is user-configured, empty default; no hosted backend assumed reachable.
- **Technical**: The lossy slugifier `slugifyLabel` (`src/snippets/snippet-model.ts:126-132`) is non-injective by design (`src/library/library-paths.ts:27-28`); the fix keys destinations on slug+hash rather than changing `slugifyLabel` globally (avoids breaking snippet-folder slug usage elsewhere).
- **Assumption**: The three reported packages have distinct opaque packageIds that collide only *after* slugification — confirmed by the maintainer's "consistent, order-dependent" repro; the three *title* strings slugify distinctly (`chest-ct-protocol`, `кт-грудной-клетки`, `chest-ct-space-id`), so the collision is on the opaque packageIds, not the titles. Research should verify against real packageId values if a registry fixture becomes available.
- **Assumption**: A one-time migration of already-installed packages is acceptable (accepted in D7/D10).
- **Schedule**: Multi-thread production-readiness round; scope is "core + production hardening" (D10).

## Acceptance Criteria
- [ ] Installing "Chest CT (space id)" after "Chest CT Protocol" is already installed succeeds — both coexist in distinct `slug+hash` folders — verified by a Vitest test using two packageIds that slugify identically.
- [ ] `npm test` exits 0 with new tests for: slug+hash path scheme; legacy-install migration; collision-vs-dirty-slot error distinction; recovery cleaning an orphaned destination (no journal); package build/export round-trip.
- [ ] After migrating a vault with a legacy slug-only installed package, the package's files appear under the new `slug+hash` path and its marker resolves as installed (test seeds a legacy install and asserts post-migration state).
- [ ] A dirty slot (destination files, no marker, no journal) is cleaned by `recoverInterrupted()` so a subsequent install of that package succeeds (test seeds the orphan and asserts recovery removes it).
- [ ] The preflight returns a "slug collision" message (naming both packageIds) when destination files belong to a different packageId, and an "incomplete install — run recovery" message for a dirty slot — asserted by two distinct tests.
- [ ] A maintainer can open the package authoring/export modal, select a protocol, and export a bundle whose `manifest` + `snippetContents` round-trip through the installer's parser/validator (build → export → re-install succeeds in a test).
- [ ] The library view shows an Uninstall button on each installed record; clicking shows a confirm modal, then on confirm removes the package files and the record disappears from the installed list (test asserts the button calls `libraryService.uninstall` and the view refreshes).
- [ ] `npm run check` (build + lint + tests + planning + consistency + agent-docs) exits 0.
- [ ] New user-facing strings (error messages, Uninstall button/confirm, export modal labels) are present in BOTH `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`.
- [ ] `npm run check:release` (adds css-classes + i18n audit) passes if UI/CSS changes are made.

## Recommended Approach
In `src/library/library-paths.ts`, change the destination namespace to `slug(rawPackageId) + '-' + shortHash(rawPackageId)` (keep `slugifyLabel` unchanged); add a one-time legacy-path migration in the installer/recovery path; in `src/library/library-installer.ts:199-211` split the preflight into collision-vs-dirty-slot branches with distinct i18n messages; extend `recoverInterrupted()` (`:148-175`) to scan destination folders for orphaned files (not only `journalIO.listAll()` at `:155`); add a local package builder + export service method in `src/library/library-service.ts` (mirroring the `src/library/registry-model.ts:13-16` bundle shape) with an authoring/export modal in `src/views/` alongside `library-item-detail-modal.ts`; wire an Uninstall button into `renderInstalledRecord` (`src/views/library-view.ts:391`) calling the existing `libraryService.uninstall()`.

## Decisions

### Decision 1 — Primary intent: maintainer ship-to-production
**Question**: (Step 2 intent) When the library reaches production-ready, whose workflow is the primary one being fixed, and what does a working state let them do that they can't do today?
**Recommended**: n/a — intent question.
**Chosen**: Maintainer (you) — ship the library feature reliably; today the prototype has known gaps blocking release; success = scope known and gaps closed for a production ship.
**Rationale**: Developer's own framing; established the maintainer-vs-end-user-vs-author scope that shaped the probe.

### Decision 2 — Vault snippet edit is already implemented (reuse, no new edit build)
**Question**: Pre-resolution A — vault snippet create AND edit are already fully implemented (`src/snippets/snippet-service.ts:251`; `src/views/snippet-editor-modal.ts:92`). Keep (reuse, no new edit work) or is the existing edit broken/incomplete?
**Recommended**: Keep — reuse existing editor.
**Chosen**: Keep — reuse existing editor.
**Rationale**: evidence: src/snippets/snippet-service.ts:251 + src/views/snippet-editor-modal.ts:92 + confirmed. "Editing snippets" is not missing work.

### Decision 3 — Publish path is a real, large build; backend stays future
**Question**: Pre-resolution B — no upload/publish path at any layer; registry client GET-only (`src/library/registry-client.ts:89-161`); backend deferred. Keep (build publish path, backend future) or narrow/defer?
**Recommended**: Keep — build publish path.
**Chosen**: Keep — build publish path.
**Rationale**: evidence: src/library/registry-client.ts:89-161 + .rpiv/guidance/src/library/architecture.md + confirmed. Establishes the publish thread as in-scope with the hosted backend deferred.

### Decision 4 — Uninstall UI wiring in scope
**Question**: Pre-resolution C — uninstall service+installer exist (`src/library/library-service.ts:141`) but no UI wiring (`src/views/library-view.ts:391` renders no button). Include in scope or defer?
**Recommended**: Keep — wire uninstall UI.
**Chosen**: Keep — wire uninstall UI.
**Rationale**: evidence: src/library/library-service.ts:141 + src/views/library-view.ts:391 + confirmed. Small, self-contained production gap.

### Decision 5 — "Ct space" is a package, not a file; symptom is install failure (not a silent drop)
**Question**: What is "Ct space" — a subfolder .md snippet, a .md-template, or a direct top-level .md snippet?
**Recommended**: A .md snippet inside a subfolder (first probe's strongest hypothesis H1).
**Chosen**: (Correction) "Ct space" is the "Chest CT (space id)" *package* — it fails to install with "destination occupied (prior incomplete install)"; two of three library packages install, the third fails.
**Rationale**: Developer's repro corrected the premise: this is a package-level install refusal, not a file-level silent drop. Triggered a re-probe of the collision/recovery/slug seam (the first probe's H1/H2/H3 file-copy hypotheses do not apply).

### Decision 6 — Root cause: slug collision on opaque packageIds (consistent, order-dependent)
**Question**: Repro pattern — consistent/order-dependent (slug collision) or one-time stuck after an interrupt (dirty slot)?
**Recommended**: Consistent / order-dependent.
**Chosen**: Consistent / order-dependent.
**Rationale**: evidence: src/library/library-installer.ts:199-211 preflight + src/library/library-paths.ts:27-28 (lossy slugifier, non-injective by design) + confirmed. Two distinct opaque packageIds collapse to one destination folder; the third sees the first's files with a mismatched marker (`readMarker` identity check at `:349-359`). The three *title* slugs are distinct, so the collision is on the opaque packageIds.

### Decision 7 — Fix: slug + short hash of raw packageId (coexistence + migration)
**Question**: How should the plugin handle the collision so "Chest CT (space id)" can install alongside the other package — detect+surface, non-lossy keying, or slug+hash?
**Recommended**: Slug + short hash.
**Chosen**: Slug + short hash (e.g. `library/chest-ct-protocol-a1b2c3/`).
**Rationale**: Optimizes readable paths + collision-resistance + coexistence; less invasive than non-lossy raw-id keying (which loses readable folder names and breaks the documented slug-folder design). Costs a path-scheme change + one-time migration of already-installed packages. Detect-only would not let "Ct space" install.

### Decision 8 — Publish shape: local package builder + export (no write-transport)
**Question**: What does "upload" look like now — local package builder+export, write-transport client (POST/PUT), or both?
**Recommended**: Local package builder + export.
**Chosen**: Local package builder + export.
**Rationale**: Shippable + testable now with no backend; packaging logic reuses for a future write-transport. Write-transport would be inert UI until a backend exists (empty default URL). evidence: src/library/registry-model.ts:13-16 + src/library/library-installer.ts:309-323.

### Decision 9 — Uploadable unit: full package (protocol + snippets)
**Question**: Uploadable unit — full package (protocol + snippets) or standalone snippets?
**Recommended**: Full package: protocol + snippets.
**Chosen**: Full package: protocol + its referenced snippets.
**Rationale**: Matches the bundle model the installer consumes (src/library/registry-model.ts:13-16); maximal reuse, no new bundle concept. Standalone snippets would need a new protocol-less bundle shape the installer doesn't support (src/library/library-installer.ts:237-240 parses a protocol).

### Decision 10 — Scope bar: core + production hardening
**Question**: Production-ready bar — core threads only, core + production hardening, or core + error messaging only?
**Recommended**: Core + production hardening.
**Chosen**: Core + production hardening (recovery hardening + error-messaging refactor in scope).
**Rationale**: Developer's bar is production-ready; the recovery blind spot (src/library/library-installer.ts:155 + src/library/transaction-journal.ts:108-113 — recovery enumerates only journals, never destination folders) is a latent defect on the same seam that causes the same "destination occupied" error the maintainer hit, and the misleading message lumps collision + dirty-slot. True production-ready requires the hardening.

## Open Questions
None explicitly deferred — every branch resolved with a Decision. The one item most worth `research` verifying: the **opaque-packageId collision assumption** (Constraints) — confirm the real packageId values for the three library packages actually collapse post-slugification, if a registry fixture or catalog response becomes available.

## Suggested Follow-ups
- Write-transport / remote upload (POST/PUT to a configurable registry URL) — deferred; registry client is GET-only (`src/library/registry-client.ts:89-161`) and the backend is future. The local export's packaging logic is the reuse seam for this.
- Standalone-snippet publishing (snippet-only packages without a protocol) — the uploadable unit is a full package this round; a protocol-less bundle shape would be a new concept (`src/library/library-installer.ts:237-240`).
- Hosted registry backend + ed25519 publisher authenticity — both deferred per `.rpiv/guidance/src/library/architecture.md` (empty default registry URL; signature verification future).
- Registry-side enforcement of non-colliding packageIds — the plugin defends via slug+hash (D7) and authoring-time collision warning (FR-7), but the registry should also assign ids that slugify distinctly; out of scope (no backend).
- Subfolder silent-drop seam — `src/library/library-installer.ts:257-264` (1g-bis closure requires only ≥1 descendant) + `src/graph/graph-validator.ts:140-141` (D-04 probe skips subfolderPath-only nodes). A subfolder-referenced file omitted from `manifest.snippetFiles` installs `ok` but is missing at runtime. Latent defect from the first probe; NOT the confirmed root cause (the real bug is the slug collision).
- `.md`-only install gate — `src/library/library-installer.ts:217`; non-`.md` ancillary files (e.g. `.md-template`) have no install slot. NOT the confirmed root cause.

## References
- Input: free-text feature description (discover skill input, 2026-08-13).
- `.rpiv/guidance/src/library/architecture.md`
- `.rpiv/guidance/src/snippets/architecture.md`
- `.rpiv/guidance/src/protocol/architecture.md`
- Key source: `src/library/library-installer.ts`, `src/library/library-paths.ts`, `src/library/library-service.ts`, `src/library/registry-client.ts`, `src/library/transaction-journal.ts`, `src/library/registry-model.ts`, `src/library/installed-record-store.ts`, `src/snippets/snippet-service.ts`, `src/snippets/snippet-model.ts`, `src/views/snippet-editor-modal.ts`, `src/views/library-view.ts`, `src/views/library-item-detail-modal.ts`, `src/graph/graph-validator.ts`.