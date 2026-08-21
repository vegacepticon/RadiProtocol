---
date: 2026-08-19T22:22:49+0300
author: Roman Shulgha
commit: c56388f
branch: main
repository: RadiProtocol
topic: "Sidebar runner and free-text Answers"
tags: [intent, frd, runner, sidebar, answers]
status: ready
last_updated: 2026-08-19T22:22:49+0300
last_updated_by: Roman Shulgha
---

# FRD: Sidebar runner and free-text Answers

## Summary
Add an opt-in right-sidebar presentation for protocol runners while preserving the existing floating runner. Extend Answer nodes with a backward-compatible free-text toggle so radiologists can enter case-specific multiline wording, submit it into the bound note, and continue through the Answer's configured workflow exactly like a preset Answer.

## Problem & Intent
The primary affected user is the **“Radiologist”**, and the desired improvement is **“Both outcomes”**: keeping the runner visible beside the note and capturing case-specific wording that predefined Answers cannot express.

The developer described the need as follows:

> I want to add an option to display the runner in Obsidian’s right sidebar, with a setting that lets users enable this view in addition to the current behavior, where the runner is only displayed in a modal.
>
> I also want to implement a new feature: a text input field directly inside the runner. It would work somewhat like a button, except instead of a predefined action, the user could type their own text into the field, then either press a hotkey or click a dedicated button next to it. The result would then be inserted at the bottom of the currently open note, similar to what happens when an Answer node with a predefined value is selected.
>
> It’s important that the input field dynamically expands as the user types, so that all entered text remains visible and the field grows naturally with its content.
>
> I think this could be implemented by adding a toggle to the Answer node that enables this behavior. In other words, this text input field would essentially be an Answer node: once the user enters the desired text and approves it, the workflow would continue according to the configured flow, exactly as it would with a regular Answer node containing a predefined value.

## Goals
- Let radiologists keep a protocol runner visible in Obsidian's right sidebar while working with notes.
- Let radiologists capture case-specific multiline wording when preset Answers are insufficient.
- Preserve the selected Answer's accumulator, undo, separator, note-append, and successor traversal behavior for submitted free text.
- Preserve the existing floating runner for users who do not opt into the sidebar.
- Keep every sidebar session visibly and safely bound to the note from which that run started.

## Non-Goals
- Replacing or retiring the existing floating runner.
- Redirecting an existing runner's submissions to whichever note is currently active.
- Restoring in-progress sidebar sessions after an Obsidian restart or workspace reload.
- Introducing a separate free-text node kind instead of extending Answer nodes.
- Restricting the right sidebar to a single runner session.

## Functional Requirements
1. The system SHALL add a persisted setting that selects the right-sidebar runner for normal protocol launches; it SHALL default to disabled for both new and existing installations.
2. When the setting is disabled, the existing Run protocol command SHALL open the floating runner unchanged; when enabled, the same command SHALL open the runner in Obsidian's right sidebar.
3. The system SHALL retain the existing floating runner as a supported presentation rather than removing it.
4. The right-sidebar implementation SHALL support multiple simultaneous runner leaves, including runs bound to different protocol-and-note pairs.
5. Each runner session SHALL remain bound to the target note captured when the run starts, and every submission from that session SHALL append to that bound note rather than the currently active note.
6. A sidebar runner SHALL remain fully interactive when another note becomes active. It SHALL prominently display its bound note, indicate when a different note is active, and provide an action that opens or focuses the bound note.
7. In-progress sidebar sessions and their drafts SHALL be transient across Obsidian restarts and workspace reloads.
8. The canonical Answer document/runtime shape SHALL gain a backward-compatible boolean free-text flag, defaulting to false when absent, and the protocol editor SHALL expose it as an Answer toggle.
9. A free-text Answer SHALL be invalid when both `displayLabel` and `answerText` are blank after validation, because `displayLabel ?? answerText` supplies its visible prompt.
10. An Answer without the free-text flag SHALL retain its current preset button, authored text, ordering, traversal, and note-output behavior.
11. A free-text Answer SHALL render an initially empty multiline field, use `displayLabel ?? answerText` as a prompt/label rather than inserted or prefilled content, and place a visible localized Submit button beside it.
12. Questions containing mixed or multiple Answer types SHALL render each free-text field inline at that Answer's authored position, while preset Answers remain buttons.
13. The free-text field SHALL grow to its complete content height without an internal scrollbar; when space is exhausted, the surrounding runner/sidebar host SHALL scroll instead.
14. Unsubmitted drafts SHALL be retained by Answer ID in shared host state across rerenders and sidebar-leaf switching for the lifetime of the session.
15. A free-text field SHALL receive initial focus only when it is the Question's sole actionable option.
16. Users SHALL be able to submit by clicking the localized Submit button or pressing Mod+Enter (Ctrl+Enter on Windows/Linux, Cmd+Enter on macOS); plain Enter SHALL insert a newline.
17. Empty or whitespace-only submissions SHALL not mutate runner state or the note. The UI SHALL show a localized inline accessible alert and return focus to the field.
18. Once an entry is known to be nonblank, the submitted value SHALL preserve all leading, trailing, and internal whitespace exactly as typed.
19. Submitting free text SHALL create the same pre-mutation undo snapshot, use the selected Answer's effective separator, append the submitted value to the runner accumulator, follow the selected Answer's configured successor, and include automatically traversed output in the note delta.
20. The floating and sidebar presentations SHALL use a shared runner-session host for parsing, validation, rendering, transient drafts, traversal dispatch, and bound-note writes; presentation-specific layout and workspace lifecycle SHALL remain in thin shells.

## Non-Functional Requirements
- **Performance**: Textarea resizing SHALL track content without perceptible lag during ordinary typing and SHALL avoid accumulating duplicate listeners or observers. No explicit throughput or latency benchmark was requested.
- **Security**: The feature SHALL introduce no network transport or backend. User-entered and authored text SHALL be rendered through safe text APIs rather than HTML, and note writes SHALL remain constrained to the session's bound `TFile`.
- **UX / Accessibility**: The field SHALL expose its authored prompt as an accessible label, the Submit action SHALL have visible localized text and an accessible name, Mod+Enter SHALL work cross-platform, validation SHALL be announced inline, and focus SHALL return predictably after invalid submission. Full-height growth SHALL keep all entered text visible while the host provides outer scrolling.
- **Reliability**: Multiple leaves SHALL keep isolated runner, draft, and target-note state. Rerenders and active-note changes SHALL not discard drafts or retarget writes. Sessions SHALL intentionally be transient after restart, and normal preset Answers SHALL remain backward compatible.

## Constraints & Assumptions
- The sidebar presentation is an Obsidian `ItemView` registered at the composition root and opened in a right workspace leaf.
- Production protocol persistence remains canonical `.rp.json`; absent free-text flags in existing documents mean `false` without requiring destructive migration.
- `ProtocolRunner` remains a pure module with no Obsidian imports; workspace, DOM, and vault effects remain in view/host layers.
- The Answer node ID remains the branch identity. Submitted text changes only the text payload, not edge selection or successor ordering.
- New user-visible strings are added to both English and Russian locale files; authored prompts and submitted report text are not translated.
- Source CSS and TypeScript are edited under `src/`; generated `main.js` and `styles.css` are produced by the build and are not edited manually.
- The sidebar setting persists, but active runner sessions and unsent drafts do not persist across restart.

## Acceptance Criteria
- [ ] With the sidebar setting absent or disabled, invoking Run protocol visibly opens the existing floating runner; enabling the setting and invoking the same command opens a runner leaf in Obsidian's right sidebar.
- [ ] Reloading plugin settings preserves the enabled/disabled choice, while an upgraded installation with no stored key continues to use the floating runner.
- [ ] Starting two runs while sidebar mode is enabled produces two independently usable right-sidebar leaves rather than replacing the first run.
- [ ] Each sidebar leaf visibly names its bound note. After activating a different note, the runner remains interactive, displays the mismatch, and its focus-note action opens the bound note.
- [ ] After switching to a different active note, submitting an Answer writes only to the sidebar session's bound note and does not modify the newly active note.
- [ ] Closing/reloading Obsidian does not restore active sidebar runs or unsent drafts, while the sidebar preference remains persisted.
- [ ] In the protocol editor, an Answer exposes a free-text toggle; saving and reopening the `.rp.json` preserves the flag, and older Answers without the field load as preset Answers.
- [ ] A free-text Answer with blank `displayLabel` and blank `answerText` produces a concrete protocol validation error; supplying either value clears that error.
- [ ] A Question with interleaved preset and free-text Answers displays every option in authored order, with preset buttons unchanged and one independent field/Submit control per free-text Answer.
- [ ] A free-text field starts empty, shows `displayLabel ?? answerText` as its prompt, and is auto-focused only when it is the Question's sole actionable option.
- [ ] Enter adds a visible newline to the draft without advancing; clicking Submit or pressing Mod+Enter submits once and advances through the selected Answer's configured successor.
- [ ] As multiline text is entered, the field's rendered height continues to match its full content height with no internal scrollbar; overflow is handled by the runner/sidebar container.
- [ ] Switching leaves or triggering a host rerender retains each unsubmitted draft for its Answer during the current session.
- [ ] Submitting empty or whitespace-only text leaves the runner state and note bytes unchanged, renders a localized inline alert announced to assistive technology, and focuses the invalid field.
- [ ] Submitting a nonblank value with deliberate leading/trailing whitespace appends those bytes unchanged, applies the Answer's effective separator, records the normal runner undo snapshot, and continues along the same edge as a preset Answer.
- [ ] The note append contains the submitted value plus any automatically traversed downstream output at the bottom of the bound note.
- [ ] Focused pure-runner, parser/validation, renderer, shared-host, settings, and sidebar lifecycle tests pass under `npm test` with exit code 0.
- [ ] `npm run build` exits 0 and regenerates the plugin bundle from source without TypeScript errors.
- [ ] `npm run lint` exits 0 with the new TypeScript and source CSS included.

## Recommended Approach
Extract a presentation-neutral runner-session host from `InlineRunnerModal`, then embed it in both the existing floating shell and a registered right-sidebar `ItemView` that supports multiple leaves and fixed target-note bindings. Extend the Answer schema/parser/editor with a boolean free-text flag and add a submitted-text payload to the existing Answer command path so accumulator, undo, separator, traversal, and note-delta behavior remain shared.

## Decisions

### Primary affected user
**Question**: Who is most affected by the current modal-only runner and predefined-answer limitation, and what should become easier for them during a reporting session?
**Recommended**: n/a — `intent` question
**Chosen**: Radiologist.
**Rationale**: The developer identified the reporting radiologist as the person experiencing both limitations directly.

### Desired reporting outcome
**Question**: For the radiologist, what is the most important improvement this feature should deliver during a reporting session?
**Recommended**: n/a — `intent` question
**Chosen**: Both outcomes: keep context and capture nuance.
**Rationale**: Success requires both a persistent beside-the-note runner and case-specific wording rather than treating either as optional.

### Preserve the floating runner
**Question**: From the probe I inferred that the existing floating runner should remain available, while the sidebar becomes an additional presentation option. Keep this, or replace the floating runner?
**Recommended**: Keep and add.
**Chosen**: Keep and add.
**Rationale**: evidence: `src/views/inline-runner-modal.ts:1-2,31-40`; `src/main.ts:92-106` + confirmed.

### Preserve Answer traversal semantics
**Question**: From the probe I inferred that submitted free text should remain part of an Answer choice, enter the runner accumulator, retain undo semantics, and follow that Answer's configured successor. Keep this behavior?
**Recommended**: Keep same flow.
**Chosen**: Keep same flow.
**Rationale**: evidence: `src/runner/protocol-runner.ts:88-126`; `src/runner/render/render-question.ts:14-33` + confirmed.

### Bind each run to its start note
**Question**: The current runner writes to the note captured when the run starts, even if another note later becomes active. Which behavior should the sidebar use?
**Recommended**: Keep start note.
**Chosen**: Keep start note.
**Rationale**: evidence: `src/views/inline-runner-modal.ts:38-42,78-94` + confirmed; fixed binding prevents accidental writes after focus changes.

### Sidebar setting launch semantics
**Question**: Tradeoff: when the sidebar setting is enabled, what should the existing Run protocol command do?
**Recommended**: Open sidebar.
**Chosen**: Open sidebar.
**Rationale**: This gives radiologists a one-command workflow while preserving floating behavior whenever the opt-in setting is disabled.

### Sidebar session cardinality
**Question**: Tradeoff: how many runner sessions should the right sidebar host at once?
**Recommended**: One session.
**Chosen**: Multiple leaves.
**Rationale**: Multiple leaves preserve parallel protocol-and-note work rather than forcing one in-progress run to replace another.

### Behavior after active-note changes
**Question**: Tradeoff: what should a sidebar runner do when the radiologist switches away from its bound target note?
**Recommended**: Stay usable.
**Chosen**: Stay fully interactive, remain bound to its own target note, prominently show that note, indicate an active-note mismatch, and provide an action to focus the bound note.
**Rationale**: This preserves the always-visible workflow while making the fixed write destination explicit and quickly reachable.

### Answer schema shape
**Question**: Tradeoff: how should protocol authors mark an Answer as user-entered text?
**Recommended**: Boolean toggle.
**Chosen**: Boolean toggle.
**Rationale**: A flag is backward compatible, keeps Answer branch identity intact, and avoids introducing a new traversal kind for the same semantic action.

### Meaning of authored Answer text
**Question**: When the free-text toggle is enabled, how should the Answer's existing authored text appear?
**Recommended**: Prompt only.
**Chosen**: Prompt only.
**Rationale**: An empty field ensures the radiologist supplies case-specific wording while the existing caption fallback provides the branch prompt without another schema field.

### Submission hotkey
**Question**: Which keyboard behavior should approve multiline free text?
**Recommended**: Mod+Enter.
**Chosen**: Mod+Enter.
**Rationale**: Cross-platform Mod+Enter supports fast approval while reserving Enter for the required multiline input.

### Blank submission behavior
**Question**: What should happen if the user submits empty or whitespace-only text?
**Recommended**: Reject and focus.
**Chosen**: Reject and focus.
**Rationale**: Rejection avoids invisible traversal or blank note effects and gives the radiologist an immediate recovery path.

### Dynamic field growth
**Question**: How should the multiline field behave when its content becomes tall?
**Recommended**: Natural full height.
**Chosen**: Natural full height.
**Rationale**: Full-height growth directly satisfies the requirement that all entered text remain visible; the surrounding host can own scrolling.

### Initial field focus
**Question**: When should a free-text Answer field receive focus?
**Recommended**: Only sole input.
**Chosen**: Only sole input.
**Rationale**: Conditional focus speeds the unambiguous case without biasing a Question that offers several possible branches.

### Mixed and multiple Answers
**Question**: Tradeoff: how should a Question render multiple or mixed preset and free-text Answers?
**Recommended**: Inline per Answer.
**Chosen**: Inline per Answer.
**Rationale**: Per-Answer fields preserve authored order and make each submitted value's continuation branch unambiguous despite the additional vertical space.

### Session persistence
**Question**: Tradeoff: should in-progress sidebar runner sessions survive an Obsidian restart or workspace reload?
**Recommended**: Transient sessions.
**Chosen**: Transient sessions.
**Rationale**: Persisting only the preference limits stale-note and state-versioning risk while keeping the first release focused.

### Sidebar setting default
**Question**: What should the new sidebar-runner setting default to for new and existing installs?
**Recommended**: Disabled.
**Chosen**: Disabled.
**Rationale**: Opt-in preserves established floating-runner behavior through installation and upgrade.

### Submit control label
**Question**: How should the dedicated approval control be labeled?
**Recommended**: Localized Submit.
**Chosen**: Localized Submit.
**Rationale**: Visible localized text communicates the action more clearly than an icon and supports keyboard and assistive-technology discovery.

### Invalid submission feedback
**Question**: How should empty or whitespace-only submission be explained?
**Recommended**: Inline alert.
**Chosen**: Inline alert.
**Rationale**: Proximate, announced feedback plus retained focus gives an accessible and immediate correction path.

### Shared presentation architecture
**Question**: Tradeoff: how should the floating panel and new sidebar share runner behavior?
**Recommended**: Extract shared host.
**Chosen**: Extract shared host.
**Rationale**: One host keeps traversal, drafts, rendering, and note writes behaviorally identical without coupling an ItemView to floating-layout concerns.

### Required free-text prompt
**Question**: What should happen if a free-text Answer has neither a nonblank display label nor nonblank answer text to use as its prompt?
**Recommended**: Validation error.
**Chosen**: Validation error.
**Rationale**: A required prompt makes every branch understandable to sighted and assistive-technology users instead of silently generating an unlabeled control.

### Submitted whitespace
**Question**: After confirming the entry is not blank, how should leading and trailing whitespace be handled?
**Recommended**: Trim outer space.
**Chosen**: Preserve exactly.
**Rationale**: Exact preservation respects deliberate report formatting; trimming is used only to decide whether the value is wholly blank, not to transform accepted text.

### Unsubmitted draft ownership
**Question**: Tradeoff: where should unsubmitted free-text drafts live while a sidebar session is open?
**Recommended**: Shared host state.
**Chosen**: Shared host state.
**Rationale**: Host-local drafts survive rerenders and leaf switching without expanding pure traversal state or contradicting the decision that sessions are transient across restart.

## Open Questions
None. The developer did not defer any interview decision.

## Suggested Follow-ups
- Consider making runner advancement and vault append atomic or recoverable: the current host advances traversal before the asynchronous note write and does not roll back on failure (`src/views/inline-runner-modal.ts:752-792`).
- Review first-chunk note separation: a first accumulator chunk can concatenate directly to the final character of a non-empty note when neither side supplies a separator (`src/runner/text-accumulator.ts:17-29`; `src/views/inline-runner-modal.ts:775-792`).
- Consider note-aware undo as a separate feature: current Back restores runner memory but does not remove text already appended to the note (`src/views/inline-runner-modal.ts:579-590`; `src/runner/protocol-runner.ts:348-390`).

## References
- User-provided feature description in this `/skill:discover` invocation.
- `src/main.ts`
- `src/settings.ts`
- `src/views/inline-runner-modal.ts`
- `src/runner/render/render-question.ts`
- `src/runner/protocol-runner.ts`
