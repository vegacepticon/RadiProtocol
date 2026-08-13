---
date: 2026-08-13T13:24:38+0300
author: Roman Shulgha
commit: bdd06f9
branch: main
repository: RadiProtocol
topic: "Library production-ready blueprint (slug+hash keying, migration, preflight split, recovery scan, builder, export, uninstall UI) — Step 9 triage in progress"
tags: [implementation_strategy, blueprint, plan, library, library-installer, library-paths, library-service, library-migration, library-view, export-modal, migration]
status: complete
last_updated: 2026-08-13T13:24:38+0300
last_updated_by: Roman Shulgha
type: implementation_strategy
---

# Handoff: Library production-ready blueprint — plan fully generated, Step 9 triage near-complete

## Task(s)

Running `/skill:blueprint` on the research artifact `Z:/projects/RadiProtocol/.rpiv/artifacts/research/2026-08-13_09-42-22_library-production-ready.md` to produce an implement-ready phased plan for bringing the community-library cluster to production-ready.

**Status of the underlying blueprint workflow:**
- Steps 1-8 (input → research → dimension sweep → checkpoint → decompose → generate 7 slices → finalize → independent review): **COMPLETE**.
- Step 9 (triage of reviewer findings): **IN PROGRESS** — all 10 rows triaged by the developer, but the application of one row (C8) is unfinished, the Plan Review `resolution` column is still `(filled at Step 9)`, and the artifact status has NOT yet been flipped to `ready`.

**The plan artifact itself (the deliverable) is ~complete and implement-ready once the remaining Step 9 items below are finished.**

## Critical References

- Plan artifact (the deliverable — read this to resume): `Z:/projects/RadiProtocol/.rpiv/artifacts/plans/2026-08-13_10-09-26_library-production-ready.md`
- Research artifact (the source the plan implements): `Z:/projects/RadiProtocol/.rpiv/artifacts/research/2026-08-13_09-42-22_library-production-ready.md`
- Layer guidance (contracts the code must honor): `Z:/projects/RadiProtocol/.rpiv/guidance/src/library/architecture.md`

## Recent changes

The plan artifact was fully generated + populated across this session. Key states in the file (`2026-08-13_10-09-26_library-production-ready.md`):
- `status: in-review` in frontmatter (needs flipping to `ready` — pending).
- `unresolved_phase_count: 0`, `phase_count: 7` (all 7 phases approved + code written).
- `phases:` frontmatter array rebuilt from the actual Phase headings + corrected file lists.
- 7 Phase sections (§1-slug+hash keying, §2-preflight split+lister, §3-recovery orphan scan, §4-migration, §5-builder, §6-export modal, §7-uninstall UI), each with full copy-pasteable code fences + filled `### Success Criteria:`.
- `## Plan Review (Step 8)` table appended at the end of the file — 10 findings, `resolution` column still `(filled at Step 9)`.

Applied during Step 9 triage (already edited into the artifact's code fences / SC bullets):
- B1: `git diff --exit-code HEAD -- src/snippets/snippet-model.ts` AV bullet added to Phase 1 SC.
- B2: `grep -n "INSTALLED_RECORD_VERSION = 1" ...` + `git diff --exit-code HEAD -- src/library/library-model.ts` AV bullets added to Phase 4 SC.
- C5: Phase 4 §2 orchestrator — `plan.record.protocolSha256 = await sha256String(JSON.stringify(plan.rewrittenDoc, null, 2) + '\n');` inserted just before the new-marker write.
- C6: Phase 4 §1 — `planRecordMigration` return union extended to `| { changed: false; error: string }` and the snippet/subfolder ref rewrites now `return { changed: false, error: ... }` on a non-matching ref; Phase 4 §2 orchestrator now checks `if ('error' in result) { failed.push(...); continue; }`.
- C7: Phase 4 §2 — `JSON.parse(raw) as ProtocolDocumentV1` replaced with a guarded `if (!isProtocolDocumentV1(protocolDoc)) { failed.push(...); continue; }` + an import-extension note for `isProtocolDocumentV1`.

## Learnings

- **`RecoveryReport` is defined in `src/library/library-installer.ts` (not library-model.ts)** — so the `orphansCleaned` field goes there; `library-model.ts` is untouched by the whole plan.
- **The blueprint slices require verifier-caught corrections that changed the file lists vs the skeleton**: Phase 1 gained `installed-record-store.test.ts` + `library-service.test.ts`; Phase 2 dropped `main.ts` (the lister is internal to LibraryService); Phase 3 dropped `library-model.ts` and gained `library-service.ts` + `library-service.test.ts` (orphansCleaned ripple). The `phases:` array was rebuilt to reflect this.
- **The slug+hash change ripples to test fixtures** (`installed-record-store.test.ts`, `library-service.test.ts`) — they seed paths via a `recPath()` = `installedRecordPath(await packageNamespaceSegment(p), slugifyPackageId(v))` helper.
- **`journalIO.remove` needs a legacy slug-only fallback** (already in Phase 1) so a pre-migration interrupt's stale journal is cleaned.
- **`rollbackTransaction` derives namespaces from the journal's own entries** (Phase 1) to stay self-consistent with legacy slug-only journals (reviewer deferred a hardening on this — C4).
- **Library view/modals have no existing test harness** — the codebase has no library-view modal tests, so Phases 6 + 7 tests are source-grep wiring guards (consistent with the codebase's source-grep regression pattern).
- **ask_user_question JSON pitfalls**: headers must be ≤16 chars; craft option arrays as real objects (several failures came from malformed JSON quoting in this session).

## Artifacts

- `Z:/projects/RadiProtocol/.rpiv/artifacts/plans/2026-08-13_10-09-26_library-production-ready.md` — THE deliverable plan (7 phases, full code, SC, Plan Review table). Read this to resume.
- `Z:/projects/RadiProtocol/.rpiv/artifacts/research/2026-08-13_09-42-22_library-production-ready.md` — upstream research.
- Plan not yet implemented — NO source files in `src/` have been changed (the blueprint skill edits only the artifact; implement does the code).

## Action Items & Next Steps

Finish the remaining Step 9 work in the blueprint skill, in this order:

1. **Apply C8 (unfinished)**: In the plan artifact's `## Phase 4` section, insert a new subsection `#### 6. src/__tests__/library/library-service.test.ts` (before the Phase 4 `### Success Criteria:`) with an incremental change — add `migrateInstalledRecords: vi.fn(async () => ({ migrated: [], skipped: [], failed: [] }))` to the `installer` stub in `makeService` (library-service.test.ts HEAD stub). Also update the `phases:` frontmatter entry for Phase 4 to add `src/__tests__/library/library-service.test.ts` to its `files:` list.
2. **Fill the Plan Review table `resolution` column** for all 10 rows (currently `(filled at Step 9)`), mirroring the triage decisions:
   - B1 applied (slugifyLabel guard — added to Phase 1 SC)
   - B2 applied (INSTALLED_RECORD_VERSION/git-diff wire-shape guard — added to Phase 4 SC)
   - C3 dismissed (false positive — Phase 2 fence has 0 LIBRARY_SUBROOT)
   - C4 deferred (rare corrupted-journal edge case; assertNoTraversal + emptiness check still gate)
   - C5 applied (protocolSha256 recompute in orchestrator)
   - C6 applied (planRecordMigration error-on-non-matching-ref + orchestrator failed handling)
   - C7 applied (isProtocolDocumentV1 guard in orchestrator)
   - C8 applied (migrateInstalledRecords stub in makeService — CODE CHANGE STILL PENDING, see item 1)
   - S9 deferred (negligible perf)
   - S10 deferred (minor listFilesRecursive duplication)
3. **Flip `status: in-review` → `status: ready`** in the frontmatter (Step 9.2) once every resolution cell is filled.
4. **Present the plan location** (Step 9.3) with the summary (7 phases, counts, etc.).
5. **Next step for the user**: `/skill:implement .rpiv/artifacts/plans/2026-08-13_10-09-26_library-production-ready.md` (run in a fresh session via `/new`).

## Other Notes

- The 7 slices, in order: (1) slug+hash segment + derivation signatures; (2) preflight collision/dirty-slot split + lister injection; (3) recovery destination-folder orphan scan; (4) one-time slug→slug+hash migration; (5) local package builder; (6) export modal + command; (7) uninstall UI.
- Each Phase's `### Success Criteria:` Automated bullet uses commands scoped to that phase's `files:` (write-scoped for parallel implement). `npm run check` is the terminal-gate on Phase 7 only.
- i18n en/ru parity (Check 7, `scripts/check-consistency.mjs`) is a hard constraint — every new `library.*` key added in Phases 2/6/7 must be in BOTH `en.json` and `ru.json`.
- Deployment note: Phases 1 + 4 must ship together as one release — Phase 1 rekeys destinations on slug+hash, and Phase 4's migration (runs on load before views) moves pre-existing records to the new paths; a pre-migration record is un-uninstallable until the migration completes (readMarker looks up the new slot).
- The plan stays inside `src/library/` + views + tests + i18n; `ProtocolDocumentV1` and the manifest wire shape (`INSTALLED_RECORD_VERSION = 1`, `isPackageManifest`, `isInstalledRecord`) are NOT changed, and `slugifyLabel` (`src/snippets/snippet-model.ts`) is NOT touched.
