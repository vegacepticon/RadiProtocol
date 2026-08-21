---
date: 2026-08-20T09:37:27+0300
author: Roman Shulgha
commit: e26fd56
branch: main
repository: RadiProtocol
topic: "Sidebar runner and free-text Answers Implementation Strategy"
tags: [implementation, strategy, runner, sidebar, answers, obsidian]
status: complete
last_updated: 2026-08-20T09:37:27+0300
last_updated_by: Roman Shulgha
type: implementation_strategy
---

# Handoff: Sidebar runner blueprint generation

## Task(s)
- **In progress — `/skill:blueprint`:** Produce an implement-ready five-phase blueprint for an opt-in multi-instance right-sidebar protocol runner and backward-compatible free-text Answer nodes. The active artifact is `.rpiv/artifacts/plans/2026-08-20_08-13-22_sidebar-runner-and-free-text-answers.md`, based on `.rpiv/artifacts/research/2026-08-19_23-13-03_sidebar-runner-and-free-text-answers.md`.
- **Completed — research grounding and decisions:** Existing graph/protocol/runner/render/view/settings/CSS/i18n/tests and Obsidian ItemView APIs were inspected. Historical runner extraction/removal precedents at commits `e516943` and `b899821` were reviewed.
- **Completed — design and decomposition approval:** The developer confirmed five sequential vertical slices and all remaining architecture choices.
- **Completed — Phase 1 generation/verification/approval:** “Free-text Answer contract and pure command” is fully written and locked in the plan at `.rpiv/artifacts/plans/2026-08-20_08-13-22_sidebar-runner-and-free-text-answers.md:155-585`. The slice verifier returned `Decisions: OK`, `Cross-slice: OK`, and `Research: OK`; the developer approved it.
- **Pending — Phases 2–5:** Their skeletons and file ownership exist, but their code fences and success criteria are still empty.
- **Pending — final blueprint review:** The artifact remains `status: in-progress` with `unresolved_phase_count: 4`. No production implementation has started.

Todo state at handoff:
- #1 Ground blueprint research — completed.
- #2 Resolve architecture decisions — completed.
- #3 Decompose feature slices — completed.
- #4 Generate and verify phases — in progress.
- #5 Finalize and review plan — pending.

## Critical References
- `.rpiv/artifacts/plans/2026-08-20_08-13-22_sidebar-runner-and-free-text-answers.md`
- `.rpiv/artifacts/research/2026-08-19_23-13-03_sidebar-runner-and-free-text-answers.md`
- `/home/hermes/.pi/agent/npm/node_modules/@juicesharp/rpiv-pi/skills/blueprint/SKILL.md`

## Recent changes
- `.rpiv/artifacts/plans/2026-08-20_08-13-22_sidebar-runner-and-free-text-answers.md:1-153` — Created blueprint metadata, requirements, findings, desired state, exclusions, and locked architecture decisions.
- `.rpiv/artifacts/plans/2026-08-20_08-13-22_sidebar-runner-and-free-text-answers.md:18-19` — Updated progress to `unresolved_phase_count: 4` and `last_updated: 2026-08-20T09:37:27+0300` after Phase 1 approval.
- `.rpiv/artifacts/plans/2026-08-20_08-13-22_sidebar-runner-and-free-text-answers.md:155-585` — Persisted the approved Phase 1 code sections and focused automated/manual success criteria.
- `.rpiv/artifacts/plans/2026-08-20_08-13-22_sidebar-runner-and-free-text-answers.md:587-905` — Added Phase 2–5 skeletons with dependencies, file ownership, and intended responsibilities; these still require full code generation and approval.
- No source, test, generated bundle, or production configuration file was modified. No implementation validation was run.

## Learnings
- `ProtocolRunner` is already the correct pure state-machine boundary. Free-text must extend `chooseAnswer(answerId, submittedText?)`, retain Answer ID as branch identity, reject blank input before redo/history/accumulator/traversal mutation, and preserve accepted whitespace exactly.
- The approved runtime field is backward-compatible `AnswerNode.freeText?: boolean`, not a required property. Canonical `.rp.json` parsing writes `false` for absent/malformed values; direct compatibility graphs use `freeText === true`, avoiding broad fixture churn. No schema migration is required.
- Effective prompt validation must use exactly `displayLabel ?? answerText`; a whitespace-only `displayLabel` intentionally masks nonblank `answerText` and is invalid for a flagged Answer.
- The shared extraction target is `src/views/inline-runner-modal.ts`: bootstrap, exhaustive runner render dispatch, snippet flows, accumulator deltas, fixed-note writes, progress/self-check, async ownership, and teardown belong in a presentation-neutral `RunnerSessionHost`. Floating and sidebar classes remain thin policy/layout shells.
- Async work must use both a mounted flag and monotonic generation. Session disposal invalidates protocol reads, snippet resolution/fill completion, note writes, and scheduled completion before shell teardown.
- Each sidebar launch creates a fresh `workspace.getRightLeaf(false)` leaf. Initialize the concrete `ItemView` after `setViewState`; keep protocol path, captured `TFile`, optional start node, drafts, and runner state in transient instance/ephemeral context, never durable view state.
- Sidebar sessions remain permanently bound to their launch note, continue working after active-note changes, expose bound-note/mismatch/focus-note UI, auto-close on completion, and close immediately if the bound note is deleted.
- Both normal Run and Start-from-node must pass through one presentation selector controlled by default-false `useSidebarRunner`.
- Shared session CSS belongs in a new `src/styles/runner-session.css`, registered before floating overrides in `esbuild.config.mjs`. Never edit generated `styles.css` or `main.js`.
- New UI text must be namespaced and added to both English and Russian locale catalogs. User-authored Answer prompts and submitted report text are never translated.

## Artifacts
Read these in order:
1. `.rpiv/artifacts/discover/2026-08-19_22-22-49_sidebar-runner-and-free-text-answers.md`
2. `.rpiv/artifacts/research/2026-08-19_23-13-03_sidebar-runner-and-free-text-answers.md`
3. `.rpiv/artifacts/plans/2026-08-20_08-13-22_sidebar-runner-and-free-text-answers.md`
4. `.rpiv/artifacts/handoffs/2026-08-20_09-37-27_sidebar-runner-blueprint.md`

## Action Items & Next Steps
1. Resume the blueprint workflow rather than implementing the feature. Read the active plan and blueprint `SKILL.md`; preserve all settled decisions.
2. Continue Todo #4 at **Phase 2: Shared Session Host with Floating Parity**. Generate complete, copy-pasteable code for every owned file plus focused automated/manual success criteria.
3. Before Phase 2 generation, re-read the live extraction targets and test seams as needed, especially `src/views/inline-runner-modal.ts`, `src/runner/render/render-snippet-picker.ts`, CSS class/constants files, esbuild style registration, and floating-runner tests.
4. For each remaining phase, follow the blueprint micro-checkpoint exactly: run `slice-overlap.mjs`, dispatch `slice-verifier` with current code inline, fix any violations, present a concise per-file summary plus mandatory **Fit** line, obtain developer approval, then persist the approved slice verbatim and decrement `unresolved_phase_count`.
5. Generate sequentially:
   - Phase 2 — shared host extraction and floating parity.
   - Phase 3 — free-text renderer ports, textarea behavior, drafts, focus, keyboard, and accessible errors.
   - Phase 4 — Answer editor toggle and explicit-false persistence.
   - Phase 5 — sidebar ItemView, setting, launch routing, transient multi-leaf sessions, note deletion/mismatch behavior, and mocks/tests.
6. After all phases are locked, complete Todo #5: update plan status/frontmatter, run required independent artifact code and coverage reviews, address findings, and mark the blueprint `ready` for `/skill:implement` only when no blockers remain.
7. Do not claim tests passed: Phase 1 contains proposed verification commands, but no production code has been applied and no test suite has been run.

## Other Notes
- Git context at handoff: branch `main`, commit `e26fd56`, author Roman Shulgha.
- The research artifact was created against an earlier commit but remains the approved source of behavioral decisions.
- Phase 1’s approved proposed API returns `boolean` from `chooseAnswer(...)`: `false` for wrong state, invalid Answer, or blank free-text submission; `true` for accepted commands. Preset Answers ignore an accidental submitted payload.
- Phase 1 additionally suppresses authored prompt insertion if a flagged Answer is encountered during automatic traversal, and tests that behavior.
- The existing todo list must remain one-at-a-time: Todo #4 stays in progress until all remaining phases are generated and approved; Todo #5 remains blocked by #4.
