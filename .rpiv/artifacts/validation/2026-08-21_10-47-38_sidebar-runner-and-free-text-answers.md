---
template_version: 1
date: 2026-08-21T10:47:38+0300
author: Roman Shulgha
commit: fb0065a
branch: main
repository: RadiProtocol
topic: "Validation of Sidebar runner and free-text Answers"
status: ready
verdict: pass
parent: ".rpiv/artifacts/plans/2026-08-20_08-13-22_sidebar-runner-and-free-text-answers.md"
tags: [validation, plan, blueprint, runner, sidebar, answers, obsidian]
last_updated: 2026-08-21T10:47:38+0300
---

## Validation Report: Sidebar Runner and Free-text Answers

### Implementation Status

- ✓ Phase 1: Free-text Answer contract and pure command — Fully implemented
- ✓ Phase 2: Shared Session Host with Floating Parity — Fully implemented
- ✓ Phase 3: Free-text Runner Controls and Drafts — Fully implemented
- ✓ Phase 4: Protocol Authoring Toggle — Fully implemented
- ✓ Phase 5: Multi-leaf Sidebar Presentation and Routing — Fully implemented

All five phase `- [x]` Automated Verification criteria were ticked in the working-tree plan and every one was independently re-executed and confirmed green in this validation run. Implementation is uncommitted in the working tree; no `--goal` or `--baseline` was supplied, so goal-conformance and baseline scoping were not applied.

### Automated Verification Results

- ✓ Phase 1 focused suites: `npx vitest run src/__tests__/protocol-document-parser.test.ts src/__tests__/graph-validator.test.ts src/__tests__/runner/protocol-runner-free-text-answer.test.ts` — 3 files, 73 tests passed
- ✓ Phase 2 focused suites: `npx vitest run src/__tests__/views/runner-session-host.test.ts src/__tests__/views/inline-runner-modal.test.ts src/__tests__/views/inline-runner-modal-keyboard.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts src/__tests__/views/inline-runner-modal-output-toolbar.test.ts src/__tests__/runner/render-snippet-picker.test.ts src/__tests__/inline-runner-layout.test.ts src/__tests__/views/inline-runner-position.test.ts` — 8 files, 71 tests passed
- ✓ Phase 3+4 focused suites: `npx vitest run src/__tests__/runner/protocol-runner-free-text-answer.test.ts src/__tests__/runner/render-question.test.ts src/__tests__/views/runner-session-host.test.ts src/__tests__/views/inline-runner-modal.test.ts src/__tests__/views/inline-runner-modal-keyboard.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts src/__tests__/views/inline-runner-modal-output-toolbar.test.ts src/__tests__/protocol-editor-helpers.test.ts src/__tests__/views/protocol-editor-keyboard.test.ts` — 9 files, 143 tests passed
- ✓ Phase 5 focused suites: `npx vitest run src/__tests__/settings-tab.test.ts src/__tests__/runner-commands.test.ts src/__tests__/views/sidebar-runner-view.test.ts src/__tests__/views/runner-presentation-routing.test.ts src/__tests__/views/runner-session-host.test.ts src/__tests__/views/inline-runner-modal.test.ts src/__tests__/views/inline-runner-modal-keyboard.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts src/__tests__/views/inline-runner-modal-output-toolbar.test.ts src/__tests__/inline-runner-layout.test.ts src/__tests__/views/inline-runner-position.test.ts` — 11 files, 102 tests passed
- ✓ Strict TypeScript: `npx tsc --noEmit --pretty false` — clean, no errors
- ✓ Scoped ESLint (all phase-owned TypeScript/test files) — clean, 0 errors
- ✓ Scoped Stylelint (`src/styles/runner-session.css`, `inline-runner.css`, `snippet-tree-picker.css`) — clean, 0 errors
- ✓ Locale parity + new-key assertions (Phases 2/3/4/5 scripts) — en/ru leaf sets equal; all new keys (`noteWriteFailed`, `snippetLoadFailed`, `freeTextSubmit`, `freeTextBlankError`, `freeTextAnswerLabel`, `freeTextAnswerHelp`, `useSidebarRunner`, `useSidebarRunnerDesc`, `sidebarRunner.*`) present in both locales
- ✓ CSS registration/source check (Phase 2 script) — `runner-session` registered before `inline-runner` in `esbuild.config.mjs`; all required selectors present
- ✓ Phase 5 main.ts/view assertions (node script) — `registerView`, `detachLeavesOfType`, `getRightLeaf(false)`, no `getLeavesOfType`, two `openRunnerSession` call sites, one `new InlineRunnerModal(`, empty durable state, marker consumed before context retention
- ✓ Production build: `npm run build` — tsc strict + esbuild production bundle succeeded (generated `main.js`/`styles.css` are gitignored build outputs, regenerated — not hand-edited)
- ✓ Repository lint: `npm run lint` — eslint `--max-warnings 0` + stylelint clean
- ✓ Full suite: `npm test` — 77 files, 1064 tests passed
- ✓ Repository check: `npm run check` — passed (exit 0); single advisory warning from the knip dead-code advisory step (see Potential Issues)
- ✓ No regressions detected — pre-existing floating-runner, layout, snippet, editor, and library suites all green in the full run

### Code Review Findings

#### Matches Plan:

- `src/runner/protocol-runner.ts:106-138` — `chooseAnswer(answerId, submittedText?)` rejects blank free-text payloads before redo clear / undo snapshot / accumulator mutation; preset Answers append authored `answerText`; free-text appends the payload verbatim; Answer id remains branch identity. `advanceThrough()` `case 'answer'` (`:845-875`) appends `''` for auto-traversed free-text nodes while retaining the loop quick-exit/halt logic.
- `src/protocol/protocol-document-parser.ts:232-240` — `freeText: getOptionalBoolean(fields, 'freeText', 'radiprotocol_freeText') ?? false` with canonical-first precedence; malformed canonical suppresses legacy fallback.
- `src/graph/graph-validator.ts:114-123` — flagged Answers validated on the exact prompt expression `(displayLabel ?? answerText).trim()`, error via `graphValidator.freeTextAnswerPromptRequired`.
- `src/views/runner-session-host.ts` — presentation-neutral host shared by both shells (`inline-runner-modal.ts:81-96`, `sidebar-runner-view.ts:118-137`); bootstrap order store→vault→parse (`:133-153`); path-locked append-only deltas through `withTargetNoteLock` (`:788-829`); mounted + separate lifecycle/operation generation guards (`:107-108`, `:236-246`); target-note `delete` → dispose + `onRequestClose` (`:111-120`); draft/error maps keyed by Answer ID surviving rerenders and cleared on dispose (`:77-82`, `:210-213`); blank submission sets localized error + focus request with no runner/vault mutation (`:649-669`); accepted payload forwarded to `chooseAnswer(answerNode.id, submittedText)` (`:672`); completion auto-close via zero-delay timer.
- `src/runner/render/render-question.ts:61-176` — free-text rows (prompt from `displayLabel ?? answerText`, draft-backed textarea, localized Submit, `aria-invalid` + `role="alert"`, Mod+Enter submit with plain Enter pass-through, auto-grow, sole-action initial focus) rendered at authored position in both `optionOrder` interleaved and grouped paths; preset buttons unchanged.
- `src/views/protocol-editor-view.ts:250-254, 2346-2355` — Answer defaults `{ answerText: '', freeText: false }`; strictly-true canonical read with legacy fallback; explicit boolean persistence.
- `src/views/sidebar-runner-view.ts` — one-shot ephemeral launch marker consumed before context retention; `getState()` returns `{}`; one host per leaf; bound-note chrome with vault `rename` subscription; mismatch status on `active-leaf-change`; focus-note reveal/open; single detach on requestClose/Escape/unmarked-restore/bootstrap-failure; idempotent `onClose`.
- `src/main.ts:538-560, 567-586, 180-190` — sidebar routing via `getRightLeaf(false)` + `setViewState({type, active:true, state:{}})` + `initialize`; floating dedup via `inlineRunnerRegistryKey` including optional start-node suffix; exactly one `new InlineRunnerModal(`; unload closes floating sessions and detaches sidebar leaves; command id `run-protocol-inline` and display `Run protocol` preserved.
- `src/settings.ts:21-47, 98-106` — optional `useSidebarRunner` field, `DEFAULT_SETTINGS.useSidebarRunner = false`, settings-tab toggle persisting through `saveSettings`.
- `src/i18n/locales/en.json` / `ru.json` — all eight new key groups present in both locales with identical nesting.
- All phase-owned files from the plan's `phases:` file lists match the working-tree change set; untracked `.rpiv/artifacts/discover/` and `.rpiv/artifacts/handoffs/` contain pipeline reference docs (the plan's own discover reference and a blueprint handoff), not implementation changes.

#### Deviations from Plan:

None. Implementation is a faithful realization of the plan.

#### Pattern Conformance:

- ✓ Naming/import style (kebab-case files, PascalCase classes, `import type`) matches existing views (`runner-session-host.ts:1-51`, `sidebar-runner-view.ts:1-33`).
- ✓ `RunnerSessionHost` follows — and strengthens — the `SnippetManagerView` mounted + monotonic-generation guard pattern with separate lifecycle/operation generations and post-await checks.
- ✓ `SidebarRunnerView` follows the `LibraryView` ItemView lifecycle (onOpen construction, onClose invalidation, scoped event refs, generation ownership).
- ✓ Renderer ports (`QuestionBranchHost`) stay narrow and presentation-neutral, mirroring `render-snippet-picker.ts` and `option-order-chip-editor.ts` conventions.
- ✓ New tests use the repo's established `vi.mock` factory / shared `MockEl` fixture patterns (`runner-renderer-host-fixtures.ts`) and `vi.hoisted` per-instance mocks for ItemView/routing suites.
- ✓ i18n uses bound translators and namespaced keys in both locales; CSS follows `rp-` kebab naming.
- Minor observation (acceptable variation, not a deviation): `SidebarRunnerView` tracks `on/offref` and raw DOM listeners manually instead of `registerEvent`/`registerDomEvent` — deliberate for one-shot transient leaf teardown, and cleanup is covered by tests.
- Minor observation (acceptable variation, not a deviation): the shared host reuses the `inlineRunner.*` i18n namespace for diagnostics; sidebar-specific chrome correctly uses `sidebarRunner.*`.

#### Potential Issues:

- `src/views/sidebar-runner-view.ts:273-279` — `focusBoundNote()` uses `workspace.getLeaf(false)` for the no-matching-leaf case, exactly as the plan authored it; in Obsidian this may return an existing main-area leaf rather than force-creating a new one. Faithful to the plan's code and the manual criterion ("a normal Markdown leaf opens"); it never returns a right-sidebar runner leaf. No action required.
- `src/views/sidebar-runner-view.ts` — knip (dead-code advisory) flags exported types `SidebarRunnerLaunchContext` and `SidebarRunnerEphemeralState` as unused exports; advisory only, `npm run check` exits 0 and `npm run lint` is clean. Optionally annotate as public API or drop the type exports.

### Manual Testing Required:

1. Phase 1 — free-text contract:
   - [ ] An existing Answer with no `freeText` field still parses and behaves as a preset Answer.
   - [ ] Accepted whitespace visibly retains outer spaces and embedded newlines.
   - [ ] No schema-version or migration code changed for the additive field.
2. Phase 2 — floating parity:
   - [ ] Floating run: question, loop, directory-snippet picker, file-bound snippet fill, Back, Redo, Skip, progress, errors, self-check match pre-extraction behavior.
   - [ ] Floating panel still restores/cascades, drags, resizes, reclamps, focuses, hides on active-note change, reappears on the bound note, closes when the bound leaf closes.
   - [ ] Child fill modal open while switching active leaves keeps the panel visible until the child resolves; cancel/Escape advance with empty snippet output.
   - [ ] First appended delta does not duplicate an existing trailing separator in the note.
   - [ ] Deleting the bound target note closes the shell with no subsequent render/write.
   - [ ] Close during loading/snippet resolution/fill/pending note read/scheduled completion commits no stale UI, write, modal, or close callback.
3. Phase 3 — free-text controls:
   - [ ] Mixed preset/free-text/transition/snippet question renders in authored order; preset buttons unchanged.
   - [ ] Multiline entry grows without internal scrollbar; plain Enter inserts newline; click/Ctrl+Enter/Meta+Enter each submit once.
   - [ ] Destructive rerender returns drafts under the same Answer ID.
   - [ ] Blank submission shows the localized inline alert with `aria-invalid`, restores focus, writes no note bytes.
   - [ ] Typing after rejection clears the alert/invalid state immediately; whitespace is not normalized.
   - [ ] Valid free text + automatic downstream output reaches the launch note exactly once.
4. Phase 4 — authoring toggle:
   - [ ] New Answer defaults unchecked; absent/malformed/false/true/legacy-only/canonical-over-legacy values mirror parser precedence in the editor.
   - [ ] Checked/unchecked states round-trip on reopen; empty `answerText` persists while checkbox persists independently.
   - [ ] Library-managed protocols reject the edit; en/ru localization visible.
5. Phase 5 — sidebar presentation:
   - [ ] Setting absent/disabled keeps floating dedup and Start-from-node behavior; enabled creates two independent right-sidebar leaves for identical launches.
   - [ ] Reload with a restored empty sidebar leaf detaches it; no session/draft/context resumes.
   - [ ] Active-note change keeps the session interactive, shows mismatch status, output still targets the bound note path.
   - [ ] Focus note reveals the existing Markdown leaf / opens a normal leaf when closed, without retargeting the runner.
   - [ ] Back/Redo delegation, input-safe Escape, sidebar Escape/Close detach, completion auto-close, bootstrap-failure close, bound-note deletion close.
   - [ ] Plugin unload releases floating DOM, sidebar leaves, host listeners, child pickers/modals, timers, transient context.

### Recommendations:

- Ready to commit — implementation is complete and validated. All five phase automated criteria and the final whole-plan commands (`npm run build`, `npm run lint`, `npm test`, `npm run check`) pass; the only check warning is the advisory knip step.
- Optional (non-blocking): annotate the two knip-flagged exported sidebar types as public API or stop exporting them to silence the advisory.
- Manual verification items above remain open by design (UI behavior cannot be exercised headlessly) — run them against Obsidian before the release pass.
