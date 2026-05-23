# RadiProtocol — User Intention

## Direction
RadiProtocol is an Obsidian plugin for guided radiology protocol execution. The product direction is to make radiologists' daily workflow faster and more reliable through structured protocol execution, snippet reuse, and a shared community library.

## Current Focus (v1.20+)
- Inline runner UX: stable, polished, no layout jitter
- Snippet library: admin maintainer view, import from vault-created snippets, category tree navigation
- Protocol editor: visual .rp.json editing with node drag-to-create
- i18n: all user-facing strings through translation service, EN+RU dictionaries

## Boundaries (Do Not)
- No web app, backend, auth, or payments until MVP is solid
- No sidebar/RunnerView restoration (inline-only per ADR-0001)
- No premature abstraction — ship concrete features first
- No auto-generated code from brainstorm pool — changes must be scoped, reviewed, tested

## Quality Bar
- Every change must pass `npm run check` (build + lint + tests + planning + consistency)
- No orphan CSS, no hardcoded strings in UI code
- Git tags are numeric (no v-prefix), releases via `npm version X.Y.Z`