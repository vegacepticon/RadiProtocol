---
date: 2026-08-05T22:45:38+0300
author: Roman Shulgha
commit: 4c680bd
branch: main
repository: RadiProtocol
topic: "Community Library backend — discover FRD (interview in progress)"
tags: [discover, frd, library, backend, supabase, cloudflare-pages, hosting]
status: in_progress
last_updated: 2026-08-05T22:45:38+0300
last_updated_by: Roman Shulgha
type: feature_development
---

# Handoff: Community Library backend — discover FRD (interview nearly complete, FRD not yet written)

## Task(s)
Running `/skill:discover` to produce a Feature Requirements Document (FRD) for the **backend of the Moderated Community Library** — the next phase after the validated client-side foundation. The discover skill was invoked with free-text: "continue working on the Library; client-side done; now build the backend to make everything work; fully functional version; considering GitHub Pages hosting, or a new domain."

Status:
- ✅ Step 1–3: input handling, intent question, codebase probe (read prior FRD + plan + validation + research + registry client/model).
- ✅ Step 4: pre-resolutions confirmed (P1 keep client read contract; P2 separate backend workspace).
- ✅ Step 5 (interview loop): 5 of 6 branches resolved (phasing, hosting, static host, auth, signatures). The 6th branch (workspace + type-sharing) was asked; **the user declined to answer and invoked create-handoff**.
- ⏳ Step 6–7: FRD NOT yet synthesized or written. No artifact file exists yet.

The full lifecycle remains the agreed destination (prior FRD "Release scope: Full lifecycle"). This discover refines the BACKEND scope + hosting, which the prior research explicitly left open ("Plugin client only").

## Critical References
1. `.rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md` — the source FRD (31 inherited decisions).
2. `.rpiv/artifacts/plans/2026-08-05_16-24-25_moderated-community-library.md` — foundation read+install plan; "What We're NOT Doing" lists the deferred backend.
3. `src/library/registry-client.ts` + `src/library/registry-model.ts` + `src/library/library-model.ts` — the read contract the backend MUST serve.

## Recent changes
None to source (discover produces an artifact only). No FRD file written yet. (A 4-item session todo list tracked discover phases; not durable.)

## Decision Log (discover interview — carry into the FRD Decisions block verbatim)

**Intent (Step 2, verbatim):** "Just me for now" — solo operation today, audience comes later; success = a working, deployable version the developer controls.
**Original input (verbatim, for FRD Problem & Intent):** "I'd like to continue working on the Library. As I understand it, we've completed the client-side part, and now we need to build the backend to make everything work. I'd like to have a fully functional version. At the moment, I don't have a spare domain, so I'm wondering whether it's possible to implement the backend using GitHub Pages. If having a domain would make things easier, I'll arrange a new domain specifically for this project."

Pre-resolutions (confirmed — evidence + confirmed):
- **P1 Keep the plugin's read contract** — backend implements `GET /catalog`, `GET /packages/{id}/releases/{ver}`, `GET /packages/{id}/releases/{ver}/manifest` (https-only, URL-encoded, identity-checked, never-throws). Evidence: `src/library/registry-client.ts:84-167`. Rationale: client shipped + 949 tests green.
- **P2 Separate backend workspace** — backend gets its own build/test/runtime outside the Obsidian plugin tree; plugin stays a pure client. Evidence: research "Backend/dashboard is greenfield"; plan "Backend/server/API workspace — fully greenfield, out of scope."

Interview decisions:
- **D1 Backend delivery phasing — Registry-first static (Cloudflare Pages), then layer stateful submission/moderation/auth.** Rationale: client has `DEFAULT_REGISTRY_URL=''`, no registry to talk to (`src/library/registry-client.ts:23`); static-catalog milestone validates it end-to-end at zero infra; forward-compatible with phase 2 (same JSON contract); matches the project's established phasing pattern. Full lifecycle remains the agreed destination.
- **D2 Phase-2 hosting — Supabase managed backend (Auth + Postgres + Storage + Edge Functions) + a custom domain the user will buy.** Keeps the FRD's email-magic-link + custom-WCAG-dashboard + managed-service decisions intact. Cost nuance: custom domain on the static dashboard/catalog is free (Cloudflare Pages); custom domain on the Supabase API needs Supabase Pro (~$25/mo) or the API stays on a free `*.supabase.co` subdomain. Free path for "just me now": custom domain → dashboard/catalog, API on `*.supabase.co`. User explicitly rejected the GitHub-as-backend option ("maybe Supabase more good") and chose to get a domain.
- **D3 Static host — Cloudflare Pages** for the phase-1 static catalog + the WCAG dashboard SPA. Free, custom domain, `_redirects` (200-rewrite) maps the extension-less plugin paths (`/catalog`, `/packages/{id}/releases/{ver}`, `.../manifest`) to `.json` files. Rationale: GitHub Pages can't do the extension-less JSON rewrites cleanly.
- **D4 Auth — Email magic link only** (Supabase Auth native, FRD decision); OAuth providers (GitHub/Google) deferred until audience grows. Rationale: "just me for now."
- **D5 Signatures — Defer ed25519** publisher signing; backend produces manifests with SHA-256 hashes (integrity, current foundation behavior, `src/library/integrity.ts`, D11 "integrity not authenticity"); ed25519 + plugin verification deferred. Rationale: "just me for now"; no key-management ops.

## Open question (NOT yet answered — the user declined)
**Workspace + type-sharing** (research flagged open; foundation chose duplicated types, D12). Axis: build-restructure risk vs type-drift risk. Options presented:
1. **Duplicated types + parity gate (Rec.)** — new separate backend repo, re-declare wire types, extend `scripts/check-consistency.mjs` into a cross-repo parity check. Optimizes: zero plugin-build restructure (949 tests untouched); cheapest; matches current posture. Sacrifices: drift risk; parity gate must be built.
2. **Monorepo + shared-types workspace** — restructure this repo into npm workspaces (plugin + backend + dashboard + shared-types), tsc project refs. Optimizes: single source of truth. Sacrifices: restructures plugin esbuild/tsconfig/vitest; risk to shipped 949-test build.
3. **Separate repo + shared npm package** — backend+dashboard in new repo, wire types in a small npm package. Optimizes: plugin untouched + single source. Sacrifices: package publishing overhead; plugin gains external dep.

## Learnings
- The Library = "Moderated Community Library." The client-side foundation (browse + atomic install) is DONE + validated 2026-08-05T19:24 (9 phases, 949/949 tests, `npm run check` green). Manual Obsidian-side testing of the foundation still pending.
- The backend is fully greenfield — no backend/server/API code exists; research was deliberately scoped "Plugin client only."
- The plugin's read contract is fixed and the backend MUST serve it: `src/library/registry-client.ts` (`RegistryClient.fetchCatalog`/`fetchRelease`/`fetchReleaseManifest`), `src/library/registry-model.ts` (`CatalogResponse`, `ReleaseResponse`), `src/library/library-model.ts` (`PackageManifest`, `CatalogEntry`, `CatalogSnapshot`, `InstalledRecord`, `ReleaseBundle`). `DEFAULT_REGISTRY_URL=''` (`src/library/registry-client.ts:23`); https-only via `normalizeRegistryUrl`; override setting `libraryRegistryUrl` in `src/settings.ts`.
- GitHub Pages is static-only; it cannot run the stateful backend (auth, submission, moderation, signatures). It CAN serve the read-only catalog (static JSON). For the extension-less read paths, Cloudflare Pages `_redirects` is the clean free solution; GitHub Pages cannot do this cleanly.
- Supabase Auth supports email magic link natively (preserves the FRD decision); Supabase custom domains need Pro.
- Prior FRD decisions inherited (settled, do NOT re-ask): official catalog, CC BY 4.0, roles (author/moderator/admin), 9-state lifecycle, automated+human publication gates, signed immutable releases (intent — ed25519 deferred per D5), reports+takedown, WCAG 2.2 AA dashboard, 2s p95, offline local+cache (done client-side), dedicated library view (done), isolated namespace install (done), pinned versions + side-by-side upgrade (upgrade deferred), keep canonical snippet refs, keep fail-fast validation.
- Prior community library was built and fully deleted (`2ccc66a`→`6657b8d`, ~8,365 lines) — the new one must stay integrated (research lesson).

## Artifacts
Read this session (for reference; need not be re-read):
- `.rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md` (source FRD, 31 decisions)
- `.rpiv/artifacts/plans/2026-08-05_16-24-25_moderated-community-library.md` (foundation plan)
- `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md` (foundation validation, pass)
- `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` (research; "Plugin client only" scope)
- `src/library/registry-client.ts`, `src/library/registry-model.ts` (read contract)

TO BE WRITTEN next session:
- `.rpiv/artifacts/discover/<new-timestamp>_community-library-backend.md` (the FRD — not yet written)

## Action Items & Next Steps
1. Resume the discover interview: get the answer to the one open question (workspace + type-sharing). If the user is unavailable to pick, the recommended default is Option 1 (duplicated types + parity gate) — but confirm rather than silently record.
2. Synthesize the FRD per discover Step 6 (read `templates/frd.md` under the discover skill folder for the section list/frontmatter). Redistribute the decision log above into FRD sections. **Problem & Intent** uses the verbatim intent ("Just me for now") + the original input. **Decisions** block = the full Q/A log above (each decision: Question / Recommended / Chosen / Rationale).
3. Write the FRD per discover Step 7: frontmatter `status: ready`; filename `.rpiv/artifacts/discover/<YYYY-MM-DD_HH-MM-SS>_community-library-backend.md` using the new session's discover Metadata timestamp. Acceptance criteria must be observable (e.g., "plugin's `libraryRegistryUrl` pointed at the Cloudflare Pages URL → `LibraryView` lists the seeded catalog"; "Supabase Edge Function `GET /catalog` returns a valid `CatalogResponse`").
4. Chain to `/skill:research .rpiv/artifacts/discover/<...>_community-library-backend.md` (the FRD's Decisions block becomes research's Developer Context).
5. **Recommended Approach for the FRD (emerging):** "A new separate backend using Supabase (Auth + Postgres + Storage + Edge Functions) for the stateful submission/moderation/auth API, plus Cloudflare Pages (custom domain) for the phase-1 static catalog and the WCAG moderation dashboard SPA. Phase 1 ships the plugin's existing 3 read endpoints as static JSON on Cloudflare Pages (`_redirects` rewrites) to validate the built client end-to-end at zero infra; phase 2 layers Supabase for submission, moderation, email-magic-link auth, and immutable storage, with SHA-256 integrity now and ed25519 publisher signing deferred. Wire types duplicated with a cross-repo parity gate (pending final confirmation)."

## Other Notes
- Discover skill location: `C:\Users\user\.pi\agent\npm\node_modules\@juicesharp\rpiv-pi\skills\discover\SKILL.md`; FRD template: `templates/frd.md` under that skill folder.
- The discover skill writes a FRESH timestamped artifact per invocation — to finish, re-invoke `/skill:discover` in the new session (or continue the interview then write). The decision log above is the irreplaceable context; do NOT re-ask the 5 resolved branches.
- No source files were modified this session (discover produces an artifact only).