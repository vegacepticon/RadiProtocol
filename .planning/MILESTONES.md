# Milestones

## v1.14 Internationalization, Documentation & Infrastructure (Closed: 2026-05-03)

**Phases completed:** 3 phases (84–86), 8 requirements satisfied
**Timeline:** 2026-05-03 (single day)
**Git:** TBD commits on `dev/v1.14` branch
**Release:** Optional — user-facing changes (i18n, parallel inline runners, template library MVP) may warrant a BRAT update if polished; otherwise internal-only like v1.12/v1.13.

**Key targets achieved:**

- Phase 84: i18n + Documentation — locale files (`en.json`, `ru.json`), type-safe `t()` service, settings language dropdown; README.md at repo root; `docs/PROTOCOL-AUTHORING.md` and `docs/CONTRIBUTING.md`
- Phase 85: Multiple Inline Runners — plugin registry (`Set<InlineRunnerModal>`), per-instance cleanup, cascade positioning (+24px offset), `(canvasPath, notePath)` uniqueness check
- Phase 86: Template Library MVP — `LibraryService` fetching index from GitHub raw, `installSnippet()` via `requestUrl()`, SnippetManagerView «Библиотека» button

**Final gate:** `npm test` 861/1 skipped, `npm run build` exit 0, `npm run lint` 0 errors / 2 pre-existing warnings

**Known deferred items at close:**

- 2 lint warnings — `obsidianmd/prefer-file-manager-trash-file` in `src/snippets/snippet-service.ts:240,283` (documented out-of-scope since v1.12)
- Verification backfill — Phases 64/66/67/68 still lack formal `VERIFICATION.md`; Nyquist `VALIDATION.md` for Phases 63–86 missing (project-wide tech debt)

**Audit:** `.planning/MILESTONE-AUDIT.md` (Path A — close with documented tech debt, no blockers).

**Archive:** `.planning/milestones/v1.14-phases/` (84/85/86 directory tree).

---

## v1.13 AI-Agent Friction Reduction & Codebase Health (Closed: 2026-05-02 — internal-only, no GitHub Release)

**Phases completed:** 5 phases (79–83), 22 plans, 5/5 requirements satisfied
**Timeline:** 2026-05-02 → 2026-05-02 (single day)
**Git:** PR #2 squash-merged as `eb5c670`; release tag `1.13.0` (`2ad1c0a`) present but no GitHub Release published; src/ delta vs v1.12 close (`febabfd`): +1096/−735 across 35 files
**Release:** **none** — v1.13 is internal-only by REQUIREMENTS.md design; end users on `1.11.0` see no behavior change. If a regression surfaces it ships as `1.11.x` patch.

**Key accomplishments:**

- Phase 79: Typed Constants for Runner States and CSS Classes — `src/constants/runner-states.ts` (11 LOC, exports `RUNNER_STATUS` + `RunnerStatus` union) and `src/constants/css-classes.ts` (17 LOC, exports `CSS_CLASS` + `CssClass` union). Stringly-typed runner-state literals replaced across `src/runner/protocol-runner.ts` and `src/runner/runner-state.ts`. Shared CSS class names migrated at 7 hot-path call sites: `runner-view.ts`, `inline-runner-modal.ts`, `snippet-editor-modal.ts`, `snippet-form.ts`, `runner-host.ts`, `render-snippet-picker.ts`, `render-snippet-fill.ts`. `git grep -nP "['\"]awaiting-snippet-(pick|fill)['\"]" src/` returns matches only inside the canonical constants file. Final gate: `npm test` 847/1 skipped, `npm run build` exit 0, `npm run lint` 0 errors / 2 pre-existing warnings (EXTRACT-TYPES-01)
- Phase 80: Reusable CSS Utilities + Stylelint Gate — new `src/styles/_utilities.css` (65 LOC) registered first in `esbuild.config.mjs` `CSS_FILES`, exporting `.rp-stack`, `.rp-row`, `.rp-center`, `.rp-hidden`, `.rp-disabled` (plus size variants). At least one duplicated flex/gap/visibility rule per existing per-feature CSS file migrated (8 feature files). `stylelint` + `stylelint-config-standard` installed as devDependencies; `stylelint.config.mjs` extends standard config with focused rules. `npm run lint` script invokes `stylelint 'src/styles/**/*.css'` alongside ESLint. `.githooks/pre-commit` runs stylelint on staged `src/styles/**/*.css` files (existing eslint-on-staged-`*.ts` and `npm test` behavior preserved). `.github/workflows/ci.yml` continues to invoke `npm run lint` (now covers stylelint) (SPLIT-CSS-01)
- Phase 81: Typed dom-helpers Module — new `src/utils/dom-helpers.ts` (69 LOC) exports `createButton(parent, opts?) → HTMLButtonElement`, `createInput(parent, opts?) → HTMLInputElement`, `createTextarea(parent, opts?) → HTMLTextAreaElement`, and `registerEvent(scope, target, event, handler) → void`. Hot-path call sites — `src/runner/render/*` plus `src/views/snippet-tree-picker.ts` and `src/views/snippet-editor-modal.ts` — no longer contain `as HTMLButtonElement` / `as HTMLInputElement` / `as HTMLTextAreaElement` casts for the four element kinds. Mock at `src/__mocks__/obsidian.ts` updated; existing extension points (`recordedCssProps`, etc.) preserved verbatim. `RunnerHost` interface untouched (TYPE-SAFETY-01)
- Phase 82: SnippetManagerView Decomposition — tree rendering, drag-and-drop, inline rename, and context-menu logic extracted from `src/views/snippet-manager-view.ts` into `src/views/snippet-manager/tree-renderer.ts` (`SnippetManagerTreeRenderer` class, 577 LOC). Host view 1037 → 537 LOC (48% reduction). Phase 32 vault watcher / 120ms debounce / prefix-filter pattern preserved; Phase 32/34 `rewriteCanvasRefs` integration (with `WriteMutex` per file path) preserved verbatim. Two test files mechanically updated to reference `tree-renderer.ts`. **PARTIAL on soft <400 LOC budget** — host view at 537 LOC; rationale documented in `82-VERIFICATION.md` (tree + DnD + rename are tightly coupled by DOM state; further splitting judged worse-than-the-disease). 2 deferred lint warnings re-deferred (REFACTOR-SNIPPET-MGR-01)
- Phase 83: RunnerView SessionRecoveryCoordinator Extraction — `SessionRecoveryCoordinator` extracted to `src/runner/session-recovery-coordinator.ts` (112 LOC). Owns the three behavioral surfaces: autosave/append-policy (`autoSave()`), resume prompt + canvas-modification-warning (`resolveSession()` returning `'resume' | 'start-over' | 'error'`). `RunnerView` constructor wires the coordinator; `openCanvas()`'s ~45-LOC session-recovery block replaced with a single `resolveSession()` call. Imports of `ResumeSessionModal`, `PersistedSession`, and `validateSessionNodeIds` relocated to coordinator. Host 925 → 880 LOC. **PARTIAL on soft <700 LOC budget** — further reduction requires extracting the snippet-picker and canvas-switching surfaces, deferred to v1.14 by scope. Phase 7 contract preserved (autosave timing, resume conditions, canvas-modification warnings); Phase 75 contract preserved (`RunnerHost` interface untouched, shared renderer delegation unchanged); `InlineRunnerModal` not modified per REQUIREMENTS.md "Out of Scope" (REFACTOR-RUNNER-VIEW-01)

**Resolved during v1.13:**

- **Phase 75 atomic-commit gap (HIGH from v1.12 close)** — resolved as a side effect of the v1.13 squash merge `eb5c670` (PR #2). Working-tree-only Phase 75 deltas now committed.
- **CI-04 / CI-05 live red-status verification (deferred from v1.12)** — naturally exercised by the v1.13 PR; Phase 80 stylelint integration confirmed gate behavior on real PR.

**Known deferred items at close:**

- **REFACTOR-SNIPPET-MGR-01 soft-LOC carry-over** — `snippet-manager-view.ts` remains 537 LOC vs <400 LOC soft target. Further reduction would require splitting `tree-renderer.ts` into separate tree / DnD / rename / context-menu controllers; planner judged this would force shared mutable DOM state across module boundaries, worse than a single 537-LOC dispatcher. Re-evaluate in v1.14 if a natural seam emerges.
- **REFACTOR-RUNNER-VIEW-01 soft-LOC carry-over** — `runner-view.ts` remains 880 LOC vs <700 LOC soft target. Coordinator extraction proved the pattern; v1.14 carries (a) snippet-picker surface (`mountSnippetPicker`, `handleSnippetPickerSelection`, `handleSnippetFill`) and (b) canvas-switching surface (`handleSelectorSelect`, `handleClose`, `restartCanvas`).
- **2 deferred lint warnings re-deferred (third milestone in a row)** — `obsidianmd/prefer-file-manager-trash-file` × 2 in `src/snippets/snippet-service.ts:240,283`. v1.13 Phase 82 re-evaluated and re-deferred. Recommend wrapping into a v1.14 quick task.
- **`registerEvent` typed wrapper provided but not yet wired** — Phase 81 added it to `dom-helpers.ts` but did not adopt at call sites; only typed element creation is in use. Long-tail `as HTML*Element` casts remain in `src/views/settings-tab.ts`, `snippet-fill-in-modal.ts`, `snippet-editor-modal.ts` outside the declared hot path. Opportunistic migration deferred to v1.14.
- **Exhaustive CSS utility migration deferred** — Phase 80 demonstrated the pattern with at-least-one-per-feature; full sweep over every duplicated flex/gap rule deferred per REQUIREMENTS.md "Future Requirements".
- **`.planning/phases/75-runner-view-inline-runner-deduplication/` orphan directory** — present alongside the v1.12 archive copy at `.planning/milestones/v1.12-phases/75-runner-view-inline-runner-deduplication/`. Mechanical cleanup at next `/gsd-cleanup` pass.
- **MEDIUM-5 from v1.12 CONCERNS.md (deferred two milestones running)** — `protocol-runner.ts` (819 LOC) decomposition. Explicitly out of v1.13 scope (REQUIREMENTS.md "Out of Scope: No engine decomposition").
- **Carry-over project-wide tech debt (unchanged from v1.12 close):** Phases 64/66/67 lack formal `VERIFICATION.md`; Nyquist `VALIDATION.md` missing for Phases 63–83 (gap widens by one milestone); 3 open debug sessions (`inline-runner-drag-resets-size`, `inline-runner-tab-switch-resets-size`, `phase-27-regressions`); 2 stale seeds; deprecated `LoopStartNode` / `LoopEndNode` retained for Migration Check enumeration.

**Audit:** `.planning/MILESTONE-AUDIT.md` (Path A — close with documented soft-target carry-overs, no blockers).

**Archive:** `.planning/milestones/v1.13-phases/` (79/80/81/82/83 directory tree).

---

## v1.12 Maintenance & Tech Debt (Closed: 2026-05-02 — internal-only, no GitHub Release)

**Phases completed:** 4 phases (75–78), 28 plans, 7/7 requirements satisfied
**Timeline:** 2026-04-30 → 2026-05-02 (3 days)
**Git:** 23 commits since milestone open (`00b70ad`..`HEAD`); src/ delta +1860/−1253 across 60 files (Phase 75 work-tree-complete but uncommitted at close — see Known Deferred)
**Release:** **none** — v1.12 is internal-only by REQUIREMENTS.md design; end users on `1.11.0` see no behavior change. If a regression surfaces it ships as `1.11.x` patch.

**Key accomplishments:**

- Phase 75: RunnerView ↔ InlineRunnerModal Deduplication — extracted shared per-step renderers into `src/runner/render/` (render-footer, render-loop-picker, render-question, render-snippet-picker, render-snippet-fill, render-complete, render-error) plus runner-host / runner-renderer / runner-text / snippet-label modules under `src/runner/`; both host shells now delegate rendering and retain only chrome/lifecycle/autosave-policy/output-toolbar differences. View LOC 2345 → 1929 (–17.7%); inline test family LOC 2222 → 1555 (–30.0%, target met exactly). Final gate: `npm test` 847/1 skipped, `npm run build` exit 0, `npm run lint` 0 errors / 2 known warnings (DEDUP-01, DEDUP-02)
- Phase 76: editor-panel-view.ts Decomposition — `src/views/editor-panel-view.ts` reduced 1230 → 393 LOC (under <400 budget) and now acts as a dispatcher; per-kind form modules under `src/views/editor-panel/forms/` (`start-form.ts`, `question-form.ts`, `answer-form.ts`, `text-block-form.ts`, `loop-form.ts`, `snippet-form.ts`, `_shared.ts`); 9 helper modules extracted under `src/views/editor-panel/` (autosave, canvas-listener, canvas-patch, growable-textarea, quick-create-controller, render-form, render-toolbar, save-node-edits, legacy/list-snippet-subfolders). Phase 63 single-canvas-sync-subscription contract preserved; spyable `EditorPanelView` private surface preserved (`renderNodeFormImpl` routes via `host.renderForm(...)`). Tests: 818/1 skipped (SPLIT-01, SPLIT-02)
- Phase 77: Eslint Findings Cleanup — `npm run lint` exits 0 on `main`; 517 errors → 0; 6 warnings → 2 (documented out-of-scope: `obsidianmd/prefer-file-manager-trash-file` × 2 in `snippet-service.ts:240,283`). 14 plans across 9 waves, 12 atomic commits; dominant `obsidianmd/no-static-styles-assignment` violations across `src/views/` converted to CSS class toggles + appended rules in per-feature `src/styles/*.css` files (per CLAUDE.md per-feature CSS architecture); `instanceof TFile` runtime guards replace casts in `editor-panel-view.ts` and `inline-runner-modal.ts`; `no-control-regex` and `no-constant-binary-expression` resolved with documented rationale (LINT-01)
- Phase 78: Lint + Test Automation Gate — two-layer gate installed. Layer 1: `.githooks/pre-commit` runs eslint on staged `*.ts` + `npm test`, blocks commit on error, `--no-verify` bypass preserved (verified locally on disposable `test/lint-gate` branch). Layer 2: `.github/workflows/ci.yml` runs `npm ci && npm run build && npm run lint && npm test` on push to `main` and on every PR (Node 18+); workflow file structurally validated. Strictly ordered after Phase 77 per REQUIREMENTS.md (gate would block all commits before lint cleanup) (CI-01, CI-02)

**Known deferred items at close:**

- **Phase 75 atomic commits** — verification gate is GREEN but source deltas, new modules under `src/runner/`, new shared tests under `src/__tests__/runner/`, and the entire `.planning/phases/75-runner-view-inline-runner-deduplication/` directory exist only in the working tree. ROADMAP.md still labels Phase 75 as "Not started" in its progress table. Mechanical cleanup — next session should commit per-plan and update ROADMAP.md.
- **CI-04 / CI-05 live red-status verification** — workflow structurally valid; observation of red ✕ on a real PR with a deliberate eslint or test failure happens on the next natural PR.
- **2 lint warnings remaining** — `obsidianmd/prefer-file-manager-trash-file` in `src/snippets/snippet-service.ts:240,283`; documented out-of-scope in REQUIREMENTS.md "Future Requirements".
- **MEDIUM-5 from CONCERNS.md (deferred per REQUIREMENTS.md)** — `protocol-runner.ts` (819 LOC) and `snippet-manager-view.ts` (1037 LOC) remain large; re-evaluate now that DEDUP-01 has shipped a renderer-extraction template.
- **Carry-over project-wide tech debt (unchanged from v1.10/v1.11 close):** Phases 64/66/67 lack formal `VERIFICATION.md`; Nyquist `VALIDATION.md` missing for Phases 63–78; 3 open debug sessions (`inline-runner-drag-resets-size`, `inline-runner-tab-switch-resets-size`, `phase-27-regressions`); 2 stale seeds; deprecated `LoopStartNode` / `LoopEndNode` retained for Migration Check enumeration.

**Audit:** `.planning/MILESTONE-AUDIT.md` (Path A — close with documented tech debt, no blockers).

**Archive:** `.planning/milestones/v1.12-ROADMAP.md`, `.planning/milestones/v1.12-phases/` (75/76/77/78 directory tree).

---

## v1.11 Inline Polish, Loop Hint, Donate & Canvas Library (Shipped: 2026-04-30)

**Phases completed:** 6 phases, 17 plans, 11 tasks

**Key accomplishments:**

- One-liner:
- `src/donate/wallets.ts`
- Plan:
- TWO PARALLEL TRUNKS
- Completed:
- Completed:
- Completed:

---

## v1.11 Inline Polish, Loop Hint, Donate & Canvas Library (Shipped: 2026-04-30)

**Phases completed:** 6 phases (69–74), 17 plans
**Timeline:** 2026-04-29 → 2026-04-30 (2 days)
**Git:** 62 commits ahead of origin
**Release:** GitHub Release `1.11.0` (unprefixed tag) — 3 loose assets attached at release root, prerelease=false, BRAT-installable via `vegacepticon/RadiProtocol`

**Key accomplishments:**

- Phase 69: Inline Runner redundant button cleanup — removed Insert/Copy/Save buttons from all 6 Inline states; sidebar and tab runners unaffected; 6-state absence regression tests + sidebar presence cross-mode regression test (INLINE-CLEAN-01)
- Phase 70: Loop-exit picker visual hint — desaturated green background accent on `+`-prefix exit button via `.rp-loop-exit-btn.rp-loop-exit-btn` specificity-doubled selector; hover dim effect; Phase 44 body-button styling preserved byte-for-byte (LOOP-EXIT-01)
- Phase 71: Settings donate section — "Помочь разработке" section with 9 crypto-wallet rows (EVM shared across 6 networks + BTC + SOL + TRX) at top of Settings tab; copy-to-clipboard with Notice confirmation; zero persistence, hard-coded constants (DONATE-01)
- Phase 72: Canvas Library — Full algorithmic canvases (ГМ, ОБП, ОЗП, ОМТ, ПКОП) hand-built in author's vault and verified end-to-end against `Z:\projects\references\` `.md` text templates (CANVAS-LIB-01..05)
- Phase 73: Canvas Library — Short algorithmic canvases (ОГК short, ОБП short, ОМТ short) hand-built alongside full versions, verified end-to-end (CANVAS-LIB-06..08)
- Phase 74: GitHub Release v1.11.0 — version files aligned on `1.11.0`; clean production build; annotated tag `1.11.0` pushed; GitHub Release published with 3 loose assets; BRAT smoke install verified on clean vault (BRAT-03)

**Known deferred items at close:**

- Verification documentation backfill — Phases 64, 66, 67 still lack formal `gsd-verifier` VERIFICATION.md (carry-over from v1.10)
- Nyquist `VALIDATION.md` — Phase 63 draft; Phases 64–74 missing entirely (project-wide tech debt)
- 3 open debug sessions — 2 resolved by gap-closure `92a1269` but not formally closed; `phase-27-regressions` carryover from v1.7

---

## v1.10 Editor Sync & Runner UX Polish (Shipped: 2026-04-26)

**Phases completed:** 6 phases (63–68), 18 plans, 9/9 requirements satisfied
**Timeline:** 2026-04-25 → 2026-04-26 (2 days)
**Git:** 96 commits, 41 source files touched, +6015/−508 LOC (src/ only)
**Release:** GitHub Release `1.10.0` (unprefixed tag) — 3 loose assets attached at release root, prerelease=false, BRAT-installable via `vegacepticon/RadiProtocol`

**Key accomplishments:**

- Phase 63: Bidirectional Canvas ↔ Node Editor sync — pure reconciler with discriminated `EdgeLabelDiff`/`NodeLabelChange` (Plan 01); `EdgeLabelSyncService` broadcasts `canvas-changed-for-node` events on a public `EventTarget` bus with per-filePath snapshot baseline (Plan 02); `EditorPanelView` patches its open form's DOM in real time via shared `registerFieldRef` + focus-aware skip+stash + `queueMicrotask` re-entrancy guards (Plan 03); gap-closure Plan 04 added outbound Snippet branch-label → incoming edge sync and inbound canvas-text → form-field sync via canonical key synthesis (EDITOR-03, EDITOR-05)
- Phase 64: Node Editor polish — every multiline field (Question, Answer, Text block, Snippet branch label, Loop headerText) now shares the Phase 48 auto-grow behavior via a shared growable-textarea helper with managed CSS that removes inner scrollbars (EDITOR-04); fifth quick-create button "Create text block" added to the toolbar using the existing `CanvasNodeFactory` path with `flex-wrap: wrap` parity (EDITOR-06); UAT 7/7 PASS
- Phase 65: Runner footer rebuilt with shared `.rp-runner-footer-row` in both `RunnerView` and `InlineRunnerModal` — "step back" renamed to "back", Skip rendered as a labeled button to the right of Back, never interleaved between answer/snippet branches; consistent across sidebar, tab, and inline modes (RUNNER-02)
- Phase 66: Step-back reliability and scroll pinning — `UndoEntry.restoreStatus` for correct post-`stepBack` state restoration, `_stepBackInFlight` double-click guard, removal of the "Processing…" dead branch via typed exhaustiveness narrowing, synchronous Back-disable-on-click prologue in both runner footers, loop-boundary correctness suite (D-08 property roundtrip + D-13 four scripted scenarios) (RUNNER-03); unconditional scroll-to-bottom in `RunnerView.renderPreviewZone` with complete removal of the Phase 47 RUNFIX-02 one-shot flag mechanism (RUNNER-04, inline NA-by-design per D-12); UAT 9/9 PASS
- Phase 67: Inline Runner resizable modal and file-bound snippet parity — native CSS `resize: both` + `ResizeObserver`-driven 400ms debounced save persists user-set width/height alongside the Phase 60 position state with viewport-32px clamp-on-restore for monitor/resolution changes (INLINE-FIX-06, gap-closure 92a1269 fixed drag/tab-switch resets); replaced the unconditional `awaiting-snippet-pick` dispatch in `protocol-runner.ts advanceThrough` case `'snippet'` with a `radiprotocol_snippetPath` branch (D-14), extending file-bound parity from the Phase 56 sibling-button click path to ALL traversal paths (loop body, direct edge) in BOTH sidebar and inline runners (INLINE-FIX-07); UAT 8/8 PASS
- Phase 68: GitHub Release `1.10.0` shipped — `manifest.json`/`versions.json`/`package.json` aligned on `1.10.0` while preserving `1.8.0` + `1.9.0` mappings, fresh `npm run build`, release-preflight script (`SC-1 local verification: PASS`), unprefixed annotated tag `1.10.0` pushed, release runbook with Phase 66 UAT gate as first operational section, GitHub Release published with 3 loose root assets (`manifest.json`, `main.js`, `styles.css`), BRAT smoke install on a clean Obsidian vault confirmed plugin enables at version `1.10.0` with all post-publish smoke checks green (Runner / Editor / Inline)

**Known deferred items at close:**

- Verification documentation backfill — Phases 64, 66, 67 ship with UAT-PASS evidence and SUMMARY frontmatter listing implemented requirements but no formal `gsd-verifier` `VERIFICATION.md` (mirrors v1.8 Phase 58 backfill pattern). Phase 63 `VERIFICATION.md` exists but was marked `human_needed`; resolved by 63-UAT 9/9.
- Nyquist `VALIDATION.md` — Phase 63 in draft (`nyquist_compliant: false`, tests GREEN end-to-end); Phases 64, 65, 66, 67, 68 missing entirely (carry-over project-wide tech debt from v1.7).
- Three open debug sessions — `inline-runner-drag-resets-size` and `inline-runner-tab-switch-resets-size` both resolved by gap-closure `92a1269` but not formally closed; `phase-27-regressions` carryover from v1.7 — color regression root cause documented.
- Audit at close: `tech_debt` (no blockers); accepted per audit Path A (publish first, close with documented tech debt).

**Archive:** `.planning/archive/milestones/v1.10-ROADMAP.md`, `.planning/archive/milestones/v1.10-REQUIREMENTS.md`, `.planning/archive/milestones/v1.10-MILESTONE-AUDIT.md`, `.planning/archive/milestones/v1.10-phases/` (includes `v1.10-INTEGRATION-CHECK.md`)

---

## v1.9 Inline Runner Polish & Settings UX (Shipped: 2026-04-25)

**Phases completed:** 4 phases (59–62), 17 plans
**Timeline:** 2026-04-24 → 2026-04-25 (2 days)
**Git:** 41 commits, 13 source files touched, +1968/−198 LOC (src/ only)
**Release:** GitHub Release v1.9.0 (tag `1.9.0`) — 3 loose assets attached, prerelease=false

**Key accomplishments:**

- Phase 59: Inline Runner feature parity with sidebar — nested protocol-folder path resolution via exported `resolveProtocolCanvasFiles` helper with trailing-slash/backslash normalization and `vault.getFiles()` fallback scan (INLINE-FIX-01); separator parity on snippet insert via `appendDeltaFromAccumulator(beforeText)` accumulator-diff helper wired into MD and JSON-zero-placeholder arms (INLINE-FIX-04); JSON fill-in modal parity via real `SnippetFillInModal` above the floating runner with `isFillModalOpen` D1 gate + defensive `close()` disposal, reversing the Phase 54 D6 inline-render decision (INLINE-FIX-05)
- Phase 60: Inline Runner layout & position persistence — durable drag-position state in workspace with finite-coordinate guards + viewport-bounds clamp-on-restore (survives tab switch AND plugin reload; never lands off-screen after monitor/resolution change) (INLINE-FIX-02); compact default CSS overrides reducing padding/preview-height so modal no longer overlaps the line the user is typing on (INLINE-FIX-03)
- Phase 61: Settings folder autocomplete — reusable `FolderSuggest` class on Obsidian's `AbstractInputSuggest` backed by `app.vault.getAllFolders(false)` with case-insensitive sorted matching, attached to Protocols/Snippets/Output settings fields (Session folder deliberately excluded as scope boundary) (SETTINGS-01)
- Phase 62: BRAT release v1.9.0 — `manifest.json`/`versions.json`/`package.json` aligned on 1.9.0, atomic release-prep commit with clean `main.js`+`styles.css` build, unprefixed annotated tag `1.9.0` pushed (BRAT convention continuing v1.8.0), release runbook with D10 Phase 60 UAT gate as first operational section + A3 guardrail against incomplete-phase bullet inclusion, GitHub Release v1.9.0 published with 3 loose assets (BRAT-02)

**Known deferred items at close:** 8 items (see STATE.md `## Deferred Items`) — 1 v1.7 carryover debug session, 2 UAT status-field oversights (Phase 59 passed / Phase 61 unknown — both with 0 pending scenarios), 14 pending todos (most are stale files for v1.6–v1.8-delivered work)

**Archive:** `.planning/archive/milestones/v1.9-ROADMAP.md`, `.planning/archive/milestones/v1.9-REQUIREMENTS.md`, `.planning/archive/milestones/v1.9-phases/`

---

## v1.8 UX Polish & Snippet Picker Overhaul (Shipped: 2026-04-21)

**Phases completed:** 14 phases (47–58), 50 plans
**Timeline:** 2026-04-18 → 2026-04-21 (4 days)
**Git:** 170+ commits, 100+ source files touched

**Key accomplishments:**

- Phase 47: Three runner regressions closed — textarea edits survive loop transitions (RUNFIX-01), scroll position preserved on choice insert (RUNFIX-02), choice button padding/line-height fixed for Cyrillic descenders (RUNFIX-03)
- Phase 48/48.1: Node Editor UX polish — Snippet ID field removed, new nodes anchor vertically below, Answer fields reordered, Question textarea auto-grows, create buttons bottom-stacked; toolbar gap tightened post-UAT
- Phase 49/50/50.1: Edge semantics rework — loop exit derived from sole labeled edge (Phase 49), Answer.displayLabel ↔ incoming edge label bidirectional sync (Phase 50), "+"-prefix exit convention supersedes Phase 49 to allow labeled body edges unambiguously (Phase 50.1)
- Phase 51/56: Snippet picker overhaul — hierarchical tree picker with search replaces flat folder list, Snippet nodes bind to specific files; Phase 56 reversed auto-insert decision so file-bound Snippets always render as buttons with direct insert on click
- Phase 52: JSON placeholder rework — collapsed to 2 types (free text + unified choice), options-list editor fixed, fill-in modal renders multi-select with configurable separator
- Phase 53: Runner Skip & Close buttons — Skip advances without text append + undo roundtrip, Close unloads canvas with confirmation modal + D-14 teardown
- Phase 54: Inline Protocol Display Mode — third Runner mode as floating non-blocking modal over active note, answers append to end of source note, command-palette launch only
- Phase 55: BRAT Distribution Readiness — manifest/versions/package aligned on 1.8.0, GitHub Release v1.8.0 published, BRAT install verified
- Phase 57/58: Gap closure — REQUIREMENTS.md traceability refreshed with INLINE-01..05 promotion + 11 stale checkbox flips; 6 VERIFICATION.md files backfilled + 4 stale frontmatter flipped

**Known deferred items at close:** 8 items (see STATE.md `## Deferred Items`) — 1 v1.7 carryover debug session, 2 stale UAT status fields, 5 stale todo files for delivered work

**Archive:** `.planning/archive/milestones/v1.8-ROADMAP.md`, `.planning/archive/milestones/v1.8-REQUIREMENTS.md`, `.planning/archive/milestones/v1.8-MILESTONE-AUDIT.md`

---

## v1.7 Loop Rework & Regression Cleanup (Shipped: 2026-04-18)

**Phases completed:** 4 phases (43–46), 18 plans
**Timeline:** 2026-04-17 → 2026-04-18 (2 days)
**Git:** 51 commits, 27 source files touched, ~17.6K LOC TypeScript

**Key accomplishments:**

- Phase 43: Unified `loop` node collapsed the legacy `loop-start`/`loop-end` pair at the model, parser, validator, and color-map layers — Migration Check emits a Russian rebuild instruction for legacy canvases via the existing RunnerView error panel; four fixture canvases (happy-path, missing-exit, duplicate-exit, no-body) exercise the three LOOP-04 sub-checks (LOOP-01..04, MIGRATE-01, MIGRATE-02)
- Phase 44: Unified loop runtime — single-step picker combining body-branch labels + «выход» rendered above `headerText`, `advanceOrReturnToLoop` helper + B1 re-entry guard for dead-end returns, B2 `previousCursor` threading for step-back, nested loops preserved via existing `LoopContext` stack, session save/resume at `awaiting-loop-pick` (7 round-trip tests), `maxIterations` field + settings UI fully excised (RUN-01..07)
- Phase 45: Node Editor loop form with editable `headerText` (no `maxIterations`), fourth quick-create button "Create loop node" (repeat icon, red `NODE_COLOR_MAP['loop']='1'`), `NodePickerModal` extended to 4 kinds with Russian badges (Вопрос/Цикл/Текст/Сниппет) and kind-group sort order, new `start-from-node` Ctrl+P command with validator gate (blocks legacy canvases via MIGRATE-01) — end-to-end wiring: handleStartFromNode → parse → validate → buildNodeOptions → activateRunnerView → picker → runner (LOOP-05, LOOP-06)
- Phase 46: `free-text-input` excised from every layer using TypeScript exhaustiveness as the mechanical forcing function — `RPNodeKind` shrunk to 8 members, `FreeTextInputNode` interface deleted, parser emits Russian rejection with three mandatory tokens via the existing MIGRATE-02 surface, all consumer files (runner, views, color map, CSS, tests) swept clean; fixture retained byte-identically with semantic role flipped from happy-path to CLEAN-02 rejection proof (CLEAN-01..04)
- Post-verification fixes delivered: WR-01 race between ResumeSessionModal and NodePickerModal (commit 5be09bd at main.ts:368), WR-02 exhaustive KIND_ORDER via `Record<kind, number>` (commit 40f33d8)
- All 19 v1.7 requirements satisfied; milestone audit passed with `tech_debt` status (no blockers); 9/9 cross-phase E2E flows verified by integration checker; 419 passed + 1 skipped tests; `npx tsc --noEmit` and `npm run build` exit 0

**Known deferred items at close:** 8 items (see STATE.md `## Deferred Items`) — 3 Nyquist gaps (Phase 43/44/46 VALIDATION.md missing or draft), 2 stale verification frontmatters (Phase 44/45 `human_needed` not promoted despite UAT commits), 1 legacy debug session (phase-27-regressions), 4 legacy todo files whose work was delivered in v1.5/v1.6 but the files were never deleted, plus 6 code-review info/warning items tracked for future cleanup

**Archive:** `.planning/archive/milestones/v1.7-ROADMAP.md`, `.planning/archive/milestones/v1.7-REQUIREMENTS.md`, `.planning/archive/milestones/v1.7-MILESTONE-AUDIT.md`

---

## v1.6 Polish & Canvas Workflow (Shipped: 2026-04-17)

**Phases completed:** 7 phases, 14 plans, 21 tasks

**Key accomplishments:**

- Knip-driven dead code removal: 8 unused type exports internalized, 2 dead files deleted, 3 legend CSS rules removed, 3 RED test stubs removed, async-mutex dependency restored
- CSS flex gap fix for snippet create/edit modal type row -- "ТипJSON" now renders as "Тип JSON"
- One-liner:
- 150ms async delay between createNode and loadNode to prevent stale canvas JSON reads after requestSave
- Duplicate node button in editor panel toolbar with radiprotocol property preservation and live canvas data read
- renderNodeForm now falls back to live canvas state when Obsidian's debounced save hasn't flushed yet, and empty-type nodes show the "Select a node type to configure this node" hint locked by the UI-SPEC.
- Third quick-create button 'Create snippet node' added to the node editor toolbar (Lucide file-text icon, accent styling matching Phase 39 buttons) — reuses onQuickCreate by widening its kind union to include 'snippet', zero new pipeline code.
- UAT gap 1 closed — attachCanvasListener now defers the canvas.selection read via setTimeout(0) and wires both 'click' and 'dblclick' on the canvas container, so double-clicking empty canvas space auto-loads the freshly-created node into the Node Editor without the prior click-off-then-click-on detour.
- UAT gap 2 closed — `.rp-editor-create-toolbar` now wraps its four quick-create buttons onto a second row when the Node Editor sidebar is narrowed below the four-button row width, keeping the right-most "Duplicate node" button reachable at every sidebar width.

---

## v1.5 Snippet Editor Refactoring (Shipped: 2026-04-16)

**Phases completed:** 4 phases (32–35), 18 plans
**Timeline:** 2026-04-15 → 2026-04-16 (2 days)
**Git:** 73 commits, 90 files changed, +19518/-1034 LOC

**Key accomplishments:**

- Phase 32: SnippetService refactored — `Snippet = JsonSnippet | MdSnippet` discriminated union, `listFolder`/`load`/`save`/`delete` extension routing, `vault.trash()` delete, `rewriteCanvasRefs` vault-wide canvas reference sync utility with WriteMutex (MD-05, DEL-01)
- Phase 33: SnippetManagerView rewritten as recursive folder tree — SnippetEditorModal (unified create/edit, JSON↔MD toggle, folder dropdown, D-09 move-on-save pipeline, unsaved-changes guard), folder CRUD (create/delete with contents listing), vault watcher (create/delete/rename events with 120ms debounce + prefix filter) — 20 requirements satisfied (TREE-01..04, MODAL-01..08, FOLDER-01..03, SYNC-01..03, DEL-02..03)
- Phase 34: Drag-and-drop + context menu "Move to…" + modal folder field for snippet/folder reorganization; F2/context-menu inline rename for files and folders; all move/rename operations auto-rewrite SnippetNode `subfolderPath` in every Canvas via `rewriteCanvasRefs` — UAT approved by Роман (MOVE-01..05, RENAME-01..03)
- Phase 35: `.md` snippets in Protocol Runner picker with glyph prefix differentiation; click-to-insert inserts content verbatim without fill-in modal; works in subfolder drill-down and mixed answer+snippet branching — 7/7 verification truths passed (MD-01..04)
- All 34 v1.5 requirements satisfied; milestone audit passed with tech_debt status (no blockers); 5/5 cross-phase E2E flows verified; 20/20 integration points connected
- Known deferred items: Node Editor stale subfolderPath display (cosmetic), chip editor English labels (Phase 27 legacy), 3 Phase 26 RED test stubs, Nyquist validation draft for all 4 phases

**Archive:** `.planning/archive/milestones/v1.5-ROADMAP.md`, `.planning/archive/milestones/v1.5-REQUIREMENTS.md`, `.planning/archive/milestones/v1.5-MILESTONE-AUDIT.md`

---

## v1.4 Snippets and Colors, Colors and Snippets (Shipped: 2026-04-15)

**Phases completed:** 4 phases (28–31), 12 plans
**Timeline:** 2026-04-13 → 2026-04-15 (3 days)
**Git:** 54 commits, 66 files changed, +8753/-110 LOC (`46656af` → `d6c6280`)

**Key accomplishments:**

- Phase 28: Auto node coloring — single injection point in `saveNodeEdits` writes the correct canvas color on every save across both Pattern B (canvas open) and Strategy A (canvas closed) paths; test helper `makeCanvasNode` auto-derives color from `radiprotocol_nodeType` (NODE-COLOR-01/02/03)
- Phase 29: Snippet node model — 8th node kind in discriminated union; canvas-parser recognizes `radiprotocol_nodeType = "snippet"`; graph-validator warns on missing subfolder path; EditorPanel form with BFS-based subfolder picker under `.radiprotocol/snippets/` (SNIPPET-NODE-01/02/08)
- Phase 30: Runner snippet integration — new `awaiting-snippet-pick` runner state, `ProtocolRunner.pickSnippet()` routing into the existing fill-in flow, session serialize/restore support, `SnippetService.listFolder` with pre-I/O path-safety gate (rejects `..`, absolute paths, sibling-prefix matches), RunnerView picker with subfolder drill-down (SNIPPET-NODE-03/04/05/06/07)
- Phase 31: Mixed answer + snippet branching — question nodes can route to both answer and snippet nodes simultaneously; `chooseSnippetBranch` runner API with undo-before-mutate and `returnToBranchList` flag; per-node `snippetLabel` + separator override editable in Node Editor; RunnerView partitions branches into two render loops
- All 11 v1.4 requirements satisfied; milestone audit re-passed after Phase 30 retroactive verification + Phase 29 live-vault UAT closure + Phase 31 UAT 5/5
- Known deferred tech debt: Nyquist VALIDATION.md still in draft for phases 28–31 (matches existing v1.2 retroactive-Nyquist backlog entry)

**Archive:** `.planning/archive/milestones/v1.4-ROADMAP.md`, `.planning/archive/milestones/v1.4-REQUIREMENTS.md`, `.planning/archive/milestones/v1.4-MILESTONE-AUDIT.md`, `.planning/archive/milestones/v1.4-phases/`

---

## v1.3 Interactive Placeholder Editor (Shipped: 2026-04-12)

**Phases completed:** 1 phase (27), 1 plan  
**Timeline:** 2026-04-12 (single day, ~3.5 hours)  
**Git:** 17 commits, 2 source files, +266 lines (snippet-manager-view.ts +172, styles.css +94)

**Key accomplishments:**

- Phase 27: Replaced expandable row list with chip-based placeholder UI — type-coloured left bar (PH_COLOR), human-readable label, type badge, drag handle, remove button (CHIP-01)
- Phase 27: HTML5 native drag-and-drop reorder with 6-event DnD per chip, correct splice pattern, dragleave child-flicker guard (CHIP-02)
- Phase 27: `autoSaveAfterDrop()` persists reordered array via `snippetService.save()` — SnippetFillInModal tab order follows persisted order at zero modal changes (CHIP-03)
- Phase 27: UUID guard in `autoSaveAfterDrop()` prevents saving unsaved drafts; 25 automated Vitest tests cover DnD guard conditions, splice algorithm, and UUID guard
- Code review found 5 issues (WR-01–05); all fixed and verified; 5/5 UAT passed in live Obsidian

**Archive:** `.planning/archive/milestones/v1.3-ROADMAP.md`, `.planning/archive/milestones/v1.3-MILESTONE-AUDIT.md`

---

## v1.2 Runner UX & Bug Fixes (Shipped: 2026-04-10)

**Phases completed:** 8 phases (12–19), 11 plans  
**Timeline:** 2026-04-07 → 2026-04-10 (3 days)  
**Git:** ~200 commits, ~7K LOC TypeScript in src/

**Key accomplishments:**

- Phase 12: Redesigned RunnerView layout — auto-grow textarea, correct zone ordering, equal-size buttons, legend removed (LAYOUT-01–04)
- Phase 13: Canvas selector widget in sidebar + Run Again button after protocol completion (SIDEBAR-01, RUNNER-01)
- Phase 14: Click-to-load node auto-switch in EditorPanel + unsaved edit guard modal (EDITOR-01, EDITOR-02)
- Phase 15–16: Global + per-node text separator settings; manual textarea edits preserved across step advances (SEP-01, SEP-02, BUG-01)
- Phase 17: Fixed free-text-input/text-block node type read-back when canvas open; fixed Add button in snippet placeholder mini-form (BUG-02, BUG-03, BUG-04)
- Phase 18–19: Closed 3 CSS styling gaps; wrote retroactive VERIFICATION.md for Phases 12–14; 8/8 UAT passed in live Obsidian

**Archive:** `.planning/archive/milestones/v1.2-ROADMAP.md`, `.planning/archive/milestones/v1.2-MILESTONE-AUDIT.md`

---

## v1.0 Community Plugin Release (Shipped: 2026-04-07)

**Phases completed:** 7 phases, 28 plans  
**Timeline:** 2026-04-05 → 2026-04-07 (3 days)  
**Git:** 158 commits, 167 files, ~43K LOC

**Key accomplishments:**

- Phase 1: Plugin scaffold with esbuild, strict TypeScript, hot-reload dev script, and full ESLint flat config (23 obsidianmd rules) — all 14 tests green
- Phase 2: Pure traversal state machine with discriminated union (5 states), TextAccumulator with snapshot undo, ProtocolRunner covering all node types and iteration cap — all runner tests green
- Phase 3: End-to-end RunnerView ItemView — two-zone live preview layout, all question types rendered, copy/save output, NodePickerModal, main.ts fully wired — UAT approved on all 13 checks
- Phase 4: EditorPanelView side panel with per-node forms for all 7 node kinds, canvas write-back with closed-canvas guard, context menu integration — UAT approved, all 7 tests passed
- Phase 5: Full snippet system — SnippetService CRUD, WriteMutex, SnippetManagerView master-detail UI, SnippetFillInModal with live preview, runner awaiting-snippet-fill integration — UAT approved
- Phase 6: Loop engine with LoopContext stack, undo across loop boundaries, RunnerView loop-end UI with iteration label and loop again/done buttons — 3-lesion protocol confirmed end-to-end
- Phase 7: SessionService auto-save/resume, ResumeSessionModal, canvas mtime check, snippet content snapshot, Set→Array serialization, onLayoutReady deferral fix — all SESSION requirements verified

**Archive:** `.planning/archive/milestones/v1.0-ROADMAP.md`, `.planning/archive/milestones/v1.0-REQUIREMENTS.md`

---

## v1.13 AI-Agent Friction Reduction & Codebase Health (Closed: 2026-05-02 — internal-only, no GitHub Release)

**Phases completed:** 5 phases (79–83), 17 plans, 5/5 requirements satisfied
**Timeline:** 2026-05-02 (1 day)
**Git:** 8 commits on `dev/v1.13-phase-79` → merged via [PR #2](https://github.com/vegacepticon/RadiProtocol/pull/2)
**src/ delta:** +613/−615 across 12 files (tree-renderer.ts +530, session-recovery-coordinator.ts +112, runner-view.ts −45, snippet-manager-view.ts −473, dom-helpers.ts +64, _utilities.css +63)
**Release:** **none** — v1.13 is internal-only by REQUIREMENTS.md design; end users on `1.12.0` see no behavior change.

**Key accomplishments:**

- Phase 79: Typed constants for runner states (`src/constants/runner-states.ts`) and CSS classes (`src/constants/css-classes.ts`) — replaced stringly-typed literals across `src/runner/`, `src/views/`, and `src/__tests__/` (EXTRACT-TYPES-01)
- Phase 80: Reusable CSS utilities (`src/styles/_utilities.css`) + `stylelint` config wired into `npm run lint` and pre-commit hook (SPLIT-CSS-01)
- Phase 81: Typed `dom-helpers` module (`src/utils/dom-helpers.ts`) with `createButton`, `createInput`, `createTextarea`, `registerDomEvent` — eliminated `as HTML*Element` casts in hot-path renderers (TYPE-SAFETY-01)
- Phase 82: `SnippetManagerView` decomposition — extracted `src/views/snippet-manager/tree-renderer.ts` (~530 LOC); original view 1034 → 531 lines (−48%) (REFACTOR-SNIPPET-MGR-01)
- Phase 83: `RunnerView` SessionRecoveryCoordinator — extracted `src/runner/session-recovery-coordinator.ts` (112 LOC); view 925 → 880 lines; autosave, resume prompt, canvas-modification-warning fully delegated (REFACTOR-RUNNER-VIEW-01)

**Final gate:** `npm test` 847/1 skipped, `npm run build` exit 0, `npm run lint` 0 errors / 2 known warnings

**Known deferred items at close:**

- **2 lint warnings** — `obsidianmd/prefer-file-manager-trash-file` in `src/snippets/snippet-service.ts:240,283` (documented out-of-scope since v1.12)
- **MEDIUM-5** — `protocol-runner.ts` (819 LOC) remains large; not in v1.13 scope
- **Verification backfill** — Phases 64/66/67/68 still lack formal `VERIFICATION.md`; Nyquist `VALIDATION.md` for Phases 63–83 missing (project-wide tech debt)

---
