---
date: 2026-06-04T18:40:54+0300
author: Roman Shulgha
commit: b145f15
branch: main
repository: RadiProtocol
topic: "Conservative cleanup, documentation, and release-process discovery"
tags: [research, codebase, cleanup, documentation, release, github-actions, githooks, css, graph]
status: complete
last_updated: 2026-06-04T18:40:54+0300
last_updated_by: Roman Shulgha
---

# Research: Conservative cleanup, documentation, and release-process discovery

## Research Question
Run an audit-only research pass for conservative repository cleanup, documentation cleanup, dead-code candidates, `.github`/`.githooks`, and release/versioning. Classify deletion/removal candidates by confidence, preserve existing Obsidian plugin behavior, and identify small reviewable cleanup/documentation/release-process improvements without editing source files in this phase.

## Summary
RadiProtocol has several cleanup opportunities, but most apparent root-level artifacts are not safe deletion targets. Root `main.js` and `styles.css` are generated and git-ignored, yet they are required release/install artifacts produced by the build and uploaded by the release workflow. `.github` is active CI/release infrastructure; `.githooks` are useful optional local tooling because the repo contains hook definitions but no installer or configured `core.hooksPath`. The largest process gap is that `package.json` and CI reference custom `scripts/*.mjs` gates that are absent in this checkout; the developer confirmed the intended direction is to restore those scripts rather than remove the gate intent. Documentation cleanup should split English/Russian README content, fix missing `docs/` links, and remove hardcoded README latest-release text because version propagation does not update it and precedents show repeated drift.

## Detailed Findings

### Generated Plugin Artifacts and Build Outputs
- `package.json:7-8` defines `dev` and `build`; `build` type-checks and runs production esbuild.
- `esbuild.config.mjs:100` bundles from `src/main.ts`; `esbuild.config.mjs:123` writes root `main.js`.
- `esbuild.config.mjs:31-39` lists source CSS files in `CSS_FILES`; `esbuild.config.mjs:52-57` reads `src/styles/${name}.css`, joins them, and writes root `styles.css`.
- `.gitignore:5-8` ignores `main.js`, `main.js.map`, `styles.css`, and legacy `src/styles.css` as build outputs.
- `.github/workflows/release.yml:31-38` builds/lints/tests before release; `.github/workflows/release.yml:51-57` uploads `main.js`, `styles.css`, and `manifest.json`.
- `README.md:39-42` and `README.md:124-127` tell users to manually install the same three release assets.
- `user-intention.md:31` says generated root `main.js` and `styles.css` must only change through the build pipeline.

**Cleanup classification:**

| Candidate | Confidence | Classification | Evidence |
|---|---:|---|---|
| Root `main.js` | High | Generated but required release artifact; do not source-edit; regenerate via build | `.gitignore:5`, `esbuild.config.mjs:123`, `.github/workflows/release.yml:55`, `README.md:39-40` |
| Root `styles.css` | High | Generated but required release artifact; do not source-edit; regenerate via build | `.gitignore:7`, `esbuild.config.mjs:52-57`, `.github/workflows/release.yml:56`, `README.md:39-40` |
| `main.js.map` if present | High | Removable build output; not uploaded or documented for install | `.gitignore:6`, `esbuild.config.mjs:121`, `.github/workflows/release.yml:54-57` |
| `src/styles.css` if present | High | Removable legacy output; current build reads `src/styles/*.css` instead | `.gitignore:8`, `esbuild.config.mjs:52-54` |
| `manifest.json` | High | Required release/version artifact, not generated disposable output | `.github/workflows/release.yml:57`, `README.md:39-40`, `version-bump.mjs:6-11` |

### Repository Gates, Missing Scripts, and Release Confidence
- `package.json:13-17` defines five custom checks under `scripts/`: planning freshness, consistency, agent docs, CSS class audit, and i18n audit.
- `package.json:18` defines `check` as build + lint + test + planning + consistency + agent docs.
- `package.json:19` defines `check:release` as `check` + CSS class audit + i18n audit.
- File search found no `scripts/` directory in this checkout, so `scripts/check-planning-freshness.mjs`, `scripts/check-consistency.mjs`, `scripts/check-agent-docs.mjs`, `scripts/check-css-classes.mjs`, and `scripts/audit-i18n-ui-text.mjs` are absent.
- `.github/workflows/ci.yml:29-45` runs build, lint, test, planning freshness, consistency, and agent-docs as separate steps, so CI depends on the missing custom scripts.
- `.githooks/pre-push:10-11` runs `npm run check`, so pre-push also depends on the missing scripts if hooks are installed.
- `.github/workflows/release.yml:31-38` runs only build, lint, and test before the version/tag check; it does not run `npm run check` or `npm run check:release`.
- Developer checkpoint answer: missing custom gates should be treated as accidental drift and restored, not simplified away.

**Cleanup classification:**

| Candidate | Confidence | Classification | Evidence |
|---|---:|---|---|
| Missing `scripts/*.mjs` gate files | High | Process drift / broken gate surface; restore intended scripts before relying on full checks | `package.json:13-19`, `.github/workflows/ci.yml:38-45`, empty `scripts/` search |
| Release workflow gate subset | High | Weaker than package-level release intent | `.github/workflows/release.yml:31-38`, `package.json:18-19` |
| `npm run check` as current full verification | Medium | Intended full gate, but not runnable until missing scripts are restored | `package.json:18`, empty `scripts/` search |

### `.github` Infrastructure
- `.github/workflows/ci.yml:1-7` runs on pushes to `main` and `dev/**` plus pull requests.
- `.github/workflows/ci.yml:20-27` checks out the repo, sets up Node 22, and installs with `npm ci`.
- `.github/workflows/ci.yml:29-45` runs build, lint, tests, and three custom checks.
- `.github/workflows/release.yml:4-9` triggers on numeric and `v`-prefixed semver/pre-release tags.
- `.github/workflows/release.yml:40-49` strips an optional `v` prefix and compares the tag to `manifest.json.version`.
- `.github/workflows/release.yml:51-58` publishes GitHub release assets using `softprops/action-gh-release`.

**Classification:** `.github` is active CI/release infrastructure and should be kept. Cleanup should focus on restoring gate parity and documenting release behavior, not removing the directory.

### `.githooks` Status
- `.githooks/pre-commit:1-4` documents a fast pre-commit gate and bypass command.
- `.githooks/pre-commit:10-16` only proceeds when staged TS/CSS files exist.
- `.githooks/pre-commit:19-34` runs staged ESLint, staged Stylelint, and `npx vitest run --changed`.
- `.githooks/pre-push:1-4` documents a full local pre-push gate and bypass command.
- `.githooks/pre-push:10-11` runs `npm run check`.
- `package.json:6-20` has no `prepare`, `postinstall`, `.githooks`, Husky, or Lefthook installer script.
- `package.json:24-45` has no Husky/Lefthook dependency.
- Local `.git/config` search found no `core.hooksPath` entry.

**Classification:** `.githooks` is useful optional local tooling. It should be documented or installed explicitly if desired, but the repository does not currently prove automatic hook activation.

### Version Propagation and Release Map
- `package.json:3` declares version `1.23.4`.
- `package.json:9` runs `node version-bump.mjs && git add manifest.json versions.json` during npm's `version` lifecycle.
- `version-bump.mjs:3` reads `process.env.npm_package_version`.
- `version-bump.mjs:6-11` reads `manifest.json`, preserves `minAppVersion`, and writes `manifest.version` to the npm package version.
- `version-bump.mjs:14-16` writes `versions[targetVersion] = minAppVersion`.
- `manifest.json:4` currently has `minAppVersion` `1.5.7`; `manifest.json:10` currently has version `1.23.4`.
- `versions.json:91-93` maps `1.23.2`, `1.23.3`, and `1.23.4` to `1.5.7`.
- `package-lock.json:3` and `package-lock.json:9` also carry version `1.23.4`, but `version-bump.mjs` does not write the lockfile.
- `.npmrc:1` sets `tag-version-prefix=""`, aligning with `user-intention.md:32` numeric-tag guidance.
- `.github/workflows/release.yml:4-9` still accepts both numeric and `v`-prefixed tags; `.github/workflows/release.yml:42-48` strips `v` before comparing against `manifest.json.version`.
- `README.md:7` and `README.md:92` hardcode latest release text and are outside `version-bump.mjs` propagation.
- Developer checkpoint answer: later cleanup should remove hardcoded README latest-release text and point users at GitHub Releases instead of maintaining duplicate version state.

**Version-bearing file map:**

| File | Role | Updated by current npm/version path? |
|---|---|---|
| `package.json:3` | npm package version source | yes, by `npm version` |
| `package-lock.json:3`, `package-lock.json:9` | lockfile mirrors package version | yes, by npm version operation, not `version-bump.mjs` |
| `manifest.json:10` | Obsidian plugin version and release tag comparison target | yes, by `version-bump.mjs:10-11` |
| `versions.json:91-93` | Obsidian version-to-minAppVersion compatibility map | yes, by `version-bump.mjs:14-16` |
| `README.md:7`, `README.md:92` | duplicated latest-release documentation text | no; developer chose removal in later cleanup |
| `.github/workflows/release.yml:4-9`, `40-49` | accepted tag patterns and release-time version check | no version literal, but release-policy bearing |
| `.npmrc:1` | numeric tag policy | no version literal, but release-policy bearing |

**Minimal release checklist facts from current repo:**
1. Use numeric tags via `npm version X.Y.Z` per `.npmrc:1` and `user-intention.md:32`.
2. Ensure `package.json`, `package-lock.json`, `manifest.json`, and `versions.json` all reflect the target version/minAppVersion mapping (`package.json:3`, `package-lock.json:3`, `manifest.json:10`, `versions.json:93`).
3. Restore missing custom gate scripts before treating `npm run check` / `npm run check:release` as authoritative (`package.json:13-19`).
4. Run build/lint/test and the restored release checks before tagging (`package.json:8-19`).
5. Push a version tag that matches `manifest.json.version`; the workflow strips optional `v` but project policy prefers numeric tags (`.github/workflows/release.yml:42-48`, `user-intention.md:32`).
6. Release assets are generated `main.js`, generated `styles.css`, and tracked `manifest.json` (`.github/workflows/release.yml:54-57`).

### README and Documentation Surface
- English README content spans `README.md:1-82`; Russian content spans `README.md:86-167`; shared license text follows at `README.md:169-171`.
- Both sections contain mirrored installation, setup, protocol creation, snippets, existing canvas, and documentation sections.
- `README.md:63`, `README.md:80`, `README.md:148`, and `README.md:165` link `docs/PROTOCOL-AUTHORING.md`.
- `README.md:81` and `README.md:166` link `docs/CONTRIBUTING.md`.
- `README.md:82` and `README.md:167` link `docs/adr/0001-inline-runner-only.md`.
- File search found no `docs/` directory in this checkout, so those docs links are broken/missing.
- `README.md:39` and `README.md:124` reference the same manual install assets that the release workflow uploads at `.github/workflows/release.yml:55-57`.

**Classification:** README split and broken-link repair are high-confidence documentation cleanup candidates. The preferred shape remains `README.md` for English and `README.ru.md` for Russian, with hardcoded latest-release text removed.

### Deprecated Legacy Loop Support
- `src/graph/graph-model.ts:4-8` documents that unified `loop` exists while `loop-start`/`loop-end` remain legacy parseable kinds.
- `src/graph/graph-model.ts:9-17` includes deprecated `loop-start` and `loop-end` in `RPNodeKind`.
- `src/graph/graph-model.ts:65-82` defines deprecated `LoopStartNode` and `LoopEndNode` with migration context.
- `src/graph/graph-model.ts:115-123` keeps both deprecated interfaces in `RPNode`.
- `src/protocol/protocol-document-parser.ts:16-17` imports legacy node types; `src/protocol/protocol-document-parser.ts:27-36` includes legacy kinds in `VALID_KINDS`.
- `src/protocol/protocol-document-parser.ts:239-253` constructs `loop-start` and `loop-end` nodes instead of dropping them as unknown.
- `src/graph/graph-validator.ts:65-78` detects legacy loop nodes, emits the migration error, and returns before reachability/cycle/loop checks to avoid spurious errors.
- `src/runner/protocol-runner.ts:807-812` has a defensive runtime fallback if validation is bypassed.
- `src/__tests__/graph-validator.test.ts:305-347` asserts migration errors and ordering; fixtures include legacy loop canvas nodes.

**Classification:** deprecated but deliberate compatibility/migration artifacts. They are not high-confidence dead code and should not be removed in a conservative cleanup without a separate migration/removal plan.

### Shared-Library Removal Remnants
- `src/__mocks__/obsidian.ts:308` exports a test-only `requestUrl()` mock.
- `vitest.config.ts:6-7` aliases `obsidian` to `src/__mocks__/obsidian.ts` for tests.
- `esbuild.config.mjs:100-103` production-bundles `src/main.ts` and treats real `obsidian` as external, so the mock is not production-bundled.
- Current grep evidence found no production or test import of `requestUrl`; only the mock definition remains.
- `src/i18n/locales/en.json:216` says `Snippet library is empty`, but this key is live: `src/views/snippet-manager/tree-renderer.ts:123` renders `t('snippetManager.emptyStateTitle')` in the empty local snippet tree.
- `src/styles/snippet-manager.css:301-302` includes an empty-library comment and `.radi-snippet-tree-empty-state`; the class is created at `src/views/snippet-manager/tree-renderer.ts:122`.
- `src/views/snippet-manager-view.ts:3` uses “snippet library” in a file comment; current imports at `src/views/snippet-manager-view.ts:9-18` show active snippet-manager dependencies, not removed shared-library services.
- Prior cleanup research recorded removed shared-library targets in `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md:22` and old test-stub references at `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md:235-238`.

**Cleanup classification:**

| Candidate | Confidence | Classification | Evidence |
|---|---:|---|---|
| `src/__mocks__/obsidian.ts:308` `requestUrl` export | Medium-high | Harmless dead test-support remnant; removable if tests/type-check pass | `vitest.config.ts:6-7`, no current imports, `esbuild.config.mjs:100-103` |
| `src/i18n/locales/en.json:216` “Snippet library is empty” | High | Live user-facing local snippet-manager wording; not dead | `src/views/snippet-manager/tree-renderer.ts:120-123` |
| `src/styles/snippet-manager.css:301-302` | High | Live CSS selector with stale-ish comment terminology; not dead CSS | `src/views/snippet-manager/tree-renderer.ts:122` |
| `src/views/snippet-manager-view.ts:3` | High | Harmless comment terminology | `src/views/snippet-manager-view.ts:9-18` |

### Source CSS Cleanup Scope
- `esbuild.config.mjs:28-39` establishes the source CSS manifest and per-feature file convention.
- `esbuild.config.mjs:52-57` concatenates source files into generated root `styles.css`.
- `package.json:10` runs Stylelint over `src/styles/**/*.css`, not root `styles.css`.
- `stylelint.config.mjs:3-15` uses standard Stylelint plus duplicate-property and selector validity checks, but no required phase-header enforcement.
- `stylelint.config.mjs:19-37` disables several noisy rules including class-name pattern, duplicate selectors, empty blocks, and Obsidian-variable-conflicting rules.
- `package.json:16` references `check:css`; `package.json:19` includes it in `check:release`, but the corresponding script file is absent.
- Runtime class construction means static selector grep is insufficient: examples include `src/views/snippet-fill-in-modal.ts:176-177` selected-state classes, `src/views/snippet-tree-picker.ts:274` committed folder button state, `src/views/inline-runner-modal.ts:416-422` runner layout state classes, and `src/views/protocol-editor-view.ts:1229` dynamically built minimap node-kind classes.

**Classification:** source CSS cleanup is possible only after source-selector-to-runtime evidence. Generated root `styles.css` should be regenerated, not directly edited. The absent CSS-class audit script is part of the same gate restoration issue.

## Code References
- `package.json:7-19` — dev/build/version/lint/test/check/check:release script definitions.
- `esbuild.config.mjs:31-39` — ordered CSS source manifest.
- `esbuild.config.mjs:52-57` — source CSS concatenation to root `styles.css`.
- `esbuild.config.mjs:100-124` — bundle entry, external Obsidian module, source map/minify, output `main.js`.
- `.gitignore:5-8` — ignored generated outputs.
- `.github/workflows/ci.yml:29-45` — CI verification steps.
- `.github/workflows/release.yml:4-9` — accepted release tag patterns.
- `.github/workflows/release.yml:31-58` — release build/lint/test, tag-vs-manifest check, and asset upload.
- `.githooks/pre-commit:10-34` — staged TS/CSS lint plus changed tests.
- `.githooks/pre-push:10-11` — local full check wrapper.
- `version-bump.mjs:3-16` — package-version to manifest/version-map propagation.
- `manifest.json:4-10` — min app version and current plugin version.
- `versions.json:91-93` — latest version-to-minAppVersion entries.
- `package-lock.json:3-9` — lockfile package version mirrors.
- `.npmrc:1` — numeric tag prefix policy.
- `user-intention.md:29-32` — quality bar, generated-output boundary, numeric-tag release guidance.
- `README.md:1-82` — English README surface.
- `README.md:86-167` — Russian README surface.
- `README.md:39-42`, `README.md:124-127` — manual install artifact instructions.
- `README.md:63`, `80-82`, `148`, `165-167` — missing docs links.
- `src/graph/graph-model.ts:9-17` — node-kind union including deprecated loop kinds.
- `src/graph/graph-model.ts:65-82` — deprecated legacy loop interfaces and migration notes.
- `src/protocol/protocol-document-parser.ts:27-36` — parser valid kinds include legacy loop kinds.
- `src/protocol/protocol-document-parser.ts:239-253` — parser constructs legacy loop nodes.
- `src/graph/graph-validator.ts:65-78` — validator migration rejection gate for legacy loop nodes.
- `src/runner/protocol-runner.ts:807-812` — defensive runtime fallback for legacy loop nodes.
- `src/__mocks__/obsidian.ts:308` — unused test-only `requestUrl` mock export.
- `vitest.config.ts:6-7` — test alias for Obsidian mock.
- `src/i18n/locales/en.json:216` — live local snippet empty-state wording.
- `src/views/snippet-manager/tree-renderer.ts:120-123` — live empty-state DOM and i18n use.
- `src/styles/snippet-manager.css:301-302` — live empty-state CSS area.
- `stylelint.config.mjs:3-37` — current Stylelint coverage and disabled rules.

## Integration Points

### Inbound References
- `.github/workflows/ci.yml:29-45` — consumes package scripts for CI verification.
- `.github/workflows/release.yml:31-58` — consumes package build/lint/test scripts and release assets.
- `.githooks/pre-push:10-11` — consumes `npm run check`.
- `.githooks/pre-commit:19-34` — consumes local `npx eslint`, `npx stylelint`, and `npx vitest run --changed`.
- `README.md:39-42`, `README.md:124-127` — user-facing install docs consume the release artifact set.
- `vitest.config.ts:6-7` — tests consume `src/__mocks__/obsidian.ts` as the Obsidian alias.
- `src/views/inline-runner-modal.ts:176-191` — validates parsed graphs before runner start, making legacy loop parser/validator behavior user-facing.
- `src/views/snippet-manager/tree-renderer.ts:120-123` — consumes snippet-manager empty-state i18n and CSS.

### Outbound Dependencies
- `esbuild.config.mjs:4-5` — depends on Node `fs`/`path` to concatenate CSS and copy dev-vault files.
- `esbuild.config.mjs:52-57` — depends on each `src/styles/${name}.css` listed in `CSS_FILES`.
- `version-bump.mjs:1-16` — depends on `manifest.json` and `versions.json` file reads/writes.
- `package.json:13-17` — depends on missing `scripts/*.mjs` files.
- `.github/workflows/release.yml:44-48` — depends on `manifest.json.version` matching the pushed tag.
- `src/protocol/protocol-document-parser.ts:239-253` — depends on legacy field names for parseable migration nodes.
- `src/graph/graph-validator.ts:77` — depends on i18n migration message keys for user-facing validation errors.

### Infrastructure Wiring
- `package.json:9` — npm `version` lifecycle wires version propagation to `version-bump.mjs`.
- `.npmrc:1` — configures numeric `npm version` tags.
- `.github/workflows/release.yml:4-9` — release trigger accepts both numeric and `v`-prefixed semver/pre-release tags.
- `.github/workflows/release.yml:51-58` — GitHub release publishing uses `softprops/action-gh-release` with `contents: write` permission.
- `esbuild.config.mjs:60-93` — optional dev-vault copy wiring uses `OBSIDIAN_DEV_VAULT_PATH`.
- `package.json:10` and `stylelint.config.mjs:3-37` — source CSS lint wiring.
- `package.json:16-19` — intended CSS/i18n release audit wiring, currently blocked by absent script files.

## Architecture Insights
- Generated root assets are simultaneously ignored build outputs and required Obsidian distribution files; cleanup must distinguish “do not commit/source-edit” from “do not delete from release.”
- Gate parity is a release-confidence dependency. Current package/CI intent is fuller than release automation, but the missing `scripts/` directory makes the intended full gate non-runnable.
- `.github` is active infrastructure. `.githooks` are optional local tools unless a hook installer or `core.hooksPath` configuration is added/documented.
- README is both user documentation and currently a version-bearing surface; hardcoded latest-release text creates drift because version propagation does not touch README.
- Deprecated legacy loop symbols are an intentional migration quarantine path: parser accepts, validator rejects early with a migration error, runner has a defensive fallback, and tests assert behavior.
- CSS cleanup must operate on `src/styles/*.css` and account for dynamic DOM classes; root `styles.css` is build output.
- Shared-library-removal cleanup is mostly complete; the remaining true dead-code candidate is test-scoped `requestUrl`, while “snippet library” wording remains live or harmless.

## Precedents & Lessons
5 similar past change groups analyzed.

### Precedent: Release hygiene, cleanup, and release checklist extraction
**Commit(s)**: `a72a971` — "chore: optimize-for-release — release hygiene, cleanup, extraction (#8)" (2026-05-27); `9d3cfc1` — "Dev/optimize for release (#12)" (2026-05-27)
**Blast radius**: 26 files across 6 layers
  `.github/` — CI simplification
  `package/` — package/version metadata adjustment
  `docs/` — release checklist and architecture notes
  `README.md` — release/version text adjustment
  `service/protocol/` — main wiring and resolver/writer cleanup
  `renderer/tests/styles/` — picker modal, CSS, fixtures

**Follow-up fixes**:
- `74913a8` — "docs: align README release to 1.22.8" (2026-05-28) — README release text drifted
- `ddaf072` — "docs: bump README version to 1.23.0" (2026-05-29) — README required manual sync
- `f075658` — "docs: bump README version to 1.23.1" (2026-05-29) — repeated README version sync
- `6657b8d` — "fix: complete library removal — delete files, clean settings, i18n, CSS, test mocks" (2026-06-02) — cleanup left residual references

**Lessons from docs**:
- `.rpiv/artifacts/discover/2026-06-04_18-23-29_conservative-cleanup-docs-release-discovery.md` — audit first; map version-bearing files; keep release/process tightening minimal

**Takeaway**: Release cleanup needs a version-source map or README/package/manifest drift recurs.

### Precedent: CI, release workflow, and local hook gates
**Commit(s)**: `8dee957` — "feat(78): install lint + test automation gate (pre-commit hook + GitHub Actions CI)" (2026-05-01); `bfc21fc` — "ci: run CI on dev branches + add release workflow" (2026-05-04); `dd1450b` — "chore(hooks): split pre-commit (fast lint+affected-tests) and pre-push (full suite)" (2026-05-05)
**Blast radius**: 14+ files across 5 layers
  `.github/workflows/` — CI and release publishing
  `.githooks/` — local pre-commit/pre-push gates
  `package/` — scripts/deps aligned with gates
  `scripts/` — consistency/cleanup tooling
  `docs/planning/` — workflow guidance

**Follow-up fixes**:
- `856565c` — "fix(ci): use Node 22 + regenerate package-lock.json for npm ci" (2026-05-02)
- `5229230` — "fix(ci): update actions/checkout and actions/setup-node to v5" (2026-05-02)
- `4907561` — "ci: support pre-release tags in release workflow" (2026-05-05)
- `87611d8` — "ci: strip v prefix when comparing tag to manifest version" (2026-05-05)
- `6ee0e34` — "chore: tighten local gates and remove dead helpers" (2026-05-05)

**Lessons from docs**:
- `.rpiv/artifacts/discover/2026-06-04_18-23-29_conservative-cleanup-docs-release-discovery.md` — `.github` is active CI/release infra; `.githooks` are useful but optional without installer evidence

**Takeaway**: Workflow edits expose environment and tag-format bugs quickly; hook optionality should be documented before tightening gates.

### Precedent: High-confidence removal of abandoned UI/library code
**Commit(s)**: `e1d9b3a` — "chore: remove unused admin panel" (2026-05-28); `7e2918f` — "fix: disconnect shared library subsystem from plugin wiring" (2026-06-02); `6657b8d` — "fix: complete library removal — delete files, clean settings, i18n, CSS, test mocks" (2026-06-02)
**Blast radius**: 45 files across 7 layers
  `build/` — CSS entries
  `settings/` — dead settings/defaults
  `i18n/` — en/ru keys
  `styles/` — library/admin CSS
  `service/protocol/snippets/` — abandoned services/models
  `renderer/views/` — modals/buttons/wiring
  `tests/mocks/` — stale references

**Follow-up fixes**:
- `a30260a` — "chore: update package-lock.json" (2026-06-02)
- `85fbf9b` — "fix: address protocol-editor validation gaps" (2026-06-04)

**Lessons from docs**:
- `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md` — import/reference analysis must include callbacks, tests, CSS, and i18n
- `.rpiv/artifacts/plans/2026-06-02_18-26-22_cleanup-and-ux-fixes.md` — deletion order matters when compiled dependents still reference removed plugin fields

**Takeaway**: Remove closed subgraphs in ordered slices and verify imports/wiring, CSS, i18n, tests, build/lint/test.

### Precedent: Build scaffold, esbuild, package metadata, and version bump script
**Commit(s)**: `3866fdb` — "chore(01-01): add package.json, tsconfig.json, manifest.json, versions.json, styles.css" (2026-04-05); `0a670ac` — "chore(01-01): add esbuild.config.mjs with dev vault copy, .env.example, .gitignore" (2026-04-05); `d588246` — "chore(01-01): add version-bump.mjs and LICENSE; restore manifest/versions after test run" (2026-04-05)
**Blast radius**: 10 files across 4 layers
  `build/` — esbuild bundle/dev-vault copy
  `package/` — package metadata and scripts
  `release/` — manifest, versions, version-bump
  `docs/legal/dev/` — LICENSE, env/gitignore scaffold

**Follow-up fixes**:
- `f061292` — "test(18): complete UAT — 3/3 passed, build pipeline fix (cssPlugin)" (2026-04-10)
- `ad262de` — "build: drop duplicate src/styles.css write from esbuild" (2026-04-30)
- `33c3e9b` — "chore: sync package.json version with manifest (1.15.0-beta.2)" (2026-05-05)

**Lessons from docs**:
- `.rpiv/artifacts/discover/2026-06-04_18-23-29_conservative-cleanup-docs-release-discovery.md` — release base is `package.json`, `version-bump.mjs`, and tag-triggered release workflow

**Takeaway**: Treat esbuild output and version files as release-critical; verify generated artifacts and cross-file version sync.

### Precedent: Graph-model cleanup and Obsidian test mock maintenance
**Commit(s)**: `a633de8` — "feat(20-02): purge free-text-input from type model files" (2026-04-10); `b40a07f` — "feat(44-04): excise legacy maxIterations from graph-model, parser, editor-panel (RUN-07)" (2026-04-17); `8185dbb` — "feat(46-01): GREEN - excise free-text-input type; parser rejects legacy canvases with Russian error" (2026-04-18)
**Blast radius**: 13 files across 5 layers
  `domain/graph/` — graph model/parser/validator changes
  `runner/session/` — state/session types
  `renderer/` — editor-panel legacy UI
  `tests/fixtures/` — fixtures/tests
  `test-mocks/` — Obsidian mock adjustments

**Follow-up fixes**:
- `3c36e46` — "fix(25): add FuzzySuggestModal to Obsidian mock for test environment" (2026-04-11)
- `ede6d02` — "fix(29): WR-02 normalize null subfolderPath to undefined in canvas-parser snippet case" (2026-04-13)
- `99f8afa` — "fix(77-13): clear remaining 19 ESLint errors (unused vars, imports, rule violations)" (2026-05-01)

**Lessons from docs**:
- `.rpiv/artifacts/discover/2026-06-04_18-23-29_conservative-cleanup-docs-release-discovery.md` — uncertain indirect/runtime usage is not safe to remove; full repo gates are required before cleanup

**Takeaway**: Graph-model cleanup must include parser/validator/tests/mocks together; Obsidian mock parity is a recurring test-break risk.

### Composite Lessons
- Map all version-bearing/release files before edits: package metadata, lockfile, manifest/versions, README text, workflows, `.npmrc`, and generated assets.
- Keep `.github` active; treat `.githooks` as optional unless hook installation is documented or added.
- Restore or reconcile gate scripts before using `npm run check`/`check:release` as cleanup acceptance criteria.
- Cleanup removals need ordered closed-subgraph deletion plus grep/build/lint/test gates; CSS/i18n/test mocks are common leftovers.
- Avoid broad cleanup mixed with behavior changes; split docs, release/tooling, CSS, and source cleanup into small reviewable slices.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-06-04_18-23-29_conservative-cleanup-docs-release-discovery.md` — FRD for this conservative cleanup/docs/release audit.
- `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md` — prior cleanup/shared-library-removal research context.
- `.rpiv/artifacts/plans/2026-06-02_18-26-22_cleanup-and-ux-fixes.md` — prior cleanup implementation plan context.

## Developer Context
**Q (discover: Foundational intent): For this conservative cleanup and release-process discovery pass, what problem are you solving and who feels the pain most today?**
A: All of this: maintainer burden, contributor clarity and release confidence.

**Q (discover: `.github` assumption): From the probe I inferred: `.github` is active release/CI infrastructure, because CI runs build/lint/test/check scripts and release uploads `main.js`, `styles.css`, and `manifest.json` (`.github/workflows/ci.yml:29-45`, `.github/workflows/release.yml:31-58`). Keep that as an assumption?**
A: Confirm keep.

**Q (discover: `.githooks` assumption): From the probe I inferred: `.githooks` contains useful local gates, but I found no configured `core.hooksPath` or package hook installer, while hooks themselves run staged lint/tests and `npm run check` (`.githooks/pre-commit:19-34`, `.githooks/pre-push:10-11`). How should the discovery treat it?**
A: Optional docs.

**Q (discover: Documentation cleanup scope): From the probe I inferred: README is a large bilingual file and links docs that are absent in this checkout (`README.md:78-82`, `README.md:163-167`; `docs/` search returned no files). Should documentation cleanup include restructuring and fixing those links?**
A: Confirm cleanup.

**Q (discover: Release-process scope): From the probe I inferred: release/versioning already has a simple base (`package.json:3`, `package.json:9`, `.github/workflows/release.yml:40-58`), but release-specific checks are not run by the release workflow (`package.json:18-19`, `.github/workflows/release.yml:31-38`). Should the discovery focus on documenting/minimally tightening this rather than heavy automation?**
A: Confirm minimal.

**Q (discover: Deliverable boundary): For the cleanup discovery, what should be the main deliverable boundary?**
A: Findings only — produce a research-ready requirements brief for a later codebase audit; classify candidates by confidence, but do not edit/delete source now.

**Q (discover: Confidence policy): For dead-code and cleanup findings, how conservative should the confidence policy be?**
A: High evidence gate — require removals to be backed by multiple signals such as no imports/references, no scripts/docs/runtime manifest usage, and passing checks.

**Q (discover: README shape): For the bilingual README, which documentation shape should the later cleanup investigate and prefer unless evidence says otherwise?**
A: Split EN/RU — use `README.md` for English and `README.ru.md` for Russian.

**Q (discover: Release shape): For release/versioning requirements, which simple process should the FRD steer research toward?**
A: Checklist + small checks — document `npm version`/tag/release steps and consider minimal workflow/script alignment.

**Q (discover: Verification level): What verification level should acceptance criteria require for any later cleanup plan?**
A: Full repo gates — require at least `npm run build`, `npm run lint`, `npm test`, and targeted reference checks before removing anything.

**Q (discover: Non-goal boundary): Which non-goal boundary should be explicit so downstream research does not overreach?**
A: No source changes — discovery should not delete, move, refactor, or rewrite source/docs.

**Q (`package.json:13-19`, `.github/workflows/ci.yml:38-45`, `.github/workflows/release.yml:31-38`): Custom checks reference missing `scripts/*.mjs`, while release only runs build/lint/test. What is the intended direction for these missing gates?**
A: Restore scripts. Treat missing scripts as accidental drift and recommend restoring/recreating check scripts before relying on full gates.

**Q (`README.md:7`, `README.md:92`, `version-bump.mjs:3-16`): README hardcodes latest version outside automated version propagation. How should later cleanup treat README release text?**
A: Remove latest text. Point users to GitHub Releases instead of maintaining hardcoded latest-release lines.

## Related Research
- `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md`

## Open Questions
None.
