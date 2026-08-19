---
date: 2026-08-19T23:13:03+0300
author: Roman Shulgha
commit: c56388f
branch: main
repository: RadiProtocol
topic: "Sidebar runner and free-text Answers"
tags: [research, codebase, runner, sidebar, answers, obsidian]
status: ready
last_updated: 2026-08-19T23:13:03+0300
last_updated_by: Roman Shulgha
---

# Research: Sidebar runner and free-text Answers

## Research Question
How can RadiProtocol add an opt-in right-sidebar runner and backward-compatible free-text Answers while sharing session behavior with the floating runner, preserving Answer traversal and note-output semantics, and keeping each transient session bound to its start note?

## Summary
RadiProtocol already has the two lower-level contracts the feature needs: `ProtocolRunner` owns Answer identity, separator-aware accumulation, undo/redo, and automatic traversal, while the floating host computes a monotonic accumulator delta and writes that delta to a constructor-bound note under a path-keyed mutex. The missing architectural piece is a presentation-neutral session host: protocol loading, validation, runner/render dispatch, snippet orchestration, note deltas, and transient drafts are still embedded in `InlineRunnerModal` (`src/views/inline-runner-modal.ts:38-1041`).

The canonical V1 document format accepts additive node fields through `Record<string, unknown>`, so a boolean Answer flag does not require a schema-version migration (`src/protocol/protocol-document.ts:64-91`, `src/protocol/protocol-document-migration.ts:39-48`). Runtime projection, editor controls, semantic validation, renderer behavior, i18n, and tests do not yet support the flag. The parser’s optional-boolean helper preserves explicit `false`, but absent/malformed values currently become `undefined`; the Answer projection is the boundary that must normalize the new runtime behavior to preset/false (`src/protocol/protocol-document-parser.ts:35-64`, `src/protocol/protocol-document-parser.ts:232-241`).

A submitted value fits the existing Answer command path because the Answer ID already selects branch adjacency independently of the text appended. Blank rejection must occur before redo clearing and the undo snapshot; accepted text can then use the selected Answer’s separator and the existing automatic successor traversal without transformation (`src/runner/protocol-runner.ts:89-128`, `src/runner/protocol-runner.ts:731-750`). Redo remains snapshot-based rather than replaying a command payload (`src/runner/protocol-runner.ts:356-419`).

The new sidebar cannot follow the project’s current singleton ItemView activation helpers because they reuse the first leaf of a type. Each launch needs an independent right-sidebar leaf and its own transient session state. Both the normal Run command and Start from specific node must honor the new setting; that developer decision closes the current split between the normal registry-backed launch and the direct start-node construction (`src/main.ts:325-381`, `src/main.ts:471-527`).

## Detailed Findings

### Canonical Answer field and validation boundary
- `AnswerNode` currently has `answerText`, optional `displayLabel`, and an optional separator only; no free-text discriminator exists (`src/graph/graph-model.ts:59-64`).
- Canonical node `fields` are open-ended and the V1 envelope guard checks only document-level shape. Unknown node fields survive storage but are ignored unless the parser projects them (`src/protocol/protocol-document.ts:64-91`, `src/protocol/protocol-document.ts:164-180`).
- `getCompatValue()` treats explicit `false` as canonical, and `getOptionalBoolean()` rejects non-booleans without truthiness coercion. The current Answer parse arm does not consume a boolean (`src/protocol/protocol-document-parser.ts:35-64`, `src/protocol/protocol-document-parser.ts:232-241`).
- `migrateProtocolDocument()` only rewrites legacy loop records and returns an unchanged V1 document when no legacy loop exists. An additive Answer field does not need a version migration (`src/protocol/protocol-document-migration.ts:39-48`).
- New Answers currently default to `{ answerText: '' }`; the Answer property form exposes display label, multiline authored text, and separator (`src/views/protocol-editor-view.ts:250-256`, `src/views/protocol-editor-view.ts:2535-2540`). The generic save path preserves literal `false` but deletes `undefined` (`src/views/protocol-editor-view.ts:2581-2587`).
- `GraphValidator` has no Answer-content pass. The free-text prompt invariant belongs at this semantic boundary and must be scoped only to flagged Answers so existing empty preset Answers remain valid (`src/graph/graph-validator.ts:43-161`).
- Parser normalization preserves whitespace-only strings. Because rendering uses `displayLabel ?? answerText`, a whitespace-only display label can mask a nonblank answer text; validation must account for the actual visible-prompt rule rather than only nullishness (`src/protocol/protocol-document-parser.ts:41-49`, `src/runner/render/render-question.ts:24-33`).

### Submitted-text runner semantics
- `chooseAnswer(answerId)` validates the Answer ID, clears redo, snapshots current node/text/loop state, appends authored Answer text, and follows that Answer’s successor (`src/runner/protocol-runner.ts:89-128`). Branch identity is therefore already separate from text payload identity.
- Whitespace-only rejection cannot live in `appendAnswerText()`: by then redo and undo have already changed and successor traversal will still occur. Rejection must precede all forward mutation, while the original accepted string—not a trimmed copy—must reach accumulation.
- `appendAnswerText()` suppresses only a zero-length string. `TextAccumulator.appendWithSeparator()` adds no prefix for the first chunk and otherwise prepends the selected newline/space separator without altering the supplied text (`src/runner/protocol-runner.ts:731-750`, `src/runner/text-accumulator.ts:20-29`).
- Automatic text-block and Answer traversal occurs synchronously after the selected branch and contributes to the same accumulator result (`src/runner/protocol-runner.ts:783-861`). The pre-command undo snapshot therefore covers submitted text plus automatically traversed output.
- `stepBack()` stores the post-action state as a redo entry, then restores the pre-action snapshot; `redo()` restores that complete post-action state rather than replaying Answer selection. No separate submitted-text field is needed in redo state (`src/runner/protocol-runner.ts:356-419`).
- `syncManualEdit()` is not a substitute for submitted Answer text: it overwrites the entire accumulator, while `chooseAnswer()` would still append the authored Answer value afterward (`src/runner/protocol-runner.ts:526-542`).

### Question rendering, drafts, and input behavior
- Both grouped and authored-order rendering paths delegate Answers to one `appendAnswerButton()` helper. The helper uses `displayLabel ?? answerText`, emits safe text, and passes the full `AnswerNode` through the host callback (`src/runner/render/render-question.ts:14-33`).
- With `optionOrder`, Answer, Question, and Snippet controls share one interleaved edge-ordered stack. Without it, Answers are grouped first, followed by Question transitions and Snippet branches (`src/runner/render/render-question.ts:64-165`). A free-text control must remain at the same authored Answer position and retain the same Answer ID.
- The host empties content and action zones on every render (`src/views/inline-runner-modal.ts:413-434`). Drafts stored only in textarea DOM would be lost; session-owned `Map<AnswerId, string>`-style state is the compatible lifetime, outside pure traversal snapshots and intentionally outside persisted workspace state.
- The renderer currently has no draft getter/setter, input/key binding, field-error, focus, or teardown port. Its only generic listener seam is click binding (`src/runner/render/render-question.ts:14-20`).
- The floating container key handler returns immediately for `INPUT` and `TEXTAREA`, so plain Enter remains native but Mod+Enter is not currently handled. Its existing Back/Redo shortcuts also do not use `metaKey` (`src/views/inline-runner-modal.ts:689-712`).
- There is no actionable-control count. Sole-action focus must be based on controls actually emitted across Answer, Question, and Snippet options rather than the footer’s current `hasAnswers` check (`src/views/inline-runner-modal.ts:460-504`).
- The existing render error path empties a zone and has no field-local live alert contract. Runtime blank-entry feedback therefore needs a localized, accessible inline state distinct from graph-validation errors.

### Shared runner-session extraction boundary
- `InlineRunnerModal` currently constructs `ProtocolRunner` and `GraphValidator`, owns graph and self-check metadata, and captures protocol path, optional start node, and target `TFile` (`src/views/inline-runner-modal.ts:38-104`).
- `open()` builds the floating shell before performing store migration/read, raw read, parse, validation, runner start, and first render (`src/views/inline-runner-modal.ts:130-205`). Protocol-session bootstrap is interleaved with body-attached shell creation.
- State dispatch, progress, self-check, footer commands, Answer/loop/snippet traversal, snippet picker/fill orchestration, accumulator deltas, and bound-note writes all remain in the modal (`src/views/inline-runner-modal.ts:413-614`, `src/views/inline-runner-modal.ts:751-1041`).
- Floating-only behavior is separable: body attachment and stacking, `InlineRunnerLayoutManager`, drag/resize, layout persistence, hide/show on active-note changes, close when the target note has no leaf, Escape-to-close, and registry focus (`src/views/inline-runner-modal.ts:118-125`, `src/views/inline-runner-modal.ts:314-355`, `src/views/inline-runner-modal.ts:643-712`).
- The session-level dependency surface currently arrives through the entire plugin object: parser, store, snippets, settings, bound translator, shared mutex, vault, and workspace. `ProtocolRunner` itself remains pure and should not absorb `App`, `TFile`, DOM, workspace, or vault effects (`src/runner/protocol-runner.ts:1-18`).
- Cleanup is centralized in `close()`: picker unmount, fill-modal close, key listener removal, event-ref release, observer disconnect, layout destruction, registry removal, and DOM removal (`src/views/inline-runner-modal.ts:241-307`). A shared host needs equivalent idempotent disposal independent of either shell.
- Existing async guards are uneven. Snippet-picker results check node identity and mount state, but protocol reads, snippet-fill completion, note writes, and completion timers lack a session generation/closed guard. Rerendering an `awaiting-snippet-fill` state can launch duplicate asynchronous fill work (`src/views/inline-runner-modal.ts:538-542`, `src/views/inline-runner-modal.ts:879-1041`).

### Bound-note output and concurrency
- The Answer host captures accumulator text before and after `chooseAnswer()`, verifies append-only growth, and writes the suffix. Because traversal has already completed, this suffix includes downstream automatic Answer/text-block output (`src/views/inline-runner-modal.ts:751-773`).
- The sink uses only the constructor-captured `targetNote` for mutex key, read, and modify. It never retargets to `workspace.getActiveFile()` (`src/views/inline-runner-modal.ts:775-792`).
- `WriteMutex` lazily maps path strings to independent mutexes: same-path writes serialize; different paths can proceed independently (`src/utils/write-mutex.ts:10-24`). The plugin’s one mutex instance is shared across floating sessions (`src/main.ts:45-47`).
- Runner mutation precedes asynchronous note I/O. A failed read/modify leaves traversal advanced, does not roll back, and prevents the post-write render. This is an existing integration risk rather than a new free-text rule.
- The note sink de-duplicates only the current global separator and cannot distinguish generated from user-authored leading whitespace. The runner captures its default separator at session construction while the sink reads settings at write time (`src/views/inline-runner-modal.ts:90-104`, `src/views/inline-runner-modal.ts:743-792`).
- The first accumulator chunk has no generated separator. If the bound note is nonempty and neither side provides separation, the first write concatenates directly with the note’s last character (`src/runner/text-accumulator.ts:20-29`).
- Back and Redo mutate runner memory only and never remove or re-append note bytes (`src/views/inline-runner-modal.ts:578-596`, `src/views/inline-runner-modal.ts:689-712`).

### Sidebar lifecycle and launch routing
- The plugin registers three ItemViews through composition-root factories, but none is a runner view (`src/main.ts:91-106`).
- Existing activation helpers reuse `getLeavesOfType(...)[0]` and call `getLeaf(false)` only when absent (`src/main.ts:208-223`). That singleton pattern cannot satisfy independent simultaneous runner leaves.
- `SnippetManagerView` is the strongest current lifecycle precedent: it registers DOM/vault events per view, uses mounted/generation state, cancels timers, and empties content on close (`src/views/snippet-manager-view.ts:118-204`).
- The floating runner hides on active-note mismatch and closes when its target note has no open leaf (`src/views/inline-runner-modal.ts:643-681`). The sidebar requirement instead keeps the session interactive, displays mismatch state, and retains fixed-note output.
- The normal Run path captures the active Markdown note before the asynchronous protocol picker, then routes through pair-keyed floating deduplication (`src/main.ts:471-527`). This already prevents later active-note changes from retargeting the launch.
- Start from specific node also captures the note and optional start node, but directly constructs `InlineRunnerModal`, bypassing the normal launcher and registry (`src/main.ts:325-381`). The developer decided this path must also honor the sidebar preference.
- Sidebar sessions and drafts can remain transient by keeping launch context and runner state in each view instance and not serializing them through workspace state. Existing ItemViews do not persist their internal session state.

### Settings, i18n, CSS, and verification surface
- `RadiProtocolSettings` has no presentation flag. `Object.assign({}, DEFAULT_SETTINGS, loadedData)` means an absent key inherits the default, so a false default preserves floating behavior for upgrades (`src/settings.ts:21-48`, `src/main.ts:50-60`).
- The settings tab already localizes and persists controls through `saveSettings()`; no sidebar row or locale keys exist (`src/settings.ts:58-148`).
- English and Russian catalogs contain settings, graph-validator, protocol-runner, and inline-runner namespaces, but no keys for the setting, free-text toggle, validation error, bound note, mismatch, focus-note action, Submit, or blank alert (`src/i18n/locales/en.json:282-321`, `src/i18n/locales/ru.json:282-321`).
- Authored Question/Answer labels are rendered as text rather than HTML, and submitted output is passed as a string to vault modification. These are the correct untranslated boundaries (`src/runner/render/render-question.ts:24-33`, `src/runner/render/render-question.ts:84-88`, `src/views/inline-runner-modal.ts:775-792`).
- The floating container owns fixed positioning, resizing, and hidden outer overflow; content and actions independently own vertical scrolling (`src/styles/inline-runner.css:67-147`). Current button rules are ancestor-coupled to `.rp-inline-runner-actions`, so a sidebar shell will not inherit them automatically (`src/styles/inline-runner.css:149-189`).
- Source CSS is concatenated through the ordered `CSS_FILES` list into generated `styles.css`; generated assets are not source-edit targets (`esbuild.config.mjs:31-59`).
- Test seams already exist for parser projection, Answer traversal/undo/redo, question order, floating host note isolation, mutex serialization, settings persistence, and ItemView cleanup. There is no current shared-host, sidebar leaf lifecycle, Answer free-text rendering, or composition-root presentation-routing suite.

## Code References
- `src/graph/graph-model.ts:59-64` — Runtime Answer contract.
- `src/protocol/protocol-document.ts:64-91` — Open-ended V1 node fields.
- `src/protocol/protocol-document.ts:164-180` — Shallow V1 envelope guard.
- `src/protocol/protocol-document-parser.ts:35-64` — Canonical-first scalar and optional-boolean normalization.
- `src/protocol/protocol-document-parser.ts:232-241` — Current Answer projection.
- `src/protocol/protocol-document-migration.ts:39-48` — Legacy-loop-only migration gate.
- `src/graph/graph-validator.ts:43-161` — Ordered semantic validation passes.
- `src/views/protocol-editor-view.ts:250-256` — New-node defaults.
- `src/views/protocol-editor-view.ts:2535-2540` — Current Answer property controls.
- `src/views/protocol-editor-view.ts:2581-2587` — Generic field save/delete semantics.
- `src/runner/protocol-runner.ts:89-128` — Answer command, undo-before-mutate, and successor traversal.
- `src/runner/protocol-runner.ts:356-419` — Snapshot-based Back/Redo.
- `src/runner/protocol-runner.ts:731-750` — Effective separator and Answer append helper.
- `src/runner/protocol-runner.ts:783-861` — Automatic text-block/Answer traversal.
- `src/runner/text-accumulator.ts:20-29` — First-chunk and separator behavior.
- `src/runner/render/render-question.ts:14-33` — Question renderer host contract and shared Answer control.
- `src/runner/render/render-question.ts:64-165` — Authored-order and grouped option projection.
- `src/views/inline-runner-modal.ts:130-238` — Protocol startup and post-start subscriptions.
- `src/views/inline-runner-modal.ts:241-307` — Complete floating-host teardown.
- `src/views/inline-runner-modal.ts:413-614` — Destructive rerender and state dispatch.
- `src/views/inline-runner-modal.ts:643-712` — Floating active-note and keyboard policy.
- `src/views/inline-runner-modal.ts:751-875` — Accumulator deltas, bound-note sink, and state-text extraction.
- `src/views/inline-runner-modal.ts:879-1041` — Snippet orchestration and async ownership.
- `src/settings.ts:21-48` — Persisted settings and defaults.
- `src/main.ts:91-106` — Existing ItemView registration.
- `src/main.ts:160-191` — Floating-runner unload and registry ownership.
- `src/main.ts:325-381` — Start-from-node launch path.
- `src/main.ts:471-527` — Normal Run picker and pair-deduplicated floating launch.
- `src/utils/write-mutex.ts:10-24` — Path-keyed write serialization.
- `src/views/snippet-manager-view.ts:118-204` — Per-ItemView event and close cleanup precedent.
- `src/styles/inline-runner.css:67-189` — Floating layout, scroll owners, and action styling.
- `esbuild.config.mjs:31-59` — Source CSS registration and generated output.

## Integration Points

### Inbound References
- `src/main.ts:136-141` — Registers the normal Run command.
- `src/main.ts:325-381` — Captures protocol, target note, and optional start node for start-from-node runs.
- `src/main.ts:471-527` — Captures protocol/note context and launches normal floating runs.
- `src/views/inline-runner-modal.ts:460-504` — Adapts renderer callbacks to runner traversal and footer behavior.
- `src/runner/render/render-question.ts:14-33` — Calls the host for Answer selection while preserving the Answer node identity.

### Outbound Dependencies
- `src/views/inline-runner-modal.ts:147-205` — Depends on protocol store migration/read, raw vault read, parser, validator, and runner startup.
- `src/views/inline-runner-modal.ts:775-792` — Depends on vault read/modify and the shared write mutex for fixed-note output.
- `src/views/inline-runner-modal.ts:879-1041` — Depends on snippet service, tree picker, and fill modal orchestration.
- `src/runner/protocol-runner.ts:731-750` — Depends only on pure graph node metadata and `TextAccumulator` for Answer text.
- `src/runner/render/render-question.ts:64-165` — Depends on graph ordering/labels and caller-provided DOM/effect ports.

### Infrastructure Wiring
- `src/main.ts:45-73` — Constructs settings, i18n, parser, store, snippet service, and shared mutex at the composition root.
- `src/main.ts:91-106` — Registers stable ItemView types with plugin-closing factories.
- `src/main.ts:160-191` — Owns floating-runner registry cleanup on unload.
- `src/settings.ts:58-148` — Persists settings and rebuilds affected services.
- `src/views/snippet-manager-view.ts:118-204` — Demonstrates per-leaf registration, generation guards, timer cleanup, and content teardown.

## Architecture Insights
- The correct dependency direction is already present: Obsidian host/views own workspace, vault, `TFile`, DOM, and modal effects; `ProtocolRunner` remains pure.
- The natural shared boundary is a session host above `ProtocolRunner` and below presentation shells. It owns transient session state and effects but not floating coordinates or sidebar workspace policy.
- Answer branch identity is the node ID. A free-text value is a command payload, not a new node kind, state kind, or edge identity.
- The parser is the compatibility normalization boundary; the validator is the semantic runnability boundary. The shallow V1 guard and legacy-loop migration should remain unchanged.
- Draft state belongs to the session host because render DOM is destructive and drafts are neither traversal state nor persisted workspace state.
- Accumulator deltas are the established note-output unit. Writing raw submitted text separately would omit automatic traversal output and bypass historical separator fixes.
- A sidebar ItemView must be multi-instance by leaf creation, not singleton by view type. Each leaf owns one fixed note/protocol/start-node session.
- Existing async resource ownership is the main extraction risk: fill flows, picker lifetimes, note writes, completion timers, and close races need one idempotent session lifecycle.
- Floating and sidebar hosts require different outer layout selectors but shared control classes. Current `.rp-inline-runner-actions` ancestor coupling is not presentation-neutral.

## Precedents & Lessons
11 related change families were analyzed.

### Precedent: Floating runner and accumulator-delta note output
**Commit(s)**: `b03dc6a` — "feat(phase-54-01): InlineRunnerModal class + CSS shell" (2026-04-21); `88c8f84` — "feat(phase-54-02): command registration + canvas picker + guards" (2026-04-21)

**Blast radius**: 4 files across composition root, views, CSS, and build registration.

**Follow-up fixes**:
- `e3e8cb1`, `22e7b0b`, `f4c2352`, and `cd2baa3` corrected label selection, delta output, whitespace trimming, separator de-duplication, mutex use, monotonic guards, and async cleanup.

**Takeaway**: The before/after accumulator delta and fixed-note mutex are load-bearing behavior, not incidental modal code.

### Precedent: Shared runner presentation extraction and removal
**Commit(s)**: `e516943` — "feat(75): runner view / inline runner deduplication + milestone v1.12 close" (2026-05-02)

**Blast radius**: 112 files across runner renderers, views, tests, and planning.

**Follow-up fixes**:
- `b899821` — "refactor: remove RunnerView and sidebar/tab runner; keep inline only" (2026-05-05) removed the former ItemView surface.
- `06de26f` and `defbf77` cleaned stale references and orphaned CSS afterward.

**Takeaway**: Prior extraction kept note writes, modal layout, and lifecycle out of pure renderers; the new shared boundary must also avoid binding either shell to the other.

### Precedent: Multiple floating runners
**Commit(s)**: `2e1af75` — "feat(inline-runner): Phase 85 — registry, cascade positioning, onunload cleanup" (2026-05-03)

**Blast radius**: 8 files across composition root, floating view, tests, and planning.

**Takeaway**: Registry ownership and unload cleanup are established, but the direct start-from-node launch currently bypasses the normal registry path.

### Precedent: Optional launch payload threading
**Commit(s)**: `59d9586` — "feat(45-03): thread optional startNodeId through ProtocolRunner.start and RunnerView.openCanvas" (2026-04-18)

**Blast radius**: 4 files across command, runner, view, and tests.

**Follow-up fixes**:
- `5be09bd` prevented restored state from competing with the explicit start-node launch.

**Takeaway**: Preserve optional start-node context when centralizing presentation selection.

### Precedent: Additive authored field propagation
**Commit(s)**: `6cb79e2` — "feat: add author-configurable display order for question options" (2026-08-02)

**Blast radius**: 19 files across protocol, graph, runner/render, editor, i18n, CSS, and tests.

**Takeaway**: The closest live field precedent crosses every canonical projection and consumer without a V1 schema bump.

### Precedent: Separator propagation and empty Answer compatibility
**Commit(s)**: `03ebea0` — "feat(15-01): add radiprotocol_separator to AnswerNode, FreeTextInputNode, TextBlockNode" (2026-04-09); `b043169` — "fix(protocol-editor): preserve empty multiline field values as valid" (2026-05-25); `72b1106` — "fix: inline runner empty answer…" (2026-05-25)

**Blast radius**: model/parser, runner, editor, settings, and tests.

**Takeaway**: Explicit empty values and empty preset Answers are intentional compatibility behavior; free-text blank rejection must be flag-specific.

### Precedent: Removal of the standalone free-text node
**Commit(s)**: `a633de8` — "feat(20-02): purge free-text-input from type model files" (2026-04-10), followed by parser, runner, view, CSS, and test cleanup commits.

**Blast radius**: 21 files across eight layers.

**Takeaway**: Extending Answer semantics avoids reviving a deliberately removed node kind and its separate traversal surface.

### Precedent: i18n extraction
**Commit(s)**: `d89200b` — "feat(i18n): Phase 84-03 — extract i18n strings from graph, runner, runner-view errors" (2026-05-03)

**Blast radius**: 22 files across locale catalogs, pure layers, views, settings, tests, and docs.

**Takeaway**: Static copy and diagnostics need bound/injected translators and matching English/Russian keys; authored and submitted content remains untranslated.

### Precedent: Auto-growing sidebar textarea
**Commit(s)**: `a7c322b` — "fix(12): textarea auto-grow on input and min-height for sidebar" (2026-04-08)

**Blast radius**: 2 files across view code and CSS.

**Follow-up fixes**:
- `a8cb5cc` deferred height calculation and forced width after theme/layout issues.
- Later runner-layout fixes repeatedly adjusted zone ownership and panel stability.

**Takeaway**: Height reads are layout-sensitive; outer scrolling and listener cleanup need explicit host contracts.

### Composite Lessons
- Preserve accumulator deltas, separator behavior, undo-before-mutate, fixed-note binding, and mutex writes as one shared invariant.
- Treat the session host and presentation shells as separate lifecycle owners; callback renderers should not acquire vault or workspace policy.
- Extend the Answer field through model, parser, validator, editor, runner, renderer, locales, CSS, and focused tests in one coherent change.
- Test right-sidebar leaf creation, multiple-leaf isolation, active-note mismatch, focus-note behavior, close/unload races, and both launch commands; registration alone is insufficient.
- Keep source CSS and locale catalogs authoritative. Generated `main.js` and `styles.css` remain build outputs.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-08-19_22-22-49_sidebar-runner-and-free-text-answers.md` — Authoritative FRD and locked product decisions for this research.

## Developer Context
**Q (discover: Primary affected user): Who is most affected by the current modal-only runner and predefined-answer limitation, and what should become easier for them during a reporting session?**
A: Radiologist.

**Q (discover: Desired reporting outcome): For the radiologist, what is the most important improvement this feature should deliver during a reporting session?**
A: Both outcomes: keep context and capture nuance.

**Q (discover: Preserve the floating runner): Keep the existing floating runner while adding the sidebar, or replace it?**
A: Keep and add.

**Q (discover: Preserve Answer traversal semantics): Should submitted free text remain an Answer choice, enter the accumulator, retain undo, and follow that Answer's configured successor?**
A: Keep the same flow.

**Q (discover: Bind each run to its start note): Which note should a sidebar session write after the active note changes?**
A: Keep the start note.

**Q (discover: Sidebar setting launch semantics): When the sidebar setting is enabled, what should the existing Run protocol command do?**
A: Open the sidebar.

**Q (discover: Sidebar session cardinality): How many runner sessions should the right sidebar host at once?**
A: Multiple leaves.

**Q (discover: Behavior after active-note changes): What should a sidebar runner do when the radiologist switches away from its bound note?**
A: Stay fully interactive, show the bound note and mismatch prominently, and provide an action to focus the bound note.

**Q (discover: Answer schema shape): How should protocol authors mark an Answer as user-entered text?**
A: Boolean toggle.

**Q (discover: Meaning of authored Answer text): How should existing authored text appear on a free-text Answer?**
A: Prompt only; do not prefill or insert it.

**Q (discover: Submission hotkey): Which keyboard behavior should approve multiline free text?**
A: Mod+Enter; plain Enter remains a newline.

**Q (discover: Blank submission behavior): What should happen for empty or whitespace-only submitted text?**
A: Reject it, show feedback, and return focus without mutation.

**Q (discover: Dynamic field growth): How should a multiline free-text field behave as content grows?**
A: Natural full height, with the surrounding host owning overflow.

**Q (discover: Initial field focus): When should a free-text field receive initial focus?**
A: Only when it is the sole actionable option.

**Q (discover: Mixed and multiple Answers): How should mixed preset and free-text Answers render?**
A: Inline per Answer in authored order.

**Q (discover: Session persistence): Should in-progress sidebar sessions survive restart or workspace reload?**
A: No; sessions and drafts are transient.

**Q (discover: Sidebar setting default): What should the sidebar preference default to?**
A: Disabled for new and existing installs.

**Q (discover: Submit control label): How should the approval control be labeled?**
A: Visible localized Submit text.

**Q (discover: Invalid submission feedback): How should blank submission be explained?**
A: A localized inline accessible alert.

**Q (discover: Shared presentation architecture): How should floating and sidebar presentations share runner behavior?**
A: Extract a shared session host and keep thin presentation shells.

**Q (discover: Required free-text prompt): What happens when a free-text Answer has neither a nonblank display label nor nonblank answer text?**
A: Graph validation error.

**Q (discover: Submitted whitespace): After confirming an entry is not blank, how should its whitespace be handled?**
A: Preserve leading, trailing, and internal whitespace exactly.

**Q (discover: Unsubmitted draft ownership): Where should drafts live while a session is open?**
A: Shared host state keyed by Answer ID.

**Q (`src/main.ts:325-381`, `src/main.ts:471-527`): Should Start from specific node honor the same sidebar setting as the normal Run command?**
A: Yes. Both launch paths must use the selected presentation while preserving the optional start node.

## Related Research
- None found for this feature at commit `c56388f`.

## Open Questions
- The exact canonical field/property name for the boolean free-text flag is not yet defined by live code or the FRD.
- The sidebar-specific terminal policy after protocol completion and target-note deletion is not explicitly defined; current floating behavior auto-closes on completion/deletion, while the sidebar requirements only lock active-note mismatch behavior.
