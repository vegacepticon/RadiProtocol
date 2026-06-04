---
date: 2026-06-04T18:23:29+0300
author: Roman Shulgha
commit: b145f15
branch: main
repository: RadiProtocol
topic: "Conservative cleanup, documentation, and release-process discovery"
tags: [intent, frd, cleanup, documentation, release]
status: complete
last_updated: 2026-06-04T18:23:29+0300
last_updated_by: Roman Shulgha
---

# FRD: Conservative cleanup, documentation, and release-process discovery

## Summary
Run a conservative, audit-only discovery pass that identifies safe repository cleanup, dead-code, documentation, and release-process improvements without changing source files. The pass should reduce maintainer burden, improve contributor/AI-agent clarity, and increase release confidence while preserving existing Obsidian plugin functionality.

## Problem & Intent
The developer's stated intent: "All of this: maintainer burden, contrubutor clarity and release confidence".

The initial request frames this as a conservative cleanup, documentation, and release-process discovery pass: investigate what can be safely improved without losing functionality; do not delete uncertain files or code; classify findings by confidence; and prefer small, reviewable recommendations that fit an AI-assisted development workflow.

## Goals
- Identify redundant, obsolete, duplicated, generated, temporary, stale-agent, or unused files/folders with evidence and confidence levels.
- Determine whether `.github` and `.githooks` should be kept, simplified, documented, or removed, using actual repository evidence.
- Identify dead code, unused exports/components, obsolete utilities, unused CSS, unreachable logic, and duplicated logic conservatively.
- Recommend maintainability improvements that are small, reviewable, and low-risk.
- Recommend a cleaner README/documentation structure, with a preference to split English and Russian user docs unless later evidence argues against it.
- Document or minimally tighten a simple release/versioning process, including where versions are stored and how bumps should be performed.

## Non-Goals
- Do not delete, move, refactor, or rewrite source/docs during this discovery pass.
- Do not perform broad refactors or behavior-changing cleanup.
- Do not introduce heavy release automation unless later research clearly justifies it.
- Do not treat uncertain indirect/runtime usage as safe to remove.

## Functional Requirements
1. The discovery SHALL produce an evidence-backed inventory of cleanup candidates, grouped by repository cleanup, `.github`/`.githooks`, dead code, maintainability, README/docs, and release/versioning.
2. The discovery SHALL classify each deletion or dead-code candidate as high, medium, or low confidence.
3. The discovery SHALL require high-confidence removal candidates to be supported by multiple signals, such as missing imports/references, no script/doc/runtime/manifest usage, and verification commands.
4. The discovery SHALL explicitly state when evidence is uncertain instead of guessing.
5. The discovery SHALL treat `.github` as active CI/release infrastructure unless later research finds contradictory evidence.
6. The discovery SHALL treat `.githooks` as useful but optional local tooling unless hook installation/configuration is found or added later.
7. The discovery SHALL audit README/docs structure and evaluate splitting `README.md` and `README.ru.md` as the preferred documentation shape.
8. The discovery SHALL find all version-bearing or release-relevant files, including package metadata, Obsidian manifest/version mapping, lockfiles, README release text, workflows, and generated release artifacts.
9. The discovery SHALL recommend a simple practical release checklist and only small release-process checks or workflow alignments.

## Non-Functional Requirements
- **Performance**: No runtime performance target; the pass is repository research/documentation only.
- **Security**: Preserve existing plugin behavior and do not introduce new secrets, publishing credentials, or broad GitHub token permissions beyond current release needs.
- **UX / Accessibility**: Documentation recommendations should improve readability for English and Russian users and clarity for maintainers/contributors.
- **Reliability**: Recommendations must preserve functionality, avoid speculative deletion, and require full repo verification before any later cleanup implementation.

## Constraints & Assumptions
- Repository: `RadiProtocol`, branch `main`, commit `b145f15`.
- Source-file changes are out of scope for this discover artifact; downstream research/plan/implement phases must handle changes separately.
- `.github` is assumed active because CI and release workflows exist and publish Obsidian plugin artifacts (`.github/workflows/ci.yml:29-45`, `.github/workflows/release.yml:31-58`).
- `.githooks` is assumed optional because hook scripts exist but no configured hook installer or `core.hooksPath` was found; the scripts run staged lint/tests and `npm run check` (`.githooks/pre-commit:19-34`, `.githooks/pre-push:10-11`).
- README currently contains English and Russian sections and hardcoded latest release text (`README.md:1-7`, `README.md:88-92`).
- README links documentation paths that were not present in this checkout (`README.md:78-82`, `README.md:163-167`).
- Release/versioning has an existing simple base through `package.json` version metadata, `version-bump.mjs`, and tag-triggered GitHub release publishing (`package.json:3`, `package.json:9`, `.github/workflows/release.yml:40-58`).

## Acceptance Criteria
- [ ] Running `/skill:research .rpiv/artifacts/discover/2026-06-04_18-23-29_conservative-cleanup-docs-release-discovery.md` writes a research artifact under `.rpiv/artifacts/research/` that covers all six focus areas from this FRD.
- [ ] The research artifact includes a `.github` section that states keep/simplify/remove and cites workflow evidence such as `.github/workflows/ci.yml:29-45` and `.github/workflows/release.yml:31-58`.
- [ ] The research artifact includes a `.githooks` section that states whether hooks are configured or optional and cites `.githooks/pre-commit:19-34`, `.githooks/pre-push:10-11`, and hook-installation search results.
- [ ] The research artifact includes a README/docs recommendation that explicitly evaluates `README.md` + `README.ru.md` and identifies broken/missing docs links.
- [ ] The research artifact includes a version/release map listing every version-bearing file found and a minimal release checklist.
- [ ] Every proposed deletion/removal candidate in the research artifact has a confidence rating and evidence from imports/references/scripts/docs/build/runtime checks.
- [ ] Before any later implementation removes or rewrites files, `npm run build`, `npm run lint`, and `npm test` must exit 0, plus targeted reference checks must be recorded for each removed item.

## Recommended Approach
Perform an audit-only codebase research pass that produces an evidence table and conservative recommendations; do not edit source files or delete artifacts in this phase. Downstream implementation, if approved, should be split into small reviewable cleanup/documentation/release-process changes with full repo gates before removal.

## Decisions

### Foundational intent
**Question**: For this conservative cleanup and release-process discovery pass, what problem are you solving and who feels the pain most today?
**Recommended**: n/a — `intent` question
**Chosen**: "All of this: maintainer burden, contrubutor clarity and release confidence"
**Rationale**: Developer supplied the problem framing in their own words.

### `.github` assumption
**Question**: From the probe I inferred: `.github` is active release/CI infrastructure, because CI runs build/lint/test/check scripts and release uploads `main.js`, `styles.css`, and `manifest.json` (`.github/workflows/ci.yml:29-45`, `.github/workflows/release.yml:31-58`). Keep that as an assumption?
**Recommended**: Confirm keep
**Chosen**: Confirm keep
**Rationale**: evidence: `.github/workflows/ci.yml:29-45` + `.github/workflows/release.yml:31-58` + confirmed.

### `.githooks` assumption
**Question**: From the probe I inferred: `.githooks` contains useful local gates, but I found no configured `core.hooksPath` or package hook installer, while hooks themselves run staged lint/tests and `npm run check` (`.githooks/pre-commit:19-34`, `.githooks/pre-push:10-11`). How should the discovery treat it?
**Recommended**: Optional docs
**Chosen**: Optional docs
**Rationale**: evidence: `.githooks/pre-commit:19-34` + `.githooks/pre-push:10-11` + confirmed; no hook installation was found in repo-local searches.

### Documentation cleanup scope
**Question**: From the probe I inferred: README is a large bilingual file and links docs that are absent in this checkout (`README.md:78-82`, `README.md:163-167`; `docs/` search returned no files). Should documentation cleanup include restructuring and fixing those links?
**Recommended**: Confirm cleanup
**Chosen**: Confirm cleanup
**Rationale**: evidence: `README.md:78-82` + `README.md:163-167` + confirmed.

### Release-process scope
**Question**: From the probe I inferred: release/versioning already has a simple base (`package.json:3`, `package.json:9`, `.github/workflows/release.yml:40-58`), but release-specific checks are not run by the release workflow (`package.json:18-19`, `.github/workflows/release.yml:31-38`). Should the discovery focus on documenting/minimally tightening this rather than heavy automation?
**Recommended**: Confirm minimal
**Chosen**: Confirm minimal
**Rationale**: evidence: `package.json:3`, `package.json:9`, `package.json:18-19`, `.github/workflows/release.yml:31-58` + confirmed.

### Deliverable boundary
**Question**: For the cleanup discovery, what should be the main deliverable boundary?
**Recommended**: Findings only — produce a research-ready requirements brief for a later codebase audit; classify candidates by confidence, but do not edit/delete source now.
**Chosen**: Findings only
**Rationale**: Preserves existing functionality and keeps the first pass conservative and reviewable.

### Confidence policy
**Question**: For dead-code and cleanup findings, how conservative should the confidence policy be?
**Recommended**: High evidence gate — require removals to be backed by multiple signals such as no imports/references, no scripts/docs/runtime manifest usage, and passing checks.
**Chosen**: High evidence gate
**Rationale**: Matches the request to avoid uncertain deletion and protect indirect Obsidian runtime usage.

### README shape
**Question**: For the bilingual README, which documentation shape should the later cleanup investigate and prefer unless evidence says otherwise?
**Recommended**: Split EN/RU — use `README.md` for English and `README.ru.md` for Russian.
**Chosen**: Split EN/RU
**Rationale**: Optimizes reader clarity and avoids one oversized bilingual README while preserving both audiences.

### Release shape
**Question**: For release/versioning requirements, which simple process should the FRD steer research toward?
**Recommended**: Checklist + small checks — document `npm version`/tag/release steps and consider minimal workflow/script alignment.
**Chosen**: Checklist + small checks
**Rationale**: Improves release confidence without introducing heavy automation.

### Verification level
**Question**: What verification level should acceptance criteria require for any later cleanup plan?
**Recommended**: Full repo gates — require at least `npm run build`, `npm run lint`, `npm test`, and targeted reference checks before removing anything.
**Chosen**: Full repo gates
**Rationale**: Ensures cleanup does not regress build, lint, tests, or reference integrity.

### Non-goal boundary
**Question**: Which non-goal boundary should be explicit so downstream research does not overreach?
**Recommended**: No source changes — discovery should not delete, move, refactor, or rewrite source/docs.
**Chosen**: No source changes
**Rationale**: Keeps discover/research separate from implementation and prevents accidental broad cleanup.

## Open Questions
None.

## References
- Free-text feature description supplied to `/skill:discover` on 2026-06-04T18:23:29+0300.
- `README.md`
- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.githooks/pre-commit`
- `.githooks/pre-push`
