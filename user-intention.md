# RadiProtocol — User Intention

## Direction
RadiProtocol is an Obsidian plugin for guided radiology protocol execution. The product direction is to make radiologists' daily workflow faster and more reliable through structured protocol execution, snippet reuse, visual `.rp.json` editing, and a shared community library.

## Current Focus (v1.20+)
- Snippet library: admin maintainer view, import from vault-created snippets, category tree navigation, and clear human-readable clinical/category labels.
- Inline runner UX: stable, polished, no layout jitter; preserve inline-only architecture.
- Protocol editor: visual `.rp.json` editing with node drag-to-create and safe graph validation.
- i18n: audit is effectively complete; remaining work should be annotations or true newly discovered user-facing strings only.
- Test coverage: add regression tests for new behavior and risky refactors; do not add tests just to satisfy vanity coverage.

## Boundaries (Do Not)
- No web app, backend, auth, or payments until MVP is solid.
- No sidebar/RunnerView restoration (inline-only per ADR-0001).
- No premature abstraction — ship concrete plugin-local features first.
- No auto-generated code from brainstorm pool — changes must be scoped, reviewed, and tested.
- No further i18n churn unless a real user-facing hardcoded string is found or new UI copy is added.
- No broad refactors without a narrow, verifiable reason and passing `npm run check`.

## Quality Bar
- Every code change must pass `npm run check` (build + lint + tests + planning + consistency) before being marked complete.
- No orphan CSS, no hardcoded user-facing strings in UI code, no untranslated aria labels/placeholders/buttons.
- Generated root `main.js` and `styles.css` must only change through the build pipeline.
- Git tags are numeric (no v-prefix), releases via `npm version X.Y.Z`.

## HESO Operating Preference
- Prefer small, commit-sized tasks that improve RadiProtocol plugin usability now.
- When a user reports testing feedback, first capture the concrete UX pain, then convert it into the smallest actionable todo.
- If a proposed feature expands scope or infrastructure, ask before dispatching it.
- Roman reviews and merges HESO branches; HESO never pushes or merges to `main`.