---
date: 2026-08-18T22:29:22+0300
author: Roman Shulgha
commit: 961e45a
branch: main
repository: RadiProtocol
topic: "Minimal Community Library release"
tags: [intent, frd, community-library, registry, installation]
status: ready
last_updated: 2026-08-18T22:29:22+0300
last_updated_by: Roman Shulgha
---

# FRD: Minimal Community Library release

## Summary
Finish the existing Community Library as a minimal, supportable release for the **Plugin maintainer** by closing blockers in the explicitly configured command → catalog → manifest preview → install flow. Preserve the current contracts, transactional safety, cache and failure hardening, and adjacent working features; do not add a hosted backend, authentication, package signing, or broad UI polish.

## Problem & Intent
The person currently blocked is the **“Plugin maintainer.”** Success for this pass is to **“Close blockers”** so the existing Community Library has one reliable, documented, end-to-end flow worth shipping rather than a broad or speculative expansion.

Today the underlying registry client and transactional installer are substantial, but release readiness is undermined by same-session folder-setting drift, unproven post-install visibility/usability, omitted user setup documentation, and incomplete end-to-end validation. The work must distinguish Community Library blockers from unrelated repository issues while preserving functionality that already works.

## Goals
- Close only the blockers that prevent the narrow browse → preview → install seam from being reliable and supportable.
- Make a successful install immediately visible in the Library and selectable/runnable without reloading Obsidian.
- Preserve existing cache fallback, explicit failure states, transactional install, rollback, recovery, integrity verification, and compatible persisted/wire formats.
- Produce repeatable in-Obsidian evidence for both successful and failed flows.
- Document explicit registry setup and the user flow consistently in English and Russian.

## Non-Goals
- Provisioning or bundling a hosted registry endpoint.
- Adding authentication, authorization, publisher identity, signing, or authenticity verification.
- Migrating or redesigning catalog, release, manifest, installed-record, or on-disk path contracts.
- Expanding or redesigning import, export, or uninstall; those working features are preserved but are not equal release criteria for this pass.
- Broad Community Library UI polish or feature completeness beyond the narrow shipping seam.
- Adding seam-level automated UI tests in this pass; verification uses existing automated coverage plus a repeatable manual Obsidian checklist.
- Fixing unrelated repository failures unless they directly block or are caused by this feature.

## Functional Requirements
1. The implementation SHALL assess the current command → catalog → manifest preview → install seam and classify incomplete paths, validation failures, relevant test coverage, and documentation gaps before changing behavior.
2. The registry SHALL remain an explicitly user-configured HTTPS endpoint, with an empty bundled default and an explicit unavailable state when no usable endpoint is configured.
3. With a valid configured endpoint, the **Open community library** command SHALL present the catalog and preserve existing cache fallback, search, category filtering, and explicit unavailable behavior.
4. Selecting a catalog entry SHALL load and display its manifest trust preview, including package contents and integrity information, before installation is enabled; a missing, unavailable, malformed, or identity-mismatched manifest SHALL keep installation disabled.
5. Installation SHALL preserve current manifest/content closure checks, path safety, protocol/graph validation, SHA-256 integrity verification, namespace isolation, journal-first/marker-last commit, rollback, and startup recovery behavior.
6. Changing either the protocol folder or snippet folder setting SHALL rebuild the Community Library service using the same simple reconstruction pattern already used for registry URL changes, so subsequent installs use the current roots without an Obsidian reload.
7. A successful install SHALL deterministically update the Library’s Installed section and make the installed protocol selectable and runnable through the normal plugin flow without reloading Obsidian.
8. Network, catalog, manifest, validation, and commit failures SHALL produce explicit user-visible unavailable/failed states, SHALL not escape as uncaught errors across the registry/service boundary, and SHALL leave no partial installed package.
9. Existing import, export, and uninstall entry points and their working behavior SHALL remain available, without adding new capabilities to those flows.
10. `README.md` and `README.ru.md` SHALL document explicit HTTPS endpoint configuration, opening and browsing the Library, manifest preview and installation, installed file locations, and the distinction between integrity and authenticity.
11. The repository SHALL provide a repeatable manual Obsidian checklist using an explicitly supplied HTTPS registry that demonstrates both the successful browse → preview → install → immediate-run path and failure cases for an unavailable registry and a rejected/failed install with no partial files.
12. The implementation SHALL run `npm run check`, fix Community Library failures and regressions, classify unrelated baseline failures separately, and require the final release candidate to exit successfully.

## Non-Functional Requirements
- **Performance**: Preserve the existing one-fetch catalog refresh and client-side search/filter behavior; do not add network requests for each search or category change.
- **Security**: Require HTTPS, retain path traversal and namespace guards, verify SHA-256 content integrity before writes, and never describe unsigned packages as publisher-authenticated.
- **UX / Accessibility**: Keep explicit loading, unavailable, disabled-install, success, and failure states; successful installation must become visible and usable without a plugin reload. Preserve existing keyboard and ARIA behavior on the Library seam.
- **Reliability**: Preserve cached catalog fallback, never-throw network result unions, serialized transactional mutation, marker-last commit, rollback, and interrupted-install recovery. Invalid or failed packages must produce zero partial installation.

## Constraints & Assumptions
- The plugin remains local to an Obsidian vault; no backend, account, authentication, or cloud service is added by this feature.
- The bundled registry URL remains empty. Manual validation assumes the maintainer supplies a reachable HTTPS registry and known-good/known-bad package fixtures.
- Existing catalog, release, manifest, installed-record, and path contracts remain backward-compatible with no migrations.
- The KISS settings fix is service reconstruction after protocol/snippet root changes, following the existing registry URL precedent rather than refactoring installers to read mutable settings dynamically.
- Existing import, export, and uninstall functionality must not regress, but comprehensive expansion or validation of those adjacent flows is outside this pass.
- `npm run check` is the final automated gate. Unrelated baseline failures are not silently absorbed into feature scope; they must be identified as external blockers or follow-ups while the release candidate itself remains gated on a green command.

## Acceptance Criteria
- [ ] With no registry URL configured, running **Open community library** shows an explicit unavailable state and produces no uncaught exception.
- [ ] In Obsidian, after supplying a valid HTTPS registry URL and changing the configured protocol/snippet roots in the same session, the maintainer can open the Library, browse/search/filter the catalog, open a package, inspect its manifest preview, and start installation without reloading.
- [ ] The manifest preview visibly lists package contents and integrity information, does not claim publisher authenticity, and leaves **Install** disabled when manifest retrieval or validation fails.
- [ ] A successful manual install updates the Installed section and makes the installed protocol appear in the normal protocol selector and run successfully without reloading Obsidian.
- [ ] The repeatable manual checklist demonstrates that an unavailable registry produces the expected cached/unavailable state without an uncaught error.
- [ ] The repeatable manual checklist demonstrates that a rejected or failed package produces an explicit failure and leaves no protocol, snippet, installed marker, or unrecovered transaction residue for that attempted package.
- [ ] Existing **Import library package**, **Export protocol as library package**, and uninstall entry points remain present and usable after the change.
- [ ] `README.md` and `README.ru.md` both contain the endpoint setup, browse/preview/install workflow, installed-location explanation, and integrity-not-authenticity caveat.
- [ ] Running `npm run check` from the repository root exits with status 0; any failures encountered during the work are classified as Community Library-related or unrelated baseline issues.

## Recommended Approach
Retain the current `RegistryClient` → `LibraryService` → transactional `LibraryInstaller` layering and close only integration gaps around mutable folder settings, deterministic post-install visibility/usability, validation evidence, and documentation. Rebuild library services when storage roots change, but leave the concrete Obsidian indexing/refresh mechanism for research and design to select without changing wire or persistence contracts.

## Decisions

### Primary beneficiary
**Question**: Who is currently blocked by the incomplete Community Library, and what would a successful minimal release let them accomplish end to end?
**Recommended**: n/a — `intent` question
**Chosen**: Plugin maintainer
**Rationale**: The feature is intended to turn an existing partial implementation into a supportable release, not to introduce a new operator or publisher platform.

### Explicit registry configuration
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4: the registry is an explicitly configured HTTPS endpoint with no bundled default. Keep this behavior, or make endpoint setup part of the feature?
**Recommended**: Keep explicit
**Chosen**: Keep explicit
**Rationale**: evidence: `src/library/registry-client.ts:22`, `src/settings.ts:40-47` + confirmed; this avoids committing the plugin to an unowned hosted service.

### Integrity-only trust boundary
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4: packages are SHA-256 integrity-verified but not publisher-authenticated. Keep this boundary, or change it?
**Recommended**: Keep integrity
**Chosen**: Keep integrity
**Rationale**: evidence: `src/views/library-view.ts:25-29`, `src/library/registry-client.ts:118-143` + confirmed; authenticity infrastructure is speculative and outside the minimal release.

### Transactional installation guarantees
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4: journal-first transactional install, rollback, and startup recovery are required behaviors to preserve. Keep these guarantees, or simplify them?
**Recommended**: Keep guarantees
**Chosen**: Keep guarantees
**Rationale**: evidence: `src/main.ts:87-90`, `src/library/library-installer.ts:114-160` + confirmed; removing them would trade away already-implemented reliability.

### Narrow shipping seam
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4: focus on command → catalog → manifest preview → install while preserving but not expanding import/export/uninstall. Keep this scope, or change it?
**Recommended**: Keep narrow seam
**Chosen**: Keep narrow seam
**Rationale**: evidence: `src/main.ts:107-130`, `src/views/library-view.ts:95-150` + confirmed; it is the smallest network-backed end-to-end flow worth shipping.

### Release goal
**Question**: What should “finished” mean for this pass on the narrow browse-to-install seam?
**Recommended**: Close blockers
**Chosen**: Close blockers
**Rationale**: This directly serves the maintainer’s need for a minimal release while avoiding redesign and optional polish.

### Contract compatibility
**Question**: How strictly should this work preserve existing Community Library data and wire contracts while closing blockers?
**Recommended**: No migrations
**Chosen**: No migrations
**Rationale**: Existing packages and persisted installations should continue to work; migrations would enlarge risk and scope.

### Folder-setting synchronization
**Question**: For folder-setting changes, which tradeoff should govern keeping installs aligned with the current protocol and snippet roots?
**Recommended**: Rebuild service
**Chosen**: Rebuild service
**Rationale**: It follows the existing registry-setting reconstruction precedent at `src/settings.ts:129-140` and is simpler than refactoring the installer around mutable settings.

### Successful-install behavior
**Question**: What visible behavior must mark a successful install for the minimal end-to-end flow?
**Recommended**: Immediately usable
**Chosen**: Immediately usable
**Rationale**: Updating only files or the Library view would not complete the user flow; the installed protocol must be selectable and runnable without reload.

### Failure-handling bar
**Question**: Which failure-handling bar should the shippable browse-to-install seam meet?
**Recommended**: Preserve hardening
**Chosen**: Preserve hardening
**Rationale**: Cache fallback, explicit result states, never-throw boundaries, and zero partial writes are existing value and essential release safeguards.

### Verification mode
**Question**: What verification evidence should be required before calling the Community Library shippable?
**Recommended**: Tests plus Obsidian
**Chosen**: Manual only
**Rationale**: The developer chose repeatable host-level validation over adding seam-level automated tests in this pass; existing automated suites and the final repository gate still run.

### Documentation languages
**Question**: How much user documentation belongs in this minimal release?
**Recommended**: Both READMEs
**Chosen**: Both READMEs
**Rationale**: English and Russian are both supported project documentation surfaces and must remain consistent.

### Automated quality gate
**Question**: Which repository command should be the final automated acceptance gate?
**Recommended**: `npm run check`
**Chosen**: `npm run check`
**Rationale**: It covers build, lint, tests, planning freshness, consistency, and agent-document checks, protecting adjacent working functionality.

### Manual validation depth
**Question**: What must the repeatable in-Obsidian checklist demonstrate, given the choice not to add seam-level automated tests?
**Recommended**: Success and failure
**Chosen**: Success and failure
**Rationale**: A happy path alone would not prove the selected hardening and no-partial-write reliability bar.

### Unrelated check failures
**Question**: If `npm run check` exposes failures outside the Community Library seam, how should this feature treat them?
**Recommended**: Library-related only
**Chosen**: Library-related only
**Rationale**: Unrelated cleanup does not trace to this feature’s intent; such failures must be classified rather than silently expanding scope.

## Open Questions

None — the developer did not explicitly defer any interview decision.

## Suggested Follow-ups
- Add behavioral automated coverage for `LibraryView` → `LibraryItemDetailModal` → `LibraryInstallProgressModal`; this pass deliberately chose manual seam validation, and the existing view test is limited to uninstall wiring (`src/__tests__/views/library-view-uninstall.test.ts:1-31`).
- Investigate and portable-test non-ASCII/space package IDs through real Obsidian `requestUrl`; prior research reports possible platform-specific double encoding (`.rpiv/artifacts/research/2026-08-14_15-45-02_library-readiness-and-phase2-gap.md:154-155`).
- Broaden release criteria for import, export, and uninstall only after the narrow browse-to-install seam ships; those commands remain present at `src/main.ts:116-130`.

## References
- Feature input: “Finish the existing Community Library as a minimal, reliable KISS implementation. Assess current code, incomplete paths, validation failures, tests, and documentation. Preserve working functionality, avoid speculative backend/auth features, and identify the smallest end-to-end user flow worth shipping.”
- `src/main.ts`
- `src/settings.ts`
- `src/views/library-view.ts`
- `src/library/registry-client.ts`
- `README.md`
- `.rpiv/artifacts/research/2026-08-14_15-45-02_library-readiness-and-phase2-gap.md`
- `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md`
