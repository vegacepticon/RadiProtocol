# RadiProtocol — User Intention

## Direction
RadiProtocol is an Obsidian plugin for guided radiology protocol execution. The product direction is to make radiologists' daily workflow faster and more reliable through structured protocol execution, snippet reuse, visual `.rp.json` editing, and a shared community library.

## Current Focus (v1.20+)
- Stabilize and polish the current Obsidian plugin UX after Roman's manual testing.
- Prioritize protocol editor, inline runner, snippet library, and library admin workflows.
- Convert Roman's direct testing feedback into small bounded tasks.
- Keep maintainer/library workflows plugin-local and PR-based; no backend/auth/service expansion.
- Snippet library/admin should use clear human-readable clinical/category labels and hide technical implementation files from normal content views.
- i18n audit is effectively complete; remaining localization work should be true newly discovered user-facing strings or new UI copy only.

## Library Manifest Policy
- `library-manifest.json` is a technical library index and may exist in the maintainer/admin local remote copy after reset/pull.
- The manifest should not be installed as a normal user snippet and should not appear as user-facing content in Snippet Library or Library Admin trees.
- Do not remove the manifest architecture now; CI generation/validation of the manifest can be considered later as a separate explicitly approved workstream.

## Boundaries (Do Not)
- No web app, backend, auth, or payments until MVP is solid.
- No sidebar/RunnerView restoration (inline-only per ADR-0001).
- No premature abstraction — ship concrete plugin-local features first.
- No broad refactors without a narrow, verifiable reason and passing `npm run check`.
- Do not add new autonomous features from brainstorm while Roman's testing-feedback queue is non-empty.
- Do not add visual counters, hints, accessibility embellishments, or workflow changes unless they solve a user-reported problem or are required for a current task.
- Do not expand library remote sync into backend/auth/cloud infrastructure.

## Quality Bar
- Every code change must pass `npm run check` (build + lint + tests + planning + consistency) before being marked complete.
- No orphan CSS, no hardcoded user-facing strings in UI code, no untranslated aria labels/placeholders/buttons.
- Generated root `main.js` and `styles.css` must only change through the build pipeline.
- Git tags are numeric (no v-prefix), releases via `npm version X.Y.Z`.

## HESO Operating Preference
- When Roman provides testing feedback, ingest it as the only active queue.
- Tasks must be written in English for Sisyphus/OpenCode execution.
- Each task must include exact UX symptom, expected behavior, scope, forbidden changes, and verification command.
- Brainstorm output may be saved as notes only; promotion to todo requires explicit Roman approval.
- Prefer fixing visible product friction over adding new affordances.
- If a proposed feature expands scope or infrastructure, ask before dispatching it.
- Roman reviews and merges HESO branches; HESO never pushes or merges to `main`.
