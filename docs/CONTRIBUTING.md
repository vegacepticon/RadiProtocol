# Contributing to RadiProtocol

Thanks for considering a contribution. This document covers the practical
parts of working on the plugin: dev environment setup, the test and lint
gates, branch naming, and the PR flow.

> **Localisation note.** This document is currently English-only; a Russian
> translation is future work.

## Dev environment

RadiProtocol is a TypeScript plugin built with esbuild. You need Node.js and
npm available locally (Obsidian itself does not need to be installed for
unit tests, but you'll need it to test changes against a vault).

Clone the repo and install dependencies:

```bash
git clone <your-fork>
cd RadiProtocol
npm install
```

### Watch build (for vault testing)

```bash
npm run dev
```

This runs esbuild in watch mode, regenerating `main.js` and `styles.css` on
every save. Symlink the project directory into a test vault's
`.obsidian/plugins/radiprotocol/` so Obsidian picks up the build.

### Production build

```bash
npm run build
```

Runs `tsc --noEmit` (type-check) followed by an esbuild production bundle.
This is the same command CI/release scripts use; it must pass before a PR is
ready for review.

## Test gate

```bash
npm test
```

Runs the full vitest suite. The test suite covers parser, validator, runner
state machine, snippet model, view-layer wiring, and many edge cases. Tests
must pass on every PR — there is no skip-list.

If you add a new feature, add tests for it. The closest existing test file
is usually a good template; the project keeps test fixtures alongside the
tests in `src/__tests__/fixtures/`.

## Lint gate

```bash
npm run lint
```

Runs ESLint on TypeScript sources and Stylelint on CSS files under
`src/styles/`. New code should not introduce additional warnings or errors.

There are two pre-existing warnings in `src/snippets/snippet-service.ts`
about `Vault.trash()` vs `FileManager.trashFile()` — those are tracked
separately and acceptable in current PRs.

## Git hooks

Repository hooks live under `.githooks/`. To enable them for your clone, point
Git's `hooks-path` config at the repo's `.githooks/` directory once:

```bash
git config core.hooksPath .githooks
```

The pre-commit hook is a fast gate for staged `*.ts` and `*.css` files: ESLint,
Stylelint, and affected Vitest tests via `vitest --changed`. Docs-only commits
skip this gate.

The pre-push hook is the full local regression gate: ESLint, Stylelint, and the
entire Vitest suite. Bypass with `git commit --no-verify` or `git push --no-verify`
only when you have a good reason (and explain it in the PR).

## Branch naming

Use `dev/<task-slug>` for feature branches, e.g.
`dev/v1.14-i18n-docs-infra`. Slugs should be short and grep-able. `main` is
the integration branch — open PRs against it.

## Pull requests

There is no PR template. Aim for:

- A focused diff — one logical change per PR.
- A description that says **what** and **why** (the **how** is in the diff).
- Green build, lint, and test gates.
- Updated tests or docs when the change requires them.

If your work spans multiple plans inside a phase (the project uses
[GSD-style](https://github.com/anthropics/get-shit-done) phase-and-plan
artefacts under `.planning/`), it's fine to bundle them in a single PR; just
make the commit history readable.
