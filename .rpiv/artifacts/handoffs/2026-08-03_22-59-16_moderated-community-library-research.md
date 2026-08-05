---
date: 2026-08-03T22:59:16+0300
author: Roman Shulgha
commit: 4ad002c
branch: main
repository: RadiProtocol
topic: "Moderated Community Library Research"
tags: [research, library, protocols, snippets, moderation, installer, handoff]
status: complete
last_updated: 2026-08-03T22:59:16+0300
last_updated_by: Roman Shulgha
type: research
---

# Handoff: Moderated Community Library — research synthesis in progress

## Task(s)
Running `/skill:research` chained from the discover artifact `.rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md`. The goal is to produce a research document at `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` that feeds `/skill:design` or `/skill:blueprint`.

Status:
- ✅ Discover artifact read fully; 31 decisions translated to Developer Context Q/A entries; Open Questions carried forward (none deferred).
- ✅ scope-tracer dispatched; 10 research questions emitted, grouped into 6 analysis groups.
- ✅ Key shared files read into main context (main.ts, snippet-service.ts, protocol-document-store.ts, protocol-document.ts, protocol-document-parser.ts, graph-validator.ts, protocol-ref-sync.ts, snippet-model.ts, write-mutex.ts, settings.ts).
- ✅ 6 codebase-analyzer agents + 1 precedent-locator agent dispatched concurrently; ALL completed with detailed findings.
- ⏸️ Developer checkpoint: asked ONE grounded scope question via ask_user_question; **user declined to answer**. Research document NOT yet written.

The session ended at the Step 3 checkpoint (Step 3.2) of the research skill. Step 4 (write document) and Step 5 (present & chain) remain.

## Critical References
- `.rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md` — source FRD (31 decisions, full requirements, acceptance criteria). Read fully before resuming.
- `C:\Users\user\.pi\agent\npm\node_modules\@juicesharp\rpiv-pi\skills\research\SKILL.md` — the research skill workflow; resume at Step 3.2 (developer checkpoint) → Step 4 (write) → Step 5 (present).
- `.rpiv/guidance/src/{protocol,snippets,graph,runner,views}/architecture.md` — layer guides for the planner-facing artifact.

## Recent changes
No code changes — research-only session. No files written. All agent findings live only in this session's context (the 7 agent result messages). The findings MUST be re-derived or recovered from this handoff; they are not persisted to disk.

## Learnings
**Single most important finding — a community library was already built and fully deleted as "abandoned":**
- Commits `2ccc66a` (v1.14.0 template library MVP, 2026-05-03) → `4258647` (protocol library browser #5, 05-19) → `e884baf` (local admin mode, 05-21) → `1e9996c` (migrate to md-template, 05-26) → `7e2918f` (disconnect library subsystem, 06-02) → `6657b8d` (complete library removal, 06-02).
- ~2,500 lines added then deleted: `library-service.ts`, `protocol-library-service.ts`, `library-browser-modal.ts`, `protocol-library-browser-modal.ts`, `library-snippet-preview-modal.ts`, `library-admin.ts` (589 lines), `library-admin-modal.ts` (662 lines), `snippet-manager.css` ~155 lines, i18n `library`+`protocolLibrary` blocks (~55 keys ×2 locales), 4 test files. Removal: 19 files, 1,597 deletions.
- Root cause: wired only into `main.ts` + `snippet-manager-view.ts`, never into active workflows. Documented in `.rpiv/artifacts/discover/2026-06-02_11-55-28_cleanup-and-ux-fixes.md` (D2): "abandoned attempt — no part of it is used by current Protocol Editor, snippet workflow, or plugin initialization."
- Follow-up fixes during its 30-day life (install/network gotchas to budget for from day one): `d9c9487` fetch-vs-requestUrl order (requestUrl re-encodes URLs); `fa3d478` inline CSS + fetch fallback; `e14c5c1` URL-encode Cyrillic snippet download paths; `9b4a886` create parent folder when installing library snippets; `cb41717` 37 dead i18n keys after nightly drift.

**Other load-bearing findings from the 7 analysis agents:**

1. **Transaction boundary gap (fatal if ignored):** `ProtocolDocumentStore.update()` (`src/protocol/protocol-document-store.ts:86-95`) reads UN-mutexed then writes mutexed — two concurrent updates silently clobber. The per-path `WriteMutex` (`src/utils/write-mutex.ts:10-21`) is per-instance AND per-path; the three separate instances (`ProtocolDocumentStore.mutex:37`, `SnippetService.mutex:59`, module-level `protocolMutex` in `protocol-ref-sync.ts:17`) are mutually unaware. No staging area, no pre-commit verification, no rollback exists. The transactional installer MUST build its own stage→verify→commit→rollback journal under a real cross-file lock; it cannot reuse the stores as the transaction boundary.

2. **Path-safety gap:** Neither `ProtocolDocumentParser` (`src/protocol/protocol-document-parser.ts:259` reads `radiprotocol_snippetPath` verbatim) nor `GraphValidator` D-04 (`src/graph/graph-validator.ts:142` naively string-concatenates `${snippetFolderPath}/${relPath}`) rejects `../` or absolute paths. The only traversal guard is `SnippetService.assertInsideRoot` (`src/snippets/snippet-service.ts:75-96`), which is NOT invoked by ref-sync or the validator. The installer's pure import-rewrite must add its own traversal/absolute-path gate before the parser consumes rewritten output — this is a net-new behavior with no current test coverage.

3. **Reference rewriting is non-atomic:** `rewriteProtocolSnippetRefs` (`src/snippets/protocol-ref-sync.ts:37-126`) is vault-wide, best-effort, logs failures to `skipped[]` without rollback — a mid-loop failure leaves earlier files committed. The reusable pure core is `applyMapping` (`protocol-ref-sync.ts:119-138`): exact match wins, `/`-boundary prefix match, longest prefix wins, returns null = unchanged. The installer must wrap namespace rewriting inside its transaction, not copy the existing non-transactional behavior. `toSnippetRelativePath` (`snippet-service.ts:41-46`) is the key encoder: strips root prefix + trailing `.md` only (`.json` preserved), root → `''`.

4. **`ProtocolDocumentV1` is already closed/immutability-safe:** `src/protocol/protocol-document.ts:23-92` has no slot for identity/release/provenance/hashes/install metadata. `isProtocolDocumentV1` (`:167-189`) is a shallow envelope guard that rejects extra sentinels. The package/release manifest must WRAP `ProtocolDocumentV1` (contain it as a value), not extend it. Schema-version compatibility = binary equality against `PROTOCOL_VERSION = 1` (`:18`); FRD §10's compatibility check maps onto this guard + `ProtocolDocumentParser.parse()` (`protocol-document-parser.ts:99-110`).

5. **Staged validation is already pure/probe-driven:** `GraphValidator` (`graph-validator.ts:27-150`) is zero-Obsidian; the `snippetFileProbe` (`:16,19,137-150`) is the sole I/O seam. Production injects `(absPath) => app.vault.getAbstractFileByPath(absPath) !== null` (`inline-runner-modal.ts:96`); an installer injects `(absPath) => stagedFileSet.has(absPath)` for identical validation against a staged tree. The D-04 missing-snippet test matrix (`__tests__/graph-validator.test.ts:342-470`) already uses fabricated probe maps — structurally identical to a staged namespace. Schema checks via `isProtocolDocumentV1`; graph checks via `validator.validate`; package-level gates (signature/hash/safe-path/supported-type/manifest-consistency) are net-new.

6. **Persistence dialects:** Two vault-I/O dialects — `ProtocolDocumentStore` (structured `.rp.json`, null-on-error, never throws) and `SnippetService` (`assertInsideRoot`-gated `.md` CRUD, throws on unsafe write). Both reuse `WriteMutex` + `ensureFolderPath`. `SnippetService` holds the LIVE settings object (`main.ts:59`) so root changes take effect without reconstruction; `ProtocolDocumentStore` receives folder paths as args. Remote-cache data (catalog fetch, offline snapshots, downloaded package bytes) belongs in a NEW dedicated store under a storage root — NOT through the editable `ProtocolDocumentStore`/`SnippetService` (their suffix filters + `assertInsideRoot` would reject/misclassify it). Installed-release records = user-owned pretty-JSON manifests under the snippet root (follows `ProtocolDocumentStore.write()` `JSON.stringify(doc,null,2)+'\n'` convention). Retry state = ephemeral, parallel to Obsidian `loadData()/saveData()` (`main.ts:41,149`).

7. **Namespace derivation (no precedent exists):** No versioned namespace code exists. Suggested shape: `${root}/library/<slug(packageId)>/<immutableVersion>/...` where version is server-controlled immutable release tag, packageId slug is deterministically derived. User-configurable: only the two storage roots + choice of which version to install. Server-controlled: bytes, version tags, hashes, revocation, upgrade availability. Derived: namespace path, package ID slug, local-modification status. Follow `SnippetService` collision-check-and-throw pattern (NOT `ProtocolDocumentStore.write`'s blind overwrite) to protect existing versions during side-by-side upgrade.

8. **UI patterns to model LibraryView + wizard after:** `SnippetManagerView extends ItemView` (`src/views/snippet-manager-view.ts:50`) — generation+mounted guard (`refresh()` `:225-253`, `ownsRefresh` `:251-253`) is the anti-blocking/anti-stale core; `onClose` `:185-196` clears timers + `mounted=false`. `activateSnippetManagerView()` (`main.ts:217-228`) = get-or-create leaf + `revealLeaf`. `SnippetEditorModal` (`snippet-editor-modal.ts:93,235,645`) = promise-returning Modal with `safeResolve` + unsaved-changes close interception — model for the submission wizard. `InlineRunnerModal` (`inline-runner-modal.ts:413,403`) = exhaustive state-machine dispatch + `progressbar` aria-valuenow for >200ms progress. `SnippetTreePicker` (`snippet-tree-picker.ts:125,175-191`) = reusable mount/unmount listing with tracked-listener teardown + `aria-live="polite"` span (`:161-168`) for screen-reader announcements. The one documented cross-layer exception: `runner/render/render-snippet-picker.ts:24` imports `SnippetTreePicker` from views — library domain logic should live in a NEW `src/library/` lower layer, UI in `src/views/`.

9. **i18n surface (none of these keys exist yet):** Add to BOTH `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`. Key convention `componentName.stringName`. Planned blocks: `catalog.*`, `item.*`, `auth.*`, `submission.status.*` (one key per lifecycle state: draft/submitted/inReview/changesRequested/resubmitted/approved/published/rejected/withdrawn — server sends token codes, plugin renders via `t('submission.status.'+code)`), `submission.history.*`, `submission.review.*`, `integrity.*`, `install.*`, `offline.*`/`retry.*`, `report.*`, `revocation.*`, `upgrade.*`, `rollback.*`. Audit gate: `scripts/audit-i18n-ui-text.mjs` flags hardcoded literals in `src/views` + `src/settings.ts`; runs via `npm run audit:i18n` (`package.json:18`) and gates `check:release`. Parity enforced by `check:consistency`.

10. **Backend/dashboard is greenfield:** `esbuild.config.mjs:100-123` single plugin entry; grep finds no `fetch|signature|hmac|abort|requestUrl` in `src/`. No backend workspace in repo, no shared-types package. Role (`author|moderator|admin`) + lifecycle types must be shared via generated OpenAPI client OR hand-maintained shared-types module OR duplicated types (open decision). `vitest.config.ts:4-7` aliases `obsidian` → `src/__mocks__/obsidian.ts`; network client testable via dependency injection of a fetch/client abstraction (mirroring `snippetFileProbe` / `Translator` injection). `makeVault()`/`makeApp()` factory at `__tests__/protocol-document-store.test.ts:16-93` backs all Obsidian service tests and would provide the vault side of installer transaction tests.

## Artifacts
- `.rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md` — source FRD (read fully; 31 decisions + Open Questions).
- `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` — TARGET OUTPUT, NOT YET WRITTEN. Filename slug = `2026-08-03_22-47-07` (second tab field of Metadata line 1 of the research skill's Metadata block); topic = `moderated-community-library`.
- This handoff: `.rpiv/artifacts/handoffs/2026-08-03_22-59-16_moderated-community-library-research.md`.

## Action Items & Next Steps
1. **Resume the research skill at Step 3.2 (developer checkpoint).** Re-read the research SKILL.md Step 3-5 to follow the exact write format.
2. **Re-derive the 7 agents' findings** — they are NOT on disk. Either (a) re-dispatch the 6 codebase-analyzer groups + precedent-locator from the question prompts (preserved in this session's tool-call history), or (b) synthesize directly from the Learnings section above (it captures every load-bearing finding with file:line). Re-dispatch is safer for citation precision; the Learnings section is sufficient for a planner-ready artifact if re-dispatch is too costly.
3. **Re-ask or skip the developer checkpoint.** The declined scope question: "Plugin client only (Recommended) | Plugin + backend research | Plugin + recover deleted lib." Recommendation if re-asking: proceed with **Plugin client only** by default (the research skill is codebase-grounded; backend has no codebase to analyze) and record the scope decision in Developer Context. Capture the declined question + chosen default in the artifact's Developer Context section.
4. **Write the research document** (Step 4) to `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` using the SKILL.md frontmatter + section template (Research Question / Summary / Detailed Findings / Code References / Integration Points: Inbound+Outbound+Infrastructure / Architecture Insights / Precedents & Lessons / Historical Context / Developer Context / Related Research / Open Questions). Frontmatter: `date: 2026-08-03T22:47:07+0300`, `commit: 4ad002c`, `branch: main`, `repository: RadiProtocol`, `author: Roman Shulgha`, `status: ready`.
5. **Translate the 31 FRD Decisions** into Developer Context `Q (discover: <title>): <question> / A: <chosen>` entries (per skill Step 1.2). Carry forward FRD Open Questions verbatim (none deferred).
6. **Record Precedents & Lessons** with the abandoned-library precedent (`2ccc66a`→`6657b8d`), the SNIP-01 ItemView+CRUD precedent (`9ce1c05`), protocol-ref-sync (`a61e97f`), loop-node merge (`1dd1f78`), and the WriteMutex race root cause. Include the 8 composite lessons from the precedent-locator.
7. **Present & chain (Step 5):** offer `/skill:design` or `/skill:blueprint` against the written artifact. Suggest a fresh `/new` session first.

## Other Notes
- The research skill's Metadata block (line 1) had a stderr from PowerShell `echo` but the tab-separated fields parsed correctly: `<iso>=2026-08-03T22:47:07+0300`, `<slug>=2026-08-03_22-47-07`, branch=main, commit=4ad002c, repo=RadiProtocol, author=Roman Shulgha.
- All `file:line` references in Learnings were verified against files read in this session. When re-emitting citations in the artifact, write paths RELATIVE TO REPO ROOT (e.g. `src/protocol/protocol-document-store.ts:86-95`, not bare `protocol-document-store.ts:86-95`).
- The 6 analysis-group question prompts and the precedent-locator prompt are in this session's Agent tool-call history if re-dispatch is chosen. Grouping: A=Q1+Q2 (data models+closure), B=Q3+Q7 (persistence+namespaces), C=Q4+Q5 (validation+rewriting), D=Q8 (write-mutex/transaction), E=Q6 (UI patterns), F=Q9+Q10 (i18n+backend boundary).
- The FRD's Recommended Approach (passed to scope-tracer as topic): "Add a dedicated plugin library view and in-plugin submission wizard backed by an official managed API, immutable signed package registry, and separate web moderation dashboard. Implement a dependency-aware transactional installer that stages protocol-plus-snippet bundles into versioned isolated namespaces, rewrites only imported root-relative references, verifies integrity and compatibility, and atomically commits or rolls back."