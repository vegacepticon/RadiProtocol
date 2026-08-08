---
date: 2026-08-07T09:59:04+0300
author: Roman Shulgha
commit: bf206f5
branch: main
repository: RadiProtocol
topic: "Library backend Phase 1 — deploy static registry to Cloudflare Pages + in-Obsidian verify"
tags: [intent, frd, library, backend, cloudflare-pages, registry, deploy, verify, static-registry, wire-types, parity-gate, sha256]
status: ready
last_updated: 2026-08-07T09:59:04+0300
last_updated_by: Roman Shulgha
parent: ".rpiv/artifacts/discover/2026-08-06_08-12-45_community-library-backend.md"
---

# FRD: Library Backend Phase 1 — Deploy Static Registry to Cloudflare Pages + In-Obsidian Verify

## Summary
Deploy the already-built Phase-1 static registry — the generated `site/` in the sibling backend repo `radiprotocol-library-backend/` (commit `92ee719`) — to a Cloudflare Pages free `*.pages.dev` subdomain via `wrangler pages deploy site/` direct upload, point the plugin's `libraryRegistryUrl` setting at the live origin, and verify the read/install loop end-to-end in Obsidian. This ships a live registry the built plugin client can talk to with ~zero new code (only the `.gitattributes` LF hardening from the validation recommendation), proving the loop works against a real origin before investing in the stateful Supabase build. Phase 2 (Supabase: submission/moderation/auth/immutable storage + WCAG dashboard) is deferred to a later FRD.

## Problem & Intent
The developer's framing (Step 2, verbatim):

> "All three as one flow — the real gap is the end-to-end loop: hosting + publishing + discovery/install are inseparable, and you want to stand up the whole backend so the plugin's library cluster finally has a live counterpart."

The underlying motivation is closing the loop so the library cluster has a live counterpart. Concretely, today: the plugin's library client is fully built and tested (`src/library/`, 949 tests green) but `DEFAULT_REGISTRY_URL = ''` (`src/library/registry-client.ts:17-22`) — it has no registry to talk to. A full prior plan (discover→research→design→plan→validation) already produced a Phase-1 static registry that is **code-complete** in the sibling repo but **never deployed** and **never verified in-Obsidian** — the validation's deploy-time and in-Obsidian criteria are explicitly unchecked. The sequencing decision (below) scoped THIS continuation to finishing Phase 1 (deploy + verify) first, because it is the cheapest unblock and de-risks the client against a live origin before the big stateful build; the publishing half (Phase 2 Supabase) is deferred to a later FRD. Success = a live `https://<project>.pages.dev` origin against which the plugin's `LibraryView` lists a real catalog and atomically installs a release, with no plugin source changes.

## Goals
- Make the built plugin client functional end-to-end by deploying a live registry origin it already knows how to talk to.
- Deploy the already-built Phase-1 `site/` (sibling repo `radiprotocol-library-backend/`, commit `92ee719`) to Cloudflare Pages free `*.pages.dev` subdomain via `wrangler pages deploy site/` direct upload.
- Point the plugin's `libraryRegistryUrl` setting at the live origin and verify in-Obsidian: `LibraryView` lists the seeded catalog anonymously; a release downloads and installs atomically with no missing-snippet validation error.
- Verify the live origin serves the three read routes correctly: extension-less paths via `_redirects` 200-rewrites, Cyrillic/space `packageId` round-trip, 404 for unknown releases, http→https redirect, p95 ≤ 2s.
- Keep the shipped plugin client source untouched (the backend serves the frozen read contract verbatim); keep the backend repo's automated gates green.

## Non-Goals
- Phase 2 Supabase stateful backend — submission/moderation/email-magic-link auth/immutable storage + WCAG 2.2 AA dashboard SPA — deferred to a later FRD (D-sequencing).
- Publishing/submission — a net-new backend surface; the plugin stays read-only this delivery (D-publish).
- Custom domain purchase + DNS configuration — deferred; the free `*.pages.dev` subdomain is the first live target (a custom domain can be added to the same Pages project later).
- Git-connected or CI-driven deploys — deferred; Wrangler CLI direct upload is the first deploy mechanism (manual re-run per change is acceptable for "just me for now").
- Curating real radiology protocol packages — the deterministic seed ships as-is; real-package curation is a follow-up (edit the seed + regenerate + redeploy).
- Setting the plugin's bundled `DEFAULT_REGISTRY_URL` to the live origin — deferred until the registry is official; configure via the `libraryRegistryUrl` setting instead (do not hard-code a pre-launch `*.pages.dev` URL into the shipped plugin).
- Evolving the read contract (new routes/fields, search, pagination, revocation fields) — frozen (D-read).
- ed25519 publisher signing and OAuth providers — deferred (D-auth/crypto).
- Plugin-side submission/report/revocation UI — separate client-side follow-up (inherited from prior FRD).
- Restructuring this repo or consolidating wire types into a shared package/monorepo — rejected (D-repo).

## Functional Requirements
1. The backend repo's generated `site/` SHALL be deployed to Cloudflare Pages and reachable at a stable `https://<project>.pages.dev` origin over https.
2. The deployed origin SHALL serve the three extension-less read routes via `_redirects` 200-rewrites — `GET /catalog` (a `CatalogResponse`), `GET /packages/{id}/releases/{ver}` (a `ReleaseResponse`), and `GET /packages/{id}/releases/{ver}/manifest` (a `{ manifest: PackageManifest }` wrapper) — each accepted by the plugin's `isCatalogResponse` / `isReleaseResponse` / `isPackageManifest` guards.
3. The origin SHALL URL-accept encoded non-ASCII `packageId` / `version` segments (Cyrillic `КТ-грудная-клетка`, space `chest ct`) and return a manifest whose `packageId` / `releaseVersion` match the decoded request (the plugin's `fetchRelease` / `fetchReleaseManifest` identity check).
4. The origin SHALL return 404 for an unknown package/version (served by `site/404.html`).
5. The origin SHALL reject or redirect http to https; the plugin's `normalizeRegistryUrl` (https-only) SHALL accept the configured `*.pages.dev` origin.
6. The deployed catalog SHALL be the existing deterministic seed with no content changes; the seed's releases SHALL install atomically through the plugin's foundation installer (commit under `library/<packageId>/<version>/`) with no missing-snippet validation error.
7. The plugin's `libraryRegistryUrl` setting SHALL be set to the live `https://<origin>` (via the settings UI) to enable live catalog discovery; the bundled `DEFAULT_REGISTRY_URL` SHALL remain empty.
8. The deploy SHALL be performed via `wrangler pages deploy site/` (direct upload) from the sibling backend repo; the committed `site/` SHALL be byte-identical to regenerated output (`npm run check:regen-diff` green) before deploy.
9. (Hardening) The backend repo SHALL add a `.gitattributes` pinning LF line endings (e.g. `* text=auto eol=lf`, or specifically `*.json eol=lf` / `*.ts eol=lf` / `*.mjs eol=lf`) so the regen-diff raw-`Buffer.equals` byte comparison stays robust for Windows contributors (validation recommendation, non-blocking but in-scope).

## Non-Functional Requirements
- **Performance**: Catalog and release reads SHALL complete within p95 ≤ 2 seconds under normal connectivity against the `*.pages.dev` origin (inherited FR14), measured via a 100-request load test.
- **Security**: All transport https; http rejected/redirected. Phase-1 reads are anonymous (no auth). SHA-256 integrity is verified client-side on install (corruption detection); ed25519 authenticity deferred. No `libraryRegistryUrl` is hard-coded into the shipped plugin (configured via settings); the origin is a Cloudflare-managed static host.
- **UX / Accessibility**: In-plugin `LibraryView` lists the catalog anonymously (no auth prompt); install is the existing atomic foundation flow (already built, 949 tests green). The WCAG 2.2 AA moderation dashboard is Phase 2, not this delivery.
- **Reliability**: Published releases are immutable and always servable; the catalog is available anonymously with no auth dependency. Failed network actions are retryable; pinned versions do not change silently. The `*.pages.dev` origin inherits Cloudflare Pages availability; recovery-on-load for interrupted installs is already implemented client-side.

## Constraints & Assumptions
- The backend lives in a separate sibling repo `Z:/projects/radiprotocol-library-backend/` (commit `92ee719`), git-initialized locally, **no confirmed GitHub remote**. Wire types are duplicated plugin↔backend with a cross-repo parity gate (`scripts/check-wire-parity.mjs`) (D-repo).
- The plugin repo (`RadiProtocol`, commit `bf206f5`) stays untouched; its `npm run check` must remain green (949 tests). The plugin's read contract is frozen (D-read).
- Deploy target: Cloudflare Pages free `*.pages.dev` subdomain (no domain purchase). A Cloudflare account + the Wrangler CLI are prerequisites.
- Deploy mechanism: `wrangler pages deploy site/` direct upload — manual re-run per seed/generator change; no auto-redeploy (acceptable for "just me for now").
- `site/` is produced by the deterministic generator from the seed; `site/` must be byte-identical to regenerated output (regen-diff gate) before deploy.
- The plugin's `libraryRegistryUrl` setting (`src/settings.ts:36`) is the only client configuration needed to point at the origin; `DEFAULT_REGISTRY_URL` stays empty (`src/library/registry-client.ts:17-22`).
- Assumption: the existing deterministic seed (Cyrillic + space packageIds, real SHA-256, pinned timestamps) is acceptable as the first live catalog content (D-seed).
- Assumption: the prior FRD's D1–D6 decisions remain governing for the eventual Phase 2; this FRD scopes only the Phase-1 deploy+verify slice.
- Assumption: `normalizeRegistryUrl` accepts a `*.pages.dev` https URL (it is a normal https origin; the https-only check passes).

## Acceptance Criteria
- [ ] `wrangler pages deploy site/` (run in the sibling backend repo) succeeds and the origin `https://<project>.pages.dev` is live.
- [ ] `curl -sI https://<origin>/catalog` serves a JSON content-type with 200 (extension-less `_redirects` rewrite), no 404, no redirect to a `.json` URL.
- [ ] `curl -s https://<origin>/catalog` returns a body accepted by the plugin's `isCatalogResponse` guard; `curl -s https://<origin>/packages/<id>/releases/<ver>` returns a body accepted by `isReleaseResponse` whose `manifest.packageId` / `releaseVersion` equal the request; `curl -s https://<origin>/packages/<id>/releases/<ver>/manifest` returns a `{ manifest: PackageManifest }` wrapper whose `body.manifest` passes `isPackageManifest` and matches the request identity.
- [ ] A URL-encoded Cyrillic `packageId` / `version` (e.g. `%D0%9A...`) round-trips: the returned manifest identity matches the decoded request and the plugin's `fetchRelease` / `fetchReleaseManifest` identity check passes.
- [ ] `curl -sI https://<origin>/packages/unknown/releases/9.9.9` returns 404 (served by `site/404.html`).
- [ ] `curl -sI http://<origin>/catalog` is rejected or redirected to https; `normalizeRegistryUrl('https://<origin>')` accepts the configured origin.
- [ ] Under normal connectivity, catalog fetch p95 latency ≤ 2 seconds (100-request load test against the live origin).
- [ ] With `libraryRegistryUrl` (`src/settings.ts`) set to `https://<origin>` in the plugin settings UI, opening the plugin's `LibraryView` lists the seeded catalog anonymously, with no authentication prompt.
- [ ] A release selected in `LibraryView` downloads through the plugin and installs atomically via the foundation installer (commits under `library/<packageId>/<version>/`); the installed protocol produces no missing-snippet validation error.
- [ ] The plugin repo's `npm run check` remains green (build + lint + tests + i18n + agent-docs) with no plugin source changes; the backend repo's `npm run check` (typecheck + regen-diff + wire-parity + test) exits 0.
- [ ] The backend repo has a `.gitattributes` pinning LF line endings and `npm run check:regen-diff` passes on a clean clone (hardening; validation recommendation).

## Recommended Approach
Deploy the already-generated `site/` from the sibling backend repo `radiprotocol-library-backend/` to a Cloudflare Pages free `*.pages.dev` subdomain via `wrangler pages deploy site/` (direct upload); set the plugin's `libraryRegistryUrl` setting to the live `https://<origin>` and verify the read/install loop in Obsidian (`LibraryView` lists the catalog, a release installs atomically). No plugin source changes; no new backend code beyond the `.gitattributes` LF hardening — this is a deploy + manual-verify slice, with the Phase 2 Supabase stateful backend deferred to a later FRD.

## Decisions

### Inherited baseline — frozen read contract (Pre-resolved from codebase evidence — confirmed in Step 4)
**Question**: Pre-resolved from codebase evidence — the plugin's read contract is frozen at three GET routes (`src/library/registry-client.ts:89-184`); keep frozen or evolve?
**Recommended**: Keep frozen
**Chosen**: Keep frozen
**Rationale**: evidence: `src/library/registry-client.ts:89-184` + confirmed; 949 tests green. The backend serves the 3 routes verbatim; the plugin client stays untouched.

### Inherited baseline — separate sibling repo + duplicated wire types + parity gate (Pre-resolved — confirmed)
**Question**: Pre-resolved — a separate sibling backend repo exists (`radiprotocol-library-backend` @ `92ee719`) with duplicated wire types + a cross-repo parity gate; keep or consolidate?
**Recommended**: Keep separate + parity gate
**Chosen**: Keep separate + parity gate
**Rationale**: evidence: `radiprotocol-library-backend` @ `92ee719`, `scripts/check-wire-parity.mjs` exit 0 + confirmed; plugin build untouched (prior FRD D6).

### Inherited baseline — publishing = net-new backend surface, plugin read-only (Pre-resolved — confirmed)
**Question**: Pre-resolved — the client is GET-only and the manifest's `packageId`/`releaseVersion`/`publishedAt` are server-controlled; publishing is a net-new backend surface. Keep that boundary or add plugin-side publish now?
**Recommended**: Backend-only publish for now
**Chosen**: Backend-only publish for now
**Rationale**: evidence: `src/library/registry-client.ts` (GET-only) + server-controlled manifest fields + confirmed; the plugin stays read-only this delivery.

### Inherited baseline — keep auth/crypto deferrals (Pre-resolved — confirmed)
**Question**: Pre-resolved — SHA-256 now / ed25519 deferred (`src/library/integrity.ts:5`); email magic link only / OAuth deferred (prior FRD D4/D5). Keep deferrals or pull either in?
**Recommended**: Keep deferrals
**Chosen**: Keep deferrals
**Rationale**: evidence: `src/library/integrity.ts:5` + prior FRD D4/D5 + confirmed; matches the "just me for now" intent.

### Sequencing — finish Phase 1 deploy + verify first (intent + shape)
**Question**: What should THIS continuation deliver? Phase 1 is code-complete in the sibling repo but not deployed/verified in-Obsidian; Phase 2 (Supabase stateful) is not started.
**Recommended**: Finish Phase 1: deploy + verify
**Chosen**: Finish Phase 1: deploy + verify
**Rationale**: ~zero new code; validates the built client against a live origin and de-risks before the big Supabase build; Phase 2 deferred to a later FRD; matches the prior plan's deliberate phasing (D1).

### Hosting target — free `*.pages.dev` subdomain now (scope)
**Question**: Which hosting target for the Phase-1 deploy?
**Recommended**: Free `*.pages.dev` subdomain now
**Chosen**: Free `*.pages.dev` subdomain now
**Rationale**: zero cost, no domain purchase prerequisite; matches "just me for now" + the prior FRD's "no spare domain today"; a custom domain can be added to the same Pages project later without redeploying.

### Deploy mechanism — Wrangler CLI direct upload (shape)
**Question**: How should `site/` get deployed to Cloudflare Pages?
**Recommended**: Wrangler CLI direct upload
**Chosen**: Wrangler CLI direct upload
**Rationale**: simplest one-shot, live in minutes, no GitHub remote/CI setup needed — lowest friction for a first solo deploy; manual re-run per change is acceptable for "just me for now." Optimizes speed-to-live; loses auto-redeploy (acceptable now).

### Seed content — ship the existing seed as-is (scope)
**Question**: What should the first live catalog contain?
**Recommended**: Ship the existing seed as-is
**Chosen**: Ship the existing seed as-is
**Rationale**: the deterministic seed already has real-shape packages (Cyrillic `КТ-грудная-клетка` + space `chest ct` packageIds, real SHA-256) that exercise the client's URL-encoding, identity-check, and install paths; validates the live loop with zero content work; curation is a cheap follow-up (edit seed + regenerate + redeploy).

### Bundled `DEFAULT_REGISTRY_URL` stays empty (inherited — recorded)
**Question**: Should the plugin's bundled `DEFAULT_REGISTRY_URL` be set to the live `*.pages.dev` origin?
**Recommended**: Leave empty; configure via the `libraryRegistryUrl` setting
**Chosen**: Leave empty; configure via the `libraryRegistryUrl` setting
**Rationale**: evidence: `src/library/registry-client.ts:17-22` ("Do NOT hard-code an unprovisioned domain") + prior FRD; the `*.pages.dev` origin is not yet official; configuring via the settings field (`src/settings.ts:36`) avoids baking a pre-launch URL into the shipped plugin. Consistent with the frozen-contract pre-resolution (plugin source untouched).

## Open Questions
None — all interview branches resolved in this session. Phase 2 Supabase, the custom domain, Git-connected/CI-driven deploys, and real-package curation are deferred as Non-Goals / Suggested Follow-ups (deliberate sequencing), not open questions.

## Suggested Follow-ups
- Phase 2 Supabase stateful backend — submission/moderation/email-magic-link auth/immutable storage + WCAG 2.2 AA dashboard SPA (prior FRD `.rpiv/artifacts/discover/2026-08-06_08-12-45_community-library-backend.md`, Phase 2). The next major build once Phase 1 is shipped.
- Custom domain purchase + DNS configuration — add a custom domain to the same Cloudflare Pages project and re-point `libraryRegistryUrl` (prior FRD D2/D3; `src/settings.ts:36`). Operational prerequisite for an official origin.
- Git-connected or CI-driven deploy upgrade — push the backend repo to a GitHub remote and switch from Wrangler direct upload to Cloudflare Pages build-from-repo (auto-redeploy) or a gated GitHub Action deploy; the repo already has `.github/workflows/ci.yml` (per validation artifact).
- Real-package curation — replace/augment the deterministic seed with curated radiology protocols (edit `src/seed/seed.ts` in the backend repo + regenerate + redeploy).
- Plugin-side submission / report / revocation UI — the foundation shipped browse + install only; the in-plugin submission wizard, report flow, and revocation-warning rendering are a separate client-side follow-up (prior FRD Suggested Follow-ups).
- Standalone-snippet packages — the current `PackageManifest` wraps a `ProtocolDocumentV1` (protocol-bundle-only); standalone-snippet support needs a future backward-compatible contract + client extension (prior FRD; `src/library/library-model.ts:37-63`).
- Broader manual Obsidian-side testing of the client foundation beyond the two in-Obsidian criteria in this FRD (prior FRD follow-up; validation `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md`).

## References
- Prior FRD (source of inherited D1–D6): `.rpiv/artifacts/discover/2026-08-06_08-12-45_community-library-backend.md`
- Phase-1 design: `.rpiv/artifacts/designs/2026-08-06_08-53-19_community-library-backend-phase1.md`
- Phase-1 plan: `.rpiv/artifacts/plans/2026-08-07_08-01-24_community-library-backend-phase1.md`
- Phase-1 validation (most recent; source of unchecked deploy-time + in-Obsidian criteria): `.rpiv/artifacts/validation/2026-08-07_09-09-57_community-library-backend-phase-1-static-registry-on-cloudflare-pages.md`
- Source FRD (31 inherited decisions): `.rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md`
- Read contract: `src/library/registry-client.ts` (`fetchCatalog` / `fetchRelease` / `fetchReleaseManifest`, `DEFAULT_REGISTRY_URL`, `normalizeRegistryUrl`), `src/library/registry-model.ts` (`CatalogResponse`, `ReleaseResponse`), `src/library/library-model.ts` (`PackageManifest`, `CatalogEntry`)
- Integrity: `src/library/integrity.ts` (SHA-256)
- Client config: `src/settings.ts` (`libraryRegistryUrl`)
- Backend repo: `Z:/projects/radiprotocol-library-backend/` (commit `92ee719`) — generated `site/`, parity gate `scripts/check-wire-parity.mjs`, regen-diff `scripts/check-regen-diff.mjs`, CI `.github/workflows/ci.yml`