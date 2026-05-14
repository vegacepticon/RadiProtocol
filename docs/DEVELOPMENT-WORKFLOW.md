# RadiProtocol development workflow

This document is the durable development workflow for RadiProtocol. It exists so future agent sessions do not treat stale local planning artifacts as project truth.

## Sources of truth

Use these in order:

1. **Git + GitHub state** — current branch, commits, tags, releases, CI.
2. **Tracked project docs** — `README.md`, `docs/`, `docs/adr/`, `CLAUDE.md`, package scripts, CI workflows.
3. **Code and tests** — runtime behavior, public commands, i18n keys, fixtures.
4. **Local `.planning/`** — historical GSD scratchpad only. Useful as context, never authoritative without verification.

If `.planning/` contradicts git, release tags, package versions, code, or tracked docs, treat `.planning/` as stale and update or ignore it.

## Session start checklist

Before starting implementation:

```bash
git fetch --all --tags --prune
git status --short --branch
node -e "for (const f of ['package.json','manifest.json']) console.log(f, require('./'+f).version)"
git tag --sort=-v:refname | head -10
npm run check:planning
```

For release-related work, also verify GitHub releases directly rather than relying on notes:

```bash
curl -s https://api.github.com/repos/vegacepticon/RadiProtocol/releases?per_page=5
```

## Planning discipline

- Keep `.planning/` local and gitignored.
- Do not add `.planning/` files to git.
- Do not link source files or public docs to `.planning/` as required design context.
- Promote durable architectural decisions into `docs/adr/`.
- Promote implementation-relevant notes into `docs/ARCHITECTURE-NOTES.md` or a focused tracked doc.
- Do not create a new large phase plan when the next step is a small executable fix.

## Implementation loop

1. Define one commit-sized goal.
2. Inspect relevant code/tests before editing.
3. Make the smallest scoped change.
4. Add or update tests when behavior changes.
5. Run targeted verification first if useful.
6. Run the full gate before PR/release:

```bash
npm run check
```

`npm run check` runs build, strict lint, tests, and planning freshness validation.

## Agent usage

- Prefer direct Hermes edits for small and medium scoped changes.
- Use bounded subagents only when fresh isolated review or multi-file implementation is worth the overhead.
- Do not use unavailable external coding agents as a blocker.
- Every agent-produced diff must be independently reviewed with `git diff` and verified with tests/build/lint.
- Do not commit or push production/release changes without checking actual repo and GitHub state.

## Cleanup rules

- Clean dead code and orphaned CSS only with explicit scope.
- Keep cleanup commits separate from behavior changes when practical.
- Use `docs/adr/` for architecture removals, especially when removing a UI host or persistence path.
- After deleting a component/view, search for stale docs, tests, styles, imports, i18n keys, and generated references.

## Release discipline

- `package.json`, `manifest.json`, `versions.json`, and git tags must stay aligned.
- Use the repository versioning workflow; do not hand-edit one version file in isolation.
- For BRAT/GitHub releases, verify the GitHub Release and assets, not just the local tag.

## Failure mode this workflow prevents

Past sessions treated stale `.planning/` milestone files as current project state after the plugin had already shipped newer releases. That caused re-planning around obsolete phases. The fix is deliberate: local planning remains useful memory, but tracked docs, code, tests, git tags, and release artifacts are authoritative.
