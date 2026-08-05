---
date: 2026-08-04T19:24:08+0300
author: Roman Shulgha
commit: 4ad002c
branch: main
repository: RadiProtocol
topic: "Moderated community library — design (slice-by-slice, paused at Slice 4 checkpoint)"
tags: [design, library, installer, transactional, registry, handoff]
status: complete
last_updated: 2026-08-04T19:24:08+0300
last_updated_by: Roman Shulgha
type: feature_development
---

# Handoff: Moderated community library — design artifact (Slices 1–3 locked, Slice 4 checkpoint pending)

## Task(s)
Running `/skill:design` against the research artifact `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` to produce a plan-ready design for the **foundation scope (read + install)** of a moderated community library: new `src/library/` lower layer (pure model + Obsidian services), transactional stage→verify→commit→rollback installer, network-injected registry client, immutable isolated namespaces (`library/<packageId>/<version>/`) under existing protocol/snippet roots, SHA-256 integrity, offline catalog cache, and a first-class `LibraryView` ItemView. Submission/auth/moderation/upgrades/ed25519 signature are explicitly deferred to follow-up designs.

The design is decomposed into **9 vertical slices**; generation is slice-by-slice with a per-slice `slice-verifier` agent run + a developer micro-checkpoint before each slice is locked into the artifact.

**Status:**
- **Slice 1 (pure model + paths + integrity)** — ✅ approved + written to artifact (4 verifier rounds).
- **Slice 2 (registry client + API types + network mock)** — ✅ approved + written to artifact (5 verifier rounds).
- **Slice 3 (cache + installed-record stores + shared library-json-io)** — ✅ approved + written to artifact (2 verifier rounds).
- **Slice 4 (transaction journal + transactional installer)** — ⏸️ PAUSED at the developer checkpoint. The advisor (escalated before coding the load-bearing slice) flagged 3 design conflicts in already-approved decisions that need developer input before generating Slice 4 code. The developer declined to answer the checkpoint questions and requested this handoff instead.
- **Slices 5–9** — pending (service facade; LibraryView + i18n; item-detail + install-progress modals; existing-views read-only integration; main.ts wiring + settings + en/ru parity gate).

## Critical References
- Design artifact (the living doc, source of truth): `.rpiv/artifacts/designs/2026-08-04_17-41-05_moderated-community-library.md`
- Research artifact (input): `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md`
- Design skill flow: `C:\Users\user\.pi\agent\npm\node_modules\@juicesharp\rpiv-pi\skills\design\SKILL.md`

## Recent changes
All changes are inside the design artifact (NO source files were edited — design produces a document, not implementation):
- `.rpiv/artifacts/designs/2026-08-04_17-41-05_moderated-community-library.md` — skeleton written (Step 5.4), then Slices 1–3 code + Success Criteria + Design History filled via Edit (Steps 6.4 ×3). D14 prose reconciled (`releaseVersion`/`publishedAt`). File Map reconciled (cache store = catalog snapshot only; downloaded bytes are transient staging).
- Fixed artifact corruption: the edit `newText` unicode escapes (`\u003e`/`\u003c`/`\u0026`) were persisted literally instead of decoded, corrupting generics (`Promise\u003cstring\u003e`) and `&&` operators across all written code fences. A one-off Python script replaced all literal `\u003e`→`>`, `\u003c`→`<`, `\u0026`→`&` globally; verified 0 remaining escapes and 12 valid `Promise<` occurrences. One stray `async () =>` line break in the registry-client test fence was also repaired.

## Learnings
- **Artifact edit corruption (CRITICAL for resume):** When using the `edit` tool on the design artifact, unicode escapes like `\u003e` in `newText` were persisted as the literal 6-char string instead of decoding to `>`. **Going forward, write actual `<`, `>`, `&` characters directly in edit `newText`/`oldText`, and ALWAYS re-read the persisted fence after every 6.4 edit** to verify it matches the verifier-approved code. The slice-verifier sees correctly-decoded code in the agent prompt and does NOT verify the persisted artifact — corruption is invisible to it.
- **slice-verifier is extremely adversarial:** it found null-prototype rejections, stateful-getter TOCTOU on `e.message`, `String(e)` throwing on `Object.create(null)`, test version-literal widening (`version: 1` vs `typeof CATALOG_SNAPSHOT_VERSION`), invalid vitest matchers (`.endsWith` is not a matcher — use `toMatch(/\n$/)`), and grep false-positives on comments. Budget 2–5 verifier rounds per slice; for purely pathological findings (cosmic-ray edge cases beyond any realistic transport rejection), use the skill's **surface-and-proceed** path (present the verbatim VIOLATION row at the 6.3 micro-checkpoint with a one-line by-design rationale; the approve question ratifies it).
- **Foundation-slice atomicity tension:** Slice 1's `isPackageManifest` delegates wrapped-`protocolDoc` validation to `isProtocolDocumentV1`, which is intentionally shallow (research: "shape-only everywhere"). Deep node validation is the **parser's** job — the Slice 4 installer runs `ProtocolDocumentParser.parse()` (never throws) on the wrapped doc before commit. This was surface-and-proceeded.
- **root-bound snippet nodes refused:** `buildReferenceMapping` (Slice 1, `library-paths.ts`) returns `{error}` for snippet nodes with neither `snippetPath` nor `subfolderPath` — they can't be isolated into a namespace. Foundation constraint; document it.
- **Reference rewrite canonical form:** extension-preserving (matches `toProtocolRelativePath` / stored `.rp.json`), NOT extension-stripping. `rewriteSnippetRef` mirrors `applyMapping` (`src/snippets/protocol-ref-sync.ts:119-137`).
- **Network DI:** `RegistryClient` takes `options.requestUrl?: typeof import('obsidian').requestUrl` (default real import; `vi.fn()` stub in tests). `obsidian` is esbuild-external. The mock `src/__mocks__/obsidian.ts` gained a `requestUrl` named export (runtime default returning 503; tests inject via DI).
- **Storage dialect:** new stores under `.radiprotocol/library/` use `WriteMutex` + `ensureFolderPath` + `JSON.stringify(value,null,2)+'\n'`; missing file = empty state, malformed = throws `LibraryStoreError` (deliberate departure from `ProtocolDocumentStore` null-on-error). A shared `src/library/library-json-io.ts` (`readJsonFile`/`writeJsonFile`/`safeErrorMessage`) was added in Slice 3 per the developer's D3 refinement ("centralize shared low-level JSON read/write helpers if duplication becomes meaningful; NOT a generic repository").
- **Slice 3 stores expose read/write only** (no upsert/remove) — read-modify-write atomicity is the installer's job under the transaction lock (D7), avoiding the lost-update gap of `ProtocolDocumentStore.update` (`src/protocol/protocol-document-store.ts:84-98`).

## Artifacts
- `.rpiv/artifacts/designs/2026-08-04_17-41-05_moderated-community-library.md` — the design artifact. Slices 1–3 Architecture code fences + `## Slices` Success Criteria + Design History are filled; Slices 4–9 Architecture fences are empty placeholders and Design History entries are `— pending`. Frontmatter `status: in-progress`.
- `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` — upstream research (read fully; key source files read into context: `src/snippets/snippet-service.ts`, `src/protocol/protocol-document-store.ts`, `src/snippets/protocol-ref-sync.ts`, `src/graph/graph-validator.ts`, `src/views/snippet-manager-view.ts`, `src/views/snippet-editor-modal.ts`, `src/views/inline-runner-modal.ts` (via agent), `src/main.ts`, `src/protocol/protocol-document.ts`, `src/settings.ts`, `src/graph/graph-model.ts`, `src/utils/write-mutex.ts`, `src/utils/vault-utils.ts`, `src/__mocks__/obsidian.ts`, `src/__tests__/protocol-document-store.test.ts`).

## Action Items & Next Steps
1. **Resolve the 3 advisor checkpoint questions** (the developer declined them this session — re-present when resuming):
   - **Lock scope:** single global `libraryMutex` singleton (advisor-recommended; avoids the `ensureFolderPath` shared-parent-folder check-then-create race) vs per-package lock + a second global records lock. Current D7 text says per-package `'library-install:'+packageId+'@'+version` — needs correction to global if chosen.
   - **Commit marker:** per-release marker file at `.radiprotocol/library/installed/<packageIdSlug>/<versionSlug>.json` written LAST (advisor-recommended; true per-release commit marker) vs the current global `installed-records.json`. **Choosing per-release REQUIRES a cascade revision of locked Slices 1 & 3**: `InstalledRecord` becomes a per-release schema-versioned document (add `schema: 'radiprotocol.installed-record'`/`version` sentinels), `InstalledRecordsDocument` + `isInstalledRecordsDocument` + `INSTALLED_RECORDS_SCHEMA`/`VERSION` are removed, `InstalledRecordStore` becomes `read(packageId,version)`/`list()`/`write(record)`/`delete(packageId,version)` over per-release files. Use the skill's "Rethink" cascade path (ask whether to reopen each affected approved slice).
   - **Root spelling:** `.radiprotocol/library/` (matches `RadiProtocol` + schema prefix `radiprotocol.protocol`, already used in locked Slices 1–3) vs `.radioprotocol/library/`. Confirm with developer.
2. **Update D7 (and D5/D3 if needed) in the artifact's `## Decisions`** to reflect the resolved lock + commit-marker choices before generating Slice 4.
3. **Generate Slice 4 (transaction journal + transactional installer)** with the advisor's invariant: validate entirely in memory first (nonempty slugs via `validPackageSlug`, collision preflight, manifest/content closure, `.md`-only, safe paths via `assertNoTraversal`, source hashes via `verifyIntegrity`, parser success); rewrite cloned `protocolDoc.nodes[*].fields.snippetPath`/`subfolderPath` via `rewriteSnippetRef` + `buildReferenceMapping`; validate the rewritten graph with `new GraphValidator({ snippetFileProbe: (abs) => plannedFinalPaths.has(abs), snippetFolderPath: settings.snippetFolderPath, t })`; write the journal (all planned owned paths + marker path) BEFORE any final-path write; commit snippets → protocol → per-release marker LAST; recovery on load = marker present+valid → remove journal only; marker absent → remove only journal-owned paths deepest-first, then journal. All under the single global `libraryMutex`; all I/O via `app.vault`/`adapter` directly (NOT `store.write()`/`snippetService.save()` mid-transaction).
4. **Continue Slices 5–9** per the decomposition in the artifact's `## Slices` section (service facade; LibraryView + `library.*` i18n block in BOTH en.json + ru.json; item-detail + install-progress modals modeled after `SnippetEditorModal` promise-modal + `InlineRunnerModal` exhaustive state-machine + ARIA progressbar; existing-views read-only integration via `isLibraryManagedPath` in `snippet-manager-view.ts`/`protocol-editor-view.ts`/`protocol-picker-modal.ts`; `main.ts` registerView+command+services+recovery-on-load, `settings.ts` advanced `libraryRegistryUrl`, `scripts/check-consistency.mjs` en/ru key-set parity gate).
5. **After all 9 slices are locked**, run Step 7 (verify all Architecture fences + `## Slices` Success Criteria filled; flip frontmatter `status: in-progress` → `status: ready`), then Step 8 (present artifact; next step `/skill:plan`).

## Other Notes
- **Verifier rounds per slice so far:** Slice 1 = 4, Slice 2 = 5, Slice 3 = 2. Slice 2's many rounds were all on the never-throw contract (`fetchCatalog`/`fetchRelease` must NEVER throw) — resolved with a single-read `safeErrorMessage` helper (captured once into a local, returned only when `typeof m === 'string'`, `String(e)` wrapped in try). The same helper now lives in `src/library/library-json-io.ts` (`safeErrorMessage`) AND as a private copy in `registry-client.ts` (re-opening Slice 2 to deduplicate is optional — they're in different layers).
- **`src/library/library-json-io.ts` was added mid-Slice-3** (not in the original 9-slice decomposition). It's now in Slice 3's `**Files**` line, the `## File Map`, and the Architecture section. The transaction journal (Slice 4) should reuse `readJsonFile`/`writeJsonFile`/`safeErrorMessage` from it.
- **No source files were modified** — everything lives in the design artifact. The only repo-tree files touched were the (deleted) one-off `.rpiv/fix_escapes.py` repair script.
- **Scope discipline:** the developer chose foundation-first (read+install only). Do NOT implement submission wizard, auth, moderation, upgrades, ed25519 signature, or reports/takedown in this design. Manifest/service boundaries are forward-compatible but contain NO speculative fields for deferred features.
- **SHA-256 = integrity, NOT authenticity.** The UI must never mark unsigned releases as "trusted" (only "integrity verified"). ed25519 signature is deferred.
- **`DEFAULT_REGISTRY_URL = ''`** (Slice 2) — empty until the official registry domain is provisioned; empty/non-https/invalid → explicit "catalog unavailable" state, never a throw. Do NOT hard-code `https://registry.radiprotocol.org`.
- **i18n:** the new `library.*` block must be added to BOTH `src/i18n/locales/en.json` and `src/i18n/locales/ru.json` (no automated parity gate exists today; Slice 9 adds one to `scripts/check-consistency.mjs`). User-authored content is never wrapped in `t()`.